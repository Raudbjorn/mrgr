import {
	access,
	chmod,
	mkdtemp,
	mkdir,
	readFile,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, test } from "vitest";

import {
	ensureRemoteMirror,
	inspectReplayPreflight,
	openLocalRepository,
	remoteMirrorLocation,
} from "../../src/evaluation/acquire.js";
import { gitVersion, runGit } from "../../src/evaluation/git.js";
import { commitFiles, createRepository } from "./git-fixture.js";

async function mustGit(cwd: string, args: readonly string[]): Promise<string> {
	const result = await runGit(cwd, args, { timeoutMs: 30_000 });
	if (!result.ok) {
		throw new Error(`${result.error.operation}: ${result.error.message}`);
	}
	return result.value.stdoutText().trim();
}

async function fakeGit(source: string): Promise<string> {
	const directory = await mkdtemp(
		join(tmpdir(), "semantic-merge-fake-acquire-"),
	);
	const executable = join(directory, "git");
	await writeFile(executable, `#!/usr/bin/env node\n${source}\n`);
	await chmod(executable, 0o755);
	return executable;
}

describe("openLocalRepository", () => {
	test("accepts full-ancestry work trees and bare repositories", async () => {
		const workTree = await createRepository();
		await commitFiles(workTree, { "tracked.txt": "content\n" }, "initial");
		const openedWorkTree = await openLocalRepository(workTree);
		expect(openedWorkTree).toEqual({
			ok: true,
			value: {
				gitPath: workTree,
				repository: { kind: "local", id: workTree, absolutePath: workTree },
			},
		});

		const bare = await createRepository({ bare: true });
		const openedBare = await openLocalRepository(bare);
		expect(openedBare).toEqual({
			ok: true,
			value: {
				gitPath: bare,
				repository: { kind: "local", id: bare, absolutePath: bare },
			},
		});
	});

	test.each(["git version 2.37.9", "git version unknown"])(
		"rejects unsupported local Git %s before repository probes",
		async (rawVersion) => {
			const repositoryPath = await createRepository();
			const marker = join(repositoryPath, "rev-parse-ran");
			const executable = await fakeGit(`
const fs = require("node:fs");
if (process.argv[2] === "--version") {
	process.stdout.write(${JSON.stringify(`${rawVersion}\n`)});
	process.exit(0);
}
fs.writeFileSync(${JSON.stringify(marker)}, "probed");
process.stdout.write("true\\n");
`);

			const result = await openLocalRepository(repositoryPath, {
				gitBinary: executable,
			});
			expect(result).toMatchObject({
				ok: false,
				error: {
					kind: "config",
					details: { detected: rawVersion, required: "2.38.0" },
				},
			});
			await expect(access(marker)).rejects.toThrow();
		},
	);

	test("rejects shallow repositories instead of returning best-effort history", async () => {
		const source = await createRepository();
		await commitFiles(source, { "tracked.txt": "one\n" }, "one");
		await commitFiles(source, { "tracked.txt": "two\n" }, "two");
		const parent = await mkdtemp(join(tmpdir(), "semantic-merge-shallow-"));
		const shallow = join(parent, "clone");
		const clone = await runGit(parent, [
			"clone",
			"--depth",
			"1",
			pathToFileURL(source).href,
			shallow,
		]);
		expect(clone.ok).toBe(true);

		const result = await openLocalRepository(shallow);
		expect(result).toMatchObject({
			ok: false,
			error: { kind: "config", operation: "open local repository" },
		});
	});

	test("returns structured not-found errors for absent paths", async () => {
		const missing = join(
			tmpdir(),
			`semantic-merge-missing-${process.pid}-${Date.now()}`,
		);
		const result = await openLocalRepository(missing);
		expect(result).toMatchObject({
			ok: false,
			error: { kind: "not-found", operation: "open local repository" },
		});
	});
});

