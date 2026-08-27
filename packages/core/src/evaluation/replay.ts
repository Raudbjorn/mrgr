import { inspectReplayPreflight, type RepositoryHandle } from "./acquire.js";
import { OBJECT_GIT_TIMEOUT_MS } from "./acquire.js";
import { runGit, type ConflictStyle } from "./git.js";
import { err, ok, type Result, type ToolError } from "./result.js";
import type {
	BaseReachabilityCount,
	BaseTopology,
	MergeCandidate,
	ObjectId,
	ReplayProvenance,
	ReplayStatus,
	StageObjectIds,
} from "./types.js";

const OBJECT_ID = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;
const STAGE_ENTRY =
	/^([0-7]{6}) ((?:[a-f0-9]{40}|[a-f0-9]{64})) ([123])\t([\s\S]+)$/;

export interface ReplayOptions {
	gitBinary?: string;
	/**
	 * When set, replay runs under this conflict style so that conflicted blobs
	 * carry a base section. Without it every localized region is `ambiguous`,
	 * because Git's default style writes no `|||||||` block. Changing this
	 * changes the baseline — see `baselineInput`.
	 */
	conflictStyle?: ConflictStyle;
}

export interface ListCandidatesOptions extends ReplayOptions {
	revRange?: string;
	since?: string;
}

export interface ReplayInformationalMessage {
	paths: readonly string[];
	kind: string;
	message: string;
}

export interface ParsedMergeTreeOutput {
	automaticTreeOid: ObjectId;
	stageOidsByPath: Readonly<Record<string, StageObjectIds>>;
	conflictPaths: readonly string[];
	informationalMessages: readonly ReplayInformationalMessage[];
}

export interface CandidateReplayResult {
	candidate: MergeCandidate;
	provenance: ReplayProvenance;
	mergeBases: readonly ObjectId[];
	baseTopology: BaseTopology;
	baseReachabilityCounts: readonly BaseReachabilityCount[];
	changedPathIntersection: readonly string[] | null;
	replayStatus: ReplayStatus;
	automaticTreeOid: ObjectId | null;
	conflictPaths: readonly string[];
	stageOidsByPath: Readonly<Record<string, StageObjectIds>>;
	informationalMessages: readonly ReplayInformationalMessage[];
	error?: ToolError;
}

function splitNul(bytes: Buffer, operation: string): Result<Buffer[]> {
	if (bytes.length === 0 || bytes[bytes.length - 1] !== 0) {
		return err("parse", operation, "Git output is not NUL terminated");
	}
	const fields: Buffer[] = [];
	let start = 0;
	for (let index = 0; index < bytes.length; index += 1) {
		if (bytes[index] !== 0) continue;
		fields.push(bytes.subarray(start, index));
		start = index + 1;
	}
	return ok(fields);
}

function validObjectId(value: string): value is ObjectId {
	return OBJECT_ID.test(value);
}

function parseCandidates(
	repositoryId: string,
	bytes: Buffer,
): Result<MergeCandidate[]> {
	if (bytes.length === 0) return ok([]);
	const split = splitNul(bytes, "parse candidate log");
	if (!split.ok) return split;
	if (split.value.length % 4 !== 0) {
		return err(
			"parse",
			"parse candidate log",
			"Git log returned an incomplete candidate record",
			{
				fieldCount: split.value.length,
			},
		);
	}
	const candidates: MergeCandidate[] = [];
	for (let index = 0; index < split.value.length; index += 4) {
		const sha = split.value[index]?.toString("utf8") ?? "";
		const parentsField = split.value[index + 1]?.toString("utf8") ?? "";
		const authorDate = split.value[index + 2]?.toString("utf8") ?? "";
		const subject = split.value[index + 3]?.toString("utf8") ?? "";
		const parents = parentsField.split(" ");
		if (
			!validObjectId(sha) ||
			parents.length !== 2 ||
			!parents.every(validObjectId)
		) {
			return err(
				"parse",
				"parse candidate log",
				"Git log returned invalid merge object IDs",
				{
					sha,
					parentCount: parents.length,
				},
			);
		}
		if (authorDate.length === 0 || Number.isNaN(Date.parse(authorDate))) {
			return err(
				"parse",
				"parse candidate log",
				"Git log returned an invalid author date",
				{
					sha,
					authorDate,
				},
			);
		}
		candidates.push({
			repositoryId,
			sha,
			parents: [parents[0] as ObjectId, parents[1] as ObjectId],
			authorDate,
			subject,
		});
	}
	return ok(candidates);
}

