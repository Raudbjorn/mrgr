import { describe, expect, it } from "vitest";

import { generateReport, selectBaseline } from "../../src/evaluation/report.js";
import type {
	ConflictRegionRecord,
	CorpusRecordV2,
} from "../../src/evaluation/types.js";

const digest = "a".repeat(64);

function exactRegion(
	ordinal: number,
	tripleKey: string,
	resolutionDigest: string,
	resolutionClass: "ours" | "theirs" | "base" | "deleted" | "novel" = "ours",
): ConflictRegionRecord {
	return {
		path: `file-${ordinal}.txt`,
		ordinal,
		category: "other",
		conflictKind: "CONFLICT (content)",
		stageOids: { base: "base-blob", ours: "ours-blob", theirs: "theirs-blob" },
		localizationStatus: "exact",
		automaticRanges: {
			base: { startLine: 3, endLineExclusive: 4 },
			ours: { startLine: 1, endLineExclusive: 2 },
			theirs: { startLine: 5, endLineExclusive: 6 },
		},
		resolutionRange: { startLine: 1, endLineExclusive: 2 },
		rawDigests: {
			base: digest,
			ours: digest,
			theirs: digest,
			resolution: digest,
		},
		normalizedDigests: {
			base: digest,
			ours: digest,
			theirs: digest,
			resolution: resolutionDigest,
		},
		rawCounts: {
			base: { lines: 1, bytes: 4 },
			ours: { lines: 1, bytes: 4 },
			theirs: { lines: 1, bytes: 4 },
			resolution: { lines: 1, bytes: 4 },
		},
		resolutionClass,
		novelAfterNormalization: resolutionClass === "novel",
		tripleKey,
	};
}

function record(overrides: Partial<CorpusRecordV2> = {}): CorpusRecordV2 {
	return {
		schemaVersion: 2,
		repository: {
			kind: "local",
			id: "local:fixture",
			absolutePath: "/tmp/fixture",
		},
		merge: {
			repositoryId: "local:fixture",
			sha: "merge",
			parents: ["parent-1", "parent-2"],
			authorDate: "2026-08-25T00:00:00Z",
			subject: "fixture",
		},
		baselineId: "baseline-a",
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
			{ baseSha: "base", oursExclusiveCommits: 1, theirsExclusiveCommits: 1 },
		],
		changedPathIntersection: [],
		replayStatus: "clean",
		automaticTreeOid: "tree",
		conflictPaths: [],
		conflictRegions: [],
		...overrides,
	};
}

describe("baseline selection", () => {
	it("refuses mixed baselines and lists sorted IDs", () => {
		const selected = selectBaseline([
			record({ baselineId: "z" }),
			record({ baselineId: "a" }),
		]);
		expect(selected.ok).toBe(false);
		if (!selected.ok)
			expect(selected.error.details).toEqual({ availableBaselines: "a,z" });
	});

	it("selects an explicitly requested baseline and rejects a missing one", () => {
		const records = [
			record({ baselineId: "a" }),
			record({ baselineId: "b", merge: { ...record().merge, sha: "two" } }),
		];
		const selected = selectBaseline(records, "b");
		expect(
			selected.ok && selected.value.records.map((value) => value.baselineId),
		).toEqual(["b"]);
		const missing = selectBaseline(records, "c");
		expect(missing.ok).toBe(false);
		if (!missing.ok)
			expect(missing.error.details).toEqual({
				availableBaselines: "a,b",
				selectedBaseline: "c",
			});
	});
});

