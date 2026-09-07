# Phase 3 acquisition continuation, round three — 2026-09-06

**MEASURABLE=NO; development is incomplete.** This continuation expands the real Git frame and validates additional executable cases without exposing them to either solver. It continues the full objective: 60 fresh development cases, a disjoint powered confirmation cohort, and replicated superiority in Mercury-2 and MiniMax-M3 under the declared conjunction.

## Acquisition

Eight additional compact Go repositories from the pinned [round-two frame](../v3-round2-2026-09-06/repos-go.csv) were cloned with complete reachable histories and replayed using the existing native Git scanner. Selection is deliberate acquisition feasibility, not random population sampling. Every replay outcome is retained in the raw scans; [acquisition.json](acquisition.json) records source HEADs, hashes, commands and counts.

| Repository | Replayed merges | Conflicted merges | Localized hunks | Events with localized hunks |
|---|---:|---:|---:|---:|
| gin-gonic/gin | 216 | 21 | 39 | 20 |
| spf13/viper | 11 | 3 | 5 | 3 |
| sirupsen/logrus | 529 | 18 | 40 | 17 |
| urfave/cli | 1,446 | 116 | 798 | 115 |
| gorilla/mux | 57 | 1 | 2 | 1 |
| go-chi/chi | 69 | 2 | 15 | 2 |
| fsnotify/fsnotify | 40 | 1 | 1 | 1 |
| spf13/afero | 135 | 3 | 7 | 3 |
| Total | 2,503 | 165 | 907 | 162 |

These are candidate counts, not independent behavioral trials. Test files, comments, overlapping parents and multiple hunks per merge require admission decisions. urfave/cli offers the largest newly inspected pool. No model/baseline success criterion was used to select repositories. Merely inspecting source or constructing an oracle does not expose a case to a solver.

## Argument access and flag aliases

`urfave/cli` event `01b889e6377562b3a664e985bc331cebcd1f390b`, `context.go`, combines argument methods with flag-alias normalization. Its focused checks cover indexed/first/tail argument access, empty arguments, alias-value propagation and rejection of two supplied aliases. The existing context tests and helpers are identical in both parents; exact hashes are in [oracle-contracts.json](oracle-contracts.json).

The historical whole-suite build failed on unused variables in `app_test.go`; [that failure](cli-01b889-fullsuite-build-failure.json) is preserved. The validated oracle compiles every native source file and runs the context tests plus the focused assertions. It does not claim that the historical whole project suite passes. No tracked source or upstream tests were edited to obtain this result. A GOPATH mapping restores the revision's original `github.com/codegangsta/cli` import identity offline.

[Validation](cli-01b889-validation.json) records three reference passes and two compiling wrong resolutions rejected by the checks: empty argument results and lost alias values. [Full admission](cli-01b889-admission/protocol.json) additionally checks original Git reconstruction, source/scaffold hashes, repository lineage, freshness, retrieval and real deterministic baselines. No solver matrix was run.

## Caller information and JSON formatting

`logrus` event `64d5b7e66c170f6285e72762adad6733996473f2`, `json_formatter.go`, combines caller fields with buffered JSON encoding and optional pretty printing. The focused four-cell test varies caller reporting and pretty printing, checking field preservation, caller presence, JSON validity and entry-buffer use. Its two wrong candidates omit caller data or invert the pretty-print switch.

Original module versions were downloaded and vendored. Modern Go initially added a toolchain directive and checksums; the acquisition copies are saved as `logrus-dependency-go.mod` and `logrus-dependency-go.sum`, and tracked `go.mod`/`go.sum` were restored exactly before Git validation. The vendor tree is an additional evaluator dependency, hash-bound in the manifest. This uses a modern host toolchain with pinned historical dependencies, not a recovered historical container.

The first runtime attempt failed a syslog example (the isolated environment has no daemon), the exit-handler subprocess test and four caller-stack tests. The [failure receipts](logrus-64d5b7-modern-toolchain-failure.json) preserve those observations. Running `^Test` excludes examples requiring external services. Disabling compiler inlining (`-gcflags=all=-l`) restores the old caller-stack implementation's assumptions, and setting offline Go variables in the test stage allows its subprocess compilation. The [reference preflight](logrus-64d5b7-noinline-preflight.json) then passes all selected unit tests, including the previously failing caller and subprocess tests. Project source and assertions remain unchanged.

[Full admission](logrus-64d5b7-admission/protocol.json) passed: all three references and both compiling wrong mutations meet the oracle contract under this final environment. Earlier validation receipts remain failed observations under the earlier environment; they must not be mistaken for final admission evidence.

## State and next work

[development-inventory.json](development-inventory.json) records three fresh admitted cases across three lineages: bbolt, urfave/cli and Logrus. All remain unexposed to both solvers. The private combined manifest is `.do-not-commit/h0-v3-round3/development-candidates.json`. These are admission-only feasibility preparations; no 60-case development or confirmation claim follows from their `eligible=false` protocols.

Continue screening the new event pool and adding lineages. Preserve failures and parent-derived behavioral contracts. The prompt now explicitly separates FOCAL_HUNKS from READ_ONLY_CONTEXT and explains that contextual functions/files are not the replacement span. This source-hash version applies only to future preparations; it has not been tested for efficacy. The [nine runner checks](runner-checks.txt) pass, and both original model pilots [replay identically](preserved-replay.json) using their archived instruments. Reprepare the assembled cohort with the final source before development; no old prompt or result was rewritten. Audit the power simulation's few-cluster operating characteristics before confirmation. Keep prior model-exposed feasibility cases excluded. No paid solver calls were made in this continuation, and no user approval is pending.
