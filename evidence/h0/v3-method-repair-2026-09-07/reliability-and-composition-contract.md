# Composition and test–retest contract — 2026-09-07

Frozen design choices below precede any repaired-instrument solver responses. They apply to the next versioned development study, not either existing diagnostic matrix. This contract is not an authorization to run an unfinished instrument.

## Composition

Record each case in four cells: exact side-verbatim versus blend, crossed with module-era versus GOPATH-era. Side-verbatim means the reference bytes exactly equal either parent replacement; blend means neither equality holds. Era means whether the historical root scaffold contains `go.mod`, matching the current acquisition tool's module-mode decision. This is a recorded build-path stratum, not a general historical-period or language classification. Nested-module exceptions must be separately recorded.

Use **fixed weights of 0.25 per cell**, hence 0.50 side-verbatim and 0.50 blend, and 0.50 per build era. This is an explicitly standardized estimand, not a claim about deployment prevalence or the naturally acquired population. Equal weights express equal representation of the four named conditions; they were not solved from the favorable interval of observed model effects. The current 60-case cohort has counts 15 side-verbatim/module, 15 side-verbatim/GOPATH, 17 blend/module and 13 blend/GOPATH. No existing case is removed or retrospectively resampled to make those counts equal.

Retain the original unweighted overall conjunction alongside the standardized analysis; the additional analysis cannot rescue a failure of the original claim. For future readiness, apply the recorded point-estimate floors to **both** the unweighted and the fixed-weight contrasts for both models. Report paired effects and discordances in every cell and in the blend stratum. A missing cell makes the standardized estimate unavailable and blocks readiness; do not renormalize its weight into the remaining cells. The weighted estimator and its repository uncertainty require calibration before use. Do not reuse the old unweighted power calibration as evidence for it.

Recovery screening can increase the GOPATH-era supply, but cannot change these weights. Prediction of admission is an acquisition-efficiency exercise; it does not establish population prevalence. Preserve all screened cases, exclusions, duplicate attempts and unavailable scaffolds. Confirmation remains disjoint from every development and repeat exposure.

## Scheduled generation reliability experiment

After the instrument, composition estimator and controls are ready, freeze the 60 development cases and the complete provider/request matrices. Execute **three independent generations per case, model and arm** at the specified temperature 0.75: Mercury-2 and MiniMax-M3; hunk-only, local-context and selected. The primary matrix is run 1. Runs 2 and 3 add exactly **720 scheduled requests**, for 1,080 total development requests. No additional repeat is selected because a prior outcome is unfavorable. Provider failures, truncation and invalid output remain outcomes under the frozen policy; preserve rate-limit stops and incomplete runs rather than silently retrying answers.

Use identical model identifiers, request bodies, source bytes, token limits and inference settings across repetitions; only request order and request identifiers may vary. Freeze a deterministic balanced ordering across model/arm/case cells, record actual timestamps and provider receipts, and preserve each generation and evaluation separately. Evaluate every repeat through the same frozen oracle. The time interval of the experiment bounds the reliability claim; provider drift is not assumed absent.

For each model/arm, report all three 60-case yields and their sample standard deviation, plus case-level discordance and within-case success counts. For each required contrast, report all three unweighted and standardized paired differences and their sample standard deviation. Three runs provide only two degrees of freedom for the run-level SD; do not present this as a precise estimate of production variability. Use repository-level resampling that retains all outcomes for a case together when assessing uncertainty. Repeats are not new cases, repository clusters, or confirmation data.

## Readiness consequence

The futility floors must hold in **each of the three runs**, for both models, under both estimators. A reversal or floor failure stops confirmation for this policy with **UNSTABLE OR INSUFFICIENT DEVELOPMENT BENEFIT**. Report the variability; do not average repeats solely to make the primary gate pass, append cases, change weights, or add more repeats until it passes. This is an operational conservative readiness rule, not proof of zero population effect. The primary confirmation estimand remains a single scheduled model generation per case; development repeats characterize its noise rather than silently changing the endpoint into a success probability or best-of-three oracle.

Passing reliability and point-estimate readiness permits power assessment only. Confirmation requires calibrated uncertainty and power for the actual model-specific joint outcomes, not a homogeneous +10pp assumption.

## Implementation status

This fixes the schedule and weights now. The [deterministic schedule builder](repeat-schedule.mjs) now passes its [runnable check](repeat-schedule.test.mjs), with [source-hash receipt](repeat-schedule-test.json): 1,080 unique request IDs, three identical body hashes per case/model/arm, balanced cell ordering, and 60 cases across 34 clusters. The provider dispatcher, repeated-outcome aggregation, weighted estimator/calibration and final readiness integration remain to be implemented and verified. No repeat request has been sent under this contract. The existing paused acquisition/controller records and frozen inference matrices are unchanged.
