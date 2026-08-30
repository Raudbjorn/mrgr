// evidence/h0/_baselines.ts — emit trivial-baseline records (no LLM call)
//
// PR-B1 / D3 fix: every model arm must beat the trivial baselines
// (`keep_ours`, `keep_theirs`, `compose`) for the result to be honest.
// This script writes those baseline records to `evidence/h0/baselines.json`
// in the same shape as `runs/*.jsonl` so the aggregator can load them
// and report `TRIVIAL_CEILING_*` alongside the model arms.
//
// The same `isHistoricalMatch` rule the aggregator uses (in _aggregate.ts)
// is invoked here per record so the ceiling is computed consistently;
// we do NOT fork the grader.
//
// `_aggregate.ts`'s per-run gate reads `runs/baseline-{arm}-{H0_STAMP}.jsonl`
// for every arm, model and baseline alike — an "aligned" set restricted to
// the triples actually sampled for that stamp, not the full corpus. When
// `H0_STAMP` is set, this script additionally writes those three filtered
// per-stamp files (in `evidence/h0/runs/`), alongside the unfiltered
// full-corpus `baselines.json` it always writes. The sampled triple set is
// read from that stamp's `hunk-only` model-arm file, which must already
// exist — baselines run after (or alongside, once model arms are written)
// the model run for the same stamp, not before it.
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { isHistoricalMatch } from "./_aggregate.js";

const BASELINES = ["keep_ours", "keep_theirs", "compose"] as const;
type Baseline = typeof BASELINES[number];

interface Triple {
	triple_key: string;
	resolution: string;
	ours: string;
	theirs: string;
}

const CORPUS_FILES = [
	"evidence/h0/triples-jq-diff3.jsonl",
	"evidence/h0/triples-cli-diff3.jsonl",
	"evidence/h0/triples-redis-diff3.jsonl",
];

const OUT_PATH = "evidence/h0/baselines.json";

const loadTriples = (paths: string[]): Triple[] =>
	paths.filter(existsSync).flatMap(p =>
		readFileSync(p, "utf8").trim().split("\n").filter(Boolean).map(l => JSON.parse(l) as Triple)
	);


interface BaselineRecord {
	triple_id: string;
	arm: `baseline-${Baseline}`;
	model: { name: string; sha: string };
	run: number;
	input_tokens: number;
	output_tokens: number;
	decision: Baseline;
	halt_reason: null;
	reason_text: string;
	evidence_ids_quoted: string[];
	fabricated_ids: false;
	duration_ms: number;
	schema_valid: true;
}

const mkRecord = (triple: Triple, arm: Baseline, run: number, repeats: number): BaselineRecord => ({
	triple_id: triple.triple_key,
	arm: `baseline-${arm}`,
	model: { name: "trivial-baseline", sha: "trivial-baseline-v1" },
	run,
	input_tokens: 0,
	output_tokens: 0,
	decision: arm,
	halt_reason: null,
	reason_text: `trivial baseline: always emit "${arm}"; isHistoricalMatch=${isHistoricalMatch(arm, triple.resolution, triple.ours, triple.theirs)}`,
	evidence_ids_quoted: [],
	fabricated_ids: false,
	duration_ms: 0,
	schema_valid: true,
});

const main = (): void => {
	const repeatsEnv = process.env.H0_REPEATS;
	if (repeatsEnv === undefined) {
		throw new Error("H0_REPEATS must be set (PR-A: hardcoded defaults removed; required for PR-B1 trivial-baseline enumeration)");
	}
	const repeats = Number(repeatsEnv);
	if (!Number.isFinite(repeats) || repeats <= 0 || !Number.isInteger(repeats)) {
		throw new Error(`H0_REPEATS must be a positive integer, got ${repeatsEnv}`);
	}

	mkdirSync("evidence/h0", { recursive: true });

	const triples = loadTriples(CORPUS_FILES);
	console.log(`loaded ${triples.length} triples from ${CORPUS_FILES.length} files`);

	const lines: string[] = [];
	let count = 0;
	for (const t of triples) {
		for (const a of BASELINES) {
			for (let r = 1; r <= repeats; r += 1) {
				lines.push(JSON.stringify(mkRecord(t, a, r, repeats)));
				count += 1;
			}
		}
	}
	writeFileSync(OUT_PATH, lines.join("\n") + "\n");
	console.log(`wrote ${count} baseline records to ${OUT_PATH}`);
	console.log(`  per arm: ${count / BASELINES.length / repeats} triples × ${repeats} repeats`);
	console.log(`  arms: ${BASELINES.join(", ")}`);

	const stamp = process.env.H0_STAMP;
	if (stamp === undefined) {
		console.log("H0_STAMP not set — skipping per-stamp aligned baseline files (see runs/README.md)");
		return;
	}
	const runsDir = "evidence/h0/runs";
	const modelArmFile = `${runsDir}/hunk-only-${stamp}.jsonl`;
	if (!existsSync(modelArmFile)) {
		throw new Error(
			`H0_STAMP=${stamp} set but ${modelArmFile} does not exist — run the model arms for ` +
			`this stamp first, or unset H0_STAMP to write only the full-corpus baselines.json`,
		);
	}
	const sampledTripleIds = new Set(
		readFileSync(modelArmFile, "utf8")
			.trim()
			.split("\n")
			.filter(Boolean)
			.map((l) => (JSON.parse(l) as { triple_id: string }).triple_id),
	);
	for (const a of BASELINES) {
		const arm = `baseline-${a}` as const;
		const alignedLines: string[] = [];
		for (const t of triples) {
			if (!sampledTripleIds.has(t.triple_key)) continue;
			for (let r = 1; r <= repeats; r += 1) {
				alignedLines.push(JSON.stringify(mkRecord(t, a, r, repeats)));
			}
		}
		const outPath = `${runsDir}/${arm}-${stamp}.jsonl`;
		writeFileSync(outPath, alignedLines.join("\n") + "\n");
		console.log(`wrote ${alignedLines.length} aligned records to ${outPath}`);
	}
};

main();
