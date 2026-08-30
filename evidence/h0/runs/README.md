# H0 rerun — run parameters

This run executes the redesigned H0 evidence-utility discriminator after the
PR-A/PR-B1/PR-B2/PR-C redesign chain landed at `b87a064` on `origin/main`.

## Parameters

- `H0_SUBSAMPLE=30` — 30 triples — **target 15 jq + 15 cli (per-corpus balance); actual 30 jq + 0 cli** due to broken PRNG (`_h0_runner.ts:249-250`; both `Math.imul` calls one-argument → return `0` → Fisher-Yates collapses to one-position rotation → deterministic 30-jq sample regardless of seed value). See §23.1 of `docs/planning/final/canonical-final-planning-document.md` for the full diagnosis. **Verdict: INVALID.**

- `H0_REPEATS=3` — 3 repeats per triple/arm, cycled through temperatures
  `[0.0, 0.5, 0.9]` per `_h0_runner.ts:32`
- `H0_SEED=12648430` — 32-bit integer seeding mulberry32 Fisher-Yates
  subsample for reproducibility (`_h0_runner.ts:230-252`)
- `H0_ADJUDICATOR=http://127.0.0.1:8089` (plan default; reaches the pinned
  model after warmup)
- `H0_MODEL_TAG=Qwen3-Coder-30B-A3B-Instruct-UD-Q3_K_XL`
  (model SHA `69cd7578d77dffc0b17e34bad9ef998d08ae0e20ccceef21bad4e7eb3d8c553b`)

## Cost / wall-time

`30 triples × 3 repeats × 3 model arms = 270 LLM calls`. Baseline arms
(`baseline-keep_ours`, `baseline-keep_theirs`, `baseline-compose`) are
pre-computed by `_baselines.ts` and copied from `baselines.json`; the runner
does **not** call the LLM for those (see `_h0_runner.ts:33-38`).

Estimated wall-time: ~13 min plus startup (270 calls × ~3 s). The
Qwen3-Coder-30B-A3B warmup observed at 2026-08-28 ~23:54 UTC took
~21 s of HTTP 503 on `/v1/models` before serving 200.

## Provenance

- Code HEAD: `9269069ec521cae93250f25345108b8671ed59f6`
  (`fix(h0): repair runner defects, expand corpus, add HF provider option`),
  descending from redesign restore `b87a064`.
- First-run artifacts (`runs/*-2026-08-27T10-27-45-544Z.jsonl`,
  `aggregate.json`, `RETRACTED/*`) stay byte-stable per
  `evidence/h0/RETRACTION.json`. The new run files are additive.

## Valid rerun parameters — 2026-08-30

- `H0_STAMP=2026-08-30T00-51-17Z`
- `H0_PROVIDER=local`
- `H0_ADJUDICATOR=http://127.0.0.1:8088`
- `H0_MODEL_TAG=qwen2.5-coder-7b-instruct-q6_k`
- `H0_MODEL_SHA=46291ddea1bfb608fe63d9a1907eea6918bda87a7626593edc4bf97c5fd73f9d`
- `H0_SUBSAMPLE=30` — stratified as 10 jq + 10 cli + 10 redis
- `H0_REPEATS=3` — temperatures `[0.0, 0.5, 0.9]`
- `H0_SEED=12648430`

Rationale: 30 triples × 3 repeats × 3 model arms = 270 local LLM calls.
The three baseline arms add 270 precomputed records without calling the model,
for 540 records total. The model SHA was measured from
`/mnt/ssd1/models/qwen2.5-coder-7b-instruct-q6_k.gguf` before the run.

## Fresh rerun — 2026-08-30T02-54-42-056Z

- `H0_STAMP=2026-08-30T02-54-42-056Z`
- `H0_PROVIDER=local`
- `H0_ADJUDICATOR=http://127.0.0.1:8088`
- `H0_MODEL_TAG=qwen2.5-coder-7b-instruct-q6_k`
- `H0_MODEL_SHA=46291ddea1bfb608fe63d9a1907eea6918bda87a7626593edc4bf97c5fd73f9d`
- `H0_SUBSAMPLE=30` — stratified as 10 jq + 10 cli + 10 redis
- `H0_REPEATS=3` — temperatures `[0.0, 0.5, 0.9]`
- `H0_SEED=12648430`

This is a fresh six-arm run, not a reuse of the `00-51-17Z` records. The
first foreground invocation saved 90 hunk-only and 16 selected records before
ending without a completion marker. The resume-safe runner continued the same
stamp, completed all six arms, and produced 540 unique records.
