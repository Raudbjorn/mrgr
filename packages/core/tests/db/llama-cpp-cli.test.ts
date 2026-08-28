import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { DatabaseSync } from "node:sqlite";

import {
	runLlamaCppRecord,
	LLAMA_CPP_HELP,
} from "../../src/db/llama-cpp-cli.js";
import { canonicalJson } from "../../src/db/canonical.js";
import { SCHEMA_SQL } from "../../src/db/schema.js";

let dir: string;
let dbPath: string;
let metricsPath: string;
let binaryPath: string;

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "mrgr-llamacpp-cli-"));
	dbPath = join(dir, "mrgr.db");
	metricsPath = join(dir, "metrics.jsonl");
	binaryPath = join(dir, "llama.cpp");
	// Touch a fake binary file so requirePath passes.
	writeFileSync(binaryPath, "fake-binary");
	writeFileSync(
		metricsPath,
		JSON.stringify({
			prefill_ms: 1234,
			decode_ms_total: 4500,
			decode_tokens_total: 300,
			ttft_ms: 42,
			g_tok_s: 66.7,
			ppl: 8.421,
			exit_code: 0,
			gate_fail_count: 0,
			reason_text: "smoke clean run",
			harness_decision: "clean",
		}) + "\n",
	);
});

afterEach(() => {
	rmSync(dir, { recursive: true, force: true });
});

describe("runLlamaCppRecord — smoke (Plan Step 3 binding verification)", () => {
	it("writes one run + run_result + llama_run_stats row to a fresh mrgr.db", async () => {
		const argv = [
			"--harness",
			"ppl-probe",
			"--backend",
			"sycl",
			"--model",
			"Llama-3.1-8B",
			"--quant",
			"Q4_K_M",
			"--ctx-len",
			"2048",
			"--n-parallel",
			"1",
			"--kv-type",
			"f16",
			"--flash-attn",
			"--binary",
			binaryPath,
			"--metrics-jsonl",
			metricsPath,
			"--started-at",
			"2026-08-28T10:00:00Z",
		];
		const result = await runLlamaCppRecord(dbPath, argv);
		expect(result.ok).toBe(true);
		if (!result.ok || result.value === null) throw new Error("expected non-null result");
		if (result.value === null) throw new Error("expected non-null result");
		expect(result.value).toHaveLength(1);
		const row = result.value[0] as { run_id: string; triple_id: string; arm: string };
		expect(row.arm).toBe(`llama.cpp@${"0".repeat(7)}`);
		expect(row.run_id).toMatch(/^[0-9a-f]{64}$/);
		expect(row.triple_id).toMatch(/^[0-9a-f]{64}$/);

		// Re-open the db and confirm the rows landed.
		const db = new DatabaseSync(dbPath);
		try {
			const runN = db.prepare("SELECT count(*) AS n FROM run").get() as { n: number };
			expect(runN.n).toBe(1);
			const resultN = db.prepare("SELECT count(*) AS n FROM run_result").get() as { n: number };
			expect(resultN.n).toBe(1);
			const statsN = db.prepare("SELECT count(*) AS n FROM llama_run_stats").get() as {
				n: number;
			};
			expect(statsN.n).toBe(1);
		} finally {
			db.close();
		}
	});

	it("is idempotent: a second invocation with identical args exits 0 and persists no second row", async () => {
		const argv = [
			"--harness",
			"ppl-probe",
			"--backend",
			"sycl",
			"--model",
			"Llama-3.1-8B",
			"--quant",
			"Q4_K_M",
			"--ctx-len",
			"2048",
			"--n-parallel",
			"1",
			"--kv-type",
			"f16",
			"--binary",
			binaryPath,
			"--metrics-jsonl",
			metricsPath,
			"--started-at",
			"2026-08-28T10:00:00Z",
		];
		const first = await runLlamaCppRecord(dbPath, argv);
		const second = await runLlamaCppRecord(dbPath, argv);
		expect(first.ok).toBe(true);
		expect(second.ok).toBe(true);
		if (!first.ok || !second.ok) return;
		expect(second.value).toEqual(first.value);

		const db = new DatabaseSync(dbPath);
		try {
			const runN = db.prepare("SELECT count(*) AS n FROM run").get() as { n: number };
			expect(runN.n).toBe(1);
		} finally {
			db.close();
		}
	});

	it("returns a typed config error on missing --binary", async () => {
		const argv = [
			"--harness",
			"ppl-probe",
			"--backend",
			"sycl",
			"--model",
			"Llama-3.1-8B",
			"--quant",
			"Q4_K_M",
			"--ctx-len",
			"2048",
			"--n-parallel",
			"1",
			"--metrics-jsonl",
			metricsPath,
		];
		const result = await runLlamaCppRecord(dbPath, argv);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.kind).toBe("config");
		}
	});

	it("returns a typed config error on malformed metrics-jsonl line", async () => {
		writeFileSync(metricsPath, "not-json\n");
		const argv = [
			"--harness",
			"ppl-probe",
			"--backend",
			"sycl",
			"--model",
			"Llama-3.1-8B",
			"--quant",
			"Q4_K_M",
			"--ctx-len",
			"2048",
			"--n-parallel",
			"1",
			"--binary",
			binaryPath,
			"--metrics-jsonl",
			metricsPath,
		];
		const result = await runLlamaCppRecord(dbPath, argv);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.kind).toBe("config");
			expect(result.error.message).toMatch(/Malformed JSON/);
		}
	});

	it("exposes the binding help block", () => {
		expect(LLAMA_CPP_HELP).toContain("llama-cpp record");
		expect(LLAMA_CPP_HELP).toContain("--metrics-jsonl");
	});
});

describe("mrgr.db schema — llama_run_stats is present (no separate migration step)", () => {
	it("is part of SCHEMA_SQL so openDb creates it on first use", () => {
		expect(SCHEMA_SQL).toMatch(/CREATE TABLE IF NOT EXISTS llama_run_stats/);
		// canonicalJson of an empty value is `"null"`; smoke to keep
		// the import alive in case anyone refactors this file later.
		expect(canonicalJson(null)).toBe("null");
	});
});