describe("remote mirror acquisition", () => {
	test("derives deterministic SHA-256-suffixed cache paths without network", () => {
		const cacheDir = join(tmpdir(), "semantic-merge-cache");
		const first = remoteMirrorLocation("owner/repo", {
			host: "github.com",
			cacheDir,
		});
		const second = remoteMirrorLocation("owner/repo", {
			host: "github.com",
			cacheDir,
		});
		expect(first).toEqual(second);
		expect(first.ok).toBe(true);
		if (first.ok) {
			expect(first.value.cacheKey).toMatch(/^owner--repo-[a-f0-9]{64}$/);
			expect(first.value.absolutePath).toBe(
				join(cacheDir, first.value.cacheKey),
			);
		}
		const otherHost = remoteMirrorLocation("owner/repo", {
			host: "git.example.com",
			cacheDir,
		});
		expect(otherHost.ok && first.ok && otherHost.value.cacheKey).not.toBe(
			first.ok ? first.value.cacheKey : "",
		);
	});

	test.each([
		["owner", "github.com"],
		["owner/repo/extra", "github.com"],
		["owner/../repo", "github.com"],
		["-owner/repo", "github.com"],
		["owner/repo", "https://github.com"],
		["owner/repo", "github.com/evil"],
		["owner/repo", "user@github.com"],
	])(
		"rejects unsafe slug %s or host %s before Git/network access",
		async (slug, host) => {
			const location = remoteMirrorLocation(slug, { host });
			expect(location).toMatchObject({ ok: false, error: { kind: "config" } });
			const acquisition = await ensureRemoteMirror(slug, { host });
			expect(acquisition).toMatchObject({
				ok: false,
				error: { kind: "config" },
			});
		},
	);

	test.each(["git version 2.37.9", "git version unknown"])(
		"requires Git 2.38 before remote acquisition for %s",
		async (rawVersion) => {
			const cacheDir = await mkdtemp(join(tmpdir(), "semantic-merge-old-git-"));
			const log = join(cacheDir, "acquisition-ran");
			const executable = await fakeGit(`
const fs = require("node:fs");
if (process.argv[2] === "--version") {
	process.stdout.write(${JSON.stringify(`${rawVersion}\n`)});
	process.exit(0);
}
fs.writeFileSync(${JSON.stringify(log)}, JSON.stringify(process.argv.slice(2)));
`);
			const result = await ensureRemoteMirror("owner/repo", {
				cacheDir,
				gitBinary: executable,
			});
			expect(result).toMatchObject({
				ok: false,
				error: {
					kind: "config",
					details: { detected: rawVersion, required: "2.38.0" },
				},
			});
			await expect(access(log)).rejects.toThrow();
		},
	);

	test("uses the pinned blobless clone shape and removes only a failed fresh target", async () => {
		const cacheDir = await mkdtemp(
			join(tmpdir(), "semantic-merge-clone-fail-"),
		);
		const log = join(cacheDir, "arguments.json");
		const executable = await fakeGit(`
const fs = require("node:fs");
if (process.argv[2] === "--version") { process.stdout.write("git version 2.44.1\\n"); process.exit(0); }
fs.writeFileSync(${JSON.stringify(log)}, JSON.stringify(process.argv.slice(2)));
fs.mkdirSync(process.argv.at(-1), { recursive: true });
fs.writeFileSync(require("node:path").join(process.argv.at(-1), "partial"), "partial");
process.stderr.write("credential=must-not-leak");
process.exit(2);
`);
		const location = remoteMirrorLocation("owner/repo", { cacheDir });
		expect(location.ok).toBe(true);
		if (!location.ok) return;

		const result = await ensureRemoteMirror("owner/repo", {
			cacheDir,
			gitBinary: executable,
		});
		expect(result).toMatchObject({ ok: false, error: { kind: "git" } });
		if (!result.ok) {
			expect(JSON.stringify(result.error)).not.toContain("must-not-leak");
		}
		await expect(access(location.value.absolutePath)).rejects.toThrow();
		const argumentsUsed = JSON.parse(await readFile(log, "utf8")) as string[];
		expect(argumentsUsed).toEqual([
			"clone",
			"--bare",
			"--filter=blob:none",
			"--no-single-branch",
			"https://github.com/owner/repo.git",
			location.value.absolutePath,
		]);
	});

	test("rejects a pre-existing cache path that is not a full-ancestry bare repository", async () => {
		const cacheDir = await mkdtemp(
			join(tmpdir(), "semantic-merge-invalid-cache-"),
		);
		const location = remoteMirrorLocation("owner/repo", { cacheDir });
		expect(location.ok).toBe(true);
		if (!location.ok) return;
		await mkdir(location.value.absolutePath);
		const executable = await fakeGit(`
if (process.argv[2] === "--version") { process.stdout.write("git version 2.44.1\\n"); process.exit(0); }
process.exit(128);
`);

		const result = await ensureRemoteMirror("owner/repo", {
			cacheDir,
			gitBinary: executable,
		});
		expect(result).toMatchObject({
			ok: false,
			error: { kind: "config", operation: "acquire remote mirror" },
		});
	});

	test("refreshes an existing mirror only when requested", async () => {
		const cacheDir = await mkdtemp(join(tmpdir(), "semantic-merge-refresh-"));
		const location = remoteMirrorLocation("owner/repo", { cacheDir });
		expect(location.ok).toBe(true);
		if (!location.ok) return;
		await mkdir(location.value.absolutePath, { recursive: true });
		const log = join(cacheDir, "refresh.json");
		const executable = await fakeGit(`
const fs = require("node:fs");
if (process.argv[2] === "--version") { process.stdout.write("git version 2.44.1\\n"); process.exit(0); }
if (process.argv[2] === "rev-parse" && process.argv[3] === "--is-bare-repository") { process.stdout.write("true\\n"); process.exit(0); }
if (process.argv[2] === "rev-parse" && process.argv[3] === "--is-shallow-repository") { process.stdout.write("false\\n"); process.exit(0); }
fs.writeFileSync(${JSON.stringify(log)}, JSON.stringify(process.argv.slice(2)));
`);
		const result = await ensureRemoteMirror("owner/repo", {
			cacheDir,
			gitBinary: executable,
			refresh: true,
		});
		expect(result.ok).toBe(true);
		expect(JSON.parse(await readFile(log, "utf8"))).toEqual([
			"fetch",
			"--prune",
			"--tags",
			"origin",
			"+refs/heads/*:refs/heads/*",
		]);
	});
});

