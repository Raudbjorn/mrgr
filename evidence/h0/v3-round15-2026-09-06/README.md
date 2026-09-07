# H0 v3 acquisition — round fifteen

**MEASURABLE remains NO.** Development and confirmation have not started.

The [untouched tail](untouched-tranche-frame.json) selects all 26 remaining previously eligible events, excluding every prior screening attempt and every earlier untouched-tranche selection, including precheck exclusions. It preserves original event/path/ordinal. All 26 screens completed and three CLI cases pass [full admission](cli-admission/). The [globally checked inventory](development-inventory.json) reached 59 fresh cases across 33 lineages before the larger frame supplied FRP.

The [larger-repository frame](batch-frame.json) prospectively expands listed size to 20,000–below-50,000 KiB, taking the first 30 unacquired rows in pinned star order while retaining age and name exclusions. The previous smaller frame is exhausted. All scans are terminal: 29 succeeded and Micro failed to clone. This broadens acquisition coverage; it does not weaken executable-oracle, independence or inference requirements. Source CSV quality-placeholder fields are not used as evidence of test quality.

All solver calls remain reserved for complete development preparation and its fixed Mercury-2/MiniMax-M3 matrix. Confirmation still requires a separate powered 400–2,000-case cohort with at least 50 balanced lineages and both-model superiority under the frozen CV3-t comparisons. No acquisition count establishes MEASURABLE=YES.

## Complete development supply and infrastructure repair

FRP passes full admission and brings the [frozen cohort](development-cohort-freeze.json) to **60 independent cases across 34 lineages**. All scaffold/oracle hashes and global group checks passed before full preparation. No model request preceded this freeze. Later acquisition cases cannot replace cohort members based on model outcomes.

The first full preparation, `evidence/h0/v3-development-2026-09-06`, is incomplete and ineligible. It recorded a repository-metadata fetch failure and exited while concurrent screening exhausted workspace space. Its stderr is empty, so the exact immediate exit cause is not established. [The failure record](development-prepare-failure.json) preserves these observations without inventing a missing error. The early-screen summary file was truncated to zero bytes by the recorded ENOSPC failure; [case accounting](early-screen-terminal-audit.json) reconstructs surviving evidence without inventing lost process exit codes.

