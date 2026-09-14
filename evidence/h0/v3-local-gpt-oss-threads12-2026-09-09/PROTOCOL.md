# GPT-OSS high-effort, 12-thread comparison, 2026-09-09

Fresh exploratory experiment: 60 existing Go cases, 34 repository lineages, two conditions (hunk-only and candidates-structural), 12 repeats each = 1,440 requests. This replaces the drained medium-effort run operationally; that run remains an incomplete diagnostic dataset. Historical Mercury/MiniMax comparisons are descriptive, not controlled estimates of model superiority. No confirmation or MEASURABLE=YES is authorized by these results.

## Frozen inference profile

Same Unsloth GPT-OSS-20B Q4_K_M weights and installed Vulkan executable. Model, executable, mapped libraries, driver information and effective service command are recorded in runtime-manifest.json. The binary reports b1-1717187; its source-to-binary Git provenance is unresolved. We pin the executable rather than inventing a verified source commit.

GGML_VK_VISIBLE_DEVICES=1 selects the tested A770. LLAMA_ARG_CTX_SIZE=32768 and LLAMA_ARG_N_PARALLEL=1 allocate one slot. CLI pins 99 GPU layers, batch 2048, microbatch 512, generation/prompt threads 12/12, flash attention auto, K=q8_0 and V=f16. Raw Harmony uses LLAMA_ARG_SKIP_CHAT_PARSING=1 plus --special. TZ=UTC and TMPDIR=/tmp are explicit. The actual GGUF template is frozen to 2026-09-08. Both the server CLI and request chat_template_kwargs set reasoning_effort=high, verified in the system header. Requests also retain the top-level high field.

Temperature 1, top_k 0, top_p 1, min_p 0, sampler list [temperature], neutral penalties, max_tokens 16384. No grammar, schema-constrained decoding, stop strings, forced final, output repair or LoRA. Request cache_prompt=false; server cache RAM/reuse 0, fit off, no context shifting, reasoning budget -1. Client deadline 1800 seconds, server timeout 2100 seconds. These settings differ from the historical medium/.75 profile and are not pooled with it.

All 120 distinct prompts must satisfy templated tokens + 16384 + 256 <= 32768. Audit uses the running server's template and tokenizer, with a live usage cross-check. A synthetic long-prompt/full-16384-output probe must finish within 600 seconds. Only that probe uses ignore_eos=true. It is never scored. Same-input/same-seed replay after unrelated work and a server restart records numerical nondeterminism rather than promising byte identity.

## Design and scoring

Reuse exact messages, candidate lists, schemas, replacement boundaries, oracle, and case IDs from v3-mercury-final-2026-09-07. No oracle feedback reaches inference. The reviewed pack schedule deterministically shuffles case/repeat pairs, shares seeds within each pair, and balances first condition 6/6 within every case. The protocol digest, seed and complete request are bound to each attempt identity. No resampling after seeing output.

Retain the existing tested single-final Harmony extractor, including optional JSON-constrained final headers. Never salvage analysis or choose the last of multiple finals. Truncation, malformed output and abstention remain non-successful model outcomes. Valid resolutions undergo the same immutable-snapshot behavioral oracle; build failure and test failure remain separate. Oracle correctness means only the tested behavior, not general semantic equivalence.

The sandbox, offline dependencies, toolchain and existing 120-second build/test command deadlines are unchanged. The oracle builds test binaries and directly runs them, so it does not reuse successful go-test result-cache entries. Three passing reference receipts and at least two compiling rejected mutants per case are reused only after protocol, artifact, tree and environment verification.

Every request retains raw body, parsed response, exact request/hash, HTTP status, finish reason, usage, seed and monotonic duration. Usage must contain valid integer prompt/completion/total counts; missing usage is not zero cost. Atomic receipts and exclusive locking protect resumption. A started request without a response is retained as an unknown infrastructure outcome and is never silently resent. No automatic retries. Infrastructure failures stop the incomplete run and create FAILURE.json; they do not establish model inability. SIGTERM or run/DRAIN drains the current attempt before stopping. A minute watchdog reports an inactive unfinished service or 40 minutes without progress; it requests a graceful stop for stalls.

