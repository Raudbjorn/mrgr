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

## Related

`triple_key` in the H0 corpus is a **content digest**, not an identity. It
digests base/ours/theirs/resolution, so identical quadruples recurring across
different merges collide by construction — 898 records carry 862 distinct
values. That is the digest working correctly and is not a defect. The identity
for joining a region across artifacts is
`(repository_id, merge_sha, baseline_id, path, ordinal)`.
