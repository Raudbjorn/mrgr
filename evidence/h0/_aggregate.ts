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
const MODEL_ARMS = ["hunk-only", "selected", "full-bundle"] as const;
const BASELINE_ARMS = ["baseline-keep_ours", "baseline-keep_theirs", "baseline-compose"] as const;
const STAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z$/;
// Declared significance level for the WP3/WP4 acceptance gate
// (redesign-requirements.md §7 #5: "Fisher exact p < 0.05").
const ALPHA = 0.05;

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
	// Emitted by the runner (PR-E) for model arms; absent on baseline records
	// written by _baselines.ts and on older fixtures.
	provider?: string;
	// SHA-256 of the JSON Schema that constrained sampling, or null/absent for
	// unconstrained. Baseline records never carry it — a constant emits no
	// tokens, so no sampler was involved.
	decision_schema_sha?: string | null;
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

// Single source of truth for "what did this one record score?". Both the
// count-based aggregate below and the paired significance tests read it, so
// the grader is never forked (the same reason _baselines.ts imports
// isHistoricalMatch rather than reimplementing it).
//   "invalid" — schema-invalid, excluded from every tally and every pairing
//   "halt"    — declined to resolve: not correct, and not wrong either
//   "ungraded" — no developer resolution on file for this triple
type Grade = "correct" | "wrong" | "halt" | "invalid" | "ungraded";

