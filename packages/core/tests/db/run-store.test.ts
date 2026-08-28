import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { closeDb, openDb, type DbHandle } from "../../src/db/open.js";
import { RunStore, type RunConfig, type RunResultRecord } from "../../src/db/run-store.js";

let dir: string;
let handle: DbHandle;
let store: RunStore;

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "mrgr-db-"));
	const opened = openDb(join(dir, "mrgr.db"), { create: true });
	if (!opened.ok) throw new Error(opened.error.message);
	handle = opened.value;
	store = new RunStore(handle);
});

afterEach(() => {
	closeDb(handle);
	rmSync(dir, { recursive: true, force: true });
});

const baseConfig: RunConfig = {
	arm: "control",
	modelName: "claude-sonnet-5",
	modelSha: "abc123",
	config: { temperature: 0.2, maxTokens: 4096 },
};

function baseResult(overrides: Partial<RunResultRecord> = {}, runId: string): RunResultRecord {
	return {
		runId,
		tripleId: "triple-1",
		runIndex: 1,
		decision: "keep_ours",
		haltReason: null,
		reasonText: "ours is a superset",
		inputTokens: 100,
		outputTokens: 20,
		durationMs: 1500,
		schemaValid: true,
		...overrides,
	};
}

describe("RunStore.createRun", () => {
	it("is idempotent: same config twice yields the same id and one row", () => {
		const first = store.createRun(baseConfig);
		const second = store.createRun(baseConfig);
		expect(first.ok).toBe(true);
		expect(second.ok).toBe(true);
		if (!first.ok || !second.ok) return;
		expect(second.value).toBe(first.value);

		const n = handle.db.prepare("SELECT count(*) AS n FROM run").get() as { n: number };
		expect(n.n).toBe(1);
	});

	it("produces distinct ids for configs that differ only in arm", () => {
		const a = store.createRun(baseConfig);
		const b = store.createRun({ ...baseConfig, arm: "treatment" });
		expect(a.ok).toBe(true);
		expect(b.ok).toBe(true);
		if (!a.ok || !b.ok) return;
		expect(a.value).not.toBe(b.value);
	});
});

describe("RunStore result round trip", () => {
	it("round-trips a result including schemaValid boolean <-> 0/1", () => {
		const created = store.createRun(baseConfig);
		if (!created.ok) throw new Error(created.error.message);
		const runId = created.value;

		const trueResult = baseResult({ tripleId: "triple-true", schemaValid: true }, runId);
		const falseResult = baseResult({ tripleId: "triple-false", runIndex: 2, schemaValid: false }, runId);

		expect(store.appendResult(trueResult).ok).toBe(true);
		expect(store.appendResult(falseResult).ok).toBe(true);

		// The column itself is 0/1, not a boolean.
		const rawRows = handle.db
			.prepare("SELECT triple_id, schema_valid FROM run_result WHERE run_id = ? ORDER BY triple_id")
			.all(runId) as { triple_id: string; schema_valid: number }[];
		const rawByTriple = new Map(rawRows.map((r) => [r.triple_id, r.schema_valid]));
		expect(rawByTriple.get("triple-true")).toBe(1);
		expect(rawByTriple.get("triple-false")).toBe(0);

		const listed = store.listResults(runId);
		expect(listed.ok).toBe(true);
		if (!listed.ok) return;
		const byTriple = new Map(listed.value.map((r) => [r.tripleId, r]));
		expect(byTriple.get("triple-true")).toEqual(trueResult);
		expect(byTriple.get("triple-false")).toEqual(falseResult);
	});

	it("is idempotent for an identical duplicate but rejects a differing duplicate at the same key", () => {
		const created = store.createRun(baseConfig);
		if (!created.ok) throw new Error(created.error.message);
		const runId = created.value;

		const result = baseResult({}, runId);
		expect(store.appendResult(result).ok).toBe(true);
		// Identical duplicate: idempotent, no error, still one row.
		expect(store.appendResult(result).ok).toBe(true);

		const n = handle.db.prepare("SELECT count(*) AS n FROM run_result").get() as { n: number };
		expect(n.n).toBe(1);

		// Same primary key, different content: must be a "db" error, not a silent overwrite.
		const conflicting = store.appendResult({ ...result, decision: "keep_theirs", haltReason: null });
		expect(conflicting.ok).toBe(false);
		if (!conflicting.ok) expect(conflicting.error.kind).toBe("db");

		const stillOriginal = store.listResults(runId);
		expect(stillOriginal.ok).toBe(true);
		if (stillOriginal.ok) expect(stillOriginal.value).toEqual([result]);
	});
});

describe("RunStore CHECK constraint", () => {
	it("rejects decision: halt with a null haltReason at the SQL layer", () => {
		const created = store.createRun(baseConfig);
		if (!created.ok) throw new Error(created.error.message);
		const runId = created.value;

		const invalid = baseResult({ decision: "halt", haltReason: null }, runId);
		const appended = store.appendResult(invalid);
		expect(appended.ok).toBe(false);
		if (!appended.ok) {
			expect(appended.error.kind).toBe("db");
			// Proves the SQL-layer CHECK fired, not a JS-side guard.
			expect(String(appended.error.details?.cause)).toContain("CHECK constraint failed");
		}

		const n = handle.db.prepare("SELECT count(*) AS n FROM run_result").get() as { n: number };
		expect(n.n).toBe(0);
	});

	it("accepts decision: halt when haltReason is provided", () => {
		const created = store.createRun(baseConfig);
		if (!created.ok) throw new Error(created.error.message);
		const runId = created.value;

		const valid = baseResult({ decision: "halt", haltReason: "ambiguous resolution" }, runId);
		expect(store.appendResult(valid).ok).toBe(true);
	});
});

describe("RunStore.resumeKeys", () => {
	it("contains every appended `${tripleId}|${runIndex}` key", () => {
		const created = store.createRun(baseConfig);
		if (!created.ok) throw new Error(created.error.message);
		const runId = created.value;

		store.appendResult(baseResult({ tripleId: "triple-a", runIndex: 1 }, runId));
		store.appendResult(baseResult({ tripleId: "triple-a", runIndex: 2 }, runId));
		store.appendResult(baseResult({ tripleId: "triple-b", runIndex: 1 }, runId));

		const keys = store.resumeKeys(runId);
		expect(keys.ok).toBe(true);
		if (!keys.ok) return;
		expect(keys.value).toEqual(new Set(["triple-a|1", "triple-a|2", "triple-b|1"]));
	});

	it("is scoped per run and empty for a run with no results", () => {
		const created = store.createRun(baseConfig);
		if (!created.ok) throw new Error(created.error.message);
		const runId = created.value;

		const keys = store.resumeKeys(runId);
		expect(keys.ok).toBe(true);
		if (keys.ok) expect(keys.value.size).toBe(0);
	});
});
