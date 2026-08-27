import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import {
	openLocalRepository,
	type RepositoryHandle,
} from "../../src/evaluation/acquire.js";
import { gitVersion, runGit } from "../../src/evaluation/git.js";
import {
	listCandidates,
	parseMergeTreeOutput,
	replayCandidate,
} from "../../src/evaluation/replay.js";
import type { MergeCandidate } from "../../src/evaluation/types.js";
import {
	commitFiles,
	commitTree,
	createRepository,
	mergeAndResolve,
} from "./git-fixture.js";

const temporaryPaths: string[] = [];

afterEach(async () => {
	await Promise.all(
		temporaryPaths
			.splice(0)
			.map((path) => rm(path, { force: true, recursive: true })),
	);
});

async function repository(): Promise<string> {
	const path = await createRepository();
	temporaryPaths.push(path);
	return path;
}

async function mustGit(
	repositoryPath: string,
	args: readonly string[],
	acceptedExitCodes: readonly number[] = [0],
): Promise<Buffer> {
	const result = await runGit(repositoryPath, args, {
		acceptedExitCodes,
		timeoutMs: 30_000,
	});
	if (!result.ok) {
		throw new Error(`${result.error.operation}: ${result.error.message}`);
	}
	return result.value.stdout;
}

async function open(repositoryPath: string): Promise<RepositoryHandle> {
	const result = await openLocalRepository(repositoryPath);
	if (!result.ok) {
		throw new Error(`${result.error.operation}: ${result.error.message}`);
	}
	return result.value;
}

async function currentGitVersion(): Promise<string> {
	const result = await gitVersion();
	if (!result.ok) {
		throw new Error(`${result.error.operation}: ${result.error.message}`);
	}
	return result.value;
}

async function candidateFor(
	repositoryHandle: RepositoryHandle,
	sha: string,
	options: { gitBinary?: string } = {},
): Promise<MergeCandidate> {
	const result = await listCandidates(repositoryHandle, options);
	expect(result.ok).toBe(true);
	if (!result.ok) {
		throw new Error(result.error.message);
	}
	const candidate = result.value.find((entry) => entry.sha === sha);
	expect(candidate).toBeDefined();
	if (candidate === undefined) {
		throw new Error(`candidate ${sha} not found`);
	}
	return candidate;
}

async function replay(
	repositoryHandle: RepositoryHandle,
	candidate: MergeCandidate,
	options: { gitBinary?: string } = {},
) {
	return replayCandidate(
		repositoryHandle,
		candidate,
		await currentGitVersion(),
		options,
	);
}

describe("listCandidates", () => {
	test("lists exact two-parent merges with metadata", async () => {
		const path = await repository();
		const base = await commitFiles(path, { "base.txt": "base\n" }, "base");
		await mustGit(path, ["checkout", "-b", "theirs", base]);
		const theirs = await commitFiles(
			path,
			{ "theirs.txt": "theirs\n" },
			"theirs",
		);
		await mustGit(path, ["checkout", "main"]);
		await commitFiles(path, { "ours.txt": "ours\n" }, "ours");
		const merge = await mergeAndResolve(
			path,
			theirs,
			{},
			"clean fixture merge",
		);
		const handle = await open(path);

		const result = await listCandidates(handle, { since: "1970-01-01" });

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value).toHaveLength(1);
		expect(result.value[0]).toMatchObject({
			repositoryId: handle.repository.id,
			sha: merge,
			subject: "clean fixture merge",
		});
		expect(result.value[0]?.parents).toHaveLength(2);
		expect(Date.parse(result.value[0]?.authorDate ?? "")).not.toBeNaN();
	});

	test("excludes octopus commits", async () => {
		const path = await repository();
		const root = await commitFiles(path, { "root.txt": "root\n" }, "root");
		const tree = (await mustGit(path, ["rev-parse", `${root}^{tree}`]))
			.toString("utf8")
			.trim();
		const first = await commitTree(path, tree, [root], "first");
		const second = await commitTree(path, tree, [root], "second");
		const third = await commitTree(path, tree, [root], "third");
		const octopus = await commitTree(
			path,
			tree,
			[first, second, third],
			"octopus",
		);
		await mustGit(path, ["update-ref", "refs/heads/octopus", octopus]);

		const result = await listCandidates(await open(path));

		expect(result).toEqual({ ok: true, value: [] });
	});

	test("rejects graph-order truncation disguised as a revision range", async () => {
		const path = await repository();
		await commitFiles(path, { "root.txt": "root\n" }, "root");

		const result = await listCandidates(await open(path), {
			revRange: "--max-count=1",
		});

		expect(result).toMatchObject({
			ok: false,
			error: {
				kind: "config",
				operation: "list merge candidates",
			},
		});
	});
});

