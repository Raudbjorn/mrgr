import { runGit } from "../evaluation/git.js";
import {
	type DependencyGraphStatus,
	type EvidenceBundle,
	EvidenceBundleSchema,
} from "./evidence.js";
import { err, ok, type Result, type ToolError } from "../evaluation/result.js";

// Matches a single diff3 conflict region. Used with the global flag to
// enumerate every region in a conflicted blob.
const diff3RegionRegex = /<<<<<<<[^\n]*\n[\s\S]*?>>>>>>>[^\n]*\n?/g;

/**
 * Split one diff3 region into its ours/base/theirs sections.
 *
 * Each capture absorbs its own trailing newline rather than requiring a
 * newline before the next marker. An earlier form demanded `(...)\n=======`,
 * which cannot match an EMPTY section: in an add/add conflict Git emits
 *
 *     <<<<<<< ours\nours\n||||||| base\n=======\ntheirs\n>>>>>>> theirs
 *
 * with nothing between `|||||||` and `=======`. That made every add/add
 * conflict silently unparseable, reported as "no diff3 markers found".
 */
const diff3SplitRegex =
	/^<<<<<<<[^\n]*\n([\s\S]*?)\|{7}[^\n]*\n([\s\S]*?)={7}\n([\s\S]*?)>{7}/;

/** Drop the single delimiting newline a section carries, keeping inner ones. */
const stripDelimiter = (section: string): string =>
	section.endsWith("\n") ? section.slice(0, -1) : section;

export interface ExtractOptions {
	/**
	 * Optional byte budget per preimage. Omitted means no limit: the whole
	 * parent-side file is captured.
	 *
	 * Truncation is applied on the UTF-8 byte buffer, not on the JavaScript
	 * string, and never splits a multi-byte character. The recorded
	 * `preimage_*_bytes` remains the ORIGINAL size either way.
	 */
	maxBytes?: number;
}

interface Sized {
	/** Possibly truncated content. */
	content: string;
	/** Byte length of the original, before any truncation. */
	bytes: number;
	truncated: boolean;
}

/**
 * Truncate on a byte budget without splitting a character.
 *
 * The previous implementation used `s.slice(0, 1200)`, which counts UTF-16
 * code units. For any non-ASCII input that is neither a byte count nor a
 * character count, so a field documented in bytes reported something else.
 */
function sizeAndTruncate(stdout: string | Buffer, maxBytes?: number): Sized {
	// Size the ORIGINAL bytes Git produced. Decoding to a string and
	// re-encoding does not round-trip for a blob that is not valid UTF-8, so
	// the recorded size would describe replacement characters, not the file.
	const buffer = Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout, "utf8");
	const bytes = buffer.byteLength;
	const original = buffer.toString("utf8");
	if (maxBytes === undefined || bytes <= maxBytes) {
		return { content: original, bytes, truncated: false };
	}
	// `toString` on a cut buffer would emit U+FFFD for a split character;
	// walk back to the last whole character instead.
	let end = maxBytes;
	while (end > 0 && (buffer[end]! & 0xc0) === 0x80) end--;
	return { content: buffer.subarray(0, end).toString("utf8"), bytes, truncated: true };
}

const decodeStdout = (stdout: string | Buffer): string =>
	Buffer.isBuffer(stdout) ? stdout.toString("utf-8") : stdout;

function toolError(
	kind: ToolError["kind"],
	operation: string,
	message: string,
	details?: ToolError["details"],
): ToolError {
	return { kind, operation, message, ...(details ? { details } : {}) };
}

/**
 * Does this revision exist and resolve to a commit?
 *
 * `git show <rev>:<path>` exits 128 both when the revision is missing and when
 * the path is absent from an existing revision. Those are different facts — an
 * absent path is ordinary evidence for add/add and delete/modify conflicts,
 * while a missing revision means the caller passed something wrong — so the
 * revision is probed separately rather than inferring from a collapsed status.
 */
async function revisionExists(
	gitPath: string,
	rev: string,
): Promise<Result<boolean>> {
	const probe = await runGit(gitPath, ["cat-file", "-e", `${rev}^{commit}`], {
		acceptedExitCodes: [0, 1, 128],
	});
	if (!probe.ok) return probe;
	return ok(probe.value.exitCode === 0);
}

