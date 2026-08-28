import { parseArgs, type ParseArgsConfig } from "node:util";
import { resolve } from "node:path";

import { getBlob } from "./blob.js";
import { exportDb } from "./export.js";
import { closeDb, openDb, type DbHandle } from "./open.js";
import { dbErr, dbOk, type DbResult, type DbToolError } from "./result.js";

export interface CliIo {
	stdout: (text: string) => void;
	stderr: (text: string) => void;
}

const HELP = `mrgr-db — workspace SQLite persistence for mrgr-db/1

Usage:
  mrgr-db init   --db PATH
  mrgr-db import --db PATH (--corpus FILE | --evidence FILE)
  mrgr-db export --db PATH --out DIR [--with-blobs]
  mrgr-db verify --db PATH
  mrgr-db --help

init    Create PATH if it does not exist, or accept it unchanged if it
        already matches the mrgr-db/1 schema. Never migrates.
import  Load a legacy JSONL corpus or evidence sidecar into PATH via
        CorpusStore/EvidenceStore. A record identical to one already stored
        is skipped, not duplicated.
export  Dump PATH to canonical JSONL under DIR, one file per table plus
        manifest.json. --with-blobs additionally writes blobs/<sha256>.
verify  PRAGMA integrity_check, PRAGMA foreign_key_check, the schema-version
        checks openDb already enforces, and a digest re-check of every
        stored blob. Prints per-table row counts on success.
`;

/**
 * Every table mrgr-db/1 defines, in the order exportDb reports them. Kept
 * local rather than re-exported from export.ts: this list only needs to
 * name every table for a row-count sweep, not the per-table ORDER BY that
 * makes an export byte-deterministic.
 */
const TABLES = [
	"meta",
	"repository",
	"baseline",
	"corpus_record",
	"merge_base",
	"conflict_path",
	"conflict_region",
	"evidence_bundle",
	"evidence_dep",
	"blob",
	"ledger",
	"run",
	"run_result",
] as const;

interface ParsedArgs {
	values: Record<string, string | boolean | (string | boolean)[] | undefined>;
	positionals: string[];
}

/**
 * Every usage mistake — an unknown flag, a missing required flag, an extra
 * positional, a bad combination of flags — is filed under "config". main()
 * uses that kind, and only that kind, to choose exit code 2 over 1: a
 * mis-invocation is distinct from a failure while doing the work asked.
 */
function usageError(
	operation: string,
	message: string,
	details?: DbToolError["details"],
): DbResult<never> {
	return dbErr("config", operation, message, details);
}

function parseCommandArgs(
	operation: string,
	args: readonly string[],
	options: NonNullable<ParseArgsConfig["options"]>,
): DbResult<ParsedArgs> {
	try {
		const parsed = parseArgs({ args: [...args], options, allowPositionals: true, strict: true });
		return dbOk({ values: parsed.values, positionals: parsed.positionals });
	} catch {
		return usageError(operation, "Invalid command arguments");
	}
}

function requiredString(value: unknown, name: string, operation: string): DbResult<string> {
	if (typeof value !== "string" || value.length === 0) {
		return usageError(operation, `--${name} is required`);
	}
	return dbOk(value);
}

function noPositionals(operation: string, positionals: readonly string[]): DbResult<void> {
	if (positionals.length > 0) {
		return usageError(operation, `${operation} takes no positional arguments`, {
			positionals: positionals.join(","),
		});
	}
	return dbOk(undefined);
}

interface ImportCounts {
	imported: number;
	skippedDuplicate: number;
	failed: number;
	firstFailure?: DbToolError;
}

interface ImportModule {
	importCorpusJsonl(handle: DbHandle, path: string): Promise<DbResult<ImportCounts>>;
	importEvidenceJsonl(handle: DbHandle, path: string): Promise<DbResult<ImportCounts>>;
}

// Indirected through a variable rather than a string literal in the
// import() call: with a literal, tsc resolves the module for typechecking
// and fails the whole build the moment the file is absent. src/db/import.ts
// lands in a concurrently-developed task and may not exist yet; the
// indirection defers "does this exist" to runtime, where it is handled below
// as a typed error instead of a build break.
const IMPORT_MODULE_SPECIFIER = "./import.js";

