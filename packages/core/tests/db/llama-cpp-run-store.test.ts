import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { closeDb, openDb, type DbHandle } from "../../src/db/open.js";
import { canonicalJson, sha256Hex } from "../../src/db/canonical.js";
import {
	appendLlamaCppRun,
	type LlamaCppConfig,
	type LlamaCppMetrics,
} from "../../src/db/llama-cpp-run-store.js";

let dir: string;
let handle: DbHandle;

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "mrgr-llamacpp-"));
	const opened = openDb(join(dir, "mrgr.db"), { create: true });
	if (!opened.ok) throw new Error(opened.error.message);
	handle = opened.value;
});

afterEach(() => {
	closeDb(handle);
	rmSync(dir, { recursive: true, force: true });
});

const BINARY_A = "0".repeat(64);
const BINARY_B = "1".repeat(64);

const baseConfig: LlamaCppConfig = {
	harness: "ppl-probe",
	backend: "sycl",
	model: { name: "Llama-3.1-8B", quant: "Q4_K_M", sha256: "a".repeat(64) },
	context_len: 2048,
	n_parallel: 1,
	kv_type: "f16",
	flash_attn: true,
	rng_seed: 42,
	binary_sha256: BINARY_A,
};

const baseMetrics: LlamaCppMetrics = {
	prefill_ms: 1234,
	decode_ms_total: 4500,
	decode_tokens_total: 300,
	ttft_ms: 42,
	g_tok_s: 66.7,
	ppl: 8.421,
	exit_code: 0,
	gate_fail_count: 0,
	reason_text: "clean run",
	harness_decision: "clean",
};

describe("appendLlamaCppRun — idempotency (case a)", () => {
	it("same config + same metrics twice yields one run row and one run_result row", () => {
		const first = appendLlamaCppRun(handle, baseConfig, baseMetrics, "2026-08-28T10:00:00Z");
		const second = appendLlamaCppRun(handle, baseConfig, baseMetrics, "2026-08-28T10:00:00Z");
		expect(first.ok).toBe(true);
		expect(second.ok).toBe(true);
		if (!first.ok || !second.ok) return;
		expect(second.value.run_id).toBe(first.value.run_id);
		expect(second.value.triple_id).toBe(first.value.triple_id);

		const runN = handle.db.prepare("SELECT count(*) AS n FROM run").get() as { n: number };
		expect(runN.n).toBe(1);
		const resultN = handle.db.prepare("SELECT count(*) AS n FROM run_result").get() as {
			n: number;
		};
		expect(resultN.n).toBe(1);
		const statsN = handle.db.prepare("SELECT count(*) AS n FROM llama_run_stats").get() as {
			n: number;
		};
		expect(statsN.n).toBe(1);
	});
});

describe("appendLlamaCppRun — binary-distinct run_ids (case b)", () => {
	it("two configs differing only in binary_sha256 produce distinct run_ids", () => {
		const a = appendLlamaCppRun(handle, baseConfig, baseMetrics, "2026-08-28T10:00:00Z");
		const b = appendLlamaCppRun(
			handle,
			{ ...baseConfig, binary_sha256: BINARY_B },
			baseMetrics,
			"2026-08-28T10:00:00Z",
		);
		expect(a.ok).toBe(true);
		expect(b.ok).toBe(true);
		if (!a.ok || !b.ok) return;
		expect(a.value.run_id).not.toBe(b.value.run_id);
		expect(a.value.arm).toBe(`llama.cpp@${BINARY_A.slice(0, 7)}`);
		expect(b.value.arm).toBe(`llama.cpp@${BINARY_B.slice(0, 7)}`);

		const runN = handle.db.prepare("SELECT count(*) AS n FROM run").get() as { n: number };
		expect(runN.n).toBe(2);
	});
});

describe("appendLlamaCppRun — nullable model.sha256 (case c)", () => {
	it("does not throw and does not store a placeholder when model.sha256 is omitted", () => {
		const cfg: LlamaCppConfig = {
			...baseConfig,
			model: { name: "Llama-3.1-8B", quant: "Q4_K_M" },
		};
		const result = appendLlamaCppRun(handle, cfg, baseMetrics, "2026-08-28T10:00:00Z");
		expect(result.ok).toBe(true);

		const row = handle.db.prepare("SELECT model_sha FROM run WHERE run_id = ?").get(
			result.ok ? result.value.run_id : "",
		) as { model_sha: string | null };
		expect(row.model_sha).toBeNull();
	});
});

