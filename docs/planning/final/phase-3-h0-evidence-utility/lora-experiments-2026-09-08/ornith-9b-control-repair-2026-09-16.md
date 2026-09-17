# Ornith-9B exact control replacement protocol — 2026-09-16

This supersedes only the admission-control stop for case
`1ef47c17386e0c6585ca4c3bd2c8ea58d4a63c18cdfedd13ffbf9d2e6f21dc6f`.
It does not revise historical receipts or silently change the 57-case population.

## Predeclared change and acceptance

Retain reference `\tstart, end, step := 0, MaxInt, 1\n` and first mutant
`\tstart, end, step := 1, MaxInt, 1\n`. Replace only the timed-out second
mutant with `\tstart, end, step := 0, MaxInt, 2\n`. These are literal tab/newline
bytes, hashed before execution. The model never receives mutation controls.

Require exact environment fingerprint equality with the last successful case
revalidation, plus unchanged scaffold, oracle, boundaries and evaluator commands.
Any drift stops the attempt. This requirement includes the existing fingerprint's
whole pacman inventory; it is not silently narrowed to tool binaries.

Run three cycles of reference, retained mutant, replacement mutant. Each reference
must compile and meet the original 113-test completion contract. Each mutant must
compile and produce an ordinary nonzero test exit with an explicit test assertion
failure; timeout, signal, sandbox error, completion-only failure, and unrelated
panic do not count. Then evaluate every original candidate once and require
unchanged labels. Use fresh isolated evaluator directories and 120 seconds per
build/test stage, at most one hour total. No retry, alternate mutant, deadline
increase, case exclusion, or replacement case is permitted.

## Continuation and budget

Start one 24-hour wall deadline on the revalidation attempt, including all stages
and retries in the later evaluation. Reserve five minutes for restoration. Only
a successful correction receipt permits the full 57-case re-audit and fold freeze.
Bind that receipt to the source case, old receipt, amendment, environment and raw
results. Nothing may override candidates, prompts, labels, strata, or other cases.

After successful admission and harness checks, continue the selected five-fold
protocol: equal lineage weighting, three-epoch rank-8 adapters from the untouched
base, matched Q4_K_M serving, frozen no-thinking sampler and 342 scored requests.
Finish cumulative budget, configuration, disjointness and restoration-error
safeguards before any GPU stage. No training is authorized on failed revalidation.

## Terminal reporting

Preserve every attempted stage and raw result. A failed precondition is
INCOMPLETE, not a mutant failure or LoRA quality null. Keep the previous audit
terminal and append this amendment's separate result. No automatic fallback to a
different environment contract is authorized by this protocol.
