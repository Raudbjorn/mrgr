import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
	binomialSignTestTwoSided,
	fisherExactTwoSided,
	isHistoricalMatch,
} from "../../../../evidence/h0/_aggregate.js";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const STAMP = "2026-08-29T05-51-13-934Z";
const MODEL_ARMS = ["hunk-only", "selected", "full-bundle"] as const;

const temporaryDirectories: string[] = [];

function writeJsonl(path: string, rows: readonly unknown[]): void {
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, rows.map((row) => JSON.stringify(row)).join("\n") + "\n");
}

function triple(tripleKey: string): Record<string, unknown> {
	return {
		triple_key: tripleKey,
		resolution: "shared ours\nshared theirs\nresolved\n",
		ours: "shared ours\nours only\n",
		theirs: "shared theirs\ntheirs only\n",
	};
}

function modelRecord(
	tripleId: string,
	arm: typeof MODEL_ARMS[number],
	run: number,
): Record<string, unknown> {
	return {
		triple_id: tripleId,
		arm,
		model: { name: "fixture-model", sha: "fixture-sha" },
		run,
		input_tokens: 1,
		output_tokens: 1,
		decision: "keep_ours",
		halt_reason: null,
		reason_text: "fixture",
		evidence_ids_quoted: [],
		fabricated_ids: false,
		duration_ms: 1,
		schema_valid: true,
	};
}

function fixtureDirectory(): string {
	const directory = mkdtempSync(join(tmpdir(), "mrgr-h0-producers-"));
	temporaryDirectories.push(directory);
	writeJsonl(join(directory, "evidence/h0/triples-jq-diff3.jsonl"), [triple("selected-triple")]);
	writeJsonl(join(directory, "evidence/h0/triples-cli-diff3.jsonl"), [triple("unselected-triple")]);
	for (const arm of MODEL_ARMS) {
		writeJsonl(
			join(directory, `evidence/h0/runs/${arm}-${STAMP}.jsonl`),
			[1, 2, 3].map((run) => modelRecord("selected-triple", arm, run)),
		);
	}
	return directory;
}

async function runScript(directory: string, relativePath: string): Promise<void> {
	const previousDirectory = process.cwd();
	const previousRepeats = process.env.H0_REPEATS;
	const previousStamp = process.env.H0_STAMP;
	process.chdir(directory);
	process.env.H0_REPEATS = "3";
	process.env.H0_STAMP = STAMP;
	try {
		const url = `${pathToFileURL(resolve(REPO_ROOT, relativePath)).href}?test=${crypto.randomUUID()}`;
		// Dynamic import is intentional: each test executes the one-off script
		// against an isolated cwd and bypasses the ESM module cache.
		const loaded = await import(url) as { main?: () => void | Promise<void> };
		if (loaded.main) await loaded.main();
	} finally {
		process.chdir(previousDirectory);
		if (previousRepeats === undefined) delete process.env.H0_REPEATS;
		else process.env.H0_REPEATS = previousRepeats;
		if (previousStamp === undefined) delete process.env.H0_STAMP;
		else process.env.H0_STAMP = previousStamp;
	}
}


afterEach(() => {
	for (const directory of temporaryDirectories.splice(0)) {
		rmSync(directory, { recursive: true, force: true });
	}
});

