*Part of the [canonical planning document](../canonical-final-planning-document.md).*

### WP6 — Resurrection proof (move here, before oracle)
- **Blocked — not named by the original acceptance gate (verified 2026-08-30):** all five reconstruction inputs (`ov2-base`, `base4-p`, `fork4-p`, `base6-p`, `fork6-p`) and the intermediate join tree `2e393f45` are unreachable in this repo's git object database. The private gate cannot start until these objects — or a remote/bundle that has them — are located. See `phase-5-resurrection-proof/current-state.md` for the verification.
- **Deliverable:** private gate reconstruction from `ov2-base`, `base4-p`, `fork4-p`, `base6-p`, `fork6-p`; audit derives the four deleted-test-monolith candidates from **reconstructed inputs** (not from final-ref inspection); post-edit audit finds zero candidates and all four absent; public gate ships a synthetic repo with the same topology and tiny files in `tests/fixtures/resurrection-topology/` and runs in CI.
- **Files/symbols:** new `packages/core/tests/resurrection.test.ts` (private gate); new `packages/core/tests/fixtures/resurrection-topology/` (public gate); CI wiring.
- **Acceptance gate:** four candidates derived from reconstructed inputs exactly match the four monoliths (949,331 bytes total in `2e393f45`); public-gate fixture reproduces the same positive result on a synthetic repo; CI runs the public gate on every push.
- **STOP rules:** any audit operating only on final refs (that is the revision-1 failure mode); marker or prose dependency in candidate detection; false positive on clean additions; byte or count mismatch.
- **Non-goals:** ship the public gate before the private gate is verified; combine with M1b/M2b/M3/M4 work.

