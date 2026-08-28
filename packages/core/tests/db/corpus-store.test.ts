import { execFile } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { CorpusStore } from "../../src/db/corpus-store.js";
import { closeDb, openDb, type DbHandle } from "../../src/db/open.js";
import { resumeKey } from "../../src/evaluation/corpus.js";
import type { CorpusRecordV2 } from "../../src/evaluation/types.js";

// Package root: this file is two levels below it. Spawned as an explicit cwd
// so the concurrency test does not depend on the caller's working directory.
const PACKAGE_ROOT = fileURLToPath(new URL("../..", import.meta.url));
const CORPUS_STORE_WORKER = fileURLToPath(
	new URL("./helpers/corpus-store-worker.ts", import.meta.url),
);

const OID_A = "a".repeat(40);
const OID_B = "b".repeat(40);
const OID_C = "c".repeat(40);
const OID_D = "d".repeat(40);
const DIGEST = "e".repeat(64);

function conflictedRecord(): CorpusRecordV2 {
	return {
		schemaVersion: 2,
		repository: { kind: "local", id: "local:/tmp/repo", absolutePath: "/tmp/repo" },
		merge: {
			repositoryId: "local:/tmp/repo",
			sha: OID_A,
			parents: [OID_B, OID_C],
			authorDate: "2026-01-01T00:00:00Z",
			subject: "merge it",
		},
		baselineId: DIGEST,
		replayProvenance: {
			gitVersion: "2.55.0",
			algorithm: "merge-tree-write-tree",
			strategy: "ort",
			environmentPolicy: "isolated-v1",
			normalizationVersion: "v1",
			parentAttributes: { ours: null, theirs: null },
			repoMergeConfigHash: null,
		},
		mergeBases: [OID_D],
		baseTopology: "single",
		baseReachabilityCounts: [
			{ baseSha: OID_D, oursExclusiveCommits: 3, theirsExclusiveCommits: 5 },
		],
		changedPathIntersection: ["src/a.ts", "src/b.ts"],
		replayStatus: "conflicted",
		automaticTreeOid: OID_A,
		conflictPaths: ["src/a.ts"],
		conflictRegions: [
			{
				path: "src/a.ts",
				ordinal: 1,
				category: "other",
				conflictKind: "content",
				stageOids: { base: OID_B, ours: OID_C, theirs: OID_D },
				localizationStatus: "exact",
				automaticRanges: {
					base: { startLine: 1, endLineExclusive: 3 },
					ours: { startLine: 1, endLineExclusive: 4 },
					theirs: { startLine: 1, endLineExclusive: 5 },
				},
				resolutionRange: { startLine: 1, endLineExclusive: 4 },
				rawDigests: { base: DIGEST, ours: DIGEST, theirs: DIGEST, resolution: DIGEST },
				normalizedDigests: { base: DIGEST, ours: DIGEST, theirs: DIGEST, resolution: DIGEST },
				rawCounts: {
					base: { lines: 2, bytes: 10 },
					ours: { lines: 3, bytes: 15 },
					theirs: { lines: 4, bytes: 20 },
					resolution: { lines: 3, bytes: 15 },
				},
				resolutionClass: "ours",
				novelAfterNormalization: false,
				tripleKey: DIGEST,
			},
			{
				path: "src/a.ts",
				ordinal: 2,
				category: "other",
				conflictKind: "content",
				stageOids: { base: null, ours: OID_C, theirs: OID_D },
				localizationStatus: "ambiguous",
				automaticRanges: { base: null, ours: null, theirs: null },
				resolutionRange: null,
				rawDigests: { base: null, ours: null, theirs: null, resolution: null },
				normalizedDigests: { base: null, ours: null, theirs: null, resolution: null },
				rawCounts: { base: null, ours: null, theirs: null, resolution: null },
				resolutionClass: "ambiguous",
				novelAfterNormalization: null,
				tripleKey: null,
			},
		],
	};
}

let dir: string;
let handle: DbHandle;
let store: CorpusStore;
beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "mrgr-db-"));
	const opened = openDb(join(dir, "mrgr.db"), { create: true });
	if (!opened.ok) throw new Error(opened.error.message);
	handle = opened.value;
	store = new CorpusStore(handle);
});
afterEach(() => {
	closeDb(handle);
	rmSync(dir, { recursive: true, force: true });
});

