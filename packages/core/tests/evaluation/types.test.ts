import { describe, expect, expectTypeOf, it } from "vitest";

import { err, ok } from "../../src/evaluation/result.js";
import {
	SCHEMA_VERSION,
	type ConflictRegionRecord,
	type CorpusRecordV2,
	type MergeCandidate,
	type ObjectId,
} from "../../src/evaluation/types.js";

type AmbiguousRegion = Extract<
	ConflictRegionRecord,
	{ localizationStatus: "ambiguous" }
>;

const candidate = {
	repositoryId: "local:fixture",
	sha: "merge",
	parents: ["parent-1", "parent-2"],
	authorDate: "2026-08-25T00:00:00Z",
	subject: "merge fixture",
} as const satisfies MergeCandidate;

const record: CorpusRecordV2 = {
	schemaVersion: SCHEMA_VERSION,
	repository: {
		kind: "local",
		id: candidate.repositoryId,
		absolutePath: "/tmp/fixture",
	},
	merge: candidate,
	baselineId: "baseline",
	replayProvenance: {
		gitVersion: "git version 2.51.0",
		algorithm: "merge-tree-write-tree",
		strategy: "ort",
		environmentPolicy: "isolated-v1",
		normalizationVersion: "v1",
		parentAttributes: { ours: null, theirs: null },
		repoMergeConfigHash: null,
	},
	mergeBases: ["base"],
	baseTopology: "single",
	baseReachabilityCounts: [
		{
			baseSha: "base",
			oursExclusiveCommits: 1,
			theirsExclusiveCommits: 1,
		},
	],
	changedPathIntersection: ["src/example.ts"],
	replayStatus: "clean",
	automaticTreeOid: "tree",
	conflictPaths: [],
	conflictRegions: [],
};

describe("WP0 schema contracts", () => {
	it("round-trips a schema-v2 corpus record through JSON", () => {
		expect(JSON.parse(JSON.stringify(record))).toEqual(record);
		expect(record.schemaVersion).toBe(2);
	});

	it("declares exactly two merge parents", () => {
		expectTypeOf<MergeCandidate["parents"]>().toEqualTypeOf<
			readonly [ObjectId, ObjectId]
		>();
		expect(candidate.parents).toHaveLength(2);
	});

	it("prevents ambiguous regions from carrying novelty evidence", () => {
		expectTypeOf<
			AmbiguousRegion["novelAfterNormalization"]
		>().toEqualTypeOf<null>();
		expectTypeOf<AmbiguousRegion["tripleKey"]>().toEqualTypeOf<null>();
		expectTypeOf<
			AmbiguousRegion["resolutionClass"]
		>().toEqualTypeOf<"ambiguous">();
	});

	it("represents expected failures as Result values", () => {
		expect(ok("value")).toEqual({ ok: true, value: "value" });
		expect(err("parse", "decode", "invalid record")).toEqual({
			ok: false,
			error: {
				kind: "parse",
				operation: "decode",
				message: "invalid record",
			},
		});
	});
});
