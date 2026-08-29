# baseline_id correction on the live 2-repo corpus

**Corrected:** 2026-08-29, during the RNG/citation-validation/corpus-expansion
fix pass (see the H0 rerun fix plan).

**What was wrong:** `evidence/h0/triples-jq-diff3.jsonl` and
`triples-cli-diff3.jsonl` carried `baseline_id: 89218acaa87aff8c49f02454a5e3b599e86880879e7d848c2fd4a599ac8409cf`
— the digest for the **default** (non-diff3) `merge-tree` invocation — despite
the filenames, `corpus.json`'s `f1_fix` field, and `_aggregate.ts`'s
`git_version` field all claiming `-c merge.conflictStyle=diff3` was used.
This is the same defect class as `RETRACTION.json`'s incident (recorded
provenance disagreeing with the actual invocation), recurring on the corpus
that superseded the retracted one.

**How it was confirmed, not just asserted:** the 898 triples were 100% exact
regions with 0 ambiguous — per `docs/findings/F1-exact-localization-unreachable.md`,
exact-region localization is only reachable under `diff3` style, which is
strong indirect evidence diff3 *was* actually used. Directly confirmed by:
re-running `pnpm wp0 scan-local <jq|cli-cli> --conflict-style diff3` +
`materialize` for both repos, and diffing the result against the live
triples files on `base`/`ours`/`theirs`/`resolution`/`path`/`category`/
`merge_sha`. All 898 triple_keys matched, content was byte-identical on every
compared field — the only divergent field was `baseline_id`. `triple_key`
itself is a pure content digest of base/ours/theirs (`classify.ts`'s
`tripleKey`) and does not depend on `baseline_id`, so this correction does
not change any triple's identity, does not invalidate prior run output keyed
by `triple_key`, and does not require a corpus regen.

**Fix applied:** `baseline_id` on both files was rewritten from
`89218aca...` to `e2dea6a7e327e3ee195a5f200347c0edaaaffe55a8dce64d4f31e6a817ef3509`
(the correct diff3-style digest per `git.ts`'s `baselineId()`, git version
2.55.0). No other field was touched. `corpus.json`'s `f1_fix`/`git_version`
fields already stated the correct invocation and needed no change.

**What this does not explain:** how the original scan produced diff3-marked
data (achieving 100% exact localization) while the pipeline recorded a
default-style `baselineId`. The current CLI code (`cli.ts:289`,
`baselineId(rawVersion, options.conflictStyle)`) correctly threads an
explicit `--conflict-style diff3` flag into the recorded id — verified by a
fresh scratch scan in this session. The mislabeling therefore looks like an
operator/invocation gap in whatever produced the original corpus (the flag's
effect on the actual git behavior happened, but wasn't passed through to the
baseline computation), not a currently-live code defect. This was not
investigated further — out of scope for this fix pass.