describe("CorpusStore", () => {
	it("round-trips a conflicted record exactly", () => {
		const record = conflictedRecord();
		expect(store.append(record).ok).toBe(true);
		const got = store.get(record.repository.id, record.merge.sha, record.baselineId);
		expect(got.ok).toBe(true);
		if (got.ok) expect(got.value).toEqual(record);
	});

	it("is idempotent for an identical duplicate, errors on a different one", () => {
		const record = conflictedRecord();
		store.append(record);
		expect(store.append(record).ok).toBe(true);
		const different = { ...conflictedRecord(), automaticTreeOid: OID_B };
		const second = store.append(different);
		expect(second.ok).toBe(false);
		if (!second.ok) expect(second.error.kind).toBe("db");
	});

	it("resumeKeys matches the carried resumeKey format", () => {
		const record = conflictedRecord();
		store.append(record);
		const keys = store.resumeKeys();
		expect(keys.ok).toBe(true);
		if (keys.ok) expect(keys.value.has(resumeKey(record))).toBe(true);
	});

	it("the store rejects an exact region missing its digests even when app validation is bypassed", () => {
		const record = conflictedRecord();
		store.append(record);
		expect(() =>
			handle.db
				.prepare(
					`INSERT INTO conflict_region
					 (repository_id, merge_sha, baseline_id, path, ordinal, category,
					  conflict_kind, localization_status, resolution_class, array_index)
					 VALUES (?, ?, ?, ?, 9, 'other', 'content', 'exact', 'ours', 0)`,
				)
				.run(record.repository.id, record.merge.sha, record.baselineId, "src/a.ts"),
		).toThrow(/CHECK/i);
	});

	it("get returns null for an absent record", () => {
		const got = store.get("nope", OID_A, DIGEST);
		expect(got.ok).toBe(true);
		if (got.ok) expect(got.value).toBeNull();
	});

	it("preserves conflictPaths and conflictRegions array order when not lexicographic", () => {
		const base = conflictedRecord();
		const record: CorpusRecordV2 = {
			...base,
			conflictPaths: ["z/last.ts", "a/first.ts", "m/mid.ts"],
			conflictRegions: [
				{ ...base.conflictRegions[1]!, path: "m/mid.ts" },
				{ ...base.conflictRegions[0]!, path: "z/last.ts" },
				{ ...base.conflictRegions[0]!, path: "a/first.ts" },
			],
		};
		expect(store.append(record).ok).toBe(true);
		const got = store.get(record.repository.id, record.merge.sha, record.baselineId);
		expect(got.ok).toBe(true);
		if (got.ok) expect(got.value).toEqual(record);
	});

	it("two records sharing a baselineId succeed despite differing parentAttributes", () => {
		// parentAttributes is per-record provenance (the ours/theirs attribute
		// OIDs differ on essentially every merge), not part of baselineInput's
		// hash. A shared baselineId with differing parentAttributes must not
		// be treated as conflicting baseline content.
		const base = conflictedRecord();
		const first: CorpusRecordV2 = { ...base, merge: { ...base.merge, sha: "1".repeat(40) } };
		const second: CorpusRecordV2 = {
			...base,
			merge: { ...base.merge, sha: "2".repeat(40) },
			replayProvenance: {
				...base.replayProvenance,
				parentAttributes: { ours: OID_B, theirs: OID_C },
			},
		};
		expect(store.append(first).ok).toBe(true);
		expect(store.append(second).ok).toBe(true);

		const gotFirst = store.get(first.repository.id, first.merge.sha, first.baselineId);
		expect(gotFirst.ok).toBe(true);
		if (gotFirst.ok) expect(gotFirst.value).toEqual(first);

		const gotSecond = store.get(second.repository.id, second.merge.sha, second.baselineId);
		expect(gotSecond.ok).toBe(true);
		if (gotSecond.ok) expect(gotSecond.value).toEqual(second);
	});

	it("two records sharing a baselineId succeed despite differing repoMergeConfigHash", () => {
		// repoMergeConfigHash is per-repository configuration, not part of
		// baselineInput's hash, so it must not gate baseline content equality
		// either.
		const base = conflictedRecord();
		const first: CorpusRecordV2 = { ...base, merge: { ...base.merge, sha: "3".repeat(40) } };
		const second: CorpusRecordV2 = {
			...base,
			merge: { ...base.merge, sha: "4".repeat(40) },
			replayProvenance: {
				...base.replayProvenance,
				repoMergeConfigHash: "deadbeef",
			},
		};
		expect(store.append(first).ok).toBe(true);
		expect(store.append(second).ok).toBe(true);

		const gotFirst = store.get(first.repository.id, first.merge.sha, first.baselineId);
		expect(gotFirst.ok).toBe(true);
		if (gotFirst.ok) expect(gotFirst.value).toEqual(first);

		const gotSecond = store.get(second.repository.id, second.merge.sha, second.baselineId);
		expect(gotSecond.ok).toBe(true);
		if (gotSecond.ok) expect(gotSecond.value).toEqual(second);
	});

	it("rejects a repository row that violates the remote/local column pairing instead of silently dropping it", () => {
		// Bypasses RepositoryRef's discriminated union on purpose: this proves
		// the SQL layer's CHECK constraint rejects a malformed row rather than
		// the type system preventing one from being constructed. Fields are
		// explicit null (not merely absent) so the store binds real SQL NULLs
		// instead of failing earlier on an undefined bind parameter.
		const record: CorpusRecordV2 = {
			...conflictedRecord(),
			repository: {
				kind: "remote",
				id: "remote:bad",
				host: null,
				slug: null,
				cacheKey: null,
			} as unknown as CorpusRecordV2["repository"],
		};
		const result = store.append(record);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.kind).toBe("db");
			expect(JSON.stringify(result.error.details)).toMatch(/CHECK constraint failed/i);
		}
	});
});

