*Part of the [canonical planning document](../../canonical-final-planning-document.md).*

# Decisions required before this design becomes an authorized study

Nothing below is decided here. Each choice must be locked *before* any data
collection — deciding it after would be the outcome-driven policy search the
inherited decision contract forbids, exactly the mistake this project caught
and corrected twice already this session.

## 1. Model primacy

**Both models remain co-primary under the inherited contract**, unless a
fresh, standalone justification for dropping one is written and accepted
*before* seeing this study's data. This is stated as the default, not a
recommendation to keep it — the two options have sharply different costs,
computed from real power figures at
[`confirmation-power-check.json`](../../../../../evidence/h0/v3-confirmation-design-2026-09-07/confirmation-power-check.json):

The sweep tests `lower > 0` — the probability of showing the effect is
*positive*, not the probability of clearing any specific pp floor (that
would require a different, floor-shifted test the script does not compute).
Read the table below as "power to detect a positive effect," not "power to
clear +5pp" or "+10pp":

| | joint (both models required) | either model sufficient |
|---|---|---|
| power to detect a positive effect, true effect +10pp, 100 lineages | 0.79 at n=1000 | 0.98 at n=800 |
| power to detect a positive effect, true effect +13pp, 100 lineages | 0.96 at n=1000 | 1.00 at n=800 |
| power to detect a positive effect, true effect +5pp, any n up to 2000 | never exceeds 0.36 | never exceeds 0.83 |

The "roughly doubles/halves the cohort" comparison between the two columns
is itself softer than it looks: the script treats the two models' synthetic
draws as independent (stated in its own header), when in reality both
models answer the *same* cases and are plausibly positively correlated.
That would understate joint power and overstate either-power in the table
above — the two errors push in opposite directions, so the size of the gap
between the columns is an artifact of that assumption, not a measured
ratio. The direction (joint costs more than either) is robust; the exact
factor is not.

Correction of an earlier working assumption in this session: MiniMax does
*not* show zero signal on this specific comparison. Pooled across the closed
study's three repeats, MiniMax's own `candidates-structural` minus
`hunk-only` net is **+6.7pp** (Mercury: **+9.4pp**) — directionally similar,
noisier, neither robustly clearing +5pp. The two options are:

- **(a) Keep the joint conjunction.** Both models' lower bounds must clear
  zero. Costs a materially larger cohort for comparable power versus (b) —
  the exact factor is not reliably measured (see the independence caveat
  above), but the direction is robust: it requires the noisier of the two
  models to also succeed. This is the hypothesis actually inherited from
  the original design.
- **(b) Change to "helps at least one frontier model."** A materially
  different, weaker claim — it must be named as such in any resulting
  paper or decision record, not presented as a refinement of (a). A
  materially smaller cohort for comparable power.

Using Mercury's own repeat 2–3 pattern (from the exploratory study) as the
reason to prefer (b) would be the same post-hoc hypothesis change already
proposed and withdrawn once this session — the fact that this design is for
a *fresh* cohort does not launder that move, because the choice of which
model to relax the requirement for is still derived from having seen the
data that motivated relaxing it.

## 2. Primary comparison

`candidates-structural` vs `hunk-only`, plus the required deterministic
baseline (unresolved — see below). Two facts, stated separately because they
carry different weight:

- **Declaring the mechanism before its own data was legitimate.** The
  candidate-repair framing was proposed and frozen before the exploratory
  study ran.
- **Promoting it over the original context arms (`local-context`,
  `selected`) is informed by having watched those fail twice and this one
  wobble positive.** That is selection on an outcome, even though the
  mechanism itself was pre-registered. Say so plainly in any write-up; do
  not present the choice as mechanism-only.

**Unresolved: which deterministic baseline is "required."** The original
decision contract names "selected-minus-required-deterministic-baseline"
as a floor without pinning the specific baseline for this new comparison
(the original design's required baseline was calibrated for the context
arms, not for candidate-repair). Candidates, from the closed study's own
data: `longer-side` (best non-tool baseline, 27/60) or `mergiraf`
(20/60, but the only baseline the new candidate arm actually incorporates).
This needs a decision, not a default.

## 3. Effect floor

The inherited +5pp threshold was calibrated for the context-retrieval
comparison, not this one. A fresh, justified magnitude threshold is needed.
Proposed as a *candidate*, not adopted:

- **+10pp** as a minimal-interesting-effect: roughly midway between the two
  models' pooled observed nets (+9.4pp, +6.7pp) and well below Mercury's
  strongest single-repeat draws (+13–15pp), so it doesn't require the
  confirmation study to reproduce the most favorable exploratory numbers to
  succeed.

This needs explicit sign-off before it becomes the frozen floor. Note from
the power table above, precisely: it shows the power to detect a *positive*
effect (`lower > 0`) when the true effect is only 5pp — never exceeding
0.36 (joint) or 0.83 (either-model) up to the top of the 2,000-case
envelope. The historical floor rule was a **compound** condition — point
estimate at or above +5pp *and* `lower > 0` — which is strictly harder to
clear than `lower > 0` alone; real power against the full historical rule
would be *lower* than the figures above, not higher. So if the true effect
really is only around 5pp, reusing that floor unmodified would very likely
manufacture a third `INSUFFICIENT INFORMATION WITHIN THE STUDY ENVELOPE`
outcome — which is exactly why a fresh, larger candidate floor is proposed
above rather than reusing the old one by default.
