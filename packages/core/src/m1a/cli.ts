import { parseArgs } from "node:util";

import { readCorpus } from "../evaluation/corpus.js";
import { openLocalRepository } from "../evaluation/acquire.js";
import { err, ok, type Result } from "../evaluation/result.js";
import type { CorpusRecordV2 } from "../evaluation/types.js";
import { extractEvidenceBundles } from "./forensic-core.js";
import {
	EVIDENCE_SCHEMA_VERSION,
	EvidenceWriter,
	PATH_LEVEL_ORDINAL,
	evidenceKey,
	loadEvidenceKeys,
	type EvidenceRecord,
} from "./sidecar.js";

export interface CliIo {
	stdout: (text: string) => void;
	stderr: (text: string) => void;
}

const HELP = `mrgr evidence — extract per-region evidence bundles for a corpus

Usage:
  mrgr-evidence <corpus.jsonl> --out FILE [--repo PATH] [--max-bytes N] [--resume]

  <corpus.jsonl>   A schema-v2 corpus produced by \`mrgr-wp0 scan-local\`.
  --out FILE       Sidecar JSONL to append evidence records to.
  --repo PATH      Repository to read blobs from. Defaults to each record's
                   own local path; required when the corpus came from a mirror.
  --max-bytes N    Cap each preimage at N bytes. Default: no cap (whole file).
  --resume         Skip regions already present in --out.

Writes one record per conflicted region: status "ok" with a bundle, or status
"failed" with the error. A failed extraction is recorded, never dropped.
`;

interface Options {
	corpus: string;
	out: string;
	repo?: string;
	maxBytes?: number;
	resume: boolean;
}

function usageError(message: string): Result<never> {
	return err("config", "mrgr-evidence", message);
}

function parse(argv: readonly string[]): Result<Options> {
	let parsed;
	try {
		parsed = parseArgs({
			args: [...argv],
			allowPositionals: true,
			strict: true,
			options: {
				out: { type: "string" },
				repo: { type: "string" },
				"max-bytes": { type: "string" },
				resume: { type: "boolean", default: false },
				help: { type: "boolean", default: false },
			},
		});
	} catch (cause) {
		return usageError((cause as Error).message);
	}

	if (parsed.values.help === true) return usageError("__help__");

	const corpus = parsed.positionals[0];
	if (corpus === undefined) return usageError("A corpus file is required");
	if (parsed.positionals.length > 1) {
		return usageError("Exactly one corpus file may be given");
	}
	const out = parsed.values.out;
	if (typeof out !== "string" || out === "") {
		return usageError("--out is required");
	}

	let maxBytes: number | undefined;
	const rawMaxBytes = parsed.values["max-bytes"];
	if (typeof rawMaxBytes === "string") {
		maxBytes = Number(rawMaxBytes);
		if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
			return usageError("--max-bytes must be a positive integer");
		}
	}

	return ok({
		corpus,
		out,
		...(typeof parsed.values.repo === "string" ? { repo: parsed.values.repo } : {}),
		...(maxBytes === undefined ? {} : { maxBytes }),
		resume: parsed.values.resume === true,
	});
}

/**
 * Where to read blobs for this record.
 *
 * A local scan records its own absolute path; a remote scan does not have one
 * on this machine, so `--repo` must supply it rather than being guessed.
 */
