import { mkdtemp, open, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";

import {
	CorpusWriter,
	loadResumeKeys,
	parseCorpusRecord,
	readCorpus,
	resumeKey,
} from "../../src/evaluation/corpus.js";
import type { Result } from "../../src/evaluation/result.js";
import { boundedPool } from "../../src/evaluation/pool.js";
import type { CorpusRecordV2 } from "../../src/evaluation/types.js";

const temporaryDirectories: string[] = [];

function objectId(index: number): string {
	return index.toString(16).padStart(40, "0");
}

const BASELINE_A = "a".repeat(64);
const BASELINE_B = "b".repeat(64);

async function temporaryDirectory(): Promise<string> {
	const path = await mkdtemp(join(tmpdir(), "semantic-merge-corpus-"));
	temporaryDirectories.push(path);
	return path;
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
			sha: objectId(1),
			parents: [objectId(2), objectId(3)],
			authorDate: "2026-08-25T00:00:00Z",
			subject: "fixture merge",
		},
		baselineId: BASELINE_A,
		replayProvenance: {
			gitVersion: "git version 2.51.0",
			algorithm: "merge-tree-write-tree",
			strategy: "ort",
			environmentPolicy: "isolated-v1",
			normalizationVersion: "v1",
			parentAttributes: { ours: null, theirs: null },
			repoMergeConfigHash: null,
		},
		mergeBases: [objectId(4)],
		baseTopology: "single",
		baseReachabilityCounts: [
			{ baseSha: objectId(4), oursExclusiveCommits: 1, theirsExclusiveCommits: 1 },
		],
		changedPathIntersection: ["src/file.ts"],
		replayStatus: "clean",
		automaticTreeOid: objectId(5),
		conflictPaths: [],
		conflictRegions: [],
		...overrides,
	};
}

function exactRegionRecord(): CorpusRecordV2 {
	const digest = "a".repeat(64);
	const counts = { lines: 1, bytes: 4 };
	return record({
		replayStatus: "conflicted",
		conflictPaths: ["src/file.ts"],
		conflictRegions: [
			{
				path: "src/file.ts",
				ordinal: 1,
				category: "other",
				conflictKind: "CONFLICT (content)",
				stageOids: {
					base: objectId(6),
					ours: objectId(7),
					theirs: objectId(8),
				},
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
					resolution: digest,
				},
				rawCounts: {
					base: counts,
					ours: counts,
					theirs: counts,
					resolution: counts,
				},
				resolutionClass: "ours",
				novelAfterNormalization: false,
				tripleKey: digest,
			},
		],
	});
}

function invalidUtf8Record(): Buffer {
	const value = record({
		merge: { ...record().merge, subject: "INVALID-UTF8" },
	});
	const bytes = Buffer.from(JSON.stringify(value));
	const marker = bytes.indexOf(Buffer.from("INVALID-UTF8"));
	if (marker < 0) throw new Error("invalid UTF-8 fixture marker is missing");
	bytes[marker] = 0xc3;
	bytes[marker + 1] = 0x28;
	return bytes;
}

afterEach(async () => {
	await Promise.all(
		temporaryDirectories
			.splice(0)
			.map((path) => rm(path, { recursive: true, force: true })),
	);
});

