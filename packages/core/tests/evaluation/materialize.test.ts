import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";

import { remoteMirrorLocation } from "../../src/evaluation/acquire.js";
import { classifyLocalizedRegion } from "../../src/evaluation/classify.js";
import { runGit } from "../../src/evaluation/git.js";
import { materializeCorpusFile } from "../../src/evaluation/materialize.js";
import type {
	CorpusRecordV2,
	ExactConflictRegionRecord,
} from "../../src/evaluation/types.js";
import { commitFiles, createRepository } from "./git-fixture.js";

const temporaryDirectories: string[] = [];

function objectId(index: number): string {
	return index.toString(16).padStart(40, "0");
}

const BASELINE_ID = "a".repeat(64);
const automaticBlob = Buffer.from(
	"auto-merged outside\n<<<<<<< ours\nours\n||||||| base\nbase\n=======\ntheirs\n>>>>>>> theirs\nafter\n",
);
const shippedBlob = Buffer.from("auto-merged outside\nours\nafter\n");

async function temporaryDirectory(): Promise<string> {
	const path = await mkdtemp(join(tmpdir(), "semantic-merge-materialize-"));
	temporaryDirectories.push(path);
	return path;
}

async function gitText(
	repositoryPath: string,
	args: readonly string[],
): Promise<string> {
	const result = await runGit(repositoryPath, args);
	if (!result.ok)
		throw new Error(`${result.error.operation}: ${result.error.message}`);
	return result.value.stdoutText().trim();
}

async function materializationRecord(deleted = false): Promise<CorpusRecordV2> {
	const repositoryPath = await createRepository();
	temporaryDirectories.push(repositoryPath);
	await commitFiles(
		repositoryPath,
		{ "file.txt": automaticBlob },
		"automatic tree",
	);
	const automaticTreeOid = await gitText(repositoryPath, [
		"rev-parse",
		"HEAD^{tree}",
	]);
	const mergeSha = await commitFiles(
		repositoryPath,
		{ "file.txt": deleted ? null : shippedBlob },
		"shipped merge",
	);
	const resolution = deleted ? Buffer.alloc(0) : Buffer.from("ours\n");
	const resolutionRange = deleted
		? { startLine: 2, endLineExclusive: 2 }
		: { startLine: 2, endLineExclusive: 3 };
	const region = classifyLocalizedRegion(
		{
			path: "file.txt",
			ordinal: 1,
			category: "other",
			conflictKind: "CONFLICT (content)",
			stageOids: {
				base: objectId(1),
				ours: objectId(2),
				theirs: objectId(3),
			},
		},
		{
			ours: { startLine: 3, endLineExclusive: 4 },
			base: { startLine: 5, endLineExclusive: 6 },
			theirs: { startLine: 7, endLineExclusive: 8 },
		},
		resolutionRange,
		{
			base: Buffer.from("base\n"),
			ours: Buffer.from("ours\n"),
			theirs: Buffer.from("theirs\n"),
			resolution,
		},
	);
	const repositoryId = repositoryPath;
	return {
		schemaVersion: 2,
		repository: {
			kind: "local",
			id: repositoryId,
			absolutePath: repositoryPath,
		},
		merge: {
			repositoryId,
			sha: mergeSha,
			parents: [objectId(4), objectId(5)],
			authorDate: "2026-08-25T00:00:00Z",
			subject: "shipped merge",
		},
		baselineId: BASELINE_ID,
		replayProvenance: {
			gitVersion: "git version 2.51.0",
			algorithm: "merge-tree-write-tree",
			strategy: "ort",
			environmentPolicy: "isolated-v1",
			normalizationVersion: "v1",
			parentAttributes: { ours: null, theirs: null },
			repoMergeConfigHash: null,
		},
		mergeBases: [objectId(6)],
		baseTopology: "single",
		baseReachabilityCounts: [
			{ baseSha: objectId(6), oursExclusiveCommits: 2, theirsExclusiveCommits: 3 },
		],
		changedPathIntersection: ["file.txt"],
		replayStatus: "conflicted",
		automaticTreeOid,
		conflictPaths: ["file.txt"],
		conflictRegions: [region],
	};
}

async function writeCorpus(
	directory: string,
	records: readonly CorpusRecordV2[],
): Promise<string> {
	const path = join(directory, "corpus.jsonl");
	await writeFile(
		path,
		`${records.map((record) => JSON.stringify(record)).join("\n")}\n`,
	);
	return path;
}

