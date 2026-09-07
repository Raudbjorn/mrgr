# Retained GOPATH recovery — completed 2026-09-07

The frozen recovery frame contains 378 distinct repository/event/path cases across 112 repositories. Of these, 345 retained failures across 104 repositories were scheduled; one had an earlier screen pass and 32 had unavailable retained inputs. Every entry has historical Git tree/root-module provenance recorded before evaluation. All 378 are GOPATH-era under the root `go.mod` definition. This targeted screen cannot estimate the prevalence of build eras in deployment.

| Scheduled-case outcome | Cases |
|---|---:|
| Initial reference builds and tests pass | 16 |
| Initial reference build failure | 307 |
| Initial reference test failure | 13 |
| Pre-evaluation exclusion: original script layout does not match the frozen working-directory rewrite guard | 9 |
| **Scheduled total** | **345** |

Thus 336 reference evaluations actually ran; the other nine are explicit adapter-layout exclusions, not measured build failures. The screen fails closed rather than rewriting an unrecognized historical shell wrapper. Their original scripts and reasons remain in the ledger/receipts. "345 completed" means all scheduled cases are accounted for, not that 345 reference evaluations executed.

Of the 16 initial passes, one produced no counted `Test` completion and 13 did not yield two compiling rejected mutants under the fixed mutation rule. **Two cases met full oracle admission**, each with three reference passes and two compiling rejected mutants:

- `git-lfs/git-lfs`, event `35b1500cb0679924a6d24d9ad34095926df1a219`, `git/git.go`.
- `git-lfs/git-lfs`, event `77979372cc41ba9d71c10f7a37d3de9fe53b989b`, `git/githistory/rewriter.go`.

Both belong to the same repository. Oracle admission does not establish independent-confirmation eligibility or an additional lineage. Neither is added to the existing 60-case development cohort; its four fixed weights stay unchanged. There is no sixfold-supply claim and no acquisition reordering based on these outcomes. With two admissions from one repository, this result does not support a validated post-repair admission predictor.

The [audit](audit.json) verifies source hashes, era timestamps preceding evaluations, and the complete admission receipts. [Summary](summary.json), [frozen frame](frame.json), and per-case `receipt.json`/`case.json` files preserve the attempts. Existing historical failures were not rewritten. These are recovery observations under the repaired execution path, not a population-wide causal attribution of every earlier failure solely to that path.
