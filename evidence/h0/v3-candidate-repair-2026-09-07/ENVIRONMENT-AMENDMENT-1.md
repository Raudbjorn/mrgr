# Environment amendment 1 — 2026-09-07

## What happened

At **2026-09-07T18:45:45Z**, mid-run, `pacman` upgraded the package `oh-my-pi`
from `18.1.11-1` to `18.1.13-1`. `environmentHash()` in
[`v3-data.mjs`](../v3-data.mjs) hashes the full `pacman -Q` package list
alongside the binary hashes of the nine evaluator tools (git, tree-sitter,
bwrap, diff3, mergiraf, cc, cmake, make, go). The package list changed, so the
hash changed:

| | value |
|---|---|
| Frozen (protocol `6bec2b3ed4…`) | `d01d9b3dd874da85e169cde01f935bec7a981c3b524a0e4498e4fcd8bfda0f2f` |
| Drifted, current | `17e1e5f1c189713e48c2bdaf88c7777ed62f1cee892506c46f0457fbd012d5e2` |

All 720 requests (both models, all three repeats) had already been dispatched
and answered before this was discovered. `study.mjs`'s frozen `aggregate()`
correctly refused to compute the remaining evaluations once the drift
happened — confirmed by literally invoking it after the fact:

```
$ node study.mjs aggregate run
AssertionError [ERR_ASSERTION]: toolchain/package environment drift
+ actual:   17e1e5f1c189713e48c2bdaf88c7777ed62f1cee892506c46f0457fbd012d5e2
- expected: d01d9b3dd874da85e169cde01f935bec7a981c3b524a0e4498e4fcd8bfda0f2f
    at evaluate (v3-data.mjs:114:34)
    at aggregate (study.mjs:176:73)
```

**`protocol.json` and `study.mjs` are unmodified and remain that way.** That
assertion still fails, on purpose — this document and the two files beside it
(`aggregate-amended.mjs`, `environment-equivalence.json`) are a *separate*
amendment path, not a patch to the frozen one.

## What did not happen

No evaluator tool changed. All nine binaries hashed by `environmentHash()`
predate the run (mtimes 2026-04 through 2026-08); `oh-my-pi` owns 21 files —
`/usr/bin/omp`, `/usr/lib/oh-my-pi`, shell completions — none of them a
compiler, linker, libc, Go toolchain file, or any of the nine hashed binaries.
Reconstructing the pre-upgrade `pacman -Q` with only the `oh-my-pi` version
string reverted reproduces the frozen hash bit-for-bit — proof the entire
diff between the two hashes is that one line.

## Why that is not itself sufficient

An argument that the tool didn't change is reasoning, not evidence that the
*evaluator* — the actual bwrap sandbox invocation, build, and test run —
produces the same verdicts either side of the upgrade. So this was checked
empirically, not argued: the 182 resolutions that had already been evaluated
under the frozen environment were **re-evaluated under the drifted one**,
changing nothing but the live-environment field the evaluator checks itself
against (candidate bytes, scaffold, oracle, build/test commands, and every
other evaluator input identical). See
[`environment-equivalence.json`](environment-equivalence.json):

**182/182 identical** — `pass`, `category`, `candidate_sha256`, and per-stage
exit status all matched.

**This checks 182 of 720 resolutions both ways, not all 720.** The remaining
451 resolvable responses (633 total resolutions minus the 182 in the
equivalence check) were evaluated **only once**, under the drifted
environment -- there is no pre-drift twin to compare them against, since they
had not been evaluated before the drift happened. Their inclusion rests on
induction from the 182: the same evaluator, on the same class of inputs
(Go build+test in the same bwrap sandbox against the same scaffold and
oracle), behaved identically across the hash boundary in every case actually
tested, and nothing about the untested 451 is a different kind of input --
same 60 cases, same two arms, same two models, later repeats. This is a
material distinction from "all 720 were cross-checked," and is stated here
so it is not the reader's job to infer it.

## What this amendment does

1. Preserves the 182 pre-drift evaluations verbatim at
   `evaluations-env-d01d9b3d/`, and the 182-case re-evaluation used for the
   equivalence proof at `evaluations-recheck/` (neither participates in the
   final result; both are the receipt).
2. Computes the remaining evaluations under the current, drifted environment,
   via [`prewarm-amended.mjs`](prewarm-amended.mjs), storing an explicit
   `environment_amendment: {frozen_environment_sha256, ran_under}` field on
   every entry computed this way — the record never claims to have run under
   the frozen hash.
3. Aggregates through [`aggregate-amended.mjs`](aggregate-amended.mjs), which
   reuses every frozen check unmodified (`load()`, `decode()`,
   `verifyEvaluation()`, `readouts()`, the estimator) and relaxes exactly one
   assertion — the live-environment equality inside `evaluate()` — gated on
   the equivalence receipt above. If that receipt were absent, or showed any
   mismatch, or the live environment moved again after it was written, this
   script refuses to run (see its own asserts).
4. Writes to `aggregate-amended.json`, a new file. `aggregate.json` — the
   name the frozen path would have written — is never produced for this
   protocol, so nothing pretends the frozen check passed.

## Standing

This is an amendment to *how the result was computed*, not to *what the
result says*. It does not touch the prespecified arms, comparators, floors,
estimator, or interpretation rules in [`PROTOCOL.md`](PROTOCOL.md) — those
were frozen before any response was seen and stay exactly as written. Read
alongside `PROTOCOL.md` and `environment-equivalence.json` before trusting
`aggregate-amended.json`.
