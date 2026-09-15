# Ornith-1.5-9B selector pilot: pre-declared Q8_0 secondary evaluation (amendment, 2026-09-15)

Status: pre-declared. Committed to git before the first fresh held-out request of run `9b-revision-2026-09-15`
(unit `mrgr-lora-9b-revision-20260915`), while that run was still in acquisition. The commit message records the
file SHA-256 and the run state observed at commit time. The primary evaluation is unchanged.

## Why (evidence available before any held-out request)

- In-sample pipeline check (8 training cases, Q4_K_M base, adapter at scale 1): the adapter reproduced its
  training target in 1/8 cases. Its output was byte-identical to the base arm in 5/8 cases (same seed).
- Training did learn the targets in the training framework. Mean summed answer loss per example was about
  5.33 nats in epoch 1, 1.42 in epoch 2 and 0.57 in epoch 3 (epoch-3 median about 0.24).
- The deployment path is correct:
  - GGUF adapter tensors equal the PEFT tensors (max norm difference 6.6e-6).
  - Layers 3, 7, …, 31 are adapted: `attn_q` 4096→8192 (gated), `attn_v` 4096→1024; alpha 16.
  - The qwen35 graph routes `wq`, `wk` and `wv` through `build_lora_mm`.
  - `POST /lora-adapters` scale 1 applies to requests without a `lora` field.
- Adapter delta magnitude: ‖ΔW‖_F/‖W‖_F is 2.0e-3 to 3.8e-3. The top singular value of ΔW is 0.8–3.8% of W's.
- Working hypothesis: training used an NF4 base and serving uses Q4_K_M. The delta is small enough that the
  difference between those two quantizations may erase the learned choices. It is not yet tested.

## Pre-declared additions

1. **Q8_0 base artifact.** `llama-quantize base-bf16.gguf base-Q8_0.gguf Q8_0`, run with the installed fork
   binary (llama.cpp-sycl-f16-git b10146). Source is `9b-training-2026-09-15/base-bf16.gguf`. Record the
   input and output SHA-256, the command and the binary hash.
2. **Adapter fidelity check (in-sample, diagnostic).**
   - Cases: the same 8 in-sample cases.
   - Conditions: Q4_K_M and Q8_0 bases, each at adapter scale 0 and scale 1.
   - Decoding: temperature 0, top_k 1, the same messages, `enable_thinking=false`.
   - Metric: the count of cases whose output equals the training target.
   - Pre-declared reading:
     - *quantization mismatch supported* if Q8_0 at scale 1 reproduces ≥ 6/8 targets and more than Q4_K_M
       at scale 1.
     - *deployment fidelity not established* if Q8_0 at scale 1 reproduces ≤ 2/8.
     - Anything else is *inconclusive*.
   - Optional further diagnostic, not a gate: HF NF4 base + adapter greedy decoding on the same 8 cases.
3. **Secondary fresh held-out evaluation.** It uses the identical admitted held-out cases, schedule, seeds,
   repeats and effective sampler as the primary. The primary sent `top_k` 40, `min_p` 0.05, temperature 0.6
   and top-p 0.95, taken from the 9B server's `/props`. The only change is the base: Q8_0 in both arms.
   It runs **regardless of the primary outcome and regardless of the fidelity result**. It starts after the
   primary unit exits and releases `training.lock`, and it counts against the same 72-hour budget. If the
   budget or artifacts are insufficient, the secondary is INCOMPLETE and is not rescheduled.
4. **Reporting.**
   - The primary is reported exactly as registered.
   - The secondary is labelled secondary and exploratory, and its interpretation is fixed by item 2:
     - If fidelity supports a quantization mismatch, the primary reads "adapter inert under Q4_K_M
       deployment" and the secondary is the adapter-efficacy estimate.
     - If fidelity is not established, the pilot outcome is INCOMPLETE (adapter fidelity).
     - One retrain is allowed, and only with a recipe declared in a further dated amendment before it runs.
   - The two evaluations are never pooled.
5. **Record corrections, appended rather than rewritten.**
   - `revision.json` `config.acquisition_events=200` and `config.top_k=20` were not enforced. The frame froze
     `max_events=1000`, and the enforced bound was the 100-repository frame. Requests sent `top_k` 40.
   - The repair round edited tracked `evidence/h0/v3-screen-go.mjs` and `evidence/h0/v3.mjs`, a deviation from
     the evidence-immutability rule. Their SHA-256 values are pinned in `revision.json`.
   - Case 38 (`pelletier/go-toml`) admission depends on `MemoryHigh=20G`/`MemoryMax=24G`/`MemorySwapMax=0`
     and the 120 s oracle timeout.

## Not claimed

- The in-sample check is not an efficacy estimate. The quantization-mismatch explanation is untested.
- Q8_0 is not the NF4 training base either. A positive Q8_0 result shows sensitivity to deployment precision.
  It does not show that Q4_K_M deployment is unusable with a stronger adapter.
- No result from either held-out evaluation existed when this amendment was written.
