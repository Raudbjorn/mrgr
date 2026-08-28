import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

import { putBlob } from "../../src/db/blob.js";
import { main, type CliIo } from "../../src/db/cli.js";
import { closeDb, openDb } from "../../src/db/open.js";

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
		expect(manifest.schema_version).toBe("mrgr-db/1");
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
		expect(capture.stderr).toEqual([]);
	});
});
