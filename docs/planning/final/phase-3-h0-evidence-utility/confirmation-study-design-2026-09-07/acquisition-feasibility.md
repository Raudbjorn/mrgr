*Part of the [canonical planning document](../../canonical-final-planning-document.md).*

# Acquisition feasibility — bounded, not precise

**The end-to-end scan-to-admission ratio for the original 60-case cohort was
not recoverable from available construction records in a bounded search.**
This document says what is known, states the bound honestly, and names the
concrete next step rather than manufacturing a false-precision estimate by
multiplying rates that don't compose.

## What is real and reusable

[`admission-patterns.json`](../../../../../evidence/h0/v3-method-repair-2026-09-07/admission-patterns.json)
covers 681 candidate cases with extracted features across 158 repositories,
stratified by era/vendor cell:

| cell | cases | repositories | first-screen passes | raw rate |
|---|---:|---:|---:|---:|
| gopath/no-vendor | 353 | 117 | 23 | 6.5% |
| gopath/vendor | 93 | 25 | 1 | 1.1% |
| module/no-vendor | 222 | 71 | 33 | **14.9%** |
| module/vendor | 13 | 4 | 1 | 7.7% |
| **overall** | **681** | **158** | **58** | **8.5%** |

This is a **first-screen pass rate**, several funnel stages above full oracle
admission (three passing reference re-evaluations, at least two compiling
rejected mutations, splice-boundary contract match). It is the only reusable,
real rate available, and it is **not** extended into an end-to-end
admitted-case prediction here — that would multiply an unknown further-funnel
survival rate onto a real number and present the product as if it were
equally real.

## What is explicitly excluded as an anchor, and why

The GOPATH recovery round (2026-09-07) screened 345 retained cases and
produced 2 full oracle admissions. **This ratio is deliberately not used
here.** That was a targeted repair of one specific, already-diagnosed failure
mode (a `_/work` GOPATH packaging defect) applied to a pool of *previously
rejected* cases — a much harder population than a fresh first-pass scan, by
construction. Treating 345→2 as a general acquisition yield would be the
same category of error as extrapolating a screen-only rate into an admission
rate: a real number, misapplied.

A separate, larger acquisition source exists —
[the ConGra archive](../../../../../evidence/h0/v3-acquisition-2026-09-06/README.md),
11,051 candidate case directories across 34–35 projects — but as of its own
receipt, **zero validated executable behavioral cases** had been produced
from it; it is a sampling frame, not a yield estimate.

## Honest bound

**Bounded below by the module/no-vendor first-screen rate (14.9%), unknown
above.** If a fresh scan drew disproportionately from module-era,
no-vendor Go repositories (the best-yielding cell observed), and if
first-screen survival to full admission were, optimistically, comparable to
the closed 60-case cohort's own overall yield — a number this document does
not have and is not estimating — reaching 400–2,000 admitted cases across
≥50 independent lineages would require scanning a multiple of that many
candidate cases, from repositories not already represented in the existing
34-lineage development cohort (reusing them would not add independent
clusters). This is stated as a scale of the problem, not a budget.

## Concrete next step, named but not taken

If a real answer matters before authorizing acquisition: recover the
original v3 60-case corpus's own construction logs
(`_corpus_regen.ts`/`_corpus_freeze.ts` and their run history) for a
scanned-candidate-events count, giving one genuine end-to-end data point.
This was not done as part of this design pass — it is a bounded,
well-defined follow-up, not a blocker to reading the rest of this design.