async function loadImportModule(): Promise<DbResult<ImportModule>> {
	let mod: Partial<ImportModule>;
	try {
		mod = (await import(IMPORT_MODULE_SPECIFIER)) as Partial<ImportModule>;
	} catch {
		return dbErr(
			"unsupported",
			"mrgr-db import",
			"Import is not available: src/db/import.ts has not landed yet",
		);
	}
	if (typeof mod.importCorpusJsonl !== "function" || typeof mod.importEvidenceJsonl !== "function") {
		return dbErr(
			"unsupported",
			"mrgr-db import",
			"src/db/import.ts is present but does not export importCorpusJsonl/importEvidenceJsonl",
		);
	}
	return dbOk(mod as ImportModule);
}

async function runInit(argv: readonly string[]): Promise<DbResult<string>> {
	const operation = "mrgr-db init";
	const parsed = parseCommandArgs(operation, argv, { db: { type: "string" } });
	if (!parsed.ok) return parsed;
	const positionalsOk = noPositionals(operation, parsed.value.positionals);
	if (!positionalsOk.ok) return positionalsOk;
	const db = requiredString(parsed.value.values.db, "db", operation);
	if (!db.ok) return db;

	const opened = openDb(db.value, { create: true });
	if (!opened.ok) return opened;
	const closed = closeDb(opened.value);
	if (!closed.ok) return closed;
	return dbOk(`initialized ${resolve(db.value)}\n`);
}

async function runImport(argv: readonly string[]): Promise<DbResult<string>> {
	const operation = "mrgr-db import";
	const parsed = parseCommandArgs(operation, argv, {
		db: { type: "string" },
		corpus: { type: "string" },
		evidence: { type: "string" },
	});
	if (!parsed.ok) return parsed;
	const positionalsOk = noPositionals(operation, parsed.value.positionals);
	if (!positionalsOk.ok) return positionalsOk;
	const db = requiredString(parsed.value.values.db, "db", operation);
	if (!db.ok) return db;

	const corpus = parsed.value.values.corpus;
	const evidence = parsed.value.values.evidence;
	const hasCorpus = typeof corpus === "string" && corpus.length > 0;
	const hasEvidence = typeof evidence === "string" && evidence.length > 0;
	if (hasCorpus === hasEvidence) {
		return usageError(operation, "Exactly one of --corpus or --evidence is required");
	}

	const importModule = await loadImportModule();
	if (!importModule.ok) return importModule;

	const opened = openDb(db.value, { create: true });
	if (!opened.ok) return opened;

	const imported = hasCorpus
		? await importModule.value.importCorpusJsonl(opened.value, corpus as string)
		: await importModule.value.importEvidenceJsonl(opened.value, evidence as string);

	const closed = closeDb(opened.value);
	if (!imported.ok) return imported;
	if (!closed.ok) return closed;

	const counts = imported.value;
	const firstFailure =
		counts.failed > 0 && counts.firstFailure !== undefined
			? ` firstFailure=${JSON.stringify(counts.firstFailure)}`
			: "";
	return dbOk(
		`import: imported=${counts.imported} skippedDuplicate=${counts.skippedDuplicate} failed=${counts.failed}${firstFailure}\n`,
	);
}

async function runExport(argv: readonly string[]): Promise<DbResult<string>> {
	const operation = "mrgr-db export";
	const parsed = parseCommandArgs(operation, argv, {
		db: { type: "string" },
		out: { type: "string" },
		"with-blobs": { type: "boolean", default: false },
	});
	if (!parsed.ok) return parsed;
	const positionalsOk = noPositionals(operation, parsed.value.positionals);
	if (!positionalsOk.ok) return positionalsOk;
	const db = requiredString(parsed.value.values.db, "db", operation);
	if (!db.ok) return db;
	const out = requiredString(parsed.value.values.out, "out", operation);
	if (!out.ok) return out;

	const opened = openDb(db.value);
	if (!opened.ok) return opened;

	const exported = exportDb(opened.value, out.value, {
		withBlobs: parsed.value.values["with-blobs"] === true,
	});
	const closed = closeDb(opened.value);
	if (!exported.ok) return exported;
	if (!closed.ok) return closed;

	const tableNames = Object.keys(exported.value.tables);
	const totalRows = Object.values(exported.value.tables).reduce((sum, t) => sum + t.rows, 0);
	return dbOk(
		`export: wrote ${tableNames.length} tables, ${totalRows} rows, to ${resolve(out.value)}\n`,
	);
}

