import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const STAMP = "2026-08-29T05-51-13-934Z";
const MODEL_ARMS = ["hunk-only", "selected", "full-bundle"] as const;
const BASELINE_ARMS = ["baseline-keep_ours", "baseline-keep_theirs", "baseline-compose"] as const;

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

	it("aggregates aligned stamped baselines with one grader and a five-point margin", async () => {
		const directory = fixtureDirectory();
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
		for (const arm of BASELINE_ARMS) {
			writeJsonl(
				join(directory, `evidence/h0/runs/${arm}-${STAMP}.jsonl`),
				baselineRows.filter(
					(row) => row.arm === arm && row.triple_id === "selected-triple",
				),
			);
		}

		await runScript(directory, "evidence/h0/_aggregate.ts");

		const aggregate = JSON.parse(
			readFileSync(join(directory, "evidence/h0/aggregate.json"), "utf8"),
		) as {
			trivial_ceiling?: Record<string, { triples: number; correct: number }>;
			kill_condition: {
				met: boolean;
				epsilon: number;
				best_model_wrong_fraction: number;
				compose_wrong_fraction: number;
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
		expect(aggregate.kill_condition.epsilon).toBe(0.05);
		expect(aggregate.kill_condition.best_model_wrong_fraction).toBe(1);
		expect(aggregate.kill_condition.compose_wrong_fraction).toBe(1);
		expect(aggregate.kill_condition.met).toBe(true);
		expect(aggregate.verdict).toBe("null");
	});

	it("rejects duplicate triple/run rows before scoring", async () => {
		const directory = fixtureDirectory();
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
			});
		for (const arm of BASELINE_ARMS) {
			const rows = baselineRows.filter(
				(row) => row.arm === arm && row.triple_id === "selected-triple",
			);
			if (arm === "baseline-compose") rows.push(rows[0]);
			writeJsonl(
				join(directory, `evidence/h0/runs/${arm}-${STAMP}.jsonl`),
				rows,
			);
		}

		await expect(
			runScript(directory, "evidence/h0/_aggregate.ts"),
		).rejects.toThrow("different sampled triple/run set");
	});
});

