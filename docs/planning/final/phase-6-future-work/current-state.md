*Part of the [canonical planning document](../canonical-final-planning-document.md).*

### 3.8 M1b / M2b / M3 / M4 / Replay / Agent adapter
- **State (verified against repo, 2026-08-30):** all not started — confirmed accurate, no code for any of these exists in `packages/`.
- M1b/M2b/M3/M4/Replay are gated behind M2a residue, which is now itself blocked on locating the Round 5.1 source (see `phase-4-m2a-mechanisms/current-state.md`).
- **Superseded (2026-08-30):** an earlier correction here read "Agent adapter is no longer gated on H0 — H0 is VALID", which was true about validity and silently assumed positivity. H0 is VALID and **NULL**: the acceptance gate was executed on 2026-08-30 and not met. The agent adapter is **retired**, not gated — WP4's STOP rule fired. See `work-packages.md` WP8 and `../phase-3-h0-evidence-utility/current-state.md`.

---
