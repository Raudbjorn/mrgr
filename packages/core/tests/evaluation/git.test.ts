import { access, chmod, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { describe, expect, test } from "vitest";

import {
	assertMinimumGitVersion,
	baselineId,
	baselineInput,
	buildGitEnvironment,
	gitVersion,
	runGit,
} from "../../src/evaluation/git.js";

async function fakeGit(source: string): Promise<string> {
	const directory = await mkdtemp(join(tmpdir(), "semantic-merge-fake-git-"));
	const executable = join(directory, "git");
	await writeFile(executable, `#!/usr/bin/env node\n${source}\n`);
	await chmod(executable, 0o755);
	return executable;
}

describe("runGit", () => {
	test("passes spaces and shell metacharacters as literal arguments", async () => {
		const executable = await fakeGit(
			"process.stdout.write(JSON.stringify(process.argv.slice(2)))",
		);
		const args = ["show", "name with spaces", "$(touch never)", "semi;colon"];

		const result = await runGit(process.cwd(), args, {
			gitBinary: executable,
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(JSON.parse(result.value.stdoutText())).toEqual(args);
		}
	});

	test("times out and kills the spawned process tree", async () => {
		const directory = await mkdtemp(join(tmpdir(), "semantic-merge-timeout-"));
		const marker = join(directory, "child-survived");
		const executable = await fakeGit(`
const { spawn } = require("node:child_process");
spawn(process.execPath, ["-e", "setTimeout(() => require('node:fs').writeFileSync(process.argv[1], 'alive'), 150)", process.argv[2]], { stdio: "ignore" });
setInterval(() => {}, 1000);
`);

		const result = await runGit(process.cwd(), [marker], {
			gitBinary: executable,
			timeoutMs: 30,
		});
		expect(result).toMatchObject({ ok: false, error: { kind: "timeout" } });
		// Real time is required here because the behavior under test is OS process-group termination.
		await delay(300);
		await expect(access(marker)).rejects.toThrow();
	});

	test("enforces the combined output cap", async () => {
		const executable = await fakeGit(
			"process.stdout.write(Buffer.alloc(4096, 120)); setInterval(() => {}, 1000)",
		);
		const result = await runGit(process.cwd(), [], {
			gitBinary: executable,
			maxOutputBytes: 64,
		});
		expect(result).toMatchObject({
			ok: false,
			error: { kind: "output-limit", details: { maxOutputBytes: 64 } },
		});
	});

	test("preserves stdout and stderr bytes for an accepted nonzero exit", async () => {
		const executable = await fakeGit(
			"process.stdout.write(Buffer.from([0, 255, 10])); process.stderr.write(Buffer.from([1, 254])); process.exit(7)",
		);
		const result = await runGit(process.cwd(), [], {
			acceptedExitCodes: [7],
			gitBinary: executable,
		});
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.exitCode).toBe(7);
			expect([...result.value.stdout]).toEqual([0, 255, 10]);
			expect([...result.value.stderr]).toEqual([1, 254]);
			expect(result.value.stdoutText()).toBe(
				Buffer.from([0, 255, 10]).toString("utf8"),
			);
		}
	});

	test("allowlists inherited environment and forces Git isolation variables", async () => {
		const inherited = {
			PATH: process.env.PATH,
			HOME: "/allowed-home",
			HTTPS_PROXY: "https://proxy.invalid",
			SECRET_TOKEN: "must-not-pass",
			GIT_CONFIG_GLOBAL: "/must/not/pass",
		};
		const environment = buildGitEnvironment(inherited);
		expect(environment).toEqual({
			PATH: process.env.PATH,
			HOME: "/allowed-home",
			HTTPS_PROXY: "https://proxy.invalid",
			LC_ALL: "C",
			GIT_CONFIG_NOSYSTEM: "1",
			GIT_CONFIG_GLOBAL: "/dev/null",
			GIT_NO_REPLACE_OBJECTS: "1",
			GIT_OPTIONAL_LOCKS: "0",
			GIT_TERMINAL_PROMPT: "0",
		});

		const executable = await fakeGit(
			"process.stdout.write(JSON.stringify(process.env))",
		);
		const result = await runGit(process.cwd(), [], {
			gitBinary: executable,
			inheritedEnvironment: inherited,
		});
		expect(result.ok).toBe(true);
		if (result.ok) {
			const childEnvironment = JSON.parse(result.value.stdoutText()) as Record<
				string,
				string
			>;
			expect(childEnvironment.SECRET_TOKEN).toBeUndefined();
			expect(childEnvironment.GIT_CONFIG_GLOBAL).toBe("/dev/null");
			expect(childEnvironment.LC_ALL).toBe("C");
		}
	});

	test("ignores a HOME-scoped global config", async () => {
		const home = await mkdtemp(join(tmpdir(), "semantic-merge-home-"));
		await writeFile(
			join(home, ".gitconfig"),
			"[wp0]\n\tsecret = should-not-leak\n",
		);
		const result = await runGit(
			process.cwd(),
			["config", "--global", "wp0.secret"],
			{
				acceptedExitCodes: [1],
				inheritedEnvironment: { PATH: process.env.PATH, HOME: home },
			},
		);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.exitCode).toBe(1);
			expect(result.value.stdout.length).toBe(0);
		}
	});

	test("does not copy stderr, secrets, or arguments into structured errors", async () => {
		const executable = await fakeGit(
			"process.stderr.write('credential=top-secret'); process.exit(9)",
		);
		const result = await runGit(
			process.cwd(),
			["clone", "https://token@example.invalid/owner/repo.git"],
			{ gitBinary: executable },
		);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			const serialized = JSON.stringify(result.error);
			expect(serialized).not.toContain("top-secret");
			expect(serialized).not.toContain("token@example");
			expect(result.error).toMatchObject({
				kind: "git",
				operation: "git clone",
			});
		}
	});
});

describe("Git baseline", () => {
	test("reads the exact raw version and compares the first numeric triple", async () => {
		const executable = await fakeGit(
			"process.stdout.write('git version 2.44.1.windows.1\\n')",
		);
		const version = await gitVersion(executable);
		expect(version).toEqual({
			ok: true,
			value: "git version 2.44.1.windows.1",
		});
		expect(assertMinimumGitVersion("git version 2.38.0", "2.38.0")).toEqual({
			ok: true,
			value: undefined,
		});
		expect(
			assertMinimumGitVersion("git version 2.37.9", "2.38.0"),
		).toMatchObject({
			ok: false,
			error: {
				kind: "config",
				details: { detected: "git version 2.37.9", required: "2.38.0" },
			},
		});
		expect(
			assertMinimumGitVersion("git version unknown", "2.38.0"),
		).toMatchObject({
			ok: false,
			error: {
				kind: "config",
				details: { detected: "git version unknown", required: "2.38.0" },
			},
		});
	});

	test("builds deterministic and Git-version-sensitive baseline IDs", () => {
		const input = baselineInput("git version 2.44.1");
		expect(JSON.parse(input)).toEqual({
			schemaVersion: 2,
			gitVersion: "git version 2.44.1",
			environmentPolicy: "isolated-v1",
			replayCommand: "merge-tree --write-tree --messages -z P1 P2",
			normalizationVersion: "v1",
		});
		expect(baselineId("git version 2.44.1")).toBe(
			baselineId("git version 2.44.1"),
		);
		expect(baselineId("git version 2.44.1")).not.toBe(
			baselineId("git version 2.45.0"),
		);
		expect(baselineId("git version 2.44.1")).toMatch(/^[a-f0-9]{64}$/);
	});
});