export async function listCandidates(
	repository: RepositoryHandle,
	options: ListCandidatesOptions = {},
): Promise<Result<MergeCandidate[]>> {
	const revRange = options.revRange ?? "--all";
	if (
		revRange.length === 0 ||
		(revRange.startsWith("-") && revRange !== "--all")
	) {
		return err(
			"config",
			"list merge candidates",
			"Revision range must be a revision expression or --all",
		);
	}
	const args = [
		"log",
		"--min-parents=2",
		"--max-parents=2",
		"--format=%H%x00%P%x00%aI%x00%s",
		"-z",
	];
	if (options.since !== undefined) args.push(`--since=${options.since}`);
	args.push(revRange);
	const output = await runGit(repository.gitPath, args, {
		gitBinary: options.gitBinary,
		timeoutMs: OBJECT_GIT_TIMEOUT_MS,
	});
	if (!output.ok) return output;
	return parseCandidates(repository.repository.id, output.value.stdout);
}

function parseObjectIds(bytes: Buffer): Result<ObjectId[]> {
	const text = bytes.toString("utf8").trim();
	if (text.length === 0) return ok([]);
	const values = text.split("\n");
	if (!values.every(validObjectId)) {
		return err(
			"parse",
			"parse merge bases",
			"Git returned an invalid merge-base object ID",
		);
	}
	return ok(values);
}

async function discoverMergeBases(
	repository: RepositoryHandle,
	parents: readonly [ObjectId, ObjectId],
	options: ReplayOptions,
): Promise<Result<ObjectId[]>> {
	const output = await runGit(
		repository.gitPath,
		["merge-base", "--all", parents[0], parents[1]],
		{
			acceptedExitCodes: [0, 1],
			gitBinary: options.gitBinary,
			timeoutMs: OBJECT_GIT_TIMEOUT_MS,
		},
	);
	if (!output.ok) return output;
	const bases = parseObjectIds(output.value.stdout);
	if (!bases.ok) return bases;
	if (output.value.exitCode === 1 && bases.value.length !== 0) {
		return err(
			"parse",
			"parse merge bases",
			"Git returned merge bases with a no-base exit status",
		);
	}
	if (output.value.exitCode === 0 && bases.value.length === 0) {
		return err(
			"parse",
			"parse merge bases",
			"Git returned no merge base with a success exit status",
		);
	}
	return bases;
}

async function countReachableCommits(
	repository: RepositoryHandle,
	base: ObjectId,
	parent: ObjectId,
	options: ReplayOptions,
): Promise<Result<number>> {
	const output = await runGit(
		repository.gitPath,
		["rev-list", "--count", `${base}..${parent}`],
		{
			gitBinary: options.gitBinary,
			timeoutMs: OBJECT_GIT_TIMEOUT_MS,
		},
	);
	if (!output.ok) return output;
	const countText = output.value.stdoutText().trim();
	if (!/^\d+$/.test(countText)) {
		return err(
			"parse",
			"parse reachability count",
			"Git returned an invalid reachability-set count",
			{
				base,
				parent,
			},
		);
	}
	const count = Number(countText);
	if (!Number.isSafeInteger(count)) {
		return err(
			"parse",
			"parse reachability count",
			"Git reachability-set count exceeds safe integer range",
			{
				base,
				parent,
			},
		);
	}
	return ok(count);
}

async function reachabilityCounts(
	repository: RepositoryHandle,
	bases: readonly ObjectId[],
	parents: readonly [ObjectId, ObjectId],
	options: ReplayOptions,
): Promise<Result<BaseReachabilityCount[]>> {
	const counts: BaseReachabilityCount[] = [];
	for (const baseSha of bases) {
		const ours = await countReachableCommits(
			repository,
			baseSha,
			parents[0],
			options,
		);
		if (!ours.ok) return ours;
		const theirs = await countReachableCommits(
			repository,
			baseSha,
			parents[1],
			options,
		);
		if (!theirs.ok) return theirs;
		counts.push({
			baseSha,
			oursExclusiveCommits: ours.value,
			theirsExclusiveCommits: theirs.value,
		});
	}
	return ok(counts);
}

function parsePathList(bytes: Buffer): Result<Buffer[]> {
	if (bytes.length === 0) return ok([]);
	return splitNul(bytes, "parse changed paths");
}

