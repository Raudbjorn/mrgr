# F1 — Exact localization is unreachable on real repositories

**Status:** confirmed, **fixed** by parameterizing the conflict style. See *Resolution*.
**Found:** while assembling the H0 conflict corpus, by running the tool rather than reading it.

## Observation

Scanning `jqlang/jq` with the packaged CLI:

```
candidates=90
replay: clean=83 conflicted=7 unrelated=0 quarantined=0 error=0
conflicted path occurrences=17
exact localized regions=0 ambiguous regions=15 unsupported regions=2
```

**Zero exact regions out of seventeen.** `materialize` emits exact regions only, so this corpus yields no base/ours/theirs/resolution triples at all.

## Cause

`localize.ts` requires complete **diff3** conflict blocks — it needs the `|||||||` base section to recover the merge base's side of the region. Git only emits that section when `merge.conflictStyle` is `diff3` (or `zdiff3`).

`git.ts` deliberately builds an isolated environment: `GIT_CONFIG_NOSYSTEM=1`, `GIT_CONFIG_GLOBAL=/dev/null`. That is correct for reproducibility, and it also means `merge.conflictStyle` falls back to Git's default `merge` style. Nothing in `replay.ts` sets it — `grep -n 'conflictStyle' src/evaluation/*.ts` returns nothing.

Measured directly on the first conflicted jq merge (`f98e3e6c` × `37cfc912`), counting `^|||||||` in the merged blobs:

| Invocation | base markers |
|---|---|
| `git merge-tree --write-tree` (what mrgr does today) | **0** |
| `git -c merge.conflictStyle=diff3 merge-tree --write-tree` | **3** |

## Why the test suite did not catch it

`tests/evaluation/build-e2e-fixture.ts` sets `merge.conflictStyle=diff3` **inside the fixture repository**. The exact-localization path is therefore exercised only under a configuration the tool never reproduces when it runs for real. The suite is not wrong; it is testing a configuration the product does not enter.

This is the failure mode the source research names repeatedly: a capability asserted from a passing fixture, refuted by contact with real input.

## What it does and does not invalidate

- **Does not** invalidate the conservative-localization design. Classifying an unparseable region as `ambiguous` rather than guessing is the correct behaviour, and it did exactly that 15 times.
- **Does** invalidate any claim that the instrument produces exact localized evidence in practice. On real repositories, as invoked, it produces none.
- **Does** mean the reported `observed deterministic ambiguity floor` is `not measurable` for a reason that is a configuration artifact, not a property of the corpus.

## Fix requires a decision, not a patch

Setting the flag is one argument. Its consequences are not:

1. `replay.ts` and `git.ts` are **carried files** under `scripts/verify-carried.sh`. Changing them ends the byte-identical extraction property deliberately, or requires a non-carried wrapper that re-implements the replay invocation.
2. `baselineInput()` pins `replayCommand: "merge-tree --write-tree --messages -z P1 P2"`. Adding conflict style changes the replay semantics, so it **must** change the baseline input, which changes every `baselineId`. Corpora produced before and after are not comparable, and that is the point of the baseline existing.
3. `diff3` versus `zdiff3` is a separate choice. The source research and the fixture both use `diff3`; `zdiff3` compacts common lines out of the base section and would change what `localize.ts` sees.

Recorded here rather than fixed, because the choice between amending the carried instrument and wrapping it changes what `@mrgr/core` is.

---

## Resolution

Conflict style is now an **option**, not a hardcoded default. `ReplayOptions.conflictStyle`
threads through `replayCandidate` into the `merge-tree` invocation, delivered as a
`git -c` override via a new `RunGitOptions.config` field rather than by splicing
into `args` — so `operationName` still sees the subcommand and error labels stay
`git merge-tree` instead of degrading to `git`.

`baselineInput()` takes the style into account, so the corpora say which
replay produced them:

| Invocation | `baselineId` |
|---|---|
| default (unchanged) | `89218aca…09cf` — **byte-identical to before this change** |
| `--conflict-style diff3` | `e2dea6a7…3509` |
| `--conflict-style zdiff3` | `29d597db…4360` |

Omitting the option reproduces the original baseline input exactly, so every
corpus produced before this option existed keeps its identity and stays
comparable. Opting in produces a distinct baseline, because a different replay
was run — which is what the baseline is for.

### Measured effect, same repository, same 90 candidates

| | default | `--conflict-style diff3` |
|---|---|---|
| exact localized regions | **0** | **377** |
| ambiguous regions | 15 | 70 |
| unsupported regions | 2 | 2 |
| exact resolution classes | all zero | ours 257 · theirs 2 · base 28 · deleted 2 · novel 88 |
| deterministic ambiguity floor | not measurable | 0/377 |
| `materialize` output records | 0 | **377** |

The materialized records are real base/ours/theirs/resolution quadruples across
6 merges and 12 paths — the input H0 needs and could not previously obtain.

### Cost

Three carried files changed: `git.ts`, `replay.ts`, `cli.ts`. The
byte-identical extraction property for those three ends here, deliberately and
on the record: `scripts/verify-carried.sh` named exactly those three before the
manifest was updated with `--update`. The other 21 files are untouched. All 120
carried tests still pass without modification, which is the evidence that the
change is additive rather than behavioural.

### Not fixed

- The default remains the style that yields 0% exact localization. That is the
  conservative choice and it is now a choice rather than an oversight, but
  anyone invoking the tool without the flag still gets no exact evidence.
- No test covers the diff3 path end to end. `build-e2e-fixture.ts` sets the
  style inside the fixture repo, which is the configuration that hid this in
  the first place; a test that exercises `--conflict-style` through the CLI
  against a fixture that does *not* set it is still owed.
- `zdiff3` is accepted and produces a distinct baseline, but has not been
  exercised against `localize.ts`. It compacts common lines out of the base
  section and may parse differently.
