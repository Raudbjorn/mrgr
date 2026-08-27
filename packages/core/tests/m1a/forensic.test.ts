import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { extractEvidenceBundle } from "../../src/m1a/forensic-core.js";
import { EvidenceBundleSchema } from "../../src/m1a/evidence.js";
import { createRepository, commitFiles } from "../evaluation/git-fixture.js";
import { runGit } from "../../src/evaluation/git.js";

// Carried from the semantic-merge research tree, where `strict` typecheck was
// never green. `runGit` returns a Result<T>; the original test read `.value`
// without narrowing on `.ok`, which does not compile. This narrows explicitly
// and fails loudly rather than silently reading undefined.
function gitOk<T>(result: { ok: true; value: T } | { ok: false; error: unknown }): T {
	if (!result.ok) {
		throw new Error(`git failed: ${JSON.stringify(result.error)}`);
	}
	return result.value;
}


let JQ_REPO: string;
const JQ_THEIRS = "37cfc912c1f384d177162f8aa706452754d2c6ab";
const CONFLICT_PATH = "conflict.txt";

beforeAll(async () => {
	JQ_REPO = await createRepository();
});

afterAll(async () => {
	await rm(JQ_REPO, { recursive: true, force: true });
});

describe("EvidenceBundleSchema", () => {
	it("accepts the canonical shape", () => {
		const parsed = EvidenceBundleSchema.safeParse({
			conflict_hunk_ours: "FOO=bar",
			conflict_hunk_base: "FOO=baz",
			conflict_hunk_theirs: "FOO=qux",
			preimage_ours: null,
			preimage_theirs: null,
			dependency_graph: ["ours:Makefile.am", "theirs:Makefile.am"],
		});
		expect(parsed.success).toBe(true);
	});
});

describe("ForensicCore.extractEvidenceBundle", () => {
	it("propagates the underlying runGit error kind/details when the repo path is missing; inner_operation is preserved in details", async () => {
		const result = await extractEvidenceBundle(
			"/nonexistent/repo/path",
			"0123456789abcdef0123456789abcdef01234567",
			"89abcdef0123456789abcdef0123456789abcdef",
			"Makefile.am",
		);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.kind).toBe("config");
			expect(result.error.details).toMatchObject({
				code: "ENOENT",
				inner_operation: expect.stringContaining("fetchPreimage"),
			});
		}
	});

	it("returns a not-found error when the parent SHA is missing in a real repo", async () => {
		const result = await extractEvidenceBundle(
			JQ_REPO,
			"0000000000000000000000000000000000000000",
			JQ_THEIRS,
			CONFLICT_PATH,
		);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error.kind).toBe("not-found");
			expect(result.error.details).toMatchObject({
				parent: "0000000000000000000000000000000000000000",
				path: CONFLICT_PATH,
				inner_operation: expect.stringContaining("fetchPreimage"),
			});
		}
	});

	it("extracts a bundle from a synthetic conflict triple where preimage is a file, not a relabeled hunk", async () => {
		const tmpDir = await mkdtemp(join(tmpdir(), "forensic-test-"));
		try {
			const repo = await createRepository();
			
			// Setup initial state
			await commitFiles(repo, { [CONFLICT_PATH]: "base\n", "other.txt": "base\n" }, "base");
			const baseSha = gitOk(await runGit(repo, ["rev-parse", "HEAD"])).stdoutText().trim();
			
			// Side 1 (ours)
			await runGit(repo, ["checkout", "-b", "ours"]);
			await commitFiles(repo, { [CONFLICT_PATH]: "ours\n", "other.txt": "ours\n" }, "ours");
			const oursSha = gitOk(await runGit(repo, ["rev-parse", "HEAD"])).stdoutText().trim();
			
			// Side 2 (theirs)
			await runGit(repo, ["checkout", baseSha, "-b", "theirs"]);
			await commitFiles(repo, { [CONFLICT_PATH]: "theirs\n", "other.txt": "theirs\n" }, "theirs");
			const theirsSha = gitOk(await runGit(repo, ["rev-parse", "HEAD"])).stdoutText().trim();

			const result = await extractEvidenceBundle(repo, oursSha, theirsSha, CONFLICT_PATH);
			
			expect(result.ok, JSON.stringify(result.ok ? "" : result.error)).toBe(true);
			if (!result.ok) return;
			
			const bundle = result.value;
			
			// Schema integrity
			const reparsed = EvidenceBundleSchema.safeParse(bundle);
			expect(reparsed.success).toBe(true);
			
			// Check Preimage
			expect(bundle.preimage_ours).not.toBeNull();
			expect(bundle.preimage_theirs).not.toBeNull();
			
			// Dependency graph
			expect(bundle.dependency_graph.length).toBeGreaterThan(0);

		} finally {
			await rm(tmpDir, { recursive: true, force: true });
		}
	}, 30000);
});
