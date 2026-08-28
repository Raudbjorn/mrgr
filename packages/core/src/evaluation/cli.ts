import { parseArgs, type ParseArgsConfig } from "node:util";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
	ensureRemoteMirror,
	openLocalRepository,
	type RepositoryHandle,
} from "./acquire.js";
import {
	CorpusWriter,
	loadResumeKeys,
	readCorpus,
	resumeKey,
} from "./corpus.js";
import {
	assertMinimumGitVersion,
	baselineId,
	type ConflictStyle,
	gitVersion,
	MINIMUM_GIT_VERSION,
} from "./git.js";
import { localizeConflictRegions } from "./localize.js";
import { materializeCorpusFile } from "./materialize.js";
import {
	boundedPool,
	MAX_POOL_CONCURRENCY,
	MIN_POOL_CONCURRENCY,
} from "./pool.js";
import { generateReport } from "./report.js";
import { listCandidates, replayCandidate } from "./replay.js";
import { err, ok, type Result, type ToolError } from "./result.js";
import {
	SCHEMA_VERSION,
	type CorpusRecordV2,
	type MergeCandidate,
	type ReplayProvenance,
} from "./types.js";

import {
	runLlamaCppRecord,
	runLlamaCppReindex,
} from "../db/llama-cpp-cli.js";

const HELP = `WP0 merge forensics

Usage:
  pnpm wp0 scan <owner/repo...> --out FILE [--host github.com] [--cache DIR] [--since ISO] [--jobs 4] [--refresh] [--conflict-style diff3]
  pnpm wp0 scan-local <path...> --out FILE [--since ISO] [--rev RANGE] [--jobs 4] [--conflict-style diff3]
  pnpm wp0 report FILE [--baseline ID]
  pnpm wp0 materialize FILE --out FILE [--baseline ID] [--cache DIR]
  pnpm wp0 --help
`;

export interface CliIo {
	stdout: (text: string) => void;
	stderr: (text: string) => void;
}

interface ScanTarget {
	repository: RepositoryHandle;
	candidate: MergeCandidate;
}

interface ScanOptions {
	out: string;
	conflictStyle: ConflictStyle | undefined;
	since: string | undefined;
	jobs: number;
	revRange: string | undefined;
	host: string | undefined;
	cacheDir: string | undefined;
	refresh: boolean;
	remote: boolean;
}

interface ParsedCommandArgs {
	positionals: readonly string[];
	values: Record<string, unknown>;
}

function usageError(
	operation: string,
	message: string,
	details?: ToolError["details"],
): Result<never> {
	return err("config", operation, message, details);
}

function parseCommandArgs(
	args: readonly string[],
	options: NonNullable<ParseArgsConfig["options"]>,
): Result<ParsedCommandArgs> {
	try {
		const parsed = parseArgs({
			args: [...args],
			options,
			allowPositionals: true,
			strict: true,
		});
		return ok({ values: parsed.values, positionals: parsed.positionals });
	} catch {
		return usageError("parse CLI", "Invalid command arguments");
	}
}

function requiredString(
	value: unknown,
	name: string,
	operation: string,
): Result<string> {
	if (typeof value !== "string" || value.length === 0)
		return usageError(operation, `--${name} is required`);
	return ok(value);
}

function parseJobs(value: unknown, operation: string): Result<number> {
	if (value === undefined) return ok(4);
	if (typeof value !== "string" || !/^\d+$/.test(value))
		return usageError(operation, "--jobs must be an integer from 1 to 32");
	const jobs = Number(value);
	if (
		!Number.isInteger(jobs) ||
		jobs < MIN_POOL_CONCURRENCY ||
		jobs > MAX_POOL_CONCURRENCY
	) {
		return usageError(operation, "--jobs must be an integer from 1 to 32", {
			jobs,
		});
	}
	return ok(jobs);
}

