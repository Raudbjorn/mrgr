import { execFileSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, test } from "vitest";
import { runMechanism } from "../src/adapter.js";

// A real, spawnable stand-in for the external `mergiraf` binary — same
// pattern as the repo's fake-`git` fixtures (packages/core/tests/evaluation/git.test.ts):
// substitutes the external tool, not the JS-level spawnSync call, so the
// real subprocess/filesystem machinery still runs.
function writeFakeMergiraf(dir: string, script: string): string {
	const path = join(dir, "fake-mergiraf");
	writeFileSync(path, `#!/usr/bin/env bash\n${script}\n`);
	chmodSync(path, 0o755);
	return path;
}

// `process.env.X = undefined` coerces to the literal string "undefined"
// rather than clearing the variable — restoring an unset env var this way
// silently poisons it for every test that runs afterward.
function restoreEnv(name: string, value: string | undefined): void {
	if (value === undefined) delete process.env[name];
	else process.env[name] = value;
}

// mergiraf is an external Rust binary, not a workspace dependency — it's not
// installed in every environment. These isolated tests may skip; the real
// Git-driver gate requires 0.19.0, and CI installs that pinned version.
function mergirafAvailable(): boolean {
	try {
		execFileSync(process.env.MERGIRAF_BIN ?? "mergiraf", ["--version"], { stdio: "ignore" });
		return true;
	} catch {
		return false;
	}
}

let dir: string;

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "mrgr-mechanisms-"));
});

function writeFixture(base: string, ours: string, theirs: string) {
	const basePath = join(dir, "base.txt");
	const oursPath = join(dir, "ours.txt");
	const theirsPath = join(dir, "theirs.txt");
	writeFileSync(basePath, base);
	writeFileSync(oursPath, ours);
	writeFileSync(theirsPath, theirs);
	return { basePath, oursPath, theirsPath };
}

describe("spawn failure handling", () => {
	test("git_text returns normalizedStatus 130 instead of throwing when git can't be spawned", async () => {
		const { basePath, oursPath, theirsPath } = writeFixture("a\n", "a\n", "a\n");
		const originalPath = process.env.PATH;
		process.env.PATH = dir; // an empty directory: git genuinely can't be found
		try {
			const result = await runMechanism("git_text", {
				base: basePath,
				ours: oursPath,
				theirs: theirsPath,
				path: "file.txt",
			});
			expect(result.ok).toBe(true);
			if (!result.ok) return;
			expect(result.value.normalizedStatus).toBe(130);
		} finally {
			process.env.PATH = originalPath;
		}
	});

	test("gnu_diff3 returns normalizedStatus 130 instead of throwing when diff3 can't be spawned", async () => {
		const { basePath, oursPath, theirsPath } = writeFixture("a\n", "a\n", "a\n");
		const originalPath = process.env.PATH;
		process.env.PATH = dir;
		try {
			const result = await runMechanism("gnu_diff3", {
				base: basePath,
				ours: oursPath,
				theirs: theirsPath,
				path: "file.txt",
			});
			expect(result.ok).toBe(true);
			if (!result.ok) return;
			expect(result.value.normalizedStatus).toBe(130);
		} finally {
			process.env.PATH = originalPath;
		}
	});
});

describe("mergiraf output verification", () => {
	test("exits 0 but writes nothing to the -o path: treated as fatal, ours left untouched", async () => {
		const { basePath, oursPath, theirsPath } = writeFixture("a\n", "ours-original\n", "b\n");
		const fake = writeFakeMergiraf(dir, "exit 0"); // never touches its -o argument
		const originalBin = process.env.MERGIRAF_BIN;
		process.env.MERGIRAF_BIN = fake;
		try {
			const result = await runMechanism("mergiraf", {
				base: basePath,
				ours: oursPath,
				theirs: theirsPath,
				path: "file.txt",
			});
			expect(result.ok).toBe(true);
			if (!result.ok) return;
			expect(result.value.normalizedStatus).toBe(130);
			expect(result.value.rawStatus).toBe(0);
			expect(result.value.error).toContain("ENOENT");
			expect(readFileSync(oursPath, "utf8")).toBe("ours-original\n");
		} finally {
			restoreEnv("MERGIRAF_BIN", originalBin);
		}
	});
});

