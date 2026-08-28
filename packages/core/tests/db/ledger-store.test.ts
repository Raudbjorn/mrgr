import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { LedgerStore, type LedgerInput } from "../../src/db/ledger-store.js";
import { closeDb, openDb, type DbHandle } from "../../src/db/open.js";

let dir: string;
let handle: DbHandle;
beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "mrgr-db-"));
	const opened = openDb(join(dir, "mrgr.db"), { create: true });
	if (!opened.ok) throw new Error(opened.error.message);
	handle = opened.value;
});
afterEach(() => {
	closeDb(handle);
	rmSync(dir, { recursive: true, force: true });
});

function decisionInput(n = 1): LedgerInput {
	return {
		recordType: "decision",
		recordSchemaVersion: "mrgr-ledger/1",
		inputRefs: ["a".repeat(40), "b".repeat(40)],
		intermediateTreeOid: "c".repeat(40),
		outputTreeOid: "d".repeat(40),
		evidenceDigest: "e".repeat(64),
		auditPhase: "post-adjudication",
		adjudicatorKind: "human",
		adjudicatorIdentity: "svnbjrn",
		reason: null,
		payload: { region: "src/a.ts", ordinal: n, choice: "compose" },
		supersedes: null,
	};
}

describe("LedgerStore", () => {
	it("appends with content-derived id and dense seq", () => {
		const store = new LedgerStore(handle);
		const first = store.append(decisionInput(1));
		const second = store.append(decisionInput(2));
		expect(first.ok && second.ok).toBe(true);
		if (!first.ok || !second.ok) return;
		expect(first.value.id).toMatch(/^[0-9a-f]{64}$/);
		expect(first.value.seq).toBe(1);
		expect(second.value.seq).toBe(2);
		expect(first.value.id).not.toBe(second.value.id);
	});

	it("re-appending the same logical record is idempotent: one row, same id", () => {
		const store = new LedgerStore(handle);
		const a = store.append(decisionInput(1));
		const b = store.append(decisionInput(1));
		expect(a.ok && b.ok).toBe(true);
		if (a.ok && b.ok) expect(b.value.id).toBe(a.value.id);
		const n = handle.db.prepare("SELECT count(*) AS n FROM ledger").get() as { n: number };
		expect(n.n).toBe(1);
	});

	it("UPDATE and DELETE are refused by the store's triggers", () => {
		const store = new LedgerStore(handle);
		const appended = store.append(decisionInput(1));
		if (!appended.ok) throw new Error("append failed");
		expect(() =>
			handle.db.prepare("UPDATE ledger SET reason = 'edited' WHERE id = ?").run(appended.value.id),
		).toThrow(/append-only/);
		expect(() =>
			handle.db.prepare("DELETE FROM ledger WHERE id = ?").run(appended.value.id),
		).toThrow(/append-only/);
	});

	it("a halt without a reason is refused at the SQL layer", () => {
		const store = new LedgerStore(handle);
		const halt = store.append({ ...decisionInput(1), recordType: "halt", reason: null });
		expect(halt.ok).toBe(false);
	});

	it("corrections append with supersedes, never edit", () => {
		const store = new LedgerStore(handle);
		const original = store.append(decisionInput(1));
		if (!original.ok) throw new Error("append failed");
		const correction = store.append({
			...decisionInput(1),
			payload: { region: "src/a.ts", ordinal: 1, choice: "keep_ours" },
			supersedes: original.value.id,
		});
		expect(correction.ok).toBe(true);
		const listed = store.list();
		if (listed.ok) expect(listed.value).toHaveLength(2);
	});

	it("rejects a non-canonical createdAt and writes nothing", () => {
		const store = new LedgerStore(handle);
		const result = store.append(decisionInput(1), "not-a-date");
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.kind).toBe("db");
			expect(result.error.details).toMatchObject({ createdAt: "not-a-date" });
		}
		const n = handle.db.prepare("SELECT count(*) AS n FROM ledger").get() as { n: number };
		expect(n.n).toBe(0);
	});

	it("rejects a parseable but non-round-tripping createdAt (missing milliseconds)", () => {
		const store = new LedgerStore(handle);
		const result = store.append(decisionInput(1), "2024-01-01T00:00:00Z");
		expect(result.ok).toBe(false);
		const n = handle.db.prepare("SELECT count(*) AS n FROM ledger").get() as { n: number };
		expect(n.n).toBe(0);
	});

	it("accepts a valid injected createdAt for deterministic exports", () => {
		const store = new LedgerStore(handle);
		const injected = "2024-01-01T00:00:00.000Z";
		const result = store.append(decisionInput(1), injected);
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.value.createdAt).toBe(injected);
	});

	it("defaults createdAt to now when omitted", () => {
		const store = new LedgerStore(handle);
		const before = Date.now();
		const result = store.append(decisionInput(1));
		const after = Date.now();
		expect(result.ok).toBe(true);
		if (result.ok) {
			const createdAtMs = new Date(result.value.createdAt).getTime();
			expect(createdAtMs).toBeGreaterThanOrEqual(before);
			expect(createdAtMs).toBeLessThanOrEqual(after);
		}
	});
});
