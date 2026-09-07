*Part of the [canonical planning document](../canonical-final-planning-document.md).*

# Phase 3 closure certificate — 2026-09-07

This is a falsifiable claim, not an assertion: **run
[`evidence/h0/phase3-closure-check.mjs`](../../../../evidence/h0/phase3-closure-check.mjs)**.
It reads the actual result files and the decision register, and prints
`{closed: true, ...}` or `{closed: false, ...}` with the specific failing
check named. This certificate is void the day that script prints `false`;
it is not to be defended by argument at that point, only revised.

## Why "closed" does not mean "positive"

The six-state terminal-state table in
[gate-retirement-2026-09-07.md](gate-retirement-2026-09-07.md#terminal-states)
defines five of six ways to end Phase 3 as non-positive outcomes, and states
plainly: *"None of these is a 'not yet.' Each ends Phase 3 for the current
policy."* Phase 3 closes on a valid measurement, not on a favorable one.

## What is being certified

1. **Two independent, differently-mechanised studies, both valid, both closed negative.**
   - Repaired development study (context retrieval): `NO DEMONSTRATED
     BENEFIT / CONFIRMATION STOPPED`, VALID instrument, complete.
     [`v3-repaired-development-2026-09-07/aggregate.json`](../../../../evidence/h0/v3-repaired-development-2026-09-07/aggregate.json)
     · [`FINDING.md`](../../../../evidence/h0/v3-repaired-development-2026-09-07/FINDING.md)
   - Candidate verification and repair (exploratory, generation reframed as
     selection): `NO DEMONSTRATED BENEFIT (EXPLORATORY)`, VALID instrument,
     complete. [`v3-candidate-repair-2026-09-07/run/aggregate-amended.json`](../../../../evidence/h0/v3-candidate-repair-2026-09-07/run/aggregate-amended.json)
     · [`FINDING.md`](../../../../evidence/h0/v3-candidate-repair-2026-09-07/FINDING.md)
     — this study's result required a documented environment-drift
     amendment; see [`ENVIRONMENT-AMENDMENT-1.md`](../../../../evidence/h0/v3-candidate-repair-2026-09-07/ENVIRONMENT-AMENDMENT-1.md).
     The frozen `protocol.json` and `study.mjs` were never edited and still
     fail their own live-environment check on purpose.

2. **The decision register is empty of anything on the critical path.**
   [`decision-register.json`](decision-register.json) is the single source
   — the table in `gate-retirement-2026-09-07.md` is a rendering of it, not
   an independent copy. Its one row (WP8 reconsideration) is retired and
   off critical path.

3. **The retired binary gate is gone from the live artifacts**, not just
   described as retired in prose. `evidence/h0/v3.mjs` no longer computes
   a `MEASURABLE` field (removed 2026-09-07, per the diff specified in
   `gate-retirement-2026-09-07.md` and applied in this closure pass).
   `current-state.md`, `redesign-requirements.md`,
   `phase-0-frame-and-status/answer-first-verdict.md` assert no live
   `MEASURABLE=` value. `work-packages.md` still contains
   `MEASURABLE=NO`/`MEASURABLE=YES` **once**, inside a section explicitly
   marked `## Preserved v2 WP3/WP4 amendment — 2026-09-06` and annotated as
   historical, since-retired terminology — preserving what was actually
   declared on that date rather than rewriting history. The check verifies
   this annotation is present, not that the historical string is absent.

## What is explicitly not certified, and stays open by design

- **[`NEXT-ATTEMPT.md`](../../../../evidence/h0/v3-candidate-repair-2026-09-07/NEXT-ATTEMPT.md)**
  — a Mercury-only variance follow-up on the *same* 60 cases, motivated by
  its unstable-but-real repeat 2–3 signal. Designed, deliberately not run:
  launching it on null-result pressure alone is the outcome-driven search
  the decision contract forbids, even with a real mechanistic hypothesis
  behind it. Running it is the user's call.
- **[`confirmation-study-design-2026-09-07/`](confirmation-study-design-2026-09-07/README.md)**
  — the only path that could produce a *stronger* claim than either null:
  a genuinely new confirmation-shaped study on a fresh cohort. Designed,
  not run. It does not decide model primacy, the effect floor, or
  acquisition budget — those are named as required decisions, not resolved.

Neither of these being open blocks closure. Per the register: nothing
downstream — not M2a, not Phase 4, not Phase 5, not M0 publication — waits
on either happening.
