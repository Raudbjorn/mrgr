# C libgit2 behavioral feasibility pilot

**Complete and valid feasibility execution; ineligible for confirmation. MEASURABLE=NO.** One case, six requests (three arms for each requested model), no rate-limit stop. This is not a population estimate or a 60-case development run.

Original Git event: `libgit2/libgit2` / `190a4c55df72b32adf4d60f77cbc47276b74f84b` / `src/libgit2/repository.c`. The reference passed three sandbox builds/tests; compiling behavior-changing mutations failed. See [cases.json](cases.json) for provenance, oracle contracts, mutations and baseline execution records.

| Model | Arm | Behavioral passes | Halts | Truncated | Estimated token cost |
| --- | --- | ---: | ---: | ---: | ---: |
| mercury | hunk-only | 1/1 | 0 | 0 | $0.004610 |
| mercury | local-context | 0/1 | 0 | 1 | $0.008662 |
| mercury | selected | 1/1 | 0 | 0 | $0.029816 |
| minimax | hunk-only | 1/1 | 0 | 0 | $0.001323 |
| minimax | local-context | 0/1 | 0 | 0 | $0.007780 |
| minimax | selected | 1/1 | 0 | 0 | $0.032970 |

Passing deterministic baselines: none. Selected context ties hunk-only in each model. These observations cannot establish replicated utility. One-cluster bootstrap intervals in the aggregate are degenerate and have no inferential interpretation.

[protocol.json](protocol.json) freezes input/source/environment hashes and settings. [aggregate.json](aggregate.json) records all scheduled denominators and comparisons. Provider directories retain raw requests/responses and evaluation files retain build/test stages. No credential headers are persisted. This pilot's event is now exposed and excluded from future cohorts.

```sh
node evidence/h0/v3-2026-09-06d/instrument/evidence/h0/v3.mjs aggregate evidence/h0/v3-2026-09-06d
```

Archived-instrument aggregation reproduced identical bytes without model calls. It requires the unchanged local evaluator/scaffold and toolchain fingerprint; it is not a self-contained clean-clone benchmark. See the [implementation and limitations](../v3-research-2026-09-06/README.md).
