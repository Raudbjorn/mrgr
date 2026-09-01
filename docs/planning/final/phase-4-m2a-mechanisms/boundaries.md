*Part of the [canonical planning document](../canonical-final-planning-document.md).*

## 10. M2a / Round 5.1 boundaries and prerequisites

- **Boundary:** M2a in `mrgr` is the *port* of the Round 5.1 source experiment to `@mrgr/mechanisms`. The Round 5.1 source experiment itself produced implementation design but no result.
- **Round 5.1 design (reusable):** three file-level content mechanisms (`git_text`, `gnu_diff3`, `mergiraf`) under fixed `ort`/`merge-tree` orchestration; six-cell/18-arm contracts; deterministic preflight; schedule; adjudicator (`adjudicate.py`); per-attribute `merge=mergiraf` setup; explicit `merge=binary` macro on binary patterns; four-status capture.
- **Prerequisites the Round 5.1 source experiment also required:** immutable `MODEL_PROVIDER`, `MODEL_ID`, `MODEL_BUILD` before freezing. OMP exposes only a public selector; an immutable `MODEL_BUILD` is not available. The `mrgr` port does not require `MODEL_BUILD` for the mechanism layer — the port tests adapter equivalence and D79-style mixed fixtures, not the model-driven fork-composition experiment. The model-driven experiment stays a separate question.
- **What survives — verified present, but not in this repo.** The adapter, the contracts, the preflight, the schedule, the adjudicator are not in `mrgr` or `origin/next-phase` (`find`/`git ls-tree -r` confirm that, still). **Located 2026-09-01** at `/home/svnbjrn/rsrch/projects-mrgr/experiment/round5/` — see `phase-4-m2a-mechanisms/current-state.md` for the verified file-by-file finding. WP5 can port from these directly; no redesign-from-scratch decision is needed.
- **What does NOT survive:** the intermediate `FRAME-LOCK.md` (invalidated by post-freeze contract drift + missing `MODEL_BUILD`); any claim that a mechanism × topology contrast was run (zero arms launched).
- **Hard rule:** the `mrgr` M2a port must **not** claim the source experiment's result. It must re-prove adapter equivalence on the target host, re-prove the mixed-fixture binary guard, and re-prove status-layer separation.