describe("schema-v2 corpus validation", () => {
	it("manually accepts a complete nested record", () => {
		const parsed = parseCorpusRecord(exactRegionRecord());
		expect(parsed).toEqual({ ok: true, value: exactRegionRecord() });
	});

	it("explicitly rejects schema v1", () => {
		const parsed = parseCorpusRecord({ ...record(), schemaVersion: 1 });
		expect(parsed.ok).toBe(false);
		if (!parsed.ok) {
			expect(parsed.error.kind).toBe("corrupt-corpus");
			expect(parsed.error.message).toContain("schemaVersion");
		}
	});

	it.each([
		[
			"two-parent tuple",
			{ ...record(), merge: { ...record().merge, parents: ["one"] } },
		],
		[
			"provenance literal",
			{
				...record(),
				replayProvenance: {
					...record().replayProvenance,
					strategy: "recursive",
				},
			},
		],
		[
			"nested range",
			(() => {
				const value = structuredClone(exactRegionRecord()) as unknown as Record<
					string,
					unknown
				>;
				const regions = value.conflictRegions as Array<Record<string, unknown>>;
				(
					regions[0]?.resolutionRange as Record<string, unknown>
				).endLineExclusive = 0;
				return value;
			})(),
		],
		[
			"nullable inexact evidence",
			(() => {
				const value = structuredClone(exactRegionRecord()) as unknown as Record<
					string,
					unknown
				>;
				const region = (
					value.conflictRegions as Array<Record<string, unknown>>
				)[0];
				if (region !== undefined) {
					region.localizationStatus = "ambiguous";
					region.novelAfterNormalization = true;
					region.tripleKey = null;
					region.resolutionClass = "ambiguous";
				}
				return value;
			})(),
		],
	])("rejects an invalid %s", (_name, value) => {
		const parsed = parseCorpusRecord(value);
		expect(parsed.ok).toBe(false);
		if (!parsed.ok) expect(parsed.error.kind).toBe("corrupt-corpus");
	});

	it("rejects every malformed ObjectId-bearing shape and provenance digest", () => {
		const cases: readonly [
			string,
			(value: CorpusRecordV2) => void,
		][] = [
			["merge sha", (value) => { value.merge.sha = "--upload-pack"; }],
			["merge parents", (value) => { value.merge.parents = ["--help", objectId(3)]; }],
			["parent attribute", (value) => { value.replayProvenance.parentAttributes.ours = "A".repeat(40); }],
			["merge base", (value) => { value.mergeBases = ["../base"]; value.baseReachabilityCounts = [{ ...value.baseReachabilityCounts[0]!, baseSha: "../base" }]; }],
			["reachability base", (value) => { value.baseReachabilityCounts = [{ ...value.baseReachabilityCounts[0]!, baseSha: "--base" }]; }],
			["automatic tree", (value) => { value.automaticTreeOid = "--tree"; }],
			["stage oid", (value) => { value.conflictRegions[0]!.stageOids.base = "--stage"; }],
			["baseline digest", (value) => { value.baselineId = "baseline"; }],
			["merge config digest", (value) => { value.replayProvenance.repoMergeConfigHash = "--config"; }],
		];
		for (const [name, mutate] of cases) {
			const value = structuredClone(exactRegionRecord());
			mutate(value);
			const parsed = parseCorpusRecord(value);
			expect(parsed.ok, name).toBe(false);
			if (!parsed.ok) expect(parsed.error.kind, name).toBe("corrupt-corpus");
		}
	});
});

