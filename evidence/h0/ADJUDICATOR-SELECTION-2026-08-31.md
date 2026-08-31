# H0 adjudicator selection — 2026-08-31

**Outcome: no change. `Qwen3-Coder-30B-A3B-Instruct-UD-Q3_K_XL` remains the pin.**
Two models that outrank it on public leaderboards were tested and both failed
this harness outright.

## Why this was run

The 2026-08-31 evaluation's null needed the "weak adjudicator" explanation
closed off (see `REVIEW-2026-08-31T00-20-20-074Z.md`). This searched HF
leaderboards for a stronger adjudicator that fits the Arc A770's 14.6 GiB.

## Throughput, Arc A770 via Vulkan, `-p 512 -n 64`

| model | size | params | pp512 t/s | tg64 t/s |
| --- | ---: | ---: | ---: | ---: |
| gpt-oss-20b Q4_K_M | 10.81 GiB | 20.9 B | **1245.5** | 42.7 |
| **Qwen3-Coder-30B-A3B Q3_K_XL** | 12.85 GiB | 30.5 B | 883.7 | **47.5** |
| Qwen3.5-9B Q4_K_M | 5.23 GiB | 9.0 B | 705.8 | 43.1 |
| qwen2.5-coder-7b Q6_K | 5.82 GiB | 7.6 B | 645.8 | 36.3 |
| phi-4 Q4_K_M | 8.43 GiB | 14.7 B | 516.5 | 31.2 |
| Qwen3-Coder-REAP-25B IQ4_XS | 12.43 GiB | 24.9 B | 406.4 | 38.9 |
| Qwen3.8-27B UD-IQ3_XXS | 10.17 GiB | 27.3 B | **68.1** | **7.4** |

Qwen3.8-27B is a *dense* 27B — every parameter is active per token — against
the MoE candidates' ~3B active. 13x slower prefill, 6.4x slower generation. At
7.4 t/s an H0 call needs ~33 s and would risk the runner's 90 s abort.

## Quality, 18 real prompts per model through the actual runner

6 triples x 3 model arms x 1 repeat, grammar-constrained, same frozen corpus.

| model | correct | wrong | halt | **schema_invalid** | fabricated |
| --- | ---: | ---: | ---: | ---: | ---: |
| **Qwen3-Coder-30B-A3B** | **10/18** | 8 | 0 | **0** | 0 |
| gpt-oss-20b | 1/18 | 4 | 4 | **9** | 0 |
| Qwen3.8-27B | 0/18 | 0 | 0 | **18** | 0 |
| qwen2.5-coder-7b (earlier probe) | 8/18 | 6 | 4 | 0 | 0 |
| Ling-Coder-lite (earlier probe) | 3/18 | 1 | 14 | 0 | 0 |

## The finding: leaderboard rank did not transfer

`gpt-oss-20b` tops `LiquidAI/ifstruct-v1.0` at **91.95** — the benchmark that
most directly measures the ability this harness needs, emitting a fixed JSON
schema. It scored **1 of 18** here, with half its records `no JSON object in
response`. `Qwen3.8-27B` failed **every single record** the same way.

Both are reasoning-channel models: they emit their thinking into a separate
response field and leave `content` empty or non-JSON. `_h0_runner.ts` already
carries a comment about exactly this for `reasoning_content`. The grammar
constraint cannot rescue it, because the constrained channel is not the one the
answer arrives on.

`ifstruct` measures structured output in a normal chat setting with a harness
that understands the model's channels. This harness reads
`choices[0].message.content` from a plain `/v1/chat/completions` call. A model
can be excellent at the first and useless at the second.

**Consequence for model choice here: schema-channel compatibility is a gate,
not a score.** Rank candidates on it before looking at any benchmark. The cheap
test is the 18-prompt probe above, which costs about a minute per model.

## Also disqualified, and why

- `ornith-ai/Ornith-1.5-35B-A3B` — 79.0 on SWE-bench Verified at 36B, the most
  interesting result found. Not tested: every quant at Q3 or above exceeds the
  card (IQ3_XXS 14.3 GiB, Q3_K_S 14.9 GiB). It fits only at Q2, and Q2 hits MoE
  models hardest because each expert is individually small. Testing it would
  mean testing a heavily degraded model.
- The `OpenVINO` HF org publishes **no coder models at all** — no Ornith, no
  gpt-oss, no Nemotron, no Qwen3-Coder. Its newest relevant entry is
  `Qwen3.8-27B-int4-ov` (2026-08-14), whose GGUF equivalent is the slowest
  model measured above.

## Runtime note

`llama.cpp-openvino` b10064 was built and installed, and segfaulted at startup
in every binary — `llama-bench --help` included, before any model load, so not
a warmup or model issue. Rolled back to the Vulkan build; backups in
`/mnt/ssd1/llama-backup/`. Probable cause: two OpenVINO versions on the loader
path (`/etc/ld.so.conf.d/openvino-genai.conf` adds a 2026.2.0 tree while the
system is 2026.4.0). Its PKGBUILD does use `-DCMAKE_BUILD_TYPE=Release`, which
would compile out the asserts costing the current build ~10x on CPU — a plain
Vulkan rebuild at `-DNDEBUG` would capture that without OpenVINO.

## Bearing on H0

None. `arm_only = 0` is grader arithmetic: constant `compose` upper-bounds every
arm regardless of adjudicator. This selection governs schema discipline and halt
behaviour, not the verdict. The evaluation with the selected model is
`2026-08-31T00-20-20-074Z`; no re-run was performed because the winner did not
change and a re-run would reproduce an identical experimental condition.
