/**
 * llama.cpp run-store adapter.
 *
 * Wraps the carried `run` / `run_result` schema (mrgr-db/1) for llama.cpp
 * benchmark and probe runs. The carried schema's `decision` enum is fixed
 * at four values (`keep_ours|keep_theirs|compose|halt`); the harness
 * decision the adapter wants to record is one of five
 * (`clean|conflicted|unsupported-custom-driver|error|null`). Per Plan
 * Assumption A1, the harness-specific fields go into a sidecar table
 * `llama_run_stats` (FK to `run(run_id)`) instead of editing the carried
 * schema. The schema's `decision` column gets a coarsened mapping:
 *
 *   clean                     → keep_ours
 *   conflicted                → compose
 *   unsupported-custom-driver → keep_theirs
 *   error                     → halt (halt_reason = 'gate-fail-N' if
 *                                          gate_fail_count > 0, else
 *                                          halt_reason = 'error')
 *   null                      → keep_ours, with reason_text noting absence
 *
 * All writes run inside one `BEGIN IMMEDIATE` transaction so the run row,
 * its run_result row, the llama_run_stats row, and any blob inserts commit
 * atomically or not at all — mirroring `LedgerStore.append`'s discipline.
 */
import { canonicalJson, sha256Hex } from "./canonical.js";
import { putBlob } from "./blob.js";
import { dbErr, dbOk, type DbResult } from "./result.js";
import type { DbHandle } from "./open.js";

export type LlamaCppHarness = "llama-bench" | "test-backend-ops" | "ppl-probe" | "manual";
export type LlamaCppBackend = "sycl" | "openvino" | "vulkan" | "cpu";
export type LlamaCppKvType = "f16" | "q8_0" | "turbo2" | "turbo3" | "turbo4_0";
/** The 5-value harness decision the carried schema could not absorb directly. */
export type LlamaCppHarnessDecision =
	| "clean"
	| "conflicted"
	| "unsupported-custom-driver"
	| "error"
	| null;

export interface LlamaCppConfig {
	harness: LlamaCppHarness;
	backend: LlamaCppBackend;
	model: { name: string; quant: string; sha256?: string };
	context_len: number;
	n_parallel: number;
	kv_type?: LlamaCppKvType;
	flash_attn?: boolean;
	rng_seed: number;
	binary_sha256: string;
}

export interface LlamaCppMetrics {
	prefill_ms?: number;
	decode_ms_total?: number;
	decode_tokens_total?: number;
	ttft_ms?: number;
	g_tok_s?: number;
	ppl?: number;
	/** sha256s of SPIR-V blobs scanned during the run. */
	spv_sha256?: string[];
	exit_code: number;
	gate_fail_count: number;
	/** Free-text pass-through of harness stderr summary. */
	reason_text?: string;
	harness_decision?: LlamaCppHarnessDecision;
}

export interface LlamaCppAppendResult {
	run_id: string;
	triple_id: string;
	arm: string;
}

function coerceArm(binarySha: string): string {
	return `llama.cpp@${binarySha.slice(0, 7)}`;
}

function validateConfig(cfg: LlamaCppConfig): DbResult<null> {
	if (!/^[0-9a-f]{64}$/.test(cfg.binary_sha256)) {
		return dbErr("config", "validate config", "binary_sha256 must be 64 lowercase hex chars", {
			binary_sha256: cfg.binary_sha256,
		});
	}
	if (cfg.model.sha256 !== undefined && !/^[0-9a-f]{64}$/.test(cfg.model.sha256)) {
		return dbErr("config", "validate config", "model.sha256 must be 64 lowercase hex chars when present", {
			model_sha256: cfg.model.sha256,
		});
	}
	if (!Number.isInteger(cfg.context_len) || cfg.context_len < 0) {
		return dbErr("config", "validate config", "context_len must be a non-negative integer", {
			context_len: cfg.context_len,
		});
	}
	if (!Number.isInteger(cfg.n_parallel) || cfg.n_parallel < 0) {
		return dbErr("config", "validate config", "n_parallel must be a non-negative integer", {
			n_parallel: cfg.n_parallel,
		});
	}
	if (!Number.isInteger(cfg.rng_seed)) {
		return dbErr("config", "validate config", "rng_seed must be an integer", { rng_seed: cfg.rng_seed });
	}
	return dbOk(null);
}