async function changedPaths(
	repository: RepositoryHandle,
	base: ObjectId,
	parent: ObjectId,
	options: ReplayOptions,
): Promise<Result<Buffer[]>> {
	const output = await runGit(
		repository.gitPath,
		["diff", "--name-only", "--no-renames", "-z", base, parent],
		{ gitBinary: options.gitBinary, timeoutMs: OBJECT_GIT_TIMEOUT_MS },
	);
	if (!output.ok) return output;
	return parsePathList(output.value.stdout);
}

async function exactChangedPathIntersection(
	repository: RepositoryHandle,
	base: ObjectId,
	parents: readonly [ObjectId, ObjectId],
	options: ReplayOptions,
): Promise<Result<string[]>> {
	const ours = await changedPaths(repository, base, parents[0], options);
	if (!ours.ok) return ours;
	const theirs = await changedPaths(repository, base, parents[1], options);
	if (!theirs.ok) return theirs;
	const theirsKeys = new Set(theirs.value.map((path) => path.toString("hex")));
	return ok(
		ours.value
			.filter((path) => theirsKeys.has(path.toString("hex")))
			.map((path) => path.toString("utf8")),
	);
}

function emptyReplayFields(): Pick<
	CandidateReplayResult,
	| "automaticTreeOid"
	| "conflictPaths"
	| "stageOidsByPath"
	| "informationalMessages"
> {
	return {
		automaticTreeOid: null,
		conflictPaths: [],
		stageOidsByPath: {},
		informationalMessages: [],
	};
}

export function parseMergeTreeOutput(
	stdout: Buffer,
	exitCode: 0 | 1,
): Result<ParsedMergeTreeOutput> {
	const split = splitNul(stdout, "parse merge-tree output");
	if (!split.ok) return split;
	const fields = split.value;
	const tree = fields.shift()?.toString("utf8") ?? "";
	if (!validObjectId(tree)) {
		return err(
			"parse",
			"parse merge-tree output",
			"Git merge-tree returned an invalid tree object ID",
		);
	}

	const stageMaps = new Map<string, StageObjectIds>();
	const orderedPaths: string[] = [];
	let sawStageSeparator = false;
	while (fields.length > 0) {
		const field = fields.shift();
		if (field === undefined) break;
		if (field.length === 0) {
			sawStageSeparator = true;
			break;
		}
		const match = STAGE_ENTRY.exec(field.toString("utf8"));
		if (match === null) {
			return err(
				"parse",
				"parse merge-tree output",
				"Git merge-tree returned an unknown stage-entry shape",
			);
		}
		const oid = match[2] as ObjectId;
		const stage = Number(match[3]);
		const path = match[4] ?? "";
		if (path.length === 0) {
			return err(
				"parse",
				"parse merge-tree output",
				"Git merge-tree returned an empty conflict path",
			);
		}
		const current = stageMaps.get(path) ?? {
			base: null,
			ours: null,
			theirs: null,
		};
		const key = stage === 1 ? "base" : stage === 2 ? "ours" : "theirs";
		if (current[key] !== null) {
			return err(
				"parse",
				"parse merge-tree output",
				"Git merge-tree returned a duplicate stage for one path",
				{
					path,
					stage,
				},
			);
		}
		stageMaps.set(path, { ...current, [key]: oid });
		if (!orderedPaths.includes(path)) orderedPaths.push(path);
	}

	const informationalMessages: ReplayInformationalMessage[] = [];
	while (fields.length > 0) {
		const countText = fields.shift()?.toString("utf8") ?? "";
		if (!/^\d+$/.test(countText)) {
			return err(
				"parse",
				"parse merge-tree output",
				"Git merge-tree returned an invalid conflict path count",
			);
		}
		const pathCount = Number(countText);
		if (
			!Number.isSafeInteger(pathCount) ||
			pathCount < 1 ||
			fields.length < pathCount + 2
		) {
			return err(
				"parse",
				"parse merge-tree output",
				"Git merge-tree returned an incomplete conflict message",
			);
		}
		const paths = fields
			.splice(0, pathCount)
			.map((field) => field.toString("utf8"));
		if (paths.some((path) => path.length === 0)) {
			return err(
				"parse",
				"parse merge-tree output",
				"Git merge-tree returned an empty informational path",
			);
		}
		const kind = fields.shift()?.toString("utf8") ?? "";
		const message = fields.shift()?.toString("utf8") ?? "";
		if (kind.length === 0 || message.length === 0) {
			return err(
				"parse",
				"parse merge-tree output",
				"Git merge-tree returned an incomplete conflict message",
			);
		}
		informationalMessages.push({ paths, kind, message });
		if (kind.startsWith("CONFLICT")) {
			for (const path of paths) {
				if (!orderedPaths.includes(path)) orderedPaths.push(path);
			}
		}
	}

	if (exitCode === 0 && stageMaps.size !== 0) {
		return err(
			"parse",
			"parse merge-tree output",
			"Git returned unmerged stages with a clean exit status",
		);
	}
	if (
		exitCode === 1 &&
		stageMaps.size === 0 &&
		!informationalMessages.some(({ kind }) => kind.startsWith("CONFLICT"))
	) {
		return err(
			"parse",
			"parse merge-tree output",
			"Git reported a conflict without conflict records",
		);
	}
	if (exitCode === 1 && !sawStageSeparator) {
		return err(
			"parse",
			"parse merge-tree output",
			"Git conflicted output is missing its stage separator",
		);
	}

	return ok({
		automaticTreeOid: tree,
		stageOidsByPath: Object.fromEntries(stageMaps),
		conflictPaths: orderedPaths,
		informationalMessages,
	});
}

