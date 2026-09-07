# H0 v3 inference repair — round eight

The primary runner now uses **CV3 cluster-jackknife Student-t intervals**. Future confirmation requires **at least 50 independent repository lineages, with case counts differing by at most one**. This supersedes the earlier 12-cluster percentile-bootstrap design for new v3 studies. It strengthens the earlier minimum and preserves the 15% concentration cap, 400–2,000-case grid, independent confirmation, both-model replication and every effect threshold. **MEASURABLE remains NO.**

The [inventory](development-inventory.json) is unchanged at 22 fresh cases across nine lineages. No new solver calls or cases were added. A previously admitted bbolt case passes [end-to-end preparation](instrument-preflight/) under the revised instrument; it is not counted twice. Development still needs 38 cases, followed by preparation and execution of the complete model matrix.

## Why the design changed

Round seven established under-coverage of the previous interval in simulated 12-cluster designs. This round tests remedies before using empirical solver outcomes. The restricted wild bootstrap with CV3 studentization (WCR-V) follows the null-imposed score construction discussed by [MacKinnon, Nielsen and Webb](https://arxiv.org/html/2301.04527v2), equations 24–28. It matches an [independent exhaustive Python calculation](wild-numerical-reference.json), but [calibration](wild-calibration.json) still fails for skewed effects with 12 unequal clusters: acceptance of the true null is 94.0% and 92.8%. WCR-V remains a research candidate, not the primary decision rule. No confidence-interval endpoints were constructed for that candidate.

The adopted CV3 variance is the leave-one-cluster-out variance centered on the full-sample estimate, corresponding to equation 18 of the same paper. Its interval uses `t(min(G−1,30), .975)`. The degrees-of-freedom cap and upward-rounded [critical-value table](student-critical-values.json) are conservative numerical choices, avoiding a new runtime dependency. For one cluster the interval is uninformative. When estimated variance is zero, the implementation uses an independent-cluster bounded-sum interval instead of claiming zero uncertainty: half-width `sqrt(2 × log(40) × sum((n_g/N)^2))`, clipped to the effect's [-1,1] range. This is a specialization of [Hoeffding's bounded-sum inequality](https://www.tandfonline.com/doi/abs/10.1080/01621459.1963.10500830).

These are nominal confidence intervals supported by the stated assumptions and calibration, not a distribution-free guarantee for the whole CV3 procedure. The fallback alone uses a bounded-sum guarantee under independent clusters.

## Calibration evidence

The [50-cluster audit](fifty-cluster-calibration.json) uses eight independently seeded scenarios with 10,000 simulated studies each: equal allocations and allocations of 6/10 cases, no or symmetric repository shifts, and skewed zero-mean shifts in both directions. Observed coverage ranges from **95.02% to 95.65%**. The implemented allocation is stricter than the unequal 6/10 sensitivity design.

Two [sparse-allocation checks](sparse-cluster-calibration.json), also with 10,000 studies each, cover 250 and 400 clusters within 400 observations; coverage is 95.87% and 96.02%. A [final-source replay](final-calibration-replay.json) reproduces all 100,000 study outcomes exactly after the zero-variance fallback was added. A further [full-grid audit](full-grid-calibration.json) checks skewed effects at 800, 1,200, 1,600 and 2,000 observations across 50 balanced clusters: coverage is 95.04–95.77% over eight additional 10,000-study scenarios.

Every result is an instrument simulation with known population truth. Simulated rows are not acquired merge cases and do not demonstrate evidence utility. Calibration covers the declared paired-outcome distributions, allocation patterns and null effects; it does not establish reliability for arbitrary dependence, contamination, selection bias or all possible outcome distributions. Development data must inform the actual power assumptions and any further necessary sensitivity checks.

## Code and planning changes

- The runner's `clustered` export now routes to the CV3-t implementation. New protocols record the interval method and confirmation allocation constraints.
- `confirmationShape` enforces at least 50 lineages, positive integer counts, at most one case of imbalance and the original concentration limit.
- `balancedSelection` chooses the largest feasible number of lineages using the existing deterministic case order and source availability. Its choices do not use solver outcomes. It returns no design when a balanced allocation is unavailable.
- Power and confirmation now require `h0-v3-design/2`. A version-one power receipt cannot authorize the new confirmation.
- The selected-rate nuisance estimate now uses selected arms only, rather than averaging baselines into it. Its existing planning clamps and paired-Bernoulli feasibility adjustment are explicitly disclosed.
- Old runs retain their archived instruments. The research audit imports the archived percentile implementation explicitly, so an audit labeled “pairs” cannot silently execute the new method.

The estimator, table and shape checks are verified in [inference checks](inference-checks.txt); all ten [runner checks](runner-checks.txt) and the [acquisition checks](screen-checks.txt) pass. Tests cover fixed numerical variance, independent WCR calculations, degenerate uncertainty, invalid input, deterministic balanced selection, insufficient balanced supply, original admission controls and reachable positive/null/harmful decisions.

## Power and outstanding evidence

A [joint-rule check](joint-rule-smoke.json) produces no false positive in 1,000 all-null simulations. Under a hypothetical 10pp effect, 400 observations and 50 balanced clusters, joint power is only 47.8%, demonstrating that the planner must not equate the minimum sample size with sufficient evidence. A [hypothetical grid check](joint-power-grid.json) reaches 95.8% joint power at 800 observations (Wilson lower bound 93.7%) under its declared assumptions. This establishes reachability, not an empirical selection of 800 cases.

A [least-favorable-null check](least-favorable-null.json) tests the full conjunction with one null Mercury/keep-ours comparison and all other comparisons strongly positive, sharing deterministic baseline outcomes across providers. Across 5,000 studies for each skew direction, false-YES rates were 2.66% (Monte Carlo 95% interval 2.25–3.14%) and 2.54% (2.14–3.01%). It is additional simulation evidence, not a substitute for calibration of the observed data distribution.

Complete the 60-case development cohort and both-provider matrix, then select an adequately powered balanced confirmation using the actual development receipt. Reprepare all cases with the final instrument before model exposure. Phase 4's completed independent integration and Phase 5's separate resurrection proof remain unchanged.
