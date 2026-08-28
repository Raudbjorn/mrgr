import { execFile } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { Worker } from "node:worker_threads";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { closeDb, openDb } from "../../src/db/open.js";

const WORKER = new URL("./helpers/ledger-worker.mjs", import.meta.url);
const PER_WORKER = 25;

// Package root: `tests/db/` is two levels below it. Spawned as an explicit
// cwd so this test does not depend on the caller's working directory.
const PACKAGE_ROOT = fileURLToPath(new URL("../..", import.meta.url));
const LEDGER_STORE_WORKER = fileURLToPath(
	new URL("./helpers/ledger-store-worker.ts", import.meta.url),
);
const LEDGER_STORE_PER_WORKER = 20;

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

// Drives LedgerStore.append itself, not raw SQL — see ledger-store-worker.ts
// for why this runs `tsx` as a child process rather than a worker_thread.
function runLedgerStoreWorker(name: string): Promise<{ id: string; seq: number }[]> {
	return new Promise((resolve, reject) => {
		execFile(
			"pnpm",
			["exec", "tsx", LEDGER_STORE_WORKER, dbPath, name, String(LEDGER_STORE_PER_WORKER)],
			{ cwd: PACKAGE_ROOT },
			(error, stdout, stderr) => {
				if (error) {
					reject(new Error(`${error.message}\nstderr: ${stderr}`));
					return;
				}
				try {
					resolve(JSON.parse(stdout) as { id: string; seq: number }[]);
				} catch (cause) {
					reject(new Error(`worker did not print valid JSON: ${String(cause)}\nstdout: ${stdout}\nstderr: ${stderr}`));
				}
			},
		);
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

// Closes the gap the D90 regression test above leaves open: that test's
// worker (ledger-worker.mjs) is hand-rolled raw SQL against DatabaseSync — it
// never calls LedgerStore.append, so it proves the schema-and-pragma pattern
// is concurrency-safe but not that the API every real caller uses is. This
// exercises LedgerStore.append itself from two concurrent processes.
describe("concurrent LedgerStore.append (API-level regression)", () => {
	it(
		"two concurrent LedgerStore.append callers, zero id collisions, dense unique seq, all rows survive",
		async () => {
			const [a, b] = await Promise.all([
				runLedgerStoreWorker("ledger-store-worker-a"),
				runLedgerStoreWorker("ledger-store-worker-b"),
			]);
			expect(a).toHaveLength(LEDGER_STORE_PER_WORKER);
			expect(b).toHaveLength(LEDGER_STORE_PER_WORKER);

			const opened = openDb(dbPath);
			expect(opened.ok).toBe(true);
			if (!opened.ok) return;
			const rows = opened.value.db
				.prepare("SELECT id, seq FROM ledger ORDER BY seq")
				.all() as { id: string; seq: number }[];
			closeDb(opened.value);

			expect(rows).toHaveLength(LEDGER_STORE_PER_WORKER * 2);
			expect(new Set(rows.map((r) => r.id)).size).toBe(LEDGER_STORE_PER_WORKER * 2);
			expect(rows.map((r) => r.seq)).toEqual(
				Array.from({ length: LEDGER_STORE_PER_WORKER * 2 }, (_, i) => i + 1),
			);
		},
		20_000,
	);
});
