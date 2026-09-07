*Part of the [canonical planning document](../canonical-final-planning-document.md).*

# Retirement of the MEASURABLE gate, and what replaces it — 2026-09-07

**The binary `MEASURABLE=YES|NO` gate is retired.** It is replaced by two
deliberately separate things: a **finding record** that reports what H0 measured,
and a **decision register** that lists which decisions are waiting on that finding.
Today the register has one row, and it is not on any critical path.

This document is authoritative for the gate's status. It changes nothing else:
the futility floors, the fixed composition weights, the three-run reliability
schedule and the confirmation envelope are inherited **unchanged** from the
[decision contract](../../../../evidence/h0/v3-method-repair-2026-09-07/decision-contract.md)
and the [composition and test–retest contract](../../../../evidence/h0/v3-method-repair-2026-09-07/reliability-and-composition-contract.md).

## Why it is retired

**1. The decision it gated is closed.** The gate was never a scientific verdict. Its
original job, from `planning/phases/h0/discriminator-plan-original.md`:

> Revision 2 of the mrgr plan defers the agent adapter until H0 proves it earns its
> build cost. […] If yes, the agent adapter and `@mrgr/evidence-bundle` package get
> built. If no, the forensic core ships alone.

That build/no-build question was answered NO on 2026-08-30, user-confirmed, when
WP4's STOP rule fired. `phase-6-future-work/work-packages.md`: *"WP8 — Agent adapter
— **RETIRED 2026-08-30**. Status: retired, not deferred and not gated."*
`reference/dependency-graph.md`: *"**The path ends there** — the Agent adapter step
was removed on 2026-08-30."* M2a is independent of H0 positivity, Phase 4 is
complete, Phase 5 does not depend on H0, and a valid result closes Phase 3
*"whether positive or inconclusive."*

A gate that gates nothing is a scoreboard. It was producing the behaviour a
scoreboard produces: sixteen acquisition rounds, each able to conclude only "not
yet."

**2. It is the scalar its own design forbade.** The original plan: *"Four score
columns, never pooled: correct · wrong · halt · token cost. **No 'score' or
'accuracy' number ever computed.**"* `verdict()` now reduces a twenty-way
conjunction across two models to one bit, and that bit is the headline of every
document in this phase.

**3. One bit cannot carry the states that actually exist.** The contracts now
enumerate at least five distinct terminal outcomes with different meanings and
different consequences. `MEASURABLE=NO` currently denotes all of: instrument
invalid, study incomplete, development futile, envelope insufficient, and
confirmation failed. Those are not the same finding and must not share a label.

## What replaces it — Part A: the finding record

Phase 3 reports a **record**, not a verdict bit. Every field is independently
falsifiable and none is derived from another.

| field | values | meaning |
| --- | --- | --- |
| `instrument` | `VALID` / `INVALID` | Do the measurements mean anything? Integrity, controls, oracle admission, boundary contract. Independent of any effect. |
| `stage` | `IN_DEVELOPMENT` / `IN_CONFIRMATION` / one terminal state below | Where the study is. A terminal state ends Phase 3 for the current policy. |
| `effects` | numbers, never a bit | Per model × comparator × stratum, **both** unweighted and fixed-weight standardized, with clustered intervals and paired discordances. Cells reported separately; a missing cell blocks the standardized estimate rather than being renormalised away. |
| `reliability` | numbers | Per model/arm: three 60-case yields, their sample SD, case-level discordance, within-case success counts. Two degrees of freedom — reported as a bound on stability, not a precise variance estimate. |
| `decision` | pointer | Which register rows this finding resolves. Usually none. |

The record never collapses to a single word. A reader wanting "did it work" reads
`effects`, in the stratum they care about, at the weighting they declare.

## What replaces it — Part B: the decision register

The register lists every decision currently waiting on an H0 finding. **It is the
retirement**: if the register is empty, no amount of H0 evidence changes what the
project builds, and "are we there yet" is not a meaningful question.

The table below is a rendering of [`decision-register.json`](decision-register.json),
not an independent record — edit the JSON first; a mismatch between the two is a
bug, and [`phase3-closure-check.mjs`](../../../../evidence/h0/phase3-closure-check.mjs)
checks the JSON directly rather than trusting this table.

| # | Decision waiting on H0 | Status | On critical path? |
| --- | --- | --- | --- |
| 1 | Reconsider WP8 (agent adapter) and a separate `@mrgr/evidence-bundle` | Retired 2026-08-30. A valid positive **may justify reconsideration** — it does not authorize shipping, and does not establish semantic safety. | **No** |

