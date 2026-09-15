# Ornith-1.5-9B selector pilot

This workspace implements the September 14 amendment. Historical H0 evidence is immutable;
training reuse deliberately lifts its original quarantine. These cases cannot become evaluation data.

Prepared data: `/mnt/mrgr/ornith-lora/runs/9b-selector-2026-09-14-r2/prepared.json`.
All 60 cases passed fresh oracle validation. Training feasibility artifacts and subsequent training live
in `/mnt/mrgr/ornith-lora/runs/9b-training-2026-09-15`.

Run Python stages using `/mnt/mrgr/ornith-lora/venv/bin/python`. `runtime.guarded` supplies the pinned
PATH, Hugging Face cache, Level Zero selector and Intel-only OpenCL directory. GPU stages require an idle
9B service and run inside a bounded systemd unit that stops/restores that service. No system driver
configuration is changed. Failed attempts are preserved; do not overwrite or silently retry them.

Stages:

1. `full_model.py RUN`: metadata-only text-class NF4 coverage, exact checkpoint-key mapping,
   template/token-boundary checks, length exclusions, and a correctly shaped fixture adapter.
2. `download_weights.py RUN`: fetch the pinned checkpoint and hash its shards.
3. `train.py check RUN`: full model load, 512/2048-token synthetic and longest admitted-example
   backward updates, frozen-weight checks, disabled-adapter equivalence and save/reload equivalence.
4. `export_check.py convert RUN`: convert the pinned base and tested adapter with the installed
   llama.cpp source; quantize the base through the same fixed path used for subsequent deployment.
5. `export_check.py serve RUN`: load the converted base plus adapter and exercise enabled/disabled
   adapter execution. This is deployment feasibility, not a correctness or efficacy evaluation.
6. `train.py train RUN`: requires both full-model and export success receipts; train the frozen
   three-epoch, accumulation-four recipe and write per-step checkpoints plus the final adapter.

Launch stages through `runtime.guarded`; direct GPU execution bypasses service isolation and budget
accounting. The historical `pilot.py` preparation CLI is retained for its frozen data-preparation run;
the new full-model stages above supersede its unfinished train/evaluate dispatch. No evaluation of
fresh lineages is claimed by these scripts.

Training excludes three examples above 4,096 tokens; none is truncated. The resulting 57 cases imply
45 optimizer updates (15 per epoch, including the final partial accumulation group). Warmup is three
updates. Supervision covers only the final JSON and assistant terminator; no reasoning is invented.

The optional Transformers caching allocator warmup is disabled in-process: its single 7 GiB request
was rejected by XPU even on an empty device. Actual model tensor allocations remain unchanged.
The frozen NF4 base uses BF16 compute, embedding and output-head weights. Generic k-bit preparation
is intentionally avoided because its FP32 upcast would change this memory budget. Input gradients and
checkpointing are enabled explicitly. No model-weight CPU offload is permitted.

Checks: `python -m unittest discover -s experiments/lora -p 'test_*.py'` using the pinned environment.
Receipts, checkpoints and logs under the run directory determine actual completion; this README does
not assert that training or deployment has passed.

### Implemented repair-round runner (2026-09-15)

`python3 experiments/lora/revision.py start RUN_DIRECTORY` now implements the
complete one-round path: additive prior-outcome correction, typed exposure
ledger, frozen compact-repository frame, final-adapter GGUF export, eight-case
in-sample pipeline check, bounded acquisition, full oracle admission, fixed
four-cell allocation and conditional 144-request heldout evaluation. It runs as
a native systemd service and restores the ordinary inference service on exit.

The active run is `/mnt/mrgr/ornith-lora/runs/9b-revision-2026-09-15` and its unit
is `mrgr-lora-9b-revision-20260915`. Inspect `execution.json`, `status.json`,
`in-sample/status.json` and `acquisition/status.json`; terminal findings go to
`result.json`. `revision.json` freezes sampler, budget and input hashes. Do not
edit its instrument while the unit is running. A fresh run directory is mandatory;
this CLI does not silently restart an entire partially executed acquisition.
Inference exchanges have a separate identical-input, one-infrastructure-retry
policy; completed results are never resampled.

The original attempt is **INCOMPLETE (instrument)**. The appended correction
names its five receipts; no original record is overwritten. Any revised cell
shortfall remains INCOMPLETE, not a supply-absence or model-quality claim. The
in-sample check is never an efficacy estimate. There is no cross-validation or
additional acquisition round in this protocol.

Checks: `python3 -m unittest discover -s experiments/lora -p test_revision.py`,
`node evidence/h0/go-screen-repair.test.mjs`, and the existing Go screener,
behavioral runner and runtime checks. No new package dependency was installed.
