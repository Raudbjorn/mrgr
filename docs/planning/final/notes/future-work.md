*Part of the [canonical planning document](../canonical-final-planning-document.md). Routing card, not a copy — each linked file is the actual content.*

# Working on M1b / M2b / M3 / M4 / Replay / Agent adapter

All of these are gated and not started (confirmed against the repo, 2026-08-30 — no code for any of them exists in `packages/`). Most are gated behind M2a residue, which is itself now blocked (see `notes/m2a.md`). The agent adapter is the exception: it's no longer gated on H0 (H0 is VALID), just on a working human/scripted adjudicator harness.

**Phase files:**
- `../phase-6-future-work/current-state.md` — state
- `../phase-6-future-work/work-packages.md` — WP7 (M1b/M2b/M3/M4/Replay) + WP8 (Agent adapter)

**Relevant cross-cutting rows:**
- `reference/risk-register.md` → "M3 pass-vacuously on no oracle," "D90-style duplicated ledger block," "Compile-event instrumentation drift," "Vacuous pinning test"
- `reference/decisions.md` → "Which entity parser, native package, grammar, Node version, config" (M1b, still gated)
- `reference/committed-recommendations.md` → row 8
- `reference/open-questions.md` → Q4 (agent adapter single-surface choice)

Skip: M0, M1a, H0, M2a, resurrection — this is genuinely nothing-to-do-yet territory unless you're specifically unblocking a prerequisite.
