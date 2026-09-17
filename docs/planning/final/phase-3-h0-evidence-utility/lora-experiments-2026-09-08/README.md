# Merge-resolution LoRA experiments — design, 2026-09-08

**Recommendation:** first test a small adapter for choosing among mechanically generated resolutions. Separately test whether an adapter improves generated repairs beyond formatting improvements. The A770 supports the relevant general training ecosystem; GPT-OSS-20B training on this exact 16 GB machine remains unverified. Do not confuse a working Vulkan inference server with a working XPU training stack.

Status: experiment design and read-only compatibility audit complete; no training, acquisition, cloud job, dependency installation, GPU probe, or server change performed. This is a new specialization hypothesis, not a route to overturn the closed context studies or change MEASURABLE. The current local benchmark continues independently. Its 60 cases and all other previously examined cases are development evidence, never fresh confirmation.

## Hardware finding

The adjacent [compatibility receipt](compatibility-receipt.json) records PCI identity, OS, installed package metadata, local quantizer source and hashes, source documentation, and the running benchmark/service state. Inspection did not import torch or initialize XPU.

| Layer | Evidence | Conclusion |
|---|---|---|
| Hardware | PCI 8086:56a0 identifies Arc A770; existing serving record identifies 16 GB A770 | Suitable hardware class for XPU; training memory not measured |
| OS | Arch Linux, custom 7.1.3 kernel | Not the Ubuntu configuration recommended by Unsloth; driver/runtime compatibility still needs a smoke test |
| PyTorch | Installed 2.13.0, `torch/version.py` includes `xpu='20260000'` | XPU-enabled build metadata, not proof of successful device execution |
| PEFT / Transformers | Installed development versions 0.19.2.dev0 / 5.13.0.dev0 | Exact revisions must be pinned in an isolated future environment |
| Training dependencies | TRL, bitsandbytes, Unsloth, kernels absent from inspected system Python | This Python environment is not ready; other environments were not exhaustively searched |
| General 4-bit training | bitsandbytes support table includes Arc A-Series with QLoRA and 8-bit optimizers | General A770 support documented [1] |
| Unsloth Intel | Official Intel installation guide and QLoRA example | An Intel path exists; its example is Qwen, not a measured A770 GPT-OSS run [2] |
| GPT-OSS MXFP4 | Installed Transformers quantizer accepts XPU inference but `is_trainable` returns false and recommends BF16 dequantization | Standard installed MXFP4 training path is a concrete blocker; inference support does not fix it |
| Optimized GPT-OSS training | Unsloth reports 14 GB operation and recommends 16 GB | Model-level feasibility claim, not verified capacity on this A770 or at our sequence lengths [3] |

A 21-billion-parameter BF16 base alone is approximately 42 GB decimal, before activations, adapters and optimizer state. It cannot be fully GPU-resident on 16 GB. Expert sparsity reduces active computation, not the requirement to store all expert weights. CPU offload is a separate, likely slower experiment, not an automatic fallback. The existing Q4_K_M GGUF is an inference artifact, not the training checkpoint.

**Compatibility verdict:** general A770 LoRA/QLoRA is documented; this exact GPT-OSS-20B training-and-export pipeline is **UNVERIFIED**, not unsupported in principle and not ready to promise. The installed generic MXFP4 route is **NOT TRAINABLE**. Neither general Intel support nor advertised NVIDIA-sized memory figures establish their intersection.

## Experiment 0: hardware and deployment feasibility

Run only after the current benchmark process has exited and its terminal receipts have been checked. Do not stop or reconfigure its server automatically. Use a separate environment, scratch/output directories and model alias; never upgrade system packages. Avoid large downloads and disk-heavy environment builds while the benchmark is running.

1. Pin a mutually compatible XPU PyTorch / Triton / Unsloth / Transformers / PEFT / bitsandbytes stack from the Intel instructions. Record wheels or commits, drivers, device identity and package lock. Do not assume the current newest versions compose correctly.
2. Verify XPU discovery, then a tiny BF16 forward/backward/AdamW step. Select the A770 explicitly. Use BF16 without GradScaler; PyTorch documents an Arc A-Series FP64 limitation for GradScaler [4]. Fail on CPU fallback or missing gradients.
3. Run a tiny dense-model 4-bit LoRA test to separate backend problems from GPT-OSS expert/kernel problems. This is a compatibility control, not evidence about merge quality.
4. Load the pinned GPT-OSS training checkpoint through the supported optimized path. Abort on silent BF16 expansion/offload. Begin with rank 8 on attention `q_proj` and `v_proj`, microbatch 1, checkpointing, no cache, sequence length 512. Assert only intended adapters train, frozen base remains unchanged, gradients/loss are finite, and adapter weights actually update.
5. Test 20 measured steps after warmup at 512, then 2048, then the actual longest complete training example. Record peak allocated/reserved/device memory, host RAM, tokens/second and step-time distribution. Allow one predetermined reduction from 2048 to 1024 for the feasibility probe only. An OOM or unsupported kernel then ends the local attempt. A reduced-length pass does not authorize truncating real examples.
6. Overfit eight synthetic fixtures, save/reload the adapter, verify changed predictions survive reload. Zero-initialized/disabled adapter must reproduce the base within a tolerance fixed from repeat numerical checks. These fixtures are plumbing controls only.
7. Prove export before collecting hundreds of training labels: evaluate the same fixtures before and after adapter conversion/deployment, preserve weight and template hashes, compare logits where available, deterministic answers and oracle outcomes. Do not assume GPT-OSS expert adapters convert to GGUF just because ordinary LoRA does. Prefer attention-only targets initially; expert tensors need PEFT `target_parameters` support [5]. If merging/requantizing is necessary, export the base through the identical pipeline as the comparator.

