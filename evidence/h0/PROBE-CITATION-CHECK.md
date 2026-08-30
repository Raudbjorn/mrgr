# Citation-fabrication probe (pre-rerun check)

**Run:** 2026-08-29, `H0_SUBSAMPLE=12 H0_REPEATS=1 H0_SEED=12648430`, all
fixes from the fix plan already landed (fixed sampler, narrowed accept-set,
dependency_graph wired in, 3-repo corpus). Raw output preserved at
`evidence/h0/runs/probe-citation-check/`.

**Purpose:** before committing to the real ~2-hour, 30-triple × 3-repeat
rerun, check cheaply whether the model still habitually cites non-id side
labels (`"ours"`/`"theirs"`) as if they were `[source:<id>]` tags — the
exact failure mode that produced 33 disqualifying `fabricated_evidence_ids`
records in the previous run. Per the locked-in decision: automate the
any-flag invalidation rule as-is, but check this first rather than silently
loosening the rule.

## Result

| Arm | Records | Cited anything | Fabricated (cited an id not exposed to that prompt) |
|---|---|---|---|
| hunk-only | 12 | 3 | **3** (all `[source:ours]`) |
| selected | 12 | 0 | 0 |
| full-bundle | 12 | 0 | 0 |

Running `_aggregate.ts` against this probe's output alone confirmed the new
automated gate fires correctly on real data:

```
verdict: invalid — run invalid per any-flag fabrication rule: hunk-only: fabricated_evidence_ids=3
```

## Conclusion (initial probe)

**The model still habitually mislabels the merge sides as citable
evidence in the `hunk-only` arm** (25% of this small sample), even under the
fixed prompt/validation. This is not caused by any defect this fix pass
introduced or missed — the system prompt's "using only ids you were given"
instruction (`_h0_runner.ts`'s `SYSTEM_PROMPT`) was not specific enough to
stop this model from treating "ours"/"theirs" as citable identifiers.

## Follow-up: tightened prompt, re-probed

With the user's sign-off, tightened `SYSTEM_PROMPT` (explicit "ours"/"theirs"
are NOT valid ids; omit the tag if nothing to cite) and added a per-message
`CITABLE_IDS` block to `buildMessages()` enumerating the exact id(s) exposed
for that call — reinforcing the abstract instruction with a concrete,
enumerated list in every prompt. Re-ran the identical 12-triple probe
(`H0_STAMP=probe-citation-check-2`, same seed, same corpus):

| Arm | Records | Cited anything | Fabricated |
|---|---|---|---|
| hunk-only | 12 | 5 | **0** |
| selected | 12 | 4 | **0** |
| full-bundle | 12 | 6 | **0** |

Zero fabrications across all 36 model-arm records — down from 3/12 in
`hunk-only` alone. `_aggregate.ts` run against this data confirms `run_valid`
no longer trips (`verdict: inconclusive` — the normal count-based outcome for
a 12-triple sample, not `invalid`).

## Conclusion (final)

The prompt fix resolved the observed fabrication behavior. The real rerun is
no longer expected to fail the any-flag invalidation rule for this reason.
Raw probe output preserved at `evidence/h0/runs/probe-citation-check-2/`.
