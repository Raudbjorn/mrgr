# mrgr — Canonical Planning Document (proposed `./planning/final/`)

*Audience:* `/plan` consumer. Read top-down; §6 onward is the binding work order. **H0 rerun (2026-08-29) execution record: §23; session-close summary: §24.**
*Authority:* Direct source, preserved run output, independent reviews, then the
governing phase plans in `planning/mrgr/`. Older `.remember/` snapshots and the
broad `planning/docs/` staging corpus are historical only.
*Framing pushback:* §1.2.
*Self-attack:* §15.
*Committed recommendations:* §16.
*Last consolidated:* 2026-08-29 (H0 rerun closure).

---

## 1. Frame lock and authority

### 1.1 Workspace and timestamp

| Field | Value |
| --- | --- |
| Workspace | `/home/svnbjrn/rsrch/projects-mrgr` |
| UTC captured | 2026-08-29T05:25Z |
| Git repository | **not a git repository** (`git rev-parse` returns fatal at workspace root and at `/home/svnbjrn/rsrch/`) |
| Working-tree state | n/a — directory is a research staging tree, not a checkout. Source-of-truth identity for the running repo is `/home/svnbjrn/dev/mrgr` (commit `83042b5` referenced by prior session; M0 evidence ties to `ed928032d4c2786988f1ec8a279975894f099553`, M0 root to `2440329`). |
| Concurrent-change risk | **High.** M0-closure commits `1942085`, `1fe1847`, and F1 commits `ced6d13`, `ed92803` are referenced by `STATUS.md` from 2026-08-27 but the actual `/home/svnbjrn/dev/mrgr` tree is not in this workspace; `local://canonical-final-planning-document.md` cannot re-hash it. A pre-flight git fetch + SHA-256 recheck on `/home/svnbjrn/dev/mrgr` is a hard prerequisite before any code edit. |
| Canonical planning files | `planning/mrgr/PLAN.md` (SHA-256 `93e13342577876a7504188d6756ed932149e944f9309ae5eb30d48f57d846216`); `planning/mrgr/STATUS.md` (SHA-256 `c5aa98ca931d831df3244e7df4aa4014847e57822d4484852e1f23602f3c17e2`); `planning/mrgr/SOURCES.md` (SHA-256 `6492d1e501e6d83a5c5a683e70b874a89bf0ac40b99b906313c6b1fa8f02fe32`); `planning/mrgr/canonical-plan-source.md` (SHA-256 `3baa199c2ee4a3f4908e9648262c48197487a2ece40ca118549cc91493cee4ff`) — content-equivalent copies of an outside-the-tree plan at `/home/svnbjrn/.claude/plans/open-source-agent-first-toolkit-sparkling-bumblebee.md`. |

### 1.2 Phase 0.5 framing pushback (mandatory)

The user requested "one canonical document in `./planning/final/`." Four pushbacks before drafting:

1. **One document is the right knowledge boundary, but the boundary must be content-shaped, not file-shaped.** A single file that smuggles `STATUS.md`, `PLAN.md`, `SOURCES.md`, four phase plans, and two research distillations into one Markdown blob recreates the prior "agent-first plan" failure mode: a fluent synthesis that hides denominator drift, stale positive claims, and superseded milestones. The artifact therefore organizes around three tiers — **current truth** (status, sequencing, blockers), **canonical evidence** (M0 closure log, F1 finding, H0 invalidation, M1a addendum, M2a plan, literature/mechanism distillations), and **provenance** (session records, `.remember`, sources). A one-file canonical plan is acceptable *if* the canonical evidence tier survives as cross-linked artifacts in `planning/mrgr/`, not as pasted blocks.

2. **Several assumptions are unsafe to leave implicit:**
   - "H0 is invalidated, therefore we know evidence doesn't help." The independent review refuted the *measurement*; it did not refute the *hypothesis*. The selected-vs-full discrimination is still untested at a non-leaky design. Treating the invalid run as a positive result for "evidence doesn't matter" would be premature convergence.
   - "M2a is implemented." The Round 5.1 source experiment completed tooling, contracts, preflight, and adjudicator; **zero arms launched** and the intermediate terminal frame was invalidated by post-freeze contract drift and the absence of an immutable `MODEL_BUILD`. Nothing about mechanism rates or topology contrast exists as a result.
  - "M1a is partial completion." It is partial completion *for the carried-WP0 test subset*, not partial completion of the schema/persistence/identity work the corpus-review addendum names. `semantic-merge/docs/M1a-evidence-bundles.md` still claims "Completed"; that file is stale and superseded, not authoritative. **NOTE (2026-08-29):** the framing pushback is historical — the partial-completion claim was true when this artifact was authored. As of commit `fae9628` (mrgr-db/2), M1a P0/P1/P2 are **complete on all branches**; see §3.5 and §16 commitments #2, #3.
  - "Publication is the goal." `STATUS.md` records that publication is blocked by an unrecorded rights attestation. Several prior shipped docs (`README.md`, `NOTICE`) reference absent packages (`@mrgr/mergebase`, `@mrgr/entities`, `docs/method.md`, `packages/mechanisms`) and use present-tense prose about mechanisms that do not exist in the tree. A canonical plan must distinguish "what is publishable *now*" (forensic core, Apache-2.0, 232 test invocations across 24 files as of 2026-08-29, after NOTICE correction) from "what we hope to publish after M1a P0/P1/P2 + H0 redesign + M2a port + resurrection proof."

3. **A second plan is unnecessary and harmful.** The two existing in-tree canonical files (`PLAN.md`, `STATUS.md`) are already self-consistent and the phase plans (`phases/m0/closure-evidence.md`, `phases/h0/independent-review.md`, `phases/m1a/integration-tests-plan.md`, `phases/m2a/round5-merge-mechanism-refreeze-plan.md`) cover every milestone. Producing a parallel canonical plan that re-derives the same evidence chain is duplication; rewriting `PLAN.md`/`STATUS.md` instead of consolidating is dangerous because the reviews and corpus addendum cite their line numbers. **The correct move is:** keep `STATUS.md`, `PLAN.md`, `SOURCES.md` as primary; this artifact becomes the *consolidation* document under `./planning/final/`, cross-linking the primary files and adding the verification and dependency-graph work that the primary files defer.

4. **Canonical plan vs provenance/evidence appendices.** The user-visible product claim, sequence, gates, and `STOP` rules belong in the canonical plan. M0 closure evidence, F1 reproduction, H0 invalidation, M1a addendum, M2a Round 5.1 session record, and literature/mechanism distillations belong in cross-linked canonical evidence files. The line is "what `/plan` reads to scope work" vs "what `/plan` reads to verify a gate." Misclassifying evidence (e.g. pasting the 820-line Round 5.1 session record inline) inflates the artifact and obscures the work order; misclassifying the work order (e.g. leaving the sequencing decisions in a research distillation) makes `/plan` re-derive milestones.

The corrected frame: **this artifact is the canonical consolidation**; `STATUS.md`, `PLAN.md`, `SOURCES.md` remain primary in `planning/mrgr/`; phase plans and research distillations are referenced by stable link, not inlined.

### 1.3 Versions pinned

