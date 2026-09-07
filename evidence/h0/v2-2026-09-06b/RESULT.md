# Phase 3 result — 2026-09-06

**Phase 3 complete and valid; Phase 4 ready. MEASURABLE=NO.** The frozen confirmation contains 92 distinct merge cases and 276 model requests. Selected context matched 5/92 historical replacements (5.4%), compared with 7/92 for hunk-only and 21/92 for the strongest deterministic baseline (keep-ours). The selected-versus-hunk-only difference is -2.2pp, exact paired p=0.7266. The result is inconclusive; no demonstrated selected-evidence superiority. Selected also underperformed keep-ours by 17.4pp (paired p=0.002494) on this endpoint.

The machine [aggregate](confirmation-aggregate.json), [case scores](confirmation-scores.jsonl), [protocol](protocol.json), and [descriptive uncertainty](uncertainty.json) are the evidence. All arms retain all 92 scheduled cases. Invalid output and halt score zero matches; no failed answer was retried. Transport errors: hunk-only 0, selected 0, bounded-context 0. No human validity override was used.

| Arm | Matched | Nonmatched | Halt | Invalid | Total tokens |
| --- | --- | --- | --- | --- | --- |
| hunk-only | 7 | 80 | 5 | 0 | 41162 |
| selected | 5 | 86 | 0 | 1 | 152268 |
| bounded-context | 7 | 84 | 0 | 1 | 286932 |
| keep-ours | 21 | 71 | 0 | 0 | 0 |
| keep-theirs | 8 | 84 | 0 | 0 | 0 |
| git-union | 12 | 80 | 0 | 0 | 0 |
| longer-side | 18 | 74 | 0 | 0 | 0 |
| always-halt | 0 | 0 | 92 | 0 | 0 |

## Frozen selected-primary comparisons

Every row must pass: observed gain ≥5pp and exact two-sided McNemar p<0.05. A bounded-context ablation cannot replace the selected primary after inspection. Wins/losses are discordant pairs where selected alone or the comparator alone matched. Bootstrap intervals are descriptive 95% percentile intervals, paired within merge and stratified by repository; they are not another acceptance gate.

| Comparator | Selected gain | Wins/losses | Exact p | 95% bootstrap interval | Gate |
| --- | --- | --- | --- | --- | --- |
| hunk-only | -2.2pp | 3/5 | 0.7266 | -7.6pp to 3.3pp | fail |
| keep-ours | -17.4pp | 5/21 | 0.002494 | -27.2pp to -7.6pp | fail |
| keep-theirs | -3.3pp | 4/7 | 0.5488 | -9.8pp to 3.3pp | fail |
| git-union | -7.6pp | 3/10 | 0.09229 | -15.2pp to 0.0pp | fail |
| longer-side | -14.1pp | 4/17 | 0.007197 | -23.9pp to -5.4pp | fail |
| always-halt | 5.4pp | 5/0 | 0.06250 | 1.1pp to 10.9pp | fail |

## Interpretation and limits

The conjunction fails. This is not evidence of equivalence or proof that evidence can never help. The sample was availability-limited and designed to detect large gains; it cannot rule out a small useful benefit. Historical disagreement is not measured dangerous-merge risk. Context content and token length change together. Inference assumes independent sampled merges within three named repositories, not a representative sample of repositories; model pretraining exposure is unknown.

Development produced 72/72 schema-valid responses with no transport failures. Its earlier interrupted predecessor is explicitly superseded and contains no confirmation. Input/reference regeneration was byte-identical; all 116 development/confirmation cases have distinct content and merge-event identities. See [input audit](input-audit.json).

## Cost characterization

Selected uses 3.70 times hunk-only total tokens. Under an explicitly illustrative loss where a historical disagreement costs 1 and either halt or invalid output incurs review cost c, selected beats always-halt only when c > 0.945. It beats the strongest forced baseline only when c < -15.000. No nonnegative review-cost interval beats both under these assumptions. This is a characterization of historical agreement, not a justified deployment loss or semantic-harm estimate. See [cost-characterization.json](cost-characterization.json) for every model arm, mean tokens and request time.

## Phase 4 handoff

Proceed with the existing partial mechanism port: real Git driver CLI and native attributes/config; distinct engine/driver/outer-Git statuses; mixed text/binary preservation in the actual tree/index; five-run tree determinism; pinned Mergiraf execution in CI; then freeze outputs/residue. Source hashes and local versions are in [Phase 4 preflight](../research-2026-09-06/phase4-preflight.json). The [planning handoff](../../../docs/planning/final/phase-3-h0-evidence-utility/execution-and-handoff-2026-09-06.md) gives the implementation sequence. No positive H0 result or additional user decision gates deterministic Phase 4 work.
