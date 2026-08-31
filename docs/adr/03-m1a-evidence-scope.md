# ADR 03 — M1a evidence scope: two retired plan items

**Status:** accepted, 2026-08-28.
**Genre:** claim boundary — why an obvious-looking gap in the carried tests is
not a gap. Companion to [`00-scope-and-verdict.md`](00-scope-and-verdict.md).

Not a finding. `docs/findings/` records defects discovered by running the
instrument (F1, F2); this records a plan item retired as unreachable.

## Decision

Items **P1.1** and **P1.2** of the M1a integration-test plan are **void**, not
deferred.

- P1.1 — *"parse CLI output with `parseCorpusRecord`, not a TypeScript cast."*
- P1.2 — *"safely narrow the conflicted record and assert both conflicted
  records independently"*, in `tests/evaluation/cli.test.ts`.

## Why they cannot be paid

1. **The carried `tests/evaluation/cli.test.ts` contains no evidence-bundle
   assertions and no `CorpusRecordV2` cast, by design.** Searching it for
   `evidence`, `Evidence` or `CorpusRecordV2` returns nothing. Its one raw
   `JSON.parse` over pipeline output reads *materialized* records — the
   `materialize.ts` shape, with `resolution` and snake_case fields —
   which `parseCorpusRecord` cannot validate, being the wrong type. Its
   corpus-level read asserts `schemaVersion` only, with no cast to narrow.

2. **The assertions the items describe were never carried.** They exist only in
   the research tree, at `semantic-merge/tests/evaluation/cli.test.ts:142-144`
   (`conflicted.evidenceBundles` presence, length, and schema parse). M1a's
   evidence work happened there on a copy that did not cross over; the phase
   plan transcribed the items into this repo without rechecking which file came
   with them.

3. **The sidecar decision moots them.** Evidence bundles are persisted to their
   own append-only store, never inlined on `CorpusRecordV2`, so no bundle ever
   reaches `parseCorpusRecord`. The trust boundary the items wanted exercised is
   `parseEvidenceRecord`, which has its own fail-closed parser and its own
   round-trip, malformed-line and schema-rejection tests.

Retiring them touches nothing: there is no file to modify and the carried gate
is never involved.

## H0 rerun baseline gate

An H0 aggregate reads the six model and baseline arm files for one explicit
`H0_STAMP`. Every arm must contain the same `(triple_id, run)` keys.

**Superseded 2026-08-30.** This section previously read:

> The aggregate is `null` unless the best model arm's
> `wrong / (correct + wrong + halt)` fraction beats the aligned
> `baseline-compose` fraction by at least **0.05** (five percentage points).
> The margin is absolute on the `[0, 1]` fraction scale.

That rule is not the gate and never was — `redesign-requirements.md` §7 #5
specifies "arm correct on ≥N more triples than the best trivial baseline at
Fisher exact p < 0.05", a *correct-count* rule with a significance test. The
wrong-fraction rule recorded here has `correct + wrong + halt` in its
denominator, so an arm lowers its wrong fraction by halting more, and a policy
that halts on everything scores a perfect 0. On the 2026-08-30 run it read
full-bundle — the arm that halts 27 of 90 times and is significantly *worse*
than a constant on correctness — as the best arm, and declined to kill.

**The gate in force:** the aggregate is `null` unless some model arm is correct
on more triples than the best trivial baseline, at McNemar-exact two-sided
p < 0.05 on per-triple binary vectors (Fisher exact reported as an unpaired
cross-check). Implemented in `evidence/h0/_aggregate.ts`; executed against the
frozen 2026-08-30 records in
`evidence/h0/SIGNIFICANCE-2026-08-30T02-54-42-056Z.md`. The wrong-fraction
figures are still emitted, marked non-binding.

## Related

`triple_key` in the H0 corpus is a **content digest**, not an identity. It
digests base/ours/theirs/resolution, so identical quadruples recurring across
different merges collide by construction — 898 records carry 862 distinct
values. That is the digest working correctly and is not a defect. The identity
for joining a region across artifacts is
`(repository_id, merge_sha, baseline_id, path, ordinal)`.
