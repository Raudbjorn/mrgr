# Go CLI behavioral feasibility pilot

**Complete and valid feasibility execution; ineligible for confirmation. MEASURABLE=NO.** One case, six requests (three arms for each requested model), no rate-limit stop. This is not a population estimate or a 60-case development run.

Original Git event: `cli/cli` / `026dc4657a2ca768b039f726ebd7ea32d1893903` / `pkg/cmd/run/run.go`. The reference passed three sandbox builds/tests; compiling behavior-changing mutations failed. See [cases.json](cases.json) for provenance, oracle contracts, mutations and baseline execution records.

| Model | Arm | Behavioral passes | Halts | Truncated | Estimated token cost |
| --- | --- | ---: | ---: | ---: | ---: |
| mercury | hunk-only | 0/1 | 1 | 0 | $0.000293 |
| mercury | local-context | 0/1 | 0 | 0 | $0.004766 |
| mercury | selected | 0/1 | 0 | 0 | $0.007878 |
| minimax | hunk-only | 1/1 | 0 | 0 | $0.002093 |
| minimax | local-context | 0/1 | 0 | 0 | $0.001654 |
| minimax | selected | 1/1 | 0 | 0 | $0.004324 |

Passing deterministic baselines: git-union. Selected context ties hunk-only in each model. These observations cannot establish replicated utility. One-cluster bootstrap intervals in the aggregate are degenerate and have no inferential interpretation.

[protocol.json](protocol.json) freezes input/source/environment hashes and settings. [aggregate.json](aggregate.json) records all scheduled denominators and comparisons. Provider directories retain raw requests/responses and evaluation files retain build/test stages. No credential headers are persisted. This pilot's event is now exposed and excluded from future cohorts.

```sh
node evidence/h0/v3-2026-09-06c/instrument/evidence/h0/v3.mjs aggregate evidence/h0/v3-2026-09-06c
```

Archived-instrument aggregation reproduced identical bytes without model calls. It requires the unchanged local evaluator/scaffold and toolchain fingerprint; it is not a self-contained clean-clone benchmark. See the [implementation and limitations](../v3-research-2026-09-06/README.md).

The original two-case preparation excluded libgit2 because its GitHub lineage metadata request failed. The original exclusion remains preserved; the separate C retry was prepared before any C model calls.
