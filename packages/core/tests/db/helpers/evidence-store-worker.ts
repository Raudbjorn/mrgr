// Concurrency worker for EvidenceStore.append: proves the dependency_graph
// invariant (fix round 2) survives two concurrent connections racing to
// append DIFFERENT regions of the SAME file, each carrying a DIFFERENT
// dependency_graph. Correctness here does not depend on which process wins
// the race -- BEGIN IMMEDIATE serializes the two connections on the write
// lock (bounded by openDb's busy_timeout), so whichever commits first
// establishes the file's authoritative graph and the other, once it acquires
// the lock and re-reads from inside its own transaction, sees that prior ok
// region and is rejected with reason "dependency-graph-conflict". Exactly one
// success and one rejection is the only possible outcome; only WHICH region
// wins is nondeterministic.
//
// Runs under `tsx` as a child process for the same reason as
// ledger-store-worker.ts: worker_threads cannot resolve this file's ".js"
// import specifiers back to their ".ts" siblings, and rejects EvidenceStore's
// constructor parameter property in strip-only mode.
//
// The vulnerable window this test targets (three SELECTs before append()'s
// transaction opens, pre-fix) is on the order of microseconds; `pnpm exec
// tsx` process-spawn jitter is two to three orders of magnitude larger, so
// two independently-launched workers essentially never land their reads in
// that window together — confirmed empirically: replaying this test against
// the pre-fix code without a barrier passed 8/8 times, proving nothing. A
// shared start-at deadline (barrierAtEpochMs), busy-waited after both
// processes have paid their startup cost, removes that spawn-timing
// variance from the measurement and lands both workers' append() calls
// within microseconds of each other and of the deadline.
//
// Invoked as: tsx evidence-store-worker.ts <dbPath> <ordinal> <depGraphJson> <barrierAtEpochMs>
// Prints one JSON object {ok: true} or {ok: false, error} to stdout.

import { openDb, closeDb } from "../../../src/db/open.js";
import { EvidenceStore } from "../../../src/db/evidence-store.js";

const [, , dbPath, ordinalArg, depGraphJson, barrierArg] = process.argv;
if (!dbPath || !ordinalArg || !depGraphJson || !barrierArg) {
	console.error(
		"usage: tsx evidence-store-worker.ts <dbPath> <ordinal> <depGraphJson> <barrierAtEpochMs>",
	);
	process.exit(1);
}
const ordinal = Number.parseInt(ordinalArg, 10);
const dependencyGraph = JSON.parse(depGraphJson) as string[];
const barrierAtEpochMs = Number.parseInt(barrierArg, 10);

const opened = openDb(dbPath, { create: true });
if (!opened.ok) {
	console.error(JSON.stringify(opened.error));
	process.exit(1);
}
const handle = opened.value;
const store = new EvidenceStore(handle);

// Busy-wait (not setTimeout/sleep) to the shared deadline: this all happens
// synchronously right before the synchronous append() call, and a timer-based
// wait would hand control back to the event loop with its own scheduling
// slop, reintroducing the jitter this barrier exists to remove.
while (Date.now() < barrierAtEpochMs) {
	/* spin */
}

const result = store.append({
	schemaVersion: 1,
	repository_id: "local:/tmp/repo",
	merge_sha: "a".repeat(40),
	baseline_id: "e".repeat(64),
	conflict_path: "src/a.ts",
	conflict_ordinal: ordinal,
	status: "ok",
	bundle: {
		conflict_path: "src/a.ts",
		conflict_ordinal: ordinal,
		conflict_hunk_ours: `ours-hunk-${ordinal}\n`,
		conflict_hunk_base: `base-hunk-${ordinal}\n`,
		conflict_hunk_theirs: `theirs-hunk-${ordinal}\n`,
		preimage_ours: null,
		preimage_theirs: null,
		preimage_ours_bytes: null,
		preimage_theirs_bytes: null,
			preimage_ours_oid: null,
			preimage_theirs_oid: null,
		preimage_ours_truncated: false,
		preimage_theirs_truncated: false,
		dependency_graph: dependencyGraph,
		dependency_graph_status: "derived",
	},
});

closeDb(handle);
process.stdout.write(
	JSON.stringify(result.ok ? { ok: true } : { ok: false, error: result.error }),
);
