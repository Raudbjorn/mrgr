// evidence/h0/_h0_runner.ts — H0 evidence-bundle discriminator runner
import { readFileSync, writeFileSync, mkdirSync, openSync, closeSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";

// PR-E: optional cloud provider backend, alongside the pinned local
// llama.cpp adjudicator. IMPORTANT — this is NOT a drop-in replacement for
// H0 runs: the local path is pinned by GGUF sha256 (MODEL_SHA) specifically
// so every arm/repeat in a comparison is byte-identical, which the run's
// preflight checks. A cloud-hosted model has no such pin — the provider can
// swap weights/instances without notice — so H0_PROVIDER=hf breaks the
// reproducibility guarantee the "positive"/"invalid" verdict logic assumes.
// Use it for ad hoc/exploratory calls, not for a run meant to produce a
// citable H0 verdict, unless that tradeoff is explicitly accepted.
const PROVIDER = (process.env.H0_PROVIDER ?? "local") as "local" | "hf";
if (PROVIDER !== "local" && PROVIDER !== "hf") {
	throw new Error(`H0_PROVIDER must be "local" or "hf", got ${PROVIDER}`);
}
const ADJUDICATOR = process.env.H0_ADJUDICATOR ?? "http://127.0.0.1:8089";
const DEFAULT_MODEL_TAG = "Qwen3-Coder-30B-A3B-Instruct-UD-Q3_K_XL";
const DEFAULT_MODEL_SHA = "69cd7578d77dffc0b17e34bad9ef998d08ae0e20ccceef21bad4e7eb3d8c553b";
const MODEL_TAG = process.env.H0_MODEL_TAG ?? DEFAULT_MODEL_TAG;
const MODEL_SHA = process.env.H0_MODEL_SHA ?? (MODEL_TAG === DEFAULT_MODEL_TAG ? DEFAULT_MODEL_SHA : "");
if (PROVIDER === "local" && !/^[0-9a-f]{64}$/.test(MODEL_SHA)) {
	throw new Error("H0_MODEL_SHA must be a lowercase SHA-256 when H0_MODEL_TAG overrides the pinned default");
}
// Grammar-constrained decoding (opt-in). llama.cpp can constrain sampling to a
// JSON Schema, which makes malformed JSON unrepresentable — 4 of the 8
// schema-invalid records in the 2026-08-30 run were escape/comma faults inside
// otherwise-fine answers.
//
// It is opt-in, and it is stamped onto every record, for one reason: a grammar
// changes the sampling distribution, so it changes *decisions*, not just
// formatting. A constrained run is a different experimental condition from an
// unconstrained one, not a tidier version of it, and pooling the two would be
// the same error as pooling the contaminated Orca corpus with the primary set.
// `MODEL_SHA` cannot catch this — the weights are identical either way.
//
// Set the schema per request rather than with llama-server's
// `--json-schema-file`: a server-wide default is invisible to the run records,
// leaks onto every other consumer of the endpoint, and cannot be reconstructed
// later from the artifacts. Unset here means unconstrained, which is what every
// run through 2026-08-30 used.
const DECISION_SCHEMA_PATH = process.env.H0_DECISION_SCHEMA;
const DECISION_SCHEMA: unknown = DECISION_SCHEMA_PATH === undefined
	? null
	: JSON.parse(readFileSync(DECISION_SCHEMA_PATH, "utf8"));
// Digest of the file's bytes, not of the reparsed object: what constrained the
// sampler is the file on disk, and byte identity is the claim being recorded.
const DECISION_SCHEMA_SHA: string | null = DECISION_SCHEMA_PATH === undefined
	? null
	: createHash("sha256").update(readFileSync(DECISION_SCHEMA_PATH)).digest("hex");
if (DECISION_SCHEMA_PATH !== undefined && PROVIDER !== "local") {
	// Refusing beats silently ignoring. `json_schema` is llama.cpp's body
	// field; the HF router expects `response_format` instead, so honouring
	// this for PROVIDER=hf would take a separate, separately-verified path.
	throw new Error(
		`H0_DECISION_SCHEMA is only wired for H0_PROVIDER=local (llama.cpp's json_schema body field); got provider=${PROVIDER}`,
	);
}

// HF Inference Providers routing — "<hf-model-id>:<provider>" per
// https://huggingface.co/docs/inference-providers. No sha pin exists for a
// cloud model; the provider-qualified model string is the only identity we
// can record (see H0Record.model.sha below).
const HF_MODEL = process.env.H0_HF_MODEL ?? "deepseek-ai/DeepSeek-V4-Flash:novita";
const HF_TOKEN = process.env.HF_TOKEN;
if (PROVIDER === "hf" && (HF_TOKEN === undefined || HF_TOKEN === "")) {
	throw new Error("HF_TOKEN must be set when H0_PROVIDER=hf");
}
// Reasoning models (confirmed: deepseek-ai/DeepSeek-V4-Flash) emit
// `reasoning_content` before `content` and can exhaust a small max_tokens
// budget entirely on reasoning, leaving `content` empty. 512 (the local
// model's budget) is too tight for that — verified via a live probe call
// that 512 produces empty content with finish_reason=length, and ~1500
// reliably leaves room for both reasoning and the JSON answer.
const MAX_TOKENS = PROVIDER === "hf" ? 1500 : 512;
const RUNS_DIR = "evidence/h0/runs";
const CORPUS_FILES = [
	"evidence/h0/triples-jq-diff3.jsonl",
	"evidence/h0/triples-cli-diff3.jsonl",
	"evidence/h0/triples-redis-diff3.jsonl",
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
	preimage_ours?: string | null;
	preimage_theirs?: string | null;
	dependency_graph?: string[];
	dependency_graph_status?: "derived" | "unavailable";
}

interface H0Record {
	triple_id: string;
	arm: Arm;
	model: { name: string; sha: string };
	// "local" = pinned-by-sha llama.cpp, reproducible; "hf" = HF Inference
	// Providers cloud call, NOT reproducibility-pinned (see PROVIDER comment).
	provider: "local" | "hf";
	// SHA-256 of the JSON Schema that constrained sampling for this call, or
	// null for unconstrained. Records written before 2026-08-30 omit the field
	// entirely; `_aggregate.ts` reads absent and null as the same condition.
	decision_schema_sha: string | null;
	run: number;
	input_tokens: number;
	output_tokens: number;
	decision: "keep_ours" | "keep_theirs" | "compose" | "halt";
	halt_reason: string | null;
	reason_text: string;
	evidence_ids_quoted: string[];
	evidence_ids_exposed: string[];
	has_source_tags: boolean;
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

// PR-D / citation-probe fix: the probe run (evidence/h0/PROBE-CITATION-CHECK.md)
// found the model habitually cites [source:ours] / [source:theirs] — treating
// the merge-side labels as if they were evidence ids. "using only ids you
// were given" wasn't specific enough to stop this. Now explicit about what
// is and is not a valid id, and the per-message CITABLE_IDS block (added in
// buildMessages) states the exact enumerated set for that call.
const SYSTEM_PROMPT =
	"You are a code-merge conflict adjudicator. You will be shown a git conflict (with a base, ours, and theirs side).\n" +
	"Reply with STRICT JSON only — no prose outside the JSON. Shape:\n" +
	'{"decision":"keep_ours|keep_theirs|compose|halt","reason":"<<=200 tokens>"}\n' +
	"Halt is opt-in: choose it if the conflict is unresolvable from the provided evidence alone. " +
	"If you quote evidence, tag it as [source:<id>] using ONLY an id listed in the CITABLE_IDS block. " +
	'"ours", "theirs", "base", and section markers like <<CONFLICT_HUNK>> are structural labels, not ' +
	"evidence ids — never cite them. If nothing in CITABLE_IDS applies, omit the [source:...] tag entirely.\n" +
	"Stop your reply at the closing brace.";

// PR-D: dependency_graph is populated per-triple by _corpus_regen.ts (real
// git-history-derived file paths). Rather than dumping the raw array (which
// can run to hundreds of entries on a larger repo), rank by directory
// proximity to the conflicted path and cap to a fixed, recorded N so the
// "selected" arm tests curated evidence, not "full-bundle plus noise".
const DEPENDENCY_LIST_TOP_N = 8;
const DEPENDENCY_LIST_CAP_CHARS = 1200;

const selectDependencyList = (triple: Triple): { text: string; ids: string[] } => {
	if (triple.dependency_graph_status !== "derived" || !triple.dependency_graph || triple.dependency_graph.length === 0) {
		return { text: "(none)", ids: [] };
	}
	const targetDir = triple.path.includes("/") ? triple.path.slice(0, triple.path.lastIndexOf("/")) : "";
	const targetSegments = targetDir.split("/").filter(Boolean);
	// Entries are prefixed "ours:<path>" / "theirs:<path>" — strip the side
	// prefix before comparing directories.
	const proximityScore = (entry: string): number => {
		const rawPath = entry.includes(":") ? entry.slice(entry.indexOf(":") + 1) : entry;
		const dir = rawPath.includes("/") ? rawPath.slice(0, rawPath.lastIndexOf("/")) : "";
		if (dir === targetDir) return 0;
		const segments = dir.split("/").filter(Boolean);
		let shared = 0;
		while (shared < targetSegments.length && shared < segments.length && targetSegments[shared] === segments[shared]) {
			shared += 1;
		}
		return 1 + (targetSegments.length - shared) + (segments.length - shared);
	};
	const ranked = triple.dependency_graph
		.map((entry, idx) => ({ entry, idx, score: proximityScore(entry) }))
		.sort((a, b) => a.score - b.score || a.idx - b.idx)
		.slice(0, DEPENDENCY_LIST_TOP_N)
		.map((r) => r.entry);
	const rendered = ranked.join("\n");
	const text = rendered.length > DEPENDENCY_LIST_CAP_CHARS
		? rendered.slice(0, DEPENDENCY_LIST_CAP_CHARS) + "\n[…truncated…]"
		: rendered;
	return { text, ids: ranked };
};

const buildMessages = (
	triple: Triple,
	arm: Arm,
): { messages: { role: "system" | "user"; content: string }[]; exposedIds: string[] } => {
	const header = `Repository: ${triple.repository_id}\nMerge: ${triple.merge_sha}\nPath: ${triple.path}\nTriple: ${triple.triple_key}\nCategory: ${triple.category}\n\n`;
	const hunkOnly =
		`<<CONFLICT_HUNK>>\n` +
		`<<<<<<< ours\n${triple.ours}=======\n${triple.theirs}>>>>>>>\n<<END_HUNK>>\n` +
		`\nDecide. Reply with strict JSON only.`;
	const cap = 1200;
	const trim = (s: string) => s.length > cap ? s.slice(0, cap) + "\n[…truncated…]" : s;
	const exposedIds = [triple.triple_key];
	let user = "";
	if (arm === "hunk-only") {
		user = header + hunkOnly;
	} else if (arm === "selected") {
		const dep = selectDependencyList(triple);
		exposedIds.push(...dep.ids);
		user =
			header +
			`<<DEPENDENCY_LIST>>\n${dep.text}<<END_DEPENDENCY>>\n\n` +
			hunkOnly +
			(dep.ids.length > 0
				? `\nDecide. Consult the dependency list if it helps.`
				: `\nDecide. The dependency list is empty; rely on the hunk.`);
	} else {
		const dep = selectDependencyList(triple);
		exposedIds.push(...dep.ids);
		user =
			header +
			`<<FILE_FULL_PREIMAGE (ours side)>>\n${trim(triple.ours)}\n<<END_PREIMAGE_OURS>>\n` +
			`<<FILE_FULL_PREIMAGE (theirs side)>>\n${trim(triple.theirs)}\n<<END_PREIMAGE_THEIRS>>\n` +
			`<<DEPENDENCY_LIST>>\n${dep.text}<<END_DEPENDENCY>>\n\n` +
			hunkOnly +
			`\nDecide. Reply with strict JSON only.`;
	}
	// PR-A D2 fix: when a triple carries `preimage_ours`/`preimage_theirs`,
	// prefer those over the conflict-region text. Pre-existing triples
	// without preimages fall back to the old behavior (full-bundle arm
	// shows mislabeled conflict-region text). New triples from a regen
	// (PR-A's Step 2 regen, future) carry real preimages.
	if (arm === "full-bundle") {
		const preimageOurs = triple.preimage_ours;
		const preimageTheirs = triple.preimage_theirs;
		if (preimageOurs !== undefined) {
			// Replace the FILE_FULL_PREIMAGE blocks with real preimages.
			const dep = selectDependencyList(triple);
			user = header +
				`<<FILE_FULL_PREIMAGE (ours side)>>\n${preimageOurs !== null ? trim(preimageOurs) : "(absent)"}\n<<END_PREIMAGE_OURS>>\n` +
				`<<FILE_FULL_PREIMAGE (theirs side)>>\n${preimageTheirs !== null && preimageTheirs !== undefined ? trim(preimageTheirs) : "(absent)"}\n<<END_PREIMAGE_THEIRS>>\n` +
				`<<DEPENDENCY_LIST>>\n${dep.text}<<END_DEPENDENCY>>\n\n` +
				hunkOnly +
				`\nDecide. Reply with strict JSON only.`;
		}
	}
	const dedupedIds = Array.from(new Set(exposedIds));
	user +=
		`\n\n<<CITABLE_IDS>>\n` +
		`Only these may be cited as [source:<id>]: ${dedupedIds.join(", ")}\n` +
		`"ours" and "theirs" are NOT valid ids — they label merge sides, not evidence.\n` +
		`<<END_CITABLE_IDS>>`;
	return {
		messages: [
			{ role: "system", content: SYSTEM_PROMPT },
			{ role: "user", content: user },
		],
		exposedIds: dedupedIds,
	};
};

const callAdjudicator = async (
	messages: { role: "system" | "user"; content: string }[],
	opts: { temperature: number; seed: number; maxTokens?: number },
): Promise<{ content: string; input_tokens: number; output_tokens: number; ok: boolean }> => {
	const body = {
		model: PROVIDER === "hf" ? HF_MODEL : `/mnt/ssd1/models/${MODEL_TAG}.gguf`,
		messages,
		max_tokens: opts.maxTokens ?? MAX_TOKENS,
		// PR-B2 / D4: temperature and seed are per-call, not hardcoded.
		temperature: opts.temperature,
		seed: opts.seed,
		// Per-request so the constraint travels with the run record rather than
		// with whatever the systemd unit happened to say that week. Overrides
		// any server-wide --json-schema-file default.
		...(DECISION_SCHEMA !== null ? { json_schema: DECISION_SCHEMA } : {}),
	};
	const url = PROVIDER === "hf" ? "https://router.huggingface.co/v1/chat/completions" : `${ADJUDICATOR}/v1/chat/completions`;
	const headers: Record<string, string> = { "Content-Type": "application/json" };
	if (PROVIDER === "hf") headers.Authorization = `Bearer ${HF_TOKEN}`;
	// Operational hardening (resumed-run timeout): the upstream /v1/chat/completions
	// endpoint can hang indefinitely under heavy host load. Wrap the fetch in a
	// 90s AbortController; on timeout we return ok=false so the runner writes a
	// schema-invalid record and the aggregator counts it as halt. The kill
	// branch stays reachable (no Infinity denominator).
	// HF reasoning models can take well over 90s on a real (non-toy) prompt —
	// observed one smoketest call hit the 90s abort with a real conflict
	// prompt. Give the cloud path more headroom.
	const FETCH_TIMEOUT_MS = PROVIDER === "hf" ? 180_000 : 90_000;
	const ctrl = new AbortController();
	const to = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
	try {
		const res = await fetch(url, {
			method: "POST",
			headers,
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

const parseDecision = (text: string): { decision: H0Record["decision"]; reason: string; schema_valid: boolean; has_source_tags: boolean; evidence_ids: string[] } => {
	const start = text.indexOf("{");
	const end = text.lastIndexOf("}");
	if (start === -1 || end === -1 || end < start) {
		return { decision: "halt", reason: "no JSON object in response", schema_valid: false, has_source_tags: false, evidence_ids: [] };
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
		// NOTE: has_source_tags just means "quoted at least one [source:...] tag" —
		// it is not a fabrication check. Real fabrication (a cited tag that isn't
		// among the ids this specific prompt exposed) is computed in _aggregate.ts
		// against each record's evidence_ids_exposed.
		return { decision, reason, schema_valid: true, has_source_tags: tags.length > 0, evidence_ids: tags };
	} catch (err) {
		return { decision: "halt", reason: `JSON parse failed: ${(err as Error).message}`, schema_valid: false, has_source_tags: false, evidence_ids: [] };
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

// FNV-1a 32-bit — deterministic per-repo sub-seed derivation, stable
// regardless of repo enumeration order (unlike seed + array index).
const hashString = (s: string): number => {
	let h = 0x811c9dc5;
	for (let i = 0; i < s.length; i += 1) {
		h ^= s.charCodeAt(i);
		h = Math.imul(h, 0x01000193);
	}
	return h >>> 0;
};

// PR-D / §5: per-repo stratified quotas, not a single global shuffle. The
// old global subsample() never guaranteed cross-repo balance — it happened
// to land 15/15 on the 2-repo corpus for one seed by chance. With 3 repos,
// quotas guarantee the diversity gate by construction instead of hoping the
// shuffle lands well (see the fix plan's §6 for why this was chosen over
// preserving exact global-shuffle continuity).
const stratifiedSample = <T extends { repository_id: string }>(items: T[], n: number, seed: number): T[] => {
	const byRepo = new Map<string, T[]>();
	for (const t of items) {
		const arr = byRepo.get(t.repository_id);
		if (arr) arr.push(t); else byRepo.set(t.repository_id, [t]);
	}
	const repos = Array.from(byRepo.keys()).sort();
	if (repos.length === 0) return [];
	const baseQuota = Math.floor(n / repos.length);
	const remainder = n - baseQuota * repos.length;
	const quota = new Map<string, number>(repos.map((r) => [r, baseQuota]));
	// Deterministic remainder allocation: extra slots go to the repos with
	// the largest eligible pools (most room to absorb them without falling
	// back to an under-quota, unshuffled stratum), ties broken by repo id.
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
		const stratum = subsample(pool, q, subSeed);
		if (stratum.length < q) {
			console.warn(`  stratified sample: repo ${r} has only ${pool.length} eligible triples, quota ${q} not fully met (${stratum.length} taken)`);
		}
		out.push(...stratum);
	}
	return out;
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
	const sampled = stratifiedSample(triples.filter(isSmallTriple), SUBSAMPLE, SEED);
	console.log(`subsampled to ${sampled.length} triples (H0_SUBSAMPLE=${SUBSAMPLE}, REPEATS=${REPEATS})`);
	console.log(
		DECISION_SCHEMA_SHA === null
			? "decision schema: UNCONSTRAINED (comparable with runs through 2026-08-30)"
			: `decision schema: ${DECISION_SCHEMA_PATH} sha256=${DECISION_SCHEMA_SHA} — grammar-constrained sampling, NOT comparable with unconstrained runs`,
	);

	for (const arm of ARMS) {
		const outPath = `${RUNS_DIR}/${arm}-${stamp}.jsonl`;
		const done = loadExistingKeys(outPath);
		console.log(`[${arm}] existing records (resume): ${done.size}, output: ${outPath}`);
		// PR-B2 / D3: load baseline records once per arm, then look up per triple+repeat.
		const baselineRecords = await loadBaselineRecords();
		let i = 0;
		for (const triple of sampled) {
			i += 1;
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
				const { messages, exposedIds } = buildMessages(triple, arm);
				// full-bundle sends the largest context (full preimages); observed
				// an HF smoketest call exhaust the shared MAX_TOKENS budget on
				// reasoning alone for this arm specifically. Give it more room.
				const maxTokens = PROVIDER === "hf" && arm === "full-bundle" ? 2500 : undefined;
				const result = await callAdjudicator(messages, {
			temperature: REPEAT_TEMPERATURES[(r - 1) % REPEAT_TEMPERATURES.length],
			seed: SEED + r,
			maxTokens,
		});
				const parsed = parseDecision(result.content);
				const record: H0Record = {
					triple_id: triple.triple_key,
					arm,
					model: PROVIDER === "hf" ? { name: HF_MODEL, sha: "unpinned:cloud-provider" } : { name: MODEL_TAG, sha: MODEL_SHA },
					provider: PROVIDER,
					decision_schema_sha: DECISION_SCHEMA_SHA,
					run: r,
					input_tokens: result.input_tokens,
					output_tokens: result.output_tokens,
					decision: parsed.decision,
					halt_reason: parsed.decision === "halt" ? parsed.reason : null,
					reason_text: parsed.reason,
					evidence_ids_quoted: parsed.evidence_ids,
					evidence_ids_exposed: exposedIds,
					has_source_tags: parsed.has_source_tags,
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