describe("replay preflight", () => {
	test("quarantines configured custom drivers without executing them and records provenance", async () => {
		const repositoryPath = await createRepository();
		const base = await commitFiles(
			repositoryPath,
			{ ".gitattributes": "*.txt merge=hostile\n", "file.txt": "base\n" },
			"base",
		);
		await mustGit(repositoryPath, ["checkout", "-b", "theirs"]);
		const theirs = await commitFiles(
			repositoryPath,
			{ "file.txt": "theirs\n" },
			"theirs",
		);
		await mustGit(repositoryPath, ["checkout", "main"]);
		const ours = await commitFiles(
			repositoryPath,
			{ "ours.txt": "ours\n" },
			"ours",
		);
		const marker = join(repositoryPath, "driver-executed");
		const driver = `${process.execPath} -e "require('node:fs').writeFileSync('${marker}', 'bad')"`;
		await mustGit(repositoryPath, ["config", "merge.hostile.driver", driver]);
		const opened = await openLocalRepository(repositoryPath);
		expect(opened.ok).toBe(true);
		if (!opened.ok) return;
		const version = await gitVersion();
		expect(version.ok).toBe(true);
		if (!version.ok) return;

		const result = await inspectReplayPreflight(
			opened.value,
			[ours, theirs],
			version.value,
		);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.status).toBe("unsupported-custom-driver");
		expect(result.value.provenance).toMatchObject({
			gitVersion: version.value,
			algorithm: "merge-tree-write-tree",
			strategy: "ort",
			environmentPolicy: "isolated-v1",
			normalizationVersion: "v1",
			repoMergeConfigHash: expect.stringMatching(/^[a-f0-9]{64}$/),
		});
		const attributesOid = await mustGit(repositoryPath, [
			"rev-parse",
			"--verify",
			`${base}:.gitattributes`,
		]);
		expect(result.value.provenance.parentAttributes).toEqual({
			ours: attributesOid,
			theirs: attributesOid,
		});
		await expect(access(marker)).rejects.toThrow();
		expect(JSON.stringify(result.value)).not.toContain(driver);
	});

	test("marks a repository without merge drivers ready and uses null config hash", async () => {
		const repositoryPath = await createRepository();
		const parent = await commitFiles(repositoryPath, { "file.txt": "base\n" });
		const opened = await openLocalRepository(repositoryPath);
		expect(opened.ok).toBe(true);
		if (!opened.ok) return;
		const result = await inspectReplayPreflight(
			opened.value,
			[parent, parent],
			"git version 2.44.1",
		);
		expect(result).toMatchObject({
			ok: true,
			value: {
				status: "ready",
				provenance: {
					parentAttributes: { ours: null, theirs: null },
					repoMergeConfigHash: null,
				},
			},
		});
	});
});
