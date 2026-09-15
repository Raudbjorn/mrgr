# Ornith LoRA selector pilot from archived merge experiments (amended 2026-09-14: target Ornith-1.5-9B)

Changes relative to the draft are tagged **[amended]**. Facts tagged *(verified)* were checked on 2026-09-14
against the Hub, the transformers `main` source, the local llama.cpp fork (b10146 c83464b8d) and this host.

## Why the target changed [amended]

Ornith-1.5-35B-A3B cannot use the draft recipe on this host. Its experts are fused BF16 `nn.Parameter`
tensors (`gate_up_proj` [256,1024,2048], `down_proj` [256,2048,512]; 32.2B params, 60.0 GiB) *(verified)*.
transformers' bitsandbytes 4-bit path quantizes only `Linear4bit` modules, every transformers experts
implementation is fused, and bnb refuses CPU/disk dispatch of 4-bit modules unless offloaded modules stay
32-bit *(verified)*. The NF4 base therefore cannot fit 16 GB VRAM plus the 48 GiB host budget.

Ornith-1.5-9B is dense, same family, same `tokenizer.json`, MIT. Findings from this pilot concern the 9B
selector only and must not be transferred to the 35B model.

## Summary

Implement an auditable candidate-selection LoRA experiment targeting **Ornith-1.5-9B** [amended], using verified
historical evidence for training and 24 fresh repository lineages for exploratory evaluation.

The starting candidate corpus contains 60 cases across 34 lineages, 189 distinct candidate texts, recorded
candidate evaluations, and intact scaffolds. These are provisional inputs until provenance checks and oracle
replay pass.

Use the A770 without model-weight CPU offloading [amended], temporarily stop and subsequently restore the Ornith
inference service, and enforce a 72-hour active-compute ceiling. Do not resume the closed GPT-OSS experiment.

## Pinned identities [amended]

- Training checkpoint: `ornith-ai/Ornith-1.5-9B` @ `489cb97981b8654bcfcf30ce1f94ed1b62e07b53`, MIT, BF16,
  18.0 GiB, `Qwen3_5ForConditionalGeneration` *(verified)*.
- Text config *(verified)*: 32 layers (8 full attention, 24 linear attention), hidden 4096, 16 attention heads,
  4 KV heads, head_dim 256, `attn_output_gate: true`, dense SwiGLU intermediate 12288, vocab 248,320,
  untied `lm_head`, 1 MTP layer, vision tower present.
- Template: the 9B's own `chat_template.jinja` (blob `f8cbff56ca…`), not the 35B template (`b07660ccbb…`);
  they differ in tool-argument serialization. `tokenizer.json` blob `5f9e4d4901…` is shared *(verified)*.
- Deployment base: `ornith-ai/Ornith-1.5-9B-GGUF` @ `abdd624b12ebf020b767fff532ff44fe552b28c3`,
  `Ornith-1.5-9B-Q4_K_M.gguf`, sha256 `70c112196e0b7023803c9762752e46d29e612a92c83f995bc3ba1ceb07e8fab6`,
  at `/mnt/mrgr/models/ornith-1.5-9b/` (mergerfs branch `/mnt/nvme1`) *(verified)*.
- Service: `llama-gpu@Ornith-1.5-9B-Q4_K_M`, enabled and active on `127.0.0.1:8089`, API alias
  `Ornith-1.5-9B-Q4_K_M`; `llama-gpu@Ornith-1.5-35B-Q4_K_M` disabled and inactive; unit sha256 `ea65905f…`
  *(verified)*. Unit flags: `--ctx-size 32768 --parallel 1 --fit on --fit-target 1024 --flash-attn off
  --jinja --temp 0.6 --top-p 0.95`.

## Evidence and dataset implementation

- Add a separate experiment workspace under experiments/lora/. Treat evidence/, the September 8 design,
  compatibility receipt, and recovered copies as immutable sources.
- Implement CLI stages for inventory, prepare, feasibility, train, evaluate, report, and resume. Every stage
  writes an immutable manifest with input hashes, configuration identity, outputs, exclusions, and terminal status.
- Inventory experiment manifests, cases, requests, responses, evaluations, and amendments. Deduplicate by
  repository lineage, merge event, focal span, and content hashes. Repeated responses, copied instruments, and
  environment rechecks are not additional independent examples.
- Audit receipt chains and classify records as verified, invalid, incomplete, superseded, or unverifiable.
  Preserve failure information; do not label missing or infrastructure-failed evaluations as incorrect resolutions.
