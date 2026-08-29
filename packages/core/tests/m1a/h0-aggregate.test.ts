import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { closeDb, openDb, type DbHandle } from "../../src/db/open.js";
import { RunStore } from "../../src/db/run-store.js";

import { loadH0Aggregate } from "../../src/m1a/h0-aggregate.js";

/**
 * RED tests for `mrgr-h0-aggregate`.
 *
 * Loader API (per task brief + ruling-supersedes-stale-default override):
 *   loadH0Aggregate(
 *     dbPath: string,
 *     options: {
 *       files: readonly string[];          // explicit list of JSONL files
 *       commitPin: string;                // exact commit SHA expected
 *     }
 *   ): Promise<DbResult<ImportCounts>>
 *
 * Why explicit files + commit pin and not `runsDir`:
 *   The original brief's `{ runsDir?: string }` defaulted to a broad
 *   `evidence/h0/runs/*.jsonl` discovery glob. That is rejected — the loader
 *   must NOT silently pick up files outside the caller's intent. The ruling
 *   supersedes the stale default: every call names its files explicitly and
 *   pins a commit so the persisted provenance is reproducible.
 *
 * File-level guards exercised below:
 *   - filenames sharing one run-id/timestamp prefix are required (cf. brief:
 *     `runs/full-bundle-2026-08-27T10-27-45-544Z.jsonl`)
 *   - one arm per file (mixed run-id/timestamp filenames in one call → error)
 *   - duplicate arms → error
 *
 * Row mapping (per brief):
 *   One RunConfig per arm file. arm        = row.arm
 *                                modelName  = row.model.name
 *                                modelSha   = row.model.sha
 *                                config     = { commit_pin, arm, prompt_template }
 *   RunResultRecord per row.    tripleId   = row.triple_id
 *                                runIndex   = row.run
 *                                decision   = row.decision (verbatim)
 *                                inputTokens/outputTokens/schemaValid copied
 *                                haltReason = row.halt_reason ONLY when row.decision === "halt"
 *
 * No ledger entry (per brief).
 */

const COMMIT_PIN = "085ad4f";
const RUN_TS = "2026-08-27T10-27-45-544Z";

interface FixtureRow {
	triple_id: string;
	arm: string;
	model: { name: string; sha: string };
	run: number;
	input_tokens: number;
	output_tokens: number;
	decision: "keep_ours" | "keep_theirs" | "compose" | "halt";
	halt_reason: string | null;
	schema_valid: boolean;
	reason_text?: string;
}

let dir: string;
let dbPath: string;
let handle: DbHandle;

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "mrgr-h0-aggregate-"));
	dbPath = join(dir, "mrgr.db");
	const opened = openDb(dbPath, { create: true });
	if (!opened.ok) throw new Error(opened.error.message);
	handle = opened.value;
});

afterEach(() => {
	closeDb(handle);
	rmSync(dir, { recursive: true, force: true });
});

function writeJsonl(name: string, rows: readonly FixtureRow[]): string {
	const path = join(dir, name);
	const body = rows.map((r) => JSON.stringify(r)).join("\n") + (rows.length > 0 ? "\n" : "");
	writeFileSync(path, body);
	return path;
}

function fixtureRows(arm: string, n = 3): FixtureRow[] {
	return Array.from({ length: n }, (_, i): FixtureRow => {
		const isHalt = i === n - 1; // last row exercises the halt branch
		return {
			triple_id: `triple-${arm}-${i + 1}`,
			arm,
			model: {
				name: "Qwen3-Coder-30B-A3B-Instruct-UD-Q3_K_XL",
				sha: "69cd7578d77dffc0b17e34bad9ef998d08ae0e20ccceef21bad4e7eb3d8c553b",
			},
			run: i + 1,
			input_tokens: 100 + i,
			output_tokens: 50 + i,
			// The H0 runner's recorded decision values are constrained by the
			// schema CHECK. Mix "compose" (canonical non-halt) with a final
			// "halt" row carrying a non-null halt_reason so the conditional
			// haltReason mapping is exercised.
			decision: isHalt ? "halt" : "compose",
			halt_reason: isHalt ? "runner declared halt: schema invalid" : null,
			schema_valid: !isHalt, // halt row reports schema_invalid
		};
	});
}

function runIdFor(arm: string): string {
	const row = handle.db
		.prepare("SELECT run_id FROM run WHERE arm = ?")
		.get(arm) as { run_id: string } | undefined;
	expect(row).toBeDefined();
	if (!row) throw new Error(`no run row for arm ${arm}`);
	return row.run_id;
}

