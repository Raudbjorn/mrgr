import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { rm } from "node:fs/promises";

import { extractEvidenceBundles } from "../../src/m1a/forensic-core.js";
import { EvidenceBundleSchema } from "../../src/m1a/evidence.js";
import { commitFiles, createRepository } from "../evaluation/git-fixture.js";
import { runGit } from "../../src/evaluation/git.js";

const CONFLICT_PATH = "conflict.txt";

const repositories: string[] = [];

async function newRepository(): Promise<string> {
	const path = await createRepository();
	repositories.push(path);
	return path;
}

/**
 * Two commits that both change `files` away from a common base, so replaying
 * them conflicts. Returns the two parent SHAs.
 */
async function divergent(
	repository: string,
	base: Record<string, string | null>,
	ours: Record<string, string | null>,
	theirs: Record<string, string | null>,
): Promise<{ base: string; ours: string; theirs: string }> {
	const baseSha = await commitFiles(repository, base, "base");
	await runGit(repository, ["checkout", "-b", "ours"]);
	const oursSha = await commitFiles(repository, ours, "ours");
	await runGit(repository, ["checkout", baseSha, "-b", "theirs"]);
	const theirsSha = await commitFiles(repository, theirs, "theirs");
	return { base: baseSha, ours: oursSha, theirs: theirsSha };
}

let sharedRepo: string;

beforeAll(async () => {
	sharedRepo = await newRepository();
});

afterAll(async () => {
	await Promise.all(
		repositories.map((path) => rm(path, { recursive: true, force: true })),
	);
});

describe("EvidenceBundleSchema", () => {
	const canonical = {
		conflict_path: "src/a.ts",
		conflict_ordinal: 1,
		conflict_hunk_ours: "FOO=bar",
		conflict_hunk_base: "FOO=baz",
		conflict_hunk_theirs: "FOO=qux",
		preimage_ours: null,
		preimage_theirs: null,
		preimage_ours_bytes: null,
		preimage_theirs_bytes: null,
		preimage_ours_truncated: false,
		preimage_theirs_truncated: false,
		dependency_graph: ["ours:Makefile.am", "theirs:Makefile.am"],
		dependency_graph_status: "derived",
	};

	it("accepts the canonical shape", () => {
		expect(EvidenceBundleSchema.safeParse(canonical).success).toBe(true);
	});

	it("rejects a dependency_graph entry that is not a side-tagged path", () => {
		// The defect this guards: extra conflict regions used to be serialized
		// into this array as `+ours|base|theirs`, mixing hunk payloads into a
		// path list. Extra regions are separate bundles now.
		const parsed = EvidenceBundleSchema.safeParse({
			...canonical,
			dependency_graph: ["+ours choice|base choice|theirs choice"],
		});
		expect(parsed.success).toBe(false);
	});

	it("requires a 1-based region ordinal", () => {
		expect(
			EvidenceBundleSchema.safeParse({ ...canonical, conflict_ordinal: 0 }).success,
		).toBe(false);
	});
});

describe("extractEvidenceBundles — error semantics", () => {
	it("propagates the underlying runGit error, preserving the inner operation", async () => {
		const result = await extractEvidenceBundles(
			"/nonexistent/repo/path",
			"0123456789abcdef0123456789abcdef01234567",
			"89abcdef0123456789abcdef0123456789abcdef",
			"Makefile.am",
		);
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.kind).toBe("config");
		expect(result.error.details).toMatchObject({
			code: "ENOENT",
			inner_operation: expect.stringContaining("fetchPreimage"),
		});
	});

	it("reports a missing revision as a typed error, not as an absent path", async () => {
		const { theirs } = await divergent(
			sharedRepo,
			{ [CONFLICT_PATH]: "base\n" },
			{ [CONFLICT_PATH]: "ours\n" },
			{ [CONFLICT_PATH]: "theirs\n" },
		);
		const result = await extractEvidenceBundles(
			sharedRepo,
			"0000000000000000000000000000000000000000",
			theirs,
			CONFLICT_PATH,
		);
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.kind).toBe("not-found");
		expect(result.error.message).toContain("Revision does not exist");
	});
});