function topologyFor(bases: readonly ObjectId[]): BaseTopology {
	if (bases.length === 0) return "none";
	return bases.length === 1 ? "single" : "multiple";
}

function replayError(
	base: Omit<
		CandidateReplayResult,
		| "replayStatus"
		| "automaticTreeOid"
		| "conflictPaths"
		| "stageOidsByPath"
		| "informationalMessages"
	>,
	error: ToolError,
): CandidateReplayResult {
	return {
		...base,
		replayStatus: "error",
		...emptyReplayFields(),
		error,
	};
}

export async function replayCandidate(
	repository: RepositoryHandle,
	candidate: MergeCandidate,
	rawGitVersion: string,
	options: ReplayOptions = {},
): Promise<Result<CandidateReplayResult>> {
	const basesResult = await discoverMergeBases(
		repository,
		candidate.parents,
		options,
	);
	if (!basesResult.ok) return basesResult;
	const mergeBases = basesResult.value;
	const baseTopology = topologyFor(mergeBases);
	const counts = await reachabilityCounts(
		repository,
		mergeBases,
		candidate.parents,
		options,
	);
	if (!counts.ok) return counts;
	let changedPathIntersection: readonly string[] | null = null;
	if (baseTopology === "single") {
		const intersection = await exactChangedPathIntersection(
			repository,
			mergeBases[0] as ObjectId,
			candidate.parents,
			options,
		);
		if (!intersection.ok) return intersection;
		changedPathIntersection = intersection.value;
	}
	const preflight = await inspectReplayPreflight(
		repository,
		candidate.parents,
		rawGitVersion,
		options,
	);
	if (!preflight.ok) return preflight;
	const base = {
		candidate,
		provenance: preflight.value.provenance,
		mergeBases,
		baseTopology,
		baseReachabilityCounts: counts.value,
		changedPathIntersection,
	};
	if (baseTopology === "none") {
		return ok({ ...base, replayStatus: "unrelated", ...emptyReplayFields() });
	}
	if (preflight.value.status === "unsupported-custom-driver") {
		return ok({
			...base,
			replayStatus: "unsupported-custom-driver",
			...emptyReplayFields(),
		});
	}

	const output = await runGit(
		repository.gitPath,
		[
			"merge-tree",
			"--write-tree",
			"--messages",
			"-z",
			candidate.parents[0],
			candidate.parents[1],
		],
		{
			acceptedExitCodes: [0, 1],
			gitBinary: options.gitBinary,
			timeoutMs: OBJECT_GIT_TIMEOUT_MS,
			...(options.conflictStyle === undefined
				? {}
				: { config: { "merge.conflictStyle": options.conflictStyle } }),
		},
	);
	if (!output.ok) return ok(replayError(base, output.error));
	const exitCode = output.value.exitCode;
	if (exitCode !== 0 && exitCode !== 1) {
		return ok(
			replayError(base, {
				kind: "git",
				operation: "git merge-tree",
				message: "Git merge-tree returned an unsupported exit status",
				details: { exitCode },
			}),
		);
	}
	const parsed = parseMergeTreeOutput(output.value.stdout, exitCode);
	if (!parsed.ok) return ok(replayError(base, parsed.error));
	return ok({
		...base,
		replayStatus: exitCode === 0 ? "clean" : "conflicted",
		...parsed.value,
	});
}
