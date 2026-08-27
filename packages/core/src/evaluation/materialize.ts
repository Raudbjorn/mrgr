import { createHash } from "node:crypto";
import { open, stat, type FileHandle } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";

import {
	DEFAULT_MIRROR_CACHE_DIR,
	OBJECT_GIT_TIMEOUT_MS,
	ensureRemoteMirror,
	openLocalRepository,
	remoteMirrorLocation,
	type RepositoryHandle,
} from "./acquire.js";
import { normalizeV1, resolutionDigest, tripleKey } from "./classify.js";
import { readCorpus } from "./corpus.js";
import { runGit } from "./git.js";
import { selectBaseline } from "./report.js";
import { err, ok, type Result } from "./result.js";
import type {
	CorpusRecordV2,
	ExactConflictRegionRecord,
	LineRange,
	RawSpanCounts,
	RegionDigests,
	RepositoryRef,
} from "./types.js";

export interface MaterializeOptions {
	baseline?: string;
	cacheDir?: string;
	gitBinary?: string;
}

interface MaterializedRegion {
	base: string | null;
	ours: string | null;
	theirs: string | null;
	resolution: string;
	category: ExactConflictRegionRecord["category"];
	repository_id: string;
	merge_sha: string;
	baseline_id: string;
	path: string;
	ordinal: number;
	triple_key: string;
	resolution_digest: string;
	base_reachability?: {
		base_sha: string;
		ours_exclusive_commits: number;
		theirs_exclusive_commits: number;
	};
}

function samePath(left: string, right: string): boolean {
	return resolve(left) === resolve(right);
}

async function reopenRepository(
	repository: RepositoryRef,
	options: MaterializeOptions,
): Promise<Result<RepositoryHandle>> {
	if (repository.kind === "local")
		return openLocalRepository(repository.absolutePath, {
			gitBinary: options.gitBinary,
		});
	const cacheDir = resolve(options.cacheDir ?? DEFAULT_MIRROR_CACHE_DIR);
	const location = remoteMirrorLocation(repository.slug, {
		host: repository.host,
		cacheDir,
	});
	if (!location.ok) return location;
	if (location.value.cacheKey !== repository.cacheKey) {
		return err(
			"corrupt-corpus",
			"reopen materialization repository",
			"Remote cache key does not match repository identity",
			{
				repositoryId: repository.id,
			},
		);
	}
	const child = resolve(cacheDir, repository.cacheKey);
	const childRelative = relative(cacheDir, child);
	if (
		childRelative.length === 0 ||
		childRelative.startsWith("..") ||
		isAbsolute(childRelative)
	) {
		return err(
			"corrupt-corpus",
			"reopen materialization repository",
			"Remote cache key escapes the selected cache root",
			{
				repositoryId: repository.id,
			},
		);
	}
	try {
		const metadata = await stat(child);
		if (!metadata.isDirectory())
			return err(
				"not-found",
				"reopen materialization repository",
				"Remote mirror cache entry is not a directory",
				{ repositoryId: repository.id },
			);
	} catch (cause) {
		const code =
			typeof cause === "object" &&
			cause !== null &&
			"code" in cause &&
			typeof cause.code === "string"
				? cause.code
				: null;
		return err(
			"not-found",
			"reopen materialization repository",
			"Remote mirror cache entry is unavailable",
			{ repositoryId: repository.id, code },
		);
	}
	return ensureRemoteMirror(repository.slug, {
		host: repository.host,
		cacheDir,
		gitBinary: options.gitBinary,
	});
}

async function readBlob(
	repository: RepositoryHandle,
	revision: string,
	path: string,
	gitBinary?: string,
): Promise<Result<Buffer | null>> {
	const output = await runGit(
		repository.gitPath,
		["show", "--end-of-options", `${revision}:${path}`],
		{
			acceptedExitCodes: [0, 128],
			gitBinary,
			timeoutMs: OBJECT_GIT_TIMEOUT_MS,
		},
	);
	if (!output.ok) return output;
	if (output.value.exitCode === 0) return ok(output.value.stdout);
	const revisionTree = await runGit(
		repository.gitPath,
		["rev-parse", "--verify", "--end-of-options", `${revision}^{tree}`],
		{
			acceptedExitCodes: [0, 128],
			gitBinary,
			timeoutMs: OBJECT_GIT_TIMEOUT_MS,
		},
	);
	if (!revisionTree.ok) return revisionTree;
	if (revisionTree.value.exitCode === 128) {
		return err("not-found", "read materialization blob", "Referenced revision is unavailable", {
			revision,
			path,
		});
	}
	return ok(null);
}

function splitLines(blob: Buffer): Buffer[] {
	const lines: Buffer[] = [];
	let start = 0;
	for (let index = 0; index < blob.length; index += 1) {
		if (blob[index] !== 0x0a) continue;
		lines.push(blob.subarray(start, index + 1));
		start = index + 1;
	}
	if (start < blob.length) lines.push(blob.subarray(start));
	return lines;
}

