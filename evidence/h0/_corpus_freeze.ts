// scripts/h0-freeze-corpus.ts — freeze evidence/h0/corpus.json
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";

// Materialized triples are snake_case JSONL records per docs/INDEX.md "Materialized evaluator records" table.
// Field names are the source of truth (verified via `head -1 ... | python3 -m json.tool`).
// Do not re-add a typed interface here without re-inspecting the JSON shape.

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

const lines = (path: string): Record<string, unknown>[] =>
	readFileSync(path, "utf8").trim().split("\n").map((l) => JSON.parse(l));

const jqTriples = lines("evidence/h0/triples-jq-diff3.jsonl");
const cliTriples = lines("evidence/h0/triples-cli-diff3.jsonl");

const tripleKey = (t: Record<string, unknown>): string =>
	typeof t.triple_key === "string" ? t.triple_key : "";
const pathOf = (t: Record<string, unknown>): string =>
	typeof t.path === "string" ? t.path : "";

const summarize = (repo_id: string, repo_path: string, license: string, triples: Record<string, unknown>[]) => {
	const paths = Array.from(new Set(triples.map(pathOf))).sort();
	return {
		repo_id,
		repo_path,
		license,
		triples_total: triples.length,
		exact_count: triples.length, // materialize emits exact regions only
		ambiguous_count: 0,
		path_set_digest: sha256(paths.join("\n")),
		path_set: paths,
		triple_keys: triples.map(tripleKey).sort(),
	};
};

const corpus = {
	frozen_at: new Date().toISOString(),
	f1_fix: "git -c merge.conflictStyle=diff3 merge-tree --write-tree",
	git_version: execSync("git --version", { encoding: "utf8" }).trim(),
	repos: [
		summarize("stedolan/jq", "/home/svnbjrn/rsrch/semantic-merge/local/jq", "MIT", jqTriples),
		summarize("cli/cli", "/home/svnbjrn/rsrch/semantic-merge/local/cli-cli", "MIT", cliTriples),
	],
	triples_total: jqTriples.length + cliTriples.length,
	languages: ["C", "Go"],
};

writeFileSync("evidence/h0/corpus.json", JSON.stringify(corpus, null, 2));

// Stable subset hash for byte-identical re-derive check (excludes frozen_at).
const stableSubset = {
	f1_fix: corpus.f1_fix,
	git_version: corpus.git_version,
	repos: corpus.repos,
	triples_total: corpus.triples_total,
	languages: corpus.languages,
};
const stableHash = sha256(JSON.stringify(stableSubset));

console.log(`frozen: jq=${jqTriples.length} cli=${cliTriples.length} total=${corpus.triples_total}`);
console.log(`jq exact_count: ${corpus.repos[0].exact_count}`);
console.log(`cli exact_count: ${corpus.repos[1].exact_count}`);
console.log(`jq sample triple_key: ${tripleKey(jqTriples[0] as Record<string, unknown>)}`);
console.log(`jq path_set_digest: ${corpus.repos[0].path_set_digest}`);
console.log(`cli path_set_digest: ${corpus.repos[1].path_set_digest}`);
console.log(`stable-subset sha256: ${stableHash}`);