type PreimageFetch =
	| { ok: true; value: Sized | null }
	| { ok: false; error: ToolError };

/**
 * Fetch one parent's version of the file.
 *
 * Returns `null` when the revision exists but does not contain the path. Any
 * other failure is a typed error.
 */
async function fetchPreimage(
	gitPath: string,
	parent: string,
	path: string,
	options: ExtractOptions,
): Promise<PreimageFetch> {
	const operation = `fetchPreimage(${parent}:${path})`;
	// 0 or 128 only. Git uses 128 for both "no such revision" and "no such
	// path"; any other status is a real failure and must surface as one rather
	// than being folded into "absent".
	const result = await runGit(gitPath, ["show", `${parent}:${path}`], {
		acceptedExitCodes: [0, 128],
	});
	if (!result.ok) {
		return {
			ok: false,
			error: toolError(
				result.error.kind,
				operation,
				result.error.message,
				result.error.details,
			),
		};
	}
	if (result.value.exitCode === 0) {
		return {
			ok: true,
			value: sizeAndTruncate(result.value.stdout, options.maxBytes),
		};
	}

	const exists = await revisionExists(gitPath, parent);
	if (!exists.ok) {
		return {
			ok: false,
			error: toolError(exists.error.kind, operation, exists.error.message, exists.error.details),
		};
	}
	if (!exists.value) {
		return {
			ok: false,
			error: toolError("not-found", operation, "Revision does not exist", {
				parent,
				path,
				exitCode: result.value.exitCode,
			}),
		};
	}
	// The revision is real, so prove the path is genuinely absent rather than
	// assuming it from the 128. Anything but a clean "absent" is operational.
	const pathProbe = await runGit(gitPath, ["cat-file", "-e", `${parent}:${path}`], {
		acceptedExitCodes: [0, 128],
	});
	if (!pathProbe.ok) {
		return {
			ok: false,
			error: toolError(
				pathProbe.error.kind,
				operation,
				pathProbe.error.message,
				pathProbe.error.details,
			),
		};
	}
	if (pathProbe.value.exitCode === 0) {
		return {
			ok: false,
			error: toolError(
				"git",
				operation,
				"git show failed for a path that exists in the revision",
				{ parent, path, exitCode: result.value.exitCode },
			),
		};
	}
	// Revision is real and the path is not in it. Evidence, not failure.
	return { ok: true, value: null };
}

interface DependencyGraph {
	entries: string[];
	status: DependencyGraphStatus;
	/**
	 * Set when the graph is unavailable because a Git command FAILED, as
	 * opposed to there genuinely being no merge base. The caller turns this
	 * into a recorded extraction failure instead of shipping a bundle whose
	 * empty graph hides a timeout.
	 */
	error?: ToolError;
}

/**
 * Side-tagged paths each parent touched since the merge base.
 *
 * Reports `unavailable` rather than an empty list when no merge base exists,
 * so "touched nothing in common" stays distinguishable from "could not be
 * derived".
 */