Full completion is required for the primary aggregate. Report incomplete planned/completed/missing counts without labeling missing responses model failures. Average per-case repeat fractions and paired differences; retain the four prespecified parent-verbatim/blend × module/GOPATH cell weights of 0.25, lineage-cluster intervals, repeat yield SD, strata and failure categories. Repeats are not independent repositories. No best-of-12 oracle selection. Any revised sampling/quantization/grammar/LoRA configuration is a new experiment.

## Operations

Service: mrgr-gpt-oss-threads12-benchmark.service (user unit). Watchdog: mrgr-gpt-oss-threads12-watchdog.timer. Progress: run/state.json and journal. Failure: FAILURE.json. Completion: run/aggregate.json and FINDING.md. prior-run-disposition.json preserves the drained earlier run's identity and receipts. Current runtime evidence and acceptance probes are frozen before the first scored request.

### Capacity calibration record

The first synthetic probe used 12,081 prompt tokens, substantially above the largest actual prompt (9,316), and completed all 16,384 output tokens in 608.47 seconds. It passed generation/capacity but missed the provisional 600-second performance threshold. Its original script, log and response are retained as oversize-* artifacts. The acceptance probe uses a synthetic prompt at least as large as every actual condition, with the same full output cap; the original threshold remains unchanged. No corpus outcome informed this workload correction.

The server still creates internal sliding-window checkpoints despite cache_prompt=false/cache RAM 0; those settings do not mean no internal checkpoint allocation. The live stress receipt reports zero cached prompt tokens. Startup logging at the installed build's normal verbosity does not expose resolved Flash Attention kernels or exact layer/individual KV buffer counts; auto is the requested setting, not independently certified activation. GPU-resident allocation and successful full-capacity execution are measured separately.

The workload-sized probe passed: 9581 input tokens + 16,384 generated tokens in 587.31 seconds. This is a capacity/latency result, not a merge-quality result.

Replay validation: the same synthetic prompt/seed produced identical raw content after unrelated generation and after a server restart; all 120 case-prompt hashes were unchanged. This small check is not a guarantee of GPU determinism across all cases or future environments.

## Transport amendment before any scored outcome was observed

The first high-profile attempt ended at 300.715 seconds with no HTTP headers or body while the server continued generating. Installed Node 25.1.0 bundles undici 7.16.0 with a 300-second default headers timeout. The original exception cause was not retained, so the diagnosis combines the timing and installed-source evidence. The failed receipt, protocol and source remain in v3-local-gpt-oss-high-2026-09-08. Its outcome and token usage are missing, not zero or model failure.

This fresh run uses native Node HTTP for completion requests, retaining the same 1,800-second absolute deadline and all model/prompt/sampling/oracle settings. The dedicated server was restarted to terminate orphan generation before resubmission. This is one explicitly recorded infrastructure recovery of the first slot; no model answer was observed or selected. The new run does not silently overwrite or pool the missing attempt. No automatic retries are introduced. Existing Python-client capacity/replay checks remain applicable to the unchanged inference profile; separate native-client deadline and response tests are recorded.

## User-directed thread change

On 2026-09-09 the user requested a service restart with threads=12. Both generation and prompt threads are 12. This is a fresh 1,440-request grid with the same paired schedule and seeds; the drained six-thread grid is preserved separately and is not pooled into the primary aggregate. The original date-frozen template remains 2026-09-08. Changes affect configuration identity, not corpus, prompts, sampling, output cap or oracle.

Capacity and restart/replay receipts copied from the six-thread profile remain explicitly six-thread calibration evidence. At 12 threads, verify startup thread counts, all prompt hashes, live request parameters and a smoke response. The full-capacity six-thread probe is reused as memory/context evidence; its latency and byte-repeatability measurements are not new measurements at 12 threads. First new-grid receipts supply new timing evidence.
