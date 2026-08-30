*Part of the [canonical planning document](../canonical-final-planning-document.md). Routing card, not a copy — each linked file is the actual content.*

# Working on M2a (merge mechanisms, `@mrgr/mechanisms` port)

**Read the blocker first:** the Round 5.1 source this work is supposed to port from — `merge-mechanism-driver.sh`, `MECHANISM-PREFLIGHT.json`, `adjudicate.py` — does not exist anywhere in this repo or its remote branches (verified 2026-08-30). Before doing anything else here, locate that source or accept you're redesigning the adapter from the description in the phase files, not porting existing code.

**Phase files:**
- `../phase-4-m2a-mechanisms/current-state.md` — state + the blocker above, in detail
- `../phase-4-m2a-mechanisms/work-package.md` — WP5
- `../phase-4-m2a-mechanisms/boundaries.md` — M2a / Round 5.1 boundary (what a port may and may not claim)

**Relevant cross-cutting rows:**
- `reference/evidence-ledger.md` → M2a-S1, S2, S3 (Round 5.1 source-experiment record — **existence in this repo not verified**, treat as planning-doc claims only), MM-1, MM-2, MM-3 (Mergiraf mechanics/licensing)
- `reference/risk-register.md` → "M2a adapter equivalence drift," "License-coupling risk with Mergiraf," "D79-class mixed merge losing earlier text resolution"
- `reference/decisions.md` → §4.1 mechanism-design rows (settled), §4.2 "bundled-Mergiraf install path" and "`merge-tree` status change" rows (still gated)
- `reference/committed-recommendations.md` → row 6
- `reference/verification-leads.md` → the git_text adapter equivalence row (now flags the missing-source blocker), the Mergiraf license row

Skip: M0, M1a, H0, resurrection, M1b–M4 future work.