describe("mergiraf timeout handling", () => {
	test("a mechanism that hangs past the timeout is killed and treated as fatal, ours left untouched", async () => {
		const { basePath, oursPath, theirsPath } = writeFixture("a\n", "ours-original\n", "b\n");
		const fake = writeFakeMergiraf(dir, "sleep 5"); // deliberately far past the 200ms timeout below
		const originalBin = process.env.MERGIRAF_BIN;
		const originalTimeout = process.env.MRGR_MECHANISM_TIMEOUT_MS;
		process.env.MERGIRAF_BIN = fake;
		process.env.MRGR_MECHANISM_TIMEOUT_MS = "200";
		try {
			const result = await runMechanism("mergiraf", {
				base: basePath,
				ours: oursPath,
				theirs: theirsPath,
				path: "file.txt",
			});
			expect(result.ok).toBe(true);
			if (!result.ok) return;
			expect(result.value.normalizedStatus).toBe(130);
			expect(readFileSync(oursPath, "utf8")).toBe("ours-original\n");
		} finally {
			restoreEnv("MERGIRAF_BIN", originalBin);
			restoreEnv("MRGR_MECHANISM_TIMEOUT_MS", originalTimeout);
		}
	});
});

describe("git_text mechanism", () => {
	test("clean merge produces normalizedStatus 0 and no conflict markers", async () => {
		const { basePath, oursPath, theirsPath } = writeFixture(
			"line1\nline2\nline3\n",
			"line1-ours\nline2\nline3\n",
			"line1\nline2\nline3-theirs\n",
		);

		const result = await runMechanism("git_text", {
			base: basePath,
			ours: oursPath,
			theirs: theirsPath,
			path: "file.txt",
		});

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.normalizedStatus).toBe(0);
		expect(result.value.hasConflictMarkers).toBe(false);
		expect(readFileSync(oursPath, "utf8")).toBe("line1-ours\nline2\nline3-theirs\n");
	});

	test("overlapping edits produce normalizedStatus 1 and conflict markers", async () => {
		const { basePath, oursPath, theirsPath } = writeFixture(
			"line1\n",
			"line1-ours\n",
			"line1-theirs\n",
		);

		const result = await runMechanism("git_text", {
			base: basePath,
			ours: oursPath,
			theirs: theirsPath,
			path: "file.txt",
		});

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.normalizedStatus).toBe(1);
		expect(result.value.hasConflictMarkers).toBe(true);
		expect(readFileSync(oursPath, "utf8")).toContain("<<<<<<< OURS");
	});
});

describe("gnu_diff3 mechanism", () => {
	test("clean merge produces normalizedStatus 0 and no conflict markers", async () => {
		const { basePath, oursPath, theirsPath } = writeFixture(
			"line1\nline2\nline3\n",
			"line1-ours\nline2\nline3\n",
			"line1\nline2\nline3-theirs\n",
		);

		const result = await runMechanism("gnu_diff3", {
			base: basePath,
			ours: oursPath,
			theirs: theirsPath,
			path: "file.txt",
		});

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.normalizedStatus).toBe(0);
		expect(result.value.hasConflictMarkers).toBe(false);
		expect(readFileSync(oursPath, "utf8")).toBe("line1-ours\nline2\nline3-theirs\n");
	});

	test("overlapping edits produce normalizedStatus 1 and conflict markers", async () => {
		const { basePath, oursPath, theirsPath } = writeFixture(
			"line1\n",
			"line1-ours\n",
			"line1-theirs\n",
		);

		const result = await runMechanism("gnu_diff3", {
			base: basePath,
			ours: oursPath,
			theirs: theirsPath,
			path: "file.txt",
		});

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.normalizedStatus).toBe(1);
		expect(result.value.hasConflictMarkers).toBe(true);
		expect(readFileSync(oursPath, "utf8")).toContain("<<<<<<< OURS");
	});
});

describe.skipIf(!mergirafAvailable())("mergiraf mechanism", () => {
	test("clean merge produces normalizedStatus 0 and no conflict markers", async () => {
		const { basePath, oursPath, theirsPath } = writeFixture(
			"line1\nline2\nline3\n",
			"line1-ours\nline2\nline3\n",
			"line1\nline2\nline3-theirs\n",
		);

		const result = await runMechanism("mergiraf", {
			base: basePath,
			ours: oursPath,
			theirs: theirsPath,
			path: "file.txt",
		});

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.normalizedStatus).toBe(0);
		expect(result.value.hasConflictMarkers).toBe(false);
		expect(readFileSync(oursPath, "utf8")).toBe("line1-ours\nline2\nline3-theirs\n");
	});

	test("overlapping edits produce normalizedStatus 1 and conflict markers", async () => {
		const { basePath, oursPath, theirsPath } = writeFixture(
			"line1\n",
			"line1-ours\n",
			"line1-theirs\n",
		);

		const result = await runMechanism("mergiraf", {
			base: basePath,
			ours: oursPath,
			theirs: theirsPath,
			path: "file.txt",
		});

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.normalizedStatus).toBe(1);
		expect(result.value.hasConflictMarkers).toBe(true);
		expect(readFileSync(oursPath, "utf8")).toContain("<<<<<<< OURS");
	});
});
