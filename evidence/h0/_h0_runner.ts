// evidence/h0/_h0_runner.ts — H0 evidence-bundle discriminator runner
import { readFileSync, writeFileSync, mkdirSync, openSync, closeSync, existsSync } from "node:fs";

const ADJUDICATOR = process.env.H0_ADJUDICATOR ?? "http://127.0.0.1:8089";
const MODEL_TAG = process.env.H0_MODEL_TAG ?? "Qwen3-Coder-30B-A3B-Instruct-UD-Q3_K_XL";
const MODEL_SHA = "69cd7578d77dffc0b17e34bad9ef998d08ae0e20ccceef21bad4e7eb3d8c553b";
const RUNS_DIR = "evidence/h0/runs";
const CORPUS_FILES = [
	"evidence/h0/triples-jq-diff3.jsonl",
	"evidence/h0/triples-cli-diff3.jsonl",
];
// PR-A: refuse to run with the legacy hardcoded defaults. The plan's S2 fix
// requires env-var-driven SUBSAMPLE/REPEATS. Run with H0_SUBSAMPLE=... H0_REPEATS=... .
const _subsampleEnv = process.env.H0_SUBSAMPLE;
const _repeatsEnv = process.env.H0_REPEATS;
if (_subsampleEnv === undefined || _repeatsEnv === undefined) {
	throw new Error("H0_SUBSAMPLE and H0_REPEATS must be set (PR-A: hardcoded defaults removed per S2 fix)");
}
const SUBSAMPLE = Number(_subsampleEnv);
const REPEATS = Number(_repeatsEnv);
if (!Number.isFinite(SUBSAMPLE) || SUBSAMPLE <= 0) throw new Error(`H0_SUBSAMPLE must be a positive integer, got ${_subsampleEnv}`);
if (!Number.isFinite(REPEATS) || REPEATS <= 0) throw new Error(`H0_REPEATS must be a positive integer, got ${_repeatsEnv}`);
// PR-B2 / D4 reproducibility: H0_SEED is required for deterministic Fisher-Yates subsampling.
const _seedEnv = process.env.H0_SEED;
if (_seedEnv === undefined) {
	throw new Error("H0_SEED must be set (PR-B2: reproducibility via Fisher-Yates subsampling)");
}
const SEED = Number(_seedEnv);
if (!Number.isInteger(SEED)) throw new Error(`H0_SEED must be a 32-bit integer, got ${_seedEnv}`);
// PR-B2 / D4 per-repeat temperature: cycle through [0.0, 0.5, 0.9] so repeats
// are not identical (temp=0 collapses n repeats to 1 effective sample).
const REPEAT_TEMPERATURES: readonly number[] = [0.0, 0.5, 0.9];
// PR-B2 / D3: extend ARMS with the three trivial baselines. The baselines
// are pre-computed by _baselines.ts (PR-B1) and live in baselines.json;
// the runner skips the LLM call for those arms and copies records from
// baselines.json into the run output.
const MODEL_ARMS = ["hunk-only", "selected", "full-bundle"] as const;
const BASELINE_ARMS = ["baseline-keep_ours", "baseline-keep_theirs", "baseline-compose"] as const;
const ARMS = [...MODEL_ARMS, ...BASELINE_ARMS] as const;
type Arm = typeof ARMS[number];
const SMALL_INPUT_BUDGET_CHARS = 2400;

interface Triple {
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
}

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
	fabricated_ids: boolean;
	duration_ms: number;
	schema_valid: boolean;
}

const isSmallTriple = (t: Triple): boolean => {
	// PR-A: drop the resolution from the input-budget calculation. Resolution
	// is for the grader, not the model.
	const sample = `Repository: ${t.repository_id}\nMerge: ${t.merge_sha}\nPath: ${t.path}\nTriple: ${t.triple_key}\nCategory: ${t.category}\n\n<<CONFLICT_HUNK>>\n<<<<<<< ours\n${t.ours}=======\n${t.theirs}>>>>>>>\n<<END_HUNK>>\n`;
	return sample.length <= SMALL_INPUT_BUDGET_CHARS;
};

