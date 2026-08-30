*Part of the [canonical planning document](../canonical-final-planning-document.md).*

## 11. Risk register

| Risk | Detection | Mitigation |
| --- | --- | --- |
| Drift in `/home/svnbjrn/rsrch/mrgr` between reading this doc and acting on it (downgraded from "cross-tree" risk 2026-08-30 — this doc now lives in the repo it describes, not a separate staging tree) | `git -C /home/svnbjrn/rsrch/mrgr status`; SHA-256 of `packages/core/src/evaluation/{corpus.ts,types.ts,cli.ts}` before edit | Re-pin HEAD on disk before any edit; re-hash edited paths after each commit; rebase vs `main` before opening any PR |
| Silent carry-file mutation under `/home/svnbjrn/rsrch/mrgr/scripts/carried.sha256` | `./scripts/verify-carried.sh` exit code; `./scripts/verify-carried-selftest.sh` | Run both before every M1a commit; if a carried file must change, update the manifest deliberately |
| **"Complete on all branches" claims that aren't** — found 2026-08-30: M1a/`mrgr-db/2` (`packages/core/src/db/`) exists on `spec/persistence-layer` and descendants but is absent from `main` and `origin/next-phase` | `git ls-tree -r --name-only <branch> \| grep <path>` on the branch you're actually working from, not the branch a status file was written from | Before trusting any "complete"/"landed"/"shipped" claim in this corpus, verify it against your current branch specifically — status files (including `STATUS.md`) don't always name which branch a merge landed on |
| Stale `semantic-merge/docs/M1a-evidence-bundles.md` "Completed" claim read as authoritative | grep against the corpus-review addendum | Pin the corpus-review addendum in the durable artifact; cross-link from `STATUS.md` |
| Re-deriving the invalidated H0 experiment | grep for `triple.resolution` in arm prompts; per-arm temperature audit | WP3 audits the prompt contract for answer leakage; `temperature > 0` and Fisher exact test are required |
| M2a adapter equivalence drift | five-run determinism probe | Run preflight before any rate comparison; mixed-fixture binary guard test |
| M3 pass-vacuously on no oracle | M3 gate vector entry count zero | Every gate must declare an oracle; "no oracle configured" means "verified nothing" |
| D79-class mixed merge losing earlier text resolution | mixed-fixture test | Pre-audit D79 corpus record; status-layer separation; preserve `in_core_*` text result explicitly |
| Resurrection proof passing vacuously on finals-only audit | audit operates on reconstructed inputs, not final refs | The private gate is `git log` + reachability on the *joined* tree, not the final refs |
| D90-style duplicated ledger block | `id`-uniqueness check at every append | Content-derived or namespaced IDs; concurrent-write smoke test |
| License-coupling risk with Mergiraf | `merge.default=mergiraf` in shipped config | Per-attribute `merge=mergiraf` + `merge=binary` macro; subprocess boundary preserved |
| Vacuous pinning test (`expect(getX()).toBe(DEFAULT_X)`) | code review on `debt` records | Spelling-out-literal pinning test that does not call the seam |
| Compile-event instrumentation drift | M3 instrumentation retrofitted late | M3 instrumented from the start; `syntax-blocked` fix documented and applied |
| `temperature: 0.0` repeats treated as independent | per-run identical counts | `temperature > 0` or non-summed binary vector + Fisher exact |