/**
 * integrity_check and foreign_key_check catch corruption and dangling
 * references; openDb already rejected a schema mismatch before this handle
 * existed, so there is nothing left for that check to do here. The blob
 * sweep is the one thing none of the PRAGMAs cover: a row whose bytes no
 * longer match its own sha256 primary key is neither a foreign-key
 * violation nor, in general, something integrity_check's b-tree walk
 * notices, since the row itself is well-formed — only its content lies.
 */
function verifyDb(handle: DbHandle): DbResult<string> {
	let integrityRows: { integrity_check: string }[];
	try {
		integrityRows = handle.db.prepare("PRAGMA integrity_check").all() as {
			integrity_check: string;
		}[];
	} catch (cause) {
		return dbErr("db", "verify db", "integrity_check failed to run", {
			cause: String(cause),
		});
	}
	const integrityProblems = integrityRows
		.map((r) => r.integrity_check)
		.filter((v) => v !== "ok");
	if (integrityProblems.length > 0) {
		return dbErr("db", "verify db", "PRAGMA integrity_check reported problems", {
			problems: JSON.stringify(integrityProblems),
		});
	}

	let fkRows: unknown[];
	try {
		fkRows = handle.db.prepare("PRAGMA foreign_key_check").all();
	} catch (cause) {
		return dbErr("db", "verify db", "foreign_key_check failed to run", {
			cause: String(cause),
		});
	}
	if (fkRows.length > 0) {
		return dbErr("db", "verify db", "PRAGMA foreign_key_check reported violations", {
			violations: JSON.stringify(fkRows),
		});
	}

	let shas: string[];
	try {
		shas = (
			handle.db.prepare("SELECT sha256 FROM blob ORDER BY sha256").all() as {
				sha256: string;
			}[]
		).map((r) => r.sha256);
	} catch (cause) {
		return dbErr("db", "verify db", "Could not list blob rows", { cause: String(cause) });
	}
	for (const sha256 of shas) {
		const got = getBlob(handle, sha256);
		if (!got.ok) return got;
	}

	const counts: Record<string, number> = {};
	for (const table of TABLES) {
		try {
			const row = handle.db.prepare(`SELECT count(*) AS n FROM ${table}`).get() as {
				n: number;
			};
			counts[table] = row.n;
		} catch (cause) {
			return dbErr("db", "verify db", `Could not count table ${table}`, {
				table,
				cause: String(cause),
			});
		}
	}

	const summary = TABLES.map((table) => `${table}=${counts[table]}`).join(" ");
	return dbOk(`verify ok\n${summary}\n`);
}

async function runVerify(argv: readonly string[]): Promise<DbResult<string>> {
	const operation = "mrgr-db verify";
	const parsed = parseCommandArgs(operation, argv, { db: { type: "string" } });
	if (!parsed.ok) return parsed;
	const positionalsOk = noPositionals(operation, parsed.value.positionals);
	if (!positionalsOk.ok) return positionalsOk;
	const db = requiredString(parsed.value.values.db, "db", operation);
	if (!db.ok) return db;

	const opened = openDb(db.value);
	if (!opened.ok) return opened;

	const verified = verifyDb(opened.value);
	const closed = closeDb(opened.value);
	if (!verified.ok) return verified;
	if (!closed.ok) return closed;
	return verified;
}

async function execute(argv: readonly string[]): Promise<DbResult<string | null>> {
	if (argv.length === 1 && argv[0] === "--help") return dbOk(HELP);
	const command = argv[0];
	const rest = argv.slice(1);
	if (command === "init") return runInit(rest);
	if (command === "import") return runImport(rest);
	if (command === "export") return runExport(rest);
	if (command === "verify") return runVerify(rest);
	return usageError("mrgr-db", "A known command is required; use --help", {
		command: command ?? null,
	});
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
	let result: DbResult<string | null>;
	try {
		result = await execute(argv);
	} catch {
		result = dbErr("unsupported", "mrgr-db", "Unexpected mrgr-db failure");
	}
	if (!result.ok) {
		io.stderr(`${JSON.stringify(result.error)}\n`);
		return result.error.kind === "config" ? 2 : 1;
	}
	if (result.value !== null) io.stdout(result.value);
	return 0;
}
