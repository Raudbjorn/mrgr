# Finding — candidate verification and repair (exploratory)

**Stage:** `NO DEMONSTRATED BENEFIT (EXPLORATORY)` · instrument `VALID` · `complete: true` ·
`gate_clearing: false` (by design — see [PROTOCOL.md](PROTOCOL.md) §0).

Result computed under [`aggregate-amended.json`](run/aggregate-amended.json); see
[`ENVIRONMENT-AMENDMENT-1.md`](ENVIRONMENT-AMENDMENT-1.md) for why a non-frozen
aggregation path was needed (a mid-run package upgrade drifted
`environmentHash()`; the evaluator itself was proven unaffected, 182/182
identical verdicts, before this result was computed).

## What was tested

Two arms, both built on `hunk-only`, over the same 60 already-observed cases
from the closed repaired study, three repeats, both models, 720 requests
(633 resolved, 87 halt/invalid/truncated/transport — see R5):

- **`candidates-tool-free`** — keep-ours/keep-theirs/longer-side/git-union as
  unlabeled candidates. Zero new information versus `hunk-only`; isolates
  the reframe from generation to selection-and-repair.
- **`candidates-structural`** — the same, plus mergiraf's structural merge
  where it contributes something the tool-free set doesn't already have
  (17 of 60 cases; the other 43 are byte-identical prompts).

## R1 — does the framing alone beat the identical prompt it's built on, by the same margin the closed study required?

`candidates-tool-free` vs `hunk-only`, `local-context`, `context-selected`
(closed study's `selected`), and the 8 deterministic baselines. Note
`hunk-only` is the exact prompt `candidates-tool-free` is built on, so this
comparator asks a harder question than "does framing help at all" — it
asks whether adding the candidate block, alone, buys at least the same
+5pp the closed study's own floor required. **Binds on repeat 1** for both
models:

- **Mercury: −5.0pp vs its own `hunk-only`** (28/60 vs 31/60). Reframing as
  candidate-selection made Mercury *worse*, not better — the opposite of
  the diagnosed mechanism's prediction.
- **MiniMax: +0.0pp vs `local-context`** (36/60 vs 36/60, exact tie) — no
  margin at all against MiniMax's own best arm from the closed study.

17 binding entries total across both estimators and all three repeats.
Framing alone does not carry.

## R3 — does framing + the structural-merge candidate help overall?

Same comparator set, plus `candidates-tool-free` itself. **Also binds on
repeat 1** (mercury vs `hunk-only`: 0.0pp exact tie; minimax vs
`candidates-tool-free`: −1.7pp). 19 binding entries total.

Repeat 1 is Mercury's worst draw on both new arms (`hunk-only` 31/60,
`candidates-structural` 31/60 — an exact tie, delta 0.0pp). Repeats 2 and 3
tell a different story: `candidates-structural` reaches 38/60 and 36/60
against `hunk-only`'s 29/60 and 28/60 — **+15.0pp** (repeat 2, interval
entirely above zero: [+2.9pp, +27.1pp]) and **+13.3pp** (repeat 3). MiniMax
shows no comparable pattern (35/36/38 vs `candidates-tool-free`'s
36/38/36 — no repeat clears the floor). The prespecified rule keys on
repeat 1 by design, and it is not relitigated here: **the stage is
correctly `NO DEMONSTRATED BENEFIT` under the frozen rule.** But the
finding for Mercury is "failed the repeat-1 floor while showing a
positive, unstable direction in repeats 2–3" — not "no effect." R4 shows
why the floor caught it: `candidates-structural` carries the largest
sample SD in the table (3.61 cases), so a single bad draw is exactly the
failure mode this reliability schedule was built to catch.

## R2 — can the model recognise a correct tool candidate? (17-case subset, unweighted only)

- Mercury: +11.8pp (5 lineages of 9 favor it; interval [−18.9pp, +42.4pp])
- MiniMax: −5.9pp (interval [−30.1pp, +18.3pp])

Both intervals cross zero on n=17. The **43-case identical-prompt noise
floor** — same prompt, same model, different draw — shows 9/43 (21%) and
8/43 (19%) discordant outcomes respectively. Mercury's own +11.8pp
corresponds to a raw difference of 2/17 cases, *smaller* than what
same-prompt sampling noise alone produces at this n. **R2 cannot
distinguish tool-candidate recognition from stochastic noise at this
sample size.**

## R4 — reliability

| model | arm | yields (3 repeats) | sample SD |
|---|---|---|---|
| mercury | candidates-tool-free | 28,32,31 /60 | 2.08 cases |
| mercury | candidates-structural | 31,38,36 /60 | 3.61 cases |
| mercury | hunk-only (inherited) | 31,29,28 /60 | 1.53 cases |
| minimax | candidates-tool-free | 36,38,36 /60 | 1.15 cases |
| minimax | candidates-structural | 35,36,38 /60 | 1.53 cases |
| minimax | hunk-only (inherited) | 32,34,31 /60 | 1.53 cases |

Run-to-run spread is in the same 1–4 case range as the closed study — the
result is not a single unlucky draw; R1's binding constraint recurs in
repeats 2 and 3 for both models under different comparators each time
(see the full binding list in `aggregate-amended.json`).

## R5 — endpoint composition (repeat 1)

| | behavioral-pass | build-failure | test-failure | invalid/halt/truncated/transport |
|---|---|---|---|---|
| mercury / tool-free | 47% | 40% | 3% | 10% |
| mercury / structural | 52% | 35% | 7% | 7% |
| minimax / tool-free | 60% | 25% | 3% | 12% |
| minimax / structural | 58% | 23% | 5% | 12% |

Integrity: transport-error 4/720 (0.6%), environment-error 0/720. Cost
$3.59.

## Interpretation

The diagnosed mechanism — Mercury under-generates under added context, so
reframe generation as selection-over-candidates — **did not clear the
prespecified floor**, and the honest reading differs by model. MiniMax
shows no benefit at any repeat: it never beats its own best closed-study
arm by the required margin, in either new arm. Mercury's picture is mixed:
it failed on repeat 1 (an exact tie against `hunk-only`, its worst draw on
both new arms) but showed a real, if unstable, gain in repeats 2–3
(+15.0pp and +13.3pp for `candidates-structural` vs `hunk-only`). The
prespecified repeat-1 stopping rule is not relitigated — that is what a
prospective floor means — but "the mechanism does not transfer" would
overstate what repeats 2–3 actually show for Mercury. R2's own noise floor
(19–21% same-prompt discordance on n=43) shows the 17-case tool-contrast
subset is in any case too small to have distinguished real tool-selection
skill from stochastic noise at plausible effect sizes.

Per §3 of [PROTOCOL.md](PROTOCOL.md): **NO DEMONSTRATED BENEFIT
(EXPLORATORY)** — the prespecified floor was not cleared on this cohort.
Per §0.2, this was never able to clear a gate regardless of outcome: same
60 already-observed cases, development evidence only. Per §0.3, this is
reported as the honest outcome of a differently-mechanised attempt, not
softened or re-run under a fourth arm chosen after seeing these numbers.
If a future confirmation-shaped study were proposed, Mercury's repeat 2–3
pattern — not the repeat-1 floor breach — is the signal worth
investigating, since it is the one part of this result inconsistent with
pure noise.

**No further arm is proposed on this cohort.** A genuinely new attempt
would need a fresh confirmation-shaped cohort (per the acquisition ledger,
expensive: 345 retained cases → 2 admissions in the prior recovery round)
and a mechanism not yet falsified — neither is in scope here.
