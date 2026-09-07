# Phase 3 acquisition continuation — 2026-09-06

The objective remains a valid positive behavioral evidence-utility result in both Mercury-2 and MiniMax-M3. **MEASURABLE=NO.** This continuation expands acquisition and validates a fresh oracle; it does not replace the 60-case development and powered confirmation requirements.

## Evidence acquired

The pinned [Merge-Bench Builder](https://github.com/benedikt-schesch/Merge-Bench-Builder/tree/75efa749a7afb9612d0689dd4abe88a037de140d) supplies the saved `repos-c.csv` and `repos-go.csv`, each with 1,000 repository rows. They are discovery frames, not executable cases. Its [GitHub downloader](https://raw.githubusercontent.com/benedikt-schesch/Merge-Bench-Builder/75efa749a7afb9612d0689dd4abe88a037de140d/src/download_github_repos.py) explicitly fills `unit_test` and `continuous_integration` with placeholder 1.0 values. They must not be interpreted as measured coverage or CI quality.

Reused the existing native Git scanner and exact materializer on three compact Go libraries. Selection was deliberate acquisition feasibility, before any solver calls; it is not random population sampling. Full raw scans and triples are alongside this file, with original repository HEADs, command and hashes in [acquisition.json](acquisition.json).

| Repository | Replayed merges | Conflicted merges | Localized hunks |
|---|---:|---:|---:|
| spf13/cobra | 114 | 0 | 0 |
| stretchr/testify | 326 | 10 | 12 |
| etcd-io/bbolt | 960 | 8 | 23 |

The 35 hunks are not 35 independent trials. Several are tests, comments, generated declarations, or multiple hunks from the same event. The Testify scan also records one unrelated-history merge. No failures or clean merges were omitted from the funnel.

## New executable oracle

bbolt event `d1b21e619d11001e069ba793bb023951cd6f15fd`, `node.go`, adds checks for nonempty keys and a page identifier below the transaction high-water mark. Parent `a5cb717fc7741a98adbc31d082638835e81a97b5` contains the key checks; parent `c595561faae918374670ed667c64a7b95bbde9df` contains the page check. Expected behavior is specified from these parent assertions, not historical textual agreement.

The new focused test exercises one valid insertion and three invalid inputs. Native `go list` selects the revision's Linux source files, and the sandbox builds those files with the focused test, without network or third-party dependencies. Existing upstream tests are retained in the scaffold but are not run by this focused oracle; no whole-suite or database-correctness claim is made. The completion contract requires all four named subtests, their parent test and the final PASS marker.

[Oracle validation](bbolt-oracle-validation.json) records three independently compiled and executed reference passes and two compiling mutants rejected by the tests: omit key checks and omit the page-boundary check. Two earlier build failures are preserved: explicit filenames initially bypassed Go platform filtering; the next attempt mixed relative and absolute source paths. Both were corrected in oracle build commands, without altering tracked project source.

The private reconstruction manifest is `.do-not-commit/h0-v3-round2/bbolt-case.json`. Full runner admission is in `bbolt-admission/`; there are no solver calls. Acquisition/oracle inspection alone is not a model exposure under the current v3 contract. Do not consume this case in another pilot call; retain it for development after the admission audit.

## Reconciliation of the added research

The four user files in `/home/svnbjrn/rsrch/progression-reports/` informed this continuation. Recommendations remain hypotheses until supported by source or local evidence.

- Keep the existing claim: observed gain ≥5pp with a positive population-effect interval. This does not assert that the population gain exceeds 5pp; the existing v3 report already states that distinction.
- Keep the historical Git population. [Defects4C](https://github.com/defects4c/defects4c/tree/aecc2cf5f751d7c0894ae7d95ee0b8ae28e77b39) provides repair pairs and test/build knowledge, not original merge triples. Artificial refactor-versus-fix conflicts would define a separate synthetic study.
- [GitBug-Actions' official Go archive](https://zenodo.org/records/10539202) contains bug-fix execution artifacts and cloned repositories. Its saved metadata reports 6,433,381,655 compressed bytes and MD5 `0ff0bef309596805f00ee68776803cb8`. Metadata was acquired; the archive was not downloaded. With only about 13 GB free at inspection, targeted repository mining gives useful evidence without committing most remaining storage to unverified merge applicability.
- Do not filter cases using observed baseline failures to manufacture superiority. Any complexity-defined target population needs a prospective operational definition, frozen before confirmation.
- The existing power simulator uses simplified shared repository effects and one pooled discordance parameter. It does not yet establish frequentist coverage across realistic few-cluster scenarios or reproduce a full empirically estimated cross-model covariance structure. Audit these operating characteristics before confirmation; 12 lineages is a composition floor, not proof of calibrated inference.
- No new LLM judge, LLVM dependency system, or structural baseline is necessary to validate the newly acquired oracle. Phase 4 remains complete; this work concerns Phase 3's comparative utility.

## Remaining execution plan

1. **In progress:** expand actual historical C/Go acquisition, preserve the candidate-to-admission funnel, and assemble 60 fresh executable development cases. Count independent events and lineage identities, not hunks. Keep both exposed feasibility cases excluded.
2. Audit the context/output contract, oracle adequacy, provider identity behavior and statistical operating characteristics before freezing development settings. Version changes; preserve previous evidence.
3. Run the fixed 60-case three-arm matrix in both requested providers. Retain all outcomes, stops and errors under the existing policy.
4. Acquire a disjoint confirmation frame; freeze inference and choose 400–2,000 cases using validated joint-power simulation and actual lineage allocation. Require ≥12 lineages and ≤15% per lineage.
5. Run and replay confirmation. Set MEASURABLE=YES only if both models meet every prespecified comparison with valid evidence. An unfavorable result remains unfavorable; acquisition or instrument success alone cannot set the switch.

No permission question is pending. The goal is active and incomplete. This continuation is progress through newly acquired raw evidence and an independently exercised oracle.
