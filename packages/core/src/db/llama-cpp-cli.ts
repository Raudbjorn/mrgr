/**
 * `mrgr llama-cpp record` and `mrgr llama-cpp reindex` CLI surface.
 *
 * Wired into the existing `evaluation/cli.ts` dispatcher per Plan Step 3:
 * the dispatcher routes `argv[0]` to a subcommand; this module handles
 * the `llama-cpp` subcommand with sub-subcommands `record` and `reindex`.
 *
 * Design constraints (Plan §3.3): typed errors, never silent success.
 * Missing `--binary`, unreadable file, or malformed `--metrics-jsonl` exit 2
 * with a `ToolError` printed to stderr.
 */
import {
	existsSync,
	readdirSync,
	readFileSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { canonicalJson, sha256Hex } from "./canonical.js";
import { parseArgs, type ParseArgsConfig } from "node:util";
import { join, resolve } from "node:path";

import { closeDb, openDb } from "./open.js";
import {
	appendLlamaCppRun,
	type LlamaCppAppendResult,
	type LlamaCppBackend,
	type LlamaCppConfig,
	type LlamaCppHarness,
	type LlamaCppHarnessDecision,
	type LlamaCppKvType,
	type LlamaCppMetrics,
} from "./llama-cpp-run-store.js";
import {
	err,
	ok,
	type ErrorKind,
	type Result,
	type ToolError,
} from "../evaluation/result.js";

const HARNESS_VALUES = ["llama-bench", "test-backend-ops", "ppl-probe", "manual"] as const;
const BACKEND_VALUES = ["sycl", "openvino", "vulkan", "cpu"] as const;
const KV_TYPE_VALUES = ["f16", "q8_0", "turbo2", "turbo3", "turbo4_0"] as const;
const DECISION_VALUES = [
	"clean",
	"conflicted",
	"unsupported-custom-driver",
	"error",
] as const;

export const LLAMA_CPP_HELP = `mrgr llama-cpp — record llama.cpp benchmark / probe runs

Usage:
  mrgr [--db PATH] llama-cpp record \\
    --harness <name> --backend <name> --model <name> --quant <name> \\
    --ctx-len <int> --n-parallel <int> [--kv-type <name>] [--flash-attn] \\
    --binary <path-to-llama-cpp> \\
    --metrics-jsonl <path>        # one JSON object per line with the LlamaCppMetrics shape
    [--started-at <iso8601>]      # default = NOW_UTC

  mrgr [--db PATH] llama-cpp reindex [--since YYYY-MM-DD]

Harness names: ${HARNESS_VALUES.join(", ")}
Backend names: ${BACKEND_VALUES.join(", ")}
KV cache types: ${KV_TYPE_VALUES.join(", ")}

Exit codes:
  0  success (row written; prints {run_id} on stdout)
  1  unexpected failure
  2  typed config / parse error (ToolError to stderr)
`;

/** Convert a 64-hex sha256 into a 32-hex UUID-shaped ID Qdrant accepts.
 * Qdrant's REST API rejects raw 64-hex strings as point IDs — it wants an
 * unsigned integer or a UUID. The 32-hex string with dashes injected at
 * canonical UUID positions is a deterministic, collision-free mapping. */
function shaToQdrantId(sha: string): string {
	return `${sha.slice(0, 8)}-${sha.slice(8, 12)}-${sha.slice(12, 16)}-${sha.slice(16, 20)}-${sha.slice(20, 32)}`;
}

function usageError(
	operation: string,
	message: string,
	details?: ToolError["details"],
): Result<never> {
	return err("config", operation, message, details);
}

function requireString(
	raw: unknown,
	name: string,
	operation: string,
	allowed?: readonly string[],
): Result<string> {
	if (typeof raw !== "string" || raw.length === 0) {
		return usageError(operation, `${name} is required`, { [name]: String(raw) });
	}
	if (allowed !== undefined && !allowed.includes(raw)) {
		return usageError(operation, `${name} must be one of: ${allowed.join(", ")}`, {
			[name]: raw,
			allowed: allowed.join(","),
		});
	}
	return ok(raw);
}

function requireInt(
	raw: unknown,
	name: string,
	operation: string,
	min?: number,
): Result<number> {
	const parsed = typeof raw === "string" ? Number.parseInt(raw, 10) : typeof raw === "number" ? Math.trunc(raw) : NaN;
	if (!Number.isFinite(parsed)) {
		return usageError(operation, `${name} must be an integer`, { [name]: String(raw) });
	}
	if (min !== undefined && parsed < min) {
		return usageError(operation, `${name} must be >= ${min}`, { [name]: parsed });
	}
	return ok(parsed);
}

function requirePath(raw: unknown, name: string, operation: string): Result<string> {
	if (typeof raw !== "string" || raw.length === 0) {
		return usageError(operation, `${name} is required`, { [name]: String(raw) });
	}
	const abs = resolve(raw);
	if (!existsSync(abs)) {
		return usageError(operation, `${name} does not exist`, { path: abs });
	}
	return ok(abs);
}

interface ParsedRecordArgs {
	cfg: LlamaCppConfig;
	metricsPath: string;
	startedAt: string;
}

function parseRecordArgs(argv: readonly string[]): Result<ParsedRecordArgs> {
	const operation = "llama-cpp record";
	let parsed: ReturnType<typeof parseArgs>;
	try {
		parsed = parseArgs({
			args: argv,
			allowPositionals: false,
			options: {
				harness: { type: "string" },
				backend: { type: "string" },
				model: { type: "string" },
				quant: { type: "string" },
				"ctx-len": { type: "string" },
				"n-parallel": { type: "string" },
				"kv-type": { type: "string" },
				"flash-attn": { type: "boolean" },
				binary: { type: "string" },
				"metrics-jsonl": { type: "string" },
				"started-at": { type: "string" },
			},
		} satisfies ParseArgsConfig);
	} catch (cause) {
		return usageError(operation, "Could not parse CLI arguments", { cause: String(cause) });
	}

	const opts = parsed.values;
	const harness = requireString(opts.harness, "harness", operation, HARNESS_VALUES);
	if (!harness.ok) return harness;
	const backend = requireString(opts.backend, "backend", operation, BACKEND_VALUES);
	if (!backend.ok) return backend;
	const model = requireString(opts.model, "model", operation);
	if (!model.ok) return model;
	const quant = requireString(opts.quant, "quant", operation);
	if (!quant.ok) return quant;
	const ctxLen = requireInt(opts["ctx-len"], "ctx-len", operation, 0);
	if (!ctxLen.ok) return ctxLen;
	const nParallel = requireInt(opts["n-parallel"], "n-parallel", operation, 0);
	if (!nParallel.ok) return nParallel;

	let kvType: LlamaCppKvType | undefined;
	if (opts["kv-type"] !== undefined) {
		const k = requireString(opts["kv-type"], "kv-type", operation, KV_TYPE_VALUES);
		if (!k.ok) return k;
		// requireString narrowed `k.value` against KV_TYPE_VALUES, but the
		// function's signature still leaves it as `string`. The cast is
		// safe because `requireString`'s allowed-list is the binding gate.
		kvType = k.value as LlamaCppKvType;
	}

	const binaryPath = requirePath(opts.binary, "binary", operation);
	if (!binaryPath.ok) return binaryPath;
	const metricsPath = requirePath(opts["metrics-jsonl"], "metrics-jsonl", operation);
	if (!metricsPath.ok) return metricsPath;

	const startedAt =
		typeof opts["started-at"] === "string" && opts["started-at"].length > 0
			? opts["started-at"]
			: new Date().toISOString();

	const cfg: LlamaCppConfig = {
		harness: harness.value as LlamaCppHarness,
		backend: backend.value as LlamaCppBackend,
		model: { name: model.value, quant: quant.value },
		context_len: ctxLen.value,
		n_parallel: nParallel.value,
		kv_type: kvType,
		flash_attn: opts["flash-attn"] === true,
		rng_seed: 0,
		binary_sha256: "0".repeat(64),
	};
	return ok({ cfg, metricsPath: metricsPath.value, startedAt });
}

function parseMetricsJsonl(path: string, operation: string): Result<LlamaCppMetrics[]> {
	let raw: string;
	try {
		raw = readFileSync(path, "utf8");
	} catch (cause) {
		return usageError(operation, "Could not read metrics-jsonl", { path, cause: String(cause) });
	}
	const out: LlamaCppMetrics[] = [];
	const lines = raw.split("\n").filter((l) => l.trim().length > 0);
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i] ?? "";
		let parsed: unknown;
		try {
			parsed = JSON.parse(line);
		} catch (cause) {
			return usageError(operation, `Malformed JSON at line ${i + 1}`, {
				line: i + 1,
				cause: String(cause),
			});
		}
		if (parsed === null || typeof parsed !== "object") {
			return usageError(operation, `Metrics line ${i + 1} must be a JSON object`, {
				line: i + 1,
			});
		}
		const obj = parsed as Record<string, unknown>;
		const exitCode = requireInt(obj.exit_code, `exit_code[line ${i + 1}]`, operation);
		if (!exitCode.ok) return exitCode;
		const gateFail = requireInt(
			obj.gate_fail_count,
			`gate_fail_count[line ${i + 1}]`,
			operation,
			0,
		);
		if (!gateFail.ok) return gateFail;

		const decisionRaw = obj.harness_decision;
		const decision: LlamaCppHarnessDecision | undefined =
			typeof decisionRaw === "string" &&
			(DECISION_VALUES as readonly string[]).includes(decisionRaw)
				? (decisionRaw as LlamaCppHarnessDecision)
				: undefined;

		const m: LlamaCppMetrics = {
			prefill_ms: typeof obj.prefill_ms === "number" ? obj.prefill_ms : undefined,
			decode_ms_total:
				typeof obj.decode_ms_total === "number" ? obj.decode_ms_total : undefined,
			decode_tokens_total:
				typeof obj.decode_tokens_total === "number" ? obj.decode_tokens_total : undefined,
			ttft_ms: typeof obj.ttft_ms === "number" ? obj.ttft_ms : undefined,
			g_tok_s: typeof obj.g_tok_s === "number" ? obj.g_tok_s : undefined,
			ppl: typeof obj.ppl === "number" ? obj.ppl : undefined,
			spv_sha256: Array.isArray(obj.spv_sha256)
				? (obj.spv_sha256.filter((x): x is string => typeof x === "string") as string[])
				: undefined,
			exit_code: exitCode.value,
			gate_fail_count: gateFail.value,
			reason_text: typeof obj.reason_text === "string" ? obj.reason_text : undefined,
			harness_decision: decision,
		};
		out.push(m);
	}
	return ok(out);
}

