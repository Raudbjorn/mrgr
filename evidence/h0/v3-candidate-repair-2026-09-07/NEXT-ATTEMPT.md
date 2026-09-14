> **Execution update, 2026-09-08:** The user authorized this proposal on 2026-09-07. The separately frozen [final protocol](../v3-mercury-final-2026-09-07/PROTOCOL.md) has now completed all 12 fresh paired runs. The valid finding is [NO DEMONSTRATED MEAN BENEFIT (FINAL COHORT ATTEMPT)](../v3-mercury-final-2026-09-07/FINDING.md): mean +4.72pp, fixed-weight mean +4.85pp, with both required uncertainty intervals including zero. This cohort is closed. The proposal below is preserved as written; its “not run” status, cost estimate, and “not noise” assertion describe the pre-authorization proposal, not the completed evidence.

# Proposed next attempt — not run

This is a proposal, not a study. Nothing described here has been executed.
It exists so that if a further attempt is authorized, it starts from a
declared hypothesis rather than from "the last one came back null" —
which is exactly the outcome-driven search the decision contract forbids
(see [`decision-contract.md`](../v3-method-repair-2026-09-07/decision-contract.md)).

## The one signal in the data that isn't noise

Everything else in [`FINDING.md`](FINDING.md) is either a clean null
(MiniMax, every repeat, every comparator) or indistinguishable from the
same-prompt noise floor (R2, the 17-case tool-recognition subset). One
thing is neither: Mercury's `candidates-structural` yields **31, 38, 36**
across the three repeats — SD 3.61 cases, the largest in the reliability
table (R4) — against `hunk-only`'s **31, 29, 28** (SD 1.53). Repeat 1 was
Mercury's worst draw on *both* new arms simultaneously, which is what
bound the prespecified floor. Repeats 2 and 3 show +15.0pp (CI entirely
above zero) and +13.3pp.

That pattern supports a **variance question, not an effect question**: is
repeat 1 an unlucky draw around a real positive mean, or is the mean
genuinely near zero and repeats 2–3 are the unlucky draws in the other
direction? Three repeats on two degrees of freedom cannot tell those apart.

## What a legitimate next attempt would test

**Hypothesis:** Mercury's gain from `candidates-structural` over
`hunk-only` is real and positive, and repeat 1 was an unstable low draw at
temperature 0.75 rather than evidence the effect is absent.

**Design, if authorized:**
- Mercury only. MiniMax showed zero signal at every repeat under both new
  arms; there is no hypothesis left to test for it on this cohort.
- `candidates-structural` vs `hunk-only` only — the one comparison that
  produced a directional, wide-interval-but-positive pattern in 2 of 3
  repeats. Not a fishing expedition across all nine comparators.
- Repeat count chosen from the observed SD (3.61 cases on n=60), not a
  round number — enough repeats that a true near-zero effect and a true
  +13–15pp effect would be expected to separate under the existing
  cluster-jackknife estimator.
- Declared, in advance, as the **last** attempt on this cohort. If it also
  fails to clear the floor, that closes the question for these 60 cases,
  full stop — not grounds for a further round.

## Why this is not being run now

1. **It cannot clear a gate.** Same 60 already-observed cases as every
   arm before it. At best it sharpens a development-stage estimate that
   already points in a direction; it cannot itself authorize confirmation.
2. **Launching it unprompted, immediately after a null, is the exact
   pattern the stopping contract exists to prevent** — continuing to spend
   until a result flips. The fact that this proposal has a real mechanistic
   basis (a variance question, not a wish for a different sign) is what
   distinguishes it from that pattern in principle; running it without the
   user electing to would erase the distinction in practice.
3. Cost is real but small (roughly $1–2 at observed per-request rates for
   a Mercury-only extension) — small enough that the reason to hold is
   the precedent, not the money.

This document is the proposal. Running it is the user's call.
