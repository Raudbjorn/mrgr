*Part of the [canonical planning document](../canonical-final-planning-document.md).*

## 1. Frame lock and authority

Paths below are relative to `.do-not-commit/planning/` unless given as a full absolute path.

### 1.1 Workspace and timestamp

| Field | Value |
| --- | --- |
| Workspace | `/home/svnbjrn/rsrch/mrgr` |
| UTC captured | 2026-08-29T05:25Z; **re-verified live 2026-08-30** (see correction row below) |
| Git repository | **Correction (2026-08-30, verified live):** this IS the git repository — `origin` is `git@github.com:Raudbjorn/mrgr.git`. The prior "not a git repository" line described a *different*, now-abandoned staging tree (`/home/svnbjrn/rsrch/projects-mrgr`); it never described this repo. |
| Working-tree state | **Correction (2026-08-30, verified live):** HEAD is `2b0dcbd3743e5603cfa54bd4f76403c6843716ef` on branch `3-verified-current-state-by-milestone`. `git status --porcelain` is clean except for this planning-doc split itself. This tree already has `packages/core/src/db/` (all 14 mrgr-db files) and 24 test files — the M1a persistence-layer work described in §3.5 is real and present here, not a claim about some other tree. |
| Concurrent-change risk | **Correction (2026-08-30):** downgraded from "High" to **low/moot**. The original "High" rating assumed the plan's authoring workspace (`/home/svnbjrn/rsrch/projects-mrgr`, a research staging tree) was separate from the actual source repo (`/home/svnbjrn/rsrch/mrgr` — or `/home/svnbjrn/dev/mrgr`, itself now a stale, untouched-since-Aug-26 husk with no `packages/`). That separation doesn't exist for this document any more: this file lives inside the repo it describes, so re-checking state is `git status`/`git log` in the working directory, not a cross-tree fetch. |
| Canonical planning files | `PLAN.md` (SHA-256 `93e13342577876a7504188d6756ed932149e944f9309ae5eb30d48f57d846216` — **verified matching on disk, 2026-08-30**); `canonical-plan-source.md` (SHA-256 `3baa199c2ee4a3f4908e9648262c48197487a2ece40ca118549cc91493cee4ff` — **verified matching on disk, 2026-08-30**). **`STATUS.md`, `SOURCES.md`, `README.md` were confirmed missing 2026-08-30, then restored by the user from an older backup the same day.** All three predate the H0 redesign+rerun landing and the M0/M1a completion — treat as stale. `STATUS.md` is worse than merely stale: it's **internally inconsistent** — it cites `evidence/h0/REVIEW-2026-08-30T02-54-42-056Z.md` as its source but states the opposite of what that file says (see §3.4 correction and §1.5 rule 2). **The phase-N `current-state.md` files in this split remain the de facto current-truth source** — this was already true before the restore and stays true after it. |

### 1.2 Phase 0.5 framing pushback / 1.4 Artifact scope — moved

**Moved to `reference/framing-pushback-and-scope.md` on 2026-08-30.** This is
authoring-time rationale for why the corpus is shaped the way it is, and a
definition of what this artifact does/doesn't cover — read it when you need
to understand *why* the document is organized this way, not when you're
checking milestone state. It is not needed for routine "what's next" reads,
which is why it no longer sits in the every-session-read path.

### 1.3 Versions pinned

| Component | Pinned version | Source |
| --- | --- | --- |
| `mrgr` source repo | `/home/svnbjrn/rsrch/mrgr` (branch `3-verified-current-state-by-milestone`) @ HEAD `2b0dcbd3743e5603cfa54bd4f76403c6843716ef` (verified live, 2026-08-30). Historical anchors: M0 evidence commit `ed928032d4c2786988f1ec8a279975894f099553` (this is what `closure-evidence.md` describes — it predates `mrgr-db` and the rights attestation and needs regenerating, see `phase-1-m0-core-extraction/current-state.md`); F1 fix at `ed92803`; M0 root at `2440329`. Re-pin HEAD before any edit — it will have moved past `2b0dcbd` by the time you read this. | `phases/m0/closure-evidence.md`; `findings/F1-exact-localization-unreachable.md` |
| Node | `v25.1.0` (engines `>=22.5.0` — **bumped from `>=20` post-M0 by commit `c55d0aa` "validate ledger createdAt, correct README Node floor"**) | `package.json` (root); `packages/core/package.json`; `closure-evidence.md` (M0 baseline `>=20`) |
| pnpm | `11.3.0` | `package.json` (`"packageManager": "pnpm@11.3.0"`); `closure-evidence.md` |
| Git | `2.55.0` | `closure-evidence.md`; `MECHANISM-PREFLIGHT.json` (Round 5.1); plan critique S22/S23 |
| OS / kernel | Arch Linux `7.1.3-273-tkg-bore` | `closure-evidence.md`; Round 5.1 session record |
| vitest | `^3.2.7` (actual; superpowers plan line9 says "vitest 2" — stale) | `package.json` |
| zod | `^4.4.3` (actual; matches superpowers plan's "zod 4 (already a dep)") | `packages/core/package.json` |
| SQLite persistence layer (`mrgr-db`) | Schema version `mrgr-db/2` (USER_VERSION=2, APPLICATION_ID=0x6d726772); driver `node:sqlite` (Node built-in, no new dep); DB file `mrgr.db` by default, path via `--db`; 108 db tests green; supersedes JSONL as storage (JSONL remains transport via `mrgr db import` / `mrgr db export`) | `packages/core/src/db/`; `docs/superpowers/specs/2026-08-28-persistence-layer-design.md`; `docs/superpowers/plans/2026-08-28-persistence-layer.md` (note: plan/specs reference `mrgr-db/1`; the actual shipped schema is `mrgr-db/2` per `packages/core/src/db/open.ts:9`) |
| Git baselineId | SHA-256 of pinned tuple `Git=2.55.0, isolated-v1, ort, normalization=v1, materialization=v1` | `phases/m0/wp0-measurement.md` |
| Round 5.1 adapter (`merge-mechanism-driver.sh`) | 188 lines, hardened 2026-08-26; SHA not pinned in corpus text (re-derive at rehydrate) | Round 5.1 session record |
| Round 5.1 frozen refs | `ov2-base=b2d25948…`, `base4-p=4a729909…`, `fork4-p=c687b532…`, `base6-p=83c6e7d4…`, `fork6-p=9c25e84e…` | `PLAN.md` §4 (resurrection inputs); Round 5.1 session record |
| Mergiraf | `v0.19.0` @ commit `7246b03c08c02248035bc20668fde1edf94a09e0` | `research/mergiraf-mechanism.md` |
| Merge-Bench | arXiv:2605.25890v1; dataset `merges.tar.gz` SHA-256 `4f0b63409776c7d987b808dd85959c40a09160c6f155381b66a9ed8356ea6ff8`; companion repo `benedikt-schesch/Merge-Bench` @ `4860bea020e3fc0af31fff8d58e5b822be822222` | `research/adjudication-literature.md` |
| AgenticFlict | arXiv:2604.03551v2, AIware'26 DOI `10.1145/3805760.3814923`; source `unlv-evol/AgenticFlict` @ `e050289d12c37d90e81f90886a0ecde9a683385a` | `research/adjudication-literature.md` |
| Rover | arXiv:2605.17279v1 | `research/adjudication-literature.md` |
| ConGra | arXiv:2409.14121v1 | `research/adjudication-literature.md` |
| ConflictAgent | arXiv:2607.27674v1; repo `UBOWENVT/ConflictAgent` | `research/adjudication-literature.md` |

**Resolved 2026-08-30** (was `UNKNOWN`): HEAD SHA and working-tree dirty state are in the table above (§1.1, §1.3). `packages/core/src/forensic/core.ts` does not exist at that exact path; the file the M1a addendum meant is `packages/core/src/m1a/forensic-core.ts` (note: `m1a/forensic-core.ts`, not `forensic/core.ts` — different directory name and a hyphen, not a slash). The persistence-layer work also landed at `packages/core/src/db/` (see `phase-2-m1a-persistence/current-state.md`). Re-verify HEAD/dirty-state before any edit regardless — this snapshot ages out immediately.

### 1.5 Authority and supersession rules

1. **Direct source + preserved run output + independent reviews** outrank everything else.
2. **Correction (2026-08-30):** `STATUS.md` was briefly missing, then restored by the user from an older backup — but it's **internally inconsistent**, not just stale: it cites `evidence/h0/REVIEW-2026-08-30T02-54-42-056Z.md` and then states the opposite of what that file concludes on H0/WP8 (that file: 0 fabricated-citation records, "H0/WP8 is now open"; `STATUS.md`: "Agent adapter remains NOT cleared"). Do not treat `STATUS.md` as authoritative on the H0/WP8 question. **The phase-N `current-state.md` files in this split remain the de facto current-truth source**, alongside the governing phase plan for each milestone (both outrank `PLAN.md` and `STATUS.md` narrative on any point where they conflict with primary evidence).
3. **`PLAN.md`** is revision-2, content copy of the plan-mode file with live phase markers added. (SHA-256 verified matching on disk 2026-08-30 — see §1.1.)
4. **Session records** under `sources/sessions/` are evidence, not status.
5. **`.remember/` snapshots** are navigation history; the positive-H0 line in `today-2026-08-26.md` is a **superseded, non-authoritative** claim — the current H0 status is `phase-3-h0-evidence-utility/current-state.md`, not this snapshot.
6. **Correction (2026-08-30):** the "`planning/docs/`" staging corpus this rule described does not exist in this tree (only `docs/planning/final/` — this split itself — and `.do-not-commit/planning/` exist). This rule described a directory in the plan's original authoring workspace (`/home/svnbjrn/rsrch/projects-mrgr`, now abandoned); it has no counterpart to avoid here. Kept for provenance; treat as not-applicable to this repo.
7. **`semantic-merge/docs/M1a-evidence-bundles.md`** claiming "Completed" is superseded by the corpus-review addendum.
8. **`projects-mrgr/experiment/docs/M0.md`** is a misplaced duplicate of an M1a narrative and is not independent evidence. (This path is in the old, now-abandoned `projects-mrgr` workspace, not in this repo.)

A behavior claim is not current truth until the changed path has run and its output is preserved. A plan, memory line, repeated result, or passing schema check is not a substitute.

---

