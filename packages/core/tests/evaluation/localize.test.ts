import { rm } from "node:fs/promises";
import { afterEach, describe, expect, test } from "vitest";

import {
	openLocalRepository,
	type RepositoryHandle,
} from "../../src/evaluation/acquire.js";
import { gitVersion, runGit } from "../../src/evaluation/git.js";
import {
	localizeConflictPathEvidence,
	localizeConflictRegions,
} from "../../src/evaluation/localize.js";
import {
	listCandidates,
	replayCandidate,
	type CandidateReplayResult,
} from "../../src/evaluation/replay.js";
import type {
	MergeCandidate,
	StageObjectIds,
} from "../../src/evaluation/types.js";
import {
	commitFiles,
	createRepository,
	mergeAndResolve,
} from "./git-fixture.js";

const stageOids: StageObjectIds = {
	base: "base-oid",
	ours: "ours-oid",
	theirs: "theirs-oid",
};
const temporaryPaths: string[] = [];

function evidence(
	overrides: Partial<Parameters<typeof localizeConflictPathEvidence>[0]> = {},
) {
	return localizeConflictPathEvidence({
		path: "shared.txt",
		conflictKind: "CONFLICT (content)",
		stageOids,
		automaticBlob: Buffer.from(
			"before\n<<<<<<< ours\nours\n||||||| base\nbase\n=======\ntheirs\n>>>>>>> theirs\nafter\n",
		),
		shippedBlob: Buffer.from("before\nours\nafter\n"),
		diff: Buffer.from(
			"diff --git a/shared.txt b/shared.txt\n@@ -2,7 +2,1 @@\n-<<<<<<< ours\n-ours\n-||||||| base\n-base\n-=======\n-theirs\n->>>>>>> theirs\n+ours\n",
		),
		...overrides,
	});
}

afterEach(async () => {
	await Promise.all(
		temporaryPaths
			.splice(0)
			.map((path) => rm(path, { force: true, recursive: true })),
	);
});

describe("localizeConflictPathEvidence", () => {
	test("aligns one whole diff3 block to one zero-context replacement hunk", () => {
		const result = evidence();
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value).toHaveLength(1);
		expect(result.value[0]).toMatchObject({
			path: "shared.txt",
			ordinal: 1,
			localizationStatus: "exact",
			automaticRanges: {
				ours: { startLine: 3, endLineExclusive: 4 },
				base: { startLine: 5, endLineExclusive: 6 },
				theirs: { startLine: 7, endLineExclusive: 8 },
			},
			resolutionRange: { startLine: 2, endLineExclusive: 3 },
			resolutionClass: "ours",
		});
	});

	test("treats Git's split deletion hunks around a selected side as one exact edit group", () => {
		const result = evidence({
			diff: Buffer.from(
				"@@ -2 +1,0 @@ before\n-<<<<<<< ours\n@@ -4,5 +2,0 @@ ours\n-||||||| base\n-base\n-=======\n-theirs\n->>>>>>> theirs\n",
			),
		});
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value[0]).toMatchObject({
			localizationStatus: "exact",
			resolutionRange: { startLine: 2, endLineExclusive: 3 },
			resolutionClass: "ours",
		});
	});

	test("keeps an edit group ambiguous when its old envelope crosses outside the marker block", () => {
		const result = evidence({
			diff: Buffer.from(
				"@@ -1,2 +1,0 @@\n-before\n-<<<<<<< ours\n@@ -4,5 +2,0 @@ ours\n-||||||| base\n-base\n-=======\n-theirs\n->>>>>>> theirs\n",
			),
		});
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value[0]).toMatchObject({
			localizationStatus: "ambiguous",
			resolutionClass: "ambiguous",
		});
	});

	test("keeps an edit group ambiguous when old and shipped hunk gaps disagree", () => {
		const result = evidence({
			diff: Buffer.from(
				"@@ -2 +1,0 @@ before\n-<<<<<<< ours\n@@ -4,5 +5,0 @@ ours\n-||||||| base\n-base\n-=======\n-theirs\n->>>>>>> theirs\n",
			),
		});
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value[0]).toMatchObject({
			localizationStatus: "ambiguous",
			resolutionClass: "ambiguous",
		});
	});

	test.each([
		["malformed", "<<<<<<< ours\nours\n=======\ntheirs\n>>>>>>> theirs\n"],
		[
			"nested",
			"<<<<<<< ours\n<<<<<<< nested\n||||||| base\n=======\n>>>>>>> theirs\n",
		],
	] as const)("marks %s markers ambiguous", (_name, automatic) => {
		const result = evidence({
			automaticBlob: Buffer.from(automatic),
			diff: Buffer.alloc(0),
		});
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value).toEqual([
			expect.objectContaining({
				localizationStatus: "ambiguous",
				resolutionClass: "ambiguous",
				novelAfterNormalization: null,
				tripleKey: null,
			}),
		]);
	});

	test("marks both blocks ambiguous when one hunk replaces both", () => {
		const block =
			"<<<<<<< ours\nours\n||||||| base\nbase\n=======\ntheirs\n>>>>>>> theirs\n";
		const result = evidence({
			automaticBlob: Buffer.from(`${block}between\n${block}`),
			shippedBlob: Buffer.from("first\nbetween\nsecond\n"),
			diff: Buffer.from("@@ -1,15 +1,3 @@\n"),
		});
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value).toHaveLength(2);
		expect(result.value.map((record) => record.localizationStatus)).toEqual([
			"ambiguous",
			"ambiguous",
		]);
	});

	test("classifies NUL-containing evidence as unsupported binary", () => {
		const result = evidence({ automaticBlob: Buffer.from([0, 1, 2]) });
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value).toEqual([
			expect.objectContaining({
				localizationStatus: "unsupported-binary",
				resolutionClass: "ambiguous",
			}),
		]);
	});

	test("classifies non-content conflicts as unsupported structural without parsing", () => {
		const result = evidence({
			conflictKind: "CONFLICT (file/directory)",
			automaticBlob: null,
			shippedBlob: null,
			diff: null,
		});
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value).toEqual([
			expect.objectContaining({
				localizationStatus: "unsupported-structural",
				resolutionClass: "ambiguous",
			}),
		]);
	});
});

