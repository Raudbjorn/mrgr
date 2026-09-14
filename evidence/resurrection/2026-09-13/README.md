# Phase 5 fresh resurrection proof — complete, 2026-09-13

**The join was freshly reconstructed twice from the five pinned input histories. Both runs exactly reproduce `2e393f450d33c7d186b87c9d748a83760f49d6fc`.** The historical join was not imported into either reconstruction repository. Phase 3's closure check passed; Phase 4's frozen source, tools, private preflight records and all 45 public bundle result trees were verified before reconstruction.

## Finding

An input-history detector, with no final-ref input, found exactly these four returned files. Each existed in both fork bases, was absent from `ov2-base`, remained in the forks, and reappeared in the fresh join. The detector applies the predeclared `.test.ts` suffix to all such paths; it does not whitelist these four names.

| Path | Bytes |
|---|---:|
| `src/main/codex-accounts/runtime-home-service.test.ts` | 168,669 |
| `src/main/persistence.test.ts` | 445,919 |
| `src/main/updater.test.ts` | 164,289 |
| `src/renderer/src/web/web-preload-api.test.ts` | 170,454 |
| **Total** | **949,331** |

Candidates and blob IDs were written to immutable evidence for each attempt before the historical tree or final refs were read by the proof runner. Both fresh candidate lists match. The subsequent historical comparison has **zero differing entries**, and each of the six recorded final commits explicitly lacks every candidate.

Removing only the candidate paths through an isolated Git index produces `9de6928de1019bf09df55102399c9c0c82d63414`. The input-history detector then returns zero candidates; a complete tree-entry comparison proves all other paths, modes and object IDs unchanged. This edited tree deliberately retains unrelated merge conflicts. It is a deletion proof, not a fully resolved program or a claim that dropping the files preserves all behavior.

## Reproducible recipe

```sh
pnpm exec tsx scripts/resurrection-proof.ts /absolute/source/repository /absolute/NEW/private-output-directory
pnpm --filter @mrgr/core exec vitest run tests/resurrection.test.ts tests/resurrection-reconstruction.test.ts
```

Run the private command from this checkout. The source must contain the five pinned input commits, historical comparison tree and six imported final refs recorded in protocol.json/result.json. The default local source used here was this repository. Missing inputs fail the explicit command; no private skip is accepted as completion. Output directories must be new. Each Git subprocess has a 120-second deadline, raw receipts and stage progress; failures produce FAILURE.json and nonzero exit status.

The runner fetches only the five input histories into each empty repository, with no alternates, inherited Git settings, hooks or external merge drivers. Three native Git merge-tree invocations use explicit bases: fork4 against origin with base4, fork6 against origin with base6, then the wrapped leg trees against each other with origin as base. Conflict-bearing returned trees and raw statuses are retained. Git's `diff3` conflict style and wrapper author/committer, timestamp and messages are explicit recipe inputs; wrapper trees and parents are freshly computed. See protocol.json and wrapper-provenance.json.

## Discrepancies investigated, not suppressed

The first isolated attempt used Git's default conflict style and differed in 23 files. The historical source configuration and protocol established `diff3`; pinning it reproduced both leg trees exactly and reduced the differences to four files. Every remaining difference was a marker label containing a wrapper commit ID. Recovering the historical intermediate commit metadata reproduced those IDs and the full join exactly. No candidate rule, expected count, candidate contents or final-ref filter was changed to obtain the match.

Both diagnostic attempts are retained privately at `.do-not-commit/resurrection-fresh-2026-09-13` and `.do-not-commit/resurrection-fresh-diff3-2026-09-13`, including their result/difference records and source snapshots. The passing pair is at `.do-not-commit/resurrection-fresh-exact-2026-09-13`. Full Git command receipts may include private path/content data and remain there; this public directory carries metadata and checksums, not private source blobs or bundles.

## Validation and limits

Public reconstruction coverage includes modified/deleted files, unchanged upstream deletions, clean additions, retained files, duplicate candidates across legs, tab/Unicode paths and byte counts, two isolated deterministic replays, post-edit preservation, missing commits and fatal Git commands. The six existing public/private imported-tree audit tests remain unchanged as historical regression coverage. The new public reconstruction test is picked up by the existing workspace CI test command. Remote CI was not run.

Local workspace validation: **307 core + 31 mechanism + 14 H0 tests passed**, workspace typecheck passed. Source and evidence hashes are in manifest.json. The result establishes this pinned reconstruction and scoped detector's behavior, not semantic correctness of arbitrary merges, LLM efficacy or deletion safety in general. Private reproducibility still requires access to the recorded source objects. Phase 3 and the incomplete local-model run remain closed; no model requests or training were performed.

## Review corrections — 2026-09-14

Git is now discovered through PATH and its resolved executable is used for both execution and hashing. Git-specific environment isolation remains in force; platform null-device paths replace Unix-only constants. The public regression checks a nonstandard PATH and rejects an absent Git. Windows execution has not been validated here. The private proof still requires the frozen tool versions and private prerequisite artifacts.

Public protocol source is `SOURCE_REPOSITORY`, supplied as the first CLI argument. Public output/receipt paths are repository-relative; workstation prefixes were removed from archived test logs. Raw originals remain private. The manifest records original hashes of redacted documents and hashes of their public representations. Original `source_hashes` identify the code that produced the September 13 proof; `reviewed_source_hashes` identify the reviewed implementation and do not claim a new private execution. Reproduce the proof into a new private directory when using the revised code; never replace the frozen result with an unverified new run.
