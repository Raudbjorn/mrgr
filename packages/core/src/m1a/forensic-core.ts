import { runGit } from "../evaluation/git.js";
import { type EvidenceBundle, EvidenceBundleSchema } from "./evidence.js";
import { err, ok, type Result, type ToolError } from "../evaluation/result.js";

const CAP = 1200;

// Matches a single diff3 conflict region (first capture: ours, second:
// base, third: theirs). Used with global flag to enumerate regions.
const diff3RegionRegex = /<<<<<<<[^\n]*\n[\s\S]*?>>>>>>>[^\n]*\n?/g;
const diff3SplitRegex =
	/^<<<<<<<[^\n]*\n([\s\S]*?)\n\|\|\|\|\|\|[^\n]*\n([\s\S]*?)\n=======\n([\s\S]*?)\n>>>>>>>/;

const trim = (s: string): string => (s.length > CAP ? s.slice(0, CAP) : s);

const decodeStdout = (stdout: string | Buffer): string =>
	Buffer.isBuffer(stdout) ? stdout.toString("utf-8") : stdout;

type PreimageFetch =
	| { ok: true; value: string }
	| { ok: false; error: ToolError };

async function fetchPreimage(
	gitPath: string,
	parent: string,
	path: string,
): Promise<PreimageFetch> {
	const r = await runGit(gitPath, ["show", `${parent}:${path}`], {
		acceptedExitCodes: [0, 1, 128],
	});
	if (!r.ok) {
		return {
			ok: false,
			error: {
				kind: r.error.kind,
				operation: `fetchPreimage(${parent}:${path})`,
				message: r.error.message,
				...(r.error.details ? { details: r.error.details } : {}),
			},
		};
	}
	if (r.value.exitCode !== 0) {
		return {
			ok: false,
			error: {
				kind: "not-found",
				operation: `fetchPreimage(${parent}:${path})`,
				message: `git show exited ${r.value.exitCode}`,
				details: { parent, path, exitCode: r.value.exitCode },
			},
		};
	}
	return { ok: true, value: trim(decodeStdout(r.value.stdout)) };
}

interface Diff3Region {
	ours: string;
	base: string;
	theirs: string;
}

function parseDiff3Regions(blob: string): Diff3Region[] {
	const regions: Diff3Region[] = [];
	diff3RegionRegex.lastIndex = 0;
	const matches = blob.match(diff3RegionRegex);
	if (!matches) return regions;
	for (const region of matches) {
		const m = diff3SplitRegex.exec(region);
		if (!m) continue;
		regions.push({ ours: m[1] ?? "", base: m[2] ?? "", theirs: m[3] ?? "" });
	}
	return regions;
}

interface DependencyGraph {
	ours: string[];
	theirs: string[];
}

// ponytail: derives the per-parent AM-touched path set so the bundle can carry
// the dep graph. If merge-base fails (unrelated histories), returns empty
// arrays and the bundle still ships — dep graph is auxiliary, not load-bearing
// for content correctness. Add a hard-error mode if a caller needs to refuse
// an empty dep graph.
async function fetchDependencyGraph(
	gitPath: string,
	parentOurs: string,
	parentTheirs: string,
): Promise<DependencyGraph> {
	const mbResult = await runGit(gitPath, ["merge-base", parentOurs, parentTheirs], {
		acceptedExitCodes: [0, 1, 128],
	});
	if (!mbResult.ok || mbResult.value.exitCode !== 0) {
		return { ours: [], theirs: [] };
	}
	const mergeBase = decodeStdout(mbResult.value.stdout).trim().split("\n")[0] ?? "";
	if (!mergeBase) return { ours: [], theirs: [] };

	const collect = async (parent: string): Promise<string[]> => {
		const r = await runGit(
			gitPath,
			["log", "--pretty=format:", "--name-only", "--diff-filter=AM", `${mergeBase}..${parent}`],
			{ acceptedExitCodes: [0, 1] },
		);
		if (!r.ok || r.value.exitCode !== 0) return [];
		return Array.from(
			new Set(
				decodeStdout(r.value.stdout)
					.split("\n")
					.map((s) => s.trim())
					.filter(Boolean),
			),
		);
	};

	const [ours, theirs] = await Promise.all([collect(parentOurs), collect(parentTheirs)]);
	return { ours, theirs };
}

type ConflictBlobResult =
	| { ok: true; blob: string }
	| { ok: false; error: ToolError };

