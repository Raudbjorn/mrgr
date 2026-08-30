// evidence/h0/_aggregate.ts — derive aggregate.json from runs/*.jsonl
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ARMS = [
	"hunk-only",
	"selected",
	"full-bundle",
	"baseline-keep_ours",
	"baseline-keep_theirs",
	"baseline-compose",
] as const;
type Arm = typeof ARMS[number];
const STAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z$/;

interface H0Record {
	triple_id: string;
	arm: Arm;
	model: { name: string; sha: string };
	run: number;
	input_tokens: number;
	output_tokens: number;
	decision: "keep_ours" | "keep_theirs" | "compose" | "halt";
	halt_reason: string | null;
	reason_text: string;
	evidence_ids_quoted: string[];
	// Populated by the runner for LLM-arm records (the id(s) actually shown
	// in that record's prompt). Absent/empty on baseline records, which never
	// cite anything — safe, since `.every()` on an empty evidence_ids_quoted
	// short-circuits true without reading this field.
	evidence_ids_exposed?: string[];
	has_source_tags: boolean;
	duration_ms: number;
	schema_valid: boolean;
}

interface Triple {
	triple_key: string;
	resolution: string;
	ours: string;
	theirs: string;
}

interface ArmAggregate {
	triples_total: number;
	triples_with_dev_resolution: number;
	correct: number;
	wrong: number;
	halt: number;
	schema_invalid: number;
	fabricated_evidence_ids: number;
	emitted_source_tags: number;
	tokens_input: number;
	tokens_output: number;
	tokens_total: number;
	triples_3of3_agree: number;
	triples_2of3_agree: number;
	triples_1of3_agree: number;
}

const loadRecords = (path: string): H0Record[] =>
	readFileSync(path, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));

const sameRecordKeys = (records: H0Record[], expected: Set<string>): boolean => {
	const actual = new Set(records.map((record) => `${record.triple_id}|${record.run}`));
	return records.length === expected.size &&
		actual.size === expected.size &&
		[...expected].every((key) => actual.has(key));
};

const loadResolutionByKey = (paths: string[]): Map<string, string> => {
	const m = new Map<string, string>();
	for (const p of paths) {
		const text = readFileSync(p, "utf8").trim();
		if (text === "") continue;
		for (const line of text.split("\n")) {
			const t = JSON.parse(line) as Triple;
			m.set(t.triple_key, t.resolution);
		}
	}
	return m;
};

export const isHistoricalMatch = (decision: H0Record["decision"], resolution: string, ours: string, theirs: string): boolean => {
	const norm = (s: string) => s.replace(/\s+/g, "").trim();
	const r = norm(resolution);
	const o = norm(ours);
	const t = norm(theirs);
	if (decision === "keep_ours") return r === o;
	if (decision === "keep_theirs") return r === t;
	if (decision === "compose") {
		if (r === o || r === t) return true;
		const overlap = (a: string, b: string) => {
			const set = new Set<string>();
			for (const line of a.split("\n")) if (line.length > 3) set.add(line);
			let hits = 0;
			for (const line of b.split("\n")) if (set.has(line)) hits += 1;
			return hits;
		};
		return overlap(r, o) >= 1 && overlap(r, t) >= 1;
	}
	return false;
};

