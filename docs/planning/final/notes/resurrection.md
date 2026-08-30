*Part of the [canonical planning document](../canonical-final-planning-document.md). Routing card, not a copy — each linked file is the actual content.*

# Working on the resurrection proof

**Read the blocker first:** all five pinned reconstruction inputs (`ov2-base`, `base4-p`, `fork4-p`, `base6-p`, `fork6-p`) and the intermediate join tree `2e393f45` are unreachable in this repo's git object database — `git cat-file -e <sha>` fails for all six (verified 2026-08-30, checked against `origin/next-phase` too). The private gate cannot run until these objects, or a remote/bundle that has them, are located. The public gate (synthetic repo, same topology) doesn't depend on them and can proceed independently.

**Phase files:**
- `../phase-5-resurrection-proof/current-state.md` — state + the blocker above, in detail
- `../phase-5-resurrection-proof/work-package.md` — WP6

**Relevant cross-cutting rows:**
- `reference/risk-register.md` → "Resurrection proof passing vacuously on finals-only audit"
- `reference/committed-recommendations.md` → row 7
- `reference/verification-leads.md` → the synthetic-repo public-gate-in-CI row

Skip: M0, M1a, H0, M2a, M1b–M4 future work.