async function mustGit(path: string, args: readonly string[]): Promise<Buffer> {
	const result = await runGit(path, args, { timeoutMs: 30_000 });
	if (!result.ok)
		throw new Error(`${result.error.operation}: ${result.error.message}`);
	return result.value.stdout;
}

async function open(path: string): Promise<RepositoryHandle> {
	const result = await openLocalRepository(path);
	if (!result.ok) throw new Error(result.error.message);
	return result.value;
}

async function currentGitVersion(): Promise<string> {
	const result = await gitVersion();
	if (!result.ok) throw new Error(result.error.message);
	return result.value;
}

async function replayMerge(
	handle: RepositoryHandle,
	mergeSha: string,
): Promise<CandidateReplayResult> {
	const listed = await listCandidates(handle);
	if (!listed.ok) throw new Error(listed.error.message);
	const candidate = listed.value.find((entry) => entry.sha === mergeSha) as
		| MergeCandidate
		| undefined;
	if (candidate === undefined) throw new Error("merge candidate not found");
	const replayed = await replayCandidate(
		handle,
		candidate,
		await currentGitVersion(),
	);
	if (!replayed.ok) throw new Error(replayed.error.message);
	return replayed.value;
}

describe("localizeConflictRegions with real Git", () => {
	test("classifies only the ours conflict span when a disjoint theirs edit auto-merges", async () => {
		const path = await createRepository();
		temporaryPaths.push(path);
		await mustGit(path, ["config", "merge.conflictStyle", "diff3"]);
		const baseText = [
			"header",
			"conflict: base",
			"line 3",
			"line 4",
			"line 5",
			"line 6",
			"line 7",
			"line 8",
			"line 9",
			"tail: base",
			"",
		].join("\n");
		const base = await commitFiles(path, { "shared.txt": baseText }, "base");
		await mustGit(path, ["checkout", "-b", "theirs", base]);
		const theirsText = baseText
			.replace("conflict: base", "conflict: theirs")
			.replace("tail: base", "tail: theirs");
		const theirs = await commitFiles(
			path,
			{ "shared.txt": theirsText },
			"theirs",
		);
		await mustGit(path, ["checkout", "main"]);
		const oursText = baseText.replace("conflict: base", "conflict: ours");
		await commitFiles(path, { "shared.txt": oursText }, "ours");
		const shippedText = oursText.replace("tail: base", "tail: theirs");
		const merge = await mergeAndResolve(
			path,
			theirs,
			{ "shared.txt": shippedText },
			"ours conflict plus disjoint theirs",
		);
		const handle = await open(path);
		const replay = await replayMerge(handle, merge);
		expect(replay.replayStatus).toBe("conflicted");

		const localized = await localizeConflictRegions(handle, replay);

		expect(localized.ok).toBe(true);
		if (!localized.ok) return;
		expect(localized.value).toHaveLength(1);
		const region = localized.value[0];
		expect(region).toMatchObject({
			localizationStatus: "exact",
			resolutionClass: "ours",
			novelAfterNormalization: false,
		});
		if (region?.localizationStatus !== "exact") return;
		const shippedBlob = (
			await mustGit(path, ["show", `${merge}:shared.txt`])
		).toString("utf8");
		const lines = shippedBlob.split("\n");
		const slice = lines
			.slice(
				region.resolutionRange.startLine - 1,
				region.resolutionRange.endLineExclusive - 1,
			)
			.join("\n");
		expect(slice).toContain("conflict: ours");
		expect(slice).not.toContain("tail: theirs");
	});
});