const loadTriples = (path: string): Triple[] =>
	readFileSync(path, "utf8").trim().split("\n").map((l) => JSON.parse(l));

const SYSTEM_PROMPT =
	"You are a code-merge conflict adjudicator. You will be shown a git conflict (with a base, ours, and theirs side).\n" +
	"Reply with STRICT JSON only — no prose outside the JSON. Shape:\n" +
	'{"decision":"keep_ours|keep_theirs|compose|halt","reason":"<<=200 tokens>"}\n' +
	"Halt is opt-in: choose it if the conflict is unresolvable from the provided evidence alone. " +
	"If you quote any evidence identifier, tag it as [source:<id>] using only ids you were given.\n" +
	"Stop your reply at the closing brace.";

const buildMessages = (triple: Triple, arm: Arm): { role: "system" | "user"; content: string }[] => {
	const header = `Repository: ${triple.repository_id}\nMerge: ${triple.merge_sha}\nPath: ${triple.path}\nTriple: ${triple.triple_key}\nCategory: ${triple.category}\n\n`;
	const hunkOnly =
		`<<CONFLICT_HUNK>>\n` +
		`<<<<<<< ours\n${triple.ours}=======\n${triple.theirs}>>>>>>>\n<<END_HUNK>>\n` +
		`\nDecide. Reply with strict JSON only.`;
	const cap = 1200;
	const trim = (s: string) => s.length > cap ? s.slice(0, cap) + "\n[…truncated…]" : s;
	let user = "";
	if (arm === "hunk-only") {
		user = header + hunkOnly;
	} else if (arm === "selected") {
		user =
			header +
			`<<DEPENDENCY_LIST>>\n(none — single-file conflict)<<END_DEPENDENCY>>\n\n` +
			hunkOnly +
			`\nDecide. The dependency list is empty; rely on the hunk.`;
	} else {
		user =
			header +
			`<<FILE_FULL_PREIMAGE (ours side)>>\n${trim(triple.ours)}\n<<END_PREIMAGE_OURS>>\n` +
			`<<FILE_FULL_PREIMAGE (theirs side)>>\n${trim(triple.theirs)}\n<<END_PREIMAGE_THEIRS>>\n` +
			`<<DEPENDENCY_LIST>>\n(none)<<END_DEPENDENCY>>\n\n` +
			hunkOnly +
			`\nDecide. Reply with strict JSON only.`;
	}
	// PR-A D2 fix: when a triple carries `preimage_ours`/`preimage_theirs`,
	// prefer those over the conflict-region text. Pre-existing triples
	// without preimages fall back to the old behavior (full-bundle arm
	// shows mislabeled conflict-region text). New triples from a regen
	// (PR-A's Step 2 regen, future) carry real preimages.
	if (arm === "full" || arm === "full-bundle") {
		const preimageOurs = (triple as Triple & { preimage_ours?: string | null }).preimage_ours;
		const preimageTheirs = (triple as Triple & { preimage_theirs?: string | null }).preimage_theirs;
		if (preimageOurs !== undefined) {
			// Replace the FILE_FULL_PREIMAGE blocks with real preimages.
			user = header +
				`<<FILE_FULL_PREIMAGE (ours side)>>\n${trim(preimageOurs)}\n<<END_PREIMAGE_OURS>>\n` +
				`<<FILE_FULL_PREIMAGE (theirs side)>>\n${preimageTheirs !== null && preimageTheirs !== undefined ? trim(preimageTheirs) : "(absent)"}\n<<END_PREIMAGE_THEIRS>>\n` +
				`<<DEPENDENCY_LIST>>\n(none)<<END_DEPENDENCY>>\n\n` +
				hunkOnly +
				`\nDecide. Reply with strict JSON only.`;
		}
	}
	return [
		{ role: "system", content: SYSTEM_PROMPT },
		{ role: "user", content: user },
	];
};