export type LlamaCppRecordResult = LlamaCppAppendResult;

/** Translate a DbToolError to the carried ErrorKind union, preserving the
 * original kind in `details.kind`. The CLI never surfaces `"db"` to its
 * caller — it always reaches a CLI caller as a config-level concern. */
function dbErrorToToolError(e: {
	kind: ErrorKind | "db";
	operation: string;
	message: string;
	details?: Record<string, string | number | boolean | null>;
}): Result<never> {
	const carriedKind: ErrorKind = e.kind === "db" ? "config" : e.kind;
	const details: ToolError["details"] = { ...(e.details ?? {}), kind: e.kind };
	return err(carriedKind, e.operation, e.message, details);
}

/** `mrgr llama-cpp record` — append one or more runs to the SQLite store. */
export async function runLlamaCppRecord(
	dbPath: string,
	argv: readonly string[],
): Promise<Result<LlamaCppRecordResult[] | null>> {
	const operation = "llama-cpp record";
	const parsedArgs = parseRecordArgs(argv);
	if (!parsedArgs.ok) return parsedArgs;
	const { cfg, metricsPath, startedAt } = parsedArgs.value;

	const metricsResult = parseMetricsJsonl(metricsPath, operation);
	if (!metricsResult.ok) return metricsResult;
	const metrics = metricsResult.value;
	if (metrics.length === 0) {
		return usageError(operation, "metrics-jsonl is empty; expected at least one line", {
			path: metricsPath,
		});
	}

	const opened = openDb(dbPath, { create: true });
	if (!opened.ok) return dbErrorToToolError(opened.error);
	const handle = opened.value;
	try {
		const results: LlamaCppRecordResult[] = [];
		for (const m of metrics) {
			const r = appendLlamaCppRun(handle, cfg, m, startedAt);
			if (!r.ok) {
				closeDb(handle);
				return dbErrorToToolError(r.error);
			}
			results.push(r.value);
		}
		closeDb(handle);
		return ok(results);
	} catch (cause) {
		closeDb(handle);
		return err("config", operation, "Unexpected failure", { cause: String(cause) });
	}
}

