# evidence/

Durable run output. Every file here was produced by executing something, not by
writing about it. Where a result was later found invalid, the result stays and
the invalidation sits beside it — nothing is quietly deleted, because the point
of this directory is that claims can be checked against what actually ran.

## `m0-closure.md`

Clean-clone verification of the M0 extraction, produced by
`scripts/capture-evidence.sh` against a pinned commit: frozen-lockfile install,
typecheck, the carried test run, build, the carried-file gate, its negative
self-test, and a CLI smoke. It ends with what it does *not* establish.

Regenerate with `./scripts/capture-evidence.sh` after any source change; the
artifact necessarily describes its own parent commit, which is stated in the
file rather than hidden.

## `h0/` — the evidence-utility discriminator

H0 asked one question: does evidence from outside the conflict hunk change an
LLM adjudicator's decisions, and at what cost? A positive answer would have
justified building the agent adapter.

**Three runs happened. The current verdict is null, and the agent adapter is
retired.** Start with
[`h0/SIGNIFICANCE-2026-08-30T02-54-42-056Z.md`](h0/SIGNIFICANCE-2026-08-30T02-54-42-056Z.md);
it carries the acceptance-gate result and the limits of what that result can
mean.

| File | What it is | Trust |
|---|---|---|
| `SIGNIFICANCE-2026-08-30T02-54-42-056Z.md` | The WP3/WP4 acceptance gate, executed: McNemar-exact paired test against the best trivial baseline, α = 0.05. Verdict null. | **governing** |
| `REVIEW-2026-08-30T02-54-42-056Z.md` | Run review for the current run: identity, execution, validity gate, reproducibility | governing on validity |
| `INVALIDATION-RULE.md` | When a run is invalid, enforced in `_aggregate.ts`, plus the recorded 2026-08-30 override | governing on validity |
| `aggregate-2026-08-30T02-54-42-056Z.json` | Scored aggregation for the current run, including the `significance` block | good |
| `runs/*-2026-08-30T02-54-42-056Z.jsonl` | Per-triple, per-repeat arm output — 540 records across six arms | good |
| `corpus.json`, `triples-*-diff3.jsonl` | Frozen corpus manifest and the 1,050 unique exact-localized triples behind it | good |
| `baselines.json` | Trivial-baseline records (`keep_ours`, `keep_theirs`, `compose`), no LLM call | good |
| `REVIEW-2026-08-29.md` | Review of the superseded 2026-08-29 run (broken PRNG, single repository) | historical |
| `runs/archive-2026-08-29-invalid/`, `runs/archive-2026-08-27-retracted/` | The superseded runs' raw output | historical |
| `RETRACTED/*.jsonl`, `RETRACTION.json` | The 2026-08-27 corpus and its byte-stable digests | **retracted** |
| `aggregate.json` | Unstamped scratch output of the last `_aggregate.ts` invocation | **do not cite** — cite the stamped file |
| `_h0_runner.ts`, `_aggregate.ts`, `_baselines.ts`, `_corpus_freeze.ts`, `_corpus_regen.ts` | The scripts that produced the above | kept so the method is inspectable at source |

The underscore prefix marks these as run scripts rather than shipped modules;
they are deliberately not part of `@mrgr/core` and are not covered by its tests
or typecheck, with one exception: the aggregator's statistical helpers and its
kill branch are exercised from `packages/core/tests/m1a/h0-evidence-scripts.test.ts`,
because an unreachable gate is the failure this experiment kept repeating.

### What each run established

**2026-08-27 — retracted.** Five independently disqualifying defects. The worst:
`triple.resolution`, the exact string the grader scores against, was
interpolated into the shared prompt template used by *all three* arms. The model
was handed the answer key. The "full bundle" arm relabelled conflict-region text
as `FILE_FULL_PREIMAGE` and showed the same two strings twice; `triple.base`
reached no arm at all. A constant `compose` guess scored 9/15 against the best
arm's 6/15. At `temperature: 0.0` the three repeats were one decision copied
three times, so n was 15 rather than 45 — the real effect was two triples
flipping, Fisher exact two-sided p = 0.70. And the kill condition's denominator
was `halt`, which was 0 in every arm, so the ratio was `Infinity` and the branch
could never fire.

**2026-08-29 — invalid.** The redesign fixed the leakage, the preimages and the
baselines, but both `Math.imul` calls in the runner's Mulberry32 passed one
argument, so the PRNG returned 0 for every seed and the Fisher-Yates shuffle
collapsed to a rotation. The sample was 30 `jq` triples and 0 of anything else,
regardless of seed — violating the ≥2-language requirement at the sample level.

**2026-08-30 — valid, and null.** Corrected PRNG, three repositories, two
languages, per-repeat temperatures, real preimages, trivial baselines as
first-class arms. The run is clean. The result is that no arm beat a constant,
and the acceptance gate the redesign specified had never actually been run until
2026-08-30. Running it returned null — and showed that the grader makes constant
`compose` an upper bound on every arm by construction, so no run under this
grader could have returned anything else. Both facts are in the significance
document.

## The retracted corpus

The four `*.jsonl` files moved to `h0/RETRACTED/` on 2026-08-28. They record
`baselineId 89218aca…09cf`, which denotes a **default-style** replay — but the
producing tree forced `-c merge.conflictStyle=diff3` without updating
`baselineInput`, so every record misreports the provenance of its own run.

They were moved rather than edited. The bytes are unchanged and their SHA-256
digests are recorded in [`h0/RETRACTION.json`](h0/RETRACTION.json) and verified
against the moved files. Moving them is the point: a consumer with a stale path
now fails loudly instead of silently reading a corpus that lies about how it was
produced.

What this does **not** do: repair those records. They were superseded rather
than repaired — the 2026-08-30 corpus was regenerated from scratch with real
preimages. Under the fixed mechanism the same invocation would record
`e2dea6a7…3509`.

## Provenance

`h0/` was produced in the `semantic-merge` research tree
(`/home/svnbjrn/rsrch/semantic-merge/evidence/h0/`) and copied here unchanged.

One caveat that travels with it: the tree that generated this corpus hardcoded
`-c merge.conflictStyle=diff3` into the replay command **without updating
`baselineInput`**. Its records therefore carry `baselineId 89218aca…`, the
*default-style* baseline, while diff3 was actually forced. `@mrgr/core` fixes
this by making conflict style an explicit option that changes the baseline
(see [`../docs/findings/F1-exact-localization-unreachable.md`](../docs/findings/F1-exact-localization-unreachable.md)),
so a corpus regenerated with this repo will carry a correct, distinct
`baselineId` and will **not** be byte-comparable with the files here. That is
the baseline mechanism working as designed.
