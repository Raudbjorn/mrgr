import { execFile } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { CorpusStore } from "../../src/db/corpus-store.js";
import { EvidenceStore } from "../../src/db/evidence-store.js";
import { closeDb, openDb, type DbHandle } from "../../src/db/open.js";
import { PATH_LEVEL_ORDINAL, evidenceKey, type EvidenceRecord } from "../../src/m1a/sidecar.js";
import type { CorpusRecordV2 } from "../../src/evaluation/types.js";

// Package root: `tests/db/` is two levels below it. Spawned as an explicit
// cwd so the concurrency worker does not depend on the caller's cwd — mirrors
// tests/db/concurrency.test.ts.
const PACKAGE_ROOT = fileURLToPath(new URL("../..", import.meta.url));
const EVIDENCE_STORE_WORKER = fileURLToPath(
	new URL("./helpers/evidence-store-worker.ts", import.meta.url),
);

type WorkerAppendResult =
	| { ok: true }
	| { ok: false; error: { kind: string; details?: Record<string, unknown> } };

function runEvidenceStoreWorker(
	ordinal: number,
	dependencyGraph: string[],
	barrierAtEpochMs: number,
): Promise<WorkerAppendResult> {
	return new Promise((resolve, reject) => {
		execFile(
			"pnpm",
			[
				"exec",
				"tsx",
				EVIDENCE_STORE_WORKER,
				join(dir, "mrgr.db"),
				String(ordinal),
				JSON.stringify(dependencyGraph),
				String(barrierAtEpochMs),
			],
			{ cwd: PACKAGE_ROOT },
			(error, stdout, stderr) => {
				if (error) {
					reject(new Error(`${error.message}\nstderr: ${stderr}`));
					return;
				}
				try {
					resolve(JSON.parse(stdout) as WorkerAppendResult);
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

const OID_A = "a".repeat(40);
const OID_B = "b".repeat(40);
const OID_C = "c".repeat(40);
const OID_D = "d".repeat(40);
const DIGEST = "e".repeat(64);

// Copied from tests/db/corpus-store.test.ts: EvidenceStore's foreign keys
// need a conflict_path (and, for "ok" records, a conflict_region) row to
// point at, and CorpusStore.append is the only way to create those.
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

type OkEvidenceRecord = Extract<EvidenceRecord, { status: "ok" }>;

function okRecord(): OkEvidenceRecord {
	return {
		schemaVersion: 1,
		repository_id: "local:/tmp/repo",
		merge_sha: OID_A,
		baseline_id: DIGEST,
		conflict_path: "src/a.ts",
		conflict_ordinal: 1,
		status: "ok",
		bundle: {
			conflict_path: "src/a.ts",
			conflict_ordinal: 1,
			conflict_hunk_ours: "ours-hunk\n",
			conflict_hunk_base: "base-hunk\n",
			conflict_hunk_theirs: "theirs-hunk\n",
			preimage_ours: "héllo wörld\n",
			preimage_theirs: null,
			preimage_ours_bytes: Buffer.byteLength("héllo wörld\n", "utf8"),
			preimage_theirs_bytes: null,
			preimage_ours_oid: OID_B,
			preimage_theirs_oid: null,
			preimage_ours_truncated: false,
			preimage_theirs_truncated: false,
			dependency_graph: ["ours:src/a.ts", "theirs:src/b.ts"],
			dependency_graph_status: "derived",
		},
	};
}

function okRecordOrdinal2(): OkEvidenceRecord {
	return {
		...okRecord(),
		conflict_ordinal: 2,
		bundle: {
			...okRecord().bundle,
			conflict_ordinal: 2,
			// Distinct hunks from ordinal 1's bundle; only the preimage is shared,
			// so a shrinking blob count isolates the preimage dedup specifically.
			conflict_hunk_ours: "ours-hunk-2\n",
			conflict_hunk_base: "base-hunk-2\n",
			conflict_hunk_theirs: "theirs-hunk-2\n",
			preimage_ours: "héllo wörld\n", // same bytes as ordinal 1's preimage -> dedup
		},
	};
}

/** Same as okRecord()/okRecordOrdinal2() but with a legitimately empty dependency_graph. */
function okRecordEmptyGraph(ordinal: 1 | 2): OkEvidenceRecord {
	const base = ordinal === 1 ? okRecord() : okRecordOrdinal2();
	return {
		...base,
		bundle: { ...base.bundle, dependency_graph: [] },
	};
}

/**
 * Deliberately unsorted, with a duplicate entry ("ours:a.txt" appears twice).
 * DependencyGraphSchema is a plain array with no ordering or uniqueness
 * constraint, so a fixture in sorted, duplicate-free order (as every other
 * fixture in this file happens to be) cannot catch a store that silently
 * sorts and/or dedups on storage (fix round 4).
 */
function unsortedDuplicateGraphRecord(): OkEvidenceRecord {
	const base = okRecord();
	return {
		...base,
		bundle: {
			...base.bundle,
			dependency_graph: ["theirs:z.txt", "ours:b.txt", "ours:a.txt", "ours:a.txt"],
		},
	};
}

function failedPathLevelRecord(): EvidenceRecord {
	return {
		schemaVersion: 1,
		repository_id: "local:/tmp/repo",
		merge_sha: OID_A,
		baseline_id: DIGEST,
		conflict_path: "src/a.ts",
		conflict_ordinal: PATH_LEVEL_ORDINAL,
		status: "failed",
		error: { kind: "git", operation: "extract", message: "boom" },
	};
}

let dir: string;
let handle: DbHandle;
let evidenceStore: EvidenceStore;
beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "mrgr-db-"));
	const opened = openDb(join(dir, "mrgr.db"), { create: true });
	if (!opened.ok) throw new Error(opened.error.message);
	handle = opened.value;
	const corpusStore = new CorpusStore(handle);
	const seeded = corpusStore.append(conflictedRecord());
	if (!seeded.ok) throw new Error(seeded.error.message);
	evidenceStore = new EvidenceStore(handle);
});
afterEach(() => {
	closeDb(handle);
	rmSync(dir, { recursive: true, force: true });
});

describe("EvidenceStore", () => {
	it("round-trips an ok record byte-for-byte, including a multi-byte preimage and a null preimage", () => {
		const record = okRecord();
		expect(evidenceStore.append(record).ok).toBe(true);
		const got = evidenceStore.get(
			record.repository_id,
			record.merge_sha,
			record.baseline_id,
			record.conflict_path,
			record.conflict_ordinal,
		);
		expect(got.ok).toBe(true);
		if (got.ok) expect(got.value).toEqual(record);
	});

	it("round-trips a referenced bundle: preimage content dropped, OID kept", () => {
		// The form a large committed artifact takes — the bytes are recoverable
		// from the repository with `git cat-file blob <oid>`, so the record
		// carries the reference instead. The store must be able to hold it, or
		// the artifact cannot be imported back.
		const base = okRecord();
		const record: OkEvidenceRecord = {
			...base,
			bundle: {
				...base.bundle,
				preimage_ours: null,
				// bytes and OID stay: the side HAS the path, the content is
				// simply not carried here. Null content with a null OID would
				// instead mean the path is absent from that parent.
				preimage_ours_bytes: base.bundle.preimage_ours_bytes,
				preimage_ours_oid: OID_B,
			},
		};
		expect(evidenceStore.append(record).ok).toBe(true);
		const got = evidenceStore.get(
			record.repository_id,
			record.merge_sha,
			record.baseline_id,
			record.conflict_path,
			record.conflict_ordinal,
		);
		expect(got.ok, got.ok ? "" : JSON.stringify(got.error)).toBe(true);
		if (got.ok) expect(got.value).toEqual(record);
	});

	it("round-trips a path-level failed record at PATH_LEVEL_ORDINAL", () => {
		const record = failedPathLevelRecord();
		expect(evidenceStore.append(record).ok).toBe(true);
		const got = evidenceStore.get(
			record.repository_id,
			record.merge_sha,
			record.baseline_id,
			record.conflict_path,
			record.conflict_ordinal,
		);
		expect(got.ok).toBe(true);
		if (got.ok) expect(got.value).toEqual(record);
	});

	it("fails closed with reason missing-region when the region does not exist", () => {
		const base = okRecord();
		const record: EvidenceRecord = {
			...base,
			conflict_ordinal: 7,
			bundle: { ...base.bundle, conflict_ordinal: 7 },
		};
		const result = evidenceStore.append(record);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.kind).toBe("db");
			expect(result.error.details?.reason).toBe("missing-region");
		}
	});

	it("resumes per-region via PK lookup: region 2 is not covered by region 1's key", () => {
		const region1 = okRecord();
		expect(evidenceStore.append(region1).ok).toBe(true);

		const resumedAfterFirst = evidenceStore.resumeKeys();
		expect(resumedAfterFirst.ok).toBe(true);
		if (resumedAfterFirst.ok) {
			expect(resumedAfterFirst.value.has(evidenceKey(region1))).toBe(true);
			expect(resumedAfterFirst.value.has(evidenceKey({ ...region1, conflict_ordinal: 2 }))).toBe(
				false,
			);
		}

		const region2 = okRecordOrdinal2();
		expect(evidenceStore.append(region2).ok).toBe(true);

		const resumedAfterBoth = evidenceStore.resumeKeys();
		expect(resumedAfterBoth.ok).toBe(true);
		if (resumedAfterBoth.ok) {
			expect(resumedAfterBoth.value.has(evidenceKey(region1))).toBe(true);
			expect(resumedAfterBoth.value.has(evidenceKey(region2))).toBe(true);
		}
	});

	it("dedups an identical preimage shared by two ok bundles into one blob row", () => {
		const region1 = okRecord();
		const region2 = okRecordOrdinal2();
		expect(evidenceStore.append(region1).ok).toBe(true);
		expect(evidenceStore.append(region2).ok).toBe(true);

		// Six distinct hunks (3 per region) plus one shared preimage: 6 + 1 = 7
		// blob rows total if the preimage dedups, 8 if it does not.
		const totalBlobs = handle.db.prepare("SELECT COUNT(*) AS n FROM blob").get() as {
			n: number;
		};
		expect(totalBlobs.n).toBe(7);

		const shas = handle.db
			.prepare("SELECT ordinal, preimage_ours_sha FROM evidence_bundle ORDER BY ordinal")
			.all() as { ordinal: number; preimage_ours_sha: string | null }[];
		expect(shas).toHaveLength(2);
		expect(shas[0]!.preimage_ours_sha).not.toBeNull();
		expect(shas[0]!.preimage_ours_sha).toBe(shas[1]!.preimage_ours_sha);
	});

	it("two regions of the same file agreeing on dependency_graph both append and share evidence_dep rows", () => {
		const region1 = okRecord();
		const region2 = okRecordOrdinal2(); // same dependency_graph as region1
		expect(evidenceStore.append(region1).ok).toBe(true);
		expect(evidenceStore.append(region2).ok).toBe(true);

		// evidence_dep's PRIMARY KEY (repository_id, merge_sha, baseline_id,
		// path, side, dep_path) has no ordinal column, so two regions
		// inserting the identical (side, dep_path) pair converge on the same
		// 2 rows structurally — that convergence is guaranteed by the schema
		// regardless of application logic, not proof of a merge our code
		// performed. What this assertion actually checks is that neither
		// region's own round trip below is corrupted by the other's insert.
		const depRows = handle.db
			.prepare(
				"SELECT side, dep_path FROM evidence_dep WHERE path = 'src/a.ts' ORDER BY side, dep_path",
			)
			.all() as { side: string; dep_path: string }[];
		expect(depRows).toEqual([
			{ side: "ours", dep_path: "src/a.ts" },
			{ side: "theirs", dep_path: "src/b.ts" },
		]);

		const got1 = evidenceStore.get(
			region1.repository_id,
			region1.merge_sha,
			region1.baseline_id,
			region1.conflict_path,
			region1.conflict_ordinal,
		);
		expect(got1.ok).toBe(true);
		if (got1.ok) expect(got1.value).toEqual(region1);

		const got2 = evidenceStore.get(
			region2.repository_id,
			region2.merge_sha,
			region2.baseline_id,
			region2.conflict_path,
			region2.conflict_ordinal,
		);
		expect(got2.ok).toBe(true);
		if (got2.ok) expect(got2.value).toEqual(region2);
	});

	it("rejects a second region whose dependency_graph disagrees with its file siblings, leaving the first region's rows unchanged", () => {
		const region1 = okRecord();
		expect(evidenceStore.append(region1).ok).toBe(true);

		const conflicting: OkEvidenceRecord = {
			...okRecordOrdinal2(),
			bundle: {
				...okRecordOrdinal2().bundle,
				// Different dep set than region1's ["ours:src/a.ts", "theirs:src/b.ts"].
				dependency_graph: ["ours:src/a.ts"],
			},
		};
		const result = evidenceStore.append(conflicting);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.kind).toBe("db");
			expect(result.error.details?.reason).toBe("dependency-graph-conflict");
		}

		// Nothing was written for the rejected region.
		const got2 = evidenceStore.get(
			conflicting.repository_id,
			conflicting.merge_sha,
			conflicting.baseline_id,
			conflicting.conflict_path,
			conflicting.conflict_ordinal,
		);
		expect(got2.ok).toBe(true);
		if (got2.ok) expect(got2.value).toBeNull();

		// Region 1's own rows are exactly as they were before the rejected append.
		const depRows = handle.db
			.prepare(
				"SELECT side, dep_path FROM evidence_dep WHERE path = 'src/a.ts' ORDER BY side, dep_path",
			)
			.all() as { side: string; dep_path: string }[];
		expect(depRows).toEqual([
			{ side: "ours", dep_path: "src/a.ts" },
			{ side: "theirs", dep_path: "src/b.ts" },
		]);
		const got1 = evidenceStore.get(
			region1.repository_id,
			region1.merge_sha,
			region1.baseline_id,
			region1.conflict_path,
			region1.conflict_ordinal,
		);
		expect(got1.ok).toBe(true);
		if (got1.ok) expect(got1.value).toEqual(region1);
	});

	it("two regions of the same file agreeing on an EMPTY dependency_graph both succeed", () => {
		const region1 = okRecordEmptyGraph(1);
		const region2 = okRecordEmptyGraph(2);
		expect(evidenceStore.append(region1).ok).toBe(true);
		expect(evidenceStore.append(region2).ok).toBe(true);

		const depRows = handle.db
			.prepare("SELECT side, dep_path FROM evidence_dep WHERE path = 'src/a.ts'")
			.all();
		expect(depRows).toEqual([]);

		const got1 = evidenceStore.get(
			region1.repository_id,
			region1.merge_sha,
			region1.baseline_id,
			region1.conflict_path,
			region1.conflict_ordinal,
		);
		expect(got1.ok).toBe(true);
		if (got1.ok) expect(got1.value).toEqual(region1);

		const got2 = evidenceStore.get(
			region2.repository_id,
			region2.merge_sha,
			region2.baseline_id,
			region2.conflict_path,
			region2.conflict_ordinal,
		);
		expect(got2.ok).toBe(true);
		if (got2.ok) expect(got2.value).toEqual(region2);
	});

	it("rejects a non-empty dependency_graph sibling when the file's first ok region had an empty graph", () => {
		const region1 = okRecordEmptyGraph(1);
		expect(evidenceStore.append(region1).ok).toBe(true);

		const region2 = okRecordOrdinal2(); // non-empty dependency_graph
		const result = evidenceStore.append(region2);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.kind).toBe("db");
			expect(result.error.details?.reason).toBe("dependency-graph-conflict");
		}

		// Nothing was written for the rejected region, and region1's (empty)
		// evidence_dep rows are unaffected.
		const got2 = evidenceStore.get(
			region2.repository_id,
			region2.merge_sha,
			region2.baseline_id,
			region2.conflict_path,
			region2.conflict_ordinal,
		);
		expect(got2.ok).toBe(true);
		if (got2.ok) expect(got2.value).toBeNull();

		const depRows = handle.db
			.prepare("SELECT side, dep_path FROM evidence_dep WHERE path = 'src/a.ts'")
			.all();
		expect(depRows).toEqual([]);
	});

	it("rejects an empty dependency_graph sibling when the file's first ok region had a non-empty graph", () => {
		const region1 = okRecord(); // non-empty dependency_graph
		expect(evidenceStore.append(region1).ok).toBe(true);

		const region2 = okRecordEmptyGraph(2);
		const result = evidenceStore.append(region2);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.kind).toBe("db");
			expect(result.error.details?.reason).toBe("dependency-graph-conflict");
		}

		const got2 = evidenceStore.get(
			region2.repository_id,
			region2.merge_sha,
			region2.baseline_id,
			region2.conflict_path,
			region2.conflict_ordinal,
		);
		expect(got2.ok).toBe(true);
		if (got2.ok) expect(got2.value).toBeNull();

		// Region 1's rows are unaffected by the rejected append.
		const depRows = handle.db
			.prepare(
				"SELECT side, dep_path FROM evidence_dep WHERE path = 'src/a.ts' ORDER BY side, dep_path",
			)
			.all() as { side: string; dep_path: string }[];
		expect(depRows).toEqual([
			{ side: "ours", dep_path: "src/a.ts" },
			{ side: "theirs", dep_path: "src/b.ts" },
		]);
	});

	it("preserves dependency_graph exactly, including unsorted order and a duplicate entry, on round trip", () => {
		const record = unsortedDuplicateGraphRecord();
		expect(evidenceStore.append(record).ok).toBe(true);

		const got = evidenceStore.get(
			record.repository_id,
			record.merge_sha,
			record.baseline_id,
			record.conflict_path,
			record.conflict_ordinal,
		);
		expect(got.ok).toBe(true);
		if (got.ok) expect(got.value).toEqual(record);
		// Explicit on top of the full-record toEqual above: this is the exact
		// property fix round 4 exists to guarantee — not sorted, not deduped.
		if (got.ok && got.value?.status === "ok") {
			expect(got.value.bundle.dependency_graph).toEqual([
				"theirs:z.txt",
				"ours:b.txt",
				"ours:a.txt",
				"ours:a.txt",
			]);
		}
	});

	it("re-appending an identical record with an unsorted, duplicate-containing dependency_graph is idempotent, not a conflict", () => {
		const record = unsortedDuplicateGraphRecord();
		expect(evidenceStore.append(record).ok).toBe(true);
		const second = evidenceStore.append(record);
		expect(second.ok).toBe(true);

		// No rows were duplicated by the second append: one row per array
		// entry (four, including the repeated one), not eight.
		const depRowCount = handle.db
			.prepare("SELECT COUNT(*) AS n FROM evidence_dep WHERE path = 'src/a.ts'")
			.get() as { n: number };
		expect(depRowCount.n).toBe(4);
	});

	it("is idempotent for an identical duplicate, errors on a different one", () => {
		const record = okRecord();
		evidenceStore.append(record);
		expect(evidenceStore.append(record).ok).toBe(true);

		const different: EvidenceRecord = {
			...record,
			bundle: { ...record.bundle, conflict_hunk_ours: "different-hunk\n" },
		};
		const second = evidenceStore.append(different);
		expect(second.ok).toBe(false);
		if (!second.ok) expect(second.error.kind).toBe("db");
	});

	it("list returns records in PK order", () => {
		evidenceStore.append(okRecordOrdinal2());
		evidenceStore.append(okRecord());
		const listed = evidenceStore.list();
		expect(listed.ok).toBe(true);
		if (listed.ok) {
			expect(listed.value.map((r) => r.conflict_ordinal)).toEqual([1, 2]);
		}
	});

	it("get returns null for an absent record", () => {
		const got = evidenceStore.get("nope", OID_A, DIGEST, "src/a.ts", 1);
		expect(got.ok).toBe(true);
		if (got.ok) expect(got.value).toBeNull();
	});
});