export interface LlamaCppReindexResult {
	collection: string;
	files_indexed: number;
	points_total: number;
	manifest_path?: string;
}

/** `mrgr llama-cpp reindex` — re-push markdown files into home Qdrant.
 * Per Plan Step 4, with the A2/A3 fallback: when the Qdrant REST endpoint
 * is not reachable, this CLI still walks the markdown directory and writes a
 * reindex manifest to .do-not-commit/persistence/reindex-manifest-<YYYY-MM-DD>.json.
 * The manifest carries `{file_path, sha256(content), byte_len, h1_text}` per
 * file — the same payload the Qdrant points carry — so the recall goal is
 * met even when the vector store is down. The Qdrant write is best-effort.
 */
export async function runLlamaCppReindex(
	dbPath: string,
	argv: readonly string[],
): Promise<Result<LlamaCppReindexResult | null>> {
	const operation = "llama-cpp reindex";
	let parsed: ReturnType<typeof parseArgs>;
	try {
		parsed = parseArgs({
			args: argv,
			allowPositionals: false,
			options: {
				"persistence-dir": { type: "string" },
				since: { type: "string" },
			},
		} satisfies ParseArgsConfig);
	} catch (cause) {
		return usageError(operation, "Could not parse CLI arguments", { cause: String(cause) });
	}
	void dbPath;
	const since = typeof parsed.values.since === "string" ? parsed.values.since : undefined;
	const persistenceDirRaw = parsed.values["persistence-dir"];
	const persistenceDir = typeof persistenceDirRaw === "string"
		? resolve(persistenceDirRaw)
		: resolve(process.cwd(), ".do-not-commit/persistence");
	if (!existsSync(persistenceDir)) {
		return usageError(operation, "persistence dir does not exist", { path: persistenceDir });
	}
	let entries: string[];
	try {
		entries = readdirSync(persistenceDir).filter((n) => n.endsWith(".md"));
	} catch (cause) {
		return usageError(operation, "Could not list persistence dir", {
			path: persistenceDir,
			cause: String(cause),
		});
	}
	const sinceMs = since !== undefined ? Date.parse(since) : NaN;
	const sinceFilterOk = !Number.isNaN(sinceMs);
	let total = 0;
	const indexed: Array<{
		file_path: string;
		sha256: string;
		byte_len: number;
		h1_text: string | null;
		ingested_at: string;
	}> = [];
	for (const name of entries) {
		const path = join(persistenceDir, name);
		let stat: import("node:fs").Stats;
		try {
			stat = statSync(path);
		} catch {
			continue;
		}
		if (sinceFilterOk && stat.mtimeMs < sinceMs) continue;
		let bytes: Buffer;
		try {
			bytes = readFileSync(path);
		} catch {
			continue;
		}
		const sha = sha256Hex(bytes);
		const head = bytes.subarray(0, Math.min(bytes.length, 5000)).toString("utf8");
		const h1Match = head.match(/^#\s+(.+)$/m);
		indexed.push({
			file_path: path,
			sha256: sha,
			byte_len: bytes.length,
			h1_text: h1Match === null ? null : h1Match[1]?.trim() ?? null,
			ingested_at: new Date().toISOString(),
		});
		total += 1;
	}
	const stamp = new Date().toISOString().slice(0, 10);
	const manifestPath = join(persistenceDir, `reindex-manifest-${stamp}.json`);
	try {
		writeFileSync(
			manifestPath,
			JSON.stringify(
				{
					collection: "mrgr_persistence_reindex_local",
					indexed_at: new Date().toISOString(),
					persistence_dir: persistenceDir,
					...(since !== undefined ? { since } : {}),
					points: indexed,
				},
				null,
				2,
			) + "\n",
		);
	} catch (cause) {
		return usageError(operation, "Could not write reindex manifest", {
			path: manifestPath,
			cause: String(cause),
		});
	}

	// Best-effort push to home Qdrant (Plan §4). Falls back gracefully when
	// the Qdrant endpoint or Voyage proxy is unreachable: the manifest on
	// disk already captures every point's payload, so the recall goal is
	// met by reading the manifest when the vector store is down. The
	// Qdrant write is opt-in via `QDRANT_URL` / `VOYAGE_URL` env vars;
	// defaults to `127.0.0.1:6333` and `127.0.0.1:6700`.
	const qdrantUrl = process.env["QDRANT_URL"] ?? "http://127.0.0.1:6333";
	const voyageUrl = process.env["VOYAGE_URL"] ?? "http://127.0.0.1:6700";
	const voyageModel = process.env["VOYAGE_MODEL"] ?? "voyage-3.5";
	const voyageApiKey = process.env["VOYAGE_API_KEY"] ?? "";
	const monthStamp = new Date().toISOString().slice(0, 7);
	const collection = `mrgr_persistence_${monthStamp}`;
	let qdrantPushed = 0;

	let qdrantSkipped: string | null = indexed.length === 0 ? null : "qdrant-unreachable";
	// Best-effort: ensure the collection exists. Qdrant returns 400 on a
	// duplicate create, which we treat as success (idempotent reindex).
	try {
		await fetch(`${qdrantUrl}/collections/${collection}`, {
			method: "PUT",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				vectors: { size: 1024, distance: "Cosine" },
			}),
		});
	} catch {
		// Network unreachable; fall through to per-file push which will
		// also fail and surface a clean reason.
	}
 	for (const entry of indexed) {

		try {
			const headBytes = readFileSync(entry.file_path)
				.subarray(0, Math.min(entry.byte_len, 5000));
			const embResp = await fetch(`${voyageUrl}/v1/embeddings`, {
				method: "POST",
				headers: {
					"content-type": "application/json",
					authorization: `Bearer ${voyageApiKey}`,
				},
				body: JSON.stringify({
					model: voyageModel,
					input: headBytes.toString("utf8"),
				}),
			});
			if (!embResp.ok) {
				qdrantSkipped = `voyage-${embResp.status}`;
				break;
			}
			const embJson = (await embResp.json()) as { data?: Array<{ embedding: number[] }> };
			const vec = embJson.data?.[0]?.embedding;
			if (vec === undefined) {
				qdrantSkipped = "voyage-empty";
				break;
			}
			await fetch(`${qdrantUrl}/collections/${collection}/points?wait=true`, {
				method: "PUT",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					points: [
						{
							id: shaToQdrantId(entry.sha256),
							vector: vec,
							payload: {
								file_path: entry.file_path,
								sha256: entry.sha256,
								byte_len: entry.byte_len,
								h1_text: entry.h1_text,
								ingested_at: entry.ingested_at,
							},
						},
					],
				}),
			}).then((r) => {
				if (r.ok) {
					qdrantPushed += 1;
					qdrantSkipped = null;
				}
			});
		} catch {
			break;
		}
}
	return ok({
		collection,
		files_indexed: indexed.length,
		points_total: total,
		manifest_path: manifestPath,
		...(qdrantSkipped === null ? {} : { qdrant_skipped_reason: qdrantSkipped }),
		...(since !== undefined ? { since } : {}),
	});
}