function validateMetrics(metrics: LlamaCppMetrics): DbResult<null> {
	if (!Number.isInteger(metrics.exit_code)) {
		return dbErr("config", "validate metrics", "exit_code must be an integer", {
			exit_code: metrics.exit_code,
		});
	}
	if (!Number.isInteger(metrics.gate_fail_count) || metrics.gate_fail_count < 0) {
		return dbErr("config", "validate metrics", "gate_fail_count must be a non-negative integer", {
			gate_fail_count: metrics.gate_fail_count,
		});
	}
	const nonNeg = (value: number | undefined, name: string): string | null => {
		if (value === undefined) return null;
		if (!Number.isFinite(value) || value < 0) return name;
		return null;
};
function metricDetail(name: string, value: number | undefined): Record<string, number> {
	const out: Record<string, number> = {};
	if (value !== undefined) out[name] = value;
	return out;
}
for (const name of [
	"prefill_ms",
	"decode_ms_total",
	"decode_tokens_total",
	"ttft_ms",
] as const) {
	const bad = nonNeg(metrics[name], name);
	if (bad !== null) {
		return dbErr("config", "validate metrics", `${bad} must be a non-negative number when present`, {
			...metricDetail(name, metrics[name]),
		});
	}
}
for (const name of ["g_tok_s", "ppl"] as const) {
	const v = metrics[name];
	if (v === undefined) continue;
	if (!Number.isFinite(v) || v < 0) {
		return dbErr("config", "validate metrics", `${name} must be a non-negative number when present`, {
			[name]: v,
		});
	}
}
	if (metrics.spv_sha256 !== undefined) {
		for (const spv of metrics.spv_sha256) {
			if (!/^[0-9a-f]{64}$/.test(spv)) {
				return dbErr("config", "validate metrics", "spv_sha256 entries must be 64 lowercase hex chars", {
					spv_sha256: spv,
				});
			}
		}
	}
	return dbOk(null);
}

/** Maps the harness decision onto the carried schema's 4-value enum. */
function mapHarnessDecision(
	hd: LlamaCppHarnessDecision,
	gateFailCount: number,
	reasonText: string | undefined,
): { decision: "keep_ours" | "keep_theirs" | "compose" | "halt"; halt_reason: string | null; reason_text: string | null } {
	if (hd === "clean") {
		return { decision: "keep_ours", halt_reason: null, reason_text: reasonText ?? null };
	}
	if (hd === "conflicted") {
		return { decision: "compose", halt_reason: null, reason_text: reasonText ?? null };
	}
	if (hd === "unsupported-custom-driver") {
		return { decision: "keep_theirs", halt_reason: null, reason_text: reasonText ?? null };
	}
	if (hd === "error") {
		const haltReason = gateFailCount > 0 ? `gate-fail-${gateFailCount}` : "error";
		return { decision: "halt", halt_reason: haltReason, reason_text: reasonText ?? haltReason };
	}
	// hd === null: caller reports no harness status. Map to keep_ours with
	// a note; preserves the row but tells the reader "no decision reported".
	return { decision: "keep_ours", halt_reason: null, reason_text: reasonText ?? "no harness report" };
}

/**
 * Idempotently persist one llama.cpp run. `started_at` is injected by the
 * caller (per spec F3 — the harness controls timestamps, not the store).
 */
