*Part of the [canonical planning document](../canonical-final-planning-document.md).*

## 20. Verification leads for low-confidence / `[UNVERIFIED]` items

| Item | Search lead |
|---|---|
| `/home/svnbjrn/rsrch/mrgr` current HEAD SHA | **Resolved 2026-08-30:** `2b0dcbd3743e5603cfa54bd4f76403c6843716ef` — re-run `git -C /home/svnbjrn/rsrch/mrgr rev-parse HEAD`, it will have moved on |
| Working-tree state | **Resolved 2026-08-30:** clean except this planning-doc split — re-run `git -C /home/svnbjrn/rsrch/mrgr status --porcelain` |
| Whether `src/forensic/core.ts` exists at the addendum's path | **Resolved 2026-08-30: no.** The file is `packages/core/src/m1a/forensic-core.ts` — different directory, hyphenated not slashed. See §1.3 correction. |
| Whether `evidenceBundles` round-trips through `parseCorpusRecord` after WP1 | **Resolved 2026-08-30: this test path doesn't exist.** `evidence-roundtrip.test.ts`, `region-identity.test.ts`, `add-add.test.ts`, `delete-modify.test.ts`, `extraction-failure.test.ts` are all absent — confirmed by `find`. Equivalent coverage is in `packages/core/tests/db/*.test.ts` instead (see `phase-2-m1a-persistence/work-packages.md`). |
| Whether the carried-WP0 manifest matches the on-disk SHA-256 | `./scripts/verify-carried.sh` — not re-run this pass, still an open lead |
| Whether the redesigned H0 kill branch is reachable by construction | Manual: insert `temperature > 0` so all arms score equal to constant baseline; verify `killConditionMet === true` — not re-run this pass |
| Whether the M2a port's git_text adapter is equivalent to Git-ort on a fresh fixture | Still open — moot until WP5 starts. **New finding (2026-08-30):** the Round 5.1 source it would port *from* (`merge-mechanism-driver.sh`, `MECHANISM-PREFLIGHT.json`, `adjudicate.py`) does not exist anywhere in this repo or its remote branches (confirmed by `find` + `git ls-tree` on `origin/next-phase`) — see `phase-4-m2a-mechanisms/current-state.md` for the blocker this creates. |
| Whether the resurrection proof's synthetic-repo public gate runs in CI | Still open — moot until WP6 starts. **New finding (2026-08-30):** the five pinned reconstruction refs (`ov2-base`, `base4-p`, `fork4-p`, `base6-p`, `fork6-p`) are **not reachable** in this repo (`git cat-file -e <sha>` fails for all five, checked against `origin/next-phase` too) — see `phase-5-resurrection-proof/current-state.md` for the blocker this creates. |
| Whether `merge.bundle_uri`-style delivery would change the Mergiraf license analysis | None — this is a fact boundary; see `research/mergiraf-mechanism.md` GPL boundary section |
| Whether the M1a schema-version bump breaks any external consumer | `/home/svnbjrn/rsrch/mrgr` has no external consumer today; this verification is moot |

