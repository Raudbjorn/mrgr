import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, test } from "vitest";
import { runMechanism } from "../src/adapter.js";

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

describe("mergiraf mechanism", () => {
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
