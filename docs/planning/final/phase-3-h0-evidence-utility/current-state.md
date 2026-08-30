*Part of the [canonical planning document](../canonical-final-planning-document.md).*

### 3.4 H0 — evidence-utility discriminator

- **Closed gates:** the frozen sample is 30 triples stratified as 10 jq + 10 cli + 10 redis, spanning three repositories and two languages (C and Go). The corrected PRNG produced the intended stratification. The updated adjudicator was reachable and model identity matched the measured GGUF SHA. Resume and same-stamp replay were deterministic at the record-file level.
- **Citation formatting, not fabrication — run is VALID.** **Correction (2026-08-30, user-confirmed):** this entry previously read "Binding invalidity," on the theory that three records quoted IDs outside their exact `evidence_ids_exposed` sets (two selected, one full-bundle) and that the any-flag citation rule therefore invalidated the run. That framing was wrong and is superseded by this line. The three flagged records are non-canonical **citation-tag formatting** (leading-space source tags, one bare side label), not genuine references to non-exposed evidence — the same finding independently reached at the aggregator level (`reference/evidence-ledger.md` H0-R3: "presentation-format concerns, not measurement failures"). The run is **VALID**. No corpus-diversity, language-spread, PRNG, model-pin, adjudicator-availability, or citation gate remains open. Schema-invalid records were observed (4 hunk-only, 3 selected, 1 full-bundle) and do not affect this verdict.
- **Non-binding characterization:** full-bundle wrong fraction was 49/(13+49+27) = 0.550562 versus hunk-only 56/(20+56+10) = 0.651163, a 10.060 percentage-point improvement. This exceeds the approved >5pp threshold.

| arm | correct | wrong | halt | schema_invalid | fabricated_ids | tokens | wrong-fraction |
| --- | --- | --- | --- | --- | --- | --- | --- |
| hunk-only | 20 | 56 | 10 | 4 | 0 | 52,154 | 0.651163 |
| selected | 22 | 53 | 12 | 3 | 2 | 64,033 | 0.609195 |
| full-bundle | 13 | 49 | 27 | 1 | 1 | 127,645 | 0.550562 |
| baseline-keep_ours | 21 | 69 | 0 | 0 | 0 | 0 | trivial |
| baseline-keep_theirs | 9 | 81 | 0 | 0 | 0 | 0 | trivial |
| baseline-compose | 27 | 63 | 0 | 0 | 0 | 0 | trivial |

- **Next H0 action:** None. H0 is complete, VALID, and the gate is open — WP8 (agent adapter) is unblocked on H0 specifically; it still needs a working human/scripted adjudicator per §17 Q4.
- **Sources:** evidence/h0/REVIEW-2026-08-30T02-54-42-056Z.md; evidence/h0/aggregate-2026-08-30T02-54-42-056Z.json; evidence/h0/runs/*-2026-08-30T02-54-42-056Z.jsonl. Stable aggregate hash with produced_at removed: eaeeed694b114ce3160d1a3d8e33f971fc89965ecbea9d68ed18be8b0f28d98c.
- **Historical boundary:** §23 preserves the superseded 2026-08-29 broken-PRNG/single-repository run. The 2026-08-27 first-run artifacts remain invalidated and byte-stable under RETRACTION.json.
