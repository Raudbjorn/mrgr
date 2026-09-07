*Part of the [canonical planning document](../canonical-final-planning-document.md).*

### WP7 — M1b / M2b / M3 / M4 / Replay (each separately gated behind M2a residue)
- Each is a future work package. Sequencing rule: M1b requires ≥20 hand-marked units across ≥2 repos **before** execution; M2b requires frozen M2a residue; M3 requires compile-event instrumentation from the start (retrofitting is impossible); M4 requires D90-style concurrent-record-collision test; Replay is characterization-only until H0 supplies a non-halt threshold.

### WP8 — Agent adapter — **RETIRED 2026-08-30**
- **Status: retired, not deferred and not gated.** WP4's STOP rule ("a null H0 retires the agent adapter and `@mrgr/evidence-bundle`; the forensic core ships alone") fired when H0's acceptance gate was executed on 2026-08-30 and not met — no arm beats the best trivial baseline, and no arm is ever correct where the constant is wrong. See `../phase-3-h0-evidence-utility/current-state.md` and `evidence/h0/SIGNIFICANCE-2026-08-30T02-54-42-056Z.md`. `@mrgr/evidence-bundle` as a separate package is retired with it; bundle emission stays inside `@mrgr/core`.
- **Reopen condition amended 2026-09-06.** The [new concrete-output protocol](../phase-3-h0-evidence-utility/execution-and-handoff-2026-09-06.md) replaces normalization-only repair and reuse of the old thirty cases. Only its valid positive evidence, or a separately frozen future study, can justify reconsidering the adapter. Historical agreement alone does not establish semantic safety or authorize shipping an adapter. This condition does not block Phase 4.
- **Deliverable, if it ever reopens:** one surface, not four; a working human/scripted adjudicator as a precondition; evidence quoted, tagged with provenance, structurally separate from instructions.
- **STOP rules (retained for that case):** any package size > current `@mrgr/core` baseline without a justified reason; any "constrains"-adjacent wording without a verified bypass test.