function runConfigJson(arm: string): unknown {
	const row = handle.db
		.prepare("SELECT config_json FROM run WHERE arm = ?")
		.get(arm) as { config_json: string } | undefined;
	expect(row).toBeDefined();
	if (!row) throw new Error(`no run row for arm ${arm}`);
	return JSON.parse(row.config_json);
}

describe("loadH0Aggregate — happy path", () => {
	it("C1 — persists one run per arm and round-trips each row's tuple verbatim", async () => {
		const fullBundleRows = fixtureRows("full-bundle", 3);
		const hunkOnlyRows = fixtureRows("hunk-only", 2);
		const fullBundlePath = writeJsonl(`full-bundle-${RUN_TS}.jsonl`, fullBundleRows);
		const hunkOnlyPath = writeJsonl(`hunk-only-${RUN_TS}.jsonl`, hunkOnlyRows);

		const result = await loadH0Aggregate(dbPath, {
			files: [fullBundlePath, hunkOnlyPath],
			commitPin: COMMIT_PIN,
		});
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.imported).toBe(fullBundleRows.length + hunkOnlyRows.length);
		expect(result.value.failed).toBe(0);
		expect(result.value.skippedDuplicate).toBe(0);

		const store = new RunStore(handle);

		// One run per arm file.
		const armRows = handle.db
			.prepare("SELECT arm FROM run ORDER BY arm")
			.all() as { arm: string }[];
		expect(armRows.map((r) => r.arm)).toEqual(["full-bundle", "hunk-only"]);

		// full-bundle arm: 3 rows. As with A1 in the sibling test, listResults
		// sorts by (triple_id, run_index), not by source line order — index
		// both sides by `${tripleId}|${runIndex}` so the comparison is
		// independent of any ordering choice.
		const fullBundleId = runIdFor("full-bundle");
		const fullBundleListed = store.listResults(fullBundleId);
		expect(fullBundleListed.ok).toBe(true);
		if (!fullBundleListed.ok) return;
		const fullBundleRecords = fullBundleListed.value;
		expect(fullBundleRecords).toHaveLength(3);

		const expectedByKey = new Map(
			fullBundleRows.map((r) => [`${r.triple_id}|${r.run}`, r] as const),
		);
		const actualByKey = new Map(
			fullBundleRecords.map((r) => [`${r.tripleId}|${r.runIndex}`, r] as const),
		);
		expect(actualByKey.size).toBe(expectedByKey.size);
		for (const [key, expected] of expectedByKey) {
			const actual = actualByKey.get(key);
			expect(actual, `missing persisted row for ${key}`).toBeDefined();
			if (!actual) continue;
			expect(actual.decision).toBe(expected.decision);
			expect(actual.inputTokens).toBe(expected.input_tokens);
			expect(actual.outputTokens).toBe(expected.output_tokens);
			expect(actual.schemaValid).toBe(expected.schema_valid);
			if (expected.decision === "halt") {
				// Halt rows: haltReason must mirror the source row verbatim.
				// The schema does NOT carry a default halt_reason for halt
				// decisions, so the loader must propagate the field exactly.
				expect(actual.haltReason).toBe(expected.halt_reason);
				expect(actual.haltReason).not.toBeNull();
			} else {
				// Non-halt rows: the schema does not assert a non-null
				// halt_reason for non-halt decisions, so the persisted value
				// must mirror the source row's null (do not invent one).
				expect(actual.haltReason).toBeNull();
			}
		}

		// hunk-only arm: 2 rows. With n=2 the fixture's last row is the
		// halt row, so this arm also exercises the halt branch.
		const hunkOnlyId = runIdFor("hunk-only");
		const hunkOnlyListed = store.listResults(hunkOnlyId);
		expect(hunkOnlyListed.ok).toBe(true);
		if (!hunkOnlyListed.ok) return;
		const hunkOnlyRecords = hunkOnlyListed.value;
		expect(hunkOnlyRecords).toHaveLength(2);
		const hunkOnlyByKey = new Map(
			hunkOnlyRows.map((r) => [`${r.triple_id}|${r.run}`, r] as const),
		);
		const hunkOnlyActualByKey = new Map(
			hunkOnlyRecords.map((r) => [`${r.tripleId}|${r.runIndex}`, r] as const),
		);
		for (const [key, expected] of hunkOnlyByKey) {
			const actual = hunkOnlyActualByKey.get(key);
			expect(actual, `missing persisted row for ${key}`).toBeDefined();
			if (!actual) continue;
			expect(actual.decision).toBe(expected.decision);
			expect(actual.schemaValid).toBe(expected.schema_valid);
			if (expected.decision === "halt") {
				expect(actual.haltReason).toBe(expected.halt_reason);
			} else {
				expect(actual.haltReason).toBeNull();
			}
		}
	});

	it("C2 — pins each run's config to commit_pin / arm / prompt_template and writes no ledger row", async () => {
		const fullBundleRows = fixtureRows("full-bundle", 1);
		const fullBundlePath = writeJsonl(`full-bundle-${RUN_TS}.jsonl`, fullBundleRows);

		const result = await loadH0Aggregate(dbPath, {
			files: [fullBundlePath],
			commitPin: COMMIT_PIN,
		});
		expect(result.ok).toBe(true);
		if (!result.ok) return;

		// RunConfig fields are populated from the row, not from the file name.
		const runRow = handle.db
			.prepare("SELECT model_name, model_sha FROM run WHERE arm = ?")
			.get("full-bundle") as { model_name: string; model_sha: string };
		expect(runRow.model_name).toBe(fullBundleRows[0]!.model.name);
		expect(runRow.model_sha).toBe(fullBundleRows[0]!.model.sha);

		// config_json carries commit_pin + arm + the prompt_template (the
		// row's full first-row content JSON), so a re-run with a different
		// prompt surfaces as a distinct run_id.
		const config = runConfigJson("full-bundle") as {
			commit_pin?: string;
			arm?: string;
			prompt_template?: unknown;
		};
		expect(config.commit_pin).toBe(COMMIT_PIN);
		expect(config.arm).toBe("full-bundle");
		expect(config.prompt_template).toEqual(fullBundleRows[0]);

		// Verification-shape gate: no ledger row is written. C2 in the brief
		// also calls for `mrgr-db verify` to exit 0 — instead of spawning
		// the `mrgr-db` subprocess (which requires a built dist + temp DB),
		// the same observable is reachable in-process via `PRAGMA
		// integrity_check` plus `foreign_key_check`. A GREEN implementation
		// must keep the DB valid: any FK violation or integrity error here
		// means the loader corrupted the schema it does not own.
		const integrity = handle.db
			.prepare("PRAGMA integrity_check")
			.all() as { integrity_check: string }[];
		expect(integrity.map((r) => r.integrity_check)).toEqual(["ok"]);

		const fkViolations = handle.db
			.prepare("PRAGMA foreign_key_check")
			.all();
		expect(fkViolations).toEqual([]);

		const ledgerCount = handle.db
			.prepare("SELECT count(*) AS n FROM ledger")
			.get() as { n: number };
		expect(ledgerCount.n).toBe(0);
	});
});

