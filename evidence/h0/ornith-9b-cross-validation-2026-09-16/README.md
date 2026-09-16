# Ornith-9B cross-validation admission audit

**INCOMPLETE (admission audit). Zero training runs; zero model requests.**
The fixed 57-case protocol required two verified compiling test-rejected mutations
per case. One case has only one such rejection; the second control timed out.
The audit therefore stopped before freezing training folds or leasing the GPU.

| Audit observation | Count |
| --- | ---: |
| Cases / repository lineages | 57 / 32 |
| Cases with passing candidates | 47 |
| Cases with no passing candidate | 10 |
| Cases with multiple passing candidates | 13 |
| Mutation controls with ordinary test rejection | 113 |
| Mutation controls with external timeout | 1 |
| Cases missing the required second verified rejection | 1 |

The affected case is `pelletier/go-toml`, ID
`1ef47c17386e0c6585ca4c3bd2c8ea58d4a63c18cdfedd13ffbf9d2e6f21dc6f`.
`token-21-1` failed its tests normally. `token-32-0` compiled, then reached the
external deadline during `TestQuerySliceRange`; the subprocess status was null
and the error was `spawnSync /usr/bin/bwrap ETIMEDOUT`. The historical evaluator
classified that timeout as `test-failure`. This is insufficient for this
protocol's requirement of two observed test-rejected mutations. It does not
establish the cause of the timeout.

[audit.json](audit.json) retains all 57 rows, compact control-stage receipts,
source receipt hashes, cell counts and provisional fold sizes.
[inputs.json](inputs.json) hashes the original case archive, tokenization,
prepared examples, checkpoint metadata and all 57 private oracle receipts.
Declared `$REPOSITORY` and `$PILOT_STORAGE` prefixes replace local absolute paths.
The original receipts remain untouched. Candidate-label counts are descriptive
of that archive, not newly acquired observations.

The provisional grouping has five nonempty folds and keeps each lineage and
connected parent/content group together. It is **not an authorized execution
freeze**: the admission gate failed. No case was excluded or substituted to make
the gate pass. The three prior length exclusions remain recorded separately.

[Protocol](../../../docs/planning/final/phase-3-h0-evidence-utility/lora-experiments-2026-09-08/ornith-9b-cross-validation-2026-09-16.md)
records equal lineage weighting and the 24-hour cap chosen by the user. The
execution and training stages are deferred under its mandatory stop rule.

## Validation

Nineteen Python checks and 46 maintained H0 tests passed, including six new
preflight checks. All 61 original
input hashes were reverified. Python syntax checks passed. The ordinary service
remained active.

Repository-wide typecheck and tests were attempted but fail on merged main
`1ede61be1`: Vitest 4.1.11 resolves Vite 5.4.21, which lacks the requested
`vite/module-runner` export/types. This branch changes no dependency files.
[validation.json](validation.json) records the distinction; repository checks are
not claimed passing.

## Not claimed

No adapter comparison, generalization result, quality null, scarcity estimate,
training failure, or new inference result. No GPU/service intervention occurred.
The six preflight regression checks cover grouping, configuration and control
classification; they do not validate a five-fold training coordinator. That
coordinator is not shipped because this audit blocks its use.