describe.sequential("H0 baseline and aggregate producers", () => {

	it("aggregates aligned stamped baselines with one grader, and nulls when no arm beats the ceiling", async () => {
		const directory = fixtureDirectory();
		// _baselines.ts writes the aligned per-stamp runs/baseline-{arm}-{STAMP}.jsonl
		// files itself when H0_STAMP is set (runScript sets it) and a model arm
		// file for that stamp already exists (fixtureDirectory wrote hunk-only
		// above) — this exercises the real production handoff, not a fake.
		await runScript(directory, "evidence/h0/_baselines.ts");
		const baselineRows = readFileSync(
			join(directory, "evidence/h0/baselines.json"),
			"utf8",
		)
			.trim()
			.split("\n")
			.map((line) => JSON.parse(line) as {
				triple_id: string;
				arm: string;
				reason_text: string;
			});

		await runScript(directory, "evidence/h0/_aggregate.ts");

		const aggregate = JSON.parse(
			readFileSync(join(directory, "evidence/h0/aggregate.json"), "utf8"),
		) as {
			trivial_ceiling?: Record<string, { triples: number; correct: number }>;
			kill_condition: {
				met: boolean;
				wrong_fraction_reported_not_binding: {
					epsilon: number;
					best_model_wrong_fraction: number;
					compose_wrong_fraction: number;
				};
			};
			verdict: string;
		};

		expect(aggregate.trivial_ceiling?.compose?.triples).toBe(1);
		const composeReasonMatches = baselineRows.filter(
			(row) =>
				row.triple_id === "selected-triple" &&
				row.arm === "baseline-compose" &&
				row.reason_text.endsWith("isHistoricalMatch=true"),
		).length;
		expect(composeReasonMatches).toBe(aggregate.trivial_ceiling?.compose?.correct);
		// Wrong-fraction figures are still emitted, but nested under a name
		// that says they are not the gate.
		expect(aggregate.kill_condition.wrong_fraction_reported_not_binding.epsilon).toBe(0.05);
		expect(aggregate.kill_condition.wrong_fraction_reported_not_binding.best_model_wrong_fraction).toBe(1);
		expect(aggregate.kill_condition.wrong_fraction_reported_not_binding.compose_wrong_fraction).toBe(1);
		expect(aggregate.kill_condition.met).toBe(true);
		expect(aggregate.verdict).toBe("null");
	});

	it("rejects duplicate triple/run rows before scoring", async () => {
		const directory = fixtureDirectory();
		// Real per-stamp baseline files come from _baselines.ts (same as the
		// test above); duplicate one row in the real baseline-compose output
		// to trigger the aggregator's mismatched/duplicate-key rejection.
		await runScript(directory, "evidence/h0/_baselines.ts");
		const composeFile = join(directory, `evidence/h0/runs/baseline-compose-${STAMP}.jsonl`);
		const composeRows = readFileSync(composeFile, "utf8")
			.trim()
			.split("\n")
			.map((line) => JSON.parse(line) as Record<string, unknown>);
		composeRows.push(composeRows[0]!);
		writeJsonl(composeFile, composeRows);

		await expect(
			runScript(directory, "evidence/h0/_aggregate.ts"),
		).rejects.toThrow("different sampled triple/run set");
	});
});


// ---------------------------------------------------------------------------
// WP3/WP4 acceptance gate: the significance machinery and its reachability.
//
// The previous kill rule was replaced because it was unfalsifiable
// (Infinity denominator). Its replacement was never actually exercised in
// both directions, which is what redesign-requirements.md §7 #5 demands
// ("verify by hand that the kill condition fires"). These tests do that in
// code, in both directions, so the gate cannot silently regress to
// unreachable again.
// ---------------------------------------------------------------------------

describe("exact tests used by the H0 acceptance gate", () => {
	it("computes McNemar's exact two-sided p from the discordant pairs", () => {
		// Hand-computed: with all n discordant pairs falling to one side, the
		// two-sided exact binomial p is 2 * 0.5^n.
		expect(binomialSignTestTwoSided(0, 1)).toBeCloseTo(1, 12);
		expect(binomialSignTestTwoSided(0, 2)).toBeCloseTo(0.5, 12);
		expect(binomialSignTestTwoSided(0, 5)).toBeCloseTo(0.0625, 12);
		expect(binomialSignTestTwoSided(0, 14)).toBeCloseTo(2 * 0.5 ** 14, 12);
		// An even split is maximally unsurprising.
		expect(binomialSignTestTwoSided(5, 10)).toBeCloseTo(1, 12);
		// No discordant pairs is "nothing to test", not "p = 1".
		expect(binomialSignTestTwoSided(0, 0)).toBeNull();
	});

	it("computes Fisher's exact two-sided p on a 2x2 table", () => {
		// Fisher's own tea-tasting table: p = 0.4857142857...
		expect(fisherExactTwoSided(3, 1, 1, 3)).toBeCloseTo(17 / 35, 12);
		// Complete separation on 4+4: only the two extreme tables are as improbable,
		// so p = 2 * C(4,4)C(4,0)/C(8,4) = 2/70 = 1/35.
		expect(fisherExactTwoSided(4, 0, 0, 4)).toBeCloseTo(1 / 35, 12);
		// Identical rows cannot distinguish anything.
		expect(fisherExactTwoSided(2, 2, 2, 2)).toBeCloseTo(1, 12);
	});
});

describe("grader ceiling", () => {
	it("cannot mark any decision correct while constant compose is wrong", () => {
		// isHistoricalMatch normalizes with /\s+/g -> "", which collapses every
		// side to a single line. The compose branch's shared-line overlap test
		// therefore degenerates to string equality, making compose true exactly
		// when keep_ours or keep_theirs is true. Constant compose is thus an
		// upper bound on every arm, and "beat the best trivial baseline on
		// correct count" is unsatisfiable by construction — the same class of
		// unreachable gate the redesign was written to remove.
		const samples = ["", "a", "b", "a b", "b a", "a\nb", "ab", "a\nb\nc"];
		const decisions = ["keep_ours", "keep_theirs", "compose", "halt"] as const;
		const counterexamples: string[] = [];
		for (const resolution of samples) {
			for (const ours of samples) {
				for (const theirs of samples) {
					const composeCorrect = isHistoricalMatch("compose", resolution, ours, theirs);
					if (composeCorrect) continue;
					for (const decision of decisions) {
						if (isHistoricalMatch(decision, resolution, ours, theirs)) {
							counterexamples.push(JSON.stringify({ decision, resolution, ours, theirs }));
						}
					}
				}
			}
		}
		expect(counterexamples).toEqual([]);
	});
});