**Finding recorded 2026-09-07:** the [completed repaired study](../../../../evidence/h0/v3-repaired-development-2026-09-07/FINDING.md) has a VALID instrument and ends at `NO DEMONSTRATED BENEFIT / CONFIRMATION STOPPED`. Register row 1 remains retired; this finding supplies no basis to reconsider it. No confirmation or additional acquisition follows.

**Exploratory study opened 2026-09-07, before its outcome was known:** the stopping contract permits one continuation — *"any substantive new selector or population after this stopping decision is a separately declared exploratory study."* That study is [candidate verification and repair](../../../../evidence/h0/v3-candidate-repair-2026-09-07/PROTOCOL.md) (protocol document `sha256:997efafc233db748…`, frozen run protocol `sha256:6bec2b3ed4…`, 720 requests, three repeats). It reframes the task from generation to selection-and-repair over already-derivable candidates, and carries its own tool-free control so a positive result cannot be read as "the model plus mergiraf beats the model". **It reuses the same 60 already-observed cases, so it is development evidence and cannot clear a gate**; a non-binding result would license proposing a fresh confirmation cohort and nothing more. Register row 1 stays retired either way. This paragraph was written while the run was in flight, as the receipt that the protocol predates the outcome.

**Exploratory study closed 2026-09-07:** [`FINDING.md`](../../../../evidence/h0/v3-candidate-repair-2026-09-07/FINDING.md) reports `NO DEMONSTRATED BENEFIT (EXPLORATORY)`, instrument `VALID` — the same verdict as the study it followed, with a parenthetical marking it exploratory. The prespecified repeat-1 floor bound for both models: MiniMax shows no benefit at any repeat; Mercury tied its own `hunk-only` exactly on repeat 1 (its worst draw) but gained +15.0pp and +13.3pp in repeats 2–3, a real but unstable direction the repeat-1 stopping rule correctly did not wait for. The tool-recognition contrast (R2, 17-case subset) is inconclusive at its own 19–21% same-prompt noise floor. A mid-run package upgrade (`oh-my-pi` 18.1.11-1 → 18.1.13-1) drifted the environment hash; 182 of 633 resolutions were cross-checked both ways (182/182 identical verdicts, [`environment-equivalence.json`](../../../../evidence/h0/v3-candidate-repair-2026-09-07/run/environment-equivalence.json)), the remaining 451 evaluated once under the drifted hash on the strength of that induction, before the result was computed on a separate, documented amendment path — the frozen `protocol.json` and `study.mjs` were never edited and still fail their own check on purpose ([`ENVIRONMENT-AMENDMENT-1.md`](../../../../evidence/h0/v3-candidate-repair-2026-09-07/ENVIRONMENT-AMENDMENT-1.md)). Register row 1 remains retired. A Mercury-only, variance-focused next attempt is written up but deliberately not run — [`NEXT-ATTEMPT.md`](../../../../evidence/h0/v3-candidate-repair-2026-09-07/NEXT-ATTEMPT.md) — since launching it unprompted, immediately after a null, is the outcome-driven pattern the stopping contract exists to prevent even when the hypothesis behind it is real. Running it is the user's call, not an automatic next step.

**Phase 3 formally closed 2026-09-07:** see the [phase-3 closure certificate](phase-3-closure-certificate.md) and its backing check, [`phase3-closure-check.mjs`](../../../../evidence/h0/phase3-closure-check.mjs) — a claim someone can run and find false, not an assertion. The only sanctioned path to a stronger claim than either null above is a genuinely new confirmation-shaped study on a fresh cohort; it is designed, not run, at [`confirmation-study-design-2026-09-07/`](confirmation-study-design-2026-09-07/README.md), and explicitly does not decide model primacy, the effect floor, or acquisition budget on its own authority.

That is the whole register. Nothing else in the plan waits on H0: not M2a, not
Phase 4, not Phase 5, not M0 publication. Adding a row requires naming the decision,
its owner, and what evidence would settle it — before the evidence exists.

## Terminal states

Collected from the existing contracts; only the positive label is new (see note).
**None of these is a "not yet."** Each ends Phase 3 for the current policy. Reaching
one is the study finishing, not the study failing to finish.

