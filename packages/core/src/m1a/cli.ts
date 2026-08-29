import { parseArgs } from "node:util";

import { readCorpus } from "../evaluation/corpus.js";
import { openLocalRepository } from "../evaluation/acquire.js";
import { err, ok, type Result, type ToolError } from "../evaluation/result.js";
import type { CorpusRecordV2 } from "../evaluation/types.js";
import { extractEvidenceBundles } from "./forensic-core.js";
import { writeEvidenceBundlesViaStore } from "./evidence-store-adapter.js";
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
  mrgr-evidence <corpus.jsonl> --db PATH  [--repo PATH] [--max-bytes N]

  <corpus.jsonl>   A schema-v2 corpus produced by \`mrgr-wp0 scan-local\`.
  --out FILE       Sidecar JSONL to append evidence records to.
  --db PATH        mrgr-db/1 database to append evidence records to. The DB
                   must already exist and pass openDb's identity checks; the
                   CLI never creates it. --out and --db are mutually exclusive.
  --repo PATH      Repository to read blobs from. Defaults to each record's
                   own local path; required when the corpus came from a mirror.
  --max-bytes N    Cap each preimage at N bytes. Default: no cap (whole file).
  --resume         Skip regions already present in --out. (Sidecar only.)

Writes one record per conflicted region: status "ok" with a bundle, or status
"failed" with the error. A failed extraction is recorded, never dropped.
`;

interface Options {
	corpus: string;
	out?: string;
	db?: string;
	repo?: string;
	maxBytes?: number;
	resume: boolean;
}

function usageError(message: string): Result<never> {
	return err("config", "mrgr-evidence", message);
}

function usageErrorValue(message: string): ToolError {
	return { kind: "config", operation: "mrgr-evidence", message };
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
				db: { type: "string" },
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
	const db = parsed.values.db;
	const outProvided = typeof out === "string" && out !== "";
	const dbProvided = typeof db === "string" && db !== "";
	if (outProvided && dbProvided) {
		return usageError("--db and --out are mutually exclusive");
	}
	if (!outProvided && !dbProvided) {
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
		...(outProvided ? { out: out as string } : {}),
		...(dbProvided ? { db: db as string } : {}),
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
		// Missing-flag, mutually-exclusive, and other usage-config errors are
		// distinguishable from runtime/processing failures: exit 2 lets shells
		// distinguish "you invoked this wrong" from "this tried and failed".
		if (options.error.kind === "config") {
			io.stderr(`${JSON.stringify(options.error)}\n`);
			return 2;
		}
		io.stderr(`${JSON.stringify(options.error)}\n`);
		return 1;
	}

	// DB mode and sidecar mode are kept on parallel rails so the sidecar
	// path's incremental open/append/close timing and per-record fail-fast
	// behavior are preserved verbatim. DB mode collects every generated
	// record (success or path-level failure) into one array and writes
	// them through the adapter in a single fail-closed pass.
	if (options.value.db !== undefined) {
		return await runDbMode(options.value, io);
	}
	return await runSidecarMode(options.value, io);
}

interface ParsedOptions {
	corpus: string;
	out?: string;
	db?: string;
	repo?: string;
	maxBytes?: number;
	resume: boolean;
}