const CONCURRENCY_COUNT = 50;

function runCorpusStoreWorker(
	dbPath: string,
	side: "a" | "b",
	count: number,
): Promise<({ ok: true } | { ok: false; error: unknown })[]> {
	return new Promise((resolve, reject) => {
		execFile(
			"pnpm",
			["exec", "tsx", CORPUS_STORE_WORKER, dbPath, side, String(count)],
			{ cwd: PACKAGE_ROOT },
			(error, stdout, stderr) => {
				if (error) {
					reject(new Error(`${error.message}\nstderr: ${stderr}`));
					return;
				}
				try {
					resolve(JSON.parse(stdout) as ({ ok: true } | { ok: false; error: unknown })[]);
				} catch (cause) {
					reject(
						new Error(
							`worker did not print valid JSON: ${String(cause)}\nstdout: ${stdout}\nstderr: ${stderr}`,
						),
					);
				}
			},
		);
	});
}

// Regression for the append() TOCTOU race: the existence check and
// idempotency comparison used to run before BEGIN IMMEDIATE, so two
// concurrent connections could both read "no existing record" and race to
// insert.
//
// A single shared key with no synchronization is not a reliable trigger:
// process-startup jitter (confirmed empirically to run tens to hundreds of
// milliseconds) swamps the microsecond-scale window the bug lived in, so an
// unsynchronized attempt passes by luck even against the pre-fix code --
// confirmed empirically, including with CONCURRENCY_COUNT independently-keyed
// records looped with no synchronization (roughly 1 failing run in 3).
// corpus-store-worker.ts closes that gap with a tiny file-based barrier: both
// processes rendezvous before each index, so every one of the
// CONCURRENCY_COUNT iterations is a genuine simultaneous attempt rather than
// a hopeful one.
//
// What IS deterministic, and what this test actually asserts, is the outcome
// once a race occurs: BEGIN IMMEDIATE serializes the two connections on the
// write lock (bounded by openDb's busy_timeout, far longer than one insert
// takes), so whichever process's transaction runs first, the result for that
// key is always exactly one row and two ok:true calls -- one process taking
// the insert path, the other reading the identical row back from inside its
// own transaction and taking the idempotent path. Which process wins any
// given index is not controlled and is not asserted; only "no error, and
// never a duplicate row" is.
//
// Verified against the pre-fix code (scratch-reverted, not committed): the
// unsynchronized loop above failed intermittently; this barrier-synchronized
// version failed on every run attempted (5/5) with a real UNIQUE-constraint
// error surfacing from one of the two processes' corpus_record insert. Against
// the fix, both also ran 5/5 clean.
describe("CorpusStore.append concurrency (TOCTOU regression)", () => {
	it(
		"two barrier-synchronized processes racing the same sequence of keys produce no errors and no duplicate rows",
		async () => {
			const [a, b] = await Promise.all([
				runCorpusStoreWorker(handle.path, "a", CONCURRENCY_COUNT),
				runCorpusStoreWorker(handle.path, "b", CONCURRENCY_COUNT),
			]);
			expect(a).toHaveLength(CONCURRENCY_COUNT);
			expect(b).toHaveLength(CONCURRENCY_COUNT);
			for (const result of [...a, ...b]) {
				expect(result.ok).toBe(true);
			}

			const row = handle.db
				.prepare(
					`SELECT COUNT(*) AS n FROM corpus_record WHERE repository_id = ?`,
				)
				.get("local:/tmp/concurrent-repo") as { n: number };
			expect(row.n).toBe(CONCURRENCY_COUNT);
		},
		30_000,
	);
});