// Closes the TOCTOU gap fix round 3 found: the dependency-graph agreement
// check ran before append()'s transaction opened, so two concurrent
// connections appending different regions of the same file could each read
// "no conflicting sibling yet" and both proceed. This drives two separate
// OS processes at EvidenceStore.append itself (not raw SQL), mirroring
// concurrency.test.ts's LedgerStore.append regression.
describe("EvidenceStore concurrent append (dependency_graph race)", () => {
	it(
		"two concurrent appends of different regions with DIFFERING dependency graphs: exactly one succeeds, never both",
		async () => {
			const graphA = ["ours:src/a.ts", "theirs:src/b.ts"];
			const graphB = ["ours:src/a.ts", "theirs:src/c.ts"];

			// Both workers spin-wait to this shared deadline before calling
			// append(), so their append() calls land within microseconds of
			// each other regardless of `pnpm exec tsx` process-spawn jitter —
			// see evidence-store-worker.ts for why that jitter otherwise
			// swamps the (much smaller) window this test targets.
			const barrierAtEpochMs = Date.now() + 1000;
			const [resultA, resultB] = await Promise.all([
				runEvidenceStoreWorker(1, graphA, barrierAtEpochMs),
				runEvidenceStoreWorker(2, graphB, barrierAtEpochMs),
			]);
			const results = [resultA, resultB];

			// Deterministic regardless of which worker wins the BEGIN IMMEDIATE
			// race: exactly one must succeed and exactly one must be rejected
			// for disagreeing with the sibling that got there first. Only WHICH
			// one wins is nondeterministic; this property is not.
			const succeeded = results.filter((r) => r.ok);
			const failed = results.filter((r): r is Extract<WorkerAppendResult, { ok: false }> => !r.ok);
			expect(succeeded).toHaveLength(1);
			expect(failed).toHaveLength(1);
			expect(failed[0]!.error.kind).toBe("db");
			expect(failed[0]!.error.details?.reason).toBe("dependency-graph-conflict");

			// The store holds exactly one coherent graph for the file — whichever
			// region actually won — never a mix of the two.
			const depRows = handle.db
				.prepare(
					"SELECT side, dep_path FROM evidence_dep WHERE path = 'src/a.ts' ORDER BY side, dep_path",
				)
				.all() as { side: string; dep_path: string }[];
			const storedGraph = new Set(depRows.map((d) => `${d.side}:${d.dep_path}`));
			const matchesGraph = (candidate: string[]) => {
				const candidateSet = new Set(candidate);
				return (
					storedGraph.size === candidateSet.size &&
					[...storedGraph].every((entry) => candidateSet.has(entry))
				);
			};
			expect(matchesGraph(graphA) !== matchesGraph(graphB)).toBe(true); // exactly one matches
		},
		20_000,
	);
});