async function runSidecarMode(
	options: ParsedOptions,
	io: CliIo,
): Promise<number> {
	if (options.out === undefined) {
		io.stderr(`${JSON.stringify(usageErrorValue("--out is required"))}\n`);
		return 2;
	}
	const corpus = await readCorpus(options.corpus);
	if (!corpus.ok) {
		io.stderr(`${JSON.stringify(corpus.error)}\n`);
		return 1;
	}

	let seen = new Set<string>();
	if (options.resume) {
		const keys = await loadEvidenceKeys(options.out);
		if (!keys.ok) {
			io.stderr(`${JSON.stringify(keys.error)}\n`);
			return 1;
		}
		seen = keys.value;
	}

	const writer = await EvidenceWriter.open(options.out);
	if (!writer.ok) {
		io.stderr(`${JSON.stringify(writer.error)}\n`);
		return 1;
	}

	let okCount = 0;
	let failedCount = 0;
	let skipped = 0;

	for (const record of corpus.value) {
		if (record.replayStatus !== "conflicted") continue;
		const gitPath = repositoryPath(record, options.repo);
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

			// A failure that happens before any region was known is a PATH-level
			// failure. It is filed at PATH_LEVEL_ORDINAL rather than 1 so it
			// cannot be mistaken for "region 1 failed, regions 2..n untried" —
			// which is a different and recoverable state.
			//
			// Shape is forced to { kind: "config", operation: "mrgr-evidence" }
			// regardless of the upstream ToolError. The upstream operation name
			// travels in `details.detail` so consumers can still trace it back
			// (e.g. `openLocalRepository`).
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
				options.maxBytes === undefined ? {} : { maxBytes: options.maxBytes },
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

/**
 * DB mode: collect every generated evidence record (one per conflicted
 * region plus a path-level failure row for each pre-region failure), then
 * hand the list to `writeEvidenceBundlesViaStore` for a single fail-closed
 * pass. The DB is opened non-create inside the adapter, so a missing or
 * non-mrgr-db path returns a typed `not-found` error that exits 2 — the
 * CLI never invents or creates a DB.
 *
 * Generated `status: "failed"` rows are byte-identical in shape to what
 * the sidecar path writes: kind/operation are forced to "config" /
 * "mrgr-evidence" via the same pattern as the sidecar's `failure()`
 * helper, with the upstream operation carried in `details.detail`. This
 * keeps the two paths symmetric — they differ only by persistence, not
 * by error envelope — so a record read back through `EvidenceStore.list`
 * round-trips the same shape as one read back through `readEvidence`.
 *
 * Counts mirror the sidecar summary: every record the extractor generated
 * is persisted exactly once. `imported` covers a fresh insert,
 * `skippedDuplicate` covers a same-key re-append, `failed` covers a store
 * rejection. A non-zero generationFailureCount exits 1 even when those
 * rows persisted cleanly: a `status: "failed"` row is a record of
 * extraction that did not produce a bundle, which is a processing
 * failure regardless of where it was filed.
 */
async function runDbMode(options: ParsedOptions, io: CliIo): Promise<number> {
	if (options.db === undefined) {
		io.stderr(`${JSON.stringify(usageErrorValue("--db is required"))}\n`);
		return 2;
	}

	const corpus = await readCorpus(options.corpus);
	if (!corpus.ok) {
		io.stderr(`${JSON.stringify(corpus.error)}\n`);
		return 1;
	}

	const records: EvidenceRecord[] = [];
	let generationFailureCount = 0;

	for (const record of corpus.value) {
		if (record.replayStatus !== "conflicted") continue;
		const gitPath = repositoryPath(record, options.repo);
		const parents = record.merge.parents;
		const ours = parents[0];
		const theirs = parents[1];

		for (const path of record.conflictPaths) {
			const identity = {
				repository_id: record.repository.id,
				merge_sha: record.merge.sha,
				baseline_id: record.baselineId,
				conflict_path: path,
			};

			if (gitPath === null) {
				records.push({
					...identity,
					schemaVersion: EVIDENCE_SCHEMA_VERSION,
					conflict_ordinal: PATH_LEVEL_ORDINAL,
					status: "failed",
					error: {
						kind: "config",
						operation: "mrgr-evidence",
						message: "No repository path for a remote record",
						details: { path, detail: "pass --repo", scope: "path" },
					},
				});
				generationFailureCount += 1;
				continue;
			}
			if (ours === undefined || theirs === undefined || parents.length !== 2) {
				records.push({
					...identity,
					schemaVersion: EVIDENCE_SCHEMA_VERSION,
					conflict_ordinal: PATH_LEVEL_ORDINAL,
					status: "failed",
					error: {
						kind: "config",
						operation: "mrgr-evidence",
						message: "Merge does not have exactly two parents",
						details: { path, detail: `parents=${parents.length}`, scope: "path" },
					},
				});
				generationFailureCount += 1;
				continue;
			}

			const opened = await openLocalRepository(gitPath);
			if (!opened.ok) {
				// Mirror the sidecar `failure(...)` shape exactly: kind and
				// operation are forced to "config" / "mrgr-evidence" so the DB
				// and sidecar paths differ only by persistence. The upstream
				// operation survives in `details.detail` (the same slot the
				// sidecar path uses) so consumers can still trace it back to
				// openLocalRepository.
				records.push({
					...identity,
					schemaVersion: EVIDENCE_SCHEMA_VERSION,
					conflict_ordinal: PATH_LEVEL_ORDINAL,
					status: "failed",
					error: {
						kind: "config",
						operation: "mrgr-evidence",
						message: opened.error.message,
						details: { path, detail: opened.error.operation, scope: "path" },
					},
				});
				generationFailureCount += 1;
				continue;
			}

			const bundles = await extractEvidenceBundles(
				opened.value.gitPath,
				ours,
				theirs,
				path,
				options.maxBytes === undefined ? {} : { maxBytes: options.maxBytes },
			);

			if (!bundles.ok) {
				records.push({
					...identity,
					schemaVersion: EVIDENCE_SCHEMA_VERSION,
					conflict_ordinal: PATH_LEVEL_ORDINAL,
					status: "failed",
					error: { ...bundles.error, details: { ...bundles.error.details, scope: "path" } },
				});
				generationFailureCount += 1;
				continue;
			}

			for (const bundle of bundles.value) {
				records.push({
					...identity,
					schemaVersion: EVIDENCE_SCHEMA_VERSION,
					conflict_ordinal: bundle.conflict_ordinal,
					status: "ok",
					bundle,
				});
			}
		}
	}

	const written = await writeEvidenceBundlesViaStore(options.db, records);
	if (!written.ok) {
		// `not-found` is the typed outcome of openDb(path, {}) when the
		// file is absent: that is a usage-class failure (the user pointed
		// the CLI at a DB that does not exist) and exits 2. Every other
		// open/close/store rejection is a processing failure and exits 1.
		if (written.error.kind === "not-found") {
			io.stderr(`${JSON.stringify(written.error)}\n`);
			return 2;
		}
		io.stderr(`${JSON.stringify(written.error)}\n`);
		return 1;
	}

	const counts = written.value;
	// Surface the typed first-failure diagnostic the adapter captured. The
	// counters tell the operator how many rows were rejected; the JSON
	// error tells them which row tripped the store first and why, without
	// forcing them to re-run with --verbose or open the DB by hand.
	if (counts.firstFailure !== undefined) {
		io.stderr(`${JSON.stringify(counts.firstFailure)}\n`);
	}
	io.stdout(
		`evidence records: imported=${counts.imported} skipped=${counts.skippedDuplicate} failed=${counts.failed}\n`,
	);
	if (counts.failed > 0 || generationFailureCount > 0) return 1;
	return 0;
}