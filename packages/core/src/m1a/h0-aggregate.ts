// this loader persists inputs, not verdicts; see evidence/h0/REVIEW-2026-08-27.md.

import { readFileSync } from "node:fs";
import { basename } from "node:path";

import { closeDb, openDb, type DbHandle } from "../db/open.js";
import { dbErr, dbOk, type DbResult } from "../db/result.js";
import { RunStore, type RunConfig, type RunResultRecord } from "../db/run-store.js";
import type { ImportCounts } from "../db/import.js";

const DECISION_VALUES = new Set<RunResultRecord["decision"]>([
	"keep_ours",
	"keep_theirs",
	"compose",
	"halt",
]);

interface AggregateRow {
	triple_id: string;
	arm: string;
	model: { name: string; sha: string };
	run: number;
	input_tokens: number;
	output_tokens: number;
	decision: string;
	halt_reason: string | null;
	schema_valid: boolean;
	[key: string]: unknown;
}

export interface AggregateOptions {
	files: readonly string[];
	commitPin: string;
}

interface ParsedFile {
	path: string;
	rows: AggregateRow[];
}

function validateRow(row: AggregateRow): { ok: true; decision: RunResultRecord["decision"] } | { ok: false; reason: string } {
	if (typeof row.triple_id !== "string") return { ok: false, reason: "missing triple_id" };
	if (typeof row.arm !== "string") return { ok: false, reason: "missing arm" };
	if (!row.model || typeof row.model.name !== "string" || typeof row.model.sha !== "string") {
		return { ok: false, reason: "missing model.name / model.sha" };
	}
	if (typeof row.run !== "number") return { ok: false, reason: "missing run" };
	if (typeof row.input_tokens !== "number") return { ok: false, reason: "missing input_tokens" };
	if (typeof row.output_tokens !== "number") return { ok: false, reason: "missing output_tokens" };
	if (typeof row.schema_valid !== "boolean") return { ok: false, reason: "missing schema_valid (boolean)" };
	if (typeof row.halt_reason !== "string" && row.halt_reason !== null) {
		return { ok: false, reason: "halt_reason must be string or null" };
	}
	if (!DECISION_VALUES.has(row.decision as RunResultRecord["decision"])) {
		return { ok: false, reason: `decision "${row.decision}" not in CHECK enum` };
	}
	return { ok: true, decision: row.decision as RunResultRecord["decision"] };
}

// Run-id/timestamp token in the canonical H0 file naming convention
// `<arm>-YYYY-MM-DDTHH-MM-SS-MMMZ.jsonl`. The token must match across every
// file in one call, otherwise the loader is silently mixing runs.
function runIdTimestamp(name: string): string | null {
	const m = name.match(/^(?:.+)-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)\.jsonl$/);
	return m === null ? null : (m[1] as string);
}

function parseFile(path: string): ParsedFile | { error: DbResult<never> } {
	let text: string;
	try {
		text = readFileSync(path, "utf8");
	} catch (cause) {
		return {
			error: dbErr("not-found", "h0-aggregate", "JSONL file unreadable", {
				path,
				cause: String(cause),
			}),
		};
	}
	const lines = text.split("\n");
	const rows: AggregateRow[] = [];
	for (const line of lines) {
		if (line.length === 0) continue;
		let parsed: AggregateRow;
		try {
			parsed = JSON.parse(line) as AggregateRow;
		} catch (cause) {
			return {
				error: dbErr("parse", "h0-aggregate", "malformed JSONL line", {
					path,
					cause: String(cause),
				}),
			};
		}
		const v = validateRow(parsed);
		if (!v.ok) {
			return {
				error: dbErr("parse", "h0-aggregate", v.reason, { path }),
			};
		}
		rows.push(parsed);
	}
	return { path, rows };
}