const callAdjudicator = async (
	messages: { role: "system" | "user"; content: string }[],
	opts: { temperature: number; seed: number },
): Promise<{ content: string; input_tokens: number; output_tokens: number; ok: boolean }> => {
	const body = {
		model: `/mnt/ssd1/models/${MODEL_TAG}.gguf`,
		messages,
		max_tokens: 512,
		// PR-B2 / D4: temperature and seed are per-call, not hardcoded.
		temperature: opts.temperature,
		seed: opts.seed,
	};
	// Operational hardening (resumed-run timeout): the upstream /v1/chat/completions
	// endpoint can hang indefinitely under heavy host load. Wrap the fetch in a
	// 90s AbortController; on timeout we return ok=false so the runner writes a
	// schema-invalid record and the aggregator counts it as halt. The kill
	// branch stays reachable (no Infinity denominator).
	const FETCH_TIMEOUT_MS = 90_000;
	const ctrl = new AbortController();
	const to = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
	try {
		const res = await fetch(`${ADJUDICATOR}/v1/chat/completions`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
			signal: ctrl.signal,
		});
		clearTimeout(to);
		if (!res.ok) {
			return { content: `__http_${res.status}__`, input_tokens: 0, output_tokens: 0, ok: false };
		}
		const json = await res.json() as {
			choices: { message: { content: string } }[];
			usage?: { prompt_tokens: number; completion_tokens: number };
		};
		const content = json.choices[0]?.message?.content ?? "";
		const usage = json.usage;
		return {
			content,
			input_tokens: usage?.prompt_tokens ?? 0,
			output_tokens: usage?.completion_tokens ?? 0,
			ok: true,
		};
} catch (err) {
	clearTimeout(to);
	return {
		content: `__network_error_${(err as Error).message.slice(0, 80)}__`,
		input_tokens: 0,
		output_tokens: 0,
		ok: false,
	};
} finally {
	clearTimeout(to);
}
};

const parseDecision = (text: string): { decision: H0Record["decision"]; reason: string; schema_valid: boolean; fabricated_ids: boolean; evidence_ids: string[] } => {
	const start = text.indexOf("{");
	const end = text.lastIndexOf("}");
	if (start === -1 || end === -1 || end < start) {
		return { decision: "halt", reason: "no JSON object in response", schema_valid: false, fabricated_ids: false, evidence_ids: [] };
	}
	const json = text.slice(start, end + 1);
	try {
		const obj = JSON.parse(json) as Record<string, unknown>;
		const rawDecision = typeof obj.decision === "string" ? obj.decision : "";
		const decision: H0Record["decision"] =
			rawDecision === "keep_ours" || rawDecision === "keep_theirs" || rawDecision === "compose" || rawDecision === "halt"
				? rawDecision
				: "halt";
		const reason = typeof obj.reason === "string" ? obj.reason.slice(0, 400) : "";
		const tags = Array.from(reason.matchAll(/\[source:([^\]]+)\]/g)).map((m) => m[1]);
		return { decision, reason, schema_valid: true, fabricated_ids: tags.length > 0, evidence_ids: tags };
	} catch (err) {
		return { decision: "halt", reason: `JSON parse failed: ${(err as Error).message}`, schema_valid: false, fabricated_ids: false, evidence_ids: [] };
	}
};

const appendJsonl = (path: string, record: object): void => {
	const fd = openSync(path, "a");
	const line = JSON.stringify(record) + "\n";
	try {
		writeFileSync(fd, line);
	} finally {
		closeSync(fd);
	}
};

const loadExistingKeys = (path: string): Set<string> => {
	if (!existsSync(path)) return new Set();
	const text = readFileSync(path, "utf8").trim();
	if (text === "") return new Set();
	const keys = new Set<string>();
	for (const line of text.split("\n")) {
		try {
			const r = JSON.parse(line) as H0Record;
			keys.add(`${r.triple_id}|${r.arm}|${r.run}`);
		} catch {}
	}
	return keys;
};

