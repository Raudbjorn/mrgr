# H0 rerun — run parameters

This run executes the redesigned H0 evidence-utility discriminator after the
PR-A/PR-B1/PR-B2/PR-C redesign chain landed at `b87a064` on `origin/main`.

## Parameters

- `H0_SUBSAMPLE=30` — 30 triples (15 jq + 15 cli, per-corpus balance from
  Fisher-Yates subsample)
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

- Code: `b87a0648c26bbed504a0ed64e9b7ca37b4b8e6d0` (`h0-redesign-merge`,
  same as `origin/main`).
- First-run artifacts (`runs/*-2026-08-27T10-27-45-544Z.jsonl`,
  `aggregate.json`, `RETRACTED/*`) stay byte-stable per
  `evidence/h0/RETRACTION.json`. The new run files are additive.