describe("deterministic denominator report", () => {
	it("emits every required label in order and keeps excluded replay statuses visible", () => {
		const ambiguous: ConflictRegionRecord = {
			path: "ambiguous.txt",
			ordinal: 1,
			category: "other",
			conflictKind: "CONFLICT (content)",
			stageOids: { base: null, ours: null, theirs: null },
			localizationStatus: "ambiguous",
			automaticRanges: { base: null, ours: null, theirs: null },
			resolutionRange: null,
			rawDigests: { base: null, ours: null, theirs: null, resolution: null },
			normalizedDigests: {
				base: null,
				ours: null,
				theirs: null,
				resolution: null,
			},
			rawCounts: { base: null, ours: null, theirs: null, resolution: null },
			resolutionClass: "ambiguous",
			novelAfterNormalization: null,
			tripleKey: null,
		};
		const unsupported = {
			...ambiguous,
			path: "binary.bin",
			localizationStatus: "unsupported-binary" as const,
		};
		const records = [
			record(),
			record({
				merge: { ...record().merge, sha: "conflict" },
				replayStatus: "conflicted",
				conflictPaths: ["one", "two"],
				conflictRegions: [
					exactRegion(1, "1".repeat(64), "2".repeat(64), "novel"),
					ambiguous,
					unsupported,
				],
			}),
			record({
				merge: { ...record().merge, sha: "unrelated" },
				replayStatus: "unrelated",
				automaticTreeOid: null,
				baseTopology: "none",
				mergeBases: [],
				baseReachabilityCounts: [],
				changedPathIntersection: null,
			}),
			record({
				merge: { ...record().merge, sha: "quarantine" },
				replayStatus: "unsupported-custom-driver",
				automaticTreeOid: null,
			}),
			record({
				merge: { ...record().merge, sha: "error" },
				replayStatus: "error",
				automaticTreeOid: null,
				error: { kind: "git", operation: "replay", message: "failed" },
			}),
		];
		const report = generateReport(records);
		expect(report.ok).toBe(true);
		if (!report.ok) return;
		const labels = [
			"baseline ID: baseline-a",
			"Git version: git version 2.51.0",
			"candidates=5",
			"replay: clean=1 conflicted=1 unrelated=1 quarantined=1 error=1",
			"conflicted path occurrences=2",
			"exact localized regions=1 ambiguous regions=1 unsupported regions=1",
			"exact resolution: ours=0 theirs=0 base=0 deleted=0 novel=1 normalized-novel=1",
			"single-base stratum:",
			"multiple-base stratum:",
			"repeated triple groups=0 divergent resolution groups=0",
			"replay attempted=2",
			"pinned modern replay incidence: 1/2 (0.500000)",
			"historical conflict incidence: not measured",
			"observed deterministic ambiguity floor: not measurable (no repeated localized triples)",
		];
		let previous = -1;
		for (const label of labels) {
			const index = report.value.indexOf(label);
			expect(index, label).toBeGreaterThan(previous);
			previous = index;
		}
	});

	it("reports a zero replay denominator without division", () => {
		const report = generateReport([
			record({
				replayStatus: "unrelated",
				automaticTreeOid: null,
				baseTopology: "none",
				mergeBases: [],
				baseReachabilityCounts: [],
				changedPathIntersection: null,
			}),
		]);
		expect(report.ok && report.value).toContain(
			"pinned modern replay incidence: not measurable (no attempted replays)",
		);
	});

	it("computes repeated and divergent localized triples with the exact floor formula", () => {
		const a = "1".repeat(64);
		const b = "2".repeat(64);
		const x = "3".repeat(64);
		const y = "4".repeat(64);
		const z = "5".repeat(64);
		const report = generateReport([
			record({
				replayStatus: "conflicted",
				conflictPaths: ["file"],
				conflictRegions: [
					exactRegion(1, a, x),
					exactRegion(2, a, x),
					exactRegion(3, a, y),
					exactRegion(4, b, z),
					exactRegion(5, b, z),
				],
			}),
		]);
		expect(report.ok && report.value).toContain(
			"repeated triple groups=2 divergent resolution groups=1",
		);
		expect(report.ok && report.value).toContain(
			"observed deterministic ambiguity floor: 1/5 (0.200000)",
		);
	});
});
