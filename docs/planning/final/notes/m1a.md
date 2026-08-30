*Part of the [canonical planning document](../canonical-final-planning-document.md). Routing card, not a copy — each linked file is the actual content.*

# Working on M1a (schema, persistence, `mrgr-db/2`)

**Phase files:**
- `../phase-2-m1a-persistence/current-state.md` — state (complete on all branches; verify against `packages/core/src/db/` directly if in doubt)
- `../phase-2-m1a-persistence/work-packages.md` — WP1 (P0) + WP2 (P1), both DONE
- `../phase-2-m1a-persistence/requirements.md` — schema/persistence/identity/error/test requirements (1,200 UTF-16 cap semantics)

**Relevant cross-cutting rows:**
- `reference/evidence-ledger.md` → M1a-R1 through M1a-R8
- `reference/risk-register.md` → "Silent carry-file mutation...", "Stale `semantic-merge/docs/M1a-evidence-bundles.md` 'Completed' claim"
- `reference/committed-recommendations.md` → rows 2, 3
- `reference/verification-leads.md` → the `evidenceBundles`/`parseCorpusRecord` row (already resolved — points you to `tests/db/` instead of the stale test names)

Skip: everything about H0, M2a, resurrection, M1b–M4 future work.
