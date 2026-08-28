import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { CorpusStore } from "../../src/db/corpus-store.js";
import { EvidenceStore } from "../../src/db/evidence-store.js";
import { closeDb, openDb, type DbHandle } from "../../src/db/open.js";
import { PATH_LEVEL_ORDINAL, evidenceKey, type EvidenceRecord } from "../../src/m1a/sidecar.js";
import type { CorpusRecordV2 } from "../../src/evaluation/types.js";

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