function validateIsoDate(
	value: unknown,
	operation: string,
): Result<string | undefined> {
	if (value === undefined) return ok(undefined);
	if (typeof value !== "string" || value.length === 0)
		return usageError(operation, "--since must be a valid ISO date");
	const datePrefix = /^(\d{4}-\d{2}-\d{2})/.exec(value)?.[1];
	if (datePrefix === undefined)
		return usageError(operation, "--since must be a valid ISO date", {
			since: value,
		});
	const calendarDate = new Date(`${datePrefix}T00:00:00Z`);
	if (
		Number.isNaN(calendarDate.valueOf()) ||
		calendarDate.toISOString().slice(0, 10) !== datePrefix
	) {
		return usageError(operation, "--since must be a valid ISO date", {
			since: value,
		});
	}
	if (value === datePrefix) return ok(value);
	const timestampShape =
		/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2})$/;
	if (!timestampShape.test(value) || Number.isNaN(Date.parse(value)))
		return usageError(operation, "--since must be a valid ISO date", {
			since: value,
		});
	return ok(value);
}

function validateConflictStyle(
	value: unknown,
	operation: string,
): Result<ConflictStyle | undefined> {
	if (value === undefined) return ok(undefined);
	if (value !== "diff3" && value !== "zdiff3")
		return usageError(operation, "--conflict-style must be diff3 or zdiff3", {
			conflictStyle: typeof value === "string" ? value : null,
		});
	return ok(value);
}

function validateInputs(
	positionals: readonly string[],
	operation: string,
): Result<string[]> {
	if (
		positionals.length === 0 ||
		positionals.some((value) => value.length === 0)
	)
		return usageError(operation, "At least one repository or path is required");
	return ok([...positionals]);
}

function minimalProvenance(rawGitVersion: string): ReplayProvenance {
	return {
		gitVersion: rawGitVersion,
		algorithm: "merge-tree-write-tree",
		strategy: "ort",
		environmentPolicy: "isolated-v1",
		normalizationVersion: "v1",
		parentAttributes: { ours: null, theirs: null },
		repoMergeConfigHash: null,
	};
}

function candidateErrorRecord(
	target: ScanTarget,
	rawGitVersion: string,
	baseline: string,
	error: ToolError,
): CorpusRecordV2 {
	return {
		schemaVersion: SCHEMA_VERSION,
		repository: target.repository.repository,
		merge: target.candidate,
		baselineId: baseline,
		replayProvenance: minimalProvenance(rawGitVersion),
		mergeBases: [],
		baseTopology: "none",
		baseReachabilityCounts: [],
		changedPathIntersection: null,
		replayStatus: "error",
		automaticTreeOid: null,
		conflictPaths: [],
		conflictRegions: [],
		error: {
			...error,
			details: {
				...(error.details ?? {}),
				provenance: "minimal-candidate-error",
			},
		},
	};
}

async function processCandidate(
	target: ScanTarget,
	rawGitVersion: string,
	baseline: string,
	conflictStyle?: ConflictStyle,
): Promise<CorpusRecordV2> {
	const replay = await replayCandidate(
		target.repository,
		target.candidate,
		rawGitVersion,
		{ conflictStyle },
	);
	if (!replay.ok)
		return candidateErrorRecord(target, rawGitVersion, baseline, replay.error);
	let conflictRegions: CorpusRecordV2["conflictRegions"] = [];
	let replayStatus = replay.value.replayStatus;
	let structuredError = replay.value.error;
	if (replay.value.replayStatus === "conflicted") {
		const localized = await localizeConflictRegions(
			target.repository,
			replay.value,
		);
		if (!localized.ok) {
			replayStatus = "error";
			structuredError = localized.error;
		} else {
			conflictRegions = localized.value;
		}
	}
	return {
		schemaVersion: SCHEMA_VERSION,
		repository: target.repository.repository,
		merge: replay.value.candidate,
		baselineId: baseline,
		replayProvenance: replay.value.provenance,
		mergeBases: replay.value.mergeBases,
		baseTopology: replay.value.baseTopology,
		baseReachabilityCounts: replay.value.baseReachabilityCounts,
		changedPathIntersection: replay.value.changedPathIntersection,
		replayStatus,
		automaticTreeOid: replay.value.automaticTreeOid,
		conflictPaths: replay.value.conflictPaths,
		conflictRegions,
		...(structuredError === undefined ? {} : { error: structuredError }),
	};
}