A [local transport reproduction](metadata-transport-preflight.json) shows Node 25 reusing a closed socket after synchronous work blocks its event loop (`UND_ERR_SOCKET`). A fresh-connection metadata GET succeeds in the same scenario. Similar behavior is documented in the [Undici project's issue](https://github.com/nodejs/undici/issues/3492). Earlier metadata receipts did not preserve error causes, so this does not prove that every previous fetch failure had that cause. The lineage reader now sends `Connection: close`; model requests and retry rules are unchanged. All [11 runner tests](metadata-repair-tests.txt), including the new transport regression, pass.

Disposable Go download/compiler caches now use a distinct directory per screen under `/tmp`, whose separate filesystem had 25 GiB available during recovery. Original tracked scaffolds, vendored oracle dependencies and receipts remain in the workspace. The existing extraction/mutation [checks](temporary-cache-checks.txt) pass. Source snapshots preserve both prior and repaired implementations. A [cleanup ledger](emergency-cache-cleanup.json) records removed inactive caches.

Preparation `evidence/h0/v3-development-2026-09-06b` also stopped before producing a protocol. Both incomplete directories remain preserved. The final recovery below supersedes the initial temporary-storage assumption. MEASURABLE remains NO until actual both-provider development and independent powered confirmation establish the required benefit.

## Verified temporary filesystem and oracle invalidation

`os.tmpdir()` actually resolved to `/var/tmp/svnbjrn`, a disk filesystem selected by a host environment override. The first cache relocation therefore did not use the intended tmpfs. [The correction](temporary-filesystem-correction.json) explicitly places acquisition caches under `/tmp`, and full preparation runs with a process-local `TMPDIR=/tmp`. The observed filesystem has 25 GiB available. [The final extraction checks](explicit-tmpfs-checks.txt) pass. Inactive redirected caches were [cleared](redirected-cache-cleanup.json). Reconstructed scaffolds belonging only to failed screening cases were also [removed](failed-scaffold-cleanup.json); their raw receipts and original Git objects remain, and every admitted scaffold/oracle was retained and rehashed.

The Task case is [invalidated](task-oracle-invalidation.json): its reference outcomes in full preparation were pass/fail/pass, with `TestFileWatcherInterval` missing expected watcher output. No assertion was changed and this behavioral failure is not retried. A separately admitted AdGuard case replaces it before any model request. The [revised freeze](development-cohort-freeze-revised.json) contains **60 independent cases across 34 lineages** with verified scaffold/oracle hashes. The original freeze and Task admission remain historical evidence, not current eligibility.

Preparation `evidence/h0/v3-development-2026-09-06c` used the corrected temporary filesystem but was subsequently invalidated by host package changes, as recorded below. Acquisition is paused after the storage failures. Some secondary acquisition jobs remain incomplete; lost/truncated summaries are not treated as successful runs. No development model calls have started, and MEASURABLE remains NO.

## Host environment invalidation

The third preparation stopped when the full host-package fingerprint changed. The [failure receipt](development-prepare-c-failure.json) preserves accepted-case count, exclusions and the package log: Tdarr and Sanoid were removed during the run. No solver requests were made. This is an environment invalidation, not a failed utility result or a reason to weaken the fingerprint. The [stability observations](environment-stability-check.json) and recorded package inventory support a new preparation under a newly frozen environment. All prior attempts remain in place.

## Guarded development continuation

Preparation is running in `evidence/h0/v3-development-2026-09-06d` after an unchanged environment fingerprint was observed for more than 80 seconds. The strict environment guard remains active throughout preparation and execution. The [continuation state](development-continuation-state.json) records the live preparation/controller identities and stage.

When preparation exits, the continuation verifies the current source and environment, eligible development mode, exactly the revised 60 case IDs, unchanged model settings, valid oracle controls, and every scaffold/oracle hash. Only a successful check starts `v3.mjs run` for both authorized providers. The existing runner stops each provider at its first 429 or completed matrix, with no automatic answer retry. Aggregation follows the recorded run; a partial or invalid result is not promoted to evidence of utility. No confirmation is scheduled by this continuation.

## Pre-model context information audit

The [descriptive audit](context-information-audit.json) checks 42 admission records whose `v3-data.mjs` hash exactly matches the current selector. Selected context includes source ranges outside the local window in all 42, and other-file context in 37. Three include tests already present in parent revisions; these are inference-available source, not the frozen merged oracle. The other 18 records use older admission-source hashes and are excluded from this audit until their final preparation is available. These counts establish an information-set difference, not improved correctness, power or MEASURABLE=YES.

## Development population

All 60 cases are Go hunks from 34 verified lineages. The largest lineage, CLI, contributes 13 cases (21.7%). The [profile](development-cohort-profile.json) records the full allocation. This is a convenience development sample with executable-oracle availability restrictions; it does not establish cross-language utility or population-wide merge performance. The future confirmation allocation still requires at least 50 balanced lineages, with counts differing by at most one. Development composition is not a waiver of that requirement.

## Authenticated continuation e

The user authorized `GH_TOKEN` from `gh-token-painframe`. The nonsecret [quota receipt](painframe-rate-limit.json) shows HTTP 200 and 5,000 available core requests. The shared lineage client prefers this environment token and restricts authorization to `api.github.com`. Twelve [tests pass](painframe-lineage-tests.txt), including connection expiry, credential isolation and fail-fast metadata prefetch.

Fresh directory `../v3-development-2026-09-06e` runs with `TMPDIR=/tmp`; all repository metadata is prefetched before oracle work. The [continuation state](development-continuation-e-state.json) records preparation, guarded model execution and aggregation. No automatic confirmation or answer retries are enabled. Attempt d and its interruption remain preserved. Acquisition stays paused.

The [late/recovery terminal audit](late-and-recovery-terminal-audit.json) reconstructs the interrupted acquisition accounting without rerunning behavioral failures: Helm and NATS each completed 12 selected screens with zero passes; Tinode has 12 selected cases without terminal outcomes; Trufflehog recovery has 6 terminal outcomes and 5 pending cases; 11 remaining configured outputs have no readable frame. Lost exit statuses remain unknown. These acquisition jobs are paused while development runs.

## Development matrix started

Attempt e completed all 60 cases across 34 lineages with zero exclusions. Final source/environment checks and the frozen membership guard passed. Both Mercury-2 and MiniMax-M3 requests started at 23:04 UTC under protocol `86ffe38086e217acf6e1a4aa4162e226862463d1bde3160478f9a6f4d2b968ce`. The [preparation audit](development-e-preparation-audit.json) records frozen contexts and baseline outcomes. Baseline passes out of 60: ours 26, theirs 20, longer side 27, union 15, Mergiraf 20, Git text/diff3/halt 0. No baseline engine/environment errors occurred. These are development observations; selected-context utility and confirmation remain unproven.

## Guarded token-budget correction

Mercury recorded at least 10 truncated outputs in its 180-request development matrix, exceeding the predefined >5% truncation threshold regardless of the remaining responses. A separate [continuation](development-correction-continuation-state.json) waits for the verified original process (PID plus start time) to terminate, then requires its finished state and a complete, valid aggregate. Only then does the existing `extend-development` operation create `../v3-development-2026-09-06e-budget-correction`, double the token ceiling for each affected provider, and rerun the frozen development matrix once. It stops on any failed guard. Original responses remain intact; no per-answer retries, second correction or automatic confirmation is enabled.

The token-only continuation above was subsequently cancelled before execution after the [round-sixteen static regression](../v3-round16-2026-09-06/selector-name-regression.json) confirmed a declaration-name extraction defect. Its [terminal state](development-correction-continuation-state.json) records exit 143, no created correction directory and zero correction requests. The original matrix continues unchanged. The next explicit development revision must include the tested selector repair as well as the applicable budget correction.

## Generation complete; behavioral evaluation active

Both providers completed their 180-cell matrices. The [Mercury receipt](mercury-generation-complete.json) and [MiniMax receipt](minimax-generation-complete.json) verify every request against the frozen protocol and preserve response-file hashes. Mercury: 140 resolutions, 29 truncations, 3 malformed outputs, 7 halts, 1 transport error (HTTP 503). MiniMax: 142 resolutions, 17 malformed outputs, 21 halts, zero transport errors. Neither provider stopped on 429. The original continuation started behavioral evaluation at 23:57 UTC; these generation counts do not establish correctness or utility.