describe("streaming corpus IO", () => {
	it("serializes concurrent writes as complete JSONL records", async () => {
		const path = join(await temporaryDirectory(), "corpus.jsonl");
		const opened = await CorpusWriter.open(path);
		expect(opened.ok).toBe(true);
		if (!opened.ok) return;
		const records = Array.from({ length: 20 }, (_, index) =>
			record({ merge: { ...record().merge, sha: objectId(100 + index) } }),
		);
		const writes = await Promise.all(
			records.map((value) => opened.value.append(value)),
		);
		expect(writes.every((result) => result.ok)).toBe(true);
		expect((await opened.value.close()).ok).toBe(true);
		const lines = (await readFile(path, "utf8")).trimEnd().split("\n");
		expect(lines).toHaveLength(20);
		expect(lines.map((line) => JSON.parse(line).merge.sha)).toEqual(
			records.map((value) => value.merge.sha),
		);
	});

	it("uses one handle write and rejects a short serialized-record write", async () => {
		const directory = await temporaryDirectory();
		const probe = await open(join(directory, "probe"), "w");
		type HandleWrite = (
			data: string | Uint8Array,
		) => Promise<{ bytesWritten: number; buffer: string | Uint8Array }>;
		const prototype = Object.getPrototypeOf(probe) as { write: HandleWrite };
		const originalWrite = prototype.write;
		await probe.close();
		let writeCalls = 0;
		prototype.write = async (data) => {
			writeCalls += 1;
			return { bytesWritten: 1, buffer: data };
		};
		const path = join(directory, "short-write.jsonl");
		const opened = await CorpusWriter.open(path);
		expect(opened.ok).toBe(true);
		if (!opened.ok) {
			prototype.write = originalWrite;
			return;
		}
		try {
			const appended = await opened.value.append(record());
			expect(appended.ok).toBe(false);
			if (!appended.ok) {
				expect(appended.error.kind).toBe("corrupt-corpus");
				expect(appended.error.message).toContain("complete");
			}
			expect(writeCalls).toBe(1);
		} finally {
			prototype.write = originalWrite;
			await opened.value.close();
		}
	});

	it("latches the first append failure and leaves one recoverable partial tail", async () => {
		const directory = await temporaryDirectory();
		const probe = await open(join(directory, "latch-probe"), "w");
		type HandleWrite = (
			data: string | Uint8Array,
		) => Promise<{ bytesWritten: number; buffer: string | Uint8Array }>;
		const prototype = Object.getPrototypeOf(probe) as { write: HandleWrite };
		const originalWrite = prototype.write;
		await probe.close();
		let writeCalls = 0;
		prototype.write = async function (data) {
			writeCalls += 1;
			if (writeCalls === 1) {
				const partial = Buffer.from(data).subarray(0, 1);
				await originalWrite.call(this, partial);
				return { bytesWritten: partial.length, buffer: data };
			}
			return originalWrite.call(this, data);
		};
		const path = join(directory, "latched.jsonl");
		const opened = await CorpusWriter.open(path);
		expect(opened.ok).toBe(true);
		if (!opened.ok) {
			prototype.write = originalWrite;
			return;
		}
		const firstRecord = record({ merge: { ...record().merge, sha: objectId(30) } });
		const secondRecord = record({ merge: { ...record().merge, sha: objectId(31) } });
		let appendResults: [Result<void>, Result<void>] | undefined;
		try {
			const firstAppend = opened.value.append(firstRecord);
			const secondAppend = opened.value.append(secondRecord);
			appendResults = [await firstAppend, await secondAppend];
		} finally {
			await opened.value.close();
			prototype.write = originalWrite;
		}
		expect(appendResults).toBeDefined();
		if (appendResults === undefined) return;
		const [first, second] = appendResults;
		expect(first.ok).toBe(false);
		expect(second).toEqual(first);
		expect(writeCalls).toBe(1);

		const reopened = await CorpusWriter.open(path);
		expect(reopened.ok).toBe(true);
		if (!reopened.ok) return;
		expect(
			(
				await reopened.value.append(
					record({ merge: { ...record().merge, sha: objectId(32) } }),
				)
			).ok,
		).toBe(true);
		await reopened.value.close();
		const recovered = await readCorpus(path);
		expect(recovered.ok && recovered.value.map((value) => value.merge.sha)).toEqual([
			objectId(32),
		]);
	});

	it("accepts a valid final record without a newline", async () => {
		const path = join(await temporaryDirectory(), "corpus.jsonl");
		await writeFile(path, JSON.stringify(record()));
		const read = await readCorpus(path);
		expect(read.ok && read.value).toHaveLength(1);
	});

	it("recovers a malformed non-newline final fragment", async () => {
		const path = join(await temporaryDirectory(), "corpus.jsonl");
		await writeFile(path, `${JSON.stringify(record())}\n{"schemaVersion":2`);
		const read = await readCorpus(path);
		expect(read.ok && read.value).toHaveLength(1);
	});

	it("rejects newline-terminated invalid UTF-8 with its line number", async () => {
		const path = join(await temporaryDirectory(), "invalid-utf8-interior.jsonl");
		await writeFile(
			path,
			Buffer.concat([
				Buffer.from(`${JSON.stringify(record())}\n`),
				invalidUtf8Record(),
				Buffer.from("\n"),
			]),
		);
		const read = await readCorpus(path);
		expect(read.ok).toBe(false);
		if (!read.ok) {
			expect(read.error.kind).toBe("corrupt-corpus");
			expect(read.error.details).toMatchObject({ line: 2 });
		}
	});

	it("recovers an invalid UTF-8 final non-newline tail", async () => {
		const path = join(await temporaryDirectory(), "invalid-utf8-tail.jsonl");
		await writeFile(
			path,
			Buffer.concat([
				Buffer.from(`${JSON.stringify(record())}\n`),
				invalidUtf8Record(),
			]),
		);
		const read = await readCorpus(path);
		expect(read.ok && read.value.map((value) => value.merge.sha)).toEqual([
			objectId(1),
		]);
	});

	it("repairs an interrupted tail and separates a valid no-newline tail before appending", async () => {
		for (const [name, initial] of [
			["interrupted", `${JSON.stringify(record())}\n{"schemaVersion":2`],
			["valid", JSON.stringify(record())],
		] as const) {
			const path = join(await temporaryDirectory(), `${name}.jsonl`);
			await writeFile(path, initial);
			const opened = await CorpusWriter.open(path);
			expect(opened.ok).toBe(true);
			if (!opened.ok) continue;
			expect(
				(
					await opened.value.append(
						record({ merge: { ...record().merge, sha: objectId(33) } }),
					)
				).ok,
			).toBe(true);
			expect((await opened.value.close()).ok).toBe(true);
			const read = await readCorpus(path);
			expect(read.ok && read.value.map((value) => value.merge.sha)).toEqual([
				objectId(1),
				objectId(33),
			]);
		}
	});

	it("rejects malformed newline-terminated interior content with its line number", async () => {
		const path = join(await temporaryDirectory(), "corpus.jsonl");
		await writeFile(
			path,
			`${JSON.stringify(record())}\nnot-json\n${JSON.stringify(record({ merge: { ...record().merge, sha: objectId(34) } }))}`,
		);
		const read = await readCorpus(path);
		expect(read.ok).toBe(false);
		if (!read.ok) expect(read.error.details).toMatchObject({ line: 2 });
	});

	it("uses repository, merge, and baseline as the exact resume identity", async () => {
		const path = join(await temporaryDirectory(), "corpus.jsonl");
		await writeFile(path, `${JSON.stringify(record())}\n`);
		const loaded = await loadResumeKeys(path);
		expect(loaded.ok).toBe(true);
		if (!loaded.ok) return;
		expect(loaded.value.has(resumeKey(record()))).toBe(true);
		expect(
			loaded.value.has(resumeKey(record({ baselineId: BASELINE_B }))),
		).toBe(false);
		expect(
			loaded.value.has(
				resumeKey(record({ merge: { ...record().merge, sha: objectId(35) } })),
			),
		).toBe(false);
	});
});