describe.sequential("kill-branch reachability", () => {
	// The gate must be demonstrably falsifiable in BOTH directions. Real
	// _baselines.ts output can never produce arm_only > 0 (see "grader
	// ceiling" above), so the winning-arm vector here is hand-authored:
	// baseline-compose records carry a decision the grader scores wrong while
	// the model arm's is scored correct. That is a synthetic vector on
	// purpose — it exercises the aggregator's gate, which is the thing under
	// test, not the grader's reachability, which is separately asserted.
	const REACH_STAMP = "2026-08-29T05-51-13-934Z";
	const ALL_ARMS = [
		"hunk-only",
		"selected",
		"full-bundle",
		"baseline-keep_ours",
		"baseline-keep_theirs",
		"baseline-compose",
	] as const;

	function reachabilityDirectory(modelDecision: "keep_ours" | "keep_theirs"): string {
		const directory = mkdtempSync(join(tmpdir(), "mrgr-h0-reach-"));
		temporaryDirectories.push(directory);
		const ids = [1, 2, 3, 4, 5, 6].map((n) => `triple-${n}`);
		writeJsonl(
			join(directory, "evidence/h0/triples-jq-diff3.jsonl"),
			ids.map((id) => ({
				triple_key: id,
				// resolution === ours, so keep_ours is correct and keep_theirs is not.
				resolution: "resolved line\n",
				ours: "resolved line\n",
				theirs: "other line\n",
			})),
		);
		for (const arm of ALL_ARMS) {
			const isModelArm = !arm.startsWith("baseline-");
			writeJsonl(
				join(directory, `evidence/h0/runs/${arm}-${REACH_STAMP}.jsonl`),
				ids.flatMap((id) =>
					[1, 2, 3].map((run) => ({
						triple_id: id,
						arm,
						model: isModelArm
							? { name: "fixture-model", sha: "fixture-sha" }
							: { name: "trivial-baseline", sha: "trivial-baseline-v1" },
						run,
						input_tokens: 1,
						output_tokens: 1,
						decision: arm === "hunk-only" ? modelDecision : "keep_theirs",
						halt_reason: null,
						reason_text: "fixture",
						evidence_ids_quoted: [],
						evidence_ids_exposed: [],
						has_source_tags: false,
						duration_ms: 1,
						schema_valid: true,
					})),
				),
			);
		}
		return directory;
	}

	async function aggregateIn(directory: string): Promise<Record<string, unknown>> {
		const previousDirectory = process.cwd();
		const previousRepeats = process.env.H0_REPEATS;
		const previousStamp = process.env.H0_STAMP;
		process.chdir(directory);
		process.env.H0_REPEATS = "3";
		process.env.H0_STAMP = REACH_STAMP;
		try {
			const url = `${pathToFileURL(resolve(REPO_ROOT, "evidence/h0/_aggregate.ts")).href}?test=${crypto.randomUUID()}`;
			const loaded = await import(url) as { main?: () => void | Promise<void> };
			if (loaded.main) await loaded.main();
		} finally {
			process.chdir(previousDirectory);
			if (previousRepeats === undefined) delete process.env.H0_REPEATS;
			else process.env.H0_REPEATS = previousRepeats;
			if (previousStamp === undefined) delete process.env.H0_STAMP;
			else process.env.H0_STAMP = previousStamp;
		}
		return JSON.parse(readFileSync(join(directory, "evidence/h0/aggregate.json"), "utf8")) as Record<string, unknown>;
	}

	it("does NOT kill when an arm beats the best trivial baseline at p < alpha", async () => {
		const aggregate = await aggregateIn(reachabilityDirectory("keep_ours")) as {
			kill_condition: { met: boolean; passing_arms: string[] };
			significance_verdict: string;
			significance: { comparisons: { unit: string; arm: string; baseline: string; arm_only: number; baseline_only: number; mcnemar_exact_p: number | null }[] };
		};
		const row = aggregate.significance.comparisons.find(
			(c) => c.unit === "triple" && c.arm === "hunk-only" && c.baseline === "baseline-compose",
		)!;
		expect(row.arm_only).toBe(6);
		expect(row.baseline_only).toBe(0);
		// 6 discordant pairs all one way: 2 * 0.5^6 = 0.03125, below alpha.
		expect(row.mcnemar_exact_p).toBeCloseTo(0.03125, 12);
		expect(aggregate.kill_condition.met).toBe(false);
		expect(aggregate.kill_condition.passing_arms).toContain("hunk-only");
		expect(aggregate.significance_verdict).toBe("positive");
	});

	it("kills when no arm beats the best trivial baseline", async () => {
		const aggregate = await aggregateIn(reachabilityDirectory("keep_theirs")) as {
			kill_condition: { met: boolean; passing_arms: string[] };
			significance_verdict: string;
		};
		expect(aggregate.kill_condition.met).toBe(true);
		expect(aggregate.kill_condition.passing_arms).toEqual([]);
		expect(aggregate.significance_verdict).toBe("null");
	});
});

