*Part of the [canonical planning document](../canonical-final-planning-document.md).*

## 13. Completion definition

The canonical plan is "complete enough for `/plan` to consume" when:

1. The current state of every milestone is named and pinned to a source-of-truth file (the phase-N `current-state.md` files in this split — `STATUS.md` caveat: §1.5 rule 2).
2. The dependency graph is explicit; no milestone is scheduled to depend on a non-existent artifact.
3. The `STOP` rules from `PLAN.md` are reproduced in §11 of this artifact and matched to the milestone they bind.
4. The H0 redesign requirements are specific enough that a planner cannot accidentally re-derive the invalidated experiment.
5. The M1a schema/persistence/identity/error/test requirements preserve the 1,200 UTF-16 code-unit semantic and original UTF-8 byte-count contract.
6. **Corrected 2026-08-30 (verified on disk):** publication rights and the doc correction list are done, not open — `NOTICE` carries the attestation, README/NOTICE are clean. The remaining M0 completion requirement is regenerating `closure-evidence.md` from a fresh clean clone at current HEAD.
7. M2a is bounded as a *port*, with explicit non-claim about the source experiment's result.
8. The kill-safe outcome is reproduced as the answer to a null H0.

