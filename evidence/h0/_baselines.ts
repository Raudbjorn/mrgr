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
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
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
];

const OUT_PATH = "evidence/h0/baselines.json";

const loadTriples = (paths: string[]): Triple[] =>
	paths.flatMap(p =>
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
};

main();
