import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { buildSyntheticTopology, findDeletedMonolithCandidates } from "./resurrection-audit.js";

const TOPOLOGY_PATH = fileURLToPath(
	new URL("./fixtures/resurrection-topology/topology.json", import.meta.url),
);
const TEST_MONOLITH_PATTERN = /\.test\.ts$/;

describe("resurrection proof — public gate (synthetic topology)", () => {
	test("reconstruction-based audit finds candidates that exist only in inputs, never in any final ref", async () => {
		const topology = JSON.parse(readFileSync(TOPOLOGY_PATH, "utf8"));
		const { repositoryPath, inputRefs, finalRefs } = await buildSyntheticTopology(topology);

		const candidates = findDeletedMonolithCandidates(
			repositoryPath,
			inputRefs,
			finalRefs,
			TEST_MONOLITH_PATTERN,
		);

		expect(candidates.map((c) => c.path).sort()).toEqual(["src/a.test.ts", "src/b.test.ts"]);
	});

	test("a global-flagged pattern still finds every matching candidate, not just the first", async () => {
		const topology = JSON.parse(readFileSync(TOPOLOGY_PATH, "utf8"));
		const { repositoryPath, inputRefs, finalRefs } = await buildSyntheticTopology(topology);

		// RegExp.test with a /g flag advances lastIndex on match and carries it
		// between calls on the same instance — a second path can then be
		// incorrectly skipped if the pattern isn't reset before each test.
		const globalPattern = /\.test\.ts$/g;
		const candidates = findDeletedMonolithCandidates(repositoryPath, inputRefs, finalRefs, globalPattern);

		expect(candidates.map((c) => c.path).sort()).toEqual(["src/a.test.ts", "src/b.test.ts"]);
	});

	test("a file present in both an input and a final ref is never flagged as deleted", async () => {
		const topology = JSON.parse(readFileSync(TOPOLOGY_PATH, "utf8"));
		const { repositoryPath, inputRefs, finalRefs } = await buildSyntheticTopology(topology);

		const candidates = findDeletedMonolithCandidates(repositoryPath, inputRefs, finalRefs, /.*/);

		expect(candidates.map((c) => c.path)).not.toContain("src/keep.ts");
		expect(candidates.map((c) => c.path)).not.toContain("shared.txt");
	});

	test("STOP rule: an audit that only looks at final refs finds zero candidates — the vacuous-pass failure mode", async () => {
		const topology = JSON.parse(readFileSync(TOPOLOGY_PATH, "utf8"));
		const { repositoryPath, finalRefs } = await buildSyntheticTopology(topology);

		// Finals-only audit: treat the final refs as if they were also the
		// "reconstructed inputs" — no privileged prior state, so nothing looks deleted.
		const candidates = findDeletedMonolithCandidates(
			repositoryPath,
			finalRefs,
			finalRefs,
			TEST_MONOLITH_PATTERN,
		);

		expect(candidates).toEqual([]);
	});
});

// The join tree is the already-reconstructed artifact — produced from the
// five pinned inputs (ov2-base/base4-p/fork4-p/base6-p/fork6-p) by the
// underlying round4/round5 research, not something this audit re-derives.
// A naive union of the five raw commits' own trees was tried and rejected:
// it produces 164 candidates, because two independent forks simply differ
// in many files unrelated to any deletion event. The join tree is the
// specific reconstruction that isolates the real monoliths; the audit's
// job is comparing that reconstruction against final refs, not reinventing
// how it was built.
const JOIN_TREE = "2e393f450d33c7d186b87c9d748a83760f49d6fc";
const PRIVATE_REF_PREFIX = "refs/mrgr-imports/resurrection/";
const PRIVATE_FINAL_REFS = [
	"r4-n1-final",
	"r4-n2-final",
	"r4-n3-final",
	"r4-s1-final",
	"r4-s2-final",
	"r4-s3-final",
].map((name) => PRIVATE_REF_PREFIX + name);

// A ref can resolve (git rev-parse succeeds) while still being unusable here:
// this repo's join-tree import was partial at one point, with the root
// object present but most child subtrees missing. Probe the actual
// recursive traversal the audit performs, not just root existence, so an
// incomplete import fails closed into a skip rather than a mid-test crash.
function treeCanBeListed(cwd: string, ref: string): boolean {
	try {
		execFileSync("git", ["ls-tree", "-r", "--long", ref], { cwd, stdio: "ignore" });
		return true;
	} catch {
		return false;
	}
}

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const privateDataAvailable = [JOIN_TREE, ...PRIVATE_FINAL_REFS].every((ref) =>
	treeCanBeListed(repoRoot, ref),
);

describe.skipIf(!privateDataAvailable)(
	"resurrection proof — private gate (real reconstructed inputs, local-only)",
	() => {
		test("reconstruction-based audit finds exactly the four deleted test monoliths, 949,331 bytes total", () => {
			const candidates = findDeletedMonolithCandidates(
				repoRoot,
				[JOIN_TREE],
				PRIVATE_FINAL_REFS,
				TEST_MONOLITH_PATTERN,
			);

			expect(candidates).toHaveLength(4);
			expect(candidates.reduce((sum, c) => sum + c.size, 0)).toBe(949_331);
		});

		test("post-edit audit (final refs only) finds zero candidates — all four are absent from every final ref", () => {
			const candidates = findDeletedMonolithCandidates(
				repoRoot,
				PRIVATE_FINAL_REFS,
				PRIVATE_FINAL_REFS,
				TEST_MONOLITH_PATTERN,
			);

			expect(candidates).toEqual([]);
		});
	},
);