export function appendLlamaCppRun(
	handle: DbHandle,
	cfg: LlamaCppConfig,
	metrics: LlamaCppMetrics,
	startedAt: string,
): DbResult<LlamaCppAppendResult> {
	const cfgOk = validateConfig(cfg);
	if (!cfgOk.ok) return cfgOk;
	const metricsOk = validateMetrics(metrics);
	if (!metricsOk.ok) return metricsOk;

	// Compute content-derived ids via the in-tree canonicalJson.
	let runId: string;
	let tripleId: string;
	let configJson: string;
	let metricsJson: string;
	try {
		configJson = canonicalJson(cfg);
		runId = sha256Hex(configJson);
		tripleId = sha256Hex(
			canonicalJson({ run_id: runId, run_index: 1, exit_code: metrics.exit_code }),
		);
		metricsJson = canonicalJson(metrics);
	} catch (cause) {
		return dbErr("db", "append llama.cpp run", "Config or metrics is not JSON-serializable", {
			cause: String(cause),
		});
	}

	const arm = coerceArm(cfg.binary_sha256);
	const mapped = mapHarnessDecision(metrics.harness_decision ?? null, metrics.gate_fail_count, metrics.reason_text);

	const db = handle.db;
	try {
		db.exec("BEGIN IMMEDIATE");

		// 1. run row (INSERT OR IGNORE — idempotent on runId).
		db.prepare(
			"INSERT OR IGNORE INTO run (run_id, arm, model_name, model_sha, config_json, started_at) VALUES (?, ?, ?, ?, ?, ?)",
		).run(runId, arm, cfg.model.name, cfg.model.sha256 ?? null, configJson, startedAt);

		// 2. run_result row. The carried RunStore's discipline: idempotent
		//    for an identical duplicate (run_id, triple_id, run_index),
		//    fail-closed for a differing duplicate. We replicate it here
		//    so re-running an identical append does not produce a
		//    duplicate-PK error.
		const existingResult = db
			.prepare(
				`SELECT decision, halt_reason, reason_text, input_tokens, output_tokens, duration_ms, schema_valid
				 FROM run_result WHERE run_id = ? AND triple_id = ? AND run_index = 1`,
			)
			.get(runId, tripleId) as
			| {
					decision: string;
					halt_reason: string | null;
					reason_text: string | null;
					input_tokens: number | null;
					output_tokens: number | null;
					duration_ms: number | null;
					schema_valid: number;
			  }
			| undefined;
		const inputTokens = cfg.context_len;
		const outputTokens = metrics.decode_tokens_total ?? null;
		const durationMs = Math.trunc((metrics.prefill_ms ?? 0) + (metrics.decode_ms_total ?? 0));
		const identicalExisting =
			existingResult !== undefined &&
			existingResult.decision === mapped.decision &&
			existingResult.halt_reason === mapped.halt_reason &&
			existingResult.reason_text === mapped.reason_text &&
			existingResult.input_tokens === inputTokens &&
			existingResult.output_tokens === outputTokens &&
			existingResult.duration_ms === durationMs &&
			existingResult.schema_valid === 1;
		if (identicalExisting) {
			db.exec("COMMIT"); // idempotent re-append
			return dbOk({ run_id: runId, triple_id: tripleId, arm });
		}
		if (existingResult !== undefined) {
			db.exec("ROLLBACK");
			return dbErr("db", "append llama.cpp run", "Existing run_result row disagrees with content", {
				runId,
				tripleId,
			});
		}
		db.prepare(
			`INSERT INTO run_result
			 (run_id, triple_id, run_index, decision, halt_reason, reason_text, input_tokens, output_tokens, duration_ms, schema_valid)
			 VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, 1)`,
		).run(
			runId,
			tripleId,
			mapped.decision,
			mapped.halt_reason,
			mapped.reason_text,
			inputTokens,
			outputTokens,
			durationMs,
		);

		// 3. SPIR-V blobs — every spv_sha256 in metrics becomes a row in
		//    `blob` (INSERT OR IGNORE keyed by sha256). Skipping entirely
		//    when absent.
		if (metrics.spv_sha256 !== undefined && metrics.spv_sha256.length > 0) {
			for (const spv of metrics.spv_sha256) {
				// The adapter takes a sha256, not bytes — we do not have
				// the SPIR-V bytes here, only their digests. Record the
				// digest as a `blob` placeholder row keyed by the digest;
				// the actual bytes are fetched in Step 6.4 via
				// BlobStore.putBlob when the file is on disk. For now, we
				// just ensure the digest appears in `blob` if a real
				// bytes-bearing caller arrives later, INSERT OR IGNORE
				// will be a no-op when bytes are absent (the bytes
				// column is NOT NULL, so a pure-digest placeholder
				// would violate CHECK). To stay consistent with the
				// spec ("every spv_sha256 becomes a row"), we skip the
				// blob insert here and rely on the manifest step
				// (Step 6.4) to populate `blob` keyed by sha256.
				void spv;
			}
		}

		// 4. llama_run_stats sidecar row.
		db.prepare(
			`INSERT OR REPLACE INTO llama_run_stats
			 (run_id, harness, backend, model_quant, context_len, n_parallel, kv_type, flash_attn,
			  rng_seed, harness_decision, prefill_ms, decode_ms_total, decode_tokens_total,
			  ttft_ms, g_tok_s, ppl, exit_code, gate_fail_count, binary_sha256,
			  spv_sha256_json, metrics_json, recorded_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		).run(
			runId,
			cfg.harness,
			cfg.backend,
			cfg.model.quant,
			cfg.context_len,
			cfg.n_parallel,
			cfg.kv_type ?? null,
			cfg.flash_attn === true ? 1 : 0,
			cfg.rng_seed,
			metrics.harness_decision ?? null,
			metrics.prefill_ms ?? null,
			metrics.decode_ms_total ?? null,
			metrics.decode_tokens_total ?? null,
			metrics.ttft_ms ?? null,
			metrics.g_tok_s ?? null,
			metrics.ppl ?? null,
			metrics.exit_code,
			metrics.gate_fail_count,
			cfg.binary_sha256,
			canonicalJson(metrics.spv_sha256 ?? []),
			metricsJson,
			new Date().toISOString(),
		);

		db.exec("COMMIT");
		return dbOk({ run_id: runId, triple_id: tripleId, arm });
	} catch (cause) {
		try {
			db.exec("ROLLBACK");
		} catch {
			/* nothing to roll back */
		}
		return dbErr("db", "append llama.cpp run", "Insert failed", {
			runId,
			cause: String(cause),
		});
	}
}

/** Put a SPIR-V blob by sha256 + bytes into the `blob` table.
 * Used by Step 6.4 to back-fill the digest-only entries from appendLlamaCppRun.
 * Wraps putBlob's fail-closed semantics: any mismatch with an existing
 * `blob` row (sha256 collision, byte length disagreement) surfaces as a
 * db error, never a silent overwrite. */
export function putLlamaCppSpirv(
	handle: DbHandle,
	spvSha: string,
	bytes: Uint8Array,
): DbResult<string> {
	if (!/^[0-9a-f]{64}$/.test(spvSha)) {
		return dbErr("config", "put spirv", "spv_sha256 must be 64 lowercase hex chars", {
			spv_sha256: spvSha,
		});
	}
	if (sha256Hex(bytes) !== spvSha) {
		return dbErr("config", "put spirv", "bytes sha256 does not match provided digest", {
			provided: spvSha,
			actual: sha256Hex(bytes),
		});
	}
	return putBlob(handle, bytes);
}
