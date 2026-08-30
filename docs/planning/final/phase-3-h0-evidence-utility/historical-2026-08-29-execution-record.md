*Part of the [canonical planning document](../canonical-final-planning-document.md).*

## 23. H0 rerun execution record (2026-08-29)

**Historical appendix:** this section records the superseded 2026-08-29 broken-PRNG/single-repository run. It is not current H0 status; §3.4 and H0-R3 govern after the fresh 2026-08-30 run.

**Frame-lock:** `STATUS.md:73-82` row 4, gated on item 3 (H0 redesign). Item 3 closed 2026-08-28 (redesign chain landed at `417fba2`; corpus files restored at `6d3fe99`; RETRACTED/ byte-stability restored at `b87a064`). Item 4 unblocked 2026-08-28.

### 23.1 What ran (parameters, infrastructure, code)

| | |
|---|---|
| Code commit | `b87a0648c26bbed504a0ed64e9b7ca37b4b8e6d0` (HEAD = `h0-redesign-merge`, same as `origin/main`) |
| Redesign chain (in order) | PR-A `66828ab` (D1+D2+S2 partial) → PR-B1 `9f054d7` (D3 infrastructure + trivial baselines file) → PR-B2 `8bb9804` (D4+D5+McNemar+S1+S3+S4) → PR-C `1016192` (corpus regen with real preimages + dependency_graph, S5) → merge `417fba2` → followup `6d3fe99` (corpus files at canonical paths) → restore `b87a064` (RETRACTED/ byte-stable) |
| `H0_SUBSAMPLE` | `30` — **actual composition: 30 jq + 0 cli (single-language C), NOT a balanced multi-language split**. The phase plan (`discriminator-plan-original.md:23`) only required "≥2 languages" with no specific 15/15 split; the "15 jq + 15 cli" phrasing in this session's `runs/README.md` and `REVIEW-2026-08-29.md` was a session-internal inference from the 30-triple target, not a phase-plan constraint. Root cause of the all-jq result is a **PRNG corruption**, not a degenerate seed. `_h0_runner.ts:249-250` reads `let t = Math.imul(a ^ (a >>> 15));` followed by `t = (t + Math.imul(t ^ (t >>> 7))) | 0;` — both `Math.imul` calls pass only **one argument**. `Math.imul(x)` with one argument coerces the missing second arg to `0`, so `x * 0 = 0`; both calls return `0`, and the Fisher-Yates shuffle collapses to a one-position rotation. The canonical Mulberry32 is `t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296;` — the second-argument masks (`t | 1`, `t | 61`) are part of the algorithm's bit-diffusion design, **not** interchangeable with a literal `1` or "any constant." A patch that uses `Math.imul(a ^ (a >>> 15), 1)` would only fix the first call; the second `Math.imul(t ^ (t >>> 7))` would still return `0` and the PRNG would remain broken. **Effect:** every call to `mulberry32()` in the runner returns `0`, regardless of the `H0_SEED` value. The Fisher-Yates shuffle that follows is therefore completely deterministic — every iteration swaps `a[i] ↔ a[0]` (because `j = floor(0 * (i+1)) = 0`), producing a one-position rotation that ends with `a[0..n-1] = original a…
| `H0_REPEATS` | `3` (temperatures cycled `[0.0, 0.5, 0.9]`, per-call seed `H0_SEED+r`) |
| `H0_SEED` | `12648430` (irrelevant — see `H0_SUBSAMPLE` row: the PRNG is broken at all seeds) |
| `H0_ADJUDICATOR` | `http://127.0.0.1:8089` — the plan's documented default; matches the live systemd unit `llama-cpu@Qwen3-Coder-30B-A3B-Instruct-UD-Q3_K_XL.service` (CPU-only; `--host 127.0.0.1 --port 8089 --n-gpu-layers 0`). The earlier mid-session "8088" reference in chat was a transient recall error — 8088 was a previous llama-server carrying `mistral-7b-instruct-v0.1.Q4_K_M.gguf`, not the pinned Qwen3-Coder-30B-A3B. The rerun used 8089 throughout, with the pinned model loaded. No port or model substitution occurred against the plan's contingency rule. |
| `H0_MODEL_TAG` | `Qwen3-Coder-30B-A3B-Instruct-UD-Q3_K_XL` |
| `MODEL_SHA` (pinned in `_h0_runner.ts:6`) | `69cd7578d77dffc0b17e34bad9ef998d08ae0e20ccceef21bad4e7eb3d8c553b` |
| Adjudicator backend | `llama-server` (`/usr/bin/llama-server`), OpenAI-compatible `/v1/chat/completions`. **Not Ollama** — this host has no Ollama. The runner's default `H0_ADJUDICATOR=http://127.0.0.1:8089` happens to match llama-server's conventional port on this host, but the runner itself does not know the backend; the OpenAI-compatible HTTP shape is what matters. Llama-server launch args from the live systemd unit (for reproduction): `--model /mnt/ssd1/models/Qwen3-Coder-30B-A3B-Instruct-UD-Q3_K_XL.gguf --ctx-size 8192 --batch-size 512 --ubatch-size 256 --threads 12 --cpu-mask 0xffffff --n-gpu-layers 0 --flash-attn auto --chat-template chatml --cache-type-k q8_0 --cache-type-v q8_0 --host 127.0.0.1 --port 8089`. |
| Model file on disk | `/mnt/ssd1/models/Qwen3-Coder-30B-A3B-Instruct-UD-Q3_K_XL.gguf` (13,806,312,608 B; present; SHA `69cd7578…` as pinned in `_h0_runner.ts:6`) |
| Corpus files | `evidence/h0/triples-jq-diff3.jsonl` (377 lines), `evidence/h0/triples-cli-diff3.jsonl` (521 lines) — both post-redesign (with `preimage_ours`, `preimage_theirs`, `dependency_graph`); originals byte-stable under `RETRACTED/` per `RETRACTION.json` |
| Baselines file | `evidence/h0/baselines.json` (3,439,074 B; produced by `_baselines.ts`) |
| Total records | 540 = 30 triples × 3 repeats × 6 arms |

