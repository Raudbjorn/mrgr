*Part of the [canonical planning document](../canonical-final-planning-document.md).*

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

*This artifact does not start an implementation or rerun H0. It records the fresh 2026-08-30 result as current, preserves §23 as historical evidence, and points the next planner to evidence/h0/REVIEW-2026-08-30T02-54-42-056Z.md and evidence/h0/aggregate-2026-08-30T02-54-42-056Z.json.*
