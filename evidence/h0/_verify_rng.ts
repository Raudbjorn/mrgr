// evidence/h0/_verify_rng.ts — regression check for the mulberry32 arity bug.
//
// _h0_runner.ts:249-250 used to call Math.imul(x) with one argument; a
// missing second argument coerces to 0, so Math.imul(x) === x * 0 === 0
// always, regardless of seed. That made subsample()'s Fisher-Yates collapse
// into a one-position rotation independent of H0_SEED (every seed produced
// the same 30-jq/0-cli sample). The discriminating property is therefore
// SEED-DEPENDENCE, not just "returns a non-zero number" — a broken RNG that
// returns a nonzero constant would still fail the real test.
//
// This is a standalone script (run via `tsx evidence/h0/_verify_rng.ts`), not
// wired into vitest — evidence/h0 has no test runner and adding one for two
// functions isn't worth the scope. It re-implements mulberry32/subsample
// rather than importing _h0_runner.ts, because that module throws at import
// time unless H0_SUBSAMPLE/H0_REPEATS/H0_SEED are set.
import { readFileSync, readdirSync } from "node:fs";

const mulberry32 = (a: number): (() => number) => {
	return () => {
		a |= 0; a = (a + 0x6D2B79F5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) | 0;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
};

const subsample = <T>(items: T[], n: number, seed: number): T[] => {
	if (items.length <= n) return items.slice();
	const rng = mulberry32(seed);
	const a = items.slice();
	for (let i = a.length - 1; i > 0; i -= 1) {
		const j = Math.floor(rng() * (i + 1));
		const tmp = a[i] as T;
		a[i] = a[j] as T;
		a[j] = tmp;
	}
	return a.slice(0, n);
};

const hashString = (s: string): number => {
	let h = 0x811c9dc5;
	for (let i = 0; i < s.length; i += 1) {
		h ^= s.charCodeAt(i);
		h = Math.imul(h, 0x01000193);
	}
	return h >>> 0;
};

const stratifiedSample = <T extends { repository_id: string }>(items: T[], n: number, seed: number): T[] => {
	const byRepo = new Map<string, T[]>();
	for (const t of items) {
		const arr = byRepo.get(t.repository_id);
		if (arr) arr.push(t); else byRepo.set(t.repository_id, [t]);
	}
	const repos = Array.from(byRepo.keys()).sort();
	if (repos.length === 0) return [];
	const baseQuota = Math.floor(n / repos.length);
	let remainder = n - baseQuota * repos.length;
	const quota = new Map<string, number>(repos.map((r) => [r, baseQuota]));
	const byPoolSizeDesc = [...repos].sort((a, b) => {
		const diff = (byRepo.get(b)?.length ?? 0) - (byRepo.get(a)?.length ?? 0);
		return diff !== 0 ? diff : a.localeCompare(b);
	});
	for (let i = 0; i < remainder; i += 1) {
		const r = byPoolSizeDesc[i % byPoolSizeDesc.length]!;
		quota.set(r, (quota.get(r) ?? 0) + 1);
	}
	const out: T[] = [];
	for (const r of repos) {
		const pool = byRepo.get(r) ?? [];
		const q = quota.get(r) ?? 0;
		const subSeed = (seed + hashString(r)) | 0;
		out.push(...subsample(pool, q, subSeed));
	}
	return out;
};

let failures = 0;
const check = (label: string, cond: boolean): void => {
	if (cond) {
		console.log(`  PASS: ${label}`);
	} else {
		console.error(`  FAIL: ${label}`);
		failures += 1;
	}
};

console.log("[1] mulberry32 output is not a fixed constant");
{
	const rng = mulberry32(12648430);
	const values = Array.from({ length: 10 }, () => rng());
	check("all values in [0, 1)", values.every((v) => v >= 0 && v < 1));
	check("at least 2 distinct values across 10 draws", new Set(values).size >= 2);
	check("not stuck at 0", values.some((v) => v !== 0));
}

console.log("[2] subsample() is seed-dependent (the actual bug signature)");
{
	const pool = Array.from({ length: 864 }, (_, i) => i);
	const n = 30;
	const bySeedA = subsample(pool, n, 12648430);
	const bySeedB = subsample(pool, n, 999);
	const unshuffledPrefix = pool.slice(0, n);
	check(
		"result for seed 12648430 differs from the unshuffled prefix (not a no-op rotation)",
		JSON.stringify(bySeedA) !== JSON.stringify(unshuffledPrefix),
	);
	check(
		"result differs between two different seeds (the bug made every seed identical)",
		JSON.stringify(bySeedA) !== JSON.stringify(bySeedB),
	);
}

console.log("[3] stratified sample against the final 3-repo corpus for H0_SEED=12648430");
{
	const SMALL_INPUT_BUDGET_CHARS = 2400;
	const isSmall = (t: { repository_id: string; merge_sha: string; path: string; triple_key: string; category: string; ours: string; theirs: string }): boolean => {
		const sample = `Repository: ${t.repository_id}\nMerge: ${t.merge_sha}\nPath: ${t.path}\nTriple: ${t.triple_key}\nCategory: ${t.category}\n\n<<CONFLICT_HUNK>>\n<<<<<<< ours\n${t.ours}=======\n${t.theirs}>>>>>>>\n<<END_HUNK>>\n`;
		return sample.length <= SMALL_INPUT_BUDGET_CHARS;
	};
	// Must match _h0_runner.ts's CORPUS_FILES order exactly.
	const CANONICAL_ORDER = ["triples-jq-diff3.jsonl", "triples-cli-diff3.jsonl", "triples-redis-diff3.jsonl"];
	const present = new Set(readdirSync("evidence/h0").filter((f) => /^triples-.+-diff3\.jsonl$/.test(f)));
	const files = CANONICAL_ORDER.filter((f) => present.has(f));
	type LiveTriple = { repository_id: string; merge_sha: string; path: string; triple_key: string; category: string; ours: string; theirs: string };
	const triples: LiveTriple[] = files.flatMap((f) =>
		readFileSync(`evidence/h0/${f}`, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l) as LiveTriple),
	);
	const eligible = triples.filter(isSmall);
	const eligibleByRepo = new Map<string, number>();
	for (const t of eligible) eligibleByRepo.set(t.repository_id, (eligibleByRepo.get(t.repository_id) ?? 0) + 1);
	const SUBSAMPLE = 30;
	const sample = stratifiedSample(eligible, SUBSAMPLE, 12648430);
	const byRepo = new Map<string, number>();
	for (const t of sample) byRepo.set(t.repository_id, (byRepo.get(t.repository_id) ?? 0) + 1);
	console.log(`  corpus files: ${files.join(", ")}`);
	console.log(`  eligible triples: ${eligible.length} (${JSON.stringify(Object.fromEntries(eligibleByRepo))})`);
	console.log(`  sample: ${sample.length}, per-repo split: ${JSON.stringify(Object.fromEntries(byRepo))}`);
	check("3 distinct repos present in the sample", byRepo.size === 3);
	check("sample size equals SUBSAMPLE", sample.length === SUBSAMPLE);
	const counts = Array.from(byRepo.values());
	check("no repo's quota differs from another's by more than 1 (even split)", Math.max(...counts) - Math.min(...counts) <= 1);
}

if (failures > 0) {
	console.error(`\n${failures} check(s) failed.`);
	process.exit(1);
}
console.log("\nall checks passed.");