function sliceRange(
	blob: Buffer,
	range: LineRange,
	field: string,
): Result<Buffer> {
	const lines = splitLines(blob);
	const start = range.startLine - 1;
	const end = range.endLineExclusive - 1;
	if (start < 0 || end < start || start > lines.length || end > lines.length) {
		return err(
			"corrupt-corpus",
			"materialize region",
			"Stored line range is outside the referenced blob",
			{
				field,
				startLine: range.startLine,
				endLineExclusive: range.endLineExclusive,
				availableLines: lines.length,
			},
		);
	}
	return ok(Buffer.concat(lines.slice(start, end)));
}

function rawCounts(content: Buffer): RawSpanCounts {
	if (content.length === 0) return { lines: 0, bytes: 0 };
	let lines = 0;
	for (const byte of content) if (byte === 0x0a) lines += 1;
	if (content[content.length - 1] !== 0x0a) lines += 1;
	return { lines, bytes: content.length };
}

function rawDigest(content: Buffer): string {
	return createHash("sha256").update(content).digest("hex");
}

function normalizedDigest(content: Buffer): string {
	return rawDigest(Buffer.from(normalizeV1(content)));
}

function verifyDigestSet(
	region: ExactConflictRegionRecord,
	contents: RegionDigests<Buffer>,
): Result<void> {
	const fields: readonly (keyof RegionDigests<Buffer>)[] = [
		"base",
		"ours",
		"theirs",
		"resolution",
	];
	for (const field of fields) {
		const raw = rawDigest(contents[field]);
		if (raw !== region.rawDigests[field])
			return err(
				"corrupt-corpus",
				"materialize region",
				"Stored raw digest mismatch",
				{ path: region.path, ordinal: region.ordinal, field },
			);
		const normalized = normalizedDigest(contents[field]);
		if (normalized !== region.normalizedDigests[field])
			return err(
				"corrupt-corpus",
				"materialize region",
				"Stored normalized digest mismatch",
				{ path: region.path, ordinal: region.ordinal, field },
			);
		const counts = rawCounts(contents[field]);
		if (
			counts.lines !== region.rawCounts[field].lines ||
			counts.bytes !== region.rawCounts[field].bytes
		) {
			return err(
				"corrupt-corpus",
				"materialize region",
				"Stored raw span counts mismatch",
				{ path: region.path, ordinal: region.ordinal, field },
			);
		}
	}
	const expectedTriple = tripleKey(
		region.stageOids.base === null ? null : contents.base,
		region.stageOids.ours === null ? null : contents.ours,
		region.stageOids.theirs === null ? null : contents.theirs,
	);
	if (expectedTriple !== region.tripleKey)
		return err(
			"corrupt-corpus",
			"materialize region",
			"Stored triple key mismatch",
			{ path: region.path, ordinal: region.ordinal },
		);
	if (
		resolutionDigest(contents.resolution) !==
		region.normalizedDigests.resolution
	) {
		return err(
			"corrupt-corpus",
			"materialize region",
			"Stored resolution digest mismatch",
			{ path: region.path, ordinal: region.ordinal },
		);
	}
	return ok(undefined);
}

async function materializeRegion(
	repository: RepositoryHandle,
	record: CorpusRecordV2,
	region: ExactConflictRegionRecord,
	options: MaterializeOptions,
): Promise<Result<MaterializedRegion>> {
	if (record.automaticTreeOid === null)
		return err(
			"corrupt-corpus",
			"materialize region",
			"Exact region record has no automatic tree OID",
			{ path: region.path, ordinal: region.ordinal },
		);
	const automatic = await readBlob(
		repository,
		record.automaticTreeOid,
		region.path,
		options.gitBinary,
	);
	if (!automatic.ok) return automatic;
	if (automatic.value === null)
		return err(
			"not-found",
			"materialize region",
			"Automatic replay blob is unavailable",
			{ path: region.path, automaticTreeOid: record.automaticTreeOid },
		);
	const shipped = await readBlob(
		repository,
		record.merge.sha,
		region.path,
		options.gitBinary,
	);
	if (!shipped.ok) return shipped;
	const shippedMissing = shipped.value === null;
	let shippedBlob = shipped.value;
	if (shippedBlob === null) {
		const validDeletion =
			region.resolutionClass === "deleted" &&
			region.resolutionRange.startLine ===
				region.resolutionRange.endLineExclusive;
		if (!validDeletion)
			return err(
				"not-found",
				"materialize region",
				"Shipped merge blob is unavailable",
				{ path: region.path, mergeSha: record.merge.sha },
			);
		shippedBlob = Buffer.alloc(0);
	}
	const base = sliceRange(automatic.value, region.automaticRanges.base, "base");
	if (!base.ok) return base;
	const ours = sliceRange(automatic.value, region.automaticRanges.ours, "ours");
	if (!ours.ok) return ours;
	const theirs = sliceRange(
		automatic.value,
		region.automaticRanges.theirs,
		"theirs",
	);
	if (!theirs.ok) return theirs;
	const resolution = shippedMissing
		? ok(Buffer.alloc(0))
		: sliceRange(shippedBlob, region.resolutionRange, "resolution");
	if (!resolution.ok) return resolution;
	const contents = {
		base: base.value,
		ours: ours.value,
		theirs: theirs.value,
		resolution: resolution.value,
	};
	const verified = verifyDigestSet(region, contents);
	if (!verified.ok) return verified;
	const materialized: MaterializedRegion = {
		base: region.stageOids.base === null ? null : contents.base.toString("utf8"),
		ours: region.stageOids.ours === null ? null : contents.ours.toString("utf8"),
		theirs: region.stageOids.theirs === null ? null : contents.theirs.toString("utf8"),
		resolution: contents.resolution.toString("utf8"),
		category: region.category,
		repository_id: record.repository.id,
		merge_sha: record.merge.sha,
		baseline_id: record.baselineId,
		path: region.path,
		ordinal: region.ordinal,
		triple_key: region.tripleKey,
		resolution_digest: region.normalizedDigests.resolution,
	};
	if (record.baseTopology === "single") {
		const count = record.baseReachabilityCounts[0];
		if (count === undefined)
			return err(
				"corrupt-corpus",
				"materialize region",
				"Single-base record has no reachability count",
				{ mergeSha: record.merge.sha },
			);
		materialized.base_reachability = {
			base_sha: count.baseSha,
			ours_exclusive_commits: count.oursExclusiveCommits,
			theirs_exclusive_commits: count.theirsExclusiveCommits,
		};
	}
	return ok(materialized);
}

