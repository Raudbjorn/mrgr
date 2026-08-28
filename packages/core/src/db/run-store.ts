import { canonicalJson, sha256Hex } from "./canonical.js";
import { dbErr, dbOk, type DbResult } from "./result.js";
import type { DbHandle } from "./open.js";

/** SQLite result code for a PRIMARY KEY (or other UNIQUE) constraint violation. */
const SQLITE_CONSTRAINT_PRIMARYKEY = 1555;

export interface RunConfig {
	arm: string;
	modelName: string | null;
	modelSha: string | null;
	config: unknown; // JSON-serializable
}

export interface RunResultRecord {
	runId: string;
	tripleId: string;
	runIndex: number; // 1-based
	decision: "keep_ours" | "keep_theirs" | "compose" | "halt";
	haltReason: string | null;
	reasonText: string | null;
	inputTokens: number | null;
	outputTokens: number | null;
	durationMs: number | null;
	schemaValid: boolean;
}

interface RunResultRow {
	run_id: string;
	triple_id: string;
	run_index: number;
	decision: RunResultRecord["decision"];
	halt_reason: string | null;
	reason_text: string | null;
	input_tokens: number | null;
	output_tokens: number | null;
	duration_ms: number | null;
	schema_valid: number;
}

function rowToRecord(row: RunResultRow): RunResultRecord {
	return {
		runId: row.run_id,
		tripleId: row.triple_id,
		runIndex: row.run_index,
		decision: row.decision,
		haltReason: row.halt_reason,
		reasonText: row.reason_text,
		inputTokens: row.input_tokens,
		outputTokens: row.output_tokens,
		durationMs: row.duration_ms,
		schemaValid: Boolean(row.schema_valid),
	};
}

/**
 * Persists experiment runs (`run`) and their per-item results (`run_result`),
 * replacing the earlier fail-open JSONL runner whose resume logic silently
 * swallowed parse errors instead of surfacing them.
 */
export class RunStore {
	constructor(private readonly handle: DbHandle) {}

	/**
	 * `runId` is derived from the whole config (arm, model identity and the
	 * arbitrary `config` payload together), not just the payload, so two runs
	 * that differ only in arm or model still get distinct ids. Idempotent:
	 * INSERT OR IGNORE plus a read-back guards against a same-id row that
	 * disagrees with this call's content (a genuine hash collision, or the id
	 * space being reused for a different config), mirroring blob.ts's dedup
	 * check.
	 */
	createRun(config: RunConfig): DbResult<string> {
		let runId: string;
		let configJson: string;
		try {
			runId = sha256Hex(canonicalJson(config));
			configJson = canonicalJson(config.config);
		} catch (cause) {
			return dbErr("db", "create run", "Run config is not JSON-serializable", {
				cause: String(cause),
			});
		}

		try {
			this.handle.db
				.prepare(
					"INSERT OR IGNORE INTO run (run_id, arm, model_name, model_sha, config_json, started_at) VALUES (?, ?, ?, ?, ?, ?)",
				)
				.run(runId, config.arm, config.modelName, config.modelSha, configJson, new Date().toISOString());

			const row = this.handle.db
				.prepare("SELECT arm, model_name, model_sha, config_json FROM run WHERE run_id = ?")
				.get(runId) as { arm: string; model_name: string | null; model_sha: string | null; config_json: string };

			if (
				row.arm !== config.arm ||
				row.model_name !== config.modelName ||
				row.model_sha !== config.modelSha ||
				row.config_json !== configJson
			) {
				return dbErr("db", "create run", "Existing run row disagrees with config", {
					runId,
				});
			}
			return dbOk(runId);
		} catch (cause) {
			return dbErr("db", "create run", "Run insert failed", {
				runId,
				cause: String(cause),
			});
		}
	}

	/**
	 * Idempotent for an identical duplicate `(run_id, triple_id, run_index)`
	 * row. A duplicate primary key carrying different content is a genuine
	 * error, not a silent overwrite — this is a plain INSERT (not OR IGNORE)
	 * so that a CHECK-constraint rejection (e.g. `decision: "halt"` with a
	 * null `halt_reason`) also surfaces as an error here rather than being
	 * swallowed the way IGNORE would swallow it.
	 */
	appendResult(result: RunResultRecord): DbResult<void> {
		try {
			this.handle.db
				.prepare(
					`INSERT INTO run_result
						(run_id, triple_id, run_index, decision, halt_reason, reason_text, input_tokens, output_tokens, duration_ms, schema_valid)
						VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				)
				.run(
					result.runId,
					result.tripleId,
					result.runIndex,
					result.decision,
					result.haltReason,
					result.reasonText,
					result.inputTokens,
					result.outputTokens,
					result.durationMs,
					result.schemaValid ? 1 : 0,
				);
			return dbOk(undefined);
		} catch (cause) {
			const sqliteError = cause as { errcode?: number };
			if (sqliteError.errcode === SQLITE_CONSTRAINT_PRIMARYKEY) {
				const existing = this.handle.db
					.prepare(
						`SELECT decision, halt_reason, reason_text, input_tokens, output_tokens, duration_ms, schema_valid
							FROM run_result WHERE run_id = ? AND triple_id = ? AND run_index = ?`,
					)
					.get(result.runId, result.tripleId, result.runIndex) as RunResultRow | undefined;

				const identical =
					existing !== undefined &&
					existing.decision === result.decision &&
					existing.halt_reason === result.haltReason &&
					existing.reason_text === result.reasonText &&
					existing.input_tokens === result.inputTokens &&
					existing.output_tokens === result.outputTokens &&
					existing.duration_ms === result.durationMs &&
					Boolean(existing.schema_valid) === result.schemaValid;

				if (identical) return dbOk(undefined);
				return dbErr("db", "append result", "Existing run_result row disagrees with content", {
					runId: result.runId,
					tripleId: result.tripleId,
					runIndex: result.runIndex,
				});
			}
			return dbErr("db", "append result", "Run result insert failed", {
				runId: result.runId,
				tripleId: result.tripleId,
				runIndex: result.runIndex,
				cause: String(cause),
			});
		}
	}

	/**
	 * Keys already recorded for this run, for resuming an interrupted
	 * experiment. Selects only the primary-key columns — this replaces the
	 * old JSONL runner's whole-file rescan, so it must stay a PK-only query
	 * rather than materializing every row's full content.
	 */
	resumeKeys(runId: string): DbResult<Set<string>> {
		try {
			const rows = this.handle.db
				.prepare("SELECT triple_id, run_index FROM run_result WHERE run_id = ?")
				.all(runId) as { triple_id: string; run_index: number }[];
			return dbOk(new Set(rows.map((row) => `${row.triple_id}|${row.run_index}`)));
		} catch (cause) {
			return dbErr("db", "resume keys", "Resume key query failed", {
				runId,
				cause: String(cause),
			});
		}
	}

	/** All results for a run, in insertion-stable order. */
	listResults(runId: string): DbResult<RunResultRecord[]> {
		try {
			const rows = this.handle.db
				.prepare(
					`SELECT run_id, triple_id, run_index, decision, halt_reason, reason_text, input_tokens, output_tokens, duration_ms, schema_valid
						FROM run_result WHERE run_id = ? ORDER BY triple_id, run_index`,
				)
				.all(runId) as unknown as RunResultRow[];
			return dbOk(rows.map(rowToRecord));
		} catch (cause) {
			return dbErr("db", "list results", "Run result query failed", {
				runId,
				cause: String(cause),
			});
		}
	}
}