### 23.2 Per-arm aggregate

| arm | correct | wrong | halt | schema_invalid | fabricated_ids | tokens_total | 3of3 | 2of3 | 1of3 | wrong-fraction |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| hunk-only | 45 | 32 | 13 | 0 | 24 | 50,367 | 24 | 6 | 0 | 0.356 |
| selected | 46 | 41 | 3 | 0 | 1 | 51,933 | 25 | 5 | 0 | 0.456 |
| full-bundle | 44 | 28 | 16 | 2 | 8 | 107,915 | 22 | 8 | 0 | 0.318 |
| baseline-keep_ours | 42 | 48 | 0 | 0 | 0 | 0 | (trivial, deterministic) | | | (trivial) |
| baseline-keep_theirs | 6 | 84 | 0 | 0 | 0 | 0 | (trivial, deterministic) | | | (trivial) |
| baseline-compose | 48 | 42 | 0 | 0 | 0 | 0 | (trivial, deterministic) | | | (trivial) |

`kill_condition.met = false`. `honest_signal = true` (`bestModelWrong=28 < compose.wrong=1260`). `verdict = "positive"`. `verdict_reason = "selected wrong=41, full-bundle wrong=28, hunk-only wrong=32; outside-arm evidence utility demonstrated."`. Raw `aggregate.json.verdict = "positive"` (characterization only); **run INVALID per plan-rule** (33 records with `fabricated_evidence_ids > 0`); WP8 gated.

### 23.3 Operational details (what the planning corpus did not anticipate)

1. **Adjudicator warmup.** 8089 returned HTTP 503 with empty model list for ~21 seconds after server start before serving HTTP 200 with the pinned model id. Polled every 3 s; ready before any model arm began.

2. **Runner stalls under host load.** The host (`vinbonesjr`) had load average 19+ during the run from 5+ concurrent OMP processes. Two `fetch()` calls to `/v1/chat/completions` hung indefinitely (ESTAB socket, no peer data, no fetch timeout). The runner had no `AbortController`; the runner process slept on `ep_poll` for 8+ minutes twice before self-recovering once, then stalling again.

