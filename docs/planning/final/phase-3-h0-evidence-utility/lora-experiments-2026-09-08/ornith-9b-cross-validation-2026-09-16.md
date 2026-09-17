# Ornith-9B lineage-grouped cross-validation — 2026-09-16

Status: **INCOMPLETE at admission audit; terminal under this protocol.**
The authorized preparation found a control failure before training, export,
server changes, or model requests. The five-fold execution was not launched.

## Authorized design

The intended question is whether three-epoch rank-8 selector training improves
oracle-passing candidate selection on repository lineages withheld from each
adapter. This is exploratory cross-validation on inspected data, not fresh
confirmation and not a reopening of Phase 3 or the previous pilot.

User-selected primary weighting: equal lineage weight. User-selected hard budget:
24 hours including training, export, inference, retries and restoration; reserve
five minutes for cleanup. The population is exactly the 57 previously tokenized
examples, retaining the three historical length exclusions. No replacements.

Group canonical repository/fork identities, reconstruction parents, and duplicate
base/ours/theirs content (including normalized CRLF). Seed 20260916; sort connected
groups largest-first, break ties by seeded hash, then assign to the fold with the
fewest cases, fewest groups, and lowest index. All five folds are fixed before
model outputs. Historical repository-root era is the stratum; target-package era
must not silently change its meaning. No exhaustive near-clone or pretraining
contamination guarantee is claimed.

Each fold would start from the untouched pinned Ornith-1.5-9B checkpoint. Retain
rank 8, alpha 16, dropout .05, learning rate .0001, accumulation 4, three epochs,
anchored 16 attention projections, selected-position loss, 4096 training tokens,
and the final epoch checkpoint. No existing adapter initialization or tuning.
Train the first displayed passing candidate (otherwise halt); score any passing
candidate as correct.

Use the existing matched Q4_K_M base, no-thinking template, 32768 context, and
4096 output cap. Copy the complete September 15 sampler receipt: temperature .6,
top-k 40, top-p .95, min-p .05 and its remaining filters/order. Three paired-seed
repeats, balanced condition order, 342 scored requests. Q8, generation, LSP,
acquisition, extra repeats and permanent deployment are outside this protocol.

Planned primary analysis averages repeat success within case, then cases within
lineage, then lineages equally. Report case weighting secondarily, candidate
availability, incorrect selections, abstentions, format failures, repeat
disagreement, folds and strata. A 10,000-resample connected-lineage bootstrap
would be explicitly conditional on the fitted adapters; overlapping training
folds prevent claiming full retraining uncertainty. Persistent missingness means
INCOMPLETE, with conservative bounds rather than a model-quality null.

## Mandatory admission stop

Verify archived candidate bytes, labels, receipt hashes, three reference passes
and at least two compiling, observed test-rejected mutants for **every** case.
A timeout or failed completion contract is not a verified behavioral rejection.
Any unresolved admission problem ends preparation INCOMPLETE. Do not shrink the
cohort, replace a control, or rerun an oracle automatically to obtain admission.

That condition fired: `pelletier/go-toml`, case
`1ef47c17386e0c6585ca4c3bd2c8ea58d4a63c18cdfedd13ffbf9d2e6f21dc6f`,
has one ordinary test-rejected mutant and one externally timed-out mutant. The
latter's build exited 0, but its test process has null status and
`spawnSync /usr/bin/bwrap ETIMEDOUT`. Its receipt calls it `test-failure` with
reason `test-timeout`; it cannot supply the second verified rejection.

The preliminary planning check inspected candidate evaluations and found no
candidate timeout categories. It did not establish the separate mutation-control
requirement. This admission audit closes that gap. All 57 source cases remain
in the report; no training folds are authorized by this failed audit.

## Delivered and deferred

Delivered: non-generative admission auditor, deterministic provisional grouping,
configuration validation, portable hashed input manifest, regression tests,
terminal result, and planning index update. There are zero training runs and zero
model requests. Provisional fold sizes are for feasibility only, not an execution
freeze. The existing adapter and ordinary service are unchanged.

Execution-coordinator repairs, cumulative runtime enforcement, service restoration
error preservation, fold training/export, deployment probes and comparative
analysis are deferred because the mandatory stop fired. No untested coordinator
is shipped. A later attempt requires a separately declared resolution of the
control defect and a new protocol; this document grants no automatic continuation.

## Not claimed

No cross-validation result or model efficacy finding; no proof the timed-out
mutant is behaviorally equivalent or incorrect; no failed training attempt; no
independent confirmation; no completed runtime or GPU checks for this design.