afterEach(async () => {
	await Promise.all(
		temporaryDirectories
			.splice(0)
			.map((path) => rm(path, { recursive: true, force: true })),
	);
});

describe("digest-verified localized materialization", () => {
	it("emits only source-bearing region spans and single-base reachability", async () => {
		const directory = await temporaryDirectory();
		const corpusPath = await writeCorpus(directory, [
			await materializationRecord(),
		]);
		const outputPath = join(directory, "materialized.jsonl");
		const result = await materializeCorpusFile(corpusPath, outputPath);
		expect(result).toEqual({ ok: true, value: 1 });
		const line = JSON.parse((await readFile(outputPath, "utf8")).trim());
		expect(line).toMatchObject({
			base: "base\n",
			ours: "ours\n",
			theirs: "theirs\n",
			resolution: "ours\n",
			category: "other",
			baseline_id: BASELINE_ID,
			path: "file.txt",
			ordinal: 1,
			base_reachability: {
				base_sha: objectId(6),
				ours_exclusive_commits: 2,
				theirs_exclusive_commits: 3,
			},
		});
		expect(JSON.stringify(line)).not.toContain("auto-merged outside");
	});

	it("preserves absent-stage null while verifying an empty add/add base slice", async () => {
		const directory = await temporaryDirectory();
		const value = await materializationRecord();
		value.conflictRegions = [
			classifyLocalizedRegion(
				{
					path: "file.txt",
					ordinal: 1,
					category: "other",
					conflictKind: "CONFLICT (add/add)",
					stageOids: { base: null, ours: objectId(2), theirs: objectId(3) },
				},
				{
					ours: { startLine: 3, endLineExclusive: 4 },
					base: { startLine: 5, endLineExclusive: 5 },
					theirs: { startLine: 7, endLineExclusive: 8 },
				},
				{ startLine: 2, endLineExclusive: 3 },
				{
					base: Buffer.alloc(0),
					ours: Buffer.from("ours\n"),
					theirs: Buffer.from("theirs\n"),
					resolution: Buffer.from("ours\n"),
				},
			),
		];
		const corpusPath = await writeCorpus(directory, [value]);
		const outputPath = join(directory, "add-add.jsonl");
		expect(await materializeCorpusFile(corpusPath, outputPath)).toEqual({
			ok: true,
			value: 1,
		});
		const line = JSON.parse((await readFile(outputPath, "utf8")).trim());
		expect(line.base).toBeNull();
		expect(line.ours).toBe("ours\n");
		expect(line.theirs).toBe("theirs\n");
	});


	it("omits reachability for multiple-base records", async () => {
		const directory = await temporaryDirectory();
		const value = await materializationRecord();
		value.baseTopology = "multiple";
		value.mergeBases = [objectId(7), objectId(8)];
		value.baseReachabilityCounts = [
			{ baseSha: objectId(7), oursExclusiveCommits: 1, theirsExclusiveCommits: 1 },
			{ baseSha: objectId(8), oursExclusiveCommits: 2, theirsExclusiveCommits: 2 },
		];
		value.changedPathIntersection = null;
		const corpusPath = await writeCorpus(directory, [value]);
		const outputPath = join(directory, "materialized.jsonl");
		expect((await materializeCorpusFile(corpusPath, outputPath)).ok).toBe(true);
		const line = JSON.parse((await readFile(outputPath, "utf8")).trim());
		expect(line).not.toHaveProperty("base_reachability");
	});

	it("reopens a validated remote cache child", async () => {
		const directory = await temporaryDirectory();
		const cacheRoot = join(directory, "cache");
		await mkdir(cacheRoot);
		const value = await materializationRecord();
		const location = remoteMirrorLocation("owner/repo", {
			host: "github.com",
			cacheDir: cacheRoot,
		});
		expect(location.ok).toBe(true);
		if (!location.ok) return;
		const clone = await runGit(cacheRoot, [
			"clone",
			"--bare",
			value.repository.kind === "local" ? value.repository.absolutePath : "",
			location.value.absolutePath,
		]);
		expect(clone.ok).toBe(true);
		value.repository = location.value.repository;
		value.merge = {
			...value.merge,
			repositoryId: location.value.repository.id,
		};
		const corpusPath = await writeCorpus(directory, [value]);
		const outputPath = join(directory, "remote.jsonl");
		expect(
			await materializeCorpusFile(corpusPath, outputPath, {
				cacheDir: cacheRoot,
			}),
		).toEqual({ ok: true, value: 1 });
	});

	it("allows an exact verified deletion when the shipped blob is absent", async () => {
		const directory = await temporaryDirectory();
		const corpusPath = await writeCorpus(directory, [
			await materializationRecord(true),
		]);
		const outputPath = join(directory, "deleted.jsonl");
		expect(await materializeCorpusFile(corpusPath, outputPath)).toEqual({
			ok: true,
			value: 1,
		});
		const line = JSON.parse((await readFile(outputPath, "utf8")).trim());
		expect(line.resolution).toBe("");
	});

	it("rejects option-shaped merge and tree revisions before Git or output open", async () => {
		const directory = await temporaryDirectory();
		for (const [name, mutate] of [
			["merge", (value: CorpusRecordV2) => { value.merge.sha = "--upload-pack"; }],
			["tree", (value: CorpusRecordV2) => { value.automaticTreeOid = "--help"; }],
		] as const) {
			const value = await materializationRecord();
			mutate(value);
			const corpusPath = await writeCorpus(directory, [value]);
			const outputPath = join(directory, `${name}-protected.jsonl`);
			await writeFile(outputPath, "existing evaluator output\n");
			const result = await materializeCorpusFile(corpusPath, outputPath);
			expect(result.ok, name).toBe(false);
			if (!result.ok) expect(result.error.kind, name).toBe("corrupt-corpus");
			expect(await readFile(outputPath, "utf8")).toBe(
				"existing evaluator output\n",
			);
		}
	});

	it("fails on unavailable blobs and digest mismatches", async () => {
		const directory = await temporaryDirectory();
		const missing = await materializationRecord();
		missing.merge = { ...missing.merge, sha: "f".repeat(40) };
		const missingPath = await writeCorpus(directory, [missing]);
		const missingResult = await materializeCorpusFile(
			missingPath,
			join(directory, "missing.jsonl"),
		);
		expect(missingResult.ok).toBe(false);
		if (!missingResult.ok) expect(missingResult.error.kind).toBe("not-found");

		const missingRevisionDeletion = await materializationRecord(true);
		missingRevisionDeletion.merge = {
			...missingRevisionDeletion.merge,
			sha: "e".repeat(40),
		};
		const missingRevisionPath = join(directory, "missing-revision-corpus.jsonl");
		await writeFile(
			missingRevisionPath,
			`${JSON.stringify(missingRevisionDeletion)}\n`,
		);
		const protectedOutput = join(directory, "protected-deletion.jsonl");
		await writeFile(protectedOutput, "existing evaluator output\n");
		const missingRevisionResult = await materializeCorpusFile(
			missingRevisionPath,
			protectedOutput,
		);
		expect(missingRevisionResult.ok).toBe(false);
		if (!missingRevisionResult.ok)
			expect(missingRevisionResult.error.kind).toBe("not-found");
		expect(await readFile(protectedOutput, "utf8")).toBe(
			"existing evaluator output\n",
		);

		const mismatch = await materializationRecord();
		const region = mismatch.conflictRegions[0] as ExactConflictRegionRecord;
		region.rawDigests.ours = "0".repeat(64);
		const mismatchPath = join(directory, "mismatch-corpus.jsonl");
		await writeFile(mismatchPath, `${JSON.stringify(mismatch)}\n`);
		const mismatchOutput = join(directory, "mismatch.jsonl");
		await writeFile(mismatchOutput, "existing evaluator output\n");
		const mismatchResult = await materializeCorpusFile(
			mismatchPath,
			mismatchOutput,
		);
		expect(mismatchResult.ok).toBe(false);
		if (!mismatchResult.ok)
			expect(mismatchResult.error.message).toContain("digest mismatch");
		expect(await readFile(mismatchOutput, "utf8")).toBe(
			"existing evaluator output\n",
		);
	});

	it("rejects identical normalized input and output paths before truncation", async () => {
		const directory = await temporaryDirectory();
		const corpusPath = await writeCorpus(directory, [
			await materializationRecord(),
		]);
		const before = await readFile(corpusPath, "utf8");
		const result = await materializeCorpusFile(
			corpusPath,
			join(directory, ".", "corpus.jsonl"),
		);
		expect(result.ok).toBe(false);
		expect(await readFile(corpusPath, "utf8")).toBe(before);
	});
});
