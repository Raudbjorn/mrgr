import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, test } from "vitest";
import { classifyPath, mergeFiles } from "../src/registry.js";

describe("classifyPath", () => {
	test("resolves merge=mergiraf for a matching pattern", () => {
		const rules = [{ pattern: "*.ts", merge: "mergiraf" as const }];
		expect(classifyPath(rules, "src/index.ts")).toBe("mergiraf");
	});

	test("resolves explicit merge=binary macro for binary patterns", () => {
		const rules = [
			{ pattern: "*.ts", merge: "mergiraf" as const },
			{ pattern: "*.png", merge: "binary" as const },
		];
		expect(classifyPath(rules, "assets/logo.png")).toBe("binary");
		expect(classifyPath(rules, "src/index.ts")).toBe("mergiraf");
	});

	test("returns undefined when no pattern matches", () => {
		const rules = [{ pattern: "*.png", merge: "binary" as const }];
		expect(classifyPath(rules, "src/index.ts")).toBeUndefined();
	});

	test("a directory-qualified pattern matches the full path, not just the basename", () => {
		const rules = [{ pattern: "docs/*.md", merge: "mergiraf" as const }];
		expect(classifyPath(rules, "docs/readme.md")).toBe("mergiraf");
		expect(classifyPath(rules, "other/readme.md")).toBeUndefined();
	});
});

describe("mergeFiles — D79-style mixed text+binary fixture", () => {
	let dir: string;

	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), "mrgr-mechanisms-registry-"));
	});

	function writeTextFixture(name: string) {
		const base = join(dir, `${name}-base.txt`);
		const ours = join(dir, `${name}-ours.txt`);
		const theirs = join(dir, `${name}-theirs.txt`);
		writeFileSync(base, "line1\nline2\nline3\n");
		writeFileSync(ours, "line1-ours\nline2\nline3\n");
		writeFileSync(theirs, "line1\nline2\nline3-theirs\n");
		return { base, ours, theirs };
	}

	function writeBinaryFixture(name: string) {
		const base = join(dir, `${name}-base.bin`);
		const ours = join(dir, `${name}-ours.bin`);
		const theirs = join(dir, `${name}-theirs.bin`);
		writeFileSync(base, Buffer.from([0, 1, 2]));
		writeFileSync(ours, Buffer.from([0, 1, 9]));
		writeFileSync(theirs, Buffer.from([0, 1, 8]));
		return { base, ours, theirs };
	}

	const rules = [
		{ pattern: "*.txt", merge: "git_text" as const },
		{ pattern: "*.bin", merge: "binary" as const },
	];

	test("binary fallback never silently skips — it's recorded as its own outcome", async () => {
		const bin = writeBinaryFixture("a");

		const result = await mergeFiles(rules, "git_text", [
			{ base: bin.base, ours: bin.ours, theirs: bin.theirs, path: "a.bin" },
		]);

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value).toHaveLength(1);
		expect(result.value[0].outcome.kind).toBe("binary-fallback");
	});

	test("a binary fallback earlier in the batch does not affect a text merge later in the batch", async () => {
		const bin = writeBinaryFixture("a");
		const text = writeTextFixture("b");

		const result = await mergeFiles(rules, "git_text", [
			{ base: bin.base, ours: bin.ours, theirs: bin.theirs, path: "a.bin" },
			{ base: text.base, ours: text.ours, theirs: text.theirs, path: "b.txt" },
		]);

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value).toHaveLength(2);
		expect(result.value[0].outcome.kind).toBe("binary-fallback");
		expect(result.value[1].outcome.kind).toBe("merged");
		if (result.value[1].outcome.kind === "merged") {
			expect(result.value[1].outcome.result.normalizedStatus).toBe(0);
		}
		expect(readFileSync(text.ours, "utf8")).toBe("line1-ours\nline2\nline3-theirs\n");
		// The binary file's own bytes are untouched by the fallback (no mechanism ran on it).
		expect(readFileSync(bin.ours)).toEqual(Buffer.from([0, 1, 9]));
	});

	test("a text merge earlier in the batch is preserved after a later binary fallback", async () => {
		const text = writeTextFixture("c");
		const bin = writeBinaryFixture("d");

		const result = await mergeFiles(rules, "git_text", [
			{ base: text.base, ours: text.ours, theirs: text.theirs, path: "c.txt" },
			{ base: bin.base, ours: bin.ours, theirs: bin.theirs, path: "d.bin" },
		]);

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value[0].outcome.kind).toBe("merged");
		expect(result.value[1].outcome.kind).toBe("binary-fallback");
		// The earlier text resolution must survive the later binary abort untouched.
		expect(readFileSync(text.ours, "utf8")).toBe("line1-ours\nline2\nline3-theirs\n");
	});
});
