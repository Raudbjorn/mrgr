# Final Mercury attempt — completed 2026-09-08

**NO DEMONSTRATED MEAN BENEFIT (FINAL COHORT ATTEMPT).** The complete, valid run failed all four conditions in the [frozen terminal rule](PROTOCOL.md). This closes the cohort: no additional repeats, arms, exclusions, weight changes, or acquisition in response to this result. The earlier failed studies remain unchanged; this attempt authorizes no confirmation and reopens no WP8 gate.

Mercury-2's `candidates-structural` policy passed 384/720 scheduled evaluations (53.33%), versus 350/720 (48.61%) for `hunk-only`. These are **12 repeated measurements of the same 60 Go cases in 34 lineages**, not 720 independent cases per arm. The combined candidate-framing and structural-candidate policy had a mean gain of **+4.72 percentage points**, with substantial variation between runs.

| Frozen requirement | Observed result | Decision |
| --- | --- | --- |
| Unweighted mean > +5pp | +4.72pp | Failed |
| Four-cell fixed-weight mean > +5pp | +4.85pp | Failed |
| Repository CV3/t interval lower endpoint > 0 | 95% interval [−0.09, +9.53]pp | Failed |
| Run-level t interval lower endpoint > 0 | 95% interval [−0.66, +10.10]pp | Failed |

The point estimate is positive but does not establish the declared benefit. Neither interval excludes zero, and neither establishes equivalence or proves that the true effect is zero. The proposal's claim that the earlier pattern was “not noise” was a hypothesis; this fresh run does not substantiate a stable +13–15pp mean gain.

## Fresh runs and reliability

All 1,440 scheduled requests were dispatched once, sequentially, using the exact archived request bodies. Both arms received fresh calls in every repeat; no previous responses were pooled. Mercury-2 used temperature 0.75, high reasoning, max_tokens 16384, and a 180-second request timeout. There were no answer retries or exclusions. Dispatch finished at 2026-09-08 06:00:35 UTC; behavioral evaluation finished at 07:26:29 UTC.

| Repeat | Structural passes /60 | Hunk-only passes /60 | Unweighted gain (pp) | Repository 95% interval (pp) | Fixed-weight gain (pp) | Blend gain (pp) |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 28 | 29 | −1.67 | [−13.69, +10.36] | −0.96 | +3.33 |
| 2 | 35 | 23 | +20.00 | [+6.05, +33.95] | +19.98 | +23.33 |
| 3 | 32 | 29 | +5.00 | [−8.33, +18.33] | +4.41 | +10.00 |
| 4 | 29 | 33 | −6.67 | [−19.23, +5.90] | −6.73 | −6.67 |
| 5 | 34 | 32 | +3.33 | [−8.59, +15.25] | +2.88 | 0.00 |
| 6 | 34 | 28 | +10.00 | [−4.21, +24.21] | +10.97 | +6.67 |
| 7 | 33 | 31 | +3.33 | [−8.44, +15.11] | +3.79 | 0.00 |
| 8 | 31 | 24 | +11.67 | [+0.02, +23.31] | +11.79 | +13.33 |
| 9 | 26 | 30 | −6.67 | [−20.37, +7.03] | −6.33 | −13.33 |
| 10 | 37 | 27 | +16.67 | [+2.36, +30.98] | +16.46 | +26.67 |
| 11 | 32 | 32 | 0.00 | [−8.79, +8.79] | −0.65 | +3.33 |
| 12 | 33 | 32 | +1.67 | [−10.01, +13.35] | +2.57 | 0.00 |

Eight repeats (1, 3, 4, 5, 7, 9, 11, 12) did not exceed +5pp under either weighting. Three unweighted gains were negative and one was zero. These diagnostics remain reported even though the new terminal rule concerns the mean, rather than the earlier per-run conjunction.

The paired gain's sample SD was **8.46pp**, equivalent to 5.08 cases per 60-case run. Structural yield SD was **5.17pp** (3.10 cases), and hunk-only yield SD was **5.36pp** (3.21 cases). Thus both arms varied materially; the fresh data do not support treating only the earlier first structural run as the anomalous draw.

The run-level interval uses 12 paired deltas and 11 degrees of freedom. It describes repeat variability on this fixed cohort, subject to the declared iid-run approximation. The repository interval deletes every repetition of a lineage together, with 34 lineages and the existing conservative 30-df cap. It addresses a different uncertainty source and is not replaced by the run interval.

Within-case success counts across the 12 fresh repeats are retained individually in [aggregate.json](run/aggregate.json), under `finding.reliability.*.counts`. Their distributions are:

| Successes out of 12 | Structural cases | Hunk-only cases |
| --- | --- | --- |
| 0 | 14 | 18 |
| 1 | 3 | 1 |
| 2 | 1 | 3 |
| 3 | 4 | 3 |
| 4 | 2 | 2 |
| 5 | 0 | 1 |
| 6 | 2 | 3 |
| 7 | 3 | 0 |
| 8 | 5 | 4 |
| 9 | 5 | 2 |
| 10 | 3 | 7 |
| 11 | 5 | 9 |
| 12 | 13 | 7 |

## Frozen composition

The same cases were retained throughout, including their module/GOPATH era labels. Each of the four cells has weight 0.25 in the standardized estimate; observed cell sizes were not used to retune those weights.

| Cell | Cases | Lineages represented | Structural passes / scheduled repeats | Hunk-only passes / scheduled repeats | Mean gain (pp) |
| --- | --- | --- | --- | --- | --- |
| side-verbatim/module | 15 | 9 | 91/180 | 97/180 | −3.33 |
| side-verbatim/GOPATH | 15 | 12 | 105/180 | 85/180 | +11.11 |
| blend/module | 17 | 13 | 107/204 | 99/204 | +3.92 |
| blend/GOPATH | 13 | 7 | 81/156 | 69/156 | +7.69 |

Lineages can appear in multiple cells, so the lineage column must not be summed. Across the 30 blend cases, the arms passed 188/360 versus 168/360 scheduled repeats, a descriptive +5.56pp mean difference. Across the 30 side-verbatim cases, they passed 196/360 versus 182/360, a +3.89pp difference. These subgroup descriptions do not replace the frozen decision rule.

The standardized mean's conservative lineage-Hoeffding 95% bound is **[−71.39, +81.09]pp**, with half-width **76.24pp**. It uses the fixed four-cell lineage masses, including unequal lineage contributions. **No division by √12 was applied.** Repeating these same cases does not create independent lineages or justify substituting the narrower, unaccepted candidate-jackknife interval. Exact values and the independent reconstruction are in [result-audit.json](result-audit.json).

## Endpoint accounting and cost

| Outcome | Structural /720 | Hunk-only /720 |
| --- | --- | --- |
| Behavioral pass | 384 | 350 |
| Build failure | 234 | 245 |
| Test failure after build | 47 | 34 |
| Truncated output | 45 | 59 |
| Transport error | 8 | 4 |
| Halt | 0 | 23 |
| Invalid output | 2 | 5 |

All non-passes remain in the scheduled denominators. All 1,294 resolved candidates have verified behavioral evaluation receipts. The 104 truncations, 12 transport errors, 23 halts, and 7 invalid outputs are preserved separately. The maximum transport/provider error count in an arm/run was 3/60 (5%), which does not trigger the frozen **>5%** invalidity rule. No HTTP429 or environment-error terminal condition occurred.

Reported usage totals were 1,823,449 input tokens and 9,697,148 output tokens. At the frozen rates, the usage-based estimate is **$7.73** ($3.74 structural; $3.99 hunk-only). This is not a billing reconciliation: requests lacking returned usage may have unobserved charges. It excludes local execution and this research session's costs. The proposal's $1–2 estimate did not cover this fresh two-arm, 12-repeat design.

## Evidence and interpretation limits

The [receipt audit](receipt-audit.json) verifies every scheduled receipt, request and protocol hash, non-overlapping dispatch chronology, unchanged archived bodies and prior study artifacts, and the complete oracle preflight: **180 reference passes plus 120 compiling rejected mutations**. The [result audit](result-audit.json) verifies every candidate receipt, reconstructs all outcome rows and category/cost totals, independently computes the primary case-mean CV3 and run-level quantities, and checks the frozen terminal decision. The [completion audit](completion-audit.json) maps the authorized proposal and protocol requirements to these artifacts.

The [sizing calculation](sizing.json) selected 12 fresh paired runs before dispatch. Independent SciPy verification reproduced the grid and the 11/30-df critical values. Its 83.81% planning power assumed a true +13pp gain and estimated SD from only three historical runs; it was not a guarantee about repository-cluster power. The final measured gain and variability, rather than that planning assumption, determine the finding.

This is an exploratory comparison chosen after seeing earlier outcomes, on 60 already-exposed, oracle-admitted Go cases. It does not independently confirm H0, represent all repositories or languages, establish general semantic correctness, or isolate a structural tool's causal contribution from candidate framing. Its behavioral endpoint remains conditional on the preserved test oracles and inference settings.

**The authorized final attempt is complete and this cohort is closed.** No further attempt is proposed or launched. Previous negative findings and confirmation restrictions remain in force.