describe("bounded worker pool", () => {
	it("bounds concurrency, preserves input order, and captures worker rejection", async () => {
		let active = 0;
		let maximumActive = 0;
		const outcomes = await boundedPool([1, 2, 3, 4, 5], 2, async (value) => {
			active += 1;
			maximumActive = Math.max(maximumActive, active);
			await Promise.resolve();
			active -= 1;
			if (value === 3) throw new Error("expected worker failure");
			return value * 10;
		});
		expect(maximumActive).toBe(2);
		expect(
			outcomes.map((outcome) =>
				outcome.ok ? outcome.value : outcome.error.message,
			),
		).toEqual([10, 20, "Bounded pool worker rejected", 40, 50]);
	});

	it("does not serialize rejected worker exception text", async () => {
		const secretMarker = "https://token@example.invalid/private";
		const outcomes = await boundedPool([1], 1, async () => {
			throw new Error(secretMarker);
		});
		expect(JSON.stringify(outcomes)).not.toContain(secretMarker);
	});

	it("returns invalid concurrency as a structured value", async () => {
		const outcomes = await boundedPool([1], 0, async (value) => value);
		expect(outcomes).toEqual([
			{
				ok: false,
				error: {
					kind: "config",
					operation: "bounded pool",
					message: "Concurrency must be an integer from 1 to 32",
					details: { concurrency: 0 },
				},
			},
		]);
	});
});
