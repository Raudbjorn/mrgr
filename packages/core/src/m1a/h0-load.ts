// this loader persists inputs only, never a verdict. H0 verdict is invalidated; see evidence/h0/REVIEW-2026-08-27.md.

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { canonicalJson, sha256Hex } from "../db/canonical.js";
import { dbErr, dbOk, type DbResult } from "../db/result.js";
import { closeDb, openDb, type DbHandle } from "../db/open.js";
import { LedgerStore, type LedgerInput } from "../db/ledger-store.js";
import { RunStore, type RunConfig, type RunResultRecord } from "../db/run-store.js";
import type { ImportCounts } from "../db/import.js";

export const COMMIT_PIN = "085ad4f33042b82b3725abaa8884eb0ca396ed2";
export const HALT_REASON = "loaded: shape-only persistence, no verdict claim";
export const ARM_NAME = "h0-materialized-loader";

export const MODEL_NAME = "h0-materialized-loader/1";
export const ADJUDICATOR_IDENTITY = "h0-load.ts@085ad4f";
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const DEFAULT_SOURCES = [
	join(REPO_ROOT, "evidence/h0/triples-jq-diff3.jsonl"),
	join(REPO_ROOT, "evidence/h0/triples-cli-diff3.jsonl"),
] as const;

interface MaterializedTriple {
	repository_id: string;
	merge_sha: string;
	baseline_id: string;
	path: string;
	ordinal: number;
	triple_key: string;
	[key: string]: unknown;
}

export interface LoadOptions {
	limit?: number;
}

export function deriveTripleId(triple: MaterializedTriple): string {
	return sha256Hex(
		canonicalJson({
			repositoryId: triple.repository_id,
			mergeSha: triple.merge_sha,
			baselineId: triple.baseline_id,
			path: triple.path,
			ordinal: triple.ordinal,
			tripleKey: triple.triple_key,
		}),
	);
}

function readTriples(path: string): MaterializedTriple[] {
	if (!existsSync(path)) {
		throw new Error(`file not found: ${path}`);
	}
	const text = readFileSync(path, "utf8");
	const lines = text.split("\n");
	const triples: MaterializedTriple[] = [];
	for (const line of lines) {
		if (line.length === 0) continue;
		const parsed = JSON.parse(line) as MaterializedTriple;
		if (
			typeof parsed.repository_id !== "string" ||
			typeof parsed.merge_sha !== "string" ||
			typeof parsed.baseline_id !== "string" ||
			typeof parsed.path !== "string" ||
			typeof parsed.ordinal !== "number" ||
			typeof parsed.triple_key !== "string"
		) {
			throw new Error(`triple missing required identity fields: ${path}`);
		}
		triples.push(parsed);
	}
	return triples;
}

export async function loadH0MaterializedTriples(
	dbPath: string,
	options: LoadOptions = {},
): Promise<DbResult<ImportCounts>> {
	// Phase 1: parse every input before any DB write. A reader failure
	// surfaces as a typed error; nothing reaches the database.
	const sources: string[] = [...DEFAULT_SOURCES];
	const allTriples: MaterializedTriple[] = [];
	for (const path of sources) {
		try {
			allTriples.push(...readTriples(path));
		} catch (cause) {
			return dbErr("config", "h0-load", "Materialized triples JSONL missing or malformed", {
				path,
				cause: String(cause),
			});
		}
	}

	const triples = options.limit === undefined ? allTriples : allTriples.slice(0, options.limit);

	const opened = openDb(dbPath, { create: true });
	if (!opened.ok) return opened;
	const handle: DbHandle = opened.value;

	try {
		const runConfig: RunConfig = {
			arm: ARM_NAME,
			modelName: MODEL_NAME,
			modelSha: COMMIT_PIN,
			config: {
				source: [
					"evidence/h0/triples-jq-diff3.jsonl",
					"evidence/h0/triples-cli-diff3.jsonl",
				],
				triples: allTriples.length,
			},
		};

		const runStore = new RunStore(handle);
		const created = runStore.createRun(runConfig);
		if (!created.ok) return created;
		const runId = created.value;

		for (const triple of triples) {
			const record: RunResultRecord = {
				runId,
				tripleId: deriveTripleId(triple),
				runIndex: triple.ordinal,
				decision: "halt",
				haltReason: HALT_REASON,
				reasonText: null,
				inputTokens: null,
				outputTokens: null,
				durationMs: null,
				schemaValid: true,
			};
			const appended = runStore.appendResult(record);
			if (!appended.ok) return appended;
		}

		const ledgerInput: LedgerInput = {
			recordType: "decision",
			recordSchemaVersion: "mrgr-ledger/1",
			inputRefs: [],
			intermediateTreeOid: null,
			outputTreeOid: null,
			evidenceDigest: null,
			auditPhase: "h0-materialized-load",
			adjudicatorKind: "script",
			adjudicatorIdentity: ADJUDICATOR_IDENTITY,
			reason: HALT_REASON,
			payload: { imported: triples.length, source: "evidence/h0/triples-*.jsonl" },
			supersedes: null,
		};

		const ledger = new LedgerStore(handle);
		const ledgerRow = ledger.append(ledgerInput);
		if (!ledgerRow.ok) return ledgerRow;

		return dbOk({ imported: triples.length, skippedDuplicate: 0, failed: 0 });
	} finally {
		closeDb(handle);
	}
}

/**
 * CLI entrypoint: parse `--db PATH`, run the loader, print the resulting
 * counts, return an exit code. Mirrors the wiring shape used by the other
 * bin/ wrappers in this package.
 */
export async function main(argv: readonly string[]): Promise<number> {
	let dbPath: string | undefined;
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i] as string;
		if (arg === "--db") {
			const value = argv[i + 1];
			if (typeof value !== "string" || value.length === 0) {
				process.stderr.write("mrgr-h0-load: --db requires a non-empty PATH\n");
				return 2;
			}
			dbPath = value;
			i++;
		} else if (arg === "--help" || arg === "-h") {
			process.stdout.write(
				"mrgr-h0-load --db PATH\n  Persist H0 materialized triples to a mrgr-db.\n",
			);
			return 0;
		} else {
			process.stderr.write(`mrgr-h0-load: unknown argument: ${arg}\n`);
			return 2;
		}
	}
	if (dbPath === undefined) {
		process.stderr.write("mrgr-h0-load: --db PATH is required\n");
		return 2;
	}

	const result = await loadH0MaterializedTriples(dbPath);
	if (!result.ok) {
		process.stderr.write(
			`mrgr-h0-load: ${result.error.kind}: ${result.error.message}\n`,
		);
		return 1;
	}
	process.stdout.write(
		`imported: ${result.value.imported}\n` +
			`skippedDuplicate: ${result.value.skippedDuplicate}\n` +
			`failed: ${result.value.failed}\n`,
	);
	return 0;
}
