// evidence/h0/_corpus_regen.ts — regenerate triples-{jq,cli}-diff3.jsonl with
// real preimage content and dependency_graph populated.
//
// PR-C of the H0 redesign chain (PR-A: D1+D2; PR-B1: D3 infra; PR-B2:
// D3 runner + D4 + D5; PR-C: this script). This script populates the
// preimage_ours/preimage_theirs/preimage_base and dependency_graph fields
// that the redesigned runner (PR-A's D2 path) and aggregator (PR-B2's
// dependency_graph typing) require.
//
// Workflow:
// 1. Read the existing triples-*.jsonl (which has merge_sha + baseline_id
//    but no preimages).
// 2. For each triple, look up both parent SHAs via `git log -1 --format=%P
//    <merge_sha>` in the appropriate checkout, then `git show
//    <parent>:<path>` to fetch the actual preimage bytes.
// 3. Write the new triples-*.jsonl as JSONL with the new fields populated.
// 4. Print a digest of new fields so the user can verify.
//
// Both preimages may be null (path absent on that parent — add/add or
// delete/modify conflicts are evidence, not errors per ADR 03).
// If `git show` fails with a Git error (path absent or revision missing),
// the preimage is null and a diagnostic is recorded but the triple is
// still written.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";

interface RawTriple {
	triple_key: string;
	repository_id: string;
	merge_sha: string;
	baseline_id: string;
	path: string;
	ordinal: number;
	category: string;
	base: string;
	ours: string;
	theirs: string;
	resolution: string;
	base_reachability: { base_sha: string; ours_exclusive_commits: number; theirs_exclusive_commits: number };
	baseline: string; // populated from baseline_id if missing
	resolution_digest: string;
}

interface OutTriple extends RawTriple {
	parents: [string, string]; // [ours_parent_sha, theirs_parent_sha]
	// preimage_base: dropped to keep triples-*.jsonl under 100 MB. The runner
	// only consumes preimage_ours / preimage_theirs; the `base` field in the
	// raw triple carries the original hunk-side base content for the grader.
	preimage_ours: string | null;
	preimage_ours_bytes: number | null;
	preimage_ours_truncated: boolean;
	preimage_theirs: string | null;
	preimage_theirs_bytes: number | null;
	preimage_theirs_truncated: boolean;
	dependency_graph: string[];
	dependency_graph_status: "derived" | "unavailable";
}

const REPO_PATHS: Record<string, string> = {
	"stedolan/jq": "/home/svnbjrn/rsrch/semantic-merge/local/jq",
	"cli/cli": "/home/svnbjrn/rsrch/semantic-merge/local/cli-cli",
	"redis/redis": "/home/svnbjrn/rsrch/semantic-merge/local/redis",
};

const TRIPLE_FILES: { src: string; dst: string }[] = [
	{ src: "evidence/h0/triples-jq-diff3.jsonl", dst: "evidence/h0/triples-jq-diff3.jsonl" },
	{ src: "evidence/h0/triples-cli-diff3.jsonl", dst: "evidence/h0/triples-cli-diff3.jsonl" },
	{ src: "evidence/h0/triples-redis-diff3.jsonl", dst: "evidence/h0/triples-redis-diff3.jsonl" },
];

// CAP_BYTES: 1 MiB. Beyond this, the preimage is truncated and the
// original-size byte count is recorded in preimage_*_bytes. Mirrors
// forensic-core's CAP_BYTES contract (ADR 03 + corpus review P0.3).
const CAP_BYTES = 1_048_576;

// Use execFileSync with an arg array — no shell, no injection surface.
const runGit = (cwd: string, args: readonly string[]): string => {
	try {
		return execFileSync("git", args, { cwd, encoding: "utf8", maxBuffer: CAP_BYTES * 2 });
	} catch (err) {
		return `__error__:${(err as Error).message.split("\n")[0]}`;
	}
};

const listParents = (cwd: string, mergeSha: string): [string, string] | null => {
	const out = runGit(cwd, ["log", "-1", "--format=%P", mergeSha]).trim();
	if (out === "" || out.startsWith("__error__")) return null;
	const parts = out.split(/\s+/);
	if (parts.length !== 2) return null;
	return [parts[0]!, parts[1]!];
};