// PR-B2 / S4 + D4: Fisher-Yates shuffle seeded by SEED. Reproducible
// across runs that share H0_SEED; replaces the stride-based sampler
// which is not random (S4 defect).
const mulberry32 = (a: number): () => number => {
	return () => {
		a |= 0; a = (a + 0x6D2B79F5) | 0;
		let t = Math.imul(a ^ (a >>> 15));
		t = (t + Math.imul(t ^ (t >>> 7))) | 0;
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

// PR-B2 / D3: read baselines.json once at start of main; build a
// (triple_id, arm, run) -> record map for O(1) lookup in the run loop.
interface BaselineRecord {
	triple_id: string;
	arm: string;
	run: number;
	decision: string;
	reason_text: string;
	duration_ms: number;
	input_tokens: number;
	output_tokens: number;
	evidence_ids_quoted: string[];
	fabricated_ids: boolean;
	schema_valid: boolean;
	halt_reason: string | null;
	model: { name: string; sha: string };
}
const loadBaselineRecords = async (): Promise<Map<string, BaselineRecord>> => {
	const m = new Map<string, BaselineRecord>();
	if (!existsSync("evidence/h0/baselines.json")) return m;
	const text = readFileSync("evidence/h0/baselines.json", "utf8");
	for (const line of text.split("\n")) {
		if (line === "") continue;
		try {
			const r = JSON.parse(line) as BaselineRecord;
			m.set(`${r.triple_id}|${r.arm}|${r.run}`, r);
		} catch {}
	}
	return m;
};

const main = async () => {
	mkdirSync(RUNS_DIR, { recursive: true });
	const stamp = process.env.H0_STAMP ?? new Date().toISOString().replace(/[:.]/g, "-");
	const triples = CORPUS_FILES.flatMap(loadTriples);
	console.log(`loaded ${triples.length} triples from ${CORPUS_FILES.length} files`);
	const sampled = subsample(triples.filter(isSmallTriple), SUBSAMPLE, SEED);
	console.log(`subsampled to ${sampled.length} triples (H0_SUBSAMPLE=${SUBSAMPLE}, REPEATS=${REPEATS})`);

	for (const arm of ARMS) {
		const outPath = `${RUNS_DIR}/${arm}-${stamp}.jsonl`;
		const done = loadExistingKeys(outPath);
		console.log(`[${arm}] existing records (resume): ${done.size}, output: ${outPath}`);
		let i = 0;
		for (const triple of sampled) {
			i += 1;
			// PR-B2 / D3: load baseline records once, then look up per arm+triple+repeat.
	const baselineRecords = await loadBaselineRecords();
	for (let r = 1; r <= REPEATS; r += 1) {
				const key = `${triple.triple_key}|${arm}|${r}`;
				if (done.has(key)) continue;
				// Baseline arms: copy precomputed record, skip LLM call.
				if (BASELINE_ARMS.includes(arm as typeof BASELINE_ARMS[number])) {
					const br = baselineRecords.get(`${triple.triple_key}|${arm}|${r}`);
					if (br) {
						appendJsonl(outPath, br);
						console.log(`  [${arm}] triple ${i}/${sampled.length} run ${r}: baseline ${br.decision}`);
						continue;
					}
					// Fall through if baseline record missing (caller did not run _baselines.ts).
				}
				const t0 = Date.now();
				const result = await callAdjudicator(buildMessages(triple, arm), {
			temperature: REPEAT_TEMPERATURES[(r - 1) % REPEAT_TEMPERATURES.length],
			seed: SEED + r,
		});
				const parsed = parseDecision(result.content);
				const record: H0Record = {
					triple_id: triple.triple_key,
					arm,
					model: { name: MODEL_TAG, sha: MODEL_SHA },
					run: r,
					input_tokens: result.input_tokens,
					output_tokens: result.output_tokens,
					decision: parsed.decision,
					halt_reason: parsed.decision === "halt" ? parsed.reason : null,
					reason_text: parsed.reason,
					evidence_ids_quoted: parsed.evidence_ids,
					fabricated_ids: parsed.fabricated_ids,
					duration_ms: Date.now() - t0,
					schema_valid: parsed.schema_valid,
				};
				appendJsonl(outPath, record);
				console.log(`  [${arm}] triple ${i}/${sampled.length} run ${r}: ${record.decision} schema_valid=${record.schema_valid} tok=${result.input_tokens}+${result.output_tokens} wall=${record.duration_ms}ms`);
			}
		}
		console.log(`[${arm}] done: ${outPath}`);
	}
	console.log("all arms complete");
};

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
