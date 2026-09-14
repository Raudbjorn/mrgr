*Part of the [canonical planning document](../canonical-final-planning-document.md).*

## Current sequencing amendment — 2026-09-06

The user requested Phase 3 → Phase 4 → Phase 5 in that order. A valid, preserved result from the [new Phase 3 protocol](../phase-3-h0-evidence-utility/execution-and-handoff-2026-09-06.md) closes the first step whether positive or inconclusive. M2a remains technically independent of H0 positivity, as the original graph below states. Phase 4 real Git integration and residue freeze are now complete; Phase 5 fresh reconstruction and the applicable resurrection gates are now [complete locally, 2026-09-13](../phase-5-resurrection-proof/current-state.md). The old thirty-case normalization-only reopen rule is superseded; WP8 remains outside this sequence.

The graph and critical-path status below are the historical 2026-08-30 snapshot; use each phase's current state for completion evidence.

## 5. Dependency graph and critical path

```
M0-closure (rights attestation, doc correction, durable artifact)
    └─► M1a P0 (schema honesty, region identity, truncation metadata, persistence, error preservation)
            └─► M1a P1 (load-bearing tests: preimage semantics, multi-region, add/add, delete/modify, write/read round trip)
                    ├─► H0 redesign + rerun (killable, no answer-leakage, real preimages, baselines, independent-trial accounting)
                    │       └─► (positive) Agent adapter work — last, single surface  [NOT TAKEN]
                    │       └─► (null) ◄── TAKEN 2026-08-30. Retire agent adapter and `@mrgr/evidence-bundle`; ship `@mrgr/core` alone
                    └─► (independent of H0) M2a port to `@mrgr/mechanisms`
                            └─► M2a residue freeze
                                    ├─► Resurrection proof (private gate on pinned refs; public gate in CI)
                                    ├─► M1b entity extraction (frozen residue, ≥20 hand-marked, ≥2 languages)
                                    ├─► M2b residue composition + accounting (line-multiset + entity + relocation)
                                    ├─► M4 ledger (JSONL append-only with content-derived IDs)
                                    ├─► M3 verification (per-gate vector, four-axis union, no-pool)
                                    └─► Replay (characterization; efficacy gate after H0 supplies non-halt threshold)
```

**Critical path:** M0-closure → M1a P0 [DONE: mrgr-db/2] → M1a P1 [DONE: tests/db] → H0 redesign [DONE] → fresh H0 rerun 2026-08-30 [DONE: VALID — diversity/PRNG/adjudicator/citation gates all closed] ∥ M2a port → M2a residue → (Resurrection proof ∥ M1b ∥ M2b) → M4 ledger → M3 verification → Replay. **The path ends there** — the Agent adapter step was removed on 2026-08-30 when WP4's STOP rule fired on the null H0. It returns only under WP8's single named reopen condition.


**Independent critical sub-paths:** the resurrection proof does not depend on H0, M3, or M4 — it must move earlier in the queue to avoid the failure mode where the headline gate is the project's reason to exist and is scheduled after multiple packages.

**Hard preconditions that gate everything:**
1. **DONE (2026-08-30, verified live):** HEAD SHA re-pinned (`2b0dcbd3743e5603cfa54bd4f76403c6843716ef`); working tree clean per `git status --porcelain`. Re-verify before any edit regardless — this ages out immediately.
2. **DONE (verified in `NOTICE` on disk, 2026-08-30):** rights attestation is recorded — "Attested by the author, 2026-08-27." See `phase-1-m0-core-extraction/current-state.md`.
3. **DONE (verified in `README.md` on disk, 2026-08-30):** no references to absent packages found.
4. F1 diff3 fix — not re-verified this pass; last confirmed at commit `ed92803` (0 → 377 exact regions on `jqlang/jq`).
5. **DONE:** H0 execution gate closed, VALID, by the fresh 2026-08-30T02-54-42-056Z run; see §3.4.

---

