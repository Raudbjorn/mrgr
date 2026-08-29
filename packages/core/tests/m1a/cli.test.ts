import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, describe, expect, it } from "vitest";

import { main as wp0Main, type CliIo } from "../../src/evaluation/cli.js";
import { evidenceKey, readEvidence } from "../../src/m1a/sidecar.js";
import { main as mrgrEvidenceMain } from "../../src/m1a/cli.js";
import { importCorpusJsonl } from "../../src/db/import.js";
import { EvidenceStore } from "../../src/db/evidence-store.js";
import { closeDb, openDb } from "../../src/db/open.js";
import { buildE2eFixture } from "../evaluation/build-e2e-fixture.js";

const temporaryDirectories: string[] = [];
const openHandles: Array<ReturnType<typeof openDb>> = [];

async function tempDir(): Promise<string> {
	const path = await mkdtemp(join(tmpdir(), "mrgr-m1a-cli-"));
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

/**
 * Build a real corpus JSONL from the e2e fixture and import it into a fresh
 * mrgr-db/1 file so `conflict_path` / `conflict_region` rows exist before the
 * CLI runs. The CLI never invents rows: it just appends evidence bundles that
 * point at regions the corpus already declared.
 */
async function seedCorpusAndDb(
	directory: string,
): Promise<{ repositoryPath: string; corpusPath: string; dbPath: string }> {
	const repositoryPath = await buildE2eFixture(join(directory, "fixture"));
	const corpusPath = join(directory, "corpus.jsonl");
	const dbPath = join(directory, "mrgr.db");

	const scan = captureIo();
	const scanExit = await wp0Main(
		[
			"scan-local",
			repositoryPath,
			"--out",
			corpusPath,
			"--since",
			"1970-01-01",
			"--jobs",
			"2",
		],
		scan.io,
	);
	expect(scanExit).toBe(0);
	expect(scan.stderr).toEqual([]);

	const corpusText = await readFile(corpusPath, "utf8");
	const corpusLines = corpusText.trimEnd().split("\n");
	expect(corpusLines.length).toBeGreaterThan(0);
	const conflicted = corpusLines
		.map((line) => JSON.parse(line) as { replayStatus: string })
		.filter((record) => record.replayStatus === "conflicted");
	expect(conflicted.length).toBeGreaterThan(0);

	let opened;
	try {
		opened = openDb(dbPath, { create: true });
		expect(opened.ok).toBe(true);
		if (!opened.ok) throw new Error(opened.error.message);
		const imported = await importCorpusJsonl(opened.value, corpusPath);
		expect(imported.ok).toBe(true);
		if (!imported.ok) throw new Error(imported.error.message);
		expect(imported.value.imported).toBeGreaterThan(0);
		expect(imported.value.failed).toBe(0);

		const regionCount = (
			opened.value.db.prepare("SELECT count(*) AS n FROM conflict_region").get() as {
				n: number;
			}
		).n;
		expect(regionCount).toBeGreaterThan(0);
	} finally {
		if (opened?.ok) closeDb(opened.value);
	}

	return { repositoryPath, corpusPath, dbPath };
}

afterEach(async () => {
	while (openHandles.length > 0) {
		const opened = openHandles.pop();
		if (opened?.ok) closeDb(opened.value);
	}
});

afterAll(async () => {
	while (openHandles.length > 0) {
		const opened = openHandles.pop();
		if (opened?.ok) closeDb(opened.value);
	}
	await Promise.all(
		temporaryDirectories.splice(0).map((path) =>
			rm(path, { recursive: true, force: true }),
		),
	);
});
describe("--db flag wiring", () => {
	it("B1: --db path produces the same evidenceKey set as the sidecar --out path", async () => {
		const directory = await tempDir();
		const { repositoryPath, corpusPath, dbPath } =
			await seedCorpusAndDb(directory);
		const sidecarPath = join(directory, "out.jsonl");

		const dbRun = captureIo();
		expect(
			await mrgrEvidenceMain(
				[corpusPath, "--db", dbPath, "--repo", repositoryPath],
				dbRun.io,
			),
		).toBe(0);

		const sidecarRun = captureIo();
		expect(
			await mrgrEvidenceMain(
				[corpusPath, "--out", sidecarPath, "--repo", repositoryPath],
				sidecarRun.io,
			),
		).toBe(0);

		const sidecar = await readEvidence(sidecarPath);
		expect(sidecar.ok).toBe(true);
		if (!sidecar.ok) return;
		const sidecarKeys = new Set(sidecar.value.map(evidenceKey));

		const opened = openDb(dbPath, {});
		expect(opened.ok).toBe(true);
		if (!opened.ok) return;
		try {
			const listed = new EvidenceStore(opened.value).list();
			expect(listed.ok).toBe(true);
			if (!listed.ok) return;
			const dbKeys = new Set(listed.value.map(evidenceKey));

			expect(dbKeys.size).toBeGreaterThan(0);
			expect(sidecarKeys.size).toBeGreaterThan(0);
			expect(dbKeys).toEqual(sidecarKeys);
		} finally {
			closeDb(opened.value);
		}

		expect(dbRun.stdout.join("")).toMatch(/evidence records:/);
		expect(sidecarRun.stdout.join("")).toMatch(/evidence records:/);
	});
	it("returns operational failure when sidecar extraction records failures", async () => {
		const directory = await tempDir();
		const { corpusPath } = await seedCorpusAndDb(directory);
		const sidecarPath = join(directory, "failed.jsonl");

		const capture = captureIo();
		const exitCode = await mrgrEvidenceMain(
			[
				corpusPath,
				"--out",
				sidecarPath,
				"--repo",
				join(directory, "missing-repository"),
			],
			capture.io,
		);

		expect(exitCode).toBe(1);
		expect(capture.stdout.join("")).toMatch(/failed=[1-9]/);
	});


	it("B2: --db and --out together are mutually exclusive and exit 2", async () => {
		const directory = await tempDir();
		const { repositoryPath, corpusPath } = await seedCorpusAndDb(directory);

		const capture = captureIo();
		const exitCode = await mrgrEvidenceMain(
			[
				corpusPath,
				"--db",
				join(directory, "mutual.db"),
				"--out",
				join(directory, "mutual.jsonl"),
				"--repo",
				repositoryPath,
			],
			capture.io,
		);

		expect(exitCode).toBe(2);
		expect(capture.stdout).toEqual([]);
		expect(capture.stderr).toHaveLength(1);
		const parsed = JSON.parse(capture.stderr[0] as string) as {
			kind: string;
			message: string;
		};
		// B2 must fail until Task 2 wires --db AND enforces mutual exclusion.
		// Today parseArgs rejects unknown --db with "Unknown option" — that
		// does NOT pass this assertion. Only the exact mutual-exclusion
		// message from `usageError("--db and --out are mutually exclusive")`
		// counts.
		expect(parsed.kind).toBe("config");
		expect(parsed.message).toBe("--db and --out are mutually exclusive");
	});

	it("B3: nonexistent --db path without --create exits 2 and leaves no file", async () => {
		const directory = await tempDir();
		const { repositoryPath, corpusPath } = await seedCorpusAndDb(directory);
		const dbPath = join(directory, "missing-parent", "foo.db");

		expect(existsSync(dbPath)).toBe(false);

		const capture = captureIo();
		const exitCode = await mrgrEvidenceMain(
			[corpusPath, "--db", dbPath, "--repo", repositoryPath],
			capture.io,
		);

		expect(exitCode).toBe(2);
		expect(existsSync(dbPath)).toBe(false);
		expect(capture.stdout).toEqual([]);
		expect(capture.stderr).toHaveLength(1);
		const parsed = JSON.parse(capture.stderr[0] as string) as {
			kind?: unknown;
			operation?: unknown;
			message?: unknown;
		};
		expect(parsed).toMatchObject({
			kind: "not-found",
			operation: "open db",
			message: "Database file does not exist",
		});
		expect(capture.stderr[0] ?? "").not.toContain("stack");
	});
});