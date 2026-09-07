# Candidate verification and repair — separately declared exploratory study

**Version** `h0-candidate-repair-exploratory/1` · **Declared** 2026-09-07, before any model call in this study.

## 0. Standing of this study

The repaired development study
(`evidence/h0/v3-repaired-development-2026-09-07`, protocol `h0-repaired-development/1`)
closed at **NO DEMONSTRATED BENEFIT / CONFIRMATION STOPPED** with a valid instrument.
The stopping contract permits exactly one continuation:

> Any substantive new selector or population after this stopping decision is a
> separately declared exploratory study, not continuation of the same confirmation attempt.
> — [decision-contract.md](../v3-method-repair-2026-09-07/decision-contract.md)

This is that study. It is bound by three limits, stated here so no later reader has to infer them.

1. **It does not rescore, reweight, re-run, or reinterpret the closed study.** Those outcomes are
   read as frozen inputs and are never recomputed. The closed study's terminal state stands.
2. **It cannot clear a gate.** It reuses the same 60 cases, which all three existing arms have
   already seen across three repeats. A new arm on an already-observed cohort is development
   evidence. It can estimate nuisance parameters and justify a confirmation design; it cannot
   itself establish utility. A positive readout here earns the right to propose a fresh
   confirmation cohort — which the acquisition ledger says is the expensive part: 345 scheduled
   retained cases yielded 2 full oracle admissions.
3. **A positive result is not promised.** The deliverable is a mechanism with a stated reason to
   work, run under a prespecified rule, and an honest report of whatever it produces. A second
   negative on a differently-mechanised intervention is a real result and will be reported as one.

## 1. Why this intervention, and not more context

The closed study's damage is diagnosed, not guessed:

| Observation | Value |
|---|---|
| Damage is Mercury-specific | MiniMax blend passes 45/47/47 across hunk-only/local-context/selected — context neutral. Mercury drops 43 → 33/36. |
| Mercury's build failures rise with context | 39 → 49 (local-context), 43 (selected) |
| Mercury **under**-generates with context | length ratio vs reference, median 1.00 → 0.84; fraction under 0.7× rises 0.17 → 0.38 |
| Discordance is asymmetric for Mercury | context lost 7–8 cases hunk-only won, gained 1 |

Adding retrieved context asks the model to *generate* a span while holding more material in view,
and Mercury responds by emitting less, more often failing to build. The intervention therefore
changes the **task framing**, not the amount of evidence: present already-derivable resolutions as
candidates to check and repair. Producing syntactically valid, splice-fitting code is then largely
pre-solved, and the model's job becomes selection plus targeted repair.

Headroom is real but must be stated precisely. **The union figures below are oracle bounds**: they
count a case solved if *any* candidate happened to be right, which requires knowing the answer.
An unsupervised chooser lands somewhere between the always-pick-one floor and the oracle ceiling,
and nothing in the existing data locates it.

| Quantity (60 cases, repeat 1) | Value |
|---|---|
| Best single arm observed | minimax/local-context **36/60** |
| Best deterministic baseline | longer-side **27/60** |
| Oracle union, mercury hunk-only + mergiraf | 40/60 |
| Oracle union, + keep-ours | 48/60 |
| Oracle union, + keep-theirs | 52/60 |
| Oracle ceiling, any method at all | 55/60 — 5 cases solved by nothing |

**The open question this study asks: does unsupervised selection recover even a third of the gap
between 36/60 and the oracle union?**

Degenerate collapse is not a way to win: always-longer-side 27, always-keep-ours 26,
always-keep-theirs 20, always-mergiraf 20, always-git-union 15 — every constant strategy is far
below the best arm at 36.

## 2. Arms

Both new arms are built on **hunk-only** — no retrieved context — so the only manipulation is the
candidate block. Splice-boundary contract, output contract, models, settings, evaluator, scaffold,
oracle and toolchain are byte-identical to the closed study.

| Arm | Candidate set | Isolates |
|---|---|---|
| `candidates-tool-free` (control) | keep-ours, keep-theirs, longer-side, git-union — deduplicated | **framing alone** |
| `candidates-structural` (treatment) | the same, plus mergiraf's structural merge where it produces one | **the tool** |

`candidates-tool-free` is the fair control the contrast needs. Every candidate in it is a function
of `base`, `ours` and `theirs`, which the model already holds verbatim in every arm including
hunk-only. It supplies **no information the model did not already have**. Comparing
`candidates-structural` against `hunk-only` alone would conflate two changes — the reframing and a
tool invocation — and a positive result would read only as "the model plus mergiraf beats the
model", which is weaker than what the gate certifies. Both contrasts are declared here, before the
run, not chosen afterwards from whichever looks better.

**Mergiraf resolves 22 of 60 cases, but contributes a candidate text no tool-free baseline already
supplies in only 17.** In the other 5 its output duplicates an existing candidate and dedup removes
it. The subset is therefore defined on *candidate-set difference*, not on mergiraf resolving —
verified in code as identical to prompt-byte difference. So:

- the tool contrast is prespecified to the **17-case subset**, and
- the remaining **43 cases are byte-identical prompts across the two arms**, a stochastic
  duplicate-prompt stability control giving an empirical same-prompt noise floor at temperature 0.75
  to read the 17-case contrast against.

Within those 17 contributing cases mergiraf's own output passes 15 times. Where the tool adds
something it is usually right, so R2 is a genuine test of whether the model can *recognise* a
correct candidate it was not otherwise given — not a test of whether the tool is any good.

The 17-case subset has cells `blend/module` 11, `side-verbatim/module` 3, `blend/GOPATH` 2,
`side-verbatim/GOPATH` 1, spanning 9 lineages, with 3 of 4 cells supported by at most 2 lineages.
That cannot support the four-cell standardized estimator, so on that subset **only the unweighted
estimator is reported**, and this limit is stated wherever the number appears.

### Candidate presentation

- **Unlabeled.** No candidate says where it came from. No count relationship between arms is stated.
- **Shuffled**, ordered by a seed derived from `sha256(case_id + ':' + arm)`, recorded in
  `requests.json`. The order does not depend on which candidate is correct.
- **Content-addressed IDs** `cand-<8 hex of sha256(text)>`, citable, leaking nothing.
- **A resolution is required, not an index.** The output contract stays byte-identical to the closed
  study, so the evaluator, decoder and splice path need no change. This also removes the anchoring
  failure mode in which a model returns a choice it would not have written.
- Candidates are declared untrusted data and may all be wrong; producing an original resolution
  remains available, so the framing does not force a pick.

## 3. Schedule, estimator, and what is frozen

**720 requests** = 2 arms × 60 cases × 2 models × **3 repeats**. Three repeats are not optional.
The closed study's run-to-run spread is large relative to the effect being looked for — minimax
`selected` ran 32/39/32 and mercury `local-context` ran 25/27/23 across repeats, a sample SD near
4 cases against a floor of 3 cases. **A single run of this study would be uninterpretable.**
Estimated cost ≈ $4–6 at observed token rates.

Outcomes are paired at the case level with repeat *r* of the closed study for the same model.
This is the identical operation the frozen estimator already performs between arms — every
case × arm was always its own request — so pairing across studies introduces no new assumption.

The estimator is the **frozen** `effects()` from
[`weighted-effects.mjs`](../v3-method-repair-2026-09-07/weighted-effects.mjs), reused unmodified by
mapping the treatment arm onto the key it reads. Nothing about CV3-t, the fixed 0.25 cell weights,
the Hoeffding interval, or the lineage clustering is reimplemented here.

Frozen before the first model call, and asserted at dispatch and at aggregation: this protocol,
`cases.json` (inherited by sha256 from the closed study), `requests.json`, the schedule order, all
instrument source hashes, and the environment hash.

### Prespecified readouts

Declared now; none may be added, dropped, or re-cut after seeing outcomes.

- **R1 — framing.** `candidates-tool-free` vs the closed study's comparator set
  (hunk-only, local-context, selected, and the 8 deterministic baselines), both estimators, all
  three repeats, both models.
- **R2 — tool.** `candidates-structural` vs `candidates-tool-free`, on the 17-case contributing
  subset, unweighted only, with the 43-case identical-prompt noise floor reported beside it.
- **R3 — overall.** `candidates-structural` vs the same comparator set as R1.
- **R4 — reliability.** Per-arm yields, sample SD across the three runs, within-case success counts
  and pairwise run discordance, exactly as the closed study reported them.
- **R5 — endpoint composition.** behavioral-pass / build-failure / test-failure / halt / invalid,
  per arm and model, against the closed study's 60.1% / 34.5% / 5.4% split.

### Prespecified interpretation

Reported against the **same** floors the closed study used (arm comparisons ≥ +5pp, baseline
comparisons > 0, both estimators, all three repeats, both models), so the readout is directly
comparable — while remaining, per §0.2, development evidence that cannot clear a gate.

| Outcome | Reported as |
|---|---|
| Any floor binds in repeat 1 | **NO DEMONSTRATED BENEFIT (EXPLORATORY)** — mechanism does not carry on this cohort |
| Floors bind only in repeats 2–3 | **UNSTABLE EXPLORATORY BENEFIT** — effect within run-to-run noise |
| No floor binds anywhere | **EXPLORATORY BENEFIT — CONFIRMATION DESIGN PERMITTED**, and nothing stronger. Not utility established; the required next step is a fresh confirmation cohort |
| Integrity or environment failure | **INVALID INSTRUMENT**, never a null and never a positive |

R1 and R2 are reported in full regardless of R3, so a null overall result still yields a usable
mechanism finding rather than a discarded run.