async function closeOutput(
	handle: FileHandle,
	outputPath: string,
): Promise<Result<void>> {
	try {
		await handle.close();
		return ok(undefined);
	} catch (cause) {
		const code =
			typeof cause === "object" &&
			cause !== null &&
			"code" in cause &&
			typeof cause.code === "string"
				? cause.code
				: null;
		return err(
			"config",
			"close materialized corpus",
			"Unable to close materialized output",
			{ outputPath, code },
		);
	}
}

export async function materializeCorpusFile(
	corpusPath: string,
	outputPath: string,
	options: MaterializeOptions = {},
): Promise<Result<number>> {
	if (samePath(corpusPath, outputPath))
		return err(
			"config",
			"materialize corpus",
			"Input and output paths must differ",
			{ input: resolve(corpusPath), output: resolve(outputPath) },
		);
	const corpus = await readCorpus(corpusPath);
	if (!corpus.ok) return corpus;
	const selection = selectBaseline(corpus.value, options.baseline);
	if (!selection.ok) return selection;
	const repositories = new Map<string, RepositoryHandle>();
	const verifiedLines: string[] = [];
	for (const record of selection.value.records) {
		const exactRegions = record.conflictRegions.filter(
			(region): region is ExactConflictRegionRecord =>
				region.localizationStatus === "exact",
		);
		if (exactRegions.length === 0) continue;
		let repository = repositories.get(record.repository.id);
		if (repository === undefined) {
			const reopened = await reopenRepository(record.repository, options);
			if (!reopened.ok) return reopened;
			repository = reopened.value;
			repositories.set(record.repository.id, repository);
		}
		for (const region of exactRegions) {
			const materialized = await materializeRegion(
				repository,
				record,
				region,
				options,
			);
			if (!materialized.ok) return materialized;
			verifiedLines.push(`${JSON.stringify(materialized.value)}\n`);
		}
	}
	let handle: FileHandle;
	try {
		handle = await open(outputPath, "w");
	} catch (cause) {
		const code =
			typeof cause === "object" &&
			cause !== null &&
			"code" in cause &&
			typeof cause.code === "string"
				? cause.code
				: null;
		return err(
			"config",
			"open materialized corpus",
			"Unable to open materialized output",
			{ outputPath, code },
		);
	}
	for (const line of verifiedLines) {
		try {
			const written = await handle.write(line);
			if (written.bytesWritten !== Buffer.byteLength(line)) {
				await closeOutput(handle, outputPath);
				return err(
					"config",
					"write materialized corpus",
					"Unable to write a complete materialized record",
					{
						outputPath,
						bytesWritten: written.bytesWritten,
						bytesExpected: Buffer.byteLength(line),
					},
				);
			}
		} catch (cause) {
			const code =
				typeof cause === "object" &&
				cause !== null &&
				"code" in cause &&
				typeof cause.code === "string"
					? cause.code
					: null;
			await closeOutput(handle, outputPath);
			return err(
				"config",
				"write materialized corpus",
				"Unable to write materialized output",
				{ outputPath, code },
			);
		}
	}
	const closed = await closeOutput(handle, outputPath);
	if (!closed.ok) return closed;
	return ok(verifiedLines.length);
}