async function fetchConflictBlob(
	gitPath: string,
	parentOurs: string,
	parentTreeSha: string | undefined,
	parentTheirs: string,
	conflictPath: string,
): Promise<ConflictBlobResult> {
	// ponytail: takes the parent tree SHA as a parameter when the caller already
	// has it (faster, no second merge-tree invocation). Falls back to a fresh
	// merge-tree when the parent tree is not provided. If neither is available,
	// the function returns a git error.

	const computeBlob = async (treeSha: string): Promise<ConflictBlobResult> => {
		const r = await runGit(
			gitPath,
			["cat-file", "-p", `${treeSha}:${conflictPath}`],
			{ acceptedExitCodes: [0, 1, 128] },
		);
		if (!r.ok) {
			return {
				ok: false,
				error: {
					kind: r.error.kind,
					operation: `fetchConflictBlob(${treeSha}:${conflictPath})`,
					message: r.error.message,
					...(r.error.details ? { details: r.error.details } : {}),
				},
			};
		}
		if (r.value.exitCode !== 0) {
			return {
				ok: false,
				error: {
					kind: "not-found",
					operation: `fetchConflictBlob(${treeSha}:${conflictPath})`,
					message: `git cat-file exited ${r.value.exitCode}`,
					details: { tree_oid: treeSha, path: conflictPath, exitCode: r.value.exitCode },
				},
			};
		}
		return { ok: true, blob: decodeStdout(r.value.stdout) };
	};

	if (parentTreeSha !== undefined) {
		return computeBlob(parentTreeSha);
	}
	const mtResult = await runGit(
		gitPath,
		[
			"-c",
			"merge.conflictStyle=diff3",
			"merge-tree",
			"--write-tree",
			parentOurs,
			parentTheirs,
		],
		{ acceptedExitCodes: [0, 1] },
	);
	if (!mtResult.ok) {
		return {
			ok: false,
			error: {
				kind: mtResult.error.kind,
				operation: "fetchConflictBlob(merge-tree)",
				message: mtResult.error.message,
				...(mtResult.error.details ? { details: mtResult.error.details } : {}),
			},
		};
	}
	const treeOid = decodeStdout(mtResult.value.stdout).trim().split("\n")[0] ?? "";
	if (!/^[0-9a-f]{40}$/.test(treeOid)) {
		return {
			ok: false,
			error: {
				kind: "parse",
				operation: "fetchConflictBlob(merge-tree)",
				message: "merge-tree did not emit a valid tree OID",
				details: { stdout_head: treeOid.slice(0, 40) },
			},
		};
	}
	return computeBlob(treeOid);
}
export async function extractEvidenceBundle(
	gitPath: string,
	parentOurs: string,
	parentTheirs: string,
	conflictPath: string,
): Promise<Result<EvidenceBundle>> {
	const [preimageOurs, preimageTheirs, depGraph] = await Promise.all([
		fetchPreimage(gitPath, parentOurs, conflictPath),
		fetchPreimage(gitPath, parentTheirs, conflictPath),
		fetchDependencyGraph(gitPath, parentOurs, parentTheirs),
	]);
	if (!preimageOurs.ok)
		return err(
			preimageOurs.error.kind,
			"extractEvidenceBundle",
			preimageOurs.error.message,
			{ ...preimageOurs.error.details, inner_operation: preimageOurs.error.operation },
		);
	if (!preimageTheirs.ok)
		return err(
			preimageTheirs.error.kind,
			"extractEvidenceBundle",
			preimageTheirs.error.message,
			{ ...preimageTheirs.error.details, inner_operation: preimageTheirs.error.operation },
		);

	const blobResult = await fetchConflictBlob(gitPath, parentOurs, undefined, parentTheirs, conflictPath);
	if (!blobResult.ok) {
		return err(
			blobResult.error.kind,
			"extractEvidenceBundle",
			blobResult.error.message,
			blobResult.error.details,
		);
	}

	const regions = parseDiff3Regions(blobResult.blob);
	if (regions.length === 0) {
		return err(
			"parse",
			"extractEvidenceBundle",
			"No diff3 conflict markers found",
		);
	}

	// Schema carries one set of hunk sides per bundle; when the file has
	// multiple conflict regions, the first is the canonical one and the rest
	// are serialized into the dependency_graph slot so callers can recover
	// them. (Bundle schema is single-region by design — see evidence.ts.)
	const first = regions[0]!;
	const extraRegions = regions.slice(1).map((r) => `+${r.ours}|${r.base}|${r.theirs}`);

	return ok(
		EvidenceBundleSchema.parse({
			conflict_hunk_ours: first.ours,
			conflict_hunk_base: first.base,
			conflict_hunk_theirs: first.theirs,
			preimage_ours: preimageOurs.value,
			preimage_theirs: preimageTheirs.value,
			dependency_graph: [
				...depGraph.ours.map((p) => `ours:${p}`),
				...depGraph.theirs.map((p) => `theirs:${p}`),
				...extraRegions,
			],
		}),
	);
}

// ponytail: Export is intentionally module-private. The unit tests exercise
// parseDiff3Regions and fetchDependencyGraph through extractEvidenceBundle
// against a real H0 corpus triple — that's the only path that proves the
// regex works on real bytes.