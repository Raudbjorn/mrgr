*Part of the [canonical planning document](../canonical-final-planning-document.md).*

## 15. Self-attack (Phase 4)

### 15.1 What changed after the attack

| Attack | What it exposed | What was revised |
| --- | --- | --- |
| Circular dependencies | None at milestone level. At work-package level: Work package 3 (H0 redesign) and Work package 4 (H0 rerun) could be misread as circular with WP1/WP2 if a planner thinks "fix the corpus before redesigning H0." | Added §5 explicit declaration that M1a P0/P1 precedes H0 redesign and H0 redesign precedes any rerun. WP1's STOP rules explicitly forbid H0 rerun. |
| Unfalsifiable gates | (a) H0's `kill condition met: false` from the original run was unfalsifiable (`Infinity`). (b) M3's `UNION_PASS` single bit was unfalsifiable. (c) M4's resurrection proof passing on finals-only inspection is unfalsifiable. | (a) Replaced by reachable kill rule with magnitude + Fisher exact. (b) Replaced by four-axis reporting. (c) Resurrection proof moves earlier and the gate is reconstructed inputs, not finals. |
| Accidental claims from stale evidence | `today-2026-08-26.md` says "H0 complete; verdict positive"; `semantic-merge/docs/M1a-evidence-bundles.md` says "Completed"; `projects-mrgr/experiment/docs/M0.md` duplicates M1a narrative under wrong project/milestone. | The evidence ledger flags all three as `STALE-*`. **Corrected 2026-08-30:** `STATUS.md` is itself internally inconsistent (§1.5 rule 2) and is not authoritative — the phase-N `current-state.md` files in this split (e.g. `phase-3-h0-evidence-utility/current-state.md` for H0) are the current-truth source, alongside the corpus-review addendum. |
| Tasks too vague to execute | "Fix M1a" was vague in PLAN.md (10 lines, no test names). The corpus-review addendum adds evidence tags and P0/P1/P2 ordering. | The WP1/WP2 units name specific files/symbols (`packages/core/src/evaluation/corpus.ts:608-728`, `cli.ts:242-251`, `types.ts`, `forensic.test.ts:99-108`, `cli.test.ts:99-108`) and specific tests (`evidence-roundtrip.test.ts`, `region-identity.test.ts`, `add-add.test.ts`, `delete-modify.test.ts`, `extraction-failure.test.ts`). |
| Overfit to invalidated H0 | The plan could be read as "H0 failed; do M1a anyway." The M1a addendum's R6 already corrects that. | §4.1 explicitly settles "H0 verdict on first run = invalidated"; §4.2 lists the H0 questions still gated. WP3 explicitly requires removing answer leakage, providing real preimages, and adding trivial baselines — i.e., the redesign is structural, not cosmetic. |
| Premature coupling of M1a, H0, M2a | M1a H0 redesign and M2a port are both downstream of M1a P0/P1, but M2a port is independent of H0. | §5 critical-path diagram shows H0 redesign and M2a port as parallelizable after M1a P1; §6 Work package 4 and Work package 5 are explicitly parallelizable. |
| Smaller plan / deletion | WP7 / WP8 may be premature to enumerate in detail. | WP7 / WP8 are placeholders for future work packages with explicit gating conditions; they are not committed in this round. |
| Provenance / licensing / reproducibility | Mergiraf `GPL-3.0-only`; diff3 `GPL-3.0-or-later`; WP0 source ledger; rights attestation. | §9 publication rights + WP0 STOP rules + MM-2 per-attribute setup cover the licensing surface; provenance ties to `closure-evidence.md` and `MECHANISM-PREFLIGHT.json`. |
| Concurrent drift | `/home/svnbjrn/rsrch/mrgr` not in workspace; cannot re-hash before yielding. | §1.1 flags `UNKNOWN` and §11 lists concurrent drift as risk #1 with detection + mitigation. |
| M3 "no oracle means verified nothing" | Easy to miss when M3 is the verification phase. | §4.1 (settled) and §11 risk register repeat the rule. |

### 15.2 What remains risky

1. **Path translation.** The M1a addendum names paths like `src/evidence.ts` and `src/forensic/core.ts` that may not exist at those prefixes; `local/planning-next-phase-research.md:35-43` warns the `src/forensic/core.ts` references may resolve to a new-module target under `packages/core/src/evaluation/`. A planner must verify the exact path on disk before editing.
2. **Carried-file manifest staleness.** If any of the 24 carried files must change, the manifest update must be deliberate; if the executor adds a new file, the manifest must reject it.
3. **`MODEL_BUILD` substitute.** The Round 5.1 audit found OMP exposed only a public selector; the audit's `MODEL-BUILD-FRAME-MISMATCH.json` records the stop. The M2a port does not need `MODEL_BUILD` (it tests adapter equivalence, not model-driven arms), but if a planner conflates "M2a port" with "rerun the Round 5 experiment," they will hit the same stop. WP5 is explicit: re-prove adapter equivalence on the target host; do **not** model-driven-arm the port.
4. **Schema-version bump.** If M1a P0 changes any field's contract, schema v2 must be republished. **Corrected 2026-08-30:** `types.ts`/`corpus.ts` were the design-time authorities for the carried-code contract; since `mrgr-db/2` landed, the actual load-bearing persistence authorities are `packages/core/src/db/schema.ts` (SQL DDL + `CHECK` constraints) and `packages/core/src/db/open.ts` (`USER_VERSION`/`SCHEMA_VERSION_STRING`).
5. **The 1,200-UTF-16-vs-bytes semantic is subtle.** A planner who reads `CAP = 1200` and assumes bytes will regress the truncation contract. The §8 public contract and §1.3 version pinning carry the distinction.

