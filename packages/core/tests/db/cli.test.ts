import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

import { putBlob } from "../../src/db/blob.js";
import { main, type CliIo } from "../../src/db/cli.js";
import { closeDb, openDb, SCHEMA_VERSION_STRING } from "../../src/db/open.js";

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), "fixtures");
const LEGACY_CORPUS = join(FIXTURES_DIR, "legacy-corpus.jsonl");
const LEGACY_EVIDENCE = join(FIXTURES_DIR, "legacy-evidence.jsonl");

const TABLE_NAMES = [
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

const temporaryDirectories: string[] = [];

function temporaryDirectory(): string {
	const path = mkdtempSync(join(tmpdir(), "mrgr-db-cli-"));
	temporaryDirectories.push(path);
	return path;
}

function captureIo(): { io: CliIo; stdout: string[]; stderr: string[] } {
	const stdout: string[] = [];
	const stderr: string[] = [];
	return {
		stdout,
		stderr,
		io: {
			stdout: (text) => {
				stdout.push(text);
			},
			stderr: (text) => {
				stderr.push(text);
			},
		},
	};
}

afterEach(() => {
	for (const path of temporaryDirectories.splice(0)) {
		rmSync(path, { recursive: true, force: true });
	}
});

describe("mrgr-db init", () => {
	it("creates a database that openDb subsequently accepts", async () => {
		const dir = temporaryDirectory();
		const dbPath = join(dir, "mrgr.db");
		const capture = captureIo();

		expect(await main(["init", "--db", dbPath], capture.io)).toBe(0);
		expect(capture.stderr).toEqual([]);
		expect(existsSync(dbPath)).toBe(true);

		const opened = openDb(dbPath);
		expect(opened.ok).toBe(true);
		if (opened.ok) closeDb(opened.value);
	});
});

describe("mrgr-db export", () => {
	it("after populating a database produces the manifest and per-table files", async () => {
		const dir = temporaryDirectory();
		const dbPath = join(dir, "mrgr.db");
		expect(await main(["init", "--db", dbPath], captureIo().io)).toBe(0);

		const opened = openDb(dbPath);
		if (!opened.ok) throw new Error(opened.error.message);
		const put = putBlob(opened.value, Buffer.from("hello"));
		if (!put.ok) throw new Error(put.error.message);
		closeDb(opened.value);

		const outDir = join(dir, "export");
		const capture = captureIo();
		expect(await main(["export", "--db", dbPath, "--out", outDir], capture.io)).toBe(0);
		expect(capture.stderr).toEqual([]);

		expect(existsSync(join(outDir, "manifest.json"))).toBe(true);
		const manifest = JSON.parse(readFileSync(join(outDir, "manifest.json"), "utf8")) as {
			schema_version: string;
			tables: Record<string, { rows: number }>;
		};
		expect(manifest.schema_version).toBe(SCHEMA_VERSION_STRING);
		for (const table of TABLE_NAMES) {
			expect(existsSync(join(outDir, `${table}.jsonl`))).toBe(true);
		}
		expect(manifest.tables.blob.rows).toBe(1);
	});
});

describe("mrgr-db verify", () => {
	it("exits 0 on a good database and 1 on one with a tampered blob", async () => {
		const dir = temporaryDirectory();
		const dbPath = join(dir, "mrgr.db");
		expect(await main(["init", "--db", dbPath], captureIo().io)).toBe(0);

		const opened = openDb(dbPath);
		if (!opened.ok) throw new Error(opened.error.message);
		const put = putBlob(opened.value, Buffer.from("hello"));
		if (!put.ok) throw new Error(put.error.message);
		closeDb(opened.value);

		const good = captureIo();
		expect(await main(["verify", "--db", dbPath], good.io)).toBe(0);
		expect(good.stderr).toEqual([]);
		expect(good.stdout.join("")).toContain("verify ok");

		// Plant the corruption directly with raw SQL, bypassing putBlob's own
		// write-time content check — this is exactly the after-the-fact
		// corruption getBlob's digest re-verification exists to catch.
		const reopened = openDb(dbPath);
		if (!reopened.ok) throw new Error(reopened.error.message);
		reopened.value.db
			.prepare("UPDATE blob SET bytes = ? WHERE sha256 = ?")
			.run(Buffer.from("tampered"), put.value);
		closeDb(reopened.value);

		const bad = captureIo();
		expect(await main(["verify", "--db", dbPath], bad.io)).toBe(1);
		expect(bad.stdout).toEqual([]);
		expect(bad.stderr).toHaveLength(1);
		const parsed = JSON.parse(bad.stderr[0] as string) as { kind: string };
		expect(parsed.kind).toBe("db");
	});
});

describe("mrgr-db import", () => {
	it("loads the legacy corpus fixture, then the evidence fixture, and the result exports", async () => {
		const dir = temporaryDirectory();
		const dbPath = join(dir, "mrgr.db");
		expect(await main(["init", "--db", dbPath], captureIo().io)).toBe(0);

		const corpusImport = captureIo();
		expect(
			await main(["import", "--db", dbPath, "--corpus", LEGACY_CORPUS], corpusImport.io),
		).toBe(0);
		expect(corpusImport.stderr).toEqual([]);
		expect(corpusImport.stdout.join("")).toContain("imported=2");

		const evidenceImport = captureIo();
		expect(
			await main(
				["import", "--db", dbPath, "--evidence", LEGACY_EVIDENCE],
				evidenceImport.io,
			),
		).toBe(0);
		expect(evidenceImport.stderr).toEqual([]);
		expect(evidenceImport.stdout.join("")).toContain("imported=2");

		const outDir = join(dir, "export");
		const exported = captureIo();
		expect(await main(["export", "--db", dbPath, "--out", outDir], exported.io)).toBe(0);
		const manifest = JSON.parse(readFileSync(join(outDir, "manifest.json"), "utf8")) as {
			tables: Record<string, { rows: number }>;
		};
		expect(manifest.tables.corpus_record.rows).toBe(2);
		expect(manifest.tables.evidence_bundle.rows).toBe(2);
	});

	it("exits 1 when every record fails (evidence imported before its corpus)", async () => {
		const dir = temporaryDirectory();
		const dbPath = join(dir, "mrgr.db");
		expect(await main(["init", "--db", dbPath], captureIo().io)).toBe(0);

		const capture = captureIo();
		expect(await main(["import", "--db", dbPath, "--evidence", LEGACY_EVIDENCE], capture.io)).toBe(
			1,
		);
		expect(capture.stdout).toEqual([]);
		expect(capture.stderr).toHaveLength(1);
		const parsed = JSON.parse(capture.stderr[0] as string) as {
			kind: string;
			message: string;
			details: { imported: number; failed: number };
		};
		expect(parsed.kind).toBe("db");
		expect(parsed.message).toContain("failed=2");
		expect(parsed.details.imported).toBe(0);
		expect(parsed.details.failed).toBe(2);
	});

	it("exits 1 when some records succeed and some fail", async () => {
		const dir = temporaryDirectory();
		const dbPath = join(dir, "mrgr.db");
		expect(await main(["init", "--db", dbPath], captureIo().io)).toBe(0);
		expect(
			await main(["import", "--db", dbPath, "--corpus", LEGACY_CORPUS], captureIo().io),
		).toBe(0);

		// One record whose corpus region exists (succeeds) and one whose
		// merge_sha names the fixture's *clean* corpus record, which has no
		// conflict_region row at all (fails the region-existence check).
		const okLine = JSON.parse(
			readFileSync(LEGACY_EVIDENCE, "utf8").trimEnd().split("\n")[0] as string,
		) as Record<string, unknown>;
		const failingLine = { ...okLine, merge_sha: "f".repeat(40) };
		const mixedPath = join(dir, "mixed-evidence.jsonl");
		writeFileSync(mixedPath, `${JSON.stringify(okLine)}\n${JSON.stringify(failingLine)}\n`);

		const capture = captureIo();
		expect(await main(["import", "--db", dbPath, "--evidence", mixedPath], capture.io)).toBe(1);
		expect(capture.stdout).toEqual([]);
		expect(capture.stderr).toHaveLength(1);
		const parsed = JSON.parse(capture.stderr[0] as string) as {
			kind: string;
			details: { imported: number; skippedDuplicate: number; failed: number };
		};
		expect(parsed.kind).toBe("db");
		expect(parsed.details.imported).toBe(1);
		expect(parsed.details.failed).toBe(1);
	});
});

describe("mrgr-db CLI surface", () => {
	it("an unknown flag exits 2 with usage on stderr", async () => {
		const dir = temporaryDirectory();
		const capture = captureIo();

		expect(
			await main(["init", "--db", join(dir, "mrgr.db"), "--bogus"], capture.io),
		).toBe(2);
		expect(capture.stdout).toEqual([]);
		expect(capture.stderr).toHaveLength(1);
		const parsed = JSON.parse(capture.stderr[0] as string) as { kind: string };
		expect(parsed.kind).toBe("config");
	});

	it("import requires exactly one of --corpus or --evidence", async () => {
		const dir = temporaryDirectory();
		const dbPath = join(dir, "mrgr.db");

		const neither = captureIo();
		expect(await main(["import", "--db", dbPath], neither.io)).toBe(2);
		expect(JSON.parse(neither.stderr[0] as string).kind).toBe("config");

		const both = captureIo();
		expect(
			await main(
				["import", "--db", dbPath, "--corpus", "a.jsonl", "--evidence", "b.jsonl"],
				both.io,
			),
		).toBe(2);
		expect(JSON.parse(both.stderr[0] as string).kind).toBe("config");
	});

	it("shows the supported commands", async () => {
		const capture = captureIo();
		expect(await main(["--help"], capture.io)).toBe(0);
		const help = capture.stdout.join("");
		expect(help).toContain("init   --db PATH");
		expect(help).toContain("import --db PATH");
		expect(help).toContain("export --db PATH");
		expect(help).toContain("verify --db PATH");
		expect(help).toContain("llama-cpp record");
		expect(help).toContain("llama-cpp reindex");
		expect(capture.stderr).toEqual([]);
	});
});

describe("mrgr-db llama-cpp record", () => {
	it("records one synthetic ppl-probe run and is idempotent on re-run", async () => {
		const dir = temporaryDirectory();
		const dbPath = join(dir, "mrgr.db");
		const binaryPath = join(dir, "fake-llama-cpp");
		writeFileSync(binaryPath, "");
		const metricsPath = join(dir, "metrics.jsonl");
		writeFileSync(
			metricsPath,
			JSON.stringify({
				prefill_ms: 1234,
				decode_ms_total: 4500,
				decode_tokens_total: 300,
				g_tok_s: 66.7,
				ttft_ms: 42,
				exit_code: 0,
				gate_fail_count: 0,
			}) + "\n",
		);

		const args = [
			"llama-cpp",
			"record",
			"--db",
			dbPath,
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

		// First invocation: writes one row.
		const first = captureIo();
		expect(await main(args, first.io)).toBe(0);
		expect(first.stdout.join("")).toContain("recorded 1 run");

		const opened = openDb(dbPath);
		if (!opened.ok) throw new Error(opened.error.message);
		const runCount = (
			opened.value.db.prepare("SELECT count(*) AS n FROM run").get() as { n: number }
		).n;
		const resultCount = (
			opened.value.db.prepare("SELECT count(*) AS n FROM run_result").get() as {
				n: number;
			}
		).n;
		const statsCount = (
			opened.value.db.prepare("SELECT count(*) AS n FROM llama_run_stats").get() as {
				n: number;
			}
		).n;
		expect(runCount).toBe(1);
		expect(resultCount).toBe(1);
		expect(statsCount).toBe(1);
		closeDb(opened.value);

		// Second invocation with identical config: idempotent — still one row.
		const second = captureIo();
		expect(await main(args, second.io)).toBe(0);
		expect(second.stdout.join("")).toContain("recorded 1 run");

		const reopened = openDb(dbPath);
		if (!reopened.ok) throw new Error(reopened.error.message);
		expect(
			(reopened.value.db.prepare("SELECT count(*) AS n FROM run").get() as { n: number }).n,
		).toBe(1);
		closeDb(reopened.value);
	});

	it("exits 2 with a typed config error when --binary is missing", async () => {
		const dir = temporaryDirectory();
		const dbPath = join(dir, "mrgr.db");
		const metricsPath = join(dir, "metrics.jsonl");
		writeFileSync(metricsPath, "{}\n");

		const capture = captureIo();
		expect(
			await main(
				[
					"llama-cpp",
					"record",
					"--db",
					dbPath,
					"--harness",
					"ppl-probe",
					"--backend",
					"sycl",
					"--model",
					"M",
					"--quant",
					"Q",
					"--ctx-len",
					"2048",
					"--n-parallel",
					"1",
					"--binary",
					join(dir, "does-not-exist"),
					"--metrics-jsonl",
					metricsPath,
				],
				capture.io,
			),
		).toBe(2);
		expect(capture.stderr).toHaveLength(1);
		expect(JSON.parse(capture.stderr[0] as string).kind).toBe("config");
	});
});

describe("mrgr-db llama-cpp reindex", () => {
	it("writes a reindex manifest with sha256, byte_len, and h1_text for each markdown file", async () => {
		const dir = temporaryDirectory();
		const dbPath = join(dir, "mrgr.db");
		const persistenceDir = join(dir, "persistence");
		mkdirSync(persistenceDir);
		writeFileSync(join(persistenceDir, "a.md"), "# Audit\nllama.cpp corpus audit.\n");
		writeFileSync(join(persistenceDir, "b.md"), "# Decisions\nQ1 schema.\n");

		const capture = captureIo();
		expect(
			await main(
				["llama-cpp", "reindex", "--db", dbPath, "--persistence-dir", persistenceDir],
				capture.io,
			),
		).toBe(0);

		const stdout = capture.stdout.join("");
		expect(stdout).toContain('"files_indexed":2');
		expect(stdout).toContain('"points_total":2');

		// The manifest file exists and has the expected shape.
		const stamp = new Date().toISOString().slice(0, 10);
		const manifestPath = join(persistenceDir, `reindex-manifest-${stamp}.json`);
		expect(existsSync(manifestPath)).toBe(true);
		const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
			collection: string;
			points: Array<{ file_path: string; sha256: string; byte_len: number; h1_text: string | null }>;
		};
		expect(manifest.collection).toBe("mrgr_persistence_reindex_local");
		expect(manifest.points).toHaveLength(2);
		for (const point of manifest.points) {
			expect(point.sha256).toMatch(/^[0-9a-f]{64}$/);
			expect(point.byte_len).toBeGreaterThan(0);
			expect(point.h1_text).not.toBeNull();
		}
	});
});