3. **Fetch-timeout patch (user-authorized code change).** After the user picked "Add fetch timeout to runner, resume" from a 4-option question, `_h0_runner.ts:153-194` was patched with a 90 s `AbortController` (operational hardening, not a design change — does not touch prompt, parser, or LLM call's logical content). The runner was restarted with the same `H0_STAMP` and resumed from 59 saved keys; one later call (full-bundle triple 18/30 run 1, wall=90027 ms) hit the new timeout and was recorded as `schema_invalid: true`, `decision: "halt"`. The aggregator counts it as `schema_invalid` (denominator finite), keeping the kill branch reachable.

4. **Runner restart sequence.** The original runner (PID 442621) was killed by the bash 1800s timeout while in the middle of hunk-only triple 6/30 run 3. It had already written 17 records. The resume restart (PID 544007) loaded 59 saved keys and continued; it eventually died again from a different bash timeout at 540 records-complete. The final completion is in the runner's log line "all arms complete" at 2026-08-29T07:41:29Z. **No records lost across restarts** thanks to the resume-key logic at `_h0_runner.ts:216-228`.

5. **Wall-time breakdown.** Total ~1 h 50 min: 21s warmup + 17 min initial run to first hang + 1 min restart overhead + 1 h 11 min second run (including one 90 s hung-call recovery) + 1 min aggregator + 5 min verification. Effective per-call: mean ~24 s, p95 ~120 s, max 130 s.

### 23.4 Aggregator quirks (cosmetic, documented for future reruns)

1. **`seed_subsample: 0` / `repeats: 0`** in `aggregate.json` — the aggregator reads `process.env.H0_SUBSAMPLE` / `H0_REPEATS` to populate `aggregate.json`, but the env vars were not exported in the aggregator's shell. The actual subsample (30) and repeats (3) are recoverable from `triples_total: 30` in each model arm and the per-arm record count (90 = 30×3). Cosmetic; a future rerun must export these env vars before `_aggregate.ts`.

2. **Aggregator double-counts baselines from `runs/*.jsonl` + `baselines.json`.** The first-run invalidated files `*-2026-08-27T10-27-45-544Z.jsonl` (45 records each) are still in `runs/` and are picked up by the aggregator's `runsDir` scan; for baseline arms, the per-arm run file (90 records) is processed first then overwritten by `baselines.json` (862 triples). "Last wins" produces correct verdict numbers for model arms (unaffected) but inflated baseline counts in `aggregate.json`. Future cleanup: move first-run files to `RETRACTED/` or have the aggregator filter by timestamp.

3. **Double-counting of model arms.** Same effect: the first-run 45-record files are scanned, producing a `model: 45 records` line; then the new 90-record files scan, producing a `model: 90 records` line; the second wins. So the published `byArm["hunk-only"]` etc. are correct (90 records each), but the aggregator prints both.

### 23.5 Plan-text vs aggregator divergence (the binding user call)

| Metric | Plan-text rule | Aggregator rule | Rerun value | Plan-text outcome | Aggregator outcome | User call |
| --- | --- | --- | --- | --- | --- | --- |
| Verdict trigger | `wrong-fraction gap ≤ −0.050` (`h0-rerun-after-redesign-plan.md:93`) | `selected.wrong < hunkOnly.wrong \|\| fullBundle.wrong < hunkOnly.wrong` (`_aggregate.ts:319-324`) | gap = −0.037; full-bundle wrong=28 < hunk-only=32 | **no evidence utility** | **`positive`** | **INVALID** per plan-rule; raw `positive` preserved as count-comparison characterization, not as binding verdict |

Three different kill/verdict rules exist in the project's design corpus. For clarity:

| Rule | Source | What it says | Operative for |
|---|---|---|---|
| **Phase-plan §4.4 kill condition** | `discriminator-plan-original.md:147-150` | `wrong/halt < 1 + ε` (model rarely halts) AND selected-arm's `wrong - hunk-only.wrong ≤ 1` AND full-bundle-arm's `wrong - hunk-only.wrong ≤ 1`; ε = 0.5 | the original (2026-08-27) H0 plan; **superseded in practice** by the h0-rerun plan |
| **h0-rerun plan's 5pp gap threshold** | `h0-rerun-after-redesign-plan.md:93` (mirrored at `~/.local/share/omp/local/h0-rerun-after-redesign-plan.md`) | `wrong-fraction gap ≤ −0.050` between best arm and hunk-only → "no evidence utility" | **the 2026-08-29 rerun** (gap = −0.037, **not met**) |
| **Aggregator's count-based comparison** | `_aggregate.ts:319-324` | `selected.wrong < hunkOnly.wrong || fullBundle.wrong < hunkOnly.wrong` | the rule the aggregator applies to set `aggregate.json.verdict = "positive"`; **non-binding characterization only** — the user expressed a preference for it when the 5pp rule failed, but no user preference overrides the plan-rule. **Run INVALID per plan-rule** (33 records with `fabricated_evidence_ids > 0`); WP8 gated. |
| **Canonical WP3 acceptance gate** | canonical §7 #5 / §3.7 #5 (forward-looking only) | arm correct on ≥N more triples than the best trivial baseline at Fisher exact p < 0.05 | **never evaluated**; intended for future reruns |

When the 5pp rule and the aggregator's count-based rule disagreed, the user expressed a preference for the aggregator's `positive` characterization. That user preference does not override the plan-rule: **run INVALID per `h0-rerun-after-redesign-plan.md:117`** (33 records with `fabricated_evidence_ids > 0`); WP8 gated. The aggregator's `positive` is preserved only as non-binding count-comparison characterization.

**What this verdict does NOT do:** it does not prove full-bundle is universally better than hunk-only. The delta is 4 triples out of 90 records (sign test p ≈ 0.13), not statistically significant at conventional thresholds. Raw `aggregate.json.verdict = "positive"` (characterization only) for the 2026-08-29 rerun; the verdict's `positive` classification comes from the aggregator's design intent, not from a significance test. This is documented in `REVIEW-2026-08-29.md` "What this verdict does NOT do." **Run INVALID per plan-rule** (33 records with `fabricated_evidence_ids > 0`); WP8 gated.

### 23.6 Invalid source-ID citations — DISQUALIFYING

At the runner level, 34 of 270 model-arm records quoted at least one
`[source:…]` tag (25 hunk-only + 1 selected + 8 full-bundle), totalling
42 tag occurrences. One hunk-only record cited its own exposed triple key and
was correctly downgraded by the aggregator. At the aggregator level, **33
records remain invalid** (24 + 1 + 8), containing **41 invalid tag
occurrences** across 7 distinct values.

The aggregator's `knownTripleKeys` set is populated with 862 corpus triple
keys; it is not empty. The prompt permits only source IDs exposed to the model.
Values such as `"ours"`, `"theirs"`, `"ours vs source:theirs"`,
`"line_number_change"`, `"line_numbers"`, and
`"token_reordering_conflict"` were not exposed source IDs and are not corpus
triple keys. They are validity failures, not legitimate references and not
regex false positives.

**Effect on aggregator arithmetic:** `fabricated_evidence_ids` does not alter
the per-arm `correct`/`wrong`/`halt`/`schema_invalid` counts in this rerun.
**Effect on run validity:** the plan-rule trigger
(`fabricated_evidence_ids > 0`, `h0-rerun-after-redesign-plan.md:117`) fires
at 33 records, so the run is **INVALID** regardless of any raw count-based
comparison in `aggregate.json`. Fix the runner prompt/exposed-ID contract
before any future rerun. WP8 remains gated.

### 23.7 What got left behind (open work as of 2026-08-29T07:42Z)

| Item | Why open |
| --- | --- |
| Runner patch on `origin/main` | The fetch-timeout patch is in working tree only (`evidence/h0/_h0_runner.ts:153-194`). It should land on `origin/main` as a separate commit. |
| Aggregator cosmetic fix | `seed_subsample: 0` / `repeats: 0` in `aggregate.json` is a metadata bug, not a verdict bug. |
| Aggregator double-count cleanup | The first-run 45-record files in `runs/` should move to `RETRACTED/` to stop the aggregator's last-write-wins double scan. |
| Fabricated-IDs regex | The aggregator counts natural-language side labels as fabricated. Future patch. |
| Plan-text 5pp rule vs aggregator | Either tighten the gap, redesign the run, or amend the plan to remove the rule. |

### 23.8 What got left behind (larger open work, unchanged by this run)

Unchanged by the H0 rerun, still open per §3 and §16:

- **M0-closure rights attestation** (§3.2, WP0 row 1) — only M0 blocker; publication blocked.
- **M1a P0 / P1 / P2** (§3.5, WP1/WP2) — schema honesty + load-bearing tests; the corpus-review addendum's R2-R8 are open.
- **M2a port to `@mrgr/mechanisms`** (§3.6, WP5) — source groundwork stopped at Round 5.1; the `mrgr` port is not started. OMP `MODEL_BUILD` substitute still missing.
- **Resurrection proof** (§3.7, WP6) — no plan exists; the project's stated reason to exist.
- **Working human/scripted adjudicator harness** — required before WP8 (agent adapter) ships, even though H0 is positive.
- **M1b / M2b / M3 / M4 / Replay** (§3.8, WP7) — all gated behind frozen M2a residue.

### 23.9 What is in memory but missing from this artifact (folded forward)

Authoring notes for the next consolidation pass:

- **The local `main` ref is 61 commits behind `origin/main`.** Per the plan's branch-state guard, this is a working-tree-state detail, not a plan constraint. A future fast-forward or merge of `origin/main` into local `main` is needed if any subsequent work depends on local `main` instead of `h0-redesign-merge`.

- **The 4-question that surfaced during preflight is in `.omp/agent/sessions/-rsrch-mrgr/2026-08-28T23-38-53-628Z_01a04abd-953b-7000-8172-8f9486608903/local/h0-rerun-after-redesign-plan.md`** as the plan-of-record. The plan's contingency rule "If not, abort and surface to user — do not switch to a different model or adjudicator" was honored at both halts: (a) preflight ECONNREFUSED on 8089 — the `llama-cpu@Qwen3-Coder-30B-A3B-Instruct-UD-Q3_K_XL.service` had not yet been started, the user started it, and the rerun continued on 8089; (b) probed 8088 in the meantime, found it carrying mistral-7b-instruct (the prior server instance), and rejected it as a substitute per the contingency rule. The user did not "authorize a model change" — the right model was already the design target. The preflight halts were infrastructure-startup sequencing, not plan deviations.

- **The runner logs `evidence/h0/runs/preflight-2026-08-29T05-51-13Z.log` (62 lines, original run before restart) and `evidence/h0/runs/resume-2026-08-29T05-51-13Z.log` (496 lines, run after fetch-timeout patch applied) — 558 lines combined** record the full run history (warmup, two stalls, restart, completion). Future reruns should diff against these logs to identify behavior changes.

- **Per-session memory snapshot (`Hindsight bank claude-history`, recalled 2026-08-29)** does not contain any H0-rerun-specific facts beyond what's in `REVIEW-2026-08-29.md` and `STATUS.md`. Memory events from earlier sessions about PR-decomposition and fork-merging experiments (PR #1-5 on `conflict-of-interest`, PRs on `Raudbjorn/credit`) are not project-mrgr-specific and don't bear on the verdict.

- **The `docs/planning/` directory contains three files**: `m1a-p0-implementation-plan.md` (958 lines, an older M1a P0 implementation plan authored before the persistence-layer work; its version pins — `vitest@^2.0`, `node>=20`, no zod — were corrected in-place to current `vitest@^3.2.7`, `node>=22.5.0`, and `zod@^4.4.3`); `final/canonical-final-planning-document.md` (835 lines, this file); and a sub-directory `docs/superpowers/` with two files: `specs/2026-08-28-persistence-layer-design.md` (518 lines, schema design for `mrgr-db/2`) and `plans/2026-08-28-persistence-layer.md` (1942 lines, implementation plan with 56 unchecked boxes). The superpowers files document the SQLite persistence layer that landed on `main` (commits `00dd746` through `fae9628`). The `phase-plans/INDEX.md` says (4) H0 rerun execution = blocked on live LLM; that block is now lifted. A future `docs/planning/` housekeeping pass should either move the canonical-final-planning-document under `phase-plans/` or update INDEX.md to reflect the rerun completion.

- **The persistence-layer work was shipped without §3.5 or §16 being updated.** This canonical-final-planning-document was originally authored against a pre-`mrgr-db` snapshot. The §3.5 entry now reads "complete on all branches" (post-hoc correction, see §3.5) and §16 commitments #2 and #3 are marked DONE. Future consolidations should re-verify against `git log --oneline -- packages/core/src/db/` before publishing.
- **The Phase Plans INDEX (`.do-not-commit/planning/phase-plans/INDEX.md`) is internally consistent** with `STATUS.md` post-rerun: both report H0 as `positive` at `b87a064`. INDEX.md's "(5) M2a mrgr port = blocked on OMP MODEL_BUILD" remains correct.

---