async function fetchDependencyGraph(
	gitPath: string,
	parentOurs: string,
	parentTheirs: string,
): Promise<DependencyGraph> {
	const unavailable: DependencyGraph = { entries: [], status: "unavailable" };

	const mergeBaseResult = await runGit(
		gitPath,
		["merge-base", parentOurs, parentTheirs],
		{ acceptedExitCodes: [0, 1, 128] },
	);
	// A timeout, output-limit or spawn failure is not "these histories are
	// unrelated". Only a clean non-zero exit means no merge base exists.
	if (!mergeBaseResult.ok) {
		return { entries: [], status: "unavailable", error: mergeBaseResult.error };
	}
	if (mergeBaseResult.value.exitCode !== 0) return unavailable;

	const mergeBase = decodeStdout(mergeBaseResult.value.stdout).trim().split("\n")[0] ?? "";
	if (!mergeBase) return unavailable;

	let operational: ToolError | undefined;
	const collect = async (parent: string): Promise<string[] | null> => {
		const result = await runGit(
			gitPath,
			[
				"log",
				"--pretty=format:",
				"--name-only",
				"--diff-filter=AM",
				`${mergeBase}..${parent}`,
			],
			{ acceptedExitCodes: [0, 1] },
		);
		if (!result.ok) {
			operational ??= result.error;
			return null;
		}
		if (result.value.exitCode !== 0) return null;
		return Array.from(
			new Set(
				decodeStdout(result.value.stdout)
					.split("\n")
					.map((line) => line.trim())
					.filter(Boolean),
			),
		);
	};

	const [ours, theirs] = await Promise.all([collect(parentOurs), collect(parentTheirs)]);
	if (ours === null || theirs === null) {
		return operational === undefined
			? unavailable
			: { entries: [], status: "unavailable", error: operational };
	}

	return {
		entries: [
			...ours.map((path) => `ours:${path}`),
			...theirs.map((path) => `theirs:${path}`),
		],
		status: "derived",
	};
}

/** Re-label an inner ToolError as an extractor failure, keeping its origin. */
function propagate(inner: ToolError): Result<never> {
	return err(inner.kind, "extractEvidenceBundles", inner.message, {
		...inner.details,
		inner_operation: inner.operation,
	});
}

interface Diff3Region {
	/** 1-based position among ALL regions in the blob, parseable or not. */
	ordinal: number;
	ours: string;
	base: string;
	theirs: string;
}

interface ParsedRegions {
	regions: Diff3Region[];
	/** Ordinals Git emitted that the splitter could not decompose. */
	unparseable: number[];
}

/**
 * Split every diff3 region in a blob.
 *
 * The ordinal is the region's position among ALL matches, so a region the
 * splitter cannot decompose leaves a gap rather than renumbering the regions
 * after it. Deriving the ordinal from the surviving subset would silently
 * shift later regions onto the wrong identity — and that identity is what a
 * sidecar row joins to a corpus region by.
 */
function parseDiff3Regions(blob: string): ParsedRegions {
	const regions: Diff3Region[] = [];
	const unparseable: number[] = [];
	diff3RegionRegex.lastIndex = 0;
	const matches = blob.match(diff3RegionRegex);
	if (!matches) return { regions, unparseable };
	matches.forEach((region, index) => {
		const ordinal = index + 1;
		const parts = diff3SplitRegex.exec(region);
		if (!parts) {
			unparseable.push(ordinal);
			return;
		}
		regions.push({
			ordinal,
			ours: stripDelimiter(parts[1] ?? ""),
			base: stripDelimiter(parts[2] ?? ""),
			theirs: stripDelimiter(parts[3] ?? ""),
		});
	});
	return { regions, unparseable };
}

type ConflictBlobResult =
	| { ok: true; blob: string }
	| { ok: false; error: ToolError };

async function readBlobFromTree(
	gitPath: string,
	treeSha: string,
	conflictPath: string,
): Promise<ConflictBlobResult> {
	const operation = `fetchConflictBlob(${treeSha}:${conflictPath})`;
	const result = await runGit(gitPath, ["cat-file", "-p", `${treeSha}:${conflictPath}`], {
		acceptedExitCodes: [0, 1, 128],
	});
	if (!result.ok) {
		return {
			ok: false,
			error: toolError(
				result.error.kind,
				operation,
				result.error.message,
				result.error.details,
			),
		};
	}
	if (result.value.exitCode !== 0) {
		return {
			ok: false,
			error: toolError("not-found", operation, `git cat-file exited ${result.value.exitCode}`, {
				tree_oid: treeSha,
				path: conflictPath,
				exitCode: result.value.exitCode,
			}),
		};
	}
	return { ok: true, blob: decodeStdout(result.value.stdout) };
}

/**
 * Produce the conflicted blob for one path.
 *
 * `treeSha` short-circuits the merge when the caller already replayed it. The
 * conflict style is delivered through `RunGitOptions.config` rather than being
 * spliced into argv, so `operationName` still sees the subcommand and error
 * labels stay `git merge-tree` — the same seam the F1 fix added.
 */
