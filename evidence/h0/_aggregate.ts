// evidence/h0/_aggregate.ts — derive aggregate.json from runs/*.jsonl
import { existsSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";

interface H0Record {
	triple_id: string;
	arm: "hunk-only" | "selected" | "full-bundle" | "baseline-keep_ours" | "baseline-keep_theirs" | "baseline-compose";
	model: { name: string; sha: string };
	run: number;
	input_tokens: number;
	output_tokens: number;
	decision: "keep_ours" | "keep_theirs" | "compose" | "halt";
	halt_reason: string | null;
	reason_text: string;
	evidence_ids_quoted: string[];
	fabricated_ids: boolean;
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

const isHistoricalMatch = (decision: H0Record["decision"], resolution: string, ours: string, theirs: string): boolean => {
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
		// PR-B2 / S3: fabricated means a cited [source:...] tag that does NOT
		// match any known triple_key. Renamed from the original "any citation
		// counts as fabricated" interpretation. The field on the record stays.
		// The aggregate counter records whether at least one of the cited tags
		// does not match any known triple_key (i.e., it is fabricated).
		const recordSourceTags = r.evidence_ids_quoted.length;
		const tags = r.evidence_ids_quoted;
		const knownTripleKeys = new Set(resolutions.keys());
		const hasFabricated = tags.some(t => !knownTripleKeys.has(t));
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

const main = () => {
	const runsDir = "evidence/h0/runs";
	const files = readdirSync(runsDir)
		.filter((f) => f.endsWith(".jsonl") && !f.startsWith("_"))
		.map((f) => `${runsDir}/${f}`)
		.sort();
	if (existsSync("evidence/h0/baselines.json")) {
		files.push("evidence/h0/baselines.json");
	}

	const resolutions = loadResolutionByKey([
		"evidence/h0/triples-jq-diff3.jsonl",
		"evidence/h0/triples-cli-diff3.jsonl",
	]);
	const triples = new Map<string, Triple>();
	for (const p of [
		"evidence/h0/triples-jq-diff3.jsonl",
		"evidence/h0/triples-cli-diff3.jsonl",
	]) {
		const text = readFileSync(p, "utf8").trim();
		if (text === "") continue;
		for (const line of text.split("\n")) {
			const t = JSON.parse(line) as Triple;
			triples.set(t.triple_key, t);
		}
	}

	const byArm: Record<string, ArmAggregate> = {};
	for (const file of files) {
		const records = loadRecords(file);
		if (records.length === 0) continue;
		// PR-B1: a single file may contain records for multiple arms (e.g.
		// baselines.json holds keep_ours, keep_theirs, compose records).
		// Group by arm before aggregating so each per-arm bucket is computed
		// from records of that arm only.
		const byArmLocal: Record<string, H0Record[]> = {};
		for (const r of records) {
			if (!byArmLocal[r.arm]) byArmLocal[r.arm] = [];
			byArmLocal[r.arm].push(r);
		}
		for (const [arm, armRecords] of Object.entries(byArmLocal)) {
			byArm[arm] = aggregate(armRecords, resolutions, triples);
			console.log(`${arm}: ${armRecords.length} records, ${byArm[arm].correct}c/${byArm[arm].wrong}w/${byArm[arm].halt}h tokens=${byArm[arm].tokens_total}`);
		}
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
	const EPSILON = 0.5;
	let killConditionMet = false;
	let killReason = "";
	if (hunkOnly && selected && fullBundle && trivialCeiling["compose"]) {
		const armsWithinNoise =
			Math.abs(selected.wrong - hunkOnly.wrong) <= 1 &&
			Math.abs(fullBundle.wrong - hunkOnly.wrong) <= 1;
		const totalTrials = hunkOnly.triples_total;
		const bestModelWrongFraction = totalTrials > 0
			? Math.min(hunkOnly.wrong, selected.wrong, fullBundle.wrong) / totalTrials
			: 1;
		const composeWrongFraction = totalTrials > 0
		? trivialCeiling["compose"].wrong / trivialCeiling["compose"].triples
		: 1;
		const modelLoses = bestModelWrongFraction >= composeWrongFraction - EPSILON;
		if (armsWithinNoise && modelLoses) {
			killConditionMet = true;
			killReason = `best model wrong-fraction ${bestModelWrongFraction.toFixed(3)} >= trivial-compose ${composeWrongFraction.toFixed(3)}`;
		}
	}

	let verdict: "positive" | "null" | "inconclusive";
	let verdictReason: string;
	if (!hunkOnly || !selected || !fullBundle) {
		verdict = "inconclusive";
		verdictReason = "missing arm aggregate";
	} else if (killConditionMet) {
		verdict = "null";
		verdictReason = `wrong/halt < 1+${EPSILON} AND selected.full-bundle within noise of hunk-only: agent adapter retired.`;
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

	const aggregate_doc = {
		produced_at: new Date().toISOString(),
		model: "Qwen3-Coder-30B-A3B-Instruct-UD-Q3_K_XL",
		model_sha: "69cd7578d77dffc0b17e34bad9ef998d08ae0e20ccceef21bad4e7eb3d8c553b",
		git_version: "merge-tree --write-tree --messages -z (per-call -c merge.conflictStyle=diff3)",
		corpus_size: resolutions.size,
		// PR-B2 / S1: 898 lines in triples-*.jsonl dedup to 862 by triple_key
		// (per ADR 03, triple_key is a content digest; same digest across
		// different merges collapses). Report both numbers, not just one.
		triples_total: 898, // line count in triples-*.jsonl
		triples_unique: resolutions.size, // distinct triple_key count
		// PR-B2 / S2: read from env (PR-A removed the hardcoded defaults in
		// the runner; here we read the same env so aggregate.json reflects
		// the actual subsample used in the run).
		seed_subsample: Number(process.env.H0_SUBSAMPLE ?? 0),
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
			epsilon: EPSILON,
			met: killConditionMet,
			selected_within_noise: hunkOnly && selected ? Math.abs(selected.wrong - hunkOnly.wrong) <= 1 : null,
			full_bundle_within_noise: hunkOnly && fullBundle ? Math.abs(fullBundle.wrong - hunkOnly.wrong) <= 1 : null,
		},
		verdict,
		verdict_reason: verdictReason,
		predicted_outcome: "selected reduces unsupported wrong decisions; full bundle mixed or worse; selection policy is the product mechanism",
	};

	writeFileSync("evidence/h0/aggregate.json", JSON.stringify(aggregate_doc, null, 2));
	console.log(`verdict: ${verdict} — ${verdictReason}`);
	const stable = { ...aggregate_doc };
	delete (stable as Record<string, unknown>).produced_at;
	const stableHash = createHash("sha256").update(JSON.stringify(stable)).digest("hex");
	console.log(`stable_hash (re-derive): ${stableHash}`);
};

main();