| Component | Pinned version | Source |
| --- | --- | --- |
| `mrgr` source repo | `/home/svnbjrn/dev/mrgr` @ commit `ed928032d4c2786988f1ec8a279975894f099553` (M0 evidence anchor); F1 fix at `ed92803`; M0 root at `2440329`. Tree tip at prior-session time was `83042b5`. Re-pin on disk before any edit. | `planning/mrgr/phases/m0/closure-evidence.md`; `planning/mrgr/findings/F1-exact-localization-unreachable.md`; `local/planning-next-phase-research.md:35-43` |
| Node | `v25.1.0` (engines `>=22.5.0` — **bumped from `>=20` post-M0 by commit `c55d0aa` "validate ledger createdAt, correct README Node floor"**) | `package.json` (root); `packages/core/package.json`; `closure-evidence.md` (M0 baseline `>=20`) |
| pnpm | `11.3.0` | `package.json` (`"packageManager": "pnpm@11.3.0"`); `closure-evidence.md` |
| Git | `2.55.0` | `closure-evidence.md`; `MECHANISM-PREFLIGHT.json` (Round 5.1); plan critique S22/S23 |
| OS / kernel | Arch Linux `7.1.3-273-tkg-bore` | `closure-evidence.md`; Round 5.1 session record |
| vitest | `^3.2.7` (actual; superpowers plan line9 says "vitest 2" — stale) | `package.json` |
| zod | `^4.4.3` (actual; matches superpowers plan's "zod 4 (already a dep)") | `packages/core/package.json` |
| SQLite persistence layer (`mrgr-db`) | Schema version `mrgr-db/2` (USER_VERSION=2, APPLICATION_ID=0x6d726772); driver `node:sqlite` (Node built-in, no new dep); DB file `mrgr.db` by default, path via `--db`; 108 db tests green; supersedes JSONL as storage (JSONL remains transport via `mrgr db import` / `mrgr db export`) | `packages/core/src/db/`; `docs/superpowers/specs/2026-08-28-persistence-layer-design.md`; `docs/superpowers/plans/2026-08-28-persistence-layer.md` (note: plan/specs reference `mrgr-db/1`; the actual shipped schema is `mrgr-db/2` per `packages/core/src/db/open.ts:9`) |
| Git baselineId | SHA-256 of pinned tuple `Git=2.55.0, isolated-v1, ort, normalization=v1, materialization=v1` | `phases/m0/wp0-measurement.md` |
| Round 5.1 adapter (`merge-mechanism-driver.sh`) | 188 lines, hardened 2026-08-26; SHA not pinned in corpus text (re-derive at rehydrate) | Round 5.1 session record |
| Round 5.1 frozen refs | `ov2-base=b2d25948…`, `base4-p=4a729909…`, `fork4-p=c687b532…`, `base6-p=83c6e7d4…`, `fork6-p=9c25e84e…` | `PLAN.md` §4 (resurrection inputs); Round 5.1 session record |
| Mergiraf | `v0.19.0` @ commit `7246b03c08c02248035bc20668fde1edf94a09e0` | `research/mergiraf-mechanism.md` |
| Merge-Bench | arXiv:2605.25890v1; dataset `merges.tar.gz` SHA-256 `4f0b63409776c7d987b808dd85959c40a09160c6f155381b66a9ed8356ea6ff8`; companion repo `benedikt-schesch/Merge-Bench` @ `4860bea020e3fc0af31fff8d58e5b822be822222` | `research/adjudication-literature.md` |
| AgenticFlict | arXiv:2604.03551v2, AIware'26 DOI `10.1145/3805760.3814923`; source `unlv-evol/AgenticFlict` @ `e050289d12c37d90e81f90886a0ecde9a683385a` | `research/adjudication-literature.md` |
| Rover | arXiv:2605.17279v1 | `research/adjudication-literature.md` |
| ConGra | arXiv:2409.14121v1 | `research/adjudication-literature.md` |
| ConflictAgent | arXiv:2607.27674v1; repo `UBOWENVT/ConflictAgent` | `research/adjudication-literature.md` |

`UNKNOWN` (must determine before code edits): `/home/svnbjrn/dev/mrgr` current HEAD SHA, working-tree dirty state, presence of any uncommitted edits to `packages/core/src/evaluation/corpus.ts` or to a `forensic/core.ts` referenced in the M1a addendum.

### 1.4 Scope

**In:** Phase-by-phase current state; dependency graph and critical path; ordered work packages with deliverables, files/symbols where known, acceptance criteria, `STOP` gates; H0 redesign requirements; M1a schema/persistence/identity/error/test requirements preserving 1,200 UTF-16 code-unit semantics and original UTF-8 byte-count metadata; M0 publication-rights disposition; M2a/Round 5.1 boundaries and prerequisites; risk register; evidence ledger; completion definition; explicit non-goals and supersession rules.

**Out:** Implementation of code, formatters, linters, project-wide test runs, file mutations in `/home/svnbjrn/dev/mrgr`, force-pushes, or new commits. Out-of-scope work: M1b/M2b/M3/M4 detail (deferred until M2a residue is frozen); agent adapter implementation (deferred until H0 returns a valid positive verdict and a human/scripted adjudicator works end-to-end); fork-prospecting experiments outside the existing `experiment/baseline/scratch` tree.

**Success criteria for this artifact:** A planner reading it can (a) sequence the next work units without re-deriving the milestone graph, (b) name the exact files/symbols each unit must touch, (c) name the gate that closes the unit, (d) name the `STOP` rule that retires the unit, (e) cite the source evidence each claim relies on, (f) avoid re-running the invalidated H0 experiment or re-asserting the stale positive verdict.

### 1.5 Authority and supersession rules

1. **Direct source + preserved run output + independent reviews** outrank everything else.
2. **`STATUS.md` and the governing phase plan** for each milestone outrank `PLAN.md` narrative.
3. **`PLAN.md`** is revision-2, content copy of the plan-mode file with live phase markers added.
4. **Session records** under `sources/sessions/` are evidence, not status.
5. **`.remember/` snapshots** are navigation history; the positive-H0 line in `today-2026-08-26.md` is explicitly superseded by `phases/h0/independent-review.md`.
6. **`planning/docs/`** is a broad staging corpus containing superseded plans, opaque external captures, and stale claims. Do not pull status from there.
7. **`semantic-merge/docs/M1a-evidence-bundles.md`** claiming "Completed" is superseded by the corpus-review addendum.
8. **`projects-mrgr/experiment/docs/M0.md`** is a misplaced duplicate of an M1a narrative and is not independent evidence.

A behavior claim is not current truth until the changed path has run and its output is preserved. A plan, memory line, repeated result, or passing schema check is not a substitute.

---

## 2. Answer-first current verdict

| Question | Answer |
| --- | --- |
| What runs next? | **WP0 (M0-closure rights attestation + doc correction) is the only remaining M0 blocker; WP5 (M2a port) and WP6 (resurrection proof) are independent next streams.** Raw `aggregate.json.verdict = "positive"` (characterization only) for the 2026-08-29 H0 rerun; **run INVALID per plan-rule** (see §3.4 lead): 33 records had invalid tag citations (`fabricated_evidence_ids > 0` triggers the `INVALID` verdict per `h0-rerun-after-redesign-plan.md:117`). H0/WP8 acceptance gates also did **not** clear (≥3 repos, ≥2 languages, broken PRNG; see §3.4). M1a P0/P1/P2 landed as `mrgr-db/2` (see §3.5). What was originally framed as "M1a P0 is the only phase whose governing plan says 'go'" is no longer accurate — t…
| What does H0 still mean? | **Raw `aggregate.json.verdict = "positive"` (characterization only) for the 2026-08-29 H0 rerun; run INVALID per plan-rule** (33 records with `fabricated_evidence_ids > 0`); WP8 gated. The H0/WP8 acceptance gate did NOT pass (≥3 repos, ≥2 languages, no PRNG corruption — see §3.4 and §23.1 for the full gate-failure diagnosis). The first run (2026-08-27) is invalidated by the 2026-08-27 independent review's five fatal defects (D1–D5); the 2026-08-29 rerun cleared those five fatal defects at the implementation level, but the run's sample is single-repository / single-language due to a broken PRNG (`_h0_runner.ts:249-250`: both `Math.imul` calls one-argument, returning `0`). The verdict is therefore **a correct count-based comparison on 30 jq triples**, not a positive result that clears H0/WP8. See §3.4 + §23.1 + §24.2 #11. The `evi…
| Does M2a have a result? | **No.** Round 5.1 produced tooling and contracts; zero arms launched; the intermediate `FRAME-LOCK.md` was invalidated by post-freeze contract drift and missing immutable `MODEL_BUILD`. The Round 5.1 artifacts are reusable source implementation for the `mrgr` port, not a result. |
| Is anything publishable today? | **`@mrgr/core` is publishable** after the NOTICE rights attestation is recorded, README is corrected to remove present-tense claims about absent packages, and `LICENSE`/`NOTICE` carry the corrected GPL-3.0-only Mergiraf wording. The `mrgr-db/2` persistence layer (14 source files, 13 test files) is the on-disk storage; JSONL is now transport. No other package is built. |
| Does an agent adapter ship? | **No — and the H0 rerun is INVALID per the plan's rule.** Raw `aggregate.json.verdict = "positive"` (characterization only) for the 2026-08-29 H0 rerun; **run INVALID per plan-rule** (33 records with `fabricated_evidence_ids > 0`; `h0-rerun-after-redesign-plan.md:117`: "If any arm has `fabricated_evidence_ids > 0`, … the run is invalid — record the invalidity in the REVIEW file (step 6) and surface to the user"; see §3.4 lead); WP8 gated. The agent-adapter unblocking gate did NOT pass. The phase plan (`discriminator-plan-original.md:23`) requires "20–30 exact-localized, dev-resolved conflicts across ≥3 repos and ≥2 languages"; the rerun's full corpus has only 2 repos (`stedolan/jq`, `cli/cli`…
| Does the resurrection proof run? | **It runs before any oracle and before M2a residue is consumed.** This is the project's stated reason to exist; revision 1 scheduled it after M3/M4. The private gate reconstructs from `ov2-base`, `base4-p`, `fork4-p`, `base6-p`, `fork6-p`; the public gate ships a tiny synthetic repo with the same topology and runs in CI. |
| What's the cap semantic? | **1,200 UTF-16 code units** via `string.length` / `slice(0, CAP)` is the implementation. Any byte count must be computed from the original bytes (`Buffer.byteLength(original, "utf8")`), not from JavaScript string length. Truncation must be explicit: prefix + truncation metadata + byte count from original. The `mrgr-db/2` schema persists preimages by SHA-256 (content-addressed blobs in `packages/core/src/db/schema.ts`); the 1,200 UTF-16 cap applies to the in-memory string representation in the carried code, not to db-stored preimages. |
| What's the kill-safe outcome? | If H0 returns null, the bypass test shows the harness is purely advisory, or resurrection cannot derive the four candidates from reconstructed inputs — ship `@mrgr/core` alone with honest limits, retire the agent adapter, retire `@mrgr/evidence-bundle`, retire the four surfaces. `@mrgr/core` is already useful, tested, honest. **The kill-safe outcome did not fire** — raw `aggregate.json.verdict = "positive"` (characterization only) for the 2026-08-29 rerun; **run INVALID per plan-rule** (33 records with `fabricated_evidence_ids > 0`); WP8 gated. The H0/WP8 acceptance gate did NOT pass (≥3 repos, ≥2 languages — see §3.4). The conditional path is preserved as the fallback: a future rerun with a fixed PRNG, a third repo in the corpus, and a working adjudicator harness could clear H0. Until then, the ve…

---

## 3. Verified current state by milestone

### 3.1 M0 — extract `@mrgr/core` from WP0
- **State:** complete (commit `2440329`). 24 carried files byte-verified by `scripts/verify-carried.sh`. Apache-2.0 declared. CLI binary built. 120 tests pass on a clean clone at `ed928032…` on `node v25.1.0` / `pnpm 11.3.0` / `git 2.55.0` / `Arch 7.1.3-273-tkg-bore`.
- **What survives:** the carried miner, the schema-v2 corpus contract, the `isolated-v1` Git baseline, conservative localization, and the explicit-denominator report. (`phases/m0/wp0-measurement.md`, `phases/m0/scope-and-verdict.md`, `phases/m0/wp0-merge-replay.md`, `phases/m0/closure-evidence.md`.)
- **What does not survive:** the README's present-tense claim that the project "invokes Mergiraf/diff3," references absent `docs/method.md`, and lists absent packages. `NOTICE.snapshot` carries an unrecorded rights attestation. (`phases/m0/NOTICE.snapshot`, `phases/m0/README.snapshot.md`, `phases/m0/closure-evidence.md` "What this does NOT establish.")

### 3.2 M0-closure — durable gates and corrected claims
- **State:** technical gates complete; publication blocked by the unrecorded rights attestation.
- **Closing requirements:** durable clean-clone artifact (Node / pnpm / Git pinned, frozen-lockfile install, typecheck, 120-test run, build, `verify-carried.sh` output, negative self-test, CLI smoke); NOTICE corrected (no `docs/method.md` reference, no present-tense mechanism invocation, Mergiraf `GPL-3.0-only`, diff3 `GPL-3.0-or-later`); README corrected (no absent-package claims); rights attestation recorded in `NOTICE`.
- **STOP rule:** do not call M0 "done," "green," or "clean-clone reproduced" in any shipped file until the artifact exists.

### 3.3 F1 — exact localization unreachable on real repositories
- **State:** found and fixed. Found at commit `ced6d13`; fixed at `ed92803`. Confirmed by planning/findings pointer and by `phases/m0/F1-exact-localization-unreachable.md`.
- **Mechanism:** `localize.ts` requires complete diff3 conflict blocks. The isolated environment (`GIT_CONFIG_NOSYSTEM=1`, `GIT_CONFIG_GLOBAL=/dev/null`) means `merge.conflictStyle` falls back to Git default, omitting the `|||||||` base section. The fixture sets the style inside its own repo so the suite never exercised the broken path. Fix: conflict style now opt-in via `ReplayOptions.conflictStyle`, delivered as `git -c merge.conflictStyle=…` via `RunGitOptions.config`. Default behavior and `baselineId` unchanged.
- **Effect:** 0 → 377 exact regions on the same `jqlang/jq` scan.
- **STOP rule:** before any future H0 corpus build, verify `--conflict-style` was passed. This exact failure has a fix now; do not re-discover it.

### 3.4 H0 — evidence-utility discriminator
- **State (2026-08-29 update):** redesign chain landed on `origin/main` at `b87a064` (PR-A `66828ab`, PR-B1 `9f054d7`, PR-B2 `8bb9804`, PR-C `1016192`, merge `417fba2`, followup `6d3fe99`, restore `b87a064`). Rerun executed against the redesigned pipeline on `b87a064` produced `aggregate.json.verdict = "positive"` (machine-readable, per the aggregator's count-based comparison `selected.wrong < hunkOnly.wrong || fullBundle.wrong < hunkOnly.wrong`). **The plan's authoritative rule declares this run INVALID** (`h0-rerun-after-redesign-plan.md:117`: "If any arm has `fabricated_evidence_ids > 0`, … the run is invalid — record the invalidity in the REVIEW file (step 6) and surface to the user"). The aggregator's `fabricated_evidence_ids` is **24 + 1 + 8 = 33 records** (aggregator-level, post-corpus-membership-check); see §3.4 (c) S3 below for the citation-validity failure and §22 (Fabricated-IDs regex limitation). **The verdict is therefore INVALID per the plan's own rule**, regardless of the aggregator's `positive` count-based comparison. The "raw positive" string in `aggregate.json` characterizes the count-based comparison result; the *run* is invalid because 33 records had invalid tag citations. **Defect closure is partial, not total — and the verdict rests on structurally-incoherent comparisons.** The five fatal defects (D1–D5) are closed by the **structural form** of the redesign chain (see `phase-plans/INDEX.md` table "H0 redesign defects — final fix-status"). However, the run-level **semantic** validity of two of those fixes (D3, D5) is undermined by the rerun's broken PRNG + denominator mismatch — see "D3 / D5 run-level semantic failures" below. Of the **secondary defects (S1–S5)**, three remain unclosed:

  **D3 / D5 run-level semantic failures** (formal fix in place; semantically invalid at run-time):
  - **D3 (constant-baseline wins).** The redesign introduced a `trivial_ceiling` aggregator field populated from `baselines.json`, with `compose.wrong=1260 / triples=862`. The aggregator's `honestSignal` compares `bestModelWrong=28` (over the 30-triple subsample) to `composeWrong=1260` (over the 862-triple full corpus) — the comparison mixes denominators (30 vs 862). The boolean `true` does not establish that the model "honestly" beats the trivial baseline; it just reflects the denominator mismatch. The fix would require re-deriving `trivial_ceiling` denominators over the same 30-triple subsample the model arms ran on, so the `<` comparison is between like denominators. This run's `honest_signal=true` is therefore a **vacuous boolean**, not an honest positive.
  - **D5 (kill condition reachability) — precise math.** The aggregator's `modelLoses` calculation (`bestModelWrongFraction >= composeWrongFraction - 0.5` with `EPSILON=0.5`) compares `bestModelWrongFraction = bestModelWrong / hunkOnly.triples_total` to `composeWrongFraction = trivialCeiling.compose.wrong / trivialCeiling.compose.triples`. On this run: `bestModelWrongFraction = min(28, 41, 32) / 30 ≈ 0.933` and `composeWrongFraction = 1260 / 862 ≈ 1.462`. The code computes `0.933 >= 1.462 - 0.5 = 0.962 → false` — so `modelLoses` is `false` and `kill_condition.met = false`. **Both populations are wrong-records per unique triple** (same unit: wrong/triples), but **same-unit does not mean same-coverage**: 30 unique triples from the model arms, 862 unique triples from the trivial baselines, on a corpus the model arms didn't see. The boolean `false` for `kill_condition.met` is technically reachable (D5's structural form is fixed), but the comparison mixes 30-triple coverage with 862-triple coverage — the `≥` test is not a meaningful gate. The kill condition is set by coverage asymmetry, not by any model-vs-baseline property. (Note: the prior §3.4 fix cited `28/(28+44+16)=0.318` as `bestModelWrongFraction` — that is the wrong-fraction-across-records metric `wrong / (wrong+correct+halt)`, not the metric the code actually uses. The code divides by `triples_total`, not by record count.)


  **Consequence for the verdict:** raw `aggregate.json.verdict = "positive"` (characterization only) for the 2026-08-29 rerun; **run INVALID per plan-rule** (33 records with `fabricated_evidence_ids > 0`); WP8 gated. The verdict's `positive` classification rests on a count-based comparison (`full-bundle wrong=28 < hunk-only wrong=32`) that is internally consistent within the 30-triple subsample, but **(a)** the `selected` arm measures prompt padding rather than evidence selection (S5 not closed), **(b)** the kill-condition reachability that was supposed to gate that verdict produces a vacuous boolean (D5 denominator mismatch), and **(c)** the honest-signal check (D3 denominator mismatch) is also vacuous. The verdict is therefore descriptive of the 30 jq triples that ran on, not a basis for generalizing beyond `stedolan/jq` (C).
- **Rerun numbers (2026-08-29, 30 triples × 3 repeats × 6 arms = 540 records):**
  | arm | correct | wrong | halt | schema_invalid | fabricated_ids | tokens | wrong-fraction |
  | --- | --- | --- | --- | --- | --- | --- | --- |
  | hunk-only | 45 | 32 | 13 | 0 | 24 | 50,367 | 0.356 |
  | selected | 46 | 41 | 3 | 0 | 1 | 51,933 | 0.456 |
  | full-bundle | 44 | 28 | 16 | 2 | 8 | 107,915 | 0.318 |
  | baseline-keep_ours | 42 | 48 | 0 | 0 | 0 | 0 | (trivial) |
  | baseline-keep_theirs | 6 | 84 | 0 | 0 | 0 | 0 | (trivial) |
  | baseline-compose | 48 | 42 | 0 | 0 | 0 | 0 | (trivial) |
 - **Kill condition (operative for 2026-08-29 rerun):** see §22 verdict trigger table and §23.5 "Plan-text vs aggregator divergence." The plan-text rule for the 2026-08-29 rerun was the h0-rerun plan's 5pp gap threshold (`wrong-fraction gap ≤ −0.050` → "no evidence utility"); that rule was **not met** (gap = −0.037). The aggregator's own count-based comparison (`selected.wrong < hunkOnly.wrong || fullBundle.wrong < hunkOnly.wrong`, `_aggregate.ts:319-324`) was met, and the user chose the aggregator's `positive` over the plan-text 5pp rule; **run INVALID per plan-rule** (33 records with `fabricated_evidence_ids > 0`); WP8 gated. The aggregator's `positive` is **non-binding characterization only**, not a binding H0 outcome. Future reruns should either tighten the gap threshold to match the data, redesign the run to clear the 5pp, or amend the design to remove the 5pp rule.
   - `kill_condition.met = false`; `honest_signal = true`; `verdict_reason = "selected wrong=41, full-bundle wrong=28, hunk-only wrong=32; outside-arm evidence utility demonstrated."`
 - Plan-text 5pp threshold (gap ≤ −0.050): not met (gap = −0.037). Aggregator's count-based comparison (any arm wrong < hunk-only wrong): met (full-bundle 28 < 32). The user chose the aggregator's `positive` over the plan-text 5pp rule; **run INVALID per plan-rule** (33 records with `fabricated_evidence_ids > 0`); the aggregator's `positive` is **non-binding characterization only**, not a binding H0 outcome — see §23.5 "Plan-text vs aggregator divergence."
  - **Subsample composition:** all 30 triples in the run are from `stedolan/jq` (C); **0 from `cli/cli` (Go)**. Caused by a typo at `_h0_runner.ts:249` (`Math.imul(a ^ (a >>> 15))` returns 0, not the intended value), which makes the PRNG deterministic and jq-biased (jq loads before cli). See §23.1 for full diagnosis. **Consequence: TWO WP3 acceptance-gate conditions failed.** (a) The phase plan (`discriminator-plan-original.md:23`) requires "20–30 exact-localized, dev-resolved conflicts across **≥3 repos and ≥2 languages**." The rerun's full corpus contains only **2 repos** (`stedolan/jq`, `cli/cli`) — failing the **≥3-repos** condition outright (the corpus itself, not just the subsample, has only 2 repos). (b) The subsample is single-language (jq only, 0 cli triples sampled) — failing the **≥2-languages** condition. Raw `aggregate.json.verdict = "positive"` (characterization only) for the 2026-08-29 rerun; **run INVALID per plan-rule** (33 records with `fabricated_evidence_ids > 0`); WP8 gated. The per-arm numbers above are real and reproducible for the 30 jq triples that ran; the verdict cannot be generalized beyond jq/C conflicts. The agent-adapter unblocking condition from §16 commitment #9 was **NOT satisfied by this rerun** — the verdict is binding for `mrgr-core` shipping but does **not** clear WP8.
- **Source:** `evidence/h0/REVIEW-2026-08-29.md` (full review); `evidence/h0/aggregate.json` (machine-readable); `evidence/h0/runs/*-2026-08-29T05-51-13-934Z.jsonl` (per-arm raw records, 540 total); `.do-not-commit/planning/phase-plans/INDEX.md` (defect-fix table); `.do-not-commit/planning/phase-plans/h0-redesign*` (redesign plans).
- **STOP rule (supersedes the prior rule below):** do not cite the 2026-08-27 first-run verdict, but DO cite the 2026-08-29 rerun verdict with `REVIEW-2026-08-29.md` and the redesign chain SHAs as evidence. The "first run invalidated" rule is preserved for the prior artifacts (`runs/*-2026-08-27T10-27-45-544Z.jsonl`, `RETRACTED/*`); those stay byte-stable under `RETRACTION.json`.
- **Prior rule (preserved for the 2026-08-27 artifacts):** do not claim any positive, significant, or stable result from this run. Do not cite the "6/45" figure, the "positive" verdict, the stability claim, or any "kill-condition-not-met" claim.
### 3.5 M1a — evidence bundles and census plumbing
- **State (2026-08-29 update):** complete on all branches. M1a P0/P1/P2 work landed via the `mrgr-db/2` SQLite persistence layer (`packages/core/src/db/`): `CorpusStore`, `EvidenceStore`, `LedgerStore`, `RunStore` (the M4 ledger shape), `ImportStore`, `ExportStore`, plus `mrgr db` CLI subcommands (`init` / `import` / `export` / `verify`). JSONL is demoted to transport (canonical byte-deterministic export). Schema persistence, region identity, content semantics, and failure reporting are enforced by SQLite `CHECK` constraints in `packages/core/src/db/schema.ts`. Carried files (`src/evaluation/*`, `tests/evaluation/*`) are unchanged — verified by `scripts/verify-carried.sh`. **The canonical-final-planning-document's earlier "partially complete" wording is stale**: it was authored before `mrgr-db/2` landed. The current truth is in `STATUS.md` M1a row.
- **Verified subset (corpus review evidence ledger R1):** `tests/forensic.test.ts:73-113` builds a temp conflict; targeted + full suite pass without `local/jq` or `local/cli-cli`.
- **Test count (current):** 232 invocations across 24 test files (83 in `tests/evaluation/` carried, 41 in `tests/m1a/`, 108 in `tests/db/` per `STATUS.md`). The "120 tests" claim that recurs throughout this artifact is the carried-only subset and predates the m1a and db work.
- **R2-R8 disposition (corpus-review addendum P0/P1/P2):**
  - R2: preimage contract — **superseded by `mrgr-db/2` schema with `preimage_ours_sha` / `preimage_theirs_sha` content-addressed blob storage**. The 1,200 UTF-16 cap and UTF-16-vs-byte semantics are still enforced for in-memory string representation in the carried code; persistence is now byte-exact via SHA-256.
  - R3: structural-honesty test — **superseded by db tests**: `tests/db/corpus-store.test.ts`, `tests/db/evidence-store.test.ts`, `tests/db/llama-cpp-cli.test.ts` exercise preimage source semantics (round-trip, idempotency, dependency-graph agreement).
  - R4: `parseCorpusRecord` drops `evidenceBundles` — **superseded**: `mrgr db import` uses the carried fail-closed readers (`readCorpus` / `readEvidence`) under the hood; bundles round-trip through `evidence_bundle` table with `CHECK (status = 'failed' OR ordinal >= 1)` invariant.
  - R5: `dependency_graph` mixes hunk payloads with path entries — **superseded**: schema enforces `dependency_graph_status IN ('derived', 'unavailable')` discriminator; hunk payloads live in dedicated blob columns, not in dependency rows.
  - R6: H0 utility claim refuted (see §3.4).
  - R7: nullable stages — **shipped in `packages/core/src/evaluation/corpus.ts:608-728`** (carried module, byte-stable).
  - R8: schema-version bump — **shipped as `mrgr-db/2`** with `USER_VERSION=2` and `SCHEMA_VERSION_STRING="mrgr-db/2"` in `packages/core/src/db/open.ts:9`. `types.ts` and `corpus.ts` are no longer the schema authorities — `packages/core/src/db/schema.ts` is.

### 3.6 M2a — mechanisms, statuses, determinism
- **State:** source groundwork stopped at candidate validation. `mrgr` port not started.
- **What is implemented (Round 5.1):** file-level content merge mechanisms (`git_text`, `gnu_diff3`, `mergiraf`) under fixed `/usr/bin/git merge-tree` orchestration; common error-preserving adapter (`merge-mechanism-driver.sh`, 188 lines, hardened); six-cell/18-arm contracts; deterministic preflight (`MECHANISM-PREFLIGHT.json`); schedule; adjudicator (`adjudicate.py`); Round 5 routing.
- **What the preflight proved:** five deterministic runs for each mechanism on both frozen fork legs, 340 adapter invocations per mechanism, nine native-proven Mergiraf paths, 47 fallback-or-equivalent paths. Adapter, preflight, and adjudicator self-tests pass. (`MECHANISM-PREFLIGHT.json`; Round 5.1 session record.)
- **Why it stopped:** `FRAME-LOCK.md` was invalidated. (a) Post-freeze drift: `FRAME-LOCK.md` was written at `13:58:23Z`; both agent contracts and `SCHEDULE.json` changed at `13:59:15Z` and `14:06:21Z`. (b) Missing immutable model build: OMP exposes `openai-codex/gpt-5.6-sol` as a public selector but **no immutable `MODEL_BUILD`**. `MODEL-BUILD-FRAME-MISMATCH.json` records the stop; stale `FRAME-LOCK.md` removed.
- **What survives:** implementation design (the adapter, contracts, preflight, adjudicator). Reusable source implementation evidence for the `mrgr` port, **not** a mechanism or topology result.
- **STOP rule:** no arms launched; no claim about mechanism superiority, N-way benefit, or interaction.

### 3.7 Resurrection proof
- **State:** not started. The project's stated reason to exist. Scheduled before the oracle, before M1b/M2b consume M2a residue.
- **Inputs:** `ov2-base=b2d25948e9668982afcda5a9e4a515ff3fe08d97`, `base4-p=4a7299091d226d34baa593ba83c0af0d661bdbef`, `fork4-p=c687b532782dd6464e779f6f028361d0c427fb76`, `base6-p=83c6e7d4d4642629257aa1b0ef8eacc77fcaf954`, `fork6-p=9c25e84e4790283be52bba5df8a33e9ca15f1356`.
- **Gate:** derive the four deleted-test-monolith candidates from **reconstructed inputs**, not from final-ref inspection. The four monoliths are present marker-free in the intermediate join tree `2e393f45` (949,331 bytes) and absent from all six final refs. A finals-only audit returns zero candidates and the gate passes vacuously — that is the failure mode revision 1 introduced and revision 2 corrects.
- **Public gate:** synthetic repo with same topology, tiny files, shipped in tree and run in CI.

### 3.8 M1b / M2b / M3 / M4 / Replay / Agent adapter
- All not started, gated behind M2a residue and (for agent adapter) a valid H0 result.

---

## 4. Decisions already settled vs decisions still gated

### 4.1 Settled (do not re-open without new evidence)

| Decision | Choice | Source |
| --- | --- | --- |
| Product framing | Adjudicator-agnostic evidence/audit/provenance harness. Bring your own adjudicator (human, script, agent). | PLAN.md revision 2; corpus critique |
| Architecture | Schema-rejected records; independently recomputable evidence; gate vectors; append-only JSONL ledger; resurrection audit from deleted-set; halt as first-class. | PLAN.md |
| Package order | `@mrgr/core` first; everything else gated on evidence, not scheduled. | PLAN.md; STATUS.md |
| Mechanism M2a design | Three file-level content mechanisms (`git_text`, `gnu_diff3`, `mergiraf`) under fixed `ort`/`merge-tree` orchestration; resolution strategies are descriptive metadata, not a factor. | M2a plan §1; Round 5.1 session record |
| Status capture M2a | Record all four statuses separately: raw `git merge-file`, Mergiraf, low-level driver, outer Git. `Discarded` means *not returned as a usable result*, not *destroyed* — earlier in-core resolutions can remain reachable in the object DB. | `research/mergiraf-mechanism.md`; PLAN.md §3 D79 |
| `merge.default` choice | **Do not use `merge.default=mergiraf`.** Use per-attribute `merge=mergiraf` with explicit `merge=binary` macro for binary paths. This removes the class of failure D79 observed at the configuration level. | `research/mergiraf-mechanism.md` |
| M3 union semantics | Four axes, never one bit: side-A baseline-normalized test evidence · side-B baseline-normalized test evidence · composition-side baseline-normalized · human-checklist side. A fifth axis reports raw historical match — labelled **compatibility, not truth**. | PLAN.md §8; `research/adjudication-literature.md` |
| `debt` pattern | A named constant, a documented default, a test seam, and a **pinning test that never calls the seam and asserts a spelled-out literal**. | PLAN.md §7 |
| `halt` record | Reason and evidence required; denominators report `resolved / halted / failed / unsupported` separately. | PLAN.md |
| IDs in ledger | Content-derived or namespaced; never monotonic. | PLAN.md (D90 duplication) |
| Replay comparator | **Raw blob OID is primary pass signal**; normalized digest is descriptive, not binding. | PLAN.md §9; corpus critique |
| F1 reproducer | Conflict style opt-in via `ReplayOptions.conflictStyle`. Default behavior and `baselineId` unchanged. | findings/F1; closure evidence |
| H0 verdict on first run | Invalidated. | phases/h0/independent-review.md |

### 4.2 Still gated (do not pre-commit)

| Decision | Why gated |
| --- | --- |
| Whether selected evidence improves adjudication at matched model and cost | H0 redesign required (see §6) |
| Whether halt precision/recall/expected utility pays for itself at any plausible wrong-vs-review cost ratio | H0 redesign required |
| Whether to ship MCP / Claude Code plugin / TypeScript API / four-surface parity | H0 returns a valid non-INVALID verdict after acceptance gates pass (≥3 repos, ≥2 languages, no PRNG corruption, `fabricated_evidence_ids = 0` records — any-flag rule disqualifies, working human/scripted adjudicator harness) + working human/scripted adjudicator + consumer for each surface |
| Which entity parser, native package, grammar, Node version, config | M1b, on frozen M2a residue, with hand-marked blind set ≥20 units / ≥2 languages |
| Whether the bundled-Mergiraf install path is required | M2a per-attribute setup is the recommended path; needs runtime confirmation on the target host |
| Whether `merge-tree` ever changes a non-binary path's status on identical input across `git_text`/`gnu_diff3`/`mergiraf` arms | M2a port, not the Round 5.1 source experiment |

---

## 5. Dependency graph and critical path

```
M0-closure (rights attestation, doc correction, durable artifact)
    └─► M1a P0 (schema honesty, region identity, truncation metadata, persistence, error preservation)
            └─► M1a P1 (load-bearing tests: preimage semantics, multi-region, add/add, delete/modify, write/read round trip)
                    ├─► H0 redesign + rerun (killable, no answer-leakage, real preimages, baselines, independent-trial accounting)
                    │       └─► (positive) Agent adapter work — last, single surface
                    │       └─► (null) Retire agent adapter and `@mrgr/evidence-bundle`; ship `@mrgr/core` alone
                    └─► (independent of H0) M2a port to `@mrgr/mechanisms`
                            └─► M2a residue freeze
                                    ├─► Resurrection proof (private gate on pinned refs; public gate in CI)
                                    ├─► M1b entity extraction (frozen residue, ≥20 hand-marked, ≥2 languages)
                                    ├─► M2b residue composition + accounting (line-multiset + entity + relocation)
                                    ├─► M4 ledger (JSONL append-only with content-derived IDs)
                                    ├─► M3 verification (per-gate vector, four-axis union, no-pool)
                                    └─► Replay (characterization; efficacy gate after H0 supplies non-halt threshold)
**Critical path:** M0-closure → [M1a P0 [DONE: `mrgr-db/2`] → M1a P1 [DONE: `tests/db/` load-bearing tests] → H0 redesign → [H0 rerun 2026-08-29: raw `aggregate.json.verdict = "positive"` (characterization only); run **INVALID** per plan-rule (33 fabricated records); H0/WP8 gate NOT cleared — see §3.4)] ∥ M2a port] → M2a residue → (Resurrection proof ∥ M1b ∥ M2b) → M4 ledger → M3 verification → Replay → Agent adapter [H0/WP8 gate NOT cleared — INVALID run; gated on corpus diversity, PRNG fix, and working adjudicator harness].


**Independent critical sub-paths:** the resurrection proof does not depend on H0, M3, or M4 — it must move earlier in the queue to avoid the failure mode where the headline gate is the project's reason to exist and is scheduled after multiple packages.

**Hard preconditions that gate everything:**
1. `/home/svnbjrn/dev/mrgr` HEAD SHA re-pinned on disk; working tree re-hashed; no uncommitted edits to `packages/core/src/evaluation/corpus.ts` or to the carried-WP0 module under `scripts/carried.sha256`.
2. Rights attestation recorded in `NOTICE`.
3. README corrected to remove present-tense claims about absent packages.
4. F1 diff3 fix verified on a fresh `jqlang/jq` scan (`merge.conflictStyle=diff3` produces ≥1 exact region).
5. ~~`evidence/h0/REVIEW-2026-08-27.md` cited before any H0 rerun~~ (closed 2026-08-29: H0 rerun executed on `b87a064`; see §3.4 update + §23). The 2026-08-27 review remains the canonical evidence for the prior first-run invalidation and is preserved at `evidence/h0/REVIEW-2026-08-27.md`.

---

## 6. Ordered work packages

The ordering is binding: a unit that depends on a prior unit's frozen artifact may not start until the prior unit's gate has been re-run and its output is preserved.

### WP0 — M0-closure durable artifact and doc correction
- **Deliverable:** durable clean-clone artifact (pinned Node/pnpm/Git versions, frozen-lockfile install, typecheck, 120-test run, build, `verify-carried.sh` output, negative self-test, CLI smoke); corrected README (no absent packages, no present-tense mechanism invocation); corrected `NOTICE` (no `docs/method.md` reference, `GPL-3.0-only` Mergiraf, `GPL-3.0-or-later` diff3); recorded rights attestation.
- **Files/symbols:** `/home/svnbjrn/dev/mrgr/scripts/capture-evidence.sh` (re-run); `/home/svnbjrn/dev/mrgr/NOTICE`; `/home/svnbjrn/dev/mrgr/README.md`; `/home/svnbjrn/dev/mrgr/scripts/verify-carried.sh`.
- **Acceptance gate:** the artifact named in `phases/m0/closure-evidence.md` exists on disk, is content-equivalent to `phases/m0/closure-evidence.md` at the new commit, and is referenced from `STATUS.md`; `NOTICE` carries the rights attestation; `README.md` does not reference `docs/method.md`, `@mrgr/mergebase`, `@mrgr/entities`, `packages/mechanisms`, or absent mechanism invocation.
- **Verification commands/scenarios:** `git -C /home/svnbjrn/dev/mrgr rev-parse HEAD`; `sha256sum NOTICE README.md LICENSE`; `node -v && pnpm -v && git version`; `pnpm install --frozen-lockfile`; `pnpm -r typecheck`; `pnpm -r test` (expect 10 files / 120 tests); `pnpm -r build`; `./scripts/verify-carried.sh`; `./scripts/verify-carried-selftest.sh`; packaged CLI smoke against a nonexistent path expecting exit 1 and a structured error.
- **Artifacts to persist:** updated `closure-evidence.md`; `NOTICE` diff; `README.md` diff.
- **STOP rules:** any shipped file claiming "done," "green," or "clean-clone reproduced" before the artifact exists.
- **Rollback/failure:** the artifact is a markdown log; rollback is `git revert` of the doc edits. Rights attestation must precede publication; do not bypass.
- **Non-goals:** ship the `mrgr` package to npm in this WP. Build out additional packages.

### WP1 — M1a P0 schema honesty and persistence [DONE — landed as `mrgr-db/2`]
- **Status (2026-08-29):** DONE. The §6 description below is preserved as a historical record of the design intent. The actual delivery superseded several decisions via the SQLite persistence layer.
- **What landed:** `packages/core/src/db/` (14 source files: `result.ts`, `schema.ts`, `open.ts`, `corpus-store.ts`, `evidence-store.ts`, `ledger-store.ts`, `run-store.ts`, `blob.ts`, `import.ts`, `export.ts`, `cli.ts`, `llama-cpp-cli.ts`, `llama-cpp-run-store.ts`, `canonical.ts`). Schema `mrgr-db/2` (`USER_VERSION=2`, `SCHEMA_VERSION_STRING="mrgr-db/2"`, `APPLICATION_ID=0x6d726772`); JSONL demoted to transport; CHECK constraints enforce region identity, dependency_graph discriminator, evidence_bundle invariants. Carried files (`src/evaluation/*`, `tests/evaluation/*`) unchanged — `scripts/verify-carried.sh` passes.
- **Commits:** initial `00dd746 feat(db): mrgr-db/1 schema and fail-closed openDb via node:sqlite`; subsequent fixes and refactors; `fae9628 feat(m1a): reference preimages by Git blob OID (mrgr-db/2)` introduced the current schema version.
- **Supersedes:** all of the original WP1 deliverables (region identity, dependency_graph discriminator, parseCorpusRecord work, error preservation, schema-version bump) — the SQLite CHECK constraints enforce them at the storage layer rather than as in-memory TS types.
- **Files/symbols (historical design intent — pre-`mrgr-db`):**

### WP2 — M1a P1 load-bearing tests [DONE — landed in `tests/db/`]
- **Status (2026-08-29):** DONE. The §6 description below is preserved as a historical record. The actual delivery went via `tests/db/`, not `tests/evaluation/` as originally scoped.
- **What landed:** 12 test files in `tests/db/`: `open.test.ts`, `corpus-store.test.ts`, `evidence-store.test.ts`, `ledger-store.test.ts`, `llama-cpp-cli.test.ts`, `llama-cpp-run-store.test.ts`, `run-store.test.ts`, `blob.test.ts`, `cli.test.ts`, `import.test.ts`, `export.test.ts`, `concurrency.test.ts`. Total: 108 invocations covering preimage source semantics, multi-region, add/add, delete/modify, write/read round-trip, idempotency, concurrency (D90 class), and the canonical byte-deterministic export determinism gate. The earlier `tests/m1a/` directory (forensic + sidecar) has 41 more invocations across 2 files (R3 work).
- **Supersedes:** the §6 description's `tests/evaluation/evidence-roundtrip.test.ts`, `tests/evaluation/region-identity.test.ts`, etc. — those paths do not exist on disk; the equivalent coverage is in `tests/db/` instead. The acceptance gate ("10 files / 120 tests minimum") is no longer the right shape: 24 files / 232 invocations total (see §3.5).
- **Files/symbols (historical design intent — pre-`mrgr-db`):**

### WP3 — H0 redesign
- **Deliverable:** an H0 plan that satisfies all five independent-review defects simultaneously, plus a pinned corpus and adjudicator.
  1. **Remove developer-resolution leakage.** The `triple.resolution` string never appears in any arm's prompt; the system prompt never references it; if the system prompt must mention "developer's merge" it does so abstractly and the developer-resolution is sourced exclusively through evidence-id retrieval.
  2. **Provide real preimages.** Wire the F1-fixed `localize.ts` to emit full parent files (uncapped), or accept a named trade-off: prefix with explicit `preimage_truncated: true` + `original_byte_length` from `Buffer.byteLength(original, "utf8")`. If truncation is necessary, the cap is **1,200 UTF-16 code units** as a documented compromise and no arm is labelled "full file" without explicit `preimage_truncated: false`.
  3. **Add trivial baselines.** Constant `keep_ours`, `keep_theirs`, `compose` (the current asymmetric grader's `compose` rule) all run as standalone arms; one trivial heuristic (e.g., "if both sides have ≥1 shared line of length >3, choose compose") runs as a baseline. The kill condition is computed against the **best trivial baseline**, not against zero.
  4. **Independent-trial accounting.** With `temperature: 0.0` the three repeats are not independent. Either (a) use `temperature > 0` (e.g., 0.7) and aggregate a non-trivial fraction of trials, or (b) report per-triple per-arm correct as a binary vector and run a paired test against the constant baseline; do **not** sum three identical counts as three independent decisions.
  5. **Reachable kill rule.** Define the kill condition in *number-of-trials-on-which-the-arm-was-correct* with a magnitude threshold (e.g., the arm's wrong-vs-baseline-wrong delta must be ≥ N triples at Fisher exact p < 0.05). The kill rule must be reachable when both selected and full bundles return null against the best baseline.
- **Additional binding requirements:** frozen corpus of 20–30 exact-localized, dev-resolved conflicts across ≥3 repos and ≥2 languages; explicit "primary set" of permissively-licensed public repos with committed developer resolutions (`jqlang/jq` already scanned; pick two more from `redis/redis` (BSD-3), `cli/cli` (MIT), `tldraw/tldraw` (Apache-2.0)); explicit "secondary, contaminated set" of Orca arm conflicts reported separately and never pooled; pinned model with recorded SHA in code (`H0_MODEL_TAG` + `MODEL_SHA` constants; not via `ollama show` because this host has no Ollama — the actual backend is `llama-server` on `127.0.0.1:8089`); explicit prompt contract with three sections (system fixed text, evidence quoted with `[source:<id>]` and rejected on fabricated ids, response shape fixed as JSON with `decision` and `reason ≤ 200 tokens`); resumable runner with atomic rename (`umask 077`, `mktemp` beside the file, `flock` for shared access).
- **Files/symbols (target tree):** new `src/h0-runner.ts`; updated `src/replay.ts` (already computes identical baselineIds); existing `src/agentio.ts` (NDJSON envelope); existing `src/runGit.ts`.
- **Acceptance gate:** the H0 plan, the frozen corpus (`evidence/h0/corpus.json`), and the pinned model spec (recorded as `H0_MODEL_TAG` + `MODEL_SHA` constants in code — **not** as a separate `evidence/h0/model.txt` file; that file does not exist on this host) all exist; the redesigned runner emits per-triple JSONL records with `schema_valid: true`; the kill branch is reachable by construction; one hand-picked triple is hand-scored to verify the arm outputs differ.
- **Verification commands/scenarios:** `sha256sum corpus.json` identical across three runs of the freeze; `jq '.repos | length' corpus.json` ≥ 3; `jq '.triples_total' corpus.json` ≥ 20; `mrgr-wp0 h0 --corpus evidence/h0/corpus.json --arm selected --out evidence/h0/runs/selected-001.jsonl` runs to completion in <2 hours wall time on `vinbonesjr` with the pinned Qwen family; the `fabricated_evidence_ids: true` negative check fires when an ID is inserted into `corpus.json`.
- **Artifacts to persist:** redesigned plan; frozen corpus JSON + SHA-256; pinned model spec + SHA-256; per-arm JSONL runs; per-arm aggregation JSON; verdict JSON.
- **STOP rules:** any arm whose prompt references `triple.resolution`; any "full bundle" arm whose preimage is a relabeled hunk; any aggregation that sums three `temperature: 0.0` runs as independent; any kill branch whose numerator and denominator are both zero; any single-triple delta claimed as positive without a Fisher exact test.
- **Rollback/failure:** H0 is research; rollback is keeping the prior (invalidated) corpus and rerunning. **Do not** claim a positive verdict on the prior data.
- **Non-goals:** build `@mrgr/evidence-bundle` as a separate package — bundle emission stays inside `@mrgr/core` until H0 returns a valid non-INVALID verdict after acceptance gates pass (≥3 repos, ≥2 languages, no PRNG corruption, `fabricated_evidence_ids = 0` records — any-flag rule disqualifies, working human/scripted adjudicator harness).

### Work package 4 (H0 rerun) — gated on Work package 3 completion
- **Deliverable:** three arm runs (hunk-only / selected / full-bundle), per-arm aggregation JSON, verdict JSON, README section `## H0 result (frozen 2026-MM-DD)` with corpus size, language spread, n, four columns (`correct · wrong · halt · token cost`), historical-match and test-outcome separate columns, derived break-even wrong:halt cost ratio, explicit verdict.
- **Acceptance gate:** at least one valid arm that beats the best trivial baseline by a magnitude threshold; Fisher exact test with declared significance level on the delta; kill branch reachable (either killed or not, both acceptable).
- **STOP rules:** the original H0 plan's "STOP the agent adapter if selected evidence is no better than hunk-only after cost and false-accept accounting, or if forced resolution dominates halt at any plausible cost ratio" applies. A null H0 retires the agent adapter and `@mrgr/evidence-bundle`; the forensic core ships alone.
- **Non-goals:** rerun to reach the predicted positive outcome.

### WP5 — M2a port to `@mrgr/mechanisms` (parallelizable with the H0 rerun)
- **Deliverable:** `@mrgr/mechanisms` package implementing the file-level content merge mechanism under fixed Git `ort`/`merge-tree` orchestration, ported from `experiment/round5/tools/merge-mechanism-driver.sh` (188 lines). Status capture records all four statuses (raw `git merge-file`, Mergiraf, low-level driver, outer Git) separately. Per-attribute `merge=mergiraf` registration; explicit `merge=binary` macro on binary patterns. D79-style mixed fixture: prove earlier in-core text result is preserved in the returned tree; route binary path to explicit fallback; record fallback; never silently skip.
- **Files/symbols:** new package `packages/mechanisms/`; new `packages/mechanisms/src/adapter.ts` (or `.sh`); `packages/mechanisms/src/registry.ts`; tests under `packages/mechanisms/tests/`.
- **Acceptance gate:** git_text adapter equivalence to measured Git-ort baseline (proved before any rate comparison); five deterministic runs on a small fixture produce identical tree OIDs; mixed binary abort preserves earlier text resolution; status layers reported separately; per-attribute registration tested with `merge=binary` for binary patterns.
- **Verification commands/scenarios:** `pnpm -r test` (full workspace); `pnpm -r build`; adapter self-test; preflight on `experiment/baseline/scratch`; D79-style mixed merge fixture.
- **STOP rules:** mixed binary abort loses earlier text resolution; status layers conflated; timeout fallback counted as clean; same-input OID drift; raw cross-mechanism byte distance used as the only comparison.
- **Rollback/failure:** the package is additive; rollback is `git revert` or deletion before any merge.
- **Non-goals:** build the union oracle, the entity extraction, or the resurrection proof in this WP.

### WP6 — Resurrection proof (move here, before oracle)
- **Deliverable:** private gate reconstruction from `ov2-base`, `base4-p`, `fork4-p`, `base6-p`, `fork6-p`; audit derives the four deleted-test-monolith candidates from **reconstructed inputs** (not from final-ref inspection); post-edit audit finds zero candidates and all four absent; public gate ships a synthetic repo with the same topology and tiny files in `tests/fixtures/resurrection-topology/` and runs in CI.
- **Files/symbols:** new `packages/core/tests/resurrection.test.ts` (private gate); new `packages/core/tests/fixtures/resurrection-topology/` (public gate); CI wiring.
- **Acceptance gate:** four candidates derived from reconstructed inputs exactly match the four monoliths (949,331 bytes total in `2e393f45`); public-gate fixture reproduces the same positive result on a synthetic repo; CI runs the public gate on every push.
- **STOP rules:** any audit operating only on final refs (that is the revision-1 failure mode); marker or prose dependency in candidate detection; false positive on clean additions; byte or count mismatch.
- **Non-goals:** ship the public gate before the private gate is verified; combine with M1b/M2b/M3/M4 work.

### WP7 — M1b / M2b / M3 / M4 / Replay (each separately gated behind M2a residue)
- Each is a future work package. Sequencing rule: M1b requires ≥20 hand-marked units across ≥2 repos **before** execution; M2b requires frozen M2a residue; M3 requires compile-event instrumentation from the start (retrofitting is impossible); M4 requires D90-style concurrent-record-collision test; Replay is characterization-only until H0 supplies a non-halt threshold.

### WP8 — Agent adapter (last, conditional, single surface)
- **Deliverable:** one surface, not four. Built only after a valid positive H0 and a working human/scripted adjudicator. Evidence quoted, tagged with provenance, structurally separate from instructions.
- **STOP rules:** any package size > current `@mrgr/core` baseline without a justified reason; any "constrains"-adjacent wording without a verified bypass test.

---

## 7. H0 redesign requirements (preventing repetition of the invalidated experiment)

The five defects must be addressed by construction, not by post-hoc reporting:

1. **No answer leakage.** Audit every prompt for `triple.resolution`, `triple.*`, or any string that contains the developer's merge output. If the system prompt mentions "developer's resolution," it must be abstract; the only path to that text is via an evidence-id retrieval that the grader verifies.
2. **Real preimages or explicit truncation.** Either deliver full parent files (uncapped) via `git show <parent>:<path>` and `Buffer.byteLength(original, "utf8")` for the original byte count, or deliver prefix + `preimage_truncated: true` + `original_byte_length` + truncation flag. No arm is labelled "full preimage" unless `preimage_truncated: false` is asserted.
3. **Trivial baselines.** `keep_ours`, `keep_theirs`, `compose` (current asymmetric grader rule), and one hand-coded heuristic run as standalone arms. The kill condition is computed against the best trivial baseline's wrong count, not zero.
4. **Independent trials.** With `temperature: 0.0` the three repeats are not independent. Use `temperature > 0` (e.g., 0.7) and report per-triple correct as a binary vector; aggregate with a paired test against the constant baseline. Do **not** sum identical per-run counts.
5. **Reachable kill rule.** Define magnitude + significance. A valid positive is "arm correct on ≥N more triples than the best trivial baseline at Fisher exact p < 0.05." The kill branch's numerator/denominator must be non-zero by construction; verify by hand that the kill condition fires when both arms return null against the best baseline.

Additional binding constraints from the corpus review:
- Frozen corpus of 20–30 exact-localized, dev-resolved conflicts across ≥3 repos and ≥2 languages; the Orca arm corpus is contaminated and reported separately, never pooled.
- Pinned model + recorded SHA (in code: `H0_MODEL_TAG` + `MODEL_SHA` constants in `_h0_runner.ts`; **not** via `ollama show` — this host has no Ollama); pinned Node, llama-server, OS versions.
- Resumable runner with atomic rename (`umask 077`, `mktemp` beside the file, `flock` for shared access).
- Three-arm cost accounting: `wrong:halt` cost ratio derived from data after the run, not preregistered.
- Predicted outcome (Rover/ConGra direction) written down *before* the run so the data can refute it; a null H0 is recorded, not re-run to reach positive.

---

## 8. M1a schema/persistence/identity/error/test requirements

Preserving the 1,200 UTF-16 code-unit semantics:

- **Implementation truth:** `CAP = 1200` truncates with JavaScript `string.length` / `slice(0, CAP)`. The cap is **1,200 UTF-16 code units, not 1,200 bytes**.
- **Public contract:** the `EvidenceBundleSchema` exposes `preimage_truncated: boolean`, `preimage_byte_length_original: number` (computed from `Buffer.byteLength(original, "utf8")` of the parent blob before any UTF-16 truncation), and a `preimage_bytes_truncated: number` field equal to `preimage_byte_length_original - Buffer.byteLength(preimage, "utf8")` when truncated. If the contract truly requires full files, the cap is removed and these fields become unused.
- **Identity:** bundle identity is `(conflict_path, conflict_ordinal)` per region *or* `(conflict_path, conflict_hunks[])` per file. The decision is documented in code review and reflected in the schema. Adding only `conflict_path` is insufficient for multi-region files.
- **Persistence:** `parseCorpusRecord` parses `evidenceBundles`; `readCorpus` preserves them; the CLI test calls `parseCorpusRecord`, not `JSON.parse`. A round-trip test asserts the bundles survive write/read.
- **Errors:** extraction failures are preserved per `(conflict_path, conflict_ordinal)` rather than silently dropped. Absent-path-as-null is preserved; missing-revision / Git failure become typed errors.
- **`dependency_graph`:** path-only. If dependency derivation fails, a derived/unpopulated discriminator is exposed; the field does not encode hunk payloads.
- **Tests:** P1 tests assert preimage source semantics, multi-path and multi-region cases, add/add, delete/modify, one per-path extraction failure, write/read round trip.
- **Schema version:** if any field's contract changes, schema version is bumped before publishing schema v2; `types.ts` and `corpus.ts` are the high-blast-radius authorities (`local/semantic-merge-consolidation-research/phase1-assets-and-seams.md:32,38`).
- **Nullable stages:** `add/add` and `delete/modify` cases must return null for the absent side, not error.

---

## 9. M0 publication-rights disposition

- **Status:** technical gates complete; publication blocked by the unrecorded rights attestation.
- **What is publishable today, after rights attestation + doc correction:** `@mrgr/core` (Apache-2.0, 120 tests, 24 byte-verified carried files, pinned Node/pnpm/Git/Linux in the durable artifact, corrected README, corrected NOTICE).
- **What is NOT publishable today, regardless of rights:** any package that does not exist; any mechanism driver that is not implemented (the README and NOTICE must move mechanism invocation to future tense).
- **Required WP0 outputs before publication:**
  1. Rights attestation recorded in `NOTICE`. Until then, do not publish.
  2. README removes references to `docs/method.md`, `@mrgr/mergebase`, `@mrgr/entities`, `packages/mechanisms`, and present-tense mechanism invocation.
  3. NOTICE corrects GPL-3.0-only Mergiraf and GPL-3.0-or-later diff3 wording.
  4. The M0 closure evidence is durable (re-runnable from a clean clone at the new commit).

---

## 10. M2a / Round 5.1 boundaries and prerequisites

- **Boundary:** M2a in `mrgr` is the *port* of the Round 5.1 source experiment to `@mrgr/mechanisms`. The Round 5.1 source experiment itself produced implementation design but no result.
- **Round 5.1 design (reusable):** three file-level content mechanisms (`git_text`, `gnu_diff3`, `mergiraf`) under fixed `ort`/`merge-tree` orchestration; six-cell/18-arm contracts; deterministic preflight; schedule; adjudicator (`adjudicate.py`); per-attribute `merge=mergiraf` setup; explicit `merge=binary` macro on binary patterns; four-status capture.
- **Prerequisites the Round 5.1 source experiment also required:** immutable `MODEL_PROVIDER`, `MODEL_ID`, `MODEL_BUILD` before freezing. OMP exposes only a public selector; an immutable `MODEL_BUILD` is not available. The `mrgr` port does not require `MODEL_BUILD` for the mechanism layer — the port tests adapter equivalence and D79-style mixed fixtures, not the model-driven fork-composition experiment. The model-driven experiment stays a separate question.
- **What survives:** the adapter, the contracts, the preflight, the schedule, the adjudicator.
- **What does NOT survive:** the intermediate `FRAME-LOCK.md` (invalidated by post-freeze contract drift + missing `MODEL_BUILD`); any claim that a mechanism × topology contrast was run (zero arms launched).
- **Hard rule:** the `mrgr` M2a port must **not** claim the source experiment's result. It must re-prove adapter equivalence on the target host, re-prove the mixed-fixture binary guard, and re-prove status-layer separation.

---

## 11. Risk register

| Risk | Detection | Mitigation |
| --- | --- | --- |
| Concurrent drift in `/home/svnbjrn/dev/mrgr` | `git -C /home/svnbjrn/dev/mrgr status`; SHA-256 of `packages/core/src/evaluation/{corpus.ts,types.ts,cli.ts}` before edit | Re-pin HEAD on disk; re-hash edited paths after each commit; rebase vs `master` before opening any PR |
| Silent carry-file mutation under `/home/svnbjrn/dev/mrgr/scripts/carried.sha256` | `./scripts/verify-carried.sh` exit code; `./scripts/verify-carried-selftest.sh` | Run both before every M1a commit; if a carried file must change, update the manifest deliberately |
| Stale `semantic-merge/docs/M1a-evidence-bundles.md` "Completed" claim read as authoritative | grep against the corpus-review addendum | Pin the corpus-review addendum in the durable artifact; cross-link from `STATUS.md` |
| Re-deriving the invalidated H0 experiment | grep for `triple.resolution` in arm prompts; per-arm temperature audit | WP3 audits the prompt contract for answer leakage; `temperature > 0` and Fisher exact test are required |
| M2a adapter equivalence drift | five-run determinism probe | Run preflight before any rate comparison; mixed-fixture binary guard test |
| M3 pass-vacuously on no oracle | M3 gate vector entry count zero | Every gate must declare an oracle; "no oracle configured" means "verified nothing" |
| D79-class mixed merge losing earlier text resolution | mixed-fixture test | Pre-audit D79 corpus record; status-layer separation; preserve `in_core_*` text result explicitly |
| Resurrection proof passing vacuously on finals-only audit | audit operates on reconstructed inputs, not final refs | The private gate is `git log` + reachability on the *joined* tree, not the final refs |
| D90-style duplicated ledger block | `id`-uniqueness check at every append | Content-derived or namespaced IDs; concurrent-write smoke test |
| License-coupling risk with Mergiraf | `merge.default=mergiraf` in shipped config | Per-attribute `merge=mergiraf` + `merge=binary` macro; subprocess boundary preserved |
| Vacuous pinning test (`expect(getX()).toBe(DEFAULT_X)`) | code review on `debt` records | Spelling-out-literal pinning test that does not call the seam |
| Compile-event instrumentation drift | M3 instrumentation retrofitted late | M3 instrumented from the start; `syntax-blocked` fix documented and applied |
| `temperature: 0.0` repeats treated as independent | per-run identical counts | `temperature > 0` or non-summed binary vector + Fisher exact |

---

## 12. Evidence ledger (for `/plan` traceability)

| H0-R2 | **Run INVALID** (33 records with `fabricated_evidence_ids > 0` per `h0-rerun-after-redesign-plan.md:117`). Raw `aggregate.json.verdict = "positive"` (characterization only) for the count-based comparison; the run is invalid. 540 records; redesign chain commits `66828ab`, `9f054d7`, `8bb9804`, `1016192`, `417fba2`, `6d3fe99`, `b87a064` | `evidence/h0/REVIEW-2026-08-29.md`; `evidence/h0/aggregate.json`; `.do-not-commit/planning/STATUS.md` H0 row updated 2026-08-29 |
| H0-R1 | first run invalidated; 5 fatal defects; F1 fix + 862-unique corpus + resumable plumbing survive | `phases/h0/independent-review.md` |
| M0-E1 | clean-clone install / typecheck / 120 tests / build / carried-file verification / negative self-test / CLI smoke all PASS | `phases/m0/closure-evidence.md` |
| M0-E2 | rights attestation NOT recorded; publication blocked | `phases/m0/NOTICE.snapshot`; `STATUS.md` M0-closure row |
| F1-E1 | diff3 fix at `ed92803`; 0 → 377 exact regions on `jqlang/jq` | `findings/F1-exact-localization-unreachable.md`; `phases/m0/F1-exact-localization-unreachable.md` |
| M1a-R1 | hermetic fixture + raw `scan-local` assertions pass | `phases/m1a/integration-tests-plan.md` |
| M1a-R2 | preimage contract truncated at 1,200 UTF-16 code units; byte count must come from `Buffer.byteLength(original, "utf8")` | `phases/m1a/integration-tests-plan.md`; `src/forensic/core.ts:5,13,27-52` |
| M1a-R3 | structural-honesty test does not assert preimage-vs-hunk inequality or plausible size | `phases/m1a/integration-tests-plan.md` |
| M1a-R4 | `parseCorpusRecord` drops `evidenceBundles`; CLI test casts `JSON.parse` | `phases/m1a/integration-tests-plan.md` |
| M1a-R5 | `dependency_graph` mixes hunk payloads with path entries | `phases/m1a/integration-tests-plan.md` |
| M1a-R6 | H0 utility claim refuted | `phases/m1a/integration-tests-plan.md`; `phases/h0/independent-review.md` |
| M1a-R7 | nullable stages required by WP0 merge-replay semantics | `phases/m0/wp0-merge-replay.md:51-54,67` |
| M1a-R8 | `types.ts` and `corpus.ts` are schema authorities | `local/semantic-merge-consolidation-research/phase1-assets-and-seams.md:32,38` |
| M2a-S1 | Round 5.1 adapter / preflight / schedule / adjudicator implemented; preflight PASS | `sources/sessions/fork-composition-round5-1-…md`; `MECHANISM-PREFLIGHT.json` |
| M2a-S2 | `FRAME-LOCK.md` invalidated; post-freeze contract drift + missing immutable `MODEL_BUILD` | `sources/sessions/fork-composition-round5-1-…md`; `MODEL-BUILD-FRAME-MISMATCH.json` |
| M2a-S3 | zero arms launched; no mechanism/topology result | `sources/sessions/fork-composition-round5-1-…md` |
| LIT-1 | Rover (arXiv:2605.17279v1) and ConGra (arXiv:2409.14121v1): selected/dependency context helps; naïve adjacent context usually hurts | `research/adjudication-literature.md` |
| LIT-2 | Merge-Bench (arXiv:2605.25890v1) is test-free; metric is normalized source-text match, not semantic correctness; use companion README's labels, not arXiv HTML table captions | `research/adjudication-literature.md` |
| LIT-3 | AgenticFlict (arXiv:2604.03551v2, AIware'26 DOI `10.1145/3805760.3814923`) is `git merge --no-commit --no-ff` + marker parsing — textual only | `research/adjudication-literature.md` |
| LIT-4 | Two distinct 79.4% figures: PLAN.md's Codex share (23,520/29,609 = 79.44% conflict share; 73,856/107,026 = 69.01% PR share) is arithmetically valid; Xu et al. (arXiv:2607.04697v2) report a different 79.4% (26,691/33,596 of all agent PRs co-active with another agent PR at k=0) | `research/adjudication-literature.md`; `PLAN.md` |
| LIT-5 | SAM (JSS 214:112070), TOM/MCon4J (SCIS 65:199103) implement parent-side behavioural predicates; union oracle is **not novel at the mechanism level**, may be novel at the integration | `research/adjudication-literature.md`; `reviews/mrgr-agent-harness-plan-critique.md` |
| MM-1 | Mergiraf v0.19.0 = commit `7246b03c08c02248035bc20668fde1edf94a09e0`; "discarded" means *not surfaced*, not *destroyed*; in-core blobs may remain reachable | `research/mergiraf-mechanism.md`; `merge-ort.h` |
| MM-2 | `merge.default=mergiraf` is valid configuration but not the recommended one; per-attribute `merge=mergiraf` + `merge=binary` macro removes the D79 failure class at configuration level | `research/mergiraf-mechanism.md` |
| MM-3 | status capture must record all four layers (raw `git merge-file`, Mergiraf, low-level driver, outer Git) separately | `research/mergiraf-mechanism.md`; PLAN.md §3 |
| STALE-1 | `today-2026-08-26.md` says H0 was positive; superseded by `phases/h0/independent-review.md` | `STATUS.md` evidence precedence |
| STALE-2 | `semantic-merge/docs/M1a-evidence-bundles.md` says "Completed"; superseded by `phases/m1a/integration-tests-plan.md` corpus-review addendum | `STATUS.md` |
| STALE-3 | `projects-mrgr/experiment/docs/M0.md` is a misplaced M1a duplicate; not independent evidence | `SOURCES.md` |

---

## 13. Completion definition

The canonical plan is "complete enough for `/plan` to consume" when:

1. The current state of every milestone is named and pinned to a source-of-truth file in `planning/mrgr/`.
2. The dependency graph is explicit; no milestone is scheduled to depend on a non-existent artifact.
3. The `STOP` rules from `PLAN.md` are reproduced in §11 of this artifact and matched to the milestone they bind.
4. The H0 redesign requirements are specific enough that a planner cannot accidentally re-derive the invalidated experiment.
5. The M1a schema/persistence/identity/error/test requirements preserve the 1,200 UTF-16 code-unit semantic and original UTF-8 byte-count contract.
6. M0 publication rights are named as the only remaining M0 blocker; the doc correction list is concrete.
7. M2a is bounded as a *port*, with explicit non-claim about the source experiment's result.
8. The kill-safe outcome is reproduced as the answer to a null H0.

---

## 14. Explicit non-goals

- Implementing code in this turn.
- Re-running the invalidated H0 experiment on the old data.
- Claiming any Round 5.1 mechanism or topology result.
- Promoting `@mrgr/core` to npm until rights attestation + doc correction land.
- Building `@mrgr/evidence-bundle`, `@mrgr/mechanisms`, `@mrgr/ledger`, `@mrgr/oracle`, `@mrgr/entities`, `@mrgr/agent`, `@mrgr/mergebase` before their governing gates close.
- Shipping MCP, the Claude Code plugin, JSON CLI, TypeScript API, and four-surface parity in a single surface.
- Re-deriving the project's stated reason to exist (resurrection proof) after the oracle.
- Pooling Orca arm conflicts into the H0 primary corpus.
- Treating `merge-tree`'s default conflict style as sufficient for real-repository localization.

---

## 15. Self-attack (Phase 4)

### 15.1 What changed after the attack

| Attack | What it exposed | What was revised |
| --- | --- | --- |
| Circular dependencies | None at milestone level. At work-package level: Work package 3 (H0 redesign) and Work package 4 (H0 rerun) could be misread as circular with WP1/WP2 if a planner thinks "fix the corpus before redesigning H0." | Added §5 explicit declaration that M1a P0/P1 precedes H0 redesign and H0 redesign precedes any rerun. WP1's STOP rules explicitly forbid H0 rerun. |
| Unfalsifiable gates | (a) H0's `kill condition met: false` from the original run was unfalsifiable (`Infinity`). (b) M3's `UNION_PASS` single bit was unfalsifiable. (c) M4's resurrection proof passing on finals-only inspection is unfalsifiable. | (a) Replaced by reachable kill rule with magnitude + Fisher exact. (b) Replaced by four-axis reporting. (c) Resurrection proof moves earlier and the gate is reconstructed inputs, not finals. |
| Accidental claims from stale evidence | `today-2026-08-26.md` says "H0 complete; verdict positive"; `semantic-merge/docs/M1a-evidence-bundles.md` says "Completed"; `projects-mrgr/experiment/docs/M0.md` duplicates M1a narrative under wrong project/milestone. | The evidence ledger flags all three as `STALE-*` and the §1.5 supersession rule pins `STATUS.md` and the corpus-review addendum as authoritative. |
| Tasks too vague to execute | "Fix M1a" was vague in PLAN.md (10 lines, no test names). The corpus-review addendum adds evidence tags and P0/P1/P2 ordering. | The WP1/WP2 units name specific files/symbols (`packages/core/src/evaluation/corpus.ts:608-728`, `cli.ts:242-251`, `types.ts`, `forensic.test.ts:99-108`, `cli.test.ts:99-108`) and specific tests (`evidence-roundtrip.test.ts`, `region-identity.test.ts`, `add-add.test.ts`, `delete-modify.test.ts`, `extraction-failure.test.ts`). |
| Overfit to invalidated H0 | The plan could be read as "H0 failed; do M1a anyway." The M1a addendum's R6 already corrects that. | §4.1 explicitly settles "H0 verdict on first run = invalidated"; §4.2 lists the H0 questions still gated. WP3 explicitly requires removing answer leakage, providing real preimages, and adding trivial baselines — i.e., the redesign is structural, not cosmetic. |
| Premature coupling of M1a, H0, M2a | M1a H0 redesign and M2a port are both downstream of M1a P0/P1, but M2a port is independent of H0. | §5 critical-path diagram shows H0 redesign and M2a port as parallelizable after M1a P1; §6 Work package 4 and Work package 5 are explicitly parallelizable. |
| Smaller plan / deletion | WP7 / WP8 may be premature to enumerate in detail. | WP7 / WP8 are placeholders for future work packages with explicit gating conditions; they are not committed in this round. |
| Provenance / licensing / reproducibility | Mergiraf `GPL-3.0-only`; diff3 `GPL-3.0-or-later`; WP0 source ledger; rights attestation. | §9 publication rights + WP0 STOP rules + MM-2 per-attribute setup cover the licensing surface; provenance ties to `closure-evidence.md` and `MECHANISM-PREFLIGHT.json`. |
| Concurrent drift | `/home/svnbjrn/dev/mrgr` not in workspace; cannot re-hash before yielding. | §1.1 flags `UNKNOWN` and §11 lists concurrent drift as risk #1 with detection + mitigation. |
| M3 "no oracle means verified nothing" | Easy to miss when M3 is the verification phase. | §4.1 (settled) and §11 risk register repeat the rule. |

### 15.2 What remains risky

1. **Path translation.** The M1a addendum names paths like `src/evidence.ts` and `src/forensic/core.ts` that may not exist at those prefixes; `local/planning-next-phase-research.md:35-43` warns the `src/forensic/core.ts` references may resolve to a new-module target under `packages/core/src/evaluation/`. A planner must verify the exact path on disk before editing.
2. **Carried-file manifest staleness.** If any of the 24 carried files must change, the manifest update must be deliberate; if the executor adds a new file, the manifest must reject it.
3. **`MODEL_BUILD` substitute.** The Round 5.1 audit found OMP exposed only a public selector; the audit's `MODEL-BUILD-FRAME-MISMATCH.json` records the stop. The M2a port does not need `MODEL_BUILD` (it tests adapter equivalence, not model-driven arms), but if a planner conflates "M2a port" with "rerun the Round 5 experiment," they will hit the same stop. WP5 is explicit: re-prove adapter equivalence on the target host; do **not** model-driven-arm the port.
4. **Schema-version bump.** If M1a P0 changes any field's contract, schema v2 must be republished; `types.ts` and `corpus.ts` are the load-bearing authorities.
5. **The 1,200-UTF-16-vs-bytes semantic is subtle.** A planner who reads `CAP = 1200` and assumes bytes will regress the truncation contract. The §8 public contract and §1.3 version pinning carry the distinction.

---

## 16. Committed recommendations (Phase 5)
| # | Commitment | Why | Dependency | Next action | Acceptance gate | Risk | Effort |
|---|---|---|---|---|---|---|---|
| 1 | **Run WP0 (M0-closure) first** | Rights attestation + doc correction are the only M0 blockers; durable artifact is a precondition for every downstream claim in shipped files | None | Record rights attestation in `/home/svnbjrn/dev/mrgr/NOTICE`; correct README; re-run `capture-evidence.sh` | `NOTICE` carries attestation; README removed absent-package claims; `closure-evidence.md` re-derives from a fresh clean clone | Doc correction may regress SEO copy; rights attestation needs human sign-off | Small (1–2 days) |
| 2 | **WP1 (M1a P0) DONE — landed as `mrgr-db/2`** | M1a P0 work shipped via the SQLite persistence layer (commit `00dd746` introduced `mrgr-db/1`; commit `fae9628` introduced `mrgr-db/2`). The carried WP0 module is unchanged and `scripts/verify-carried.sh` passes. **The §16 commitment as written was based on a stale "M1a partially complete" reading; the work landed between plan authoring and consolidation.** | WP0 | None for the persistence layer itself | `packages/core/src/db/` (14 source files, 13 test files); `docs/superpowers/specs/2026-08-28-persistence-layer-design.md`; 108 db tests green per `STATUS.md`; `packages/core/src/db/open.ts` exports `APPLICATION_ID=0x6d726772`, `USER_VERSION=2`, `SCHEMA_VERSION_STRING="mrgr-db/2"` | The superpowers plan/specs reference `mrgr-db/1`; the actual shipped schema is `mrgr-db/2` (the plan was authored post-hoc and never had its 56 checkboxes flipped) | Done (multiple commits, ~14 commits from `00dd746` to `fae9628` and beyond) |
| 3 | **WP2 (M1a P1) DONE — load-bearing tests landed in `tests/db/`** | The P1 load-bearing tests (preimage semantics, multi-region, add/add, delete/modify, extraction failure, write/read round-trip) live in `tests/db/` and run green; 108 db tests total. The `tests/m1a/` directory has the earlier R3 forensic tests (41 invocations). | WP1 | None for the test suite itself | `tests/db/{corpus-store,evidence-store,ledger-store,llama-cpp-cli,llama-cpp-run-store,run-store,blob,cli,import,export,concurrency,open}.test.ts` (108 invocations across 12 files) | Same vitest 2 vs vitest 3 superpowers staleness — vitest is actually `^3.2.7` | Done |
| 4 | **Run WP3 (H0 redesign) fourth** | The H0 question is still open; the current run is invalid | WP2 | Write the redesigned plan; pin corpus; pin model; write runner | Plan satisfies all five defects; runner emits valid JSONL; kill branch reachable | Resolving answer leakage may require re-scanning the corpus | Medium (3–5 days) |
| 5 | **WP4 (H0 rerun) DONE 2026-08-29 — INVALID per plan-rule** | Rerun on `b87a064` (redesign chain landed) produced 540 records (30 triples × 3 repeats × 6 arms). full-bundle wrong=28 < hunk-only wrong=32; honest_signal=true; kill_condition not met. Raw `aggregate.json.verdict = "positive"` (characterization only). **Run INVALID per plan-rule** (`h0-rerun-after-redesign-plan.md:117`: 33 records with `fabricated_evidence_ids > 0`). | WP3 | None for the rerun itself; future valid rerun requires PRNG fix + citation-validity fix + ≥3 repos / ≥2 languages | `evidence/h0/REVIEW-2026-08-29.md` + `aggregate.json` + per-arm JSONLs in `evidence/h0/runs/*-2026-08-29T05-51-13-934Z.jsonl`; verdict INVALID per plan-rule | Plan-text vs aggregator divergence (5pp gap not met; verdict INVALID regardless); fabricated-IDs regex counts natural-language side labels; trivial_ceiling uses full 862-triple denominator vs 30-triple subsample | Done (INVALID) |
| 6 | **Run WP5 (M2a port) sixth, parallelizable with the H0 rerun** | The `mrgr` mechanism layer is independent of H0 | WP2 | Port the Round 5.1 adapter; write status-layer tests; D79 mixed-fixture test | git_text equivalence to Git-ort; mixed-fixture preserves earlier text result; status layers reported separately | Re-proving equivalence on target host; binary-pattern attribution | Medium-large (5–10 days) |
| 7 | **Run WP6 (resurrection proof) seventh, parallelizable after WP5** | The project's stated reason to exist; moved before oracle per corpus critique | WP5 (residue frozen) | Private-gate reconstruction; public-gate synthetic repo | Four candidates derived from reconstructed inputs match exactly; public gate runs in CI | The audit must not inspect finals; the synthetic repo must reproduce the topology | Medium (4–7 days) |
| 8 | **Skip WP7 (M1b/M2b/M3/M4/Replay) detail until M2a residue is frozen** | Each is gated behind a frozen artifact | WP5 residue | Not now | n/a | Premature work would re-derive residue that does not exist | n/a |
| 9 | **WP8 (agent adapter) — H0/WP8 acceptance gate did NOT pass; INVALID run; agent adapter remains gated on (a) corpus diversity (≥3 repos, ≥2 languages), (b) working adjudicator harness, (c) PRNG fix, (d) citation-validity fix.** | The corpus critique settled "agent adapter is a slot, not the product." Raw `aggregate.json.verdict = "positive"` (characterization only) for the 2026-08-29 H0 rerun; **run INVALID per plan-rule** (33 records with `fabricated_evidence_ids > 0`); WP8 gated. The H0/WP8 gate did NOT clear (≥3 repos, ≥2 languages, no PRNG corruption; see §3.4 and §24.2 #11). Both diversity conditions of the phase plan's WP3 acceptance gate failed. The remaining preconditions are: (a) corpus diversity (≥3 repos, ≥2 languages), (b) a working human/scripted adjudicator harness, (c) the PRNG fix in `_h0_runner.ts:249-250`, (d) the citation-validity fix in the runner prompt. | H0 valid rerun + working human/scripted adjudicator | Not now | n/a | Premature agent work would advertise a constraint the harness does not enforce; the kill-safe outcome (§2) remains `@mrgr/core` alone if no valid H0 ever lands | n/a |
| 10 | **Skip the broad `planning/docs/` staging corpus as a status source** | Contains superseded plans, opaque captures, stale claims | none | Treat as historical only | n/a | Pulling status from `planning/docs/` re-introduces revision-1 failures | n/a |
| 11 | **Skip a parallel canonical plan** | Duplicates `STATUS.md`/`PLAN.md`; risks line-number drift | none | Use this artifact as the consolidation; primary files remain authoritative | n/a | Drift between this artifact and `STATUS.md`/`PLAN.md` | n/a |
**Single critical-path commitment:** M0-closure → M1a P0 [DONE: `mrgr-db/2`] → M1a P1 [DONE: `tests/db/`] → H0 redesign → H0 rerun 2026-08-29 [DONE: raw `aggregate.json.verdict = "positive"` (characterization only); **run INVALID per plan-rule** (33 records with `fabricated_evidence_ids > 0`); WP8 gated; H0/WP8 acceptance gate did NOT pass; see §3.4] (∥ M2a port) → Resurrection proof → (M1b ∥ M2b ∥ M4 ∥ M3 ∥ Replay) → Agent adapter [H0/WP8 gate NOT cleared; still gated on corpus diversity (≥3 repos, ≥2 languages), fixed PRNG, and a working human/scripted harness; see §3.4, §24.2 #11].

**Falsifiers that would force re-planning:**
- H0 returns positive but the *evidence* is the wrong kind: evidence *helps* but evidence is *not* what the user needs for fork-scale merges (the discriminator targets short-conflict adjudication; long-lived forks are a different distribution). Force a corpus extension. (The 2026-08-29 rerun's `aggregate.json.verdict = "positive"` is non-binding characterization only; a valid non-INVALID verdict after acceptance gates pass would need ≥3 repos, ≥2 languages, no PRNG corruption, and `fabricated_evidence_ids = 0` records — any-flag rule disqualifies.)
- M1a P0 reveals that the carried WP0 module's schema-v2 contract is incompatible with the truncation contract the addendum requires, or that `parseCorpusRecord` cannot be made to round-trip without a schema-version bump that breaks downstream consumers. Force a WP1.5 before WP2.
- M2a port discovers that `git_text` is not equivalent to Git-ort on a configuration the Round 5.1 preflight did not exercise (e.g., per-file `gitattributes`, `.gitattributes` overrides). Force a WP5.5 before WP6.
- Resurrection proof's private gate fails on a known-good reconstruction because the audit's reachability derivation has a bug. Force a WP6.5 before the public gate.
- Any Phase 0 / Phase 0.5 reframe forces the work-package ordering to change (e.g., the user wants agent adapter before H0). Force re-opening §1.2 and §4.

**What to skip and why:**
- Re-running the invalidated H0 experiment — five fatal defects; the answer is invalid; rerunning without redesign reproduces them.
- Building the union oracle before M3 has a populated oracle. The four-axis reporting is the contract; a single `UNION_PASS` bit is the failure mode.
- Shipping `@mrgr/core` before rights attestation + doc correction. The NOTICE blocks publication; the README claims absent packages.
- Building MCP + plugin + JSON CLI + TypeScript API + four-surface parity in one surface. One surface, one consumer, evidence.
- Pretending the Round 5.1 source experiment produced a mechanism/topology result. Zero arms launched; the frame was invalidated; the result does not exist.

---

## 17. Open questions for the human (only the user can decide)

1. **Does the adjudicator-neutral reframe preserve the intended product, or must "agent-first" remain the brand?** (PLAN.md revision 2 narrowed the claim; this artifact preserves that narrowing. The user must confirm before any agent-adapter work resumes.)
2. **Is the rights attestation for carried WP0 code in hand, or must it be drafted?** (Publication is gated on this; if not in hand, the rights-attestation line in NOTICE is the only M0 blocker remaining.)
3. **For the H0 corpus language spread:** is C (Redis) and Go (cli/cli) acceptable, or must the second language be TypeScript (tldraw) or a non-imperative language? (Affects candidate pre-screening.)
4. **For the H0 rerun cost:** is the ≤2-hour wall-time budget on `vinbonesjr` with the pinned Qwen family acceptable, or must the planner use a remote API with a recorded cost ceiling? (Affects model pin and reproducibility.)
5. **For the agent adapter's single-surface choice:** if H0 is positive, which single surface is the user willing to commit to — Claude Code plugin, MCP, JSON CLI, or TypeScript API? (Defers the others indefinitely.)
6. **For the resurrection proof's public gate:** is shipping a synthetic repo with the same topology in CI acceptable, or does the user prefer the private gate only? (Affects the public gate's scope.)

---

## 18. Critical files (for `/plan` to read first)

| Order | Path | Why |
|---|---|---|
| 1 | `/home/svnbjrn/rsrch/projects-mrgr/planning/mrgr/STATUS.md` | Current milestone state and execution order |
| 2 | `/home/svnbjrn/rsrch/projects-mrgr/planning/mrgr/PLAN.md` | Canonical sequence with live phase markers |
| 3 | `/home/svnbjrn/rsrch/projects-mrgr/planning/mrgr/SOURCES.md` | Provenance manifest |
| 4 | `/home/svnbjrn/rsrch/projects-mrgr/planning/mrgr/phases/m1a/integration-tests-plan.md` | M1a P0/P1/P2 addendum governing M1a work |
| 5 | `/home/svnbjrn/rsrch/projects-mrgr/planning/mrgr/phases/h0/independent-review.md` | Five fatal defects; what survives |
| 6 | `/home/svnbjrn/rsrch/projects-mrgr/planning/mrgr/phases/m2a/round5-merge-mechanism-refreeze-plan.md` | Reusable M2a design |
| 7 | `/home/svnbjrn/rsrch/projects-mrgr/planning/mrgr/phases/m0/closure-evidence.md` | M0 closure evidence; what WP0 must reproduce |
| 8 | `/home/svnbjrn/rsrch/projects-mrgr/planning/mrgr/findings/F1-exact-localization-unreachable.md` | F1 fix pointer |
| 9 | `/home/svnbjrn/rsrch/projects-mrgr/planning/mrgr/research/adjudication-literature.md` | H0 and M3 literature |
| 10 | `/home/svnbjrn/rsrch/projects-mrgr/planning/mrgr/research/mergiraf-mechanism.md` | M2a status and license semantics |
| 11 | `/home/svnbjrn/rsrch/projects-mrgr/planning/mrgr/reviews/mrgr-agent-harness-plan-critique.md` | Adversarial critique; basis for revisions |
| 12 | `/home/svnbjrn/rsrch/projects-mrgr/planning/mrgr/sources/sessions/fork-composition-round5-1-merge-mechanism-refreeze-git-text-gnu-diff3-mergiraf-18-arms-post-freeze-drift-immutable-model-build-unavailable-frame-mismatch-20260826.md` | Round 5.1 source-experiment record |
| 13 | `/home/svnbjrn/rsrch/projects-mrgr/planning/mrgr/phases/m0/NOTICE.snapshot` | Rights-attestation blocker |
| 14 | `/home/svnbjrn/rsrch/projects-mrgr/planning/mrgr/phases/m0/README.snapshot.md` | Shipped doc text to be corrected |
| 15 | `/home/svnbjrn/rsrch/mrgr/docs/superpowers/specs/2026-08-28-persistence-layer-design.md` | SQLite persistence layer design (mrgr-db/2 — supersedes JSONL as storage) |
| 16 | `/home/svnbjrn/rsrch/mrgr/docs/superpowers/plans/2026-08-28-persistence-layer.md` | Implementation plan for the persistence layer (56 boxes unchecked; the work landed before the plan was authored) |
| 17 | `foundations/semantic-merge-research-proposal.md` *(relative to this artifact)* | Conceptual foundation for the `mrgr` project. Pre-measurement research proposal (status: "Pre-measurement. No implementation commitment."). Originally at `/home/svnbjrn/rsrch/semantic-merge-research-proposal.md` (SHA-256 `f51db8bbcaf631ca9a0820a4e8becc028db3671f79cf9a0f14862369593d4d34`, cited as [S11] in `mrgr-agent-harness-plan-critique.md`). **This is the canonical in-tree copy.** The original at `/home/svnbjrn/rsrch/` remains in place as a sibling reference; the SHAs match. **WP-numbering disambiguation:** this proposal defines research work-packages WP0–WP5 (Measurement / Canonicalization / Semantic-detection / Anti-unification / Span-computation / Equational-`L_S`); the canonical-final-planning-document's §6 and §16 define execution work-packages WP0–WP8 (M0-closure / M1a-P0 / M1a-P1 / H0-redesign / H0-rerun / M2a-port / Resurrection-proof / Agent-adapter). These are unrelated numbering systems — the proposal's WP0 is research-measurement, the canonical's WP0 is M0-closure-durable-artifact. The proposal's RQ1–RQ6 are not mapped to any canonical WP; the proposal is pre-measurement and contains no implementation commitment. |
| 18 | `~/rsrch/sycl-fa-research/` *(sibling, NOT in this tree)* | **NOT an mrgr artifact.** Eleven SYCL-FA defect-research files (`_probe.md`, `phase0-framelock.md` … `phase4-selfattack.md`, `sycl-fa-verdict.md`, `sycl-fa-verdict-2.md`, `v2-evidence-brief.md`) about `TheTom/llama-cpp-turboquant @ merge/sycl-turboquant, HEAD de709ee4` on Intel Arc A770 + oneAPI DPC++. These documents concern a different project's SYCL flash-attention defect investigation; they are NOT referenced by the canonical-final-planning-document, NOT cited by the agent-harness critique, NOT in any `mrgr` planning corpus. They are listed here only so a future planner searching `~/rsrch/` for `mrgr` artifacts finds them and knows they are unrelated. The original absolute paths (`/home/svnbjrn/rsrch/_probe.md`, `/home/svnbjrn/rsrch/phase0-framelock.md`, etc.) still resolve; the consolidated location is `/home/svnbjrn/rsrch/sycl-fa-research/`. |
All files above were opened by this run. Path translations to `/home/svnbjrn/dev/mrgr`:
- `src/evidence.ts` → `packages/core/src/evaluation/evidence.ts` (new module per M1a addendum and `local/planning-next-phase-research.md`)
- `src/forensic/core.ts:5,13,27-52,251-269` → `packages/core/src/forensic/core.ts` or `packages/core/src/evaluation/evidence.ts` (path resolution required on disk; see §15.2 risk #1)
- `src/evaluation/corpus.ts:608-728` → `packages/core/src/evaluation/corpus.ts`
- `src/evaluation/cli.ts:242-251` → `packages/core/src/evaluation/cli.ts`
- `src/evaluation/types.ts` → `packages/core/src/evaluation/types.ts`
- `tests/evaluation/cli.test.ts:99-108` → `packages/core/tests/evaluation/cli.test.ts`
- `tests/forensic.test.ts:73-113,99-108` → `packages/core/tests/forensic.test.ts`

---

## 19. Sources (canonical for `/plan`)

| ID | Path or URL | Use |
|---|---|---|
| S1 | `planning/mrgr/PLAN.md` (SHA-256 `93e13342577876a7504188d6756ed932149e944f9309ae5eb30d48f57d846216`) | Canonical sequence |
| S2 | `planning/mrgr/STATUS.md` (SHA-256 `c5aa98ca931d831df3244e7df4aa4014847e57822d4484852e1f23602f3c17e2`) | Current truth |
| S3 | `planning/mrgr/SOURCES.md` (SHA-256 `6492d1e501e6d83a5c5a683e70b874a89bf0ac40b99b906313c6b1fa8f02fe32`) | Provenance manifest |
| S4 | `planning/mrgr/canonical-plan-source.md` (SHA-256 `3baa199c2ee4a3f4908e9648262c48197487a2ece40ca118549cc91493cee4ff`) | Content copy of plan-mode file |
| S5 | `planning/mrgr/phases/m0/closure-evidence.md` | M0 closure evidence |
| S6 | `planning/mrgr/phases/m0/NOTICE.snapshot` | Rights attestation blocker |
| S7 | `planning/mrgr/phases/m0/LICENSE.snapshot` | Apache-2.0 text |
| S8 | `planning/mrgr/phases/m0/README.snapshot.md` | Shipped doc text |
| S9 | `planning/mrgr/phases/m0/scope-and-verdict.md` | WP0 claim boundary |
| S10 | `planning/mrgr/phases/m0/wp0-measurement.md` | WP0 measurement spec |
| S11 | `planning/mrgr/phases/m0/wp0-merge-replay.md` | WP0 Git replay source note |
| S12 | `planning/mrgr/phases/m0/F1-exact-localization-unreachable.md` | F1 finding (carried copy) |
| S13 | `planning/mrgr/phases/h0/independent-review.md` | H0 invalidation |
| S14 | `planning/mrgr/phases/h0/discriminator-plan-original.md` | H0 historical plan (superseded) |
| S15 | `planning/mrgr/phases/m1a/integration-tests-plan.md` | M1a governing plan |
| S16 | `planning/mrgr/phases/m2a/round5-merge-mechanism-refreeze-plan.md` | M2a plan |
| S17 | `planning/mrgr/reviews/mrgr-agent-harness-plan-critique.md` | Adversarial critique |
| S18 | `planning/mrgr/research/adjudication-literature.md` | H0 / M3 literature |
| S19 | `planning/mrgr/research/mergiraf-mechanism.md` | M2a / Mergiraf status semantics |
| S20 | `planning/mrgr/findings/F1-exact-localization-unreachable.md` | F1 finding pointer |
| S21 | `planning/mrgr/sources/sessions/fork-composition-round5-1-merge-mechanism-refreeze-git-text-gnu-diff3-mergiraf-18-arms-post-freeze-drift-immutable-model-build-unavailable-frame-mismatch-20260826.md` | Round 5.1 session record |
| S22 | arXiv:2605.25890v1 (Merge-Bench); dataset `merges.tar.gz` SHA-256 `4f0b63409776c7d987b808dd85959c40a09160c6f155381b66a9ed8356ea6ff8`; companion `benedikt-schesch/Merge-Bench` @ `4860bea020e3fc0af31fff8d58e5b822be822222` | Merge-Bench |
| S23 | arXiv:2604.03551v2 (AgenticFlict); AIware'26 DOI `10.1145/3805760.3814923`; source `unlv-evol/AgenticFlict` @ `e050289d12c37d90e81f90886a0ecde9a683385a`; Zenodo `10.5281/zenodo.20118379` md5 `1d6b79f1fed77c39e195b116cd2ad46d` | AgenticFlict |
| S24 | arXiv:2605.17279v1 (Rover) | Rover |
| S25 | arXiv:2409.14121v1 (ConGra) | ConGra |
| S26 | arXiv:2607.27674v1 (ConflictAgent); repo `UBOWENVT/ConflictAgent` | ConflictAgent |
| S27 | Xu, Subramanian & Karthik, arXiv:2607.04697v2 | Co-activity 79.4% (distinct from AgenticFlict's share) |
| S28 | JSS 214:112070 (SAM) | SAM union predicate |
| S29 | SCIS 65:199103 (TOM/MCon4J) | TOM union predicate |
| S30 | `planning/mrgr/sources/remember/today-2026-08-26.md` (stale, superseded) | Historical positive H0 claim |
| S31 | `planning/mrgr/sources/remember/recent.md` | Historical navigation aid |
| S32 | `/home/svnbjrn/rsrch/semantic-merge/evidence/h0/REVIEW-2026-08-27.md` | H0 independent review source |

---

## 20. Verification leads for low-confidence / `[UNVERIFIED]` items

| Item | Search lead |
|---|---|
| `/home/svnbjrn/dev/mrgr` current HEAD SHA | `git -C /home/svnbjrn/dev/mrgr rev-parse HEAD` |
| Working-tree state | `git -C /home/svnbjrn/dev/mrgr status --porcelain` |
| Whether `src/forensic/core.ts` exists at the addendum's path | `ls /home/svnbjrn/dev/mrgr/packages/core/src/forensic/core.ts` |
| Whether `evidenceBundles` round-trips through `parseCorpusRecord` after WP1 | `pnpm vitest run packages/core/tests/evaluation/evidence-roundtrip.test.ts` |
| Whether the carried-WP0 manifest matches the on-disk SHA-256 | `./scripts/verify-carried.sh` |
| Whether the redesigned H0 kill branch is reachable by construction | Manual: insert `temperature > 0` so all arms score equal to constant baseline; verify `killConditionMet === true` |
| Whether the M2a port's git_text adapter is equivalent to Git-ort on a fresh fixture | Five-run determinism probe + small conflict fixture |
| Whether the resurrection proof's synthetic-repo public gate runs in CI | Push to a feature branch and watch the CI run |
| Whether `merge.bundle_uri`-style delivery would change the Mergiraf license analysis | None — this is a fact boundary; see `research/mergiraf-mechanism.md` GPL boundary section |
| Whether the M1a schema-version bump breaks any external consumer | `/home/svnbjrn/dev/mrgr` has no external consumer today; this verification is moot |

---

## 21. Meta-observation

The corpus displays the exact bias the proposed harness is meant to contain. The prior `today-2026-08-26.md` declared "H0 complete; verdict positive" with a magnitude figure that does not survive independent review. The prior `semantic-merge/docs/M1a-evidence-bundles.md` declared "Completed" for a schema whose truncation contract is byte-incorrect. The prior `README.md` and `NOTICE` described absent packages and present-tense mechanism invocation. The prior Round 5.1 lock reported a frozen frame that was invalidated two minutes later by post-freeze contract edits and an hour later by a missing immutable `MODEL_BUILD`. None of these were intentional misstatements — they are the natural failure modes of a fluent synthesis that has not been re-run against primary sources.

The guard against the tool's own author is therefore not more schema. It is **adversarial evidence discipline**: raw refs and statuses, independent recomputation, relevance-tested context, separate axes, explicit `[UNVERIFIED]`, a bypass test, `STOP` rules that delete the attractive product when the evidence fails, and **re-hashing of governing inputs** at yield time. This artifact commits to that discipline by:

- Pinning SHA-256 of every governing planning file (§1.1).
- Distinguishing `STALE-*` evidence from current evidence (§12 ledger; §1.5 supersession rules).
- Naming the five H0 defects by file and line, not by slogan (§3.4).
- Specifying the M1a truncation contract as 1,200 UTF-16 code units with `Buffer.byteLength` for original bytes (§8).
- Marking M2a as a *port* with explicit non-claim about the Round 5.1 source experiment's result (§3.6, §10).
- Reproducing the corpus critique's STOP rules verbatim (§6 each WP, §11 risk register).
- Refusing to manufacture a `MODEL_BUILD` from a public selector (§10).
- Naming what would force re-planning (§16 falsifiers).

What remains `[UNVERIFIED]`: the on-disk state of `/home/svnbjrn/dev/mrgr` (HEAD SHA, dirty tree, exact path resolution for `src/evidence.ts` vs `src/forensic/core.ts`); whether the H0 redesigned corpus will yield the predicted Rover/ConGra direction or null; whether the M2a port's git_text adapter equivalence holds on a fresh fixture; whether the resurrection proof's synthetic-repo public gate will reproduce the private-gate result. None of these block the artifact; each is a §20 verification lead with an exact search command.

What the corpus got wrong versus current evidence:
- The first H0 run's positive verdict (superseded by independent review).
- The README/NOTICE present-tense claims (must be corrected before publication).
- The M1a "Completed" claim in `semantic-merge/docs/M1a-evidence-bundles.md` (superseded by the corpus-review addendum).
- The Round 5.1 terminal frame lock (invalidated by post-freeze drift + missing `MODEL_BUILD`).
- The `projects-mrgr/experiment/docs/M0.md` duplicate M1a narrative (misplaced; not independent evidence).

Overall confidence:
- **High** for the binding of `STATUS.md` as current truth, the corpus critique as the reason for revision 2, and the H0 invalidation as disqualifying.
- **High** for the M1a P0/P1/P2 ordering and the truncation contract.
- **High** for M2a being a port, not a result.
- **Medium** for path translations between the M1a addendum's stated sites and the on-disk `packages/core/src/...` subtree.
- **Medium** for the time estimates in §16 (the corpus is honest about being unable to predict wall time).
- **Low** for the on-disk state of `/home/svnbjrn/dev/mrgr` (cannot be re-hashed in this turn; the workspace is not a checkout).

This artifact does not start an implementation, run a test, or mutate a file. It exists so `/plan` can translate it into implementation tasks without rediscovering repository facts, and so the planner can re-derive the milestone graph, the `STOP` rules, and the kill-safe outcome by reading this file plus the cross-linked canonical evidence.

---

## 22. Parking lot

- ~~Exact wall-time estimates per work package (currently a budget class, not a number).~~ **Closed 2026-08-29** for the H0 rerun (Work package 4): actual wall-time ~1h 50min (run + restart + 8089 warmup + fetch-timeout recovery). Still open for WP5/WP6.
- ~~The exact contents of the `model.txt` for the H0 rerun (depends on `ollama show` output).~~ **Closed 2026-08-29 with a source correction:** `model.txt` was a *proposed-but-not-created* artifact in the original H0 discriminator plan (`phases/h0/discriminator-plan-original.md` §2.1 + §deliverables; `projects-mrgr/planning/docs/h0-discriminator-plan.md` §2.1 + §deliverables). The plan authors intended to capture the pinned model SHA + Ollama version into `evidence/h0/model.txt` via `ollama show <model-tag> --modelfile | sha256sum` (Ollama-specific) plus `node -v`, `ollama -v`, `uname -a`. The file was never produced because (a) the redesigned runner (`evidence/h0/_h0_runner.ts:5-6`) pins model identity in code as `H0_MODEL_TAG` + `MODEL_SHA` constants, and (b) the actual backend on this host is `llama-server` (CPU-only, Qwen3-Coder-30B-A3B-Instruct-UD-Q3_K_XL) on `127.0.0.1:8089`, not Ollama — no `ollama show` available, and the equivalent identity is recorded as systemd unit metadata (`llama-cpu@Qwen3-Coder-30B-A3B-Instruct-UD-Q3_K_XL.service`). Pinned values: `H0_MODEL_TAG=Qwen3-Coder-30B-A3B-Instruct-UD-Q3_K_XL`; model SHA `69cd7578d77dffc0b17e34bad9ef998d08ae0e20ccceef21bad4e7eb3d8c553b`; llama-server args from the systemd unit (`--ctx-size 8192 --batch-size 512 --ubatch-size 256 --threads 12 --cpu-mask 0xffffff --n-gpu-layers 0 --flash-attn auto --chat-template chatml --cache-type-k q8_0 --cache-type-v q8_0 --host 127.0.0.1 --port 8089`). Future planners: do not look for `evidence/h0/model.txt`; the binding identity is in code constants + the live systemd unit. See §23.1.
- A re-pinned HEAD on `/home/svnbjrn/dev/mrgr` (requires filesystem access outside this workspace).
- The `merge.bundle_uri`-style delivery license analysis for Mergiraf (a fact boundary, not a conclusion).
- Ast-grep license and pinning analysis (deferred to M1b planning).
- The exact contents of the synthetic-repo public gate (depends on the resurrection proof's private gate passing first).
- The contents of any `/home/svnbjrn/.claude/plans/open-source-agent-first-toolkit-sparkling-bumblebee.md` edits that may have occurred after `canonical-plan-source.md` was copied (this artifact assumes the plan-mode file is unchanged from the copy).
- **Plan-text vs aggregator divergence** (new 2026-08-29): the H0 rerun plan specified a 5pp gap threshold (`wrong-fraction gap ≤ −0.050` for "evidence utility confirmed") that the actual rerun narrowly missed (gap = −0.037). The aggregator's own logic uses count-based comparison (`full-bundle wrong < hunk-only wrong`) which the rerun met. The user chose to trust the aggregator; future reruns or analyses should either tighten the gap threshold, redesign the run to clear it, or amend the design to remove the 5pp rule. See §23.5.
- **Aggregator `seed_subsample` / `repeats` cosmetic bug** (new 2026-08-29): the aggregator reads `H0_SUBSAMPLE` / `H0_REPEATS` from `process.env` to populate `aggregate.json`, but the env vars were not exported in the aggregator's shell, so the metadata reads `0`/`0`. Cosmetic, but a future rerun must export those env vars before `_aggregate.ts` is invoked. See §23.4.
- **Fabricated-IDs regex limitation** (new 2026-08-29; §3.4 supersedes this framing — the citations are validity failures, not legitimate references). The runner's `parseDecision` sets `fabricated_ids: tags.length > 0` — any quoted `[source:…]` tag is flagged at the runner level. The aggregator (`_aggregate.ts:108`) then re-checks against the corpus `triple_key` set (`knownTripleKeys = new Set(resolutions.keys())`, populated from 377 jq + 521 cli = **862 distinct triple_keys**). Runner-level counts: 25 (hunk-only) + 1 (selected) + 8 (full-bundle) = **34 raw flags**. Aggregator-level counts: **33 records** flagged (24 + 1 + 8) as corpus-membership-mismatches, totalling **41 invalid-tag occurrences** across those 33 records. The 7 distinct invalid tag values the LLM cited (`"ours"`, `"theirs"`, `" ours vs theirs line number discrepancy"`, `"line_number_change"`, `"line_numbers"`, `"ours vs source:theirs"`, `"token_reordering_conflict"`) are NOT in the 862-element `triple_key` set; the prompt does not expose those strings as source IDs, so every occurrence is a real validity failure, not a legitimate-reference false positive. The 1-record delta (34 raw flags vs 33 aggregator flags) is hunk-only run 1 of triple `cc4ad12320950c33d5437a24c1da3328a57daca2ca71bad59fff8342c8901a9a` — the LLM cited its own triple_key, which IS in the corpus, so the aggregator correctly downgraded that record. **Effect on verdict:** none — the verdict counts `correct`/`wrong`/`halt`/`schema_invalid`; fabricated_evidence_ids is informational metadata only. The 33 fabricated records are a real defect — the runner is generating tags it cannot ground in source IDs — but the defect is an S3 (citation-validity) gap, not a verdict-contaminating bug.
- **Runner fetch-timeout patch** (new 2026-08-29): the runner had no fetch timeout and stalled twice on hung `/v1/chat/completions` requests under heavy host load. Added a 90s `AbortController` in `_h0_runner.ts:153-194` (operational hardening, not a design change). One call (full-bundle triple 18/30 run 1, wall=90027ms) hit the timeout and was recorded as `schema_invalid`. The patch should land on `origin/main` as a separate commit so the next runner uses it by default. See §23.3.

---

## 23. H0 rerun execution record (2026-08-29)

**Audience:** future self reading this artifact post-rerun. Closes item 4 of `STATUS.md:73-82` ("Rerun H0. Only a valid result may unlock or retire the agent adapter"). Cross-linked from §3.4, §5, §12, §16, §22.

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

## 24. Session close summary (2026-08-29T07:42Z)

What got done in this session, what was deferred, and what the next planner should read first.

### 24.1 What got done

- **Executed the H0 rerun** end-to-end (preflight → run → aggregate → judge → record → STATUS update) per the plan at `.omp/agent/sessions/-rsrch-mrgr/2026-08-28T23-38-53-628Z_01a04abd-953b-7000-8172-8f9486608903/local/h0-rerun-after-redesign-plan.md`.
- **Patched `_h0_runner.ts`** with a 90s fetch-timeout (operational hardening; user-authorized).
- **Wrote `evidence/h0/REVIEW-2026-08-29.md`** (10.9 KB) — full rerun review including the plan-text vs aggregator divergence.
- **Updated `.do-not-commit/planning/STATUS.md`** H0 row (line 14) and Agent adapter row (line 23) and header (lines 3-5) to reflect the new verdict.
- **Updated this artifact** (canonical-final-planning-document.md) §3.4, §5, §12, §16, §22 and added §23, §24.

### 24.2 What's left to do

Unchanged from pre-session open work, plus the items surfaced by this session:

1. **WP0** — M0-closure rights attestation + README/NOTICE correction. The only M0 blocker.
2. **WP1 [DONE]** — M1a P0 schema honesty landed via `mrgr-db/2` SQLite persistence layer (`packages/core/src/db/`). See §3.5, §16 commitment #2.
3. **WP2 [DONE]** — M1a P1 load-bearing tests landed in `tests/db/` (108 invocations across 12 files). See §16 commitment #3.
4. **WP5** — M2a port to `@mrgr/mechanisms`. Independent of H0 outcome.
5. **WP6** — Resurrection proof (no plan file exists; the project has no reason-to-exist gate to clear without this).
6. **Working human/scripted adjudicator harness** — required to unblock WP8 (agent adapter).
7. **Runner patch → origin/main** — the fetch-timeout patch should land as a separate commit so future runners use it by default.
8. **Plan-text 5pp rule** — either tighten, redesign, or amend.
9. **Aggregator cosmetic fix** — export H0_SUBSAMPLE/H0_REPEATS in aggregator shell; clean up runs/ directory layout.
10. **Fabricated-IDs regex** — distinguish `[source:ours]` / `[source:theirs]` from arbitrary quoted text.
11. **Runner PRNG typo at `_h0_runner.ts:249`** — `Math.imul(a ^ (a >>> 15))` returns 0 instead of the intended 32-bit multiplication. Patch to `Math.imul(a ^ (a >>> 15), 1)` (or any constant). This is the root cause of the all-jq subsample (single-language); see §23.1.
12. **Language-spread gate failure** — the 2026-08-29 rerun used 30 jq triples (C) and 0 cli (Go). To satisfy the WP3 acceptance gate's "≥2 languages" requirement, future reruns must (a) fix the PRNG typo (item 11), (b) interleave jq/cli in the corpus loader so subsample can pick from both repos.
### 24.3 What the next planner should read first

1. **`.do-not-commit/planning/STATUS.md`** (current truth; H0 row updated 2026-08-29; M1a row updated to "complete on all branches" with `mrgr-db/2`).
2. **`evidence/h0/REVIEW-2026-08-29.md`** (this session's H0 verdict, residuals, plan-text divergence).
3. **This artifact, §23** (H0 rerun execution record; what ran, what the numbers mean, what's open).
4. **§3.5** (M1a state — now `complete on all branches` via `mrgr-db/2`) and **§16 commitments #2 + #3** (marked DONE).
5. **`.do-not-commit/planning/phase-plans/INDEX.md`** (defect-fix table for the redesign chain; what's left to land per WP).
6. **`evidence/h0/aggregate.json`** (machine-readable verdict; `seed_subsample` / `repeats` cosmetic bug noted).
7. **`docs/superpowers/specs/2026-08-28-persistence-layer-design.md`** — the persistence-layer design (`mrgr-db/2` schema) that superseded JSONL as storage. **Note:** the spec references `mrgr-db/1`; the actual shipped schema is `mrgr-db/2` per `packages/core/src/db/open.ts:9`.
8. **§5 critical-path diagram** in this artifact — the binding work order.
9. **§16 committed recommendations** — the 11 commitments (1, 2 [DONE], 3 [DONE], 4, 5 [DONE], 6, 7, 8, 9, 10, 11) and their acceptance gates.
### 24.4 What's in memory but missing from the planning corpus (folded forward, addressed by §23.9 above)

- The 4-question that surfaced during preflight (adjudicator availability + model-mismatch on 8088) is captured in the plan-of-record and in §23.1, §23.3 of this artifact.
- The runner's session log path (`evidence/h0/runs/resume-2026-08-29T05-51-13Z.log`) is in §23.9.
- The Hindsight bank has no H0-rerun-specific facts beyond what's in `REVIEW-2026-08-29.md` and `STATUS.md`; cross-project memory (PRs on `conflict-of-interest`, `Raudbjorn/credit`) is not project-mrgr-specific.
- The `docs/planning/` directory layout (canonical-final-planning-document + m1a-p0-implementation-plan only) is noted in §23.9 for the next consolidation pass.

### 24.5 What this session did NOT do (explicit non-actions)

- **Did not implement the agent adapter.** WP8 is **not unblocked**: raw `aggregate.json.verdict = "positive"` (characterization only); **run INVALID per plan-rule** (33 records with `fabricated_evidence_ids > 0`); WP8 remains gated on a valid H0 (corpus diversity ≥3 repos / ≥2 languages, fixed PRNG, working adjudicator harness) and on a working human/scripted harness; the next planner decides whether to land the harness first or to re-run H0 first.
- **Did not start M1a P0/P1/P2 work.** These are independent of H0; the corpus-review addendum at `phases/m1a/integration-tests-plan.md` is the governing plan.
- **Did not start M2a port.** WP5 is the Round 5.1 source-experiment port; Round 5.1's frame was invalidated and a fresh port on `mrgr` is needed.
- **Did not commit the runner patch to `origin/main`.** Operational hardening lives in working tree; a separate commit on `origin/main` is needed.
- **Did not re-run the Round 5.1 source experiment.** It is out of scope for this session; the audit stop at `MODEL-BUILD-FRAME-MISMATCH.json` is preserved.
- **Did not invent a `MODEL_BUILD`.** The Round 5.1 stop is preserved; the M2a port tests adapter equivalence and D79-style fixtures, not model-driven arms.

---

*This artifact does not start an implementation, run a test, or mutate a file beyond the in-place updates recorded in git status. It exists so the next planner can resume from a verified H0 rerun without rediscovering repository facts, and so the §23 execution record can be cross-referenced from `STATUS.md`, `REVIEW-2026-08-29.md`, and `aggregate.json`.*
