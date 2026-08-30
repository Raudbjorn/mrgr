*Part of the [canonical planning document](../canonical-final-planning-document.md).*

## 19. Sources (canonical for `/plan`)

Paths below are relative to `.do-not-commit/planning/` unless given as a full absolute path or a URL.

**`.do-not-commit/planning/` is gitignored (verified 2026-08-30 — `git ls-files .do-not-commit/` returns zero tracked files).** These paths resolve on a machine that has that local, untracked directory populated; they do **not** exist in a fresh clone, in CI, or for a PR reviewer. Confirmed independently by CodeRabbit's own sandbox check on this PR. Treat S5–S19 as local-only references, not as artifacts this repository ships.

| ID | Path or URL | Use |
|---|---|---|
| S1 | `PLAN.md` (SHA-256 `93e13342577876a7504188d6756ed932149e944f9309ae5eb30d48f57d846216`) | Canonical sequence |
| S2 | `STATUS.md` (caveat: §1.5 rule 2) | Historical/superseded |
| S3 | `SOURCES.md` — this file (`reference/sources.md`) is the current provenance manifest | Historical only |
| S4 | `canonical-plan-source.md` (SHA-256 `3baa199c2ee4a3f4908e9648262c48197487a2ece40ca118549cc91493cee4ff`) | Content copy of plan-mode file |
| S5 | `phases/m0/closure-evidence.md` | M0 closure evidence |
| S6 | `phases/m0/NOTICE.snapshot` | Pre-correction NOTICE capture (historical — current `NOTICE` already has the rights attestation, see `phase-1-m0-core-extraction/current-state.md`) |
| S7 | `phases/m0/README.snapshot.md` | Pre-correction README capture (historical — current `README.md` is already corrected) |
| S8 | `phases/m0/scope-and-verdict.md` | WP0 claim boundary |
| S9 | `phases/m0/wp0-measurement.md` | WP0 measurement spec |
| S10 | `phases/m0/wp0-merge-replay.md` | WP0 Git replay source note |
| S11 | `phases/m0/F1-exact-localization-unreachable.md` | F1 finding (carried copy) |
| S12 | `phases/h0/discriminator-plan-original.md` | H0 historical plan (superseded) |
| S13 | `phases/m1a/integration-tests-plan.md` | M1a governing plan |
| S14 | `phases/m2a/round5-merge-mechanism-refreeze-plan.md` | M2a plan |
| S15 | `reviews/mrgr-agent-harness-plan-critique.md` | Adversarial critique |
| S16 | `research/adjudication-literature.md` | H0 / M3 literature |
| S17 | `research/mergiraf-mechanism.md` | M2a / Mergiraf status semantics |
| S18 | `findings/F1-exact-localization-unreachable.md` | F1 finding pointer |
| S19 | `sources/sessions/fork-composition-round5-1-merge-mechanism-refreeze-git-text-gnu-diff3-mergiraf-18-arms-post-freeze-drift-immutable-model-build-unavailable-frame-mismatch-20260826.md` | Round 5.1 session record |
| S20 | arXiv:2605.25890v1 (Merge-Bench); dataset `merges.tar.gz` SHA-256 `4f0b63409776c7d987b808dd85959c40a09160c6f155381b66a9ed8356ea6ff8`; companion `benedikt-schesch/Merge-Bench` @ `4860bea020e3fc0af31fff8d58e5b822be822222` | Merge-Bench |
| S21 | arXiv:2604.03551v2 (AgenticFlict); AIware'26 DOI `10.1145/3805760.3814923`; source `unlv-evol/AgenticFlict` @ `e050289d12c37d90e81f90886a0ecde9a683385a`; Zenodo `10.5281/zenodo.20118379` md5 `1d6b79f1fed77c39e195b116cd2ad46d` | AgenticFlict |
| S22 | arXiv:2605.17279v1 (Rover) | Rover |
| S23 | arXiv:2409.14121v1 (ConGra) | ConGra |
| S24 | arXiv:2607.27674v1 (ConflictAgent); repo `UBOWENVT/ConflictAgent` | ConflictAgent |
| S25 | Xu, Subramanian & Karthik, arXiv:2607.04697v2 | Co-activity 79.4% (distinct from AgenticFlict's share) |
| S26 | JSS 214:112070 (SAM) | SAM union predicate |
| S27 | SCIS 65:199103 (TOM/MCon4J) | TOM union predicate |
| S28 | `sources/remember/today-2026-08-26.md` (stale, superseded) | Historical positive H0 claim |
| S29 | `sources/remember/recent.md` | Historical navigation aid |
| S30 | `/home/svnbjrn/rsrch/semantic-merge/evidence/h0/REVIEW-2026-08-27.md` (absolute — outside `.do-not-commit/planning/`) | H0 independent review source |

