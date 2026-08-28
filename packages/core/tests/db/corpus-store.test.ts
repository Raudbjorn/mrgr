import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { CorpusStore } from "../../src/db/corpus-store.js";
import { closeDb, openDb, type DbHandle } from "../../src/db/open.js";
import { resumeKey } from "../../src/evaluation/corpus.js";
import type { CorpusRecordV2 } from "../../src/evaluation/types.js";

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
});
