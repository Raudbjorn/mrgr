# Monitoring decision — 2026-09-08T23:46:59.164164+00:00

This is an operational/reporting note written after the first two completed outcomes, not a preregistration or an amendment to the frozen experiment. No running code, schedule, model settings, service definition, or primary outcome was changed.

## Continue the frozen grid

Keep all 1,440 requests: 60 cases × two conditions × 12 repeats. Keep the model artifact, high effort, temperature 1, explicit filters, 16,384-token output cap, 32,768 context and one slot. Frozen protocol digest verified against every preserved input:

`52f8f96e76ec9ff5fb5598bf476ba466f1712db70cbe7abb4c3f877283437d3e`

The schedule already shuffles case/repeat pairs and balances condition order six/six within each case. The first 144 scheduled requests contain 72 per condition across 44 distinct cases; these are neither 144 independent cases nor a balanced completed repeat over the cohort.

## Instrumentation already present

Receipts retain response.choices[0].finish_reason, exact raw body, prompt/completion/total tokens, monotonic elapsed_ms, timestamps, case/arm/repeat, seed and request/protocol hashes. The observed truncated receipt explicitly has finish_reason=length and 16,384 completion tokens. The completed candidate receipt has finish_reason=stop and 13,374 completion tokens.

The stored `truncated` category is a format-failure subtype, separate from explicit abstention (`halt`); retain that subtype in reports. It is derived from finish_reason, not a missing Harmony end marker. Primary success requires an acceptable completed resolution and oracle pass. Report truncation, output-token distributions and latency separately per condition. Different completion rates can suggest a termination benefit, but cannot by themselves identify why it occurs or establish correctness.

Receipts are atomic and keyed by frozen protocol/case/arm/repeat identity. Completed receipts are reused and verified on resume. This is not an automatic crash-retry promise: an unresolved started request or stale process lock requires recovery, and missing responses are not silently resent or imputed as model failures. The watchdog records operational failures; the earlier infrastructure recovery remains separately documented.

## Runtime estimate and stopping

After at least 50 completed requests, the retained data permit a separate read-only ETA analysis: inference time versus prompt/output tokens, retaining truncated requests and condition-specific output distributions. Include oracle and other overhead and report uncertainty; a fit to two responses is not informative. No new watcher or change to dispatch is needed to collect these data. This note does not claim that an automatic ETA report has been installed.

Keep the existing fixed-completion design and operational failure stops. Do not add an outcome-based stop at request 144: “near-miss” is undefined, observations repeat cases, and stopping one condition would leave the planned paired grid incomplete. Any future outcome-based sequential design needs explicit units, endpoints, look schedule, stopping boundaries and an analysis that accounts for stopping. A cancellation for time/resource reasons must be reported as an incomplete study, not a completed null or positive result.

The first pair is one case: hunk-only truncated, candidates passed. It supplies no reliable estimate of the condition effect. No hypothesis, mixture weights, comparator or threshold changes follow from it.
