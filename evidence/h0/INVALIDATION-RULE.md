# H0 run invalidation rule

An H0 run is **invalid** if any arm has `fabricated_evidence_ids > 0` in
`aggregate.json`, or any record's `decision` is not one of
`{keep_ours, keep_theirs, compose, halt}`.

`fabricated_evidence_ids` counts records where the model cited a
`[source:<id>]` tag not among the id(s) that record's own prompt actually
exposed (`evidence_ids_exposed`) — see `_h0_runner.ts`'s `buildMessages` for
what gets exposed per arm, and `_aggregate.ts`'s `aggregate()` for where the
check runs.

This rule is enforced in code: `_aggregate.ts` sets `run_valid: false` and
`verdict: "invalid"` in `aggregate.json` whenever it fires, listing the
offending arms in `invalidation_reasons`. It is no longer a human-applied
rule read off the raw counts — a prior run (2026-08-29) was ruled invalid
this way by hand, citing a `h0-rerun-after-redesign-plan.md:117` that was
never committed to this repository; this file is the checked-in replacement
for that citation.

Rationale: a run where the adjudicator fabricates citations is not measuring
what the experiment is designed to measure (whether real evidence changes
decision quality) — an unconstrained model can always "cite" its way to a
plausible-sounding `reason` regardless of whether it used the evidence it was
given. Any fabrication in an arm means that arm's `correct`/`wrong` counts
are not trustworthy on their own terms.
