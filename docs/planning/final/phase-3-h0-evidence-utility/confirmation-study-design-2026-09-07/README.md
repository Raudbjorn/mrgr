*Part of the [canonical planning document](../../canonical-final-planning-document.md).*

# Confirmation-shaped study design — 2026-09-07

**This is a design, not an authorization.** Nothing here runs. Executing any
part of it requires an explicit go-ahead, after the decisions in
[`decisions-required.md`](decisions-required.md) are made — not implicitly,
by having designed the study.

## Why this exists

Two independent studies this session (repaired development, exploratory
candidate-repair) closed negative — see the
[phase-3 closure certificate](../phase-3-closure-certificate.md). Phase 3 is
complete either way. This is the one legitimate path to a claim stronger
than either null: a genuinely new confirmation-shaped study on a **fresh**
cohort, not the same 60 already-observed cases (which cannot themselves
supply confirmation evidence no matter how many more times they're queried).

## What's real vs what's a decision

**Real, from actual data:**
- The mechanism worth carrying forward is `candidates-structural` vs
  `hunk-only` — the one comparison across both closed studies that showed a
  directionally consistent, non-noise-floor signal in both models (Mercury
  pooled +9.4pp, MiniMax pooled +6.7pp), even though neither robustly
  cleared +5pp.
- The power sweep at
  [`confirmation-power-check.json`](../../../../../evidence/h0/v3-confirmation-design-2026-09-07/confirmation-power-check.json)
  (script: [`confirmation-power-check.mjs`](../../../../../evidence/h0/v3-confirmation-design-2026-09-07/confirmation-power-check.mjs))
  uses the real `clusterJackknife` estimator and real per-lineage dispersion
  from both models, not a generic formula.

**Decisions, not resolved here** — see
[`decisions-required.md`](decisions-required.md) for the full reasoning:
1. **Model primacy** — keep both models co-primary (the inherited default),
   or explicitly weaken the hypothesis to "helps at least one model." The
   joint requirement costs a materially larger cohort for comparable power
   (the exact factor isn't reliably measured — the sweep treats the two
   models as independent, which they likely aren't); the document does not
   recommend one, because the reason anyone would prefer the cheaper option
   is exactly the reason the contract says that choice can't be made now.
2. **Required deterministic baseline** for this new comparison — unresolved.
3. **Effect floor** — a candidate +10pp is proposed, not adopted. The
   sweep shows that *if the true effect were only 5pp*, power to even
   detect it as positive stays low (≤0.36 joint, ≤0.83 either-model) up to
   2,000 cases — and the historical floor rule was stricter than "detect
   as positive," so real power against it would be lower still.

## The go/no-go gate

Read directly off the power sweep, once decisions 1–3 above are locked:

- If the locked model-primacy choice and effect floor show **no feasible
  size within the 400–2,000-case, ≥50-lineage envelope reaching acceptable
  power**, the honest outcome is
  **`INSUFFICIENT INFORMATION WITHIN THE STUDY ENVELOPE`** — a live,
  legitimate conclusion of this design phase, named here so it isn't
  discovered by surprise after acquisition starts. The inherited contract
  forbids responding to that outcome by expanding the envelope or reverting
  to a more optimistic assumed effect size.
- If a feasible size exists, the next step is
  [`acquisition-feasibility.md`](acquisition-feasibility.md)'s honest,
  bounded-not-precise cost picture — real numbers where they exist, a named
  next step where they don't, and an explicit refusal to manufacture false
  precision by multiplying rates that don't compose.

## What this design does not do

- Does not run anything, acquire any case, or spend API budget.
- Does not decide model primacy, the required baseline, the effect floor,
  or authorize an acquisition budget.
- Does not claim the power sweep's numbers are exact — every limitation in
  the script's header (three non-independent repeats per model, zero-
  discordance lineages, treating the two models' draws as independent) is
  named there, not hidden. Every power figure is an optimistic upper bound.