const gradeRecord = (
	r: H0Record,
	resolutions: Map<string, string>,
	triples: Map<string, Triple>,
): Grade => {
	if (!r.schema_valid) return "invalid";
	if (r.decision === "halt") return "halt";
	const resolution = resolutions.get(r.triple_id);
	const triple = triples.get(r.triple_id);
	if (resolution === undefined || triple === undefined) return "ungraded";
	return isHistoricalMatch(r.decision, resolution, triple.ours, triple.theirs) ? "correct" : "wrong";
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
		const grade = gradeRecord(r, resolutions, triples);
		if (grade === "invalid") {
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
		if (grade === "halt") {
			halt += 1;
			continue;
		}
		if (grade === "ungraded") continue;
		if (grade === "correct") correct += 1;
		else wrong += 1;
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

// ---------------------------------------------------------------------------
// Significance (WP3/WP4 acceptance gate)
//
// The previous implementation here was a McNemar χ² with continuity
// correction whose p-value came from a normal approximation, and it was
// dead code: it read a `_correct` field that nothing in this repository ever
// populated, and no call site existed. Both problems are fixed below.
//
// The χ² approximation was also the wrong tool for this data. Discordant-pair
// counts run from 1 to 14 here; the normal approximation is unreliable below
// roughly 25, so the paired test is now the EXACT two-sided binomial sign
// test on the discordant pairs (McNemar's exact test).
//
// Which test is binding: redesign-requirements.md §7 #4 requires "per-triple
// correct as a binary vector; aggregate with a paired test against the
// constant baseline", while §7 #5 names "Fisher exact". The two arms are
// evaluated on the same triples, so the observations are paired and
// McNemar-exact is the correct test; Fisher exact assumes independent
// samples and is reported alongside as an unpaired cross-check. Both are
// emitted so the reconciliation is visible in the artifact rather than
// resolved silently here.
// ---------------------------------------------------------------------------

// log(n!) for n up to LOG_FACTORIAL_MAX. The corpus is 30 triples × 3
// repeats per arm, so 4096 is far above anything reachable; exceeding it
// throws rather than silently returning NaN.
const LOG_FACTORIAL_MAX = 4096;
const LOG_FACTORIAL: number[] = [0];
for (let i = 1; i <= LOG_FACTORIAL_MAX; i += 1) {
	LOG_FACTORIAL.push(LOG_FACTORIAL[i - 1]! + Math.log(i));
}
const logFactorial = (n: number): number => {
	if (n < 0 || n > LOG_FACTORIAL_MAX) {
		throw new Error(`logFactorial out of range: ${n} (max ${LOG_FACTORIAL_MAX})`);
	}
	return LOG_FACTORIAL[n]!;
};
const logChoose = (n: number, k: number): number =>
	logFactorial(n) - logFactorial(k) - logFactorial(n - k);

// Relative tolerance when comparing log-probabilities for "at most as
// probable as the observed table". Floating-point sums make exactly-equal
// tables compare as marginally larger; without the slack the mirror-image
// table is dropped and a two-sided p comes back halved.
const LOG_P_TOLERANCE = 1e-9;

// Exact two-sided binomial test of k successes in n trials against p = 0.5 —
// i.e. McNemar's exact test when k/n are the discordant pairs. Returns null
// for n = 0 (no discordant pairs: the arms are indistinguishable and there is
// nothing to test) rather than a misleading 1.0.
export const binomialSignTestTwoSided = (k: number, n: number): number | null => {
	if (n === 0) return null;
	if (k < 0 || k > n) throw new Error(`binomialSignTestTwoSided: k=${k} outside [0, ${n}]`);
	const logHalfN = -n * Math.log(2);
	const observed = logChoose(n, k) + logHalfN;
	let p = 0;
	for (let i = 0; i <= n; i += 1) {
		const lp = logChoose(n, i) + logHalfN;
		if (lp <= observed + LOG_P_TOLERANCE) p += Math.exp(lp);
	}
	return Math.min(1, p);
};

// Fisher's exact test on a 2×2 table, two-sided by the sum of all tables at
// most as probable as the observed one. Unpaired: reported as a cross-check
// on the paired test, never as the binding gate.
export const fisherExactTwoSided = (a: number, b: number, c: number, d: number): number | null => {
	const n = a + b + c + d;
	if (n === 0) return null;
	const row1 = a + b;
	const row2 = c + d;
	const col1 = a + c;
	const logP = (x: number): number =>
		logChoose(row1, x) + logChoose(row2, col1 - x) - logChoose(n, col1);
	const observed = logP(a);
	let p = 0;
	for (let x = Math.max(0, col1 - row2); x <= Math.min(row1, col1); x += 1) {
		const lp = logP(x);
		if (lp <= observed + LOG_P_TOLERANCE) p += Math.exp(lp);
	}
	return Math.min(1, p);
};

interface PairedComparison {
	unit: "triple" | "record";
	arm: string;
	baseline: string;
	n_units: number;
	arm_correct: number;
	baseline_correct: number;
	delta_correct: number;
	arm_only: number;
	baseline_only: number;
	both: number;
	neither: number;
	n_discordant: number;
	mcnemar_exact_p: number | null;
	fisher_p: number | null;
}

// Per-record correct/not-correct, keyed `triple_id|run`. Schema-invalid
// records are absent from the map entirely, so a pairing that touches one is
// dropped from both arms rather than silently scored as not-correct.
const recordVector = (
	records: H0Record[],
	resolutions: Map<string, string>,
	triples: Map<string, Triple>,
): Map<string, boolean> => {
	const v = new Map<string, boolean>();
	for (const r of records) {
		const grade = gradeRecord(r, resolutions, triples);
		if (grade === "invalid" || grade === "ungraded") continue;
		v.set(`${r.triple_id}|${r.run}`, grade === "correct");
	}
	return v;
};

// Per-triple correct/not-correct by majority of the arm's repeats
// (redesign-requirements.md §7 #4: "report per-triple correct as a binary
// vector"). The majority is taken over the full declared repeat count, so a
// schema-invalid or halted repeat counts against the arm rather than
// shrinking the denominator — the conservative direction for an arm claiming
// to beat a baseline that never halts.
const tripleVector = (
	records: H0Record[],
	resolutions: Map<string, string>,
	triples: Map<string, Triple>,
	repeats: number,
): Map<string, boolean> => {
	const correctRuns = new Map<string, number>();
	for (const r of records) {
		if (!correctRuns.has(r.triple_id)) correctRuns.set(r.triple_id, 0);
		if (gradeRecord(r, resolutions, triples) === "correct") {
			correctRuns.set(r.triple_id, correctRuns.get(r.triple_id)! + 1);
		}
	}
	const threshold = Math.ceil(repeats / 2);
	const v = new Map<string, boolean>();
	for (const [id, n] of correctRuns) v.set(id, n >= threshold);
	return v;
};

const compareVectors = (
	unit: PairedComparison["unit"],
	arm: string,
	baseline: string,
	armVector: Map<string, boolean>,
	baselineVector: Map<string, boolean>,
): PairedComparison => {
	let armOnly = 0;
	let baselineOnly = 0;
	let both = 0;
	let neither = 0;
	for (const [key, baselineCorrect] of baselineVector) {
		const armCorrect = armVector.get(key);
		if (armCorrect === undefined) continue; // unpaired: excluded from both sides
		if (armCorrect && !baselineCorrect) armOnly += 1;
		else if (!armCorrect && baselineCorrect) baselineOnly += 1;
		else if (armCorrect && baselineCorrect) both += 1;
		else neither += 1;
	}
	const nUnits = armOnly + baselineOnly + both + neither;
	const armCorrect = armOnly + both;
	const baselineCorrect = baselineOnly + both;
	const nDiscordant = armOnly + baselineOnly;
	return {
		unit,
		arm,
		baseline,
		n_units: nUnits,
		arm_correct: armCorrect,
		baseline_correct: baselineCorrect,
		delta_correct: armCorrect - baselineCorrect,
		arm_only: armOnly,
		baseline_only: baselineOnly,
		both,
		neither,
		n_discordant: nDiscordant,
		mcnemar_exact_p: binomialSignTestTwoSided(Math.min(armOnly, baselineOnly), nDiscordant),
		fisher_p: fisherExactTwoSided(
			armCorrect,
			nUnits - armCorrect,
			baselineCorrect,
			nUnits - baselineCorrect,
		),
	};
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
	const recordsByArm: Record<string, H0Record[]> = {};
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
		recordsByArm[arm] = records;
		byArm[arm] = aggregate(records, resolutions, triples);
		console.log(`${arm}: ${records.length} records, ${byArm[arm].correct}c/${byArm[arm].wrong}w/${byArm[arm].halt}h tokens=${byArm[arm].tokens_total}`);
	}

	// Provenance is read from the model-arm records rather than hardcoded.
	// The previous hardcoded pair named a model this run never used
	// (Qwen3-Coder-30B against records that say qwen2.5-coder-7b-instruct-q6_k),
	// which made the stamped artifact non-re-derivable from committed code.
	// Baseline records are excluded: _baselines.ts stamps them
	// "trivial-baseline", which is an identity of the grader, not of a model.
	// Keyed by "name@sha" only for set-uniqueness; the pair is carried
	// structurally so nothing has to parse a delimiter back out of a model name.
	const modelIdentities = new Map<string, { name: string; sha: string }>();
	const providers = new Set<string>();
	// Absent and null both mean "unconstrained": records written before
	// 2026-08-30 omit the field, and an unconstrained run writes null.
	const decisionSchemas = new Set<string>();
	for (const arm of MODEL_ARMS) {
		for (const r of recordsByArm[arm] ?? []) {
			modelIdentities.set(`${r.model.name}@${r.model.sha}`, { name: r.model.name, sha: r.model.sha });
			if (r.provider !== undefined) providers.add(r.provider);
			decisionSchemas.add(r.decision_schema_sha ?? "unconstrained");
		}
	}
	if (modelIdentities.size !== 1) {
		throw new Error(
			`model-arm records must name exactly one model, found ${modelIdentities.size}: ` +
			`${[...modelIdentities.keys()].join(", ")}`,
		);
	}
	if (providers.size > 1) {
		throw new Error(`model-arm records must name at most one provider, found: ${[...providers].join(", ")}`);
	}
	// A grammar changes the sampling distribution, so it changes decisions and
	// not just formatting. Constrained and unconstrained records are different
	// experimental conditions; pooling them behind one verdict is the error the
	// corpus's "never pool the contaminated set" rule exists to prevent. Fail
	// loudly rather than average across two populations.
	if (decisionSchemas.size > 1) {
		throw new Error(
			`model-arm records must share one decision-schema condition, found ${decisionSchemas.size}: ` +
			`${[...decisionSchemas].join(", ")} — a grammar-constrained arm is not comparable with an unconstrained one`,
		);
	}
	const { name: modelName, sha: modelSha } = [...modelIdentities.values()][0]!;
	const decisionSchemaSha = [...decisionSchemas][0] ?? "unconstrained";
	// `repeats` sets tripleVector's majority threshold, which is the binding unit
	// for the acceptance gate, so a placeholder value silently fakes a verdict:
	// unset gives threshold 0 and every triple scores correct for every arm;
	// non-numeric gives NaN and every triple scores not-correct. Both emit
	// `significance_verdict: "null"` without measuring anything -- the exact
	// unfalsifiable-gate failure this file was rewritten to remove. Fail like
	// H0_STAMP does.
	const repeats = Number(process.env.H0_REPEATS);
	if (!Number.isInteger(repeats) || repeats < 1) {
		throw new Error(
			`H0_REPEATS must be a positive integer; the triple-level gate threshold depends on it (got ${process.env.H0_REPEATS})`,
		);
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

	// ---- Significance: every model arm against every trivial baseline ----
	const vectors: Record<string, { triple: Map<string, boolean>; record: Map<string, boolean> }> = {};
	for (const arm of ARMS) {
		const records = recordsByArm[arm] ?? [];
		vectors[arm] = {
			triple: tripleVector(records, resolutions, triples, repeats),
			record: recordVector(records, resolutions, triples),
		};
	}
	const comparisons: PairedComparison[] = [];
	for (const arm of MODEL_ARMS) {
		for (const baseline of BASELINE_ARMS) {
			if (!vectors[arm] || !vectors[baseline]) continue;
			comparisons.push(compareVectors("triple", arm, baseline, vectors[arm]!.triple, vectors[baseline]!.triple));
			comparisons.push(compareVectors("record", arm, baseline, vectors[arm]!.record, vectors[baseline]!.record));
		}
	}

	// "Best trivial baseline" (redesign-requirements.md §7 #5) at the binding
	// unit: most triples correct, ties broken by record-level correct and then
	// by arm name so the choice is deterministic across runs.
	const baselineRanking = [...BASELINE_ARMS]
		.filter((b) => vectors[b] !== undefined)
		.map((b) => ({
			arm: b,
			triple_correct: [...vectors[b]!.triple.values()].filter(Boolean).length,
			record_correct: [...vectors[b]!.record.values()].filter(Boolean).length,
		}))
		.sort((x, y) =>
			y.triple_correct - x.triple_correct ||
			y.record_correct - x.record_correct ||
			x.arm.localeCompare(y.arm));
	const bestTrivialBaseline = baselineRanking[0]?.arm ?? null;

	// The gate itself: an arm is a positive only if it is correct on MORE
	// triples than the best trivial baseline, and that margin survives the
	// paired exact test at the declared alpha.
	const gateRows = comparisons.filter(
		(c) => c.unit === "triple" && c.baseline === bestTrivialBaseline,
	);
	const passingArms = gateRows.filter(
		(c) => c.delta_correct > 0 && c.mcnemar_exact_p !== null && c.mcnemar_exact_p < ALPHA,
	);

	const hunkOnly = byArm["hunk-only"];
	const selected = byArm["selected"];
	const fullBundle = byArm["full-bundle"];
	// The kill rule, restated to match its own specification.
	//
	// It previously fired on WRONG-FRACTION, whose denominator is
	// correct + wrong + halt — so an arm lowered its wrong fraction simply by
	// halting more, and an arm that halted on everything would have scored a
	// perfect 0. That is the failure mode WP4's STOP rule names ("if forced
	// resolution dominates halt at any plausible cost ratio"), and the gate
	// as written could not detect it: on the 2026-08-30 run it read
	// full-bundle — the arm that halts 27/90 times and is significantly WORSE
	// than a constant on correctness — as the best arm and declined to kill.
	//
	// The binding rule is now the one redesign-requirements.md §7 #5 actually
	// specifies: an arm is correct on MORE triples than the best trivial
	// baseline, at exact p < ALPHA. Anything else is a null. The
	// wrong-fraction figures below are retained as reported columns, demoted
	// from binding to descriptive rather than deleted.
	const BASELINE_MARGIN = 0.05;
	const killConditionMet = passingArms.length === 0;
	const gateSummary = gateRows
		.map((c) => `${c.arm} ${c.arm_correct}/${c.n_units} vs ${c.baseline} ${c.baseline_correct}/${c.n_units} (delta ${c.delta_correct >= 0 ? "+" : ""}${c.delta_correct}, exact p=${c.mcnemar_exact_p === null ? "n/a" : c.mcnemar_exact_p.toFixed(4)})`)
		.join("; ");

	let verdict: "positive" | "null" | "inconclusive" | "invalid";
	let verdictReason: string;
	if (!hunkOnly || !selected || !fullBundle) {
		verdict = "inconclusive";
		verdictReason = "missing arm aggregate";
	} else if (bestTrivialBaseline === null || gateRows.length === 0) {
		verdict = "inconclusive";
		verdictReason = "no trivial baseline available to test against";
	} else if (killConditionMet) {
		verdict = "null";
		verdictReason =
			`no model arm is correct on more triples than the best trivial baseline ` +
			`(${bestTrivialBaseline}) at exact p < ${ALPHA}: ${gateSummary}`;
	} else {
		verdict = "positive";
		verdictReason =
			`${passingArms.map((c) => c.arm).join(", ")} beats the best trivial baseline ` +
			`(${bestTrivialBaseline}) at exact p < ${ALPHA}: ${gateSummary}`;
	}

	// Break-even wrong:halt cost ratio (WP4 deliverable). An arm's total cost
	// is `w * wrong + h * halt`; a trivial baseline never halts, so its cost
	// is `w * wrong_baseline`. The arm is cheaper exactly when
	//     h/w < (wrong_baseline - wrong_arm) / halt_arm.
	// That threshold is the break-even ratio: how cheap one halt must be,
	// relative to one wrong merge, before the arm is worth its halts.
	//
	// Computed on the records valid in BOTH arms of each comparison. The
	// per-arm columns above use each arm's own valid set (86, 87, 89, 90
	// records), and differencing those directly compares mismatched
	// denominators.
	const breakEven: Record<string, {
		baseline: string;
		unit: "record";
		n_paired_records: number;
		arm_wrong: number;
		arm_halt: number;
		baseline_wrong: number;
		wrong_avoided: number;
		halt_break_even_ratio: number | null;
		note: string;
	}> = {};
	if (bestTrivialBaseline !== null) {
		const gradesFor = (arm: string): Map<string, Grade> => {
			const m = new Map<string, Grade>();
			for (const r of recordsByArm[arm] ?? []) m.set(`${r.triple_id}|${r.run}`, gradeRecord(r, resolutions, triples));
			return m;
		};
		const baseGrades = gradesFor(bestTrivialBaseline);
		for (const arm of MODEL_ARMS) {
			const armGrades = gradesFor(arm);
			let armWrong = 0;
			let armHalt = 0;
			let baselineWrong = 0;
			let paired = 0;
			for (const [key, baseGrade] of baseGrades) {
				const armGrade = armGrades.get(key);
				if (armGrade === undefined) continue;
				if (armGrade === "invalid" || baseGrade === "invalid") continue;
				if (armGrade === "ungraded" || baseGrade === "ungraded") continue;
				paired += 1;
				if (armGrade === "wrong") armWrong += 1;
				if (armGrade === "halt") armHalt += 1;
				if (baseGrade === "wrong") baselineWrong += 1;
			}
			const wrongAvoided = baselineWrong - armWrong;
			breakEven[arm] = {
				baseline: bestTrivialBaseline,
				unit: "record",
				n_paired_records: paired,
				arm_wrong: armWrong,
				arm_halt: armHalt,
				baseline_wrong: baselineWrong,
				wrong_avoided: wrongAvoided,
				halt_break_even_ratio: armHalt > 0 ? wrongAvoided / armHalt : null,
				note: armHalt === 0
					? "arm never halts; the wrong count alone decides"
					: wrongAvoided > 0
						? `arm is cheaper than ${bestTrivialBaseline} when one halt costs less than ${(wrongAvoided / armHalt).toFixed(3)} of one wrong merge`
						// A halt cannot cost less than nothing, so a non-positive
						// wrong_avoided makes the arm unreachable at any price
						// rather than cheap at a negative one.
						: `arm avoids no wrong merges (wrong_avoided=${wrongAvoided}) and still halts ${armHalt} times, so no non-negative halt cost makes it cheaper than ${bestTrivialBaseline}`,
			};
		}
		// The comparator that keeps the ratios above honest. A policy that
		// halts on every record makes zero wrong decisions, so under this same
		// cost model it beats the baseline whenever h/w < wrong_baseline/N.
		// Any arm whose break-even ratio is BELOW this number is ranked worse,
		// by this measure, than a policy that never decides anything — which
		// is the measure failing, not the arm succeeding.
		const totalPaired = baseGrades.size;
		let baselineWrongAll = 0;
		for (const g of baseGrades.values()) if (g === "wrong") baselineWrongAll += 1;
		breakEven["degenerate-halt-everything"] = {
			baseline: bestTrivialBaseline,
			unit: "record",
			n_paired_records: totalPaired,
			arm_wrong: 0,
			arm_halt: totalPaired,
			baseline_wrong: baselineWrongAll,
			wrong_avoided: baselineWrongAll,
			halt_break_even_ratio: totalPaired > 0 ? baselineWrongAll / totalPaired : null,
			note: "reference policy, not an arm: halt on everything. Any arm below this ratio is worse than deciding nothing.",
		};
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
	// Validity and significance are separate gates and must stay legible
	// separately: the fabrication rule can only say "these counts are not
	// trustworthy", never "the hypothesis held". Capturing the count-based
	// verdict before the override means a run that is later reviewed back to
	// valid (as 2026-08-30T02-54-42-056Z was — see INVALIDATION-RULE.md's
	// recorded exception) does not silently inherit "positive" from nowhere.
	const significanceVerdict = verdict;
	const significanceVerdictReason = verdictReason;
	if (!runValid) {
		verdict = "invalid";
		verdictReason = `run invalid per any-flag fabrication rule: ${invalidationReasons.join("; ")}`;
	}

	const aggregate_doc = {
		produced_at: new Date().toISOString(),
		run_stamp: stamp,
		model: modelName,
		model_sha: modelSha,
		provider: providers.size === 1 ? [...providers][0]! : null,
		// "unconstrained", or the SHA-256 of the JSON Schema that constrained
		// sampling. Weights identity does not capture this: the same GGUF under
		// a grammar is a different experimental condition, so two runs are only
		// comparable when this field matches.
		decision_schema_sha: decisionSchemaSha,
		// Not derivable from the records — the runner does not stamp the
		// endpoint onto each row — so it is whatever H0_ADJUDICATOR said at
		// aggregation time, and null when that was unset. Labelled as such
		// rather than presented as measured provenance.
		adjudicator: process.env.H0_ADJUDICATOR ?? null,
		adjudicator_source: process.env.H0_ADJUDICATOR === undefined ? "unset" : "env",
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
		repeats,
		arms: byArm,
		cost_analysis: costAnalysis,
		break_even: breakEven,
		trivial_ceiling: trivialCeiling,
		significance: {
			alpha: ALPHA,
			binding_unit: "triple",
			binding_test: "mcnemar_exact",
			best_trivial_baseline: bestTrivialBaseline,
			// redesign-requirements.md §7 #4 asks for a paired test on
			// per-triple binary vectors; §7 #5 names Fisher exact. The data is
			// paired (both arms see the same triples), so McNemar-exact binds
			// and Fisher is the unpaired cross-check. Recorded here rather
			// than reconciled silently.
			test_selection_note:
				"§7 #4 requires a paired test on per-triple binary vectors; §7 #5 names Fisher exact. " +
				"Observations are paired, so McNemar's exact test is binding and Fisher exact is reported " +
				"as an unpaired cross-check.",
			triple_unit_note:
				`a triple counts as correct for an arm when at least ${Math.ceil(repeats / 2)} of its ${repeats} ` +
				"repeats are correct; halted and schema-invalid repeats count against the arm",
			comparisons,
		},
		// "Does at least one model arm actually beat the trivial ceiling?"
		// This was computed on WRONG count, which an arm lowers by halting —
		// so it read `true` on a run where every arm is a strict subset of the
		// constant. It is now computed the same way the gate is, on correct
		// count at the binding unit, and it agrees with the verdict.
		honest_signal: gateRows.length === 0
			? null
			: gateRows.some((c) => c.delta_correct > 0),
		honest_signal_basis: `triple-level correct-count delta against ${bestTrivialBaseline ?? "(no baseline)"}`,
		// Retained for continuity with earlier runs that cited it. Not a
		// signal: an arm lowers this by declining to answer.
		honest_signal_wrong_count_legacy: (() => {
			const compose = trivialCeiling["compose"];
			if (!compose || !hunkOnly || !selected || !fullBundle) return null;
			const bestModelWrong = Math.min(hunkOnly.wrong, selected.wrong, fullBundle.wrong);
			return bestModelWrong < compose.wrong;
		})(),
		kill_condition: {
			rule: `positive requires a model arm correct on more triples than the best trivial baseline at exact p < ${ALPHA}; otherwise null`,
			met: killConditionMet,
			passing_arms: passingArms.map((c) => c.arm),
			// Every figure below is wrong-count derived, which an arm improves
			// by halting instead of deciding. Nested and named so no reader
			// can mistake one of them for the gate; retained so the numbers
			// earlier runs cited stay checkable.
			wrong_fraction_reported_not_binding: {
				epsilon: BASELINE_MARGIN,
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
		},
		verdict,
		verdict_reason: verdictReason,
		// The acceptance-gate outcome on its own terms, unaffected by the
		// validity override above. Read this, not `verdict`, for "did H0's
		// hypothesis hold".
		significance_verdict: significanceVerdict,
		significance_verdict_reason: significanceVerdictReason,
		run_valid: runValid,
		invalidation_reasons: invalidationReasons,
		predicted_outcome: "selected reduces unsupported wrong decisions; full bundle mixed or worse; selection policy is the product mechanism",
	};

	const serialized = JSON.stringify(aggregate_doc, null, 2);
	writeFileSync("evidence/h0/aggregate.json", serialized);
	// Also write the stamped artifact. Previously only the unstamped file was
	// produced and the stamped one was copied into place by hand, which is how
	// `aggregate.json` came to hold a different run's numbers than the stamped
	// file beside it.
	writeFileSync(`evidence/h0/aggregate-${stamp}.json`, serialized);
	console.log(`verdict: ${verdict} — ${verdictReason}`);
	const stable = { ...aggregate_doc };
	delete (stable as Record<string, unknown>).produced_at;
	const stableHash = createHash("sha256").update(JSON.stringify(stable)).digest("hex");
	console.log(`stable_hash (re-derive): ${stableHash}`);
};

const invokedPath = process.argv[1] === undefined ? "" : resolve(process.argv[1]);
if (invokedPath === fileURLToPath(import.meta.url)) main();
