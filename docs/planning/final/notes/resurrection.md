*Part of the [canonical planning document](../canonical-final-planning-document.md). Routing card, not a copy — each linked file is the actual content.*

# Working on the resurrection proof

**Blocker resolved 2026-09-01, fully materialized 2026-09-02.** All five pinned reconstruction inputs (`ov2-base`, `base4-p`, `fork4-p`, `base6-p`, `fork6-p`) and the intermediate join tree `2e393f45` were unreachable in this repo's git object database (verified 2026-08-30, `origin/next-phase` too) — that's still true of `main`. They're **located** at `/home/svnbjrn/rsrch/projects-mrgr/experiment/baseline/scratch` as five live branch tips matching this doc's own names, plus the join tree as a dangling-but-recoverable object there. Fetched into local refs (`refs/mrgr-imports/resurrection/*`) and re-inserted the tree by content hash — `git cat-file -e` now succeeds here for all six. The join tree's child content is now fully materialized locally (0 missing objects out of 15,707 blobs, recursively verified via `git ls-tree -r --long`); the private gate in `resurrection.test.ts` runs and passes on this machine as a result. See `../phase-5-resurrection-proof/current-state.md` for the verification detail. The public gate (synthetic repo, same topology) never depended on any of this and runs in CI regardless.

**Phase files:**
- `../phase-5-resurrection-proof/current-state.md` — state + the blocker above, in detail
- `../phase-5-resurrection-proof/work-package.md` — WP6

**Relevant cross-cutting rows:**
- `reference/risk-register.md` → "Resurrection proof passing vacuously on finals-only audit"
- `reference/committed-recommendations.md` → row 7
- `reference/verification-leads.md` → the synthetic-repo public-gate-in-CI row

Skip: M0, M1a, H0, M2a, M1b–M4 future work.
