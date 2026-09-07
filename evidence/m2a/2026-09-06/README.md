# Phase 4 completion — 2026-09-06

**Phase 4 is complete; Phase 5 can proceed.** The Git driver, status preservation, native attribute routing, mixed binary preservation, repeated tree determinism, and residue freeze are implemented and verified. This closes the deterministic port scope. It does not establish comparative efficacy or revive the stopped Round 5 model experiment.

[manifest.json](manifest.json) pins source files, executable hashes, versions, public fixtures and private preflight outputs. The working tree contains uncommitted changes: the source HEAD alone does not identify this implementation; use the recorded file hashes.

## Acceptance evidence

| Gate | Evidence |
| --- | --- |
| Real Git integration | Three engines invoked by native Git attributes/config, using the shipped CLI; clean returned trees equal the native Git baseline. |
| Status separation | Actual raw engine exit, normalized driver status, and outer Git exit recorded separately. Non-selected engines are null. A two-conflict Git engine exits 2 while driver and outer Git exit 1. Missing engine/fatal output is never accepted as a clean tree. |
| Mixed binary preservation | Binary-first and binary-last fixtures retain resolved text in returned trees and stage 0 of the actual merge index. Binary bytes remain ours with three unresolved index stages and an explicit fallback record. |
| Tree determinism | Nine public engine/fixture cells × five runs; all 45 trees independently verified after importing the bundles into fresh repositories. Six real engine/fork cells × five runs also have identical within-cell tree OIDs and residue. |
| External engine coverage | Local Mergiraf 0.19.0 executed. Required integration tests fail when unavailable; CI installs that exact crate with locked dependencies. Crate availability verified with Cargo. The remote CI job has not been run. |
| Frozen residue | Public bundles retain input commits and result trees; private isolated repository retains pinned inputs and all returned trees under refs. Raw output, invocation logs, protocol and residue lists are preserved. |

Validation: **339 passing tests** (306 core, 31 mechanisms, 2 H0), workspace typecheck/build passed, all 24 carried files unchanged, and carried-source verifier negative selftest passed. Logs are retained beside this file. No dependency or model request was added.

## Real fork preflight

The isolated private run is at `/home/svnbjrn/rsrch/mrgr/.do-not-commit/m2a-2026-09-06`. Its `protocol.json` freezes the five input commits and executable/source versions; `summary.json` records results. The public manifest pins both files by SHA-256 and records complete residue lists. Private source code remains outside the public fixture bundles.

| Fork leg | Engine | Unresolved paths | Driver calls per run | Repetitions |
| --- | --- | ---: | ---: | ---: |
| fork4 | git_text | 15 | 44 | 5 |
| fork4 | gnu_diff3 | 15 | 44 | 5 |
| fork4 | mergiraf | 9 | 44 | 5 |
| fork6 | git_text | 10 | 24 | 5 |
| fork6 | gnu_diff3 | 10 | 24 | 5 |
| fork6 | mergiraf | 5 | 24 | 5 |

Total: 1,020 driver invocations. Native Git residue counts are 15 and 10. Returned trees agree with native Git outside the union of unresolved paths; this is not a claim of complete byte equivalence on conflicted real inputs. Fewer unresolved paths do not prove correct resolutions. No native-structural-success count is inferred from Mergiraf's process status.

## Reproduction

Install Git, GNU diff3, Node/pnpm and Mergiraf 0.19.0. Run from the workspace root:

```sh
pnpm --filter @mrgr/mechanisms test
# Optional: write a NEW evidence directory; existing fixture records are refused.
MRGR_M2A_EVIDENCE_DIR=/absolute/new/evidence-directory pnpm --filter @mrgr/mechanisms test
pnpm --filter @mrgr/mechanisms build
node scripts/m2a-preflight.mjs /home/svnbjrn/rsrch/projects-mrgr/experiment/baseline/scratch /absolute/new/private-preflight
```

The private command requires the documented local source repository. It creates an isolated clone and leaves the original unchanged. Retained result commits are artifact roots, including unresolved residue, not adjudicated final merges.

Each public `.bundle` can be imported offline into an empty repository. Its `refs/mrgr-evidence/run-0` through `run-4` retain the result trees recorded in the corresponding JSON file. For example, after importing all bundle refs, `git rev-parse 'refs/mrgr-evidence/run-0^{tree}'` must equal the first recorded run's tree. Re-executing with another tool version is a new characterization, not a replacement for this freeze.

## Phase 5 handoff

Use the frozen input refs and Phase 4 residue as provenance. The next task is a fresh, reproducible resurrection reconstruction from all five original pinned refs, with candidates derived before final-ref inspection. The existing private test audits an imported historical join tree; it does not prove how that join was reconstructed. Preserve that historical audit and compare a fresh reconstruction independently. Require the four expected monolith candidates and exact byte accounting, a post-edit zero-candidate result, and the public synthetic topology gate. Stop on unexplained differences rather than adjusting the candidate rule to fit final refs.

See [Phase 5 current state](../../../docs/planning/final/phase-5-resurrection-proof/current-state.md) and [driver usage and failure contract](../../../packages/mechanisms/README.md). Incomplete audit records and fatal outer Git statuses are not valid merge evidence; cross-file filesystem transactionality is not claimed.
