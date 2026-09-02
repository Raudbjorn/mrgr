import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, test } from "vitest";
import { runMechanism } from "../src/adapter.js";

let repo: string;

function git(...args: string[]): string {
	return execFileSync("git", args, { cwd: repo, encoding: "utf8" }).trim();
}

beforeEach(() => {
	repo = mkdtempSync(join(tmpdir(), "mrgr-mechanisms-repo-"));
	git("init", "-q");
	git("config", "user.email", "test@example.com");
	git("config", "user.name", "test");
});

describe("git_text adapter equivalence to git's own ort merge", () => {
	function readContentAt(sha: string): string {
		return execFileSync("git", ["show", `${sha}:file.txt`], { cwd: repo, encoding: "utf8" });
	}

	test("clean non-overlapping merge matches git merge-tree --write-tree exactly", async () => {
		writeFileSync(join(repo, "file.txt"), "line1\nline2\nline3\n");
		git("add", "file.txt");
		git("commit", "-q", "-m", "base");
		const baseSha = git("rev-parse", "HEAD");

		git("checkout", "-q", "-b", "ours");
		writeFileSync(join(repo, "file.txt"), "line1-ours\nline2\nline3\n");
		git("commit", "-q", "-am", "ours");
		const oursSha = git("rev-parse", "HEAD");

		git("checkout", "-q", baseSha, "-b", "theirs");
		writeFileSync(join(repo, "file.txt"), "line1\nline2\nline3-theirs\n");
		git("commit", "-q", "-am", "theirs");
		const theirsSha = git("rev-parse", "HEAD");

		const gitTreeOid = git("merge-tree", "--write-tree", oursSha, theirsSha);

		const basePath = join(repo, "base-content.txt");
		const oursPath = join(repo, "ours-content.txt");
		const theirsPath = join(repo, "theirs-content.txt");
		writeFileSync(basePath, readContentAt(baseSha));
		writeFileSync(oursPath, readContentAt(oursSha));
		writeFileSync(theirsPath, readContentAt(theirsSha));

		const result = await runMechanism("git_text", { base: basePath, ours: oursPath, theirs: theirsPath, path: "file.txt" });
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.normalizedStatus).toBe(0);

		const mergedBlob = readFileSync(oursPath, "utf8");
		const blobOid = execFileSync("git", ["hash-object", "-w", "--stdin"], {
			cwd: repo,
			input: mergedBlob,
			encoding: "utf8",
		}).trim();
		const mode = git("ls-tree", baseSha, "file.txt").split(/\s+/)[0];
		const adapterTreeOid = execFileSync("git", ["mktree"], {
			cwd: repo,
			input: `${mode} blob ${blobOid}\tfile.txt\n`,
			encoding: "utf8",
		}).trim();

		expect(adapterTreeOid).toBe(gitTreeOid);
	});
});

describe("git_text determinism", () => {
	test("five runs on the same fixture produce identical merged blob OIDs", async () => {
		const dir = mkdtempSync(join(tmpdir(), "mrgr-mechanisms-determinism-"));
		const basePath = join(dir, "base.txt");
		writeFileSync(basePath, "line1\nline2\nline3\n");

		const oids: string[] = [];
		for (let i = 0; i < 5; i++) {
			const oursPath = join(dir, `ours-${i}.txt`);
			const theirsPath = join(dir, `theirs-${i}.txt`);
			writeFileSync(oursPath, "line1-ours\nline2\nline3\n");
			writeFileSync(theirsPath, "line1\nline2\nline3-theirs\n");

			const result = await runMechanism("git_text", {
				base: basePath,
				ours: oursPath,
				theirs: theirsPath,
				path: "file.txt",
			});
			expect(result.ok).toBe(true);
			if (!result.ok) continue;

			const oid = execFileSync("git", ["hash-object", "--stdin"], {
				input: readFileSync(oursPath, "utf8"),
				encoding: "utf8",
			}).trim();
			oids.push(oid);
		}

		expect(oids).toHaveLength(5);
		expect(new Set(oids).size).toBe(1);
	});
});

describe("status-layer separation", () => {
	test("rawStatus (conflict count) and normalizedStatus (0/1/130) are reported separately", async () => {
		const dir = mkdtempSync(join(tmpdir(), "mrgr-mechanisms-status-"));
		const basePath = join(dir, "base.txt");
		const oursPath = join(dir, "ours.txt");
		const theirsPath = join(dir, "theirs.txt");
		// Two independent, non-adjacent conflicting hunks: git merge-file's raw
		// exit code is the conflict *count* (2), while normalizedStatus caps at 1.
		writeFileSync(basePath, "a\nunchanged1\nb\nunchanged2\nunchanged3\n");
		writeFileSync(oursPath, "a-ours\nunchanged1\nb\nunchanged2-ours\nunchanged3\n");
		writeFileSync(theirsPath, "a-theirs\nunchanged1\nb\nunchanged2-theirs\nunchanged3\n");

		const result = await runMechanism("git_text", { base: basePath, ours: oursPath, theirs: theirsPath, path: "file.txt" });

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.rawStatus).toBe(2);
		expect(result.value.normalizedStatus).toBe(1);
		expect(result.value.rawStatus).not.toBe(result.value.normalizedStatus);
	});
});