describe("loadH0Aggregate — file-level provenance guards", () => {
	it("rejects a call that mixes filenames from different run-id/timestamp sets", async () => {
		const fullBundlePath = writeJsonl(`full-bundle-${RUN_TS}.jsonl`, fixtureRows("full-bundle", 1));
		const differentTsPath = writeJsonl(
			"full-bundle-2099-01-01T00-00-00-000Z.jsonl",
			fixtureRows("full-bundle", 1),
		);

		const result = await loadH0Aggregate(dbPath, {
			files: [fullBundlePath, differentTsPath],
			commitPin: COMMIT_PIN,
		});
		expect(result.ok).toBe(false);
		if (result.ok) return;
		// Typed error: filenames must share one run-id/timestamp. A generic
		// "config" or "input" kind is acceptable as long as the message names
		// the mixed-timestamp problem; otherwise the loader's guard is too
		// quiet and a reviewer cannot audit what tripped it.
		expect(["config", "input", "db"]).toContain(result.error.kind);
		expect(result.error.message.toLowerCase()).toMatch(/run[-_ ]?id|timestamp/);

		// No rows reach the database when the guard fires.
		const runCount = handle.db
			.prepare("SELECT count(*) AS n FROM run")
			.get() as { n: number };
		expect(runCount.n).toBe(0);
	});

	it("rejects a single file whose rows declare two different arms", async () => {
		// Build a single valid-timestamp JSONL whose rows carry two distinct
		// arm values. The filename guard passes (one file, one timestamp);
		// the content guard must catch the mixed-arm condition and abort
		// before any row reaches the DB.
		const mixedRows: FixtureRow[] = [
			...fixtureRows("full-bundle", 1),
			...fixtureRows("hunk-only", 1),
		];
		const path = writeJsonl(`mixed-arms-${RUN_TS}.jsonl`, mixedRows);

		const result = await loadH0Aggregate(dbPath, {
			files: [path],
			commitPin: COMMIT_PIN,
		});
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(["config", "input", "db"]).toContain(result.error.kind);
		expect(result.error.message.toLowerCase()).toMatch(/arm/);

		const runCount = handle.db
			.prepare("SELECT count(*) AS n FROM run")
			.get() as { n: number };
		expect(runCount.n).toBe(0);

		const resultCount = handle.db
			.prepare("SELECT count(*) AS n FROM run_result")
			.get() as { n: number };
		expect(resultCount.n).toBe(0);
	});

	it("rejects a single file whose rows disagree on model.sha", async () => {
		// One valid-timestamped file, one arm across both rows, exactly one
		// differing dimension (`model.sha`). The `RunConfig.modelName` /
		// `modelSha` columns come from a single source of truth — the
		// brief's row mapping says `modelName = row.model.name` and
		// `modelSha = row.model.sha` — and two rows in one file cannot
		// honestly carry different sha values for the same arm. The loader
		// must abort with a typed error before any row reaches the DB.
		const baseRow = fixtureRows("full-bundle", 1)[0]!;
		const swappedSha: FixtureRow = {
			...baseRow,
			triple_id: "triple-full-bundle-2",
			model: {
				name: baseRow.model.name,
				sha: "0000000000000000000000000000000000000000000000000000000000000000",
			},
		};
		const path = writeJsonl(
			`inconsistent-model-${RUN_TS}.jsonl`,
			[baseRow, swappedSha],
		);

		const result = await loadH0Aggregate(dbPath, {
			files: [path],
			commitPin: COMMIT_PIN,
		});
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(["config", "input", "db"]).toContain(result.error.kind);
		expect(result.error.message.toLowerCase()).toMatch(/model|sha/);

		// No rows reach the database when the guard fires.
		const runCount = handle.db
			.prepare("SELECT count(*) AS n FROM run")
			.get() as { n: number };
		expect(runCount.n).toBe(0);

		const resultCount = handle.db
			.prepare("SELECT count(*) AS n FROM run_result")
			.get() as { n: number };
		expect(resultCount.n).toBe(0);
	});

	it("rejects a call that names the same arm twice (duplicate arms)", async () => {
		// Two valid-timestamp filenames with different `<arm>` slots, but
		// every row in both files declares the same arm. The filename regex
		// passes (one timestamp across files), the per-file arm guard passes
		// (each file declares exactly one arm), so the duplicate-arm guard
		// across files is the one that must fire.
		const a = writeJsonl(`full-bundle-${RUN_TS}.jsonl`, fixtureRows("full-bundle", 1));
		const b = writeJsonl(`hunk-only-${RUN_TS}.jsonl`, fixtureRows("full-bundle", 1));
		const result = await loadH0Aggregate(dbPath, {
			files: [a, b],
			commitPin: COMMIT_PIN,
		});
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(["config", "input", "db"]).toContain(result.error.kind);
		expect(result.error.message.toLowerCase()).toContain("dup");

		const runCount = handle.db
			.prepare("SELECT count(*) AS n FROM run WHERE arm = ?")
			.get("full-bundle") as { n: number };
		expect(runCount.n).toBe(0);
	});

	it("requires both `files` and `commitPin` — refuses to fall back to a runsDir default", async () => {
		const onlyFiles = writeJsonl(`full-bundle-${RUN_TS}.jsonl`, fixtureRows("full-bundle", 1));

		const noFiles = await loadH0Aggregate(dbPath, {
			files: undefined as unknown as readonly string[],
			commitPin: COMMIT_PIN,
		});
		expect(noFiles.ok).toBe(false);
		if (!noFiles.ok) expect(["config", "input"]).toContain(noFiles.error.kind);

		const noPin = await loadH0Aggregate(dbPath, {
			files: [onlyFiles],
			commitPin: undefined as unknown as string,
		});
		expect(noPin.ok).toBe(false);
		if (!noPin.ok) expect(["config", "input"]).toContain(noPin.error.kind);

		// And a call that tries the legacy `runsDir` shape is rejected: the
		// ruling-supersedes-stale-default override forbids the broad
		// `runs/*.jsonl` discovery path entirely.
		const legacy = await loadH0Aggregate(dbPath, {
			runsDir: join(dir, "runs"),
			commitPin: COMMIT_PIN,
		} as unknown as Parameters<typeof loadH0Aggregate>[1]);
		expect(legacy.ok).toBe(false);
		if (!legacy.ok) expect(["config", "input"]).toContain(legacy.error.kind);

		// Nothing was loaded from the silent fallback.
		const runCount = handle.db
			.prepare("SELECT count(*) AS n FROM run")
			.get() as { n: number };
		expect(runCount.n).toBe(0);
	});
});
