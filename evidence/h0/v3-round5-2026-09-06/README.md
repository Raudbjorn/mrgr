# H0 v3 acquisition continuation — round five

The screener now supports Go subpackages, validates native Git merge bases when materializer metadata is absent, and generates condition-negation mutations that preserve variable use. No solver requests were made. The primary effect threshold, replication requirement, independence rules and oracle admission criteria are unchanged.

The [fresh inventory](development-inventory.json) now contains **13 admitted cases across five lineages**, leaving 47 cases before the development matrix can run. [Testify admission](testify-admission/) accepts event `d1472b75d1fb510f503823ca4ca3f2ece6367943`, targeting `assert/assertions.go`: 60 package unit tests pass on three reference runs, and two compiling wrong resolutions fail. Whole-inventory event/content/parent grouping passes. No tests were edited for this case.

The Redis pool event `d6120190cab5b62e1de427f5d48f74caff2a4913` passed one screening reference with 59 tests and two mutation failures, but [full admission](redis-admission/exclusions.json) rejected its oracle controls. It is **not admitted**. The original full-admission implementation retained only the rejection summary for excluded cases, so the exact failed validation stage cannot be recovered from that record. The runner now writes each detailed oracle-validation receipt before applying its rejection assertion. This observability fix changes source hashes; final development preparation must use the updated instrument. Original admission instruments remain archived.

A separately labeled `redis-reference-diagnostic.json` records a post-exclusion reference rerun. The diagnostic reference passed. It cannot replace the missing original stages, identify which original control failed, or undo the exclusion.

## Acquired evidence

[Acquisition receipts](acquisition.json) preserve repository HEADs, retrieval timestamps, native replay results and SHA-256 hashes. Six additional public repositories yielded 1,714 replayed merges and 233 localized hunks. These are acquisition counts, not validated independent trials.

| Repository | Replayed merges | Localized hunks |
|---|---:|---:|
| hashicorp/hcl | 238 | 2 |
| go-kit/kit | 358 | 18 |
| google/uuid | 36 | 3 |
| go-sql-driver/mysql | 154 | 3 |
| redis/go-redis | 909 | 207 |
| golang/snappy | 19 | 0 |

HCL, Go kit and UUID came from the previously pinned Go repository frame; the remaining sources were deliberate additions. The earlier Gin and Testify histories were also screened with the new package support. Hunk counts across screen versions must not be added as independent observations.

## Implementation and validation

The existing [screener](../v3-screen-go.mjs) builds the target package and executes its unit tests from that package's directory, preserving relative fixture paths. Root packages retain their previous working directory. Shell arguments are quoted, merge SHAs and paths are validated, and a [runnable check](../v3-screen-go.test.mjs) exercises nested paths, shell punctuation, invalid bases, mutation boundaries and UTF-8 offsets. See [screen checks](screen-checks.txt) and the nine passing [runner checks](runner-checks.txt).

Condition mutations include true, false and negation. Negation retains referenced variables, avoiding a Go compile error caused by deleting their only use. Every counted wrong candidate must still compile and fail behavior tests. Earlier mutation survivors and compile failures remain in the receipts; mutation additions did not follow model results.

Versions `screen-v4.mjs`, `screen-v5.mjs` and `screen-v6.mjs` retain the exact acquisition source used by each frozen profile. These are source snapshots; run the current helper at its original path. Each profile records its source hash, input hash, parser hash, configuration and selection frame. The current helper remains limited to Go production hunks of at most 3,000 reference bytes, one qualifying hunk per event and eight attempted mutations. It runs `^Test`, not examples or benchmarks. Admission therefore describes the selected, executable population; it does not establish representative coverage of all historical merges.

One Redis materialization omitted base metadata because the event has two Git merge bases. The first screen recorded a property-access error. The [native base audit](base-metadata-audit.json) preserves both bases. The corrected helper explicitly rejects absent metadata with multiple bases instead of choosing one arbitrarily. No candidate gained admission from that correction.

## Failure evidence and remaining work

[Screening ledgers](screen-summary.json) preserve all profiles and exclusions. Go kit encountered missing historical dependencies and a path absent from a parent. Gin included a failed reference and an independent Git localization disagreement. Several Redis root-package references require a live service unavailable in the networkless evaluator, while others fail compilation. Those cases receive no correctness or admission credit. No assertions were removed to admit the passing package cases.

The fresh inventory and final admissions are recorded alongside this report. Complete the 60-case development cohort, reprepare it with the final instrument, execute Mercury-2 and MiniMax-M3, audit clustered inference and joint power, and then freeze a disjoint powered confirmation. MEASURABLE remains NO until that evidence satisfies the complete rule. Phase 4's completed independent integration handoff remains unchanged.