Feasibility passes only if the real example lengths fit without offload, training updates adapters, reload works, and deployment preserves the intended behavior. Require at least 1 GiB measured VRAM headroom as an engineering margin. Otherwise report LOCAL INFEASIBLE FOR THIS RECIPE. A cloud GPU is a documented alternative after a separate small smoke test; no paid job is part of this design task. A smaller dense model is a different experiment, not a substitute result for GPT-OSS.

## Shared data contract

Population: oracle-admissible public Go merge conflicts, one event per repository lineage in the fresh evaluation frame. Claims concern this buildable/testable population, not all Git merges. Keep C and other languages for a separately designed external replication.

Before acquisition, create a lineage/fork/clone map and an exposure ledger. Exclude every previously inspected development lineage from fresh validation and confirmation; quarantine the existing 60 cases and all historical model outputs. Split lineages before extracting hunks, generating variants, producing labels or selecting examples. Keep duplicate patches, shared ancestry and near-duplicate code in a single split. Pin source commits, licensing/provenance, retrieval date, build recipes, target spans and all transformations. Public data may already be in model pretraining; lineage isolation prevents our own leakage but cannot prove pretraining cleanliness.

Record these strata at first screening, including rejected cases: side-verbatim versus blend; module-era versus GOPATH-era. Define side-verbatim using exact reference/parent bytes before any model runs. Freeze four equal target weights (0.25 each). Never replenish a weak cell based on model outcomes. Track failures, absent scaffolds, package/build failures and repository yield with denominators. Reuse the corrected canonical GOPATH cwd and current boundary/candidate code by pinned revision, never the historical broken path.

Begin with a bounded development target: 200 independent training events, expandable once to 800, plus 120 validation events (30 per cell) from separate lineages. These are targets, not claims of existing supply or adequate power. Stop the first feasibility acquisition after 100 newly eligible repositories or 200 screened events, whichever comes first; report actual yield and revise feasibility explicitly if supply is inadequate. No indefinite rounds to obtain a positive signal. These acquisitions are planned, not started here.

Each admission requires three passing reference executions plus at least two compiling, test-rejected mutations under the unchanged oracle. Parent-derived input and evaluator-only reference/scaffold remain separate. Generate training labels offline from the oracle; never expose reference, test verdicts or future merge information in solver inputs. Historical text is one validated target, not a complete definition of correctness.

## Experiment 1: candidate-selection adapter (primary first experiment)

Question: does merge-specific supervised training increase the number of correct selections from a fixed candidate set?

Use the current parent-derived structural candidate generator, with deduplication and source identifiers. For this new experiment, freeze a narrow output schema: candidate ID or `halt`; resolve an ID to exact candidate bytes in code. Neither arm emits replacement code. This removes syntax emission as the principal source of arm differences. It measures selection, not general repair.

Compare the same base checkpoint with adapter disabled versus the trained selector, same candidate bytes/order, boundary contract, reasoning effort and sampling budget. Include deterministic keep-ours/keep-theirs/union/structural actions descriptively. Score them under the same oracle. Report candidate-set oracle availability separately: it is a ceiling and a diagnostic, never a competitor the model must beat.

Training targets: evaluate every candidate. If several pass, select one using a frozen hash-based tie rule independent of candidate position; randomize candidate order using archived seeds. Include no-pass sets with `halt` labels. Retain natural no-pass prevalence in validation/test; any deliberate training balancing must be recorded. Never label a merely untested candidate as incorrect. Check candidate-order permutations on development data.

Primary endpoint: correct selections / all scheduled cases. Halts and malformed IDs are non-passes. Also report incorrect selection rate over all cases, abstention, precision among selections, and accuracy conditional on a passing candidate existing. This conditional statistic is diagnostic; it cannot replace the unconditional primary endpoint.

