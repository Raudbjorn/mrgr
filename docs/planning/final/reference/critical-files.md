*Part of the [mrgr canonical planning document](../canonical-final-planning-document.md).*

## 18. Critical files — read only what your task touches

**Restructured 2026-08-30.** This used to be a flat "read all 17 before starting anything" list — that's real cost on every task, including ones these files have nothing to do with (a UI tweak doesn't need the Round 5.1 session record or the SYCL-FA disambiguation note). Below, files are grouped by which phase of work they're relevant to. Read the row for your task; skip the rest.

**Correction (2026-08-30):** `STATUS.md`/`SOURCES.md`, formerly rows 1 and 3, kept out of this table — see §1.5 rule 2 for why. Phase-N `current-state.md` files are the current-truth source.

Paths below are relative to `.do-not-commit/planning/` unless stated otherwise.

| If your task touches... | Read |
| --- | --- |
| Anything at all | `PLAN.md` — canonical sequence with live phase markers (SHA-256 verified matching on disk, 2026-08-30) |
| M0 / publication / NOTICE / README | `phases/m0/closure-evidence.md` (what WP0 must reproduce — note it's stale, see `phase-1-m0-core-extraction/current-state.md`); `phases/m0/NOTICE.snapshot` and `README.snapshot.md` (**pre-correction captures, historical only** — current `NOTICE`/`README.md` are already corrected) |
| M1a / persistence / evidence bundles | `phases/m1a/integration-tests-plan.md` — P0/P1/P2 addendum governing M1a work |
| F1 / conflict-style / localization | `findings/F1-exact-localization-unreachable.md` |
| H0 / adjudication / evidence-utility | `research/adjudication-literature.md` |
| M2a / merge mechanisms / Mergiraf licensing | `phases/m2a/round5-merge-mechanism-refreeze-plan.md`; `research/mergiraf-mechanism.md`; `sources/sessions/fork-composition-round5-1-merge-mechanism-refreeze-git-text-gnu-diff3-mergiraf-18-arms-post-freeze-drift-immutable-model-build-unavailable-frame-mismatch-20260826.md` (Round 5.1 source-experiment record) |
| Auditing this plan's own claims / revisions | `reviews/mrgr-agent-harness-plan-critique.md` (adversarial critique; basis for revisions) |
| The SQLite persistence layer specifically | `docs/superpowers/specs/2026-08-28-persistence-layer-design.md`; `docs/superpowers/plans/2026-08-28-persistence-layer.md` (56 boxes unchecked — work landed before the plan was authored, don't read the checkboxes as status) |
| The project's original research motivation | `foundations/semantic-merge-research-proposal.md` (relative to this artifact) — pre-measurement research proposal, unrelated WP-numbering to this plan's WP0–WP8 (see `foundations/README.md` for the disambiguation table) |

**Not an mrgr artifact, mentioned only to prevent confusion:** `~/rsrch/sycl-fa-research/` holds an unrelated SYCL flash-attention defect investigation (`TheTom/llama-cpp-turboquant`). Not cited by anything in this corpus; ignore unless you went looking in `~/rsrch/` and found it.

**Path translations** (old doc used bare `src/...` paths from the original semantic-merge tree; here's where they landed in `packages/core/`):
- `src/evaluation/{corpus,cli,types}.ts` → `packages/core/src/evaluation/{corpus,cli,types}.ts`
- `src/forensic/core.ts` → actually `packages/core/src/m1a/forensic-core.ts` (different directory, hyphenated not slashed — see §1.3 correction)
- `tests/evaluation/cli.test.ts`, `tests/forensic.test.ts` → `packages/core/tests/evaluation/cli.test.ts`, `packages/core/tests/forensic.test.ts`