async function runScan(
	inputs: readonly string[],
	options: ScanOptions,
): Promise<Result<void>> {
	const rawVersion = await gitVersion();
	if (!rawVersion.ok) return rawVersion;
	const supported = assertMinimumGitVersion(
		rawVersion.value,
		MINIMUM_GIT_VERSION,
	);
	if (!supported.ok) return supported;
	const baseline = baselineId(rawVersion.value, options.conflictStyle);
	const resume = await loadResumeKeys(options.out);
	if (!resume.ok) return resume;
	const targets: ScanTarget[] = [];
	const scheduledIdentities = new Set(resume.value);
	for (const input of inputs) {
		const opened = options.remote
			? await ensureRemoteMirror(input, {
					host: options.host,
					cacheDir: options.cacheDir,
					refresh: options.refresh,
				})
			: await openLocalRepository(input);
		if (!opened.ok) return opened;
		const candidates = await listCandidates(opened.value, {
			since: options.since,
			revRange: options.revRange,
		});
		if (!candidates.ok) return candidates;
		for (const candidate of candidates.value) {
			const identity = resumeKey({
				repository: opened.value.repository,
				merge: candidate,
				baselineId: baseline,
			});
			if (scheduledIdentities.has(identity)) continue;
			scheduledIdentities.add(identity);
			targets.push({ repository: opened.value, candidate });
		}
	}
	const writer = await CorpusWriter.open(options.out);
	if (!writer.ok) return writer;
	const outcomes = await boundedPool(targets, options.jobs, async (target) => {
		let record: CorpusRecordV2;
		try {
			record = await processCandidate(
				target,
				rawVersion.value,
				baseline,
				options.conflictStyle,
			);
		} catch {
			record = candidateErrorRecord(target, rawVersion.value, baseline, {
				kind: "unsupported",
				operation: "scan candidate",
				message: "Unexpected candidate processing failure",
			});
		}
		return writer.value.append(record);
	});
	let failure: ToolError | undefined;
	for (let index = 0; index < outcomes.length; index += 1) {
		const outcome = outcomes[index];
		if (outcome === undefined) {
			failure = {
				kind: "corrupt-corpus",
				operation: "scan candidates",
				message: "Bounded pool returned an incomplete result set",
				details: { index },
			};
			break;
		}
		if (!outcome.ok) {
			failure = outcome.error;
			break;
		}
		if (!outcome.value.ok) {
			failure = outcome.value.error;
			break;
		}
	}
	const closed = await writer.value.close();
	if (failure !== undefined) return { ok: false, error: failure };
	return closed;
}

function parseScan(
	argv: readonly string[],
	remote: boolean,
): Result<{ inputs: string[]; options: ScanOptions }> {
	const operation = remote ? "scan" : "scan-local";
	const parsed = parseCommandArgs(
		argv,
		remote
			? {
					out: { type: "string" },
					host: { type: "string", default: "github.com" },
					cache: { type: "string" },
					since: { type: "string" },
					jobs: { type: "string", default: "4" },
					refresh: { type: "boolean", default: false },
					"conflict-style": { type: "string" },
				}
			: {
					out: { type: "string" },
					since: { type: "string" },
					rev: { type: "string", default: "--all" },
					jobs: { type: "string", default: "4" },
					"conflict-style": { type: "string" },
				},
	);
	if (!parsed.ok) return parsed;
	const inputs = validateInputs(parsed.value.positionals, operation);
	if (!inputs.ok) return inputs;
	const out = requiredString(parsed.value.values.out, "out", operation);
	if (!out.ok) return out;
	const since = validateIsoDate(parsed.value.values.since, operation);
	if (!since.ok) return since;
	const jobs = parseJobs(parsed.value.values.jobs, operation);
	if (!jobs.ok) return jobs;
	let revRange: string | undefined;
	if (!remote) {
		const rev = requiredString(parsed.value.values.rev, "rev", operation);
		if (!rev.ok) return rev;
		if (rev.value.includes("\0") || rev.value.includes("\n"))
			return usageError(operation, "--rev must be one Git argument");
		revRange = rev.value;
	}
	const conflictStyle = validateConflictStyle(
		parsed.value.values["conflict-style"],
		operation,
	);
	if (!conflictStyle.ok) return conflictStyle;
	return ok({
		inputs: inputs.value,
		options: {
			out: out.value,
			conflictStyle: conflictStyle.value,
			since: since.value,
			jobs: jobs.value,
			revRange,
			host:
				remote && typeof parsed.value.values.host === "string"
					? parsed.value.values.host
					: undefined,
			cacheDir:
				remote && typeof parsed.value.values.cache === "string"
					? parsed.value.values.cache
					: undefined,
			refresh: remote && parsed.value.values.refresh === true,
			remote,
		},
	});
}

