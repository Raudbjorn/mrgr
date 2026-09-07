# H0 evidence studies

The new [v3 behavioral instrument](v3-research-2026-09-06/README.md) is implemented and has C/Go feasibility pilots using Mercury-2 and MiniMax-M3. It is not a completed development or confirmation study; **MEASURABLE=NO**. Acquisition yielded 11,051 provisional ConGra event mappings; executable validation remains the bottleneck.

## Preserved v2 historical-agreement study

**Phase 3 complete and valid; Phase 4 ready. MEASURABLE=NO.** The frozen confirmation contains 92 distinct merge cases and 276 model requests. Selected context matched 5/92 historical replacements (5.4%), compared with 7/92 for hunk-only and 21/92 for the strongest deterministic baseline (keep-ours). The selected-versus-hunk-only difference is -2.2pp, exact paired p=0.7266. The result is inconclusive; no demonstrated selected-evidence superiority. Selected also underperformed keep-ours by 17.4pp (paired p=0.002494) on this endpoint. Read the [preserved result](v2-2026-09-06b/RESULT.md).

The corrected Phase 3 instrument is [`v2.mjs`](v2.mjs). The active frozen study is [`v2-2026-09-06b/`](v2-2026-09-06b/), with its protocol, exact instrument snapshot, inputs, separate historical references, raw request/response records, and generated aggregates. The [execution contract and Phase 4 handoff](../../docs/planning/final/phase-3-h0-evidence-utility/execution-and-handoff-2026-09-06.md) explains the evidence standard, source research, data acquisition, limitations, and next implementation steps.

The older `_aggregate.ts` / `_h0_runner.ts` files reproduce enum-only historical experiments. Their compose grader is an upper bound even after newline repair; they are not the current evidence-utility instrument. Preserve their original outputs and review exceptions. The first `v2-2026-09-06/` directory is a superseded, incomplete **development** pilot; read its `SUPERSEDED.md`. It has no confirmation result.

## Reproduce the saved analysis

Run from the repository root, with Node 22.13+ and Git 2.55.0 (the research instrument's measured version):

```sh
node --test evidence/h0/v2.test.mjs
node evidence/h0/v2-2026-09-06b/instrument.mjs aggregate evidence/h0/v2-2026-09-06b development
node evidence/h0/v2-2026-09-06b/instrument.mjs aggregate evidence/h0/v2-2026-09-06b confirmation
node evidence/h0/design-check.mjs
```

Saved-response aggregation needs no model server, GPU, external repository checkout, credentials, or network. It reconstructs each request and checks protocol, input, reference, and instrument hashes before scoring raw responses. The active default command is `node evidence/h0/v2.mjs aggregate`; the explicit archived command above remains usable after future source changes. Exact saved-output replay is not a claim that a new inference run will be bitwise identical across hardware or runtime versions.

`confirmation-aggregate.json` is the machine verdict; `confirmation-scores.jsonl` contains paired case-level indicators; `uncertainty.json` adds descriptive, repository-stratified paired bootstrap intervals and leave-one-repository-out sensitivity; `cost-characterization.json` records tokens, latency and break-even review costs under explicit illustrative assumptions. `valid` governs whether the experiment can be used at all. Only a valid, complete confirmation can close Phase 3; only the frozen all-comparisons conjunction earns `MEASURABLE=YES`. Failure of that conjunction is inconclusive, not evidence of equivalence or no possible benefit. If `valid:false`, report **INVALID**, regardless of the aggregator's generic verdict text.

## Execute or resume a frozen run

The measured model/server identity is in `runtime.json`; the model SHA is also frozen in `protocol.json`. An isolated llama.cpp build 9827 (`0ed235ea2c`) was used because the host's installed binary had an unresolved shared-library dependency. The server was restored from the local llama.cpp and libggml backup archives under `/mnt/ssd1/llama-backup/` into `/tmp/mrgr-h0-llama`, without changing system libraries.

The recorded launch configuration is:

```sh
LD_LIBRARY_PATH=/tmp/mrgr-h0-llama/usr/lib /tmp/mrgr-h0-llama/usr/bin/llama-server \
  -m /mnt/ssd1/models/Qwen3-Coder-30B-A3B-Instruct-UD-Q3_K_XL.gguf \
  --host 127.0.0.1 --port 18089 -c 8192 -ngl 99 --device Vulkan1 \
  --split-mode none -t 12 --parallel 1
```

Verify the actual model bytes against `model_sha256`, not only the served model name. Then:

```sh
node evidence/h0/v2.mjs run evidence/h0/v2-2026-09-06b development
node evidence/h0/v2.mjs aggregate evidence/h0/v2-2026-09-06b development
node evidence/h0/v2.mjs run evidence/h0/v2-2026-09-06b confirmation
```

The runner skips recorded requests after verifying their protocol hash. It takes an exclusive `runner.lock`; remove a stale lock only after verifying that its recorded PID is no longer running. Do not remove records to retry bad answers. A future experiment needs a new directory, frozen design and untouched sample; it must not overwrite this confirmation.

## Source and acquisition provenance

[`research-2026-09-06/inventory.json`](research-2026-09-06/inventory.json) audits the old corpus, duplicate identities and exposed merge groups. Its five-case acquisition pilot is diagnostic only. The active study's `acquisition.json` records upstream URLs, revision pins, raw scan/materialization hashes, commands, and sampled revision license texts. New libgit2 history and the verified original Merge-Bench release archive remain under `.do-not-commit/h0-research-2026-09-06/`; only libgit2 supplied new confirmation cases. Frozen experiment inputs and references are sufficient for the saved analysis even without those acquisition caches.

This measures exact historical replacement agreement with CRLF normalization only. Behavioral correctness, deployment risk, unseen-repository generalization and model pretraining contamination remain unmeasured. The selected treatment combines local code windows and parent commit subjects; it does not validate dependency-graph retrieval.

## Report verification

The [portable research report](../../docs/planning/final/phase-3-h0-evidence-utility/research-report-2026-09-06.html) passed artifact validation, embedded-data equality and semantic-fallback structural checks. Both installed browsers failed the enhanced-reader verifier, so visual geometry and source interactions remain unverified. The readable fallback and embedded data are retained. This report-UI limitation is separate from the fully passed experiment/replay checks. See [verification.json](v2-2026-09-06b/verification.json).