## Experiment 2: generated repair and formatting control (separate follow-up)

Question: does training improve behavioral repair beyond learning the response/splice format?

Three weight conditions: base; formatting-only adapter; semantic-repair adapter. Evaluate each under both hunk-only and the frozen candidate/context prompt: a 3×2 design. All conditions receive the same boundary information and have the same output schema, tokenizer limits, sampling policy and oracle. This factorial design estimates adapter benefit separately from context benefit and their interaction.

Formatting-only training uses synthetic non-project fixtures with known exact replacements, balanced parent-copy and blend examples, boundary cases and response serialization. Semantic training includes that fixed formatting block plus genuine oracle-validated merge targets. Match total update counts/token budget across the two adapters by a prespecified sampling rule; document the residual difference in training content. The control diagnoses format learning, not perfect mediation of syntax versus semantics.

Report primary unconditional behavioral yield, compile rate, parse/format errors, truncations and tests-passed-among-compiling as a secondary diagnostic. Do not condition the primary analysis on compiling. Never mechanically repair test candidates using reference delimiter balance. No judge-only semantic credit and no adaptive retry loop.

For a semantic-learning claim require the semantic adapter to outperform both base and formatting-only control on the prespecified candidate/context condition. The hunk-only contrast and interaction are secondary. This experiment needs its own registered family and power assessment; a positive selection experiment does not prove generation improvement.

## Training recipe and selection budget

Initial recipe: rank 8, alpha 16, attention q/v only, dropout 0.05, BF16 compute, gradient checkpointing, microbatch 1, accumulation 16, AdamW on adapters, learning rate 1e-4, warmup 5%, one epoch, fixed seed 20260908. This is a proposed conservative recipe, not a tested A770 configuration. Inventory exact module names/trainable tensors before execution; `all-linear` alone may miss MoE expert parameters [5].

Use the model's pinned Harmony template; verify loss masking includes only intended assistant target tokens. Do not invent reasoning traces from historical replacements. Freeze final-answer-only supervision and document that choice; evaluate with identical reasoning instructions across base and adapter. Tokenize complete examples before training, recording prompt and completion lengths. Never silently truncate a label, conflict, candidate or boundary. If examples exceed the feasible maximum, narrow the training population explicitly before training; keep evaluation-length coverage and exclusions visible.

Permit only two development recipes: the initial recipe, then rank 16/alpha 32 with everything else fixed. Choose on validation behavioral yield with a fixed tie in favor of rank 8. The 200→800 learning-curve expansion is the only data expansion allowed. No test-driven hyperparameter search. Record all attempted recipes, failures and compute. After selection, train the chosen recipe at three fixed seeds (20260908–20260910); report all three rather than the best seed.

## Inference, uncertainty and terminal decisions

Freeze the chosen deployed quantization before new model outcomes. Base and adapter must share the export path, quantization, prompt and budget. The running Q4_K_M study and commercial-model results are historical descriptive context, not contemporaneous adapter controls.

On validation use three stochastic repeats at temperature 0.75 per training seed and case, with paired inputs and archived randomized order. Base also gets three repeats; reusing its observations across seed contrasts creates dependence that the analysis must retain. Average within case and across all three trained adapters for the main contrast. State that this estimates the average of these trained adapters, not all future training seeds. Report seed and decoding variability separately; nine outputs are not nine independent cases.

Proceed to a fresh confirmation design only if development mean gain exceeds +5 percentage points, none of the three seed-specific means is negative, and incorrect-selection rate has not increased by more than 2 points. Failure ends this recipe family as NO PROMISING DEVELOPMENT BENEFIT; do not acquire again in response. These are development decisions, not significance claims or proof that benefit is impossible.

For fresh confirmation, use the four fixed weights, one case per independent lineage, and paired base/adapter case means. Freeze a simulation-validated stratified inference procedure before dispatch. Test null, positive, heterogeneous-cell, seed-noise, and zero-variance scenarios; preserve simulated coverage and power. Duplicate-arm and planted-advantage controls test accounting/inference, not absence of prompt confounds. Use appropriate resampling of lineages within cells; retain all repeats/seeds of a lineage together. A deficient cell or unvalidated interval means confirmation is not ready.

Evidence standard for the primary selection claim: the 95% lower confidence bound for weighted behavioral gain exceeds +5 points, and the 95% upper bound for increased incorrect-selection rate is below +2 points. This defines a narrow utility claim under the oracle, not production safety. Requiring both is an intersection decision. Experiment 2's two superiority comparisons need simultaneous or multiplicity-adjusted intervals within its own family. Secondary cells/context interactions remain descriptive unless separately powered and registered.