function repositoryPath(record: CorpusRecordV2, override?: string): string | null {
	if (override !== undefined) return override;
	if (record.repository.kind === "local") return record.repository.absolutePath;
	return null;
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
	const options = parse(argv);
	if (!options.ok) {
		if (options.error.message === "__help__") {
			io.stdout(HELP);
			return 0;
		}
		io.stderr(`${JSON.stringify(options.error)}\n`);
		return 1;
	}

	const corpus = await readCorpus(options.value.corpus);
	if (!corpus.ok) {
		io.stderr(`${JSON.stringify(corpus.error)}\n`);
		return 1;
	}

	let seen = new Set<string>();
	if (options.value.resume) {
		const keys = await loadEvidenceKeys(options.value.out);
		if (!keys.ok) {
			io.stderr(`${JSON.stringify(keys.error)}\n`);
			return 1;
		}
		seen = keys.value;
	}

	const writer = await EvidenceWriter.open(options.value.out);
	if (!writer.ok) {
		io.stderr(`${JSON.stringify(writer.error)}\n`);
		return 1;
	}

	let okCount = 0;
	let failedCount = 0;
	let skipped = 0;

	for (const record of corpus.value) {
		if (record.replayStatus !== "conflicted") continue;
		const gitPath = repositoryPath(record, options.value.repo);
		const parents = record.merge.parents;
		const ours = parents[0];
		const theirs = parents[1];

		// One region per conflicted path is the minimum the corpus guarantees;
		// the extractor returns the true per-region set, which may be larger.
		for (const path of record.conflictPaths) {
			const identity = {
				repository_id: record.repository.id,
				merge_sha: record.merge.sha,
				baseline_id: record.baselineId,
				conflict_path: path,
			};

			// Every write goes through here so that `seen` is updated in step
			// with the file. Loading the resume set once and never adding to it
			// meant a corpus with duplicate records, or a record repeating a
			// path, appended the same key twice in a single run.
			// "skipped" and "written" are distinct outcomes so the summary counts
			// each region once. Reporting a resumed region as both ok and
			// skipped would overstate the work done.
			const write = async (
				entry: EvidenceRecord,
			): Promise<"written" | "skipped" | "error"> => {
				const key = evidenceKey(entry);
				if (seen.has(key)) {
					skipped += 1;
					return "skipped";
				}
				const appended = await writer.value.append(entry);
				if (!appended.ok) {
					io.stderr(`${JSON.stringify(appended.error)}\n`);
					return "error";
				}
				seen.add(key);
				return "written";
			};

			// A failure that happens before any region is known is a PATH-level
			// failure. It is filed at PATH_LEVEL_ORDINAL rather than 1 so it
			// cannot be mistaken for "region 1 failed, regions 2..n untried" —
			// which is a different and recoverable state.
			const failure = async (
				message: string,
				detail: string,
			): Promise<"written" | "skipped" | "error"> =>
				write({
					...identity,
					schemaVersion: EVIDENCE_SCHEMA_VERSION,
					conflict_ordinal: PATH_LEVEL_ORDINAL,
					status: "failed",
					error: {
						kind: "config",
						operation: "mrgr-evidence",
						message,
						details: { path, detail, scope: "path" },
					},
				});

			// Deliberately no path-level pre-skip. Skipping a whole path because
			// its ordinal-1 row exists would permanently lose region 2 when a
			// crash landed between the two writes. Re-extraction is cheap;
			// silently dropping a region is not. The per-region check below is
			// what makes resume idempotent.

			if (gitPath === null) {
				if ((await failure("No repository path for a remote record", "pass --repo")) === "error") {
					await writer.value.close();
					return 1;
				}
				failedCount += 1;
				continue;
			}
			if (ours === undefined || theirs === undefined || parents.length !== 2) {
				// Exactly two. Fewer is a root; more is an octopus, where
				// silently taking the first two would extract evidence for a
				// merge that never happened.
				if (
					(await failure(
						"Merge does not have exactly two parents",
						`parents=${parents.length}`,
					)) === "error"
				) {
					await writer.value.close();
					return 1;
				}
				failedCount += 1;
				continue;
			}

			const opened = await openLocalRepository(gitPath);
			if (!opened.ok) {
				if ((await failure(opened.error.message, opened.error.operation)) === "error") {
					await writer.value.close();
					return 1;
				}
				failedCount += 1;
				continue;
			}

			const bundles = await extractEvidenceBundles(
				opened.value.gitPath,
				ours,
				theirs,
				path,
				options.value.maxBytes === undefined ? {} : { maxBytes: options.value.maxBytes },
			);

			if (!bundles.ok) {
				const entry: EvidenceRecord = {
					...identity,
					schemaVersion: EVIDENCE_SCHEMA_VERSION,
					conflict_ordinal: PATH_LEVEL_ORDINAL,
					status: "failed",
					error: { ...bundles.error, details: { ...bundles.error.details, scope: "path" } },
				};
				if ((await write(entry)) === "error") {
					await writer.value.close();
					return 1;
				}
				failedCount += 1;
				continue;
			}

			for (const bundle of bundles.value) {
				const entry: EvidenceRecord = {
					...identity,
					schemaVersion: EVIDENCE_SCHEMA_VERSION,
					conflict_ordinal: bundle.conflict_ordinal,
					status: "ok",
					bundle,
				};
				const outcome = await write(entry);
				if (outcome === "error") {
					await writer.value.close();
					return 1;
				}
				if (outcome === "written") okCount += 1;
			}
		}
	}

	const closed = await writer.value.close();
	if (!closed.ok) {
		io.stderr(`${JSON.stringify(closed.error)}\n`);
		return 1;
	}

	io.stdout(
		`evidence records: ok=${okCount} failed=${failedCount} skipped=${skipped}\n`,
	);
	return 0;
}
