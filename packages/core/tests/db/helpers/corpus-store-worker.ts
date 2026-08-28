// Concurrency worker for CorpusStore.append itself: two instances of this
// process each append the SAME sequence of `count` records (identical
// content per index, generated deterministically from the index alone so
// both processes produce byte-identical records without communicating) to
// the SAME database concurrently, to prove the append() TOCTOU fix.
//
// A single shared key, attempted once per process with no synchronization,
// is not a reliable trigger: process-startup jitter (confirmed empirically
// to run tens to hundreds of milliseconds) swamps the microsecond-scale
// critical window the bug lived in, so a lone unsynchronized attempt passes
// by luck even against the pre-fix code, and even looping many
// independently-keyed records with no synchronization only catches the race
// intermittently (confirmed empirically: roughly 1 run in 3). To make every
// iteration a genuine simultaneous attempt rather than a hopeful one, the two
// processes rendezvous through a tiny file-based barrier before each index:
// each writes its own marker for index i, then busy-polls for the other
// side's marker, so both call CorpusStore.append with the same record at
// close to the same instant on every iteration.
//
// Correctness does not depend on which process wins any individual race --
// BEGIN IMMEDIATE serializes the two connections on the write lock (bounded
// by openDb's busy_timeout), so exactly one of them performs each insert and
// the other observes it from inside its own transaction and takes the
// idempotent path. Every call from both processes must report ok:true, and
// the database must end up with exactly `count` rows, never 2 * count.
//
// Runs under `tsx` as a child process for the same reason as
// ledger-store-worker.ts: worker_threads cannot resolve this file's ".js"
// import specifiers back to their ".ts" siblings, and rejects CorpusStore's
// constructor parameter property in strip-only mode.
//
// Invoked as: tsx corpus-store-worker.ts <dbPath> <side: a|b> <count>
// Prints one JSON array of {ok: true} | {ok: false, error} to stdout, one
// per index in 0..count-1.

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { openDb, closeDb } from "../../../src/db/open.js";
import { CorpusStore } from "../../../src/db/corpus-store.js";
import type { CorpusRecordV2 } from "../../../src/evaluation/types.js";

const [, , dbPath, side, countArg] = process.argv;
if (!dbPath || (side !== "a" && side !== "b") || !countArg) {
	console.error("usage: tsx corpus-store-worker.ts <dbPath> <side: a|b> <count>");
	process.exit(1);
}
const otherSide = side === "a" ? "b" : "a";
const count = Number.parseInt(countArg, 10);

const barrierDir = `${dbPath}.race-barrier`;
mkdirSync(barrierDir, { recursive: true });

/**
 * Signals readiness for index i, then busy-polls (synchronously -- this
 * process has nothing else to do) until the other side has signaled
 * readiness for the same index. Bounded so a crashed or missing peer cannot
 * hang the test forever; a timeout here just means this iteration runs
 * unsynchronized rather than blocking indefinitely, which is still safe
 * (just less likely to race) rather than incorrect.
 */
function barrier(i: number): void {
	writeFileSync(join(barrierDir, `${i}.${side}`), "");
	const deadline = Date.now() + 5000;
	while (!existsSync(join(barrierDir, `${i}.${otherSide}`)) && Date.now() < deadline) {
		/* busy-poll */
	}
}

// Not exported: this file's top level parses process.argv and opens a real
// database as soon as it's loaded, so importing it (rather than running it
// as a CLI via tsx) would crash under vitest. The test file duplicates this
// tiny generator rather than importing it.
function recordForIndex(i: number): CorpusRecordV2 {
	const hex = i.toString(16).padStart(4, "0");
	const sha40 = hex.repeat(10).slice(0, 40);
	const digest64 = hex.repeat(16).slice(0, 64);
	return {
		schemaVersion: 2,
		repository: {
			kind: "local",
			id: "local:/tmp/concurrent-repo",
			absolutePath: "/tmp/concurrent-repo",
		},
		merge: {
			repositoryId: "local:/tmp/concurrent-repo",
			sha: sha40,
			parents: ["1".repeat(40), "2".repeat(40)],
			authorDate: "2026-01-01T00:00:00Z",
			subject: `concurrent test merge ${i}`,
		},
		baselineId: digest64,
		replayProvenance: {
			gitVersion: "2.55.0",
			algorithm: "merge-tree-write-tree",
			strategy: "ort",
			environmentPolicy: "isolated-v1",
			normalizationVersion: "v1",
			parentAttributes: { ours: null, theirs: null },
			repoMergeConfigHash: null,
		},
		mergeBases: [],
		baseTopology: "none",
		baseReachabilityCounts: [],
		changedPathIntersection: null,
		replayStatus: "clean",
		automaticTreeOid: "3".repeat(40),
		conflictPaths: [],
		conflictRegions: [],
	};
}

const opened = openDb(dbPath, { create: true });
if (!opened.ok) {
	console.error(JSON.stringify(opened.error));
	process.exit(1);
}
const handle = opened.value;
const store = new CorpusStore(handle);

const results: ({ ok: true } | { ok: false; error: unknown })[] = [];
for (let i = 0; i < count; i++) {
	barrier(i);
	const record = recordForIndex(i);
	// busy_timeout (set by openDb) already makes SQLite wait out lock
	// contention before append() reports failure; this loop is a
	// belt-and-braces retry for the rare case it still reports one,
	// mirroring ledger-store-worker.ts's retry policy.
	let result = store.append(record);
	for (;;) {
		if (result.ok) break;
		const message = String(result.error.details?.cause ?? result.error.message);
		if (!message.includes("locked") && !message.includes("busy")) break;
		result = store.append(record);
	}
	results.push(result.ok ? { ok: true } : { ok: false, error: result.error });
}

closeDb(handle);
process.stdout.write(JSON.stringify(results));