- Build selector examples from parent-derived deterministic candidates only. Historical model-generated repairs
  remain useful diagnostics and future repair-training material; they do not become candidates in this pilot.
- Revalidate admitted training cases with three passing reference runs and at least two compiling, test-rejected
  mutations. Evaluate each distinct candidate under the pinned, offline oracle. Require complete candidate labels
  before assigning a no-valid-candidate target.
- Use content-addressed candidate IDs and the output contract {"choice":"<candidate-id>"} or {"choice":"halt"}.
  Shuffle presentation order with archived seeds. Never include oracle verdicts, historical replacements, or
  teacher reasoning in model inputs.
- Multiple passing candidates [amended]: evaluation scores any passing candidate as correct. The training target
  policy is open decision D2 below; the draft's minimum-content-hash rule is not learnable from the input.
- Preserve lineage, provenance, licensing, boundary ownership, module/GOPATH era, and side-verbatim/blend strata.
  Weight training by case rather than by the number of archived responses.
- Quarantine lift [amended]: the September 8 design quarantines "the existing 60 cases and all historical model
  outputs". Training on the 60 cases is a deliberate deviation and must be named in the dated amendment. They
  remain excluded from all evaluation.

## Ornith-1.5-9B training and deployment [amended]

- Load text-only with `Qwen3_5ForCausalLM` (ignores `^mtp.*` and `^model.visual.*` on load *(verified in
  transformers main)*). Record missing and unexpected keys; fail unless they are exactly the MTP and vision sets.