async function fetchConflictBlob(
	gitPath: string,
	parentOurs: string,
	parentTheirs: string,
	conflictPath: string,
	treeSha?: string,
): Promise<ConflictBlobResult> {
	if (treeSha !== undefined) {
		return readBlobFromTree(gitPath, treeSha, conflictPath);
	}

	const mergeTree = await runGit(
		gitPath,
		["merge-tree", "--write-tree", parentOurs, parentTheirs],
		{
			acceptedExitCodes: [0, 1],
			config: { "merge.conflictStyle": "diff3" },
		},
	);
	if (!mergeTree.ok) {
		return {
			ok: false,
			error: toolError(
				mergeTree.error.kind,
				"fetchConflictBlob(merge-tree)",
				mergeTree.error.message,
				mergeTree.error.details,
			),
		};
	}
	const treeOid = decodeStdout(mergeTree.value.stdout).trim().split("\n")[0] ?? "";
	// SHA-1 (40) or SHA-256 (64): a sha256 repository emits 64-hex object IDs.
	if (!/^[0-9a-f]{40}$|^[0-9a-f]{64}$/.test(treeOid)) {
		return {
			ok: false,
			error: toolError(
				"parse",
				"fetchConflictBlob(merge-tree)",
				"merge-tree did not emit a valid tree OID",
				{ stdout_head: treeOid.slice(0, 40) },
			),
		};
	}
	return readBlobFromTree(gitPath, treeOid, conflictPath);
}

/**
 * Extract one evidence bundle per conflict region in `conflictPath`.
 *
 * Returns bundles in ordinal order, 1-based, matching
 * `ConflictRegionRecord.ordinal` so each joins 1:1 to a corpus region. A file
 * with three conflict regions yields three bundles, rather than one bundle
 * with the extra regions smuggled into another field.
 */
export async function extractEvidenceBundles(
	gitPath: string,
	parentOurs: string,
	parentTheirs: string,
	conflictPath: string,
	options: ExtractOptions = {},
	treeSha?: string,
): Promise<Result<EvidenceBundle[]>> {
	const [preimageOurs, preimageTheirs, dependencyGraph] = await Promise.all([
		fetchPreimage(gitPath, parentOurs, conflictPath, options),
		fetchPreimage(gitPath, parentTheirs, conflictPath, options),
		fetchDependencyGraph(gitPath, parentOurs, parentTheirs),
	]);

	if (!preimageOurs.ok) {
		return propagate(preimageOurs.error);
	}
	if (!preimageTheirs.ok) {
		return propagate(preimageTheirs.error);
	}

	if (dependencyGraph.error !== undefined) {
		return propagate(dependencyGraph.error);
	}

	const blob = await fetchConflictBlob(
		gitPath,
		parentOurs,
		parentTheirs,
		conflictPath,
		treeSha,
	);
	if (!blob.ok) {
		return propagate(blob.error);
	}

	const { regions, unparseable } = parseDiff3Regions(blob.blob);
	if (regions.length === 0) {
		return err(
			"parse",
			"extractEvidenceBundles",
			"No diff3 conflict markers found",
			{ path: conflictPath, unparseable_regions: unparseable.length },
		);
	}

	const bundles = regions.map((region) =>
		EvidenceBundleSchema.parse({
			conflict_path: conflictPath,
			conflict_ordinal: region.ordinal,
			conflict_hunk_ours: region.ours,
			conflict_hunk_base: region.base,
			conflict_hunk_theirs: region.theirs,
			preimage_ours: preimageOurs.value?.content ?? null,
			preimage_theirs: preimageTheirs.value?.content ?? null,
			preimage_ours_bytes: preimageOurs.value?.bytes ?? null,
			preimage_theirs_bytes: preimageTheirs.value?.bytes ?? null,
			preimage_ours_truncated: preimageOurs.value?.truncated ?? false,
			preimage_theirs_truncated: preimageTheirs.value?.truncated ?? false,
			dependency_graph: dependencyGraph.entries,
			dependency_graph_status: dependencyGraph.status,
		}),
	);

	return ok(bundles);
}