describe("appendLlamaCppRun — gate_fail mapping (case d)", () => {
	it("maps gate_fail_count > 0 to halt_reason='gate-fail-N' and decision='halt'", () => {
		const metrics: LlamaCppMetrics = {
			...baseMetrics,
			gate_fail_count: 3,
			harness_decision: "error",
			reason_text: "3 gate failures",
		};
		const result = appendLlamaCppRun(handle, baseConfig, metrics, "2026-08-28T10:00:00Z");
		expect(result.ok).toBe(true);
		if (!result.ok) return;

		const row = handle.db
			.prepare(
				"SELECT decision, halt_reason FROM run_result WHERE run_id = ? AND triple_id = ?",
			)
			.get(result.value.run_id, result.value.triple_id) as {
			decision: string;
			halt_reason: string | null;
		};
		expect(row.decision).toBe("halt");
		expect(row.halt_reason).toBe("gate-fail-3");

		const statsRow = handle.db
			.prepare("SELECT harness_decision FROM llama_run_stats WHERE run_id = ?")
			.get(result.value.run_id) as { harness_decision: string | null };
		// The carried schema lost the original 5-value enum; the sidecar
		// preserves it as a free-text field.
		expect(statsRow.harness_decision).toBe("error");
	});

	it("maps harness_decision=error with gate_fail_count=0 to halt_reason='error'", () => {
		const metrics: LlamaCppMetrics = {
			...baseMetrics,
			gate_fail_count: 0,
			harness_decision: "error",
		};
		const result = appendLlamaCppRun(handle, baseConfig, metrics, "2026-08-28T10:00:00Z");
		expect(result.ok).toBe(true);
		if (!result.ok) return;

		const row = handle.db
			.prepare("SELECT decision, halt_reason FROM run_result WHERE run_id = ?")
			.get(result.value.run_id) as { decision: string; halt_reason: string | null };
		expect(row.decision).toBe("halt");
		expect(row.halt_reason).toBe("error");
	});

	it("maps clean/conflicted/unsupported-custom-driver to keep_ours/compose/keep_theirs", () => {
		// Each sub-case uses a distinct kv_type so the content-derived run_id
		// does not collide; otherwise we'd be testing re-insert, not mapping.
		const cases = [
			{ hd: "clean" as const, want: "keep_ours", kv: "f16" as const },
			{ hd: "conflicted" as const, want: "compose", kv: "q8_0" as const },
			{ hd: "unsupported-custom-driver" as const, want: "keep_theirs", kv: "turbo2" as const },
		];
		for (const c of cases) {
			const r = appendLlamaCppRun(
				handle,
				{ ...baseConfig, kv_type: c.kv },
				{ ...baseMetrics, harness_decision: c.hd },
				"2026-08-28T10:00:00Z",
			);
			expect(r.ok).toBe(true);
			if (!r.ok) return;
			const row = handle.db
				.prepare("SELECT decision FROM run_result WHERE run_id = ?")
				.get(r.value.run_id) as { decision: string };
			expect(row.decision).toBe(c.want);
		}
	});
});

describe("appendLlamaCppRun — golden-vector run_id (case e)", () => {
	it("run_id equals sha256(canonicalJson(cfg)) byte-for-byte", () => {
		const expected = sha256Hex(canonicalJson(baseConfig));
		const result = appendLlamaCppRun(handle, baseConfig, baseMetrics, "2026-08-28T10:00:00Z");
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.run_id).toBe(expected);

		// Triple_id is content-derived over (run_id, run_index, exit_code).
		const expectedTriple = sha256Hex(
			canonicalJson({ run_id: expected, run_index: 1, exit_code: baseMetrics.exit_code }),
		);
		expect(result.value.triple_id).toBe(expectedTriple);
	});
});

describe("appendLlamaCppRun — strict input validation", () => {
	it("rejects non-hex binary_sha256 with a typed config error", () => {
		const result = appendLlamaCppRun(
			handle,
			{ ...baseConfig, binary_sha256: "not-hex" },
			baseMetrics,
			"2026-08-28T10:00:00Z",
		);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.kind).toBe("config");
	});

	it("rejects negative gate_fail_count with a typed config error", () => {
		const result = appendLlamaCppRun(
			handle,
			baseConfig,
			{ ...baseMetrics, gate_fail_count: -1 },
			"2026-08-28T10:00:00Z",
		);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.kind).toBe("config");
	});

	it("rejects non-hex spv_sha256 entries with a typed config error", () => {
		const result = appendLlamaCppRun(
			handle,
			baseConfig,
			{ ...baseMetrics, spv_sha256: ["abc-not-hex"] },
			"2026-08-28T10:00:00Z",
		);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error.kind).toBe("config");
	});
});