const fetchBlob = (cwd: string, parent: string, path: string): { content: string | null; bytes: number | null; truncated: boolean; reason: string } => {
	// git show <parent>:<path> returns raw bytes on stdout. Pipe through
	// `git cat-file -s` for the original size (more reliable than
	// Buffer.byteLength on the truncated slice).
	const showOut = runGit(cwd, ["show", `${parent}:${path}`]);
	if (showOut.startsWith("__error__")) {
		return { content: null, bytes: null, truncated: false, reason: showOut };
	}
	const sizeOut = runGit(cwd, ["cat-file", "-s", `${parent}:${path}`]).trim();
	const bytes = Number(sizeOut);
	const originalBytes = Number.isFinite(bytes) ? bytes : Buffer.byteLength(showOut, "utf8");
	if (originalBytes <= CAP_BYTES) {
		return { content: showOut, bytes: originalBytes, truncated: false, reason: "" };
	}
	// Truncate. Buffer.byteLength counts UTF-8 bytes; cap at CAP_BYTES bytes.
	const buf = Buffer.from(showOut, "utf8");
	const truncatedBuf = buf.subarray(0, CAP_BYTES);
	return {
		content: truncatedBuf.toString("utf8"),
		bytes: originalBytes,
		truncated: true,
		reason: `truncated at ${CAP_BYTES} bytes (original ${originalBytes})`,
	};
};

const listDependencyGraph = (cwd: string, mergeSha: string, path: string, baseSha: string | undefined): { entries: string[]; status: "derived" | "unavailable" } => {
	// Use the explicit merge-base SHA from the triple's base_reachability
	// (per corpus schema). If absent (unrelated histories), graph is
	// unavailable per ADR 03.
	if (!baseSha || baseSha === "") return { entries: [], status: "unavailable" };
	const parents = listParents(cwd, mergeSha);
	if (!parents) return { entries: [], status: "unavailable" };
	const entries = new Set<string>();
	for (const side of ["ours", "theirs"] as const) {
		const parent = parents[side === "ours" ? 0 : 1];
		const logOut = runGit(cwd, ["log", "--name-only", "--format=", `${baseSha}..${parent}`]);
		if (logOut.startsWith("__error__")) continue;
		for (const line of logOut.split("\n")) {
			const p = line.trim();
			if (p === "" || p === path) continue;
			entries.add(`${side}:${p}`);
		}
	}
	return { entries: Array.from(entries).sort(), status: "derived" };
};

const regenOne = (src: string): OutTriple[] => {
	const lines = readFileSync(src, "utf8").trim().split("\n");
	const triples: RawTriple[] = lines.map(l => JSON.parse(l));
	if (triples.length === 0) return [];

	// Resolve repo cwd from the first triple's repository_id.
	const repoId = typeof triples[0]!.repository_id === "string"
		? triples[0]!.repository_id
		: "";
	const cwd = REPO_PATHS[repoId] ?? "";
	if (cwd === "" || !existsSync(cwd)) {
		throw new Error(`cwd not found for repo_id=${repoId} in ${src}`);
	}

	const out: OutTriple[] = [];
	let countOurs = 0, countTheirs = 0;
	let truncatedOurs = 0, truncatedTheirs = 0;
	let countDeleteModify = 0; // at least one side null

	for (const t of triples) {
		const parents = listParents(cwd, t.merge_sha);
		if (!parents) {
			throw new Error(`could not resolve parents for merge ${t.merge_sha} in ${src}`);
		}
		const [oursParent, theirsParent] = parents;

		const baseSha = t.base_reachability?.base_sha;
		const oursBlob = fetchBlob(cwd, oursParent, t.path);
		const theirsBlob = fetchBlob(cwd, theirsParent, t.path);

		const depGraph = listDependencyGraph(cwd, t.merge_sha, t.path, t.base_reachability?.base_sha);

		out.push({
			...t,
			parents: [oursParent, theirsParent],
			preimage_ours: oursBlob.content,
			preimage_ours_bytes: oursBlob.bytes,
			preimage_ours_truncated: oursBlob.truncated,
			preimage_theirs: theirsBlob.content,
			preimage_theirs_bytes: theirsBlob.bytes,
			preimage_theirs_truncated: theirsBlob.truncated,
			dependency_graph: depGraph.entries,
			dependency_graph_status: depGraph.status,
		});

		if (oursBlob.content !== null) countOurs += 1; else countDeleteModify += 1;
		if (theirsBlob.content !== null) countTheirs += 1; else countDeleteModify += 1;
		if (oursBlob.truncated) truncatedOurs += 1;
		if (theirsBlob.truncated) truncatedTheirs += 1;
	}

	console.log(`  ${src}: ${triples.length} triples, ours=${countOurs} theirs=${countTheirs}`);
	console.log(`    null-on-at-least-one-side (add/add or delete/modify): ${countDeleteModify}`);
	console.log(`    truncated: ours=${truncatedOurs} theirs=${truncatedTheirs}`);
	return out;
};

const main = (): void => {
	const startMs = Date.now();
	let total = 0;
	for (const { src, dst } of TRIPLE_FILES) {
		const out = regenOne(src);
		writeFileSync(dst, out.map(t => JSON.stringify(t)).join("\n") + "\n");
		total += out.length;
	}
	const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
	console.log(`\nwrote ${total} triples in ${elapsed}s`);
};

main();
