*Part of the [canonical planning document](../canonical-final-planning-document.md).*

Paths below are relative to `.do-not-commit/planning/` unless stated otherwise.

### 3.1 M0 — extract `@mrgr/core` from WP0
- **State:** complete (commit `2440329`). 24 carried files byte-verified by `scripts/verify-carried.sh`. Apache-2.0 declared. CLI binary built. 120 tests pass on a clean clone at `ed928032…` on `node v25.1.0` / `pnpm 11.3.0` / `git 2.55.0` / `Arch 7.1.3-273-tkg-bore`. (That 120-test figure is the carried-only subset predating `mrgr-db`; current total is 232 across 24 files — see `phase-2-m1a-persistence/current-state.md`.)
- **What survives:** the carried miner, the schema-v2 corpus contract, the `isolated-v1` Git baseline, conservative localization, and the explicit-denominator report. (`phases/m0/wp0-measurement.md`, `phases/m0/scope-and-verdict.md`, `phases/m0/wp0-merge-replay.md`, `phases/m0/closure-evidence.md`.)
- **What does not survive — Correction (2026-08-30, verified on disk): all three fixed.** The README's present-tense claim that the project "invokes Mergiraf/diff3" and references to absent `docs/method.md`/absent packages are gone from `README.md` (`grep` for those strings returns nothing). `NOTICE` on disk now carries the rights attestation ("Attested by the author, 2026-08-27") and the corrected Mergiraf/diff3 license lines — it no longer matches `NOTICE.snapshot`, which is the *pre*-correction capture, not current state. See §3.2.

### 3.2 M0-closure — durable gates and corrected claims
- **State (2026-08-30, verified on disk):** 3 of 4 closing requirements are done; 1 is open.
  - **DONE:** NOTICE corrected — no `docs/method.md` reference, no present-tense mechanism invocation, Mergiraf `GPL-3.0-only`, diff3 `GPL-3.0-or-later`. Verified by reading `NOTICE` directly.
  - **DONE:** README corrected — no absent-package claims. Verified by `grep`.
  - **DONE:** rights attestation recorded in `NOTICE` — "Attested by the author, 2026-08-27." (`phases/m0/NOTICE.snapshot` is the *pre-correction* capture and still shows "NOT YET RECORDED" — that's expected; it's a historical snapshot, not current state.)
  - **DONE (2026-09-01):** the durable clean-clone artifact (`evidence/m0-closure.md`) is regenerated against current HEAD (`185bc9219e1f181b49d9f7cb2b474c9b3f18e771`) — 28 files / 299 tests, `vitest 3.2.7`. The artifact's own "What this does NOT establish" section previously carried a hardcoded, now-false line claiming the rights attestation was unrecorded; `scripts/capture-evidence.sh` printed that line unconditionally rather than checking `NOTICE`, so simply re-running it would have reproduced the same false claim. Fixed by removing the stale line from the script.
- **STOP rule (satisfied 2026-09-01):** M0 may now be called "done"/"clean-clone reproduced" — the artifact is current and no longer makes a false claim.

### 3.3 F1 — exact localization unreachable on real repositories
- **State:** found and fixed. Found at commit `ced6d13`; fixed at `ed92803`. Confirmed by planning/findings pointer and by `phases/m0/F1-exact-localization-unreachable.md`.
- **Mechanism:** `localize.ts` requires complete diff3 conflict blocks. The isolated environment (`GIT_CONFIG_NOSYSTEM=1`, `GIT_CONFIG_GLOBAL=/dev/null`) means `merge.conflictStyle` falls back to Git default, omitting the `|||||||` base section. The fixture sets the style inside its own repo so the suite never exercised the broken path. Fix: conflict style now opt-in via `ReplayOptions.conflictStyle`, delivered as `git -c merge.conflictStyle=…` via `RunGitOptions.config`. Default behavior and `baselineId` unchanged.
- **Effect:** 0 → 377 exact regions on the same `jqlang/jq` scan.
- **STOP rule:** before any future H0 corpus build, verify `--conflict-style` was passed. This exact failure has a fix now; do not re-discover it.

