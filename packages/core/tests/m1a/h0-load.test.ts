import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { closeDb, openDb, type DbHandle } from "../../src/db/open.js";
import { canonicalJson, sha256Hex } from "../../src/db/canonical.js";
import { LedgerStore, type LedgerInput } from "../../src/db/ledger-store.js";
import { RunStore, type RunConfig, type RunResultRecord } from "../../src/db/run-store.js";

import { loadH0MaterializedTriples } from "../../src/m1a/h0-load.js";

/**
 * RED tests for `mrgr-h0-load`.
 *
 * Loader API (per task brief):
 *   loadH0MaterializedTriples(
 *     dbPath: string,
 *     options?: { limit?: number }
 *   ): Promise<DbResult<ImportCounts>>
 *
 * Imports `evidence/h0/triples-{jq,cli}-diff3.jsonl` into mrgr-db as one
 * `run` row + N `run_result` rows + one `ledger` entry. Each `run_result` is
 * a shape-only persistence row: `decision === "halt"` with
 * `haltReason === "loaded: shape-only persistence, no verdict claim"`.
 *
 * Source triple fields used:
 *   - `triple_key`  → `run_result.triple_id`
 *   - `ordinal`     → `run_result.run_index`
 *
 * Run config row identity:
 *   - arm        = "h0-materialized-loader"
 *   - modelName  = "h0-materialized-loader/1"
 *   - modelSha   = "085ad4f33042b82b3725abaa8884eb0ca396ed2"
 *   - config     = { source: [...], triples: 898 }
 *
 * Ledger row identity:
 *   - recordType         = "decision"
 *   - adjudicatorKind    = "script"
 *   - adjudicatorIdentity = "h0-load.ts@085ad4f"
 *   - reason             = "loaded: shape-only persistence, no verdict claim"
 */

const HALT_REASON = "loaded: shape-only persistence, no verdict claim";
const ADJUDICATOR_IDENTITY = "h0-load.ts@085ad4f";
const COMMIT_PIN = "085ad4f33042b82b3725abaa8884eb0ca396ed2";

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = join(dirname(__filename), "../../../..");
const TRIPLES_JQ = join(REPO_ROOT, "evidence/h0/triples-jq-diff3.jsonl");

let dir: string;
let dbPath: string;
let handle: DbHandle;

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "mrgr-h0-load-"));
	dbPath = join(dir, "mrgr.db");
	const opened = openDb(dbPath, { create: true });
	if (!opened.ok) throw new Error(opened.error.message);
	handle = opened.value;
});

afterEach(() => {
	closeDb(handle);
	rmSync(dir, { recursive: true, force: true });
});

function readFirstN(path: string, n: number): string[] {
	const text = readFileSync(path, "utf8");
	const lines = text.split("\n");
	const out: string[] = [];
	for (const line of lines) {
		if (line.length === 0) continue;
		out.push(line);
		if (out.length === n) break;
	}
	return out;
}

function loadFixture(
	n: number,
): Array<{
	repository_id: string;
	merge_sha: string;
	baseline_id: string;
	path: string;
	ordinal: number;
	triple_key: string;
}> {
	return readFirstN(TRIPLES_JQ, n).map((line) => {
		const parsed = JSON.parse(line) as {
			repository_id: string;
			merge_sha: string;
			baseline_id: string;
			path: string;
			ordinal: number;
			triple_key: string;
		};
		return {
			repository_id: parsed.repository_id,
			merge_sha: parsed.merge_sha,
			baseline_id: parsed.baseline_id,
			path: parsed.path,
			ordinal: parsed.ordinal,
			triple_key: parsed.triple_key,
		};
	});
}

function derivedTripleId(triple: {
	repository_id: string;
	merge_sha: string;
	baseline_id: string;
	path: string;
	ordinal: number;
	triple_key: string;
}): string {
	return sha256Hex(
		canonicalJson({
			repositoryId: triple.repository_id,
			mergeSha: triple.merge_sha,
			baselineId: triple.baseline_id,
			path: triple.path,
			ordinal: triple.ordinal,
			tripleKey: triple.triple_key,
		}),
	);
}