export async function loadH0Aggregate(
	dbPath: string,
	options: AggregateOptions,
): Promise<DbResult<ImportCounts>> {
	// Phase 1: validate options shape.
	if (!Array.isArray(options.files) || options.files.length === 0) {
		return dbErr("config", "h0-aggregate", "options.files must be a non-empty array");
	}
	if (typeof options.commitPin !== "string" || options.commitPin.length === 0) {
		return dbErr("config", "h0-aggregate", "options.commitPin must be a non-empty string");
	}
	// The ruling-supersedes-stale-default override: the legacy `runsDir` key
	// is NOT accepted by this loader at all. The public API is explicit-
	// files + commit-pin only.
	if ("runsDir" in options) {
		return dbErr("config", "h0-aggregate", "options.runsDir is not supported; pass options.files");
	}

	// Phase 2: parse every file before any DB write. A reader-level error
	// surfaces as a typed error; nothing reaches the database.
	const tsSet = new Set<string>();
	const parsedFiles: ParsedFile[] = [];
	for (const file of options.files) {
		const ts = runIdTimestamp(basename(file));
		if (ts === null) {
			return dbErr("config", "h0-aggregate", "filename does not carry a run-id/timestamp", {
				file,
			});
		}
		tsSet.add(ts);
		if (tsSet.size > 1) {
			return dbErr("config", "h0-aggregate", "files do not share one run-id/timestamp", {
				timestamps: JSON.stringify([...tsSet]),
			});
		}
		const parsed = parseFile(file);
		if ("error" in parsed) return parsed.error;
		parsedFiles.push(parsed);
	}

	// Phase 3: per-arm content guards (one arm per file, no duplicate arms).
	const armsSeen = new Map<string, string>(); // arm -> file
	for (const f of parsedFiles) {
		const armsInFile = new Set<string>();
		for (const row of f.rows) armsInFile.add(row.arm);
		if (armsInFile.size !== 1) {
			return dbErr("config", "h0-aggregate", "single file declares multiple arms", {
				path: f.path,
				arms: JSON.stringify([...armsInFile]),
			});
		}
		const arm = [...armsInFile][0] as string;
		if (armsSeen.has(arm)) {
			return dbErr("config", "h0-aggregate", `duplicate arm across files: ${arm}`, {
				first: armsSeen.get(arm) ?? null,
				second: f.path,
			});
		}
		armsSeen.set(arm, f.path);
	}

	// Phase 3b: model metadata must agree across every row in a file because
	// RunConfig records one model identity for the entire arm.
	for (const f of parsedFiles) {
		const first = f.rows[0]!;
		for (const row of f.rows.slice(1)) {
			if (row.model.name !== first.model.name || row.model.sha !== first.model.sha) {
				return dbErr("config", "h0-aggregate", "inconsistent model metadata across rows in one file", {
					path: f.path,
					expected: JSON.stringify({ name: first.model.name, sha: first.model.sha }),
					got: JSON.stringify({ name: row.model.name, sha: row.model.sha }),
					tripleId: row.triple_id,
				});
			}
		}
	}

	// Phase 4: persist every run and result in one transaction. Any late
	// constraint failure rolls the whole import back.
	const opened = openDb(dbPath, { create: true });
	if (!opened.ok) return opened;
	const handle: DbHandle = opened.value;
	const db = handle.db;
	let transactionOpen = false;

	const rollback = (): void => {
		if (!transactionOpen) return;
		db.exec("ROLLBACK");
		transactionOpen = false;
	};

	try {
		db.exec("BEGIN IMMEDIATE");
		transactionOpen = true;
		const store = new RunStore(handle);
		let total = 0;

		for (const f of parsedFiles) {
			const first = f.rows[0]!;
			const config: RunConfig = {
				arm: first.arm,
				modelName: first.model.name,
				modelSha: first.model.sha,
				config: {
					commit_pin: options.commitPin,
					arm: first.arm,
					prompt_template: first,
				},
			};
			const created = store.createRun(config);
			if (!created.ok) {
				rollback();
				return created;
			}
			const runId = created.value;

			for (const row of f.rows) {
				const v = validateRow(row);
				if (!v.ok) {
					rollback();
					return dbErr("parse", "h0-aggregate", v.reason, {
						path: f.path,
						tripleId: row.triple_id,
					});
				}
				const appended = store.appendResult({
					runId,
					tripleId: row.triple_id,
					runIndex: row.run,
					decision: v.decision,
					haltReason: v.decision === "halt" ? (row.halt_reason ?? null) : null,
					reasonText: null,
					inputTokens: row.input_tokens,
					outputTokens: row.output_tokens,
					durationMs: null,
					schemaValid: row.schema_valid,
				});
				if (!appended.ok) {
					rollback();
					return appended;
				}
				total += 1;
			}
		}

		db.exec("COMMIT");
		transactionOpen = false;
		return dbOk({ imported: total, skippedDuplicate: 0, failed: 0 });
	} catch (cause) {
		try {
			rollback();
		} catch {
			/* the original transaction failure is more useful */
		}
		return dbErr("db", "h0-aggregate", "Transactional import failed", {
			cause: String(cause),
		});
	} finally {
		if (transactionOpen) {
			try {
				rollback();
			} catch {
				/* connection may already be unusable */
			}
		}
		closeDb(handle);
	}
}