describe("replayCandidate", () => {
	test("replays a clean two-parent merge", async () => {
		const path = await repository();
		const base = await commitFiles(path, { "base.txt": "base\n" }, "base");
		await mustGit(path, ["checkout", "-b", "theirs", base]);
		const theirs = await commitFiles(
			path,
			{ "theirs.txt": "theirs\n" },
			"theirs",
		);
		await mustGit(path, ["checkout", "main"]);
		await commitFiles(path, { "ours.txt": "ours\n" }, "ours");
		const merge = await mergeAndResolve(path, theirs, {}, "clean merge");
		const handle = await open(path);
		const candidate = await candidateFor(handle, merge);

		const result = await replay(handle, candidate);

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value).toMatchObject({
			candidate,
			baseTopology: "single",
			mergeBases: [base],
			changedPathIntersection: [],
			replayStatus: "clean",
			conflictPaths: [],
			informationalMessages: [],
			stageOidsByPath: {},
		});
		expect(result.value.automaticTreeOid).toMatch(/^[a-f0-9]{40,64}$/);
		expect(result.value.baseReachabilityCounts).toEqual([
			{ baseSha: base, oursExclusiveCommits: 1, theirsExclusiveCommits: 1 },
		]);
		expect(result.value.provenance.algorithm).toBe("merge-tree-write-tree");
	});

	test("retains clean auto-merging messages without inventing conflict paths", async () => {
		const path = await repository();
		const base = await commitFiles(
			path,
			{ "shared.txt": "one\ntwo\nthree\n" },
			"base",
		);
		await mustGit(path, ["checkout", "-b", "theirs", base]);
		const theirs = await commitFiles(
			path,
			{ "shared.txt": "THEIRS\ntwo\nthree\n" },
			"theirs",
		);
		await mustGit(path, ["checkout", "main"]);
		await commitFiles(path, { "shared.txt": "one\ntwo\nOURS\n" }, "ours");
		const merge = await mergeAndResolve(
			path,
			theirs,
			{},
			"clean same-file merge",
		);
		const handle = await open(path);
		const candidate = await candidateFor(handle, merge);

		const result = await replay(handle, candidate);

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.replayStatus).toBe("clean");
		expect(result.value.stageOidsByPath).toEqual({});
		expect(result.value.conflictPaths).toEqual([]);
		expect(result.value.informationalMessages).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					paths: ["shared.txt"],
					kind: "Auto-merging",
				}),
			]),
		);
	});

	test("parses content conflict tree, stages, path, and message", async () => {
		const path = await repository();
		const base = await commitFiles(path, { "shared.txt": "base\n" }, "base");
		await mustGit(path, ["checkout", "-b", "theirs", base]);
		const theirs = await commitFiles(
			path,
			{ "shared.txt": "theirs\n" },
			"theirs",
		);
		await mustGit(path, ["checkout", "main"]);
		await commitFiles(path, { "shared.txt": "ours\n" }, "ours");
		const merge = await mergeAndResolve(
			path,
			theirs,
			{ "shared.txt": "resolved\n" },
			"content merge",
		);
		const handle = await open(path);
		const candidate = await candidateFor(handle, merge);

		const result = await replay(handle, candidate);

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.replayStatus).toBe("conflicted");
		expect(result.value.automaticTreeOid).toMatch(/^[a-f0-9]{40,64}$/);
		expect(result.value.conflictPaths).toContain("shared.txt");
		expect(result.value.stageOidsByPath["shared.txt"]).toEqual({
			base: expect.stringMatching(/^[a-f0-9]{40,64}$/),
			ours: expect.stringMatching(/^[a-f0-9]{40,64}$/),
			theirs: expect.stringMatching(/^[a-f0-9]{40,64}$/),
		});
		expect(result.value.informationalMessages).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					paths: expect.arrayContaining(["shared.txt"]),
					kind: expect.stringContaining("CONFLICT"),
					message: expect.stringContaining("shared.txt"),
				}),
			]),
		);
	});

	test("returns unrelated histories without a merge tree", async () => {
		const path = await repository();
		const first = await commitFiles(
			path,
			{ "first.txt": "first\n" },
			"first root",
		);
		await mustGit(path, ["checkout", "--orphan", "other"]);
		await mustGit(path, ["rm", "-rf", "."]);
		const second = await commitFiles(
			path,
			{ "second.txt": "second\n" },
			"second root",
		);
		const tree = (await mustGit(path, ["rev-parse", `${first}^{tree}`]))
			.toString("utf8")
			.trim();
		const merge = await commitTree(
			path,
			tree,
			[first, second],
			"unrelated merge record",
		);
		await mustGit(path, ["update-ref", "refs/heads/unrelated", merge]);
		const handle = await open(path);
		const candidate = await candidateFor(handle, merge);

		const result = await replay(handle, candidate);

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value).toMatchObject({
			baseTopology: "none",
			mergeBases: [],
			baseReachabilityCounts: [],
			changedPathIntersection: null,
			replayStatus: "unrelated",
			automaticTreeOid: null,
			conflictPaths: [],
			stageOidsByPath: {},
			informationalMessages: [],
		});
	});

	test("quarantines custom drivers without invoking merge-tree", async () => {
		const path = await repository();
		const base = await commitFiles(path, { "base.txt": "base\n" }, "base");
		await mustGit(path, ["checkout", "-b", "theirs", base]);
		const theirs = await commitFiles(
			path,
			{ "theirs.txt": "theirs\n" },
			"theirs",
		);
		await mustGit(path, ["checkout", "main"]);
		const ours = await commitFiles(path, { "ours.txt": "ours\n" }, "ours");
		const oursTree = (await mustGit(path, ["rev-parse", `${ours}^{tree}`]))
			.toString("utf8")
			.trim();
		const merge = await commitTree(
			path,
			oursTree,
			[ours, theirs],
			"custom driver candidate",
		);
		await mustGit(path, ["update-ref", "refs/heads/custom-driver", merge]);
		await mustGit(path, ["config", "merge.hostile.driver", "false"]);
		const wrapperDirectory = await mkdtemp(
			join(tmpdir(), "semantic-merge-git-wrapper-"),
		);
		temporaryPaths.push(wrapperDirectory);
		const wrapper = join(wrapperDirectory, "git");
		await writeFile(
			wrapper,
			`#!/bin/sh\nif [ "$1" = merge-tree ]; then echo merge-tree-forbidden >&2; exit 97; fi\nexec /usr/bin/git "$@"\n`,
			{ mode: 0o755 },
		);
		const handle = await open(path);
		const candidate = await candidateFor(handle, merge, { gitBinary: wrapper });

		const result = await replayCandidate(
			handle,
			candidate,
			await currentGitVersion(),
			{ gitBinary: wrapper },
		);

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.replayStatus).toBe("unsupported-custom-driver");
		expect(result.value.automaticTreeOid).toBeNull();
	});

	test("treats an empty parent diff as an empty changed-path intersection", async () => {
		const path = await repository();
		const base = await commitFiles(path, { "base.txt": "base\n" }, "base");
		const child = await commitFiles(path, { "child.txt": "child\n" }, "child");
		const childTree = (await mustGit(path, ["rev-parse", `${child}^{tree}`]))
			.toString("utf8")
			.trim();
		const merge = await commitTree(
			path,
			childTree,
			[base, child],
			"ancestor parent candidate",
		);
		await mustGit(path, ["update-ref", "refs/heads/ancestor-parent", merge]);
		const handle = await open(path);
		const candidate = await candidateFor(handle, merge);

		const result = await replay(handle, candidate);

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.changedPathIntersection).toEqual([]);
		expect(result.value.replayStatus).toBe("clean");
	});

	test("replays file-directory conflict without exact path overlap", async () => {
		const path = await repository();
		const base = await commitFiles(path, { "base.txt": "base\n" }, "base");
		await mustGit(path, ["checkout", "-b", "theirs", base]);
		const theirs = await commitFiles(
			path,
			{ "node/child.txt": "child\n" },
			"add directory",
		);
		await mustGit(path, ["checkout", "main"]);
		await commitFiles(path, { node: "file\n" }, "add file");
		const oursTree = (await mustGit(path, ["rev-parse", "HEAD^{tree}"]))
			.toString("utf8")
			.trim();
		const ours = (await mustGit(path, ["rev-parse", "HEAD"]))
			.toString("utf8")
			.trim();
		const merge = await commitTree(
			path,
			oursTree,
			[ours, theirs],
			"file directory merge record",
		);
		await mustGit(path, ["update-ref", "refs/heads/file-directory", merge]);
		const handle = await open(path);
		const candidate = await candidateFor(handle, merge);

		const result = await replay(handle, candidate);

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.mergeBases).toEqual([base]);
		expect(result.value.changedPathIntersection).toEqual([]);
		expect(result.value.replayStatus).toBe("conflicted");
		expect(
			result.value.informationalMessages.some((entry) =>
				entry.kind.includes("CONFLICT"),
			),
		).toBe(true);
	});

	test("uses Git virtual base for criss-cross histories", async () => {
		const path = await repository();
		const root = await commitFiles(path, { "shared.txt": "root\n" }, "root");
		await mustGit(path, ["checkout", "-b", "side-a", root]);
		const sideA = await commitFiles(path, { "shared.txt": "A\n" }, "side A");
		const treeA = (await mustGit(path, ["rev-parse", `${sideA}^{tree}`]))
			.toString("utf8")
			.trim();
		await mustGit(path, ["checkout", "-b", "side-b", root]);
		const sideB = await commitFiles(path, { "shared.txt": "B\n" }, "side B");
		const treeB = (await mustGit(path, ["rev-parse", `${sideB}^{tree}`]))
			.toString("utf8")
			.trim();
		const mergeA = await commitTree(
			path,
			treeA,
			[sideA, sideB],
			"criss cross A",
		);
		const mergeB = await commitTree(
			path,
			treeB,
			[sideB, sideA],
			"criss cross B",
		);
		const expectedBases = (
			await mustGit(path, ["merge-base", "--all", mergeA, mergeB])
		)
			.toString("utf8")
			.trim()
			.split("\n");
		expect(expectedBases).toHaveLength(2);
		expect(new Set(expectedBases)).toEqual(new Set([sideA, sideB]));
		const final = await commitTree(
			path,
			treeA,
			[mergeA, mergeB],
			"criss cross candidate",
		);
		await mustGit(path, ["update-ref", "refs/heads/criss-cross", final]);
		const wrapperDirectory = await mkdtemp(
			join(tmpdir(), "semantic-merge-git-wrapper-"),
		);
		temporaryPaths.push(wrapperDirectory);
		const wrapper = join(wrapperDirectory, "git");
		await writeFile(
			wrapper,
			`#!/bin/sh\ncase " $* " in *" --merge-base "*|*" --merge-base="*) echo explicit-base-forbidden >&2; exit 97;; esac\nexec /usr/bin/git "$@"\n`,
			{ mode: 0o755 },
		);
		const handle = await open(path);
		const candidate = await candidateFor(handle, final, { gitBinary: wrapper });

		const result = await replayCandidate(
			handle,
			candidate,
			await currentGitVersion(),
			{ gitBinary: wrapper },
		);

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.baseTopology).toBe("multiple");
		expect(result.value.mergeBases).toEqual(expectedBases);
		expect(
			result.value.baseReachabilityCounts.map(({ baseSha }) => baseSha),
		).toEqual(expectedBases);
		expect(["clean", "conflicted"]).toContain(result.value.replayStatus);
		expect(result.value.automaticTreeOid).toMatch(/^[a-f0-9]{40,64}$/);
	});
});

describe("parseMergeTreeOutput", () => {
	test("fails closed on malformed NUL output", () => {
		const result = parseMergeTreeOutput(
			Buffer.from("not-an-object-id\0unexpected\0", "utf8"),
			1,
		);

		expect(result).toMatchObject({
			ok: false,
			error: { kind: "parse", operation: "parse merge-tree output" },
		});
	});

	test("rejects a conflict exit without conflict stages or messages", () => {
		const tree = "a".repeat(40);
		const output = Buffer.from(
			[
				tree,
				"",
				"1",
				"shared.txt",
				"Auto-merging",
				"Auto-merging shared.txt\n",
			].join("\0") + "\0",
			"utf8",
		);

		const result = parseMergeTreeOutput(output, 1);

		expect(result).toMatchObject({
			ok: false,
			error: { kind: "parse", operation: "parse merge-tree output" },
		});
	});
});