describe.sequential("decision-schema condition", () => {
	// A grammar constrains sampling, so it changes decisions, not just JSON
	// formatting. Two runs are comparable only when they share the condition —
	// MODEL_SHA cannot catch this, because the weights are identical either way.
	const SCHEMA_STAMP = "2026-08-29T05-51-13-934Z";
	const ALL_ARMS = [
		"hunk-only",
		"selected",
		"full-bundle",
		"baseline-keep_ours",
		"baseline-keep_theirs",
		"baseline-compose",
	] as const;

	function schemaDirectory(perArmSchemaSha: Partial<Record<string, string | null>>): string {
		const directory = mkdtempSync(join(tmpdir(), "mrgr-h0-schema-"));
		temporaryDirectories.push(directory);
		writeJsonl(join(directory, "evidence/h0/triples-jq-diff3.jsonl"), [triple("t1")]);
		for (const arm of ALL_ARMS) {
			const sha = perArmSchemaSha[arm];
			writeJsonl(
				join(directory, `evidence/h0/runs/${arm}-${SCHEMA_STAMP}.jsonl`),
				[1, 2, 3].map((run) => ({
					triple_id: "t1",
					arm,
					model: { name: "fixture-model", sha: "fixture-sha" },
					provider: "local",
					// undefined means the key is omitted entirely, which is how
					// every record written before 2026-08-30 looks.
					...(sha === undefined ? {} : { decision_schema_sha: sha }),
					run,
					input_tokens: 1,
					output_tokens: 1,
					decision: "keep_theirs",
					halt_reason: null,
					reason_text: "fixture",
					evidence_ids_quoted: [],
					evidence_ids_exposed: [],
					has_source_tags: false,
					duration_ms: 1,
					schema_valid: true,
				})),
			);
		}
		return directory;
	}

	async function aggregateIn(directory: string): Promise<Record<string, unknown>> {
		const previousDirectory = process.cwd();
		const previousRepeats = process.env.H0_REPEATS;
		const previousStamp = process.env.H0_STAMP;
		process.chdir(directory);
		process.env.H0_REPEATS = "3";
		process.env.H0_STAMP = SCHEMA_STAMP;
		try {
			const url = `${pathToFileURL(resolve(REPO_ROOT, "evidence/h0/_aggregate.ts")).href}?test=${crypto.randomUUID()}`;
			const loaded = await import(url) as { main?: () => void | Promise<void> };
			if (loaded.main) await loaded.main();
		} finally {
			process.chdir(previousDirectory);
			if (previousRepeats === undefined) delete process.env.H0_REPEATS;
			else process.env.H0_REPEATS = previousRepeats;
			if (previousStamp === undefined) delete process.env.H0_STAMP;
			else process.env.H0_STAMP = previousStamp;
		}
		return JSON.parse(readFileSync(join(directory, "evidence/h0/aggregate.json"), "utf8")) as Record<string, unknown>;
	}

	it("reads an absent field as unconstrained, so pre-2026-08-30 runs still aggregate", async () => {
		const aggregate = await aggregateIn(schemaDirectory({}));
		expect(aggregate.decision_schema_sha).toBe("unconstrained");
	});

	it("records the schema digest when every model arm shares one", async () => {
		const sha = "a".repeat(64);
		const aggregate = await aggregateIn(schemaDirectory({
			"hunk-only": sha,
			selected: sha,
			"full-bundle": sha,
		}));
		expect(aggregate.decision_schema_sha).toBe(sha);
	});

	it("refuses to pool a constrained arm with an unconstrained one", async () => {
		await expect(
			aggregateIn(schemaDirectory({
				"hunk-only": "b".repeat(64),
				// selected and full-bundle omit the field: unconstrained.
			})),
		).rejects.toThrow("must share one decision-schema condition");
	});
});