Sample size is not chosen by repeating 60 cases. As a rough independent-pair planning calculation, with true gain 10 points, floor 5 points and discordance q=0.2–0.4, n ≈ (1.96+0.84)^2 × (q−0.1^2)/(0.1−0.05)^2 = 596–1224 independent pairs. This is an approximation, not a power certificate; four-cell heterogeneity, the incorrect-selection guardrail and seed variability can require more. Set a maximum confirmation frame of 1600 independent lineages, 400 per cell. Estimate nuisance parameters from validation only and simulate both success conditions jointly. If 80% power is not achievable within that cap, report CONFIRMATION INFEASIBLE AT THIS BUDGET; do not pretend more decoding repeats solve corpus scarcity.

At the fixed endpoint: SUPPORTED only if both primary bounds pass; NO PRACTICALLY IMPORTANT BENEFIT if the gain upper bound is at most +5 points; otherwise INCONCLUSIVE. Invalid instrumentation or infrastructure is INCOMPLETE/INVALID, never a quality null. Retain every scheduled output; truncations, invalid answers and halts are non-passes. Preserve transport failures and stop infrastructure outages without silently retrying or dropping rows; no complete-study claim until its preregistered missingness treatment is satisfied. Do not peek at confirmation outcomes to extend sample size or switch models.

## Cost and sequencing

The current local inference estimate implies evaluation may cost more wall time than adapter training. Selection's short final output does not guarantee short reasoning. Measure actual length/throughput after the current run, then estimate training hours from measured tokens/second and evaluation hours from measured request plus oracle time. Include failed recipes, all seeds, reference/mutation admission, export and storage; no invented dollar quote or training-duration promise.

Order: finish existing benchmark → isolated backend/model/export feasibility → bounded split-safe development acquisition → selector learning curve → terminal development decision → only then a powered fresh confirmation. Design generation/format-control work as a separately declared follow-up. No ongoing phase or server depends on making the adapter experiment positive.

## Primary sources checked 2026-09-08

1. [bitsandbytes supported hardware table](https://github.com/bitsandbytes-foundation/bitsandbytes/blob/main/README.md): Arc A-Series XPU, 4-bit QLoRA and optimizer support. Full fetched source retained in compatibility receipt.
2. [Unsloth Intel training guide](https://unsloth.ai/docs/get-started/install/intel): Intel installation and QLoRA path, with Qwen example. Generic support is not a GPT-OSS/A770 performance measurement.
3. [Unsloth GPT-OSS fine-tuning tutorial](https://unsloth.ai/docs/models/gpt-oss-how-to-run-and-fine-tune/tutorial-how-to-fine-tune-gpt-oss): optimized model training and memory guidance; validate independently for this hardware.
4. [PyTorch Intel GPU guide](https://docs.pytorch.org/docs/stable/notes/get_start_xpu.html): XPU training and Arc GradScaler limitation. Live documentation can differ from installed versions.
5. [PEFT LoRA reference](https://huggingface.co/docs/peft/main/package_reference/lora): adapter targets, zero-initialization and MoE parameter targeting.
6. [Transformers MXFP4 documentation](https://huggingface.co/docs/transformers/main/quantization/mxfp4): quantized loading. The archived installed `quantizer_mxfp4.py` is the direct evidence for this machine's training prohibition and XPU inference branch; documentation and implementation are not assumed identical.

This document is a proposed protocol with explicit readiness work, not a preregistration receipt or evidence of successful training. Source versions, dataset manifest, actual supported recipe, inference procedure and execution hashes must be frozen before any confirmatory dispatch.

## Existing benchmark status observed during this audit

At 10:12:35 UTC the existing runner stopped under its frozen stop-on-HTTP-error rule. It preserved eight response receipts and seven evaluations (five behavioral passes, two build failures). The eighth response is HTTP 500, with a server parser error containing the generated Harmony header `<|channel|>final <|constrain|>json`. This identifies a response-parsing failure; root cause and repair remain unverified. The service is active/running with zero restarts. No request was retried and no receipt, runner source, service configuration or dependency was changed by this design task. This tiny incomplete run cannot support cross-model quality comparisons. Its stopped state does not by itself authorize using the GPU for training while the benchmark is awaiting disposition.

## September 17 admission correction

[Protocol precedence and unresolved design decisions](ornith-9b-cv-review-clarification-2026-09-17.md).

The [CV protocol](ornith-9b-cross-validation-2026-09-16.md) and subsequent
[conditional control amendment](ornith-9b-control-repair-2026-09-16.md) are both
terminal. [Offline receipt review](../../../../../evidence/h0/ornith-9b-cv-review-2026-09-17/README.md)
finds 72 verified rejections, with 26/57 cases below the two-control gate.
No training, controls or model calls were rerun; continuation needs a new protocol.