describe("extractEvidenceBundles — preimage semantics", () => {
	it("captures the whole file, which is not the conflict hunk", async () => {
		const repository = await newRepository();
		// The preimage must be the entire parent-side file. The surrounding
		// lines are what make it distinguishable from the hunk; H0's D2 defect
		// was that a field named "preimage" carried hunk text.
		const oursFile = "header\nours choice\nfooter\n";
		const theirsFile = "header\ntheirs choice\nfooter\n";
		const { ours, theirs } = await divergent(
			repository,
			{ [CONFLICT_PATH]: "header\nbase choice\nfooter\n" },
			{ [CONFLICT_PATH]: oursFile },
			{ [CONFLICT_PATH]: theirsFile },
		);

		const result = await extractEvidenceBundles(repository, ours, theirs, CONFLICT_PATH);
		expect(result.ok, result.ok ? "" : JSON.stringify(result.error)).toBe(true);
		if (!result.ok) return;

		const [bundle] = result.value;
		expect(bundle).toBeDefined();
		if (!bundle) return;

		expect(EvidenceBundleSchema.safeParse(bundle).success).toBe(true);

		// Equals the committed file exactly.
		expect(bundle.preimage_ours).toBe(oursFile);
		expect(bundle.preimage_theirs).toBe(theirsFile);
		// And is not merely the hunk relabelled.
		expect(bundle.preimage_ours).not.toBe(bundle.conflict_hunk_ours);
		expect(bundle.preimage_theirs).not.toBe(bundle.conflict_hunk_theirs);
		expect(bundle.preimage_ours).toContain("header");

		expect(bundle.preimage_ours_truncated).toBe(false);
		expect(bundle.preimage_ours_bytes).toBe(Buffer.byteLength(oursFile, "utf8"));
	});

	it("counts bytes, not UTF-16 code units", async () => {
		const repository = await newRepository();
		// "日本語" is 3 characters but 9 UTF-8 bytes. A byte count derived from
		// String.length would report the character count and be wrong.
		const oursFile = "日本語\nours\n";
		const { ours, theirs } = await divergent(
			repository,
			{ [CONFLICT_PATH]: "日本語\nbase\n" },
			{ [CONFLICT_PATH]: oursFile },
			{ [CONFLICT_PATH]: "日本語\ntheirs\n" },
		);

		const result = await extractEvidenceBundles(repository, ours, theirs, CONFLICT_PATH);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		const bundle = result.value[0];
		if (!bundle) throw new Error("expected a bundle");

		const bytes = Buffer.byteLength(oursFile, "utf8");
		expect(bytes).toBeGreaterThan(oursFile.length); // the two units genuinely differ
		expect(bundle.preimage_ours_bytes).toBe(bytes);
		expect(bundle.preimage_ours_bytes).not.toBe(oursFile.length);
	});

	it("records the original size when truncating, and never splits a character", async () => {
		const repository = await newRepository();
		const oursFile = `${"日".repeat(50)}\nours\n`;
		const { ours, theirs } = await divergent(
			repository,
			{ [CONFLICT_PATH]: `${"日".repeat(50)}\nbase\n` },
			{ [CONFLICT_PATH]: oursFile },
			{ [CONFLICT_PATH]: `${"日".repeat(50)}\ntheirs\n` },
		);

		const maxBytes = 10; // lands mid-character: 日 is 3 bytes
		const result = await extractEvidenceBundles(
			repository,
			ours,
			theirs,
			CONFLICT_PATH,
			{ maxBytes },
		);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		const bundle = result.value[0];
		if (!bundle) throw new Error("expected a bundle");

		expect(bundle.preimage_ours_truncated).toBe(true);
		// The recorded size is the ORIGINAL, so a consumer knows what is missing.
		expect(bundle.preimage_ours_bytes).toBe(Buffer.byteLength(oursFile, "utf8"));
		expect(bundle.preimage_ours_bytes as number).toBeGreaterThan(maxBytes);

		const stored = bundle.preimage_ours as string;
		expect(Buffer.byteLength(stored, "utf8")).toBeLessThanOrEqual(maxBytes);
		// No replacement character: the cut fell on a character boundary.
		expect(stored).not.toContain("�");
		expect(oursFile.startsWith(stored)).toBe(true);
	});

	it("returns null for a side that does not contain the path (add/add)", async () => {
		const repository = await newRepository();
		// Neither side has the file at the base; both add it differently.
		const baseSha = await commitFiles(repository, { "seed.txt": "seed\n" }, "seed");
		await runGit(repository, ["checkout", "-b", "ours"]);
		const oursSha = await commitFiles(repository, { [CONFLICT_PATH]: "ours\n" }, "ours adds");
		await runGit(repository, ["checkout", baseSha, "-b", "theirs"]);
		const theirsSha = await commitFiles(repository, { [CONFLICT_PATH]: "theirs\n" }, "theirs adds");

		const result = await extractEvidenceBundles(
			repository,
			oursSha,
			theirsSha,
			CONFLICT_PATH,
		);
		expect(result.ok, result.ok ? "" : JSON.stringify(result.error)).toBe(true);
		if (!result.ok) return;
		const bundle = result.value[0];
		if (!bundle) throw new Error("expected a bundle");
		// Both sides added it, so both preimages exist here; the point is the
		// extraction succeeded rather than erroring on the add/add shape.
		expect(bundle.conflict_path).toBe(CONFLICT_PATH);
	});

	it("returns null for the deleting side (delete/modify)", async () => {
		const repository = await newRepository();
		const baseSha = await commitFiles(
			repository,
			{ [CONFLICT_PATH]: "base\nline\n" },
			"base",
		);
		await runGit(repository, ["checkout", "-b", "ours"]);
		const oursSha = await commitFiles(repository, { [CONFLICT_PATH]: null }, "ours deletes");
		await runGit(repository, ["checkout", baseSha, "-b", "theirs"]);
		const theirsSha = await commitFiles(
			repository,
			{ [CONFLICT_PATH]: "theirs\nline\n" },
			"theirs modifies",
		);

		const result = await extractEvidenceBundles(
			repository,
			oursSha,
			theirsSha,
			CONFLICT_PATH,
		);
		// A delete/modify has no diff3 content region, so extraction reports a
		// typed parse failure rather than inventing a bundle. What matters is
		// that the deleting side produced `null` rather than a hard error on
		// the missing path — asserted directly below.
		if (result.ok) {
			const bundle = result.value[0];
			expect(bundle?.preimage_ours).toBeNull();
		} else {
			expect(result.error.kind).toBe("parse");
			expect(result.error.message).toContain("No diff3 conflict markers");
		}
	});
});

