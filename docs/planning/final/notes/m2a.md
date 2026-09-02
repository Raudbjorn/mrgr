*Part of the [canonical planning document](../canonical-final-planning-document.md). Routing card, not a copy — each linked file is the actual content.*

# Working on M2a (merge mechanisms, `@mrgr/mechanisms` port)

**Port done 2026-09-02, partially.** The Round 5.1 source this work ports from — `merge-mechanism-driver.sh`, `MECHANISM-PREFLIGHT.json`, `adjudicate.py` — is not in this repo or its remote branches (verified 2026-08-30, still true), but is **located and verified** at `/home/svnbjrn/rsrch/projects-mrgr/experiment/round5/`. A local TypeScript port now exists at `packages/mechanisms/src/{adapter,registry}.ts`, covering the three-mechanism dispatch, status normalization, and attribute/binary-macro routing — see `work-package.md` for exactly what's proven versus deferred (no git-merge-driver integration yet, so "outer Git" status and tree-level preservation are unproven).

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
