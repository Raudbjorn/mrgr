# Phase 3 automated acquisition — round four

**MEASURABLE=NO.** This continuation builds the fresh development cohort; it does not claim evidence utility from passing admission. The 60-case development matrix and a disjoint powered confirmation study are still required.

## What now runs automatically

[The Go screening command](../v3-screen-go.mjs) reconstructs historical Git conflicts, freezes its input frame and source hash, builds the original package, and runs existing unit tests offline. It uses the current pinned Tree-sitter Go parser to produce bounded mutations inside the focal replacement. Boolean and comparison changes, constant conditions and integer changes are tried in deterministic order, at most eight candidates. Two compiling candidates must be rejected by the tests. All attempted mutations, including survivors and build failures, remain in receipts.

A passed screen is only a candidate. The existing v3 preparation still independently checks original parents/base, reference localization, tracked scaffold files, lineage, freshness, three reference repetitions, both wrong candidates, retrieval, and actual deterministic baselines. No provider requests are part of screening or admission. Screened cases never determine the utility gate by themselves.

This acquisition pass targets root-package Go production files with nonempty sides/reference and replacements at most 3,000 bytes. It takes one statically eligible hunk per event in event/path/ordinal order. These are transparent feasibility filters, not a random sample of all conflicts. Neither baseline superiority nor model output selects cases. The final confirmation frame needs its own frozen sampling and lineage allocation.

## Screening evidence

| Profile | Events actually screened | Passed screen | Interpretation |
|---|---:|---:|---|
| CLI v1 | 12 | 0 | First-hunk selection often offered no mutations; preserved initial attempt |
| CLI v2 | 19 | 5 | Select a statically mutable hunk before choosing the event |
| CLI v3 | 20 | 3 | Add constant-condition mutations and handle every matching unused-local declaration; exclude previous screen passes |
| Logrus v2 | 0 | 0 | No eligible two-token-mutation hunk in this bounded profile |
| Logrus v3 | 1 | 0 | Historical external dependencies are unavailable to this automatic legacy build profile |
| pflag v3 | 2 | 1 | New lineage candidate; the other event's tests did not reject two compiling mutants |

The profile counts overlap and must not be summed as independent events. [screen-summary.json](screen-summary.json), each saved frame and each screening ledger preserve the denominators and reasons. Script snapshots v1/v2/v3 and their hashes preserve acquisition revisions; they are source records, not standalone relocated executables. Run the active command at its repository path with a new output directory.

The first five passing CLI screens ran between 148 and 390 existing unit tests per reference. Completion checks require the expected count of passing top-level tests and a final PASS marker, in addition to successful execution. Full admission repeats the reference builds independently. Finite mutation checks probe test discrimination; they do not establish complete semantic correctness or mutation adequacy across untested fault classes.

### Compatibility and exclusions

Several old CLI revisions contain two declared but unused string locals in a test. The screen can add `_ = parsedOption; _ = firstArg` after the exact AST declarations in an evaluator-only copy of `app_test.go`. Source and patched hashes and the complete copy are retained. This adds uses without removing any assertion or changing control flow. The historical scaffold remains byte-identical before evaluation; build commands apply the recorded test-only copy equally for every candidate. Runtime test bytes therefore include this disclosed compatibility addition where applicable.

The first repair handled only one matching declaration; the next profile handles all matching declarations. Several references still fail `TestDurationFlagHelpOutput` (expected `0`, observed `0s`) after they compile. Those assertions were not rewritten and those cases remain excluded. Other exclusions include duplicate production methods, unresolved production names, a reference that fails independently reproduced localization, and inadequate mutation rejection. No exclusion is counted as a behavioral pass.

The screen reports all unit tests selected by `^Test`; it does not run examples or benchmarks. It does not recover an immutable historical toolchain. Original module requirements are vendored where available and tracked module files restored before Git verification. Legacy external dependencies without a pinned acquisition path remain a recorded failure rather than being silently replaced with current packages.

## New repository frame

[New acquisition receipts](new-acquisition.json) add complete reachable histories from three compact libraries:

| Repository | Replayed merges | Conflicted merges | Localized hunks |
|---|---:|---:|---:|
| dustin/go-humanize | 1 | 0 | 0 |
| burntsushi/toml | 89 | 2 | 3 |
| spf13/pflag | 119 | 4 | 7 |

The first two came from the already pinned repository CSV; pflag is an additional deliberate source. Source HEADs, raw scans, triples and checksums are retained. Repository names do not themselves prove independent lineages; admission reads the upstream fork metadata.

## Verification and remaining work

The [fresh inventory](development-inventory.json) records final admissions and the combined private raw manifest. Whole-inventory event/content/parent grouping is checked before counting it. Model-exposed pilots remain excluded. The original v3 confirmation sizes, conjunction, cluster floor and concentration cap remain unchanged.

The nine [runner checks](runner-checks.txt) pass. A [small executable mutation check](../v3-screen-go.test.mjs) verifies operator changes, focal boundaries, comments and UTF-8 offsets using the pinned parser. Real screens and full admission exercise the build, unit-test, mutation, provenance and failure paths. No production merge algorithm or statistical gate was edited.

Continue acquiring additional lineages and the remaining fresh cases. Reprepare the complete development cohort using the final instrument, run both Mercury-2 and MiniMax-M3, audit inference operating characteristics, then freeze and execute a separately powered confirmation cohort. A valid positive replicated result is still unproven; successful automation is acquisition progress only.