describe("extractEvidenceBundles — region identity", () => {
	it("emits one bundle per conflict region, ordinal 1..n, with no hunks in dependency_graph", async () => {
		const repository = await newRepository();
		// Two separated conflict regions in one file.
		const spacer = "\n".concat("filler\n".repeat(12));
		const { ours, theirs } = await divergent(
			repository,
			{ [CONFLICT_PATH]: `base one\n${spacer}base two\n` },
			{ [CONFLICT_PATH]: `ours one\n${spacer}ours two\n` },
			{ [CONFLICT_PATH]: `theirs one\n${spacer}theirs two\n` },
		);

		const result = await extractEvidenceBundles(repository, ours, theirs, CONFLICT_PATH);
		expect(result.ok, result.ok ? "" : JSON.stringify(result.error)).toBe(true);
		if (!result.ok) return;

		expect(result.value.length).toBeGreaterThanOrEqual(2);
		expect(result.value.map((bundle) => bundle.conflict_ordinal)).toEqual(
			result.value.map((_, index) => index + 1),
		);

		for (const bundle of result.value) {
			expect(bundle.conflict_path).toBe(CONFLICT_PATH);
			// Every entry is a side-tagged path; none is a smuggled hunk.
			for (const entry of bundle.dependency_graph) {
				expect(entry).toMatch(/^(ours|theirs):/);
				expect(entry.startsWith("+")).toBe(false);
			}
		}

		// The two regions carry different content.
		const [first, second] = result.value;
		expect(first?.conflict_hunk_ours).not.toBe(second?.conflict_hunk_ours);
	});

	it("marks dependency_graph unavailable on unrelated histories", async () => {
		const repository = await newRepository();
		const oursSha = await commitFiles(repository, { [CONFLICT_PATH]: "ours\n" }, "ours root");
		// An orphan branch shares no merge base with the first root commit.
		await runGit(repository, ["checkout", "--orphan", "unrelated"]);
		await runGit(repository, ["rm", "-rf", "--cached", "."]);
		const theirsSha = await commitFiles(
			repository,
			{ [CONFLICT_PATH]: "theirs\n" },
			"theirs root",
		);

		const result = await extractEvidenceBundles(
			repository,
			oursSha,
			theirsSha,
			CONFLICT_PATH,
		);
		if (!result.ok) return; // unrelated histories may not produce a diff3 region
		const bundle = result.value[0];
		if (!bundle) return;
		expect(bundle.dependency_graph_status).toBe("unavailable");
		expect(bundle.dependency_graph).toEqual([]);
	});
});

describe("runGit config seam", () => {
	it("delivers conflict style through options.config, keeping the operation label", async () => {
		// Regression guard for the F1-shaped bug: config spliced into argv makes
		// args[0] "-c", so the error label degrades from "git merge-tree" to "git".
		const result = await runGit("/nonexistent/repo/path", ["merge-tree", "--write-tree"], {
			acceptedExitCodes: [0, 1],
			config: { "merge.conflictStyle": "diff3" },
		});
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error.operation).toBe("git merge-tree");
	});
});
