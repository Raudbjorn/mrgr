# September 17 review clarification — no execution authorization

The [original CV protocol](ornith-9b-cross-validation-2026-09-16.md) is terminal.
The later [conditional control amendment](ornith-9b-control-repair-2026-09-16.md)
superseded only the named case's admission stop, then itself stopped on environment
drift. Both original documents retain their frozen bytes and hashes. Neither now
grants a retry or automatic continuation.

The [offline correction](../../../../../evidence/h0/ornith-9b-cv-review-2026-09-17/README.md)
withdraws the unsupported 113-rejection claim: 72 ordinary assertion rejections
are verified, leaving 26/57 cases below the two-control gate. The shared rule
requires a clean build, test exit 1, explicit Go failure output, and no timeout,
signal, infrastructure error or uncaught panic. Distinct controls require distinct
names and candidate hashes. This is a review of existing observations, not a
newly successful admission or a change to the historical experiment.

The closed unsafe executor is retired. There is no successful correction receipt
to consume and no running deadline to extend. A new protocol must specify an
admissible control design, environment identity, scope-wide attempt and receipt
bindings, and fold allocation before execution. The old case-balanced provisional
folds and equal-lineage estimand remain recorded; their mismatch is an unresolved
design decision, not silently repaired by changing the folds.

No model, oracle, acquisition or training run is authorized by this clarification.