async function execute(
	argv: readonly string[],
	io: CliIo,
): Promise<Result<string | null>> {
	if (argv.length === 1 && argv[0] === "--help") return ok(HELP);
	const command = argv[0];
	if (command === "scan" || command === "scan-local") {
		const parsed = parseScan(argv.slice(1), command === "scan");
		if (!parsed.ok) return parsed;
		const scanned = await runScan(parsed.value.inputs, parsed.value.options);
		return scanned.ok ? ok(null) : scanned;
	}
	if (command === "report") {
		const parsed = parseCommandArgs(argv.slice(1), {
			baseline: { type: "string" },
		});
		if (!parsed.ok) return parsed;
		if (parsed.value.positionals.length !== 1)
			return usageError("report", "report requires exactly one corpus file");
		const corpus = await readCorpus(parsed.value.positionals[0] as string);
		if (!corpus.ok) return corpus;
		const report = generateReport(
			corpus.value,
			typeof parsed.value.values.baseline === "string"
				? parsed.value.values.baseline
				: undefined,
		);
		return report;
	}
	if (command === "materialize") {
		const parsed = parseCommandArgs(argv.slice(1), {
			out: { type: "string" },
			baseline: { type: "string" },
			cache: { type: "string" },
		});
		if (!parsed.ok) return parsed;
		if (parsed.value.positionals.length !== 1)
			return usageError(
				"materialize",
				"materialize requires exactly one corpus file",
			);
		const out = requiredString(parsed.value.values.out, "out", "materialize");
		if (!out.ok) return out;
		const input = parsed.value.positionals[0] as string;
		if (resolve(input) === resolve(out.value))
			return usageError("materialize", "Input and output paths must differ", {
				input: resolve(input),
				output: resolve(out.value),
			});
		const materialized = await materializeCorpusFile(input, out.value, {
			baseline:
				typeof parsed.value.values.baseline === "string"
					? parsed.value.values.baseline
					: undefined,
			cacheDir:
				typeof parsed.value.values.cache === "string"
					? parsed.value.values.cache
					: undefined,
		});
		return materialized.ok ? ok(null) : materialized;
	}
	if (command === "llama-cpp") {
		const sub = argv[1];
		if (sub === "record") {
			const result = await runLlamaCppRecord("mrgr.db", argv.slice(2));
			return serializeLlamaCppResult(result, io);
		}
		if (sub === "reindex") {
			const result = await runLlamaCppReindex("mrgr.db", argv.slice(2));
			return serializeLlamaCppResult(result, io);
		}
		return usageError(
			"llama-cpp",
			"Unknown llama-cpp subcommand; expected record | reindex",
		);
	}
	return usageError("CLI", "Unknown or missing command; use --help");
}

/** Format a llama-cpp CLI result. Success bodies (arrays of `{run_id,...}`
 * or reindex summaries) are JSON-printed to stdout; errors propagate to the
 * dispatcher's existing stderr path. */
function serializeLlamaCppResult(
	result: Result<unknown>,
	io: CliIo,
): Result<string | null> {
	if (!result.ok) return result;
	io.stdout(`${JSON.stringify(result.value)}\n`);
	return ok(null);
}

export async function main(
	argv: readonly string[],
	io: CliIo = {
		stdout: (text) => {
			process.stdout.write(text);
		},
		stderr: (text) => {
			process.stderr.write(text);
		},
	},
): Promise<number> {
	let result: Result<string | null>;
	try {
		result = await execute(argv, io);
	} catch {
		result = err("unsupported", "CLI", "Unexpected WP0 failure");
	}
	if (!result.ok) {
		io.stderr(`${JSON.stringify(result.error)}\n`);
		return 1;
	}
	if (result.value !== null) io.stdout(result.value);
	return 0;
}

const invokedPath =
	process.argv[1] === undefined ? "" : resolve(process.argv[1]);
if (invokedPath === fileURLToPath(import.meta.url)) {
	main(process.argv.slice(2)).then(
		(code) => {
			process.exitCode = code;
		},
		() => {
			process.exitCode = 1;
		},
	);
}