- Create an isolated, locked Python environment using XPU PyTorch, Transformers, PEFT, and bitsandbytes. Do not
  upgrade system packages. Record resolved dependencies and checkpoint revisions before GPU execution.
  Environment gate first: the existing venv's control run failed at import with `LLVM ERROR: support is already
  registered for analysis: AnalysisName(PointerFlowAnalysisResult)` (likely two LLVM/SYCL runtimes in one
  process; unverified). No later stage runs until an import-only control passes.
- Put `HF_HOME` and all caches under `/mnt/mrgr/ornith-lora`; `/home` has 2.6 GiB free *(verified)*.
- Inventory gate (no GPU): instantiate on the meta device with the NF4 config; record parameter counts by module
  type, dtype and quantization state, and projected device memory. Known components *(verified from config)*:
  embeddings and untied `lm_head` are 1.017B params each and stay BF16 (about 1.9 GiB each). Fail if the projection
  exceeds 16 GB minus 1 GiB headroom.
- Use one initial recipe: NF4 quantized frozen base, BF16 compute, attention q_proj/v_proj adapters, rank 8,
  alpha 16, dropout 0.05, microbatch 1, gradient checkpointing, AdamW, learning rate 1e-4, 5% warmup,
  seed 20260908. Gradient accumulation and epochs: open decision D1.
- Adapter targets: regex `^model\.language_model\.layers\.\d+\.self_attn\.(q_proj|v_proj)$`; require exactly 16
  modules (8 full-attention layers × 2). Plain `q_proj`/`v_proj` would also match `mtp.layers.0.self_attn.*`
  *(verified)*. Exclude vision, MTP, MLP and linear-attention modules. Derived adapter size: q 4096→8192 (gated),
  v 4096→1024; about 1.1M trainable parameters.
- Supervise final answers only, with token-level masking checks. Do not manufacture reasoning traces. Tokenize
  complete examples and reject unsupported lengths explicitly; never truncate candidates, boundaries, or targets
  silently.
- Compute the LM head only at supervised positions (`logits_to_keep` index tensor *(verified API)*). Full-vocab
  logits cost 248,320 × T × 4 bytes (7.6 GiB at T=8192); treat full-sequence logits as a feasibility failure.
- Record the implementation actually used for `causal_conv1d_fn`, `causal_conv1d_update`,
  `chunk_gated_delta_rule` and `fused_recurrent_gated_delta_rule` (hub kernel vs torch fallback) and the SDPA
  backend. A fallback is allowed only if recorded before timing.
- Feasibility progresses through the import control, a tiny XPU backward/update control, 9B adapter updates,
  save/reload, and deployment equivalence. Probe lengths 512 and 2048, followed by actual example lengths. Permit
  the documented 1024-length diagnostic fallback, without treating it as permission to truncate real data.
- No CPU offloading of model weights. Host RAM ceiling for the process 48 GiB; require at least 16 GiB
  MemAvailable before GPU stages. Reject nonfinite gradients, silent device changes, or an estimated schedule
  exceeding the compute budget. No alternate model beyond this amendment and no paid cloud fallback.
- Prove adapter export and loading before full training: `convert_lora_to_gguf.py` from the fork (the converter
  registers `Qwen3_5ForConditionalGeneration` *(verified)*), then `llama-server --lora` on SYCL. Failure of this
  gate terminates the pilot.
- Base conversion through the identical path is affordable for 9B: checkpoint 18 GiB, BF16 GGUF about 17 GiB,
  Q4_K_M about 5.4 GiB, against about 116 GiB free on `/mnt/mrgr`. Convert the base identically and record its
  difference from the pinned official Q4_K_M. Evaluate base and adapter on the same converted base.
- Run only the rank-8 pilot recipe. Rank-16 tuning, three training seeds, and generated-repair/format-control
  experiments remain subsequent stages.

## Evaluation and reliable execution

- Freeze the historical exposure ledger before acquisition. Select 24 fresh lineages, six per
  side-verbatim/blend × module/GOPATH cell, excluding training and previously inspected lineages.
- Bound acquisition at 100 screened repositories or 200 screened events, whichever occurs first. Do not replenish
  cells based on Ornith outcomes. If the target cannot be admitted, report insufficient evaluation data and any
  available results descriptively.
- Evaluate base and adapter on identical candidate sets, with three paired decoding repeats per case: 144
  scheduled requests. Use fresh conversations, deterministic shuffled order, and archived seeds.
- Thinking mode [amended]: render training examples and send evaluation requests with `enable_thinking=false`
  (empty `<think>\n\n</think>` block *(verified in the 9B template)*). This matches final-answer-only supervision.
  Any other choice must be identical in training and evaluation.
- Sampler [amended]: capture the complete effective sampler from the base server's `/props` (the 35B server
  showed `top_k` 20 and `min_p` 0.05 in addition to temperature and top-p *(verified)*). Send every field
  explicitly per request, with temperature 0.6, top-p 0.95 and a per-repeat seed, identical for both conditions.
- Reserve 4,096 output tokens and a 256-token guard within the verified 32,768-token context. Use identical
  decoding and strict final-JSON validation for both conditions.
- Serving for evaluation [amended]: the systemd unit has no `--lora` option. Run base and adapter as transient
  llama-server processes with the unit's exact flags plus `--lora` for the adapter arm, on the same converted base.
- Inference budget estimate [amended]: a same-architecture 9B Q4_K_M on this A770 measured pp512 1,496 and tg128
  29 tok/s, and pp512 1,352 and tg128 27 at 8K depth; the 9B service produced 25.9 tok/s. A worst-case request
  (28.4K prompt + 4,096 output) is therefore about 3 minutes, and 144 requests about 7 hours, before LoRA overhead.
  Budget from the measured prompt-length distribution.
- Report unconditional correct-selection yield, incorrect selections, halts, malformed/truncated outputs,
  candidate availability, per-cell results, and paired lineage-level uncertainty. Average repeats within cases,
  then apply equal cell weights. This small pilot supports exploratory findings about the 9B selector, not
  confirmation, production-safety claims, or claims about the 35B model.
- Before training, verify `llama-gpu@Ornith-1.5-9B-Q4_K_M` is idle, save its configuration, active and enabled
  state, acquire an exclusive experiment lock, and stop it. Restore the prior service state on success, failure,
  timeout, or cancellation. Use separate adapter aliases and preserve the original model files (both 9B and 35B
  GGUFs).
- Enforce the 72-hour cumulative compute budget across feasibility, training, oracle work, and inference.
  Checkpoint training and atomically persist attempt records. Resume only from matching artifact/configuration
  identities.
- Emit heartbeat and progress records every minute. Detect stalled stages, persist the failure, and notify through
  system logs and the local desktop when available. Allow at most three infrastructure recovery attempts within 30
  minutes; otherwise terminate visibly and restore the service. Never retry a valid model failure to obtain a
  better answer.

## Open decisions (block the train stage only) [amended]

- D1, schedule. With at most 60 admitted cases, microbatch 1 × accumulation 16 × 1 epoch gives at most 4
  optimizer steps, and 5% warmup rounds to zero. Either (A) keep it and label the run pipeline-only with no
  efficacy readout, or (B) pre-register accumulation 4 × 3 epochs (about 45 steps). Recommendation: B.
- D2, multi-correct training target. Either (A) the first passing candidate in presented order, or (B) exclude
  multi-correct cases from the loss. Recommendation: A.

## Tests and acceptance

- Test deduplication, lineage separation, receipt tampering, superseded records, missing labels,
  multi-correct/no-correct candidate sets, ID collisions, and candidate-order permutations.
- Test prompt leakage prevention, exact boundary application, final-answer loss masking, oversized inputs,
  malformed outputs, and inference-budget accounting.
- [amended] Test the template hash, `enable_thinking=false` rendering, the adapter target count (16), the
  missing/unexpected key sets, `logits_to_keep` positions, and the sampler field set sent per request.
- Verify adapter updates, unchanged frozen weights, disabled-adapter equivalence, reload, export, and deployment
  behavior on synthetic fixtures.
- Inject server restarts, interrupted writes, evaluator timeouts, duplicate resume attempts, configuration drift,
  and budget exhaustion. Verify service restoration and conspicuous terminal status.
- Deliver the audited dataset manifests, executable harness, feasibility report, trained adapter and evaluation
  report if gates pass, or a reproducible failure report and reusable prepared data if they do not.
- Preserve the September 8 documents as historical design. Add a dated Ornith amendment recording these choices,
  the 35B infeasibility arithmetic, the quarantine lift and evidence limits; do not rewrite old results or claim
  that successful inference proves trainability.

## Implementation decisions recorded before training

- Source amendment SHA-256: `7e21ff3d7ea0cc453579b9a0a7a7ef4bb19cfffd1bf45a67df8ee0ec014cc6c4`.
- D1: accumulation 4, 3 epochs, 5% warmup rounded up to at least one step. Actual update count depends on admitted examples and epoch-end accumulation handling.
- D2: first passing candidate in shown order for training; any passing candidate receives evaluation credit.
- Local text-only class audit corrects the proposed module prefix: `^model\.layers\.\d+\.self_attn\.(q_proj|v_proj)$` matches exactly 16 modules. The multimodal `model.language_model` prefix does not apply to the instantiated text-only class.
- Environment diagnosis: isolated imports fail with default OpenCL discovery but pass when `OCL_ICD_VENDORS` points at the existing Intel-only vendor directory. This isolates the triggering configuration; it does not identify the individual conflicting library. No system driver files were changed.
- Metadata coverage is a prerequisite, not evidence of successful model loading, training, or export.
- GPU stage environment now explicitly pins `ONEAPI_DEVICE_SELECTOR=level_zero:0` and `OCL_ICD_VENDORS=/home/svnbjrn/.local/share/opencl-vendors-intel-only`; both values are stored in each GPU execution manifest and probe receipt. The probe verifies the selected device is the A770 rather than trusting its ordinal. The exact combined environment passed an import-only systemd control.


## September 15 full-model feasibility execution

All 60 archived cases passed fresh oracle revalidation. No historical model outcome was used as an
independent training case. With the previously frozen 4,096-token training limit, 57 complete examples
fit and three are explicitly excluded; no source or target is truncated. The three-epoch schedule
therefore has 45 updates, with accumulation four and a final partial group each epoch; warmup is three
updates. This does not enlarge or unquarantine the evaluation frame.

The pinned text-only model loaded on the A770 with no missing, unexpected or mismatched text keys.
The full model completed 512- and 2,048-token synthetic updates and a 3,757-token real-example update.
Peak PyTorch device allocation was 11,823,923,200 bytes. All frozen parameter hashes remained unchanged,
the LoRA parameters changed, disabled-adapter logits matched the base, and save/reload logits matched
exactly on the diagnostic input. These are feasibility checks, not utility estimates.

Two execution repairs are recorded in separate failed-attempt receipts: disable Transformers' optional
single-buffer allocator warmup, which XPU rejected before loading any weights; and serialize loading
report sets as sorted arrays. Actual NF4 allocations, BF16 compute, adapter targets, and device placement
are unchanged. No model weights are offloaded to CPU.

Runtime profiling observed the PyTorch causal-convolution and chunked gated-delta-rule fallbacks in all
24 linear-attention layers, and the overrideable fused SDPA operation. These paths are recorded in
`check-kernel-calls.json`; no optimized kernel availability is inferred from package imports.

Artifacts are under `/mnt/mrgr/ornith-lora/runs/9b-training-2026-09-15/`. The implementation scripts live in
`experiments/lora/`; completion is determined by the run receipts, not by this planning document.


Deployment feasibility subsequently passed: the updated adapter converted to a 32-tensor GGUF and
loaded in the installed SYCL llama-server alongside the newly converted Q4_K_M base. Enabled and
disabled requests completed, and two disabled-scale replays matched. The new base differs from the
official GGUF; later comparisons must use this same converted base for both arms. This smoke test
does not establish quality equivalence between NF4 training and Q4_K_M inference.

Training was launched as `mrgr-lora-9b-training-20260915.service` after both gates passed. Its manifest
pins code, configuration and data; it writes each optimizer-step checkpoint and has a two-hour native
systemd limit, a 48 GiB host-memory ceiling without swap, terminal failure recording, local notification,
and restoration of the original 9B service. Training completion is recorded separately in
`training-result.json`; launching it is not a successful-training or efficacy claim.

## 2026-09-15: one instrument-repair revision (frozen before new inference)

The first fresh acquisition is **INCOMPLETE (instrument)**, not a model-quality
null or evidence that admissible fresh cases do not exist. Its five detailed
receipts are preserved; the new run writes an additive correction with their
hashes. Two GOPATH cases lack dependencies, one package has no executable tests,
one requires an unavailable private module, and one targets generated code with
an unresolved localization discrepancy. No fresh model requests were made.
The 100 screened repositories remain acquisition-only exposure, not model
exposure. Training used **57** examples after **three length exclusions**;
45 steps and low supervised loss do not establish selection quality.

The prior deployment smoke used the feasibility adapter. This revision converts
and hashes the final trained adapter, compares base-only with adapter scale zero,
and exercises eight training examples (two per cell, selected by stable hash)
through the real selector path, both conditions once. This is **in-sample pipeline
validation, not efficacy**. Format/quality failures are outcomes, not invitations
to tune the adapter, prompt or sampler. Missing accounting, broken aliases,
context overflow or deployment discrepancies stop execution as INCOMPLETE.

The revised acquisition reuses the pinned Go CSV and compact-repository rules:
created before 2018, below 20,000 KiB, unchanged name exclusions, descending
recorded stars and repository name. Development used multiple deliberate
convenience frames, so this is not an exact population match or a probability
sample. The claim is transfer to this compact-repository frame. A case-bearing
archive establishes development/model inspection; a repository's appearance in
an acquisition list alone does not. Training and inspected lineages, fork roots,
shared reconstruction parents and duplicate conflict contents stay excluded.

There is exactly **one revision**, at most **100 repositories, 1,000 merge
replays, ten events per repository**, ordered by the existing seeded SHA-256.
Every replay counts. The cumulative active-work ceiling remains 72 hours,
including recorded earlier work and the first acquisition's command time.
Generated/vendored/test-only targets and packages without executable tests are
ineligible. Self-contained GOPATH packages are allowed; external dependencies
must be pinned by event-tracked vendor bytes or full immutable revisions in
Gopkg.lock, glide.lock or Godeps. No latest/date-selected substitution is allowed.
The older YAML dependency reconstruction explicitly did not establish its
original CI pin and is not reused as historical proof. Unsupported workspaces
remain explicit instrument incompleteness; nested modules use their own module
root. All oracle execution remains offline and requires the unchanged three
reference passes and two compiling, behaviorally rejected mutations.

Allocation remains 24 independent lineages: six each in side-verbatim/blend ×
module/GOPATH. Freeze allocation and candidate labels before fresh inference.
Any cell shortfall is **INCOMPLETE**, with cell counts and causes, without
reweighting, a reduced primary frame, another acquisition round or cross-validation.

Capture the actual 9B `/props` sampler: top_k **40** (not the earlier 35B's 20),
temperature 0.6, top_p 0.95, min_p 0.05, full sampler order and inactive penalties.
Send settings explicitly, with no-thinking mode, 4,096 output tokens, paired
seeds, balanced order and no prompt-cache reuse. Both conditions use the same
converted base; the final adapter scale alone changes. Freeze requests and
provenance. A full frame runs 144 attempts, scores any oracle-passing candidate
as correct, reports abstention/format/incorrect-selection/missingness separately,
and uses paired lineage bootstrap uncertainty. Persistent infrastructure faults
are missing observations, never a quality null. No model-outcome retries;
at most one identical-input infrastructure retry with server restart.

Entry point: `python3 experiments/lora/revision.py start RUN_DIRECTORY`.
A native systemd unit enforces the remaining deadline, memory limits, terminal
receipts and ordinary-service restoration even if the worker fails. The run
freezes input hashes before execution. No change reopens the retired Phase 3 gate.
