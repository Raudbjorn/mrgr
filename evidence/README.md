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
LLM adjudicator's decisions, and at what cost? A positive answer would justify
building the agent adapter. **The run happened. Its positive verdict is
invalid.** Read [`h0/REVIEW-2026-08-27.md`](h0/REVIEW-2026-08-27.md) before any
other file here.

| File | What it is | Trust |
|---|---|---|
| `REVIEW-2026-08-27.md` | Independent review; five independently disqualifying defects | **governing** |
| `corpus.json` | Frozen corpus manifest: per-repo counts, digests, licenses | good |
| `RETRACTED/triples-jq-diff3.jsonl` | 377 exact-localized triples from `stedolan/jq` (MIT, C) | **retracted** — see `RETRACTION.json` |
| `RETRACTED/triples-cli-diff3.jsonl` | 521 exact-localized triples from `cli/cli` (MIT, Go) | **retracted** |
| `RETRACTED/scan-*-diff3.jsonl` | Raw schema-v2 corpora the triples were materialized from | **retracted** |
| `runs/*.jsonl` | Per-triple arm output: hunk-only, full-bundle, selected | raw output is real; the decisions it records were made under a broken prompt |
| `aggregate.json` | Scored aggregation | **do not cite** — see D3/D4/D5 in the review |
| `_h0_runner.ts`, `_aggregate.ts`, `_corpus_freeze.ts` | The scripts that produced the above | kept so the defects are inspectable at source |

The underscore prefix marks these as run scripts rather than shipped modules;
they are deliberately not part of `@mrgr/core` and are not covered by its tests
or typecheck.

### The defects, in one line each

1. **Ground truth in the prompt.** `_h0_runner.ts` interpolates
   `triple.resolution` — the exact string `_aggregate.ts` grades against — into
   the shared `hunkOnly` template used by *all three* arms.
2. **No preimages.** The "full bundle" arm labels conflict-region text as
   `FILE_FULL_PREIMAGE` and shows the same two strings twice. `triple.base`
   exists in every record and reaches no arm at all.
3. **A constant wins.** Constant `compose` scores 9/15; the best arm scores
   6/15. The grader is asymmetric — `compose` passes on one shared line.
4. **n is 15, not 45.** At `temperature: 0.0` the three repeats are one
   decision copied three times. The real effect is two triples flipping;
   Fisher exact two-sided p = 0.70.
5. **Unreachable kill condition.** Its denominator is `halt`, which is 0 in
   every arm, so the ratio is `Infinity` and the branch could never fire.
   "Kill condition met: false" carried no information.

### What a rerun must fix

Remove the resolution from every prompt; supply real file preimages and pass
`base`; run trivial baselines (constant `compose`, constant `keep_ours`) as
arms; account samples independently rather than multiplying temp-0 repeats;
define a kill rule that can actually fire; and make `dependency_graph` a
computed value rather than the hardcoded `"(none — single-file conflict)"`
string it currently is.

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

What this does **not** do: repair those records, or replace them. No corrected
run exists yet. Under the fixed mechanism the same invocation would record
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
