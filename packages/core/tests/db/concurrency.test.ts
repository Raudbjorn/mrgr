import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Worker } from "node:worker_threads";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { closeDb, openDb } from "../../src/db/open.js";

const WORKER = new URL("./helpers/ledger-worker.mjs", import.meta.url);
const PER_WORKER = 25;

let dir: string;
let dbPath: string;
beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "mrgr-db-"));
	dbPath = join(dir, "mrgr.db");
	const opened = openDb(dbPath, { create: true });
	if (!opened.ok) throw new Error(opened.error.message);
	closeDb(opened.value);
});
afterEach(() => {
	rmSync(dir, { recursive: true, force: true });
});

function runWorker(name: string): Promise<{ id: string; seq: number }[]> {
	return new Promise((resolve, reject) => {
		const worker = new Worker(WORKER, {
			workerData: { dbPath, workerName: name, count: PER_WORKER },
		});
		worker.once("message", resolve);
		worker.once("error", reject);
	});
}

describe("concurrent ledger writers (D90 regression)", () => {
	it("two writers, zero id collisions, dense unique seq, all rows survive", async () => {
		const [a, b] = await Promise.all([runWorker("worker-a"), runWorker("worker-b")]);
		expect(a).toHaveLength(PER_WORKER);
		expect(b).toHaveLength(PER_WORKER);

		const opened = openDb(dbPath);
		expect(opened.ok).toBe(true);
		if (!opened.ok) return;
		const rows = opened.value.db
			.prepare("SELECT id, seq FROM ledger ORDER BY seq")
			.all() as { id: string; seq: number }[];
		closeDb(opened.value);

		expect(rows).toHaveLength(PER_WORKER * 2);
		expect(new Set(rows.map((r) => r.id)).size).toBe(PER_WORKER * 2);
		expect(rows.map((r) => r.seq)).toEqual(
			Array.from({ length: PER_WORKER * 2 }, (_, i) => i + 1),
		);
	});
});