const aggregate = (records: H0Record[], resolutions: Map<string, string>, triples: Map<string, Triple>): ArmAggregate => {
	const triples_total = new Set(records.map((r) => r.triple_id)).size;
	const triples_with_dev_resolution = records.filter((r) => resolutions.has(r.triple_id)).length;

	let correct = 0;
	let wrong = 0;
	let halt = 0;
	let schema_invalid = 0;
	let fabricated_evidence_ids = 0;
	let emitted_source_tags = 0;
	let tokens_input = 0;
	let tokens_output = 0;

	for (const r of records) {
		if (!r.schema_valid) {
			schema_invalid += 1;
			continue;
		}
		// PR-D / S3-narrow: fabricated means a cited [source:...] tag that is
		// NOT among the ids this specific record's prompt actually exposed
		// (evidence_ids_exposed, populated by the runner's buildMessages).
		// Narrower than "not a known triple_key anywhere in the corpus" —
		// that global check would pass a hallucinated-but-real citation of
		// some OTHER triple's key that was never shown to the model.
		const recordSourceTags = r.evidence_ids_quoted.length;
		const tags = r.evidence_ids_quoted;
		const exposedIds = new Set(r.evidence_ids_exposed ?? []);
		const hasFabricated = tags.some(t => !exposedIds.has(t));
		if (hasFabricated) fabricated_evidence_ids += 1;
		emitted_source_tags += recordSourceTags;
		tokens_input += r.input_tokens;
		tokens_output += r.output_tokens;
		if (r.decision === "halt") {
			halt += 1;
			continue;
		}
		const resolution = resolutions.get(r.triple_id);
		const triple = triples.get(r.triple_id);
		if (resolution === undefined || triple === undefined) continue;
		if (isHistoricalMatch(r.decision, resolution, triple.ours, triple.theirs)) {
			correct += 1;
		} else {
			wrong += 1;
		}
	}

	const decisionPerTriple = new Map<string, Map<number, H0Record["decision"]>>();
	for (const r of records) {
		if (!decisionPerTriple.has(r.triple_id)) decisionPerTriple.set(r.triple_id, new Map());
		decisionPerTriple.get(r.triple_id)!.set(r.run, r.decision);
	}
	let triples_3of3_agree = 0;
	let triples_2of3_agree = 0;
	let triples_1of3_agree = 0;
	for (const [, runs] of decisionPerTriple) {
		const values = Array.from(runs.values());
		if (values.length < 3) continue;
		const uniq = new Set(values);
		if (uniq.size === 1) triples_3of3_agree += 1;
		else if (uniq.size === 2) triples_2of3_agree += 1;
		else triples_1of3_agree += 1;
	}

	return {
		triples_total,
		triples_with_dev_resolution,
		correct,
		wrong,
		halt,
		schema_invalid,
		fabricated_evidence_ids,
		emitted_source_tags,
		tokens_input,
		tokens_output,
		tokens_total: tokens_input + tokens_output,
		triples_3of3_agree,
		triples_2of3_agree,
		triples_1of3_agree,
	};
};

// PR-B2 / D4: McNemar paired test on two arms' per-triple correct/wrong
// vectors. McNemar χ² with continuity correction is the standard
// statistical test for paired binary outcomes (each triple is one
// paired observation across the two arms). Returns null on degenerate
// inputs (e.g. no discordant pairs) to defend against NaN.
const mcnemar = (armA: H0Record[], armB: H0Record[]): { chi2: number; p: number | null; n_discordant: number } => {
	const byKeyA = new Map<string, H0Record>();
	for (const r of armA) byKeyA.set(`${r.triple_id}|${r.run}`, r);
	let b = 0; // A wrong, B right
	let c = 0; // A right, B wrong
	for (const rB of armB) {
		const rA = byKeyA.get(`${rB.triple_id}|${rB.run}`);
		if (!rA || !rA.schema_valid || !rB.schema_valid) continue;
		// Both must have isHistoricalMatch verdicts (compute externally and pass in)
		const aCorrect = (rA as H0Record & { _correct?: boolean })._correct;
		const bCorrect = (rB as H0Record & { _correct?: boolean })._correct;
		if (aCorrect === undefined || bCorrect === undefined) continue;
		if (aCorrect !== bCorrect) {
			if (aCorrect) c += 1; else b += 1;
		}
	}
	const n = b + c;
	if (n === 0) return { chi2: 0, p: null, n_discordant: 0 };
	// χ² with continuity correction.
	const numerator = (Math.abs(b - c) - 1) ** 2;
	const chi2 = numerator / n;
	// p-value for χ² with 1 df via the standard normal survival function
	// (Wilson-Hilferty approximation is overkill here; use the exact form).
	// 1 - Φ(sqrt(chi2)) where Φ is the standard normal CDF.
	const z = Math.sqrt(chi2);
	const p = 2 * (1 - normalCdf(z));
	return { chi2, p: Number.isFinite(p) ? p : null, n_discordant: n };
};
// Standard normal CDF via the Abramowitz & Stegun approximation (7.1.26).
const normalCdf = (x: number): number => {
	const a1 = 0.254829592;
	const a2 = -0.284496736;
	const a3 = 1.421413741;
	const a4 = -1.453152027;
	const a5 = 1.061405429;
	const p = 0.3275911;
	const sign = x < 0 ? -1 : 1;
	const ax = Math.abs(x) / Math.sqrt(2);
	const t = 1.0 / (1.0 + p * ax);
	const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax);
	return 0.5 * (1.0 + sign * y);
};

