// Concurrency worker for LedgerStore.append itself (not raw SQL — see
// ./ledger-worker.mjs for the schema-level regression test this complements).
//
// A worker_threads Worker loads its script through Node's own module loader,
// which cannot resolve this file's relative ".js" import specifiers back to
// their ".ts" siblings (that mapping is a TypeScript-compiler convention, not
// something Node's native type-stripping loader implements) and additionally
// rejects LedgerStore's constructor parameter property in strip-only mode.
// Both were confirmed by hand before writing this file. Running under `tsx`
// as a child process sidesteps both: tsx does full esbuild-based resolution
// and transformation, not bare type-stripping.
//
// Invoked as: tsx ledger-store-worker.ts <dbPath> <workerName> <count>
// Prints one JSON array of {id, seq} to stdout on success.

import { openDb, closeDb } from "../../../src/db/open.js";
import { LedgerStore } from "../../../src/db/ledger-store.js";

const [, , dbPath, workerName, countArg] = process.argv;
if (!dbPath || !workerName || !countArg) {
	console.error("usage: tsx ledger-store-worker.ts <dbPath> <workerName> <count>");
	process.exit(1);
}
const count = Number.parseInt(countArg, 10);

const opened = openDb(dbPath, { create: true });
if (!opened.ok) {
	console.error(JSON.stringify(opened.error));
	process.exit(1);
}
const handle = opened.value;
const store = new LedgerStore(handle);

const inserted: { id: string; seq: number }[] = [];
for (let i = 0; i < count; i++) {
	// busy_timeout (set by openDb) already makes SQLite wait out lock
	// contention before append() reports failure; this loop is a
	// belt-and-braces retry for the rare case it still reports one,
	// mirroring ledger-worker.mjs's retry policy for the raw-SQL path.
	for (;;) {
		const result = store.append({
			recordType: "decision",
			recordSchemaVersion: "mrgr-ledger/1",
			inputRefs: [],
			intermediateTreeOid: null,
			outputTreeOid: null,
			evidenceDigest: null,
			auditPhase: "concurrency-test",
			adjudicatorKind: "script",
			adjudicatorIdentity: workerName,
			reason: null,
			payload: { worker: workerName, i },
			supersedes: null,
		});
		if (result.ok) {
			inserted.push({ id: result.value.id, seq: result.value.seq });
			break;
		}
		const message = String(result.error.details?.cause ?? result.error.message);
		if (!message.includes("locked") && !message.includes("busy")) {
			console.error(JSON.stringify(result.error));
			process.exit(1);
		}
		// retry
	}
}

closeDb(handle);
process.stdout.write(JSON.stringify(inserted));