| state | trigger | licenses | forbids |
| --- | --- | --- | --- |
| `INVALID INSTRUMENT` | Validity failure at any stage | Repair under a new protocol version, with the failure record preserved | Reading it as a null **or** a positive result |
| `NO DEMONSTRATED BENEFIT / CONFIRMATION STOPPED` | Either model's selected-minus-control point estimate ≤ +5pp, or selected-minus-required-baseline ≤ 0, on repaired development | Closing Phase 3 with the estimates and intervals | Another acquisition round in response; larger n (it does not move point estimates) |
| `UNSTABLE OR INSUFFICIENT DEVELOPMENT BENEFIT` | Floors fail in any of the three reliability runs, or a reversal across runs | Reporting the variability | Averaging repeats to make the gate pass; appending cases or repeats until it does |
| `INSUFFICIENT INFORMATION WITHIN THE STUDY ENVELOPE` | No feasible size in the 400–2,000-case, ≥50-lineage envelope meets predeclared power | Recording that the question is unanswerable at this cost | Automatically expanding the envelope; reverting to homogeneous +10pp assumptions |
| `POSITIVE UTILITY NOT ESTABLISHED` | A valid fixed confirmation fails the conjunction | Reporting uncertainty and any separately supported negative or equivalence conclusion | Treating an interval containing zero as proof of equivalence |
| `BOUNDED POSITIVE UTILITY` *(new label)* | A valid fixed confirmation passes the conjunction | Exactly this claim, verbatim from the decision contract: *"the estimated gain was at least five percentage points, with evidence that the population gain is positive"*; and reconsideration of register row 1 | The stronger claim that the population gain is **at least** 5pp — that needs the lower bound above +5pp, not above zero. Shipping anything. |

*Note on the new label:* the contracts name five terminal states but never named the
positive one, because the retired bit occupied that slot. `BOUNDED POSITIVE UTILITY`
is introduced here and is defined **only** by the contract's own claim sentence. It
adds no new licence.

## Code change — applied

This section originally specified the change below and deliberately deferred
applying it: at the time of writing, a process (PID 3778996) was mid-`evaluating`
inside `aggregate()`, importing `v3.mjs`, with protocol validity bound to
`sourceHashes()` — editing it then would have corrupted an in-flight result.

**Verified 2026-09-07: applied.** `evidence/h0/v3.mjs` carries `version:'h0-behavioral-result/4'`
and `verdict()` returns `finding:{instrument, stage, effects, reliability, decision}`
per Part A above; the `MEASURABLE` field is gone (checked programmatically by
[`phase3-closure-check.mjs`](../../../../evidence/h0/phase3-closure-check.mjs)).
The file's mtime (02:34 UTC) predates this document's original 11:24 UTC writing
by nine hours — the change landed exactly as specified, once the referenced
round-16 process reached a terminal stage, before this section was first drafted.
The `valid`, `complete`, `eligible`, `comparisons` and `metrics` fields are
unchanged; every `/3` aggregate on disk remains untouched and readable under its
own schema, as specified. The original four numbered steps are preserved below
as the record of what was specified, not as an outstanding to-do:

1. Bump the aggregate schema to `h0-behavioral-result/4`. — **done**
2. Remove the `MEASURABLE` field; replace with `finding:{instrument, stage, …}`
   per Part A. — **done**
3. Replace the `interpretation` string with the terminal-state name from the
   table above. — **done**
4. Leave every `/3` aggregate on disk untouched. — **done**

## Adoption list — for whoever is next in these files

Four documents assert the gate. Another session was editing `current-state.md` and
`execution-and-handoff-2026-09-06.md` at the time of writing, so these are **not
applied here** — they are one-line pointers to add when that work is idle:

- `current-state.md` — replace the leading `MEASURABLE=NO` with the current terminal
  state or `stage: IN_DEVELOPMENT`, and link this document.
- `work-packages.md` — same, in the arm-contrast review notice.
- `redesign-requirements.md` — same, in the active-extension notice.
- `phase-0-frame-and-status/answer-first-verdict.md` — the "What does H0 still mean?"
  row should point at the decision register rather than at a verdict field.

## What this does not change

The futility floors, the ≤ +5pp stop rule and its no-more-acquisition clause, the
0.25-per-cell composition weights across side-verbatim/blend × module/GOPATH era,
the 1,080-request three-run reliability schedule, the disjointness of confirmation
from all development and repeat exposure, the retained unweighted conjunction, and
the requirement that structurally-zero comparators be reported as such. All
inherited unchanged. This document retires a label and the decision-coupling behind
it. It does not touch a threshold.