// Single source of truth for the corpus's triple files — read by both the
// resolution-lookup and triple-lookup loads below, and by the triples_total
// count in aggregate_doc. A 4th corpus repo means adding one path here, not
// three separate hardcoded lists. Not every file need exist (e.g. test
// fixtures only provide a subset); missing files are skipped below.
const CORPUS_TRIPLE_FILES = [
	"evidence/h0/triples-jq-diff3.jsonl",
	"evidence/h0/triples-cli-diff3.jsonl",
	"evidence/h0/triples-redis-diff3.jsonl",
];

const wrongFraction = (arm: { correct: number; wrong: number; halt: number }): number => {
	const denominator = arm.correct + arm.wrong + arm.halt;
	return denominator === 0 ? Infinity : arm.wrong / denominator;
};

export const main = () => {
	const stamp = process.env.H0_STAMP;
	if (stamp === undefined || !STAMP_PATTERN.test(stamp)) {
		throw new Error("H0_STAMP must be set to the run timestamp");
	}
	const runsDir = "evidence/h0/runs";

	const resolutions = loadResolutionByKey(CORPUS_TRIPLE_FILES.filter(existsSync));
	const triples = new Map<string, Triple>();
	let triplesTotalLines = 0;
	for (const p of CORPUS_TRIPLE_FILES) {
		if (!existsSync(p)) continue;
		const text = readFileSync(p, "utf8").trim();
		if (text === "") continue;
		const lines = text.split("\n");
		triplesTotalLines += lines.length;
		for (const line of lines) {
			const t = JSON.parse(line) as Triple;
			triples.set(t.triple_key, t);
		}
	}

	const byArm: Record<string, ArmAggregate> = {};
	let expectedRecordKeys: Set<string> | undefined;
	let sampledTripleKeys = new Set<string>();
	for (const arm of ARMS) {
		const file = `${runsDir}/${arm}-${stamp}.jsonl`;
		const records = loadRecords(file);
		if (records.length === 0) {
			throw new Error(`${file} has no records`);
		}
		if (records.some((record) => record.arm !== arm)) {
			throw new Error(`${file} contains another arm`);
		}
		if (expectedRecordKeys === undefined) {
			const keys = new Set(
				records.map((record) => `${record.triple_id}|${record.run}`),
			);
			if (keys.size !== records.length) {
				throw new Error(`${file} has duplicate triple/run rows`);
			}
			expectedRecordKeys = keys;
			sampledTripleKeys = new Set(records.map((record) => record.triple_id));
		} else if (!sameRecordKeys(records, expectedRecordKeys)) {
			throw new Error(`${file} has a different sampled triple/run set`);
		}
		byArm[arm] = aggregate(records, resolutions, triples);
		console.log(`${arm}: ${records.length} records, ${byArm[arm].correct}c/${byArm[arm].wrong}w/${byArm[arm].halt}h tokens=${byArm[arm].tokens_total}`);
	}

	// PR-B1 / D3: derive trivial-baseline ceilings. Every model arm must
	// beat `TRIVIAL_CEILING_COMPOSE` for the result to be honest; if it does
	// not, the verdict should be `null` regardless of arm-vs-arm comparison.
	const trivialCeiling: Record<string, { correct: number; wrong: number; halt: number; triples: number }> = {};
	for (const [arm, agg] of Object.entries(byArm)) {
		if (arm.startsWith("baseline-")) {
			trivialCeiling[arm.slice("baseline-".length)] = {
				correct: agg.correct,
				wrong: agg.wrong,
				halt: agg.halt,
				triples: agg.triples_total,
			};
		}
	}
	const costAnalysis: Record<string, { cost_wrong: number | null; cost_halt: number | null; ratio: number | null }> = {};
	for (const [arm, agg] of Object.entries(byArm)) {
		const cw = agg.wrong > 0 ? agg.tokens_total / agg.wrong : null;
		const ch = agg.halt > 0 ? agg.tokens_total / agg.halt : null;
		const ratio = cw !== null && ch !== null && ch > 0 ? cw / ch : null;
		costAnalysis[arm] = { cost_wrong: cw, cost_halt: ch, ratio };
	}

	const hunkOnly = byArm["hunk-only"];
	const selected = byArm["selected"];
	const fullBundle = byArm["full-bundle"];
	// PR-B2 / D5 reachable kill: replace the broken h_w_halt_ratio (which
	// divides by 0 in every run, making the kill structurally unreachable)
	// with a denominator that always exists and a condition that always
	// evaluates. New condition: kill if (a) every model arm is within noise
	// of the hunk-only baseline AND (b) the best model wrong-fraction is
	// worse than (or equal to) the trivial compose baseline wrong-fraction.
	// The second clause is what makes the kill reachable: when trivial
	// compose outperforms the model, we know model evidence utility is
	// negative, and we kill the agent-adapter line.
	const BASELINE_MARGIN = 0.05;
	let killConditionMet = false;
	let killReason = "";
	if (hunkOnly && selected && fullBundle && trivialCeiling["compose"]) {
		const bestModelWrongFraction = Math.min(
			wrongFraction(hunkOnly),
			wrongFraction(selected),
			wrongFraction(fullBundle),
		);
		const composeWrongFraction = wrongFraction(trivialCeiling["compose"]);
		// docs/adr/03-m1a-evidence-scope.md: the aggregate is null unless the
		// best model arm beats aligned baseline-compose by >= 0.05 (absolute,
		// on the [0,1] fraction scale). That's the whole gate — it does not
		// require the model arms to also be "within noise" of hunk-only.
		// (Previously gated on `armsWithinNoise && modelLoses`, which could
		// suppress a genuine kill signal: a selected arm improving on
		// hunk-only by more than 1 wrong decision, while still missing the
		// 0.05 compose margin, would emit "positive" instead of "null".)
		const modelLoses = bestModelWrongFraction >= composeWrongFraction - BASELINE_MARGIN;
		if (modelLoses) {
			killConditionMet = true;
			killReason =
				`best model wrong fraction ${bestModelWrongFraction.toFixed(3)} does not beat ` +
				`compose baseline ${composeWrongFraction.toFixed(3)} by ${BASELINE_MARGIN.toFixed(3)}`;
		}
	}

	let verdict: "positive" | "null" | "inconclusive" | "invalid";
	let verdictReason: string;
	if (!hunkOnly || !selected || !fullBundle) {
		verdict = "inconclusive";
		verdictReason = "missing arm aggregate";
	} else if (killConditionMet) {
		verdict = "null";
		verdictReason = killReason;
	} else if (selected.wrong < hunkOnly.wrong && fullBundle.wrong >= hunkOnly.wrong) {
		verdict = "positive";
		verdictReason = "selected evidence reduces unsupported wrong decisions; full bundle is mixed or worse; selection is the product mechanism. Proceed to M1a.";
	} else if (selected.wrong < hunkOnly.wrong || fullBundle.wrong < hunkOnly.wrong) {
		verdict = "positive";
		verdictReason = `selected wrong=${selected.wrong}, full-bundle wrong=${fullBundle.wrong}, hunk-only wrong=${hunkOnly.wrong}; outside-arm evidence utility demonstrated.`;
	} else {
		verdict = "inconclusive";
		verdictReason = "neither arm reduced wrong count vs hunk-only baseline";
	}

	// Invalidation rule (see evidence/h0/INVALIDATION-RULE.md): any arm with
	// fabricated_evidence_ids > 0 invalidates the whole run, regardless of
	// what the count-based verdict above concluded. Previously enforced only
	// by a human reading this file's output and citing an uncommitted plan
	// document — now enforced here, in the code that produces the verdict.
	const invalidationReasons: string[] = [];
	for (const [arm, agg] of Object.entries(byArm)) {
		if (agg.fabricated_evidence_ids > 0) {
			invalidationReasons.push(`${arm}: fabricated_evidence_ids=${agg.fabricated_evidence_ids}`);
		}
	}
	const runValid = invalidationReasons.length === 0;
	if (!runValid) {
		verdict = "invalid";
		verdictReason = `run invalid per any-flag fabrication rule: ${invalidationReasons.join("; ")}`;
	}

	const aggregate_doc = {
		produced_at: new Date().toISOString(),
		model: "Qwen3-Coder-30B-A3B-Instruct-UD-Q3_K_XL",
		model_sha: "69cd7578d77dffc0b17e34bad9ef998d08ae0e20ccceef21bad4e7eb3d8c553b",
		git_version: "merge-tree --write-tree --messages -z (per-call -c merge.conflictStyle=diff3)",
		corpus_size: resolutions.size,
		// PR-B2 / S1: line count in triples-*.jsonl dedups to a smaller unique
		// count by triple_key (per ADR 03, triple_key is a content digest; same
		// digest across different merges collapses). Report both numbers, not
		// just one. Computed from CORPUS_TRIPLE_FILES, not hardcoded, so it
		// stays correct as corpus files are added.
		triples_total: triplesTotalLines, // line count in triples-*.jsonl
		triples_unique: resolutions.size, // distinct triple_key count
		// The loaded stamped arm files are the source of truth for the actual
		// sampled set; H0_SUBSAMPLE is only a requested upper bound.
		seed_subsample: sampledTripleKeys.size,
		repeats: Number(process.env.H0_REPEATS ?? 0),
		arms: byArm,
		cost_analysis: costAnalysis,
		trivial_ceiling: trivialCeiling,
		honest_signal: (() => {
			const compose = trivialCeiling["compose"];
			if (!compose || !hunkOnly || !selected || !fullBundle) return null;
			// Honest = at least one model arm beats the trivial compose ceiling.
			const bestModelWrong = Math.min(hunkOnly.wrong, selected.wrong, fullBundle.wrong);
			return bestModelWrong < compose.wrong;
		})(),
		kill_condition: {
			epsilon: BASELINE_MARGIN,
			met: killConditionMet,
			best_model_wrong_fraction: hunkOnly && selected && fullBundle
				? Math.min(
					wrongFraction(hunkOnly),
					wrongFraction(selected),
					wrongFraction(fullBundle),
				)
				: null,
			compose_wrong_fraction: trivialCeiling["compose"]
				? wrongFraction(trivialCeiling["compose"])
				: null,
			selected_within_noise: hunkOnly && selected ? Math.abs(selected.wrong - hunkOnly.wrong) <= 1 : null,
			full_bundle_within_noise: hunkOnly && fullBundle ? Math.abs(fullBundle.wrong - hunkOnly.wrong) <= 1 : null,
		},
		verdict,
		verdict_reason: verdictReason,
		run_valid: runValid,
		invalidation_reasons: invalidationReasons,
		predicted_outcome: "selected reduces unsupported wrong decisions; full bundle mixed or worse; selection policy is the product mechanism",
	};

	writeFileSync("evidence/h0/aggregate.json", JSON.stringify(aggregate_doc, null, 2));
	console.log(`verdict: ${verdict} — ${verdictReason}`);
	const stable = { ...aggregate_doc };
	delete (stable as Record<string, unknown>).produced_at;
	const stableHash = createHash("sha256").update(JSON.stringify(stable)).digest("hex");
	console.log(`stable_hash (re-derive): ${stableHash}`);
};

const invokedPath = process.argv[1] === undefined ? "" : resolve(process.argv[1]);
if (invokedPath === fileURLToPath(import.meta.url)) main();
