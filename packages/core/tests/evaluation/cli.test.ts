import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";

import { main, type CliIo } from "../../src/evaluation/cli.js";
import { buildE2eFixture } from "./build-e2e-fixture.js";

const temporaryDirectories: string[] = [];

async function temporaryDirectory(): Promise<string> {
	const path = await mkdtemp(join(tmpdir(), "semantic-merge-cli-"));
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

async function expectStructuredFailure(argv: readonly string[]): Promise<void> {
	const capture = captureIo();
	expect(await main(argv, capture.io)).not.toBe(0);
	expect(capture.stdout).toEqual([]);
	expect(capture.stderr).toHaveLength(1);
	const parsed = JSON.parse(capture.stderr[0] as string);
	expect(parsed).toMatchObject({ kind: "config" });
	expect(capture.stderr[0]).not.toContain("stack");
}

afterEach(async () => {
	await Promise.all(
		temporaryDirectories
			.splice(0)
			.map((path) => rm(path, { recursive: true, force: true })),
	);
});

describe("exact WP0 CLI surface", () => {
	it("shows only the supported commands", async () => {
		const capture = captureIo();
		expect(await main(["--help"], capture.io)).toBe(0);
		const help = capture.stdout.join("");
		expect(help).toContain("scan <owner/repo...> --out FILE");
		expect(help).toContain("scan-local <path...> --out FILE");
		expect(help).toContain("report FILE");
		expect(help).toContain("materialize FILE --out FILE");
		expect(help).not.toContain("reference.cli");
		expect(capture.stderr).toEqual([]);
	});

	it("returns structured usage failures for dates, jobs, missing inputs, and duplicate paths", async () => {
		await expectStructuredFailure([
			"scan-local",
			"/tmp/repo",
			"--out",
			"/tmp/out",
			"--since",
			"2026-02-30",
		]);
		await expectStructuredFailure([
			"scan-local",
			"/tmp/repo",
			"--out",
			"/tmp/out",
			"--jobs",
			"33",
		]);
		await expectStructuredFailure(["scan-local", "--out", "/tmp/out"]);
		await expectStructuredFailure(["scan", "--out", "/tmp/out"]);
		await expectStructuredFailure([
			"materialize",
			"/tmp/corpus",
			"--out",
			"/tmp/./corpus",
		]);
	});

	it("does not serialize unexpected exception text", async () => {
		const secretMarker = "https://token@example.invalid/private";
		const throwingArgv = new Proxy([] as string[], {
			get() {
				throw new Error(secretMarker);
			},
		});
		const capture = captureIo();
		expect(await main(throwingArgv, capture.io)).toBe(1);
		expect(capture.stderr).toHaveLength(1);
		expect(capture.stderr[0]).not.toContain(secretMarker);
	});
});

describe("three-merge local pipeline", () => {
	it("scans resumably, reports exact denominators, and materializes two localized regions", async () => {
		const directory = await temporaryDirectory();
		const repositoryPath = await buildE2eFixture(join(directory, "fixture"));
		const corpusPath = join(directory, "corpus.jsonl");
		const materializedPath = join(directory, "materialized.jsonl");
		const scan = captureIo();
		expect(
			await main(
				[
					"scan-local",
					repositoryPath,
					repositoryPath,
					"--out",
					corpusPath,
					"--since",
					"1970-01-01",
					"--jobs",
					"2",
				],
				scan.io,
			),
		).toBe(0);
		expect(scan.stderr).toEqual([]);
		const corpusLines = (await readFile(corpusPath, "utf8"))
			.trimEnd()
			.split("\n");
		expect(corpusLines).toHaveLength(3);
		expect(corpusLines.map((line) => JSON.parse(line).schemaVersion)).toEqual([
			2, 2, 2,
		]);

		const resume = captureIo();
		expect(
			await main(
				[
					"scan-local",
					repositoryPath,
					"--out",
					corpusPath,
					"--since",
					"1970-01-01",
					"--jobs",
					"4",
				],
				resume.io,
			),
		).toBe(0);
		expect(
			(await readFile(corpusPath, "utf8")).trimEnd().split("\n"),
		).toHaveLength(3);

		const report = captureIo();
		expect(await main(["report", corpusPath], report.io)).toBe(0);
		const reportText = report.stdout.join("");
		for (const label of [
			"candidates=3",
			"clean=1 conflicted=2",
			"exact localized regions=2",
			"ours=1",
			"novel=1",
			"historical conflict incidence: not measured",
		])
			expect(reportText).toContain(label);

		const materialize = captureIo();
		expect(
			await main(
				["materialize", corpusPath, "--out", materializedPath],
				materialize.io,
			),
		).toBe(0);
		const materializedLines = (await readFile(materializedPath, "utf8"))
			.trimEnd()
			.split("\n")
			.map((line) => JSON.parse(line));
		expect(materializedLines).toHaveLength(2);
		expect(materializedLines.map((line) => line.resolution).sort()).toEqual([
			"genuinely novel choice\n",
			"ours choice\n",
		]);
		expect(
			materializedLines.map((line) => line.resolution).join("\n"),
		).not.toContain("far theirs");
	});
});
