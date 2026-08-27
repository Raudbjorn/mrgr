import type { ToolError } from "./result.js";

export type ObjectId = string;

export const SCHEMA_VERSION = 2 as const;

export interface MergeCandidate {
	repositoryId: string;
	sha: ObjectId;
	parents: readonly [ObjectId, ObjectId];
	authorDate: string;
	subject: string;
}

export type BaseTopology = "single" | "multiple" | "none";

export interface BaseReachabilityCount {
	baseSha: ObjectId;
	oursExclusiveCommits: number;
	theirsExclusiveCommits: number;
}

export type ReplayStatus =
	| "clean"
	| "conflicted"
	| "unrelated"
	| "unsupported-custom-driver"
	| "error";

export type LocalizationStatus =
	| "exact"
	| "ambiguous"
	| "unsupported-binary"
	| "unsupported-structural";

export type ResolutionClass =
	| "ours"
	| "theirs"
	| "base"
	| "deleted"
	| "novel"
	| "ambiguous";

export type ConflictCategory =
	| "lockfile"
	| "migration"
	| "documentation"
	| "generated"
	| "other";

export interface LineRange {
	startLine: number;
	endLineExclusive: number;
}

export interface StageObjectIds {
	base: ObjectId | null;
	ours: ObjectId | null;
	theirs: ObjectId | null;
}

export interface AutomaticRanges<T> {
	base: T;
	ours: T;
	theirs: T;
}

export interface RegionDigests<T> extends AutomaticRanges<T> {
	resolution: T;
}
export interface RawSpanCounts {
	lines: number;
	bytes: number;
}


interface ConflictRegionCommon {
	path: string;
	ordinal: number;
	category: ConflictCategory;
	conflictKind: string;
	stageOids: StageObjectIds;
}

export interface ExactConflictRegionRecord extends ConflictRegionCommon {
	localizationStatus: "exact";
	automaticRanges: AutomaticRanges<LineRange>;
	resolutionRange: LineRange;
	rawDigests: RegionDigests<string>;
	normalizedDigests: RegionDigests<string>;
	rawCounts: RegionDigests<RawSpanCounts>;
	resolutionClass: Exclude<ResolutionClass, "ambiguous">;
	novelAfterNormalization: boolean;
	tripleKey: string;
}

interface InexactConflictRegionFields extends ConflictRegionCommon {
	automaticRanges: AutomaticRanges<LineRange | null>;
	resolutionRange: LineRange | null;
	rawDigests: RegionDigests<string | null>;
	normalizedDigests: RegionDigests<string | null>;
	rawCounts: RegionDigests<RawSpanCounts | null>;
	resolutionClass: "ambiguous";
	novelAfterNormalization: null;
	tripleKey: null;
}

export interface AmbiguousConflictRegionRecord
	extends InexactConflictRegionFields {
	localizationStatus: "ambiguous";
}

export interface UnsupportedConflictRegionRecord
	extends InexactConflictRegionFields {
	localizationStatus: "unsupported-binary" | "unsupported-structural";
}

export type ConflictRegionRecord =
	| ExactConflictRegionRecord
	| AmbiguousConflictRegionRecord
	| UnsupportedConflictRegionRecord;

export type RepositoryRef =
	| {
			kind: "remote";
			id: string;
			host: string;
			slug: string;
			cacheKey: string;
	  }
	| {
			kind: "local";
			id: string;
			absolutePath: string;
	  };

export interface ReplayProvenance {
	gitVersion: string;
	algorithm: "merge-tree-write-tree";
	strategy: "ort";
	environmentPolicy: "isolated-v1";
	normalizationVersion: "v1";
	parentAttributes: {
		ours: ObjectId | null;
		theirs: ObjectId | null;
	};
	repoMergeConfigHash: string | null;
}

export interface CorpusRecordV2 {
	schemaVersion: typeof SCHEMA_VERSION;
	repository: RepositoryRef;
	merge: MergeCandidate;
	baselineId: string;
	replayProvenance: ReplayProvenance;
	mergeBases: readonly ObjectId[];
	baseTopology: BaseTopology;
	baseReachabilityCounts: readonly BaseReachabilityCount[];
	changedPathIntersection: readonly string[] | null;
	replayStatus: ReplayStatus;
	automaticTreeOid: ObjectId | null;
	conflictPaths: readonly string[];
	conflictRegions: readonly ConflictRegionRecord[];
	error?: ToolError;
}