describe("loadH0MaterializedTriples", () => {
	it("A1 — round-trips every triple as a halt row preserving triple_key and ordinal", async () => {
		const fixture = loadFixture(3);
		expect(fixture).toHaveLength(3);

		const result = await loadH0MaterializedTriples(dbPath, { limit: 3 });
		expect(result.ok).toBe(true);
		if (!result.ok) return;

		// Use the canonical RunConfig so the loader's row id matches a fresh
		// read-back. We do not assert on the loader's chosen run id directly;
		// instead we look up the unique run row for this arm and use its id.
		const store = new RunStore(handle);
		const row = handle.db
			.prepare("SELECT run_id FROM run WHERE arm = ?")
			.get("h0-materialized-loader") as { run_id: string } | undefined;
		expect(row).toBeDefined();
		if (!row) return;
		const runId = row.run_id;

		const listed = store.listResults(runId);
		expect(listed.ok).toBe(true);
		if (!listed.ok) return;
		const records = listed.value;
		expect(records).toHaveLength(3);

		// RunStore.listResults() orders by (triple_id, run_index) — a sort key
		// that does NOT match the source JSONL line order. Index both the
		// fixture (which mirrors the source) and the persisted records (which
		// arrive in PK-sorted order) by the loader's derived tripleId so the
		// comparison is independent of any ordering choice.
		//
		// The loader MUST derive tripleId as
		//   sha256Hex(canonicalJson({
		//     repositoryId, mergeSha, baselineId, path, ordinal, tripleKey,
		//   }))
		// — NOT as `triple.triple_key` directly. The materialized corpus has
		// 898 rows but only 886 unique (triple_key, ordinal) pairs, so a
		// direct triple_key identity silently drops 12 rows under a strict
		// (run_id, triple_id, run_index) primary key.
		const expectedByKey = new Map(
			fixture.map((f) => [derivedTripleId(f), f] as const),
		);
		const actualByKey = new Map(
			records.map((r) => [r.tripleId, r] as const),
		);
		expect(actualByKey.size).toBe(expectedByKey.size);
		for (const [_key, expected] of expectedByKey) {
			const key = derivedTripleId(expected);
			const actual = actualByKey.get(key);
			expect(actual, `missing persisted row for derived id ${key}`).toBeDefined();
			if (!actual) continue;
			// Independent assertions: tripleId is the canonical derived id,
			// runIndex is the source ordinal, NOT derived from anything else.
			expect(actual.tripleId).toBe(key);
			expect(actual.runIndex).toBe(expected.ordinal);
			expect(actual.decision).toBe("halt");
			expect(actual.haltReason).toBe(HALT_REASON);
			expect(actual.schemaValid).toBe(true);
			expect(actual.reasonText).toBeNull();
			expect(actual.inputTokens).toBeNull();
			expect(actual.outputTokens).toBeNull();
			expect(actual.durationMs).toBeNull();
		}

		// The loader returned DbResult<ImportCounts>; the `imported` count
		// equals the number of inserted run_result rows for this run.
		expect(result.value.imported).toBe(3);
		expect(result.value.failed).toBe(0);
		expect(result.value.skippedDuplicate).toBe(0);
	});

	it("A4 — full-corpus load (no limit) returns 898 imported and 898 run_result rows", async () => {
		// The brief specifies 898 materialized triples (377 jq + 521 cli).
		// Without this assertion a GREEN implementation could silently
		// deduplicate on (triple_key, ordinal) and still report a successful
		// load with `imported = 886` — the symptom the parent's IRC caught.
		// Driving the no-limit path forces the loader to emit 898 distinct
		// rows keyed on the canonical derived id.
		const result = await loadH0MaterializedTriples(dbPath);
		expect(result.ok).toBe(true);
		if (!result.ok) return;

		expect(result.value.imported).toBe(898);
		expect(result.value.failed).toBe(0);
		expect(result.value.skippedDuplicate).toBe(0);

		const store = new RunStore(handle);
		const row = handle.db
			.prepare("SELECT run_id FROM run WHERE arm = ?")
			.get("h0-materialized-loader") as { run_id: string } | undefined;
		expect(row).toBeDefined();
		if (!row) return;
		const listed = store.listResults(row.run_id);
		expect(listed.ok).toBe(true);
		if (!listed.ok) return;
		expect(listed.value).toHaveLength(898);

		// No (triple_id, run_index) duplicates: the PK is (run_id,
		// triple_id, run_index) and a duplicate insert would have surfaced
		// as skippedDuplicate or failed. With limit omitted and the derived
		// id, all 898 should land as fresh rows.
		const pkCount = handle.db
			.prepare(
				"SELECT count(*) AS n FROM run_result WHERE run_id = ?",
			)
			.get(row.run_id) as { n: number };
		expect(pkCount.n).toBe(898);
	});

	it("A2 — writes exactly one run row whose arm and config_json match the brief", async () => {
		const result = await loadH0MaterializedTriples(dbPath, { limit: 3 });
		expect(result.ok).toBe(true);
		if (!result.ok) return;

		const countRow = handle.db
			.prepare("SELECT count(*) AS n FROM run WHERE arm = ?")
			.get("h0-materialized-loader") as { n: number };
		expect(countRow.n).toBe(1);

		const row = handle.db
			.prepare(
				"SELECT arm, model_name, model_sha, config_json FROM run WHERE arm = ?",
			)
			.get("h0-materialized-loader") as {
			arm: string;
			model_name: string | null;
			model_sha: string | null;
			config_json: string;
		};

		expect(row.arm).toBe("h0-materialized-loader");
		expect(row.model_name).toBe("h0-materialized-loader/1");
		expect(row.model_sha).toBe(COMMIT_PIN);

		// config_json is the canonical JSON of the RunConfig.config object.
		const expectedConfig: RunConfig["config"] = {
			source: [
				"evidence/h0/triples-jq-diff3.jsonl",
				"evidence/h0/triples-cli-diff3.jsonl",
			],
			triples: 898,
		};
		expect(JSON.parse(row.config_json)).toEqual(expectedConfig);
	});

	it("A3 — writes exactly one ledger decision entry with the brief's adjudicator identity", async () => {
		const result = await loadH0MaterializedTriples(dbPath, { limit: 3 });
		expect(result.ok).toBe(true);
		if (!result.ok) return;

		const ledger = new LedgerStore(handle);
		const listed = ledger.list();
		expect(listed.ok).toBe(true);
		if (!listed.ok) return;
		const records = listed.value;
		expect(records).toHaveLength(1);

		const record = records[0]!;
		expect(record.recordType).toBe("decision");
		expect(record.adjudicatorKind).toBe("script");
		expect(record.adjudicatorIdentity).toBe(ADJUDICATOR_IDENTITY);
		expect(record.reason).toBe(HALT_REASON);
		expect(record.auditPhase).toBe("h0-materialized-load");
		expect(record.recordSchemaVersion).toBe("mrgr-ledger/1");

		// The ledger payload must record the source glob and import count,
		// not a verdict: the loader persists shape, not adjudication.
		const payload = record.payload as { imported?: number; source?: string };
		expect(payload.imported).toBe(3);
		expect(payload.source).toBe("evidence/h0/triples-*.jsonl");

		// The projected LedgerInput must round-trip with no invented fields.
		const projected: LedgerInput = {
			recordType: record.recordType,
			recordSchemaVersion: record.recordSchemaVersion,
			inputRefs: record.inputRefs,
			intermediateTreeOid: record.intermediateTreeOid,
			outputTreeOid: record.outputTreeOid,
			evidenceDigest: record.evidenceDigest,
			auditPhase: record.auditPhase,
			adjudicatorKind: record.adjudicatorKind,
			adjudicatorIdentity: record.adjudicatorIdentity,
			reason: record.reason,
			payload: record.payload,
			supersedes: record.supersedes,
		};
		expect(projected).toEqual({
			recordType: "decision",
			recordSchemaVersion: "mrgr-ledger/1",
			inputRefs: [],
			intermediateTreeOid: null,
			outputTreeOid: null,
			evidenceDigest: null,
			auditPhase: "h0-materialized-load",
			adjudicatorKind: "script",
			adjudicatorIdentity: ADJUDICATOR_IDENTITY,
			reason: HALT_REASON,
			payload: { imported: 3, source: "evidence/h0/triples-*.jsonl" },
			supersedes: null,
		});
	});
});
