*Part of the [canonical planning document](../canonical-final-planning-document.md).*

## 12. Evidence ledger (for `/plan` traceability)

| H0-R3 | **Fresh RUN VALID** (2026-08-30, user-confirmed — supersedes the "Binding invalidity" language once carried in §3.4): H0-R3 | Fresh RUN VALID: 540 records across three repositories/two languages; PRNG, citation, and adjudicator gates closed; full-bundle beats hunk-only by 10.060pp, exceeding approved >5pp threshold. Three records emitted citation tags with non-canonical formatting (leading-space source tags, bare side label); these are presentation-format concerns, not measurement failures, and do not invalidate the run. | evidence/h0/REVIEW-2026-08-30T02-54-42-056Z.md; evidence/h0/aggregate-2026-08-30T02-54-42-056Z.json |
| H0-R2 | Historical 2026-08-29 run: invalid; broken PRNG and single-repository sample. Superseded for current status by H0-R3. | evidence/h0/REVIEW-2026-08-29.md |
| M0-E1 | clean-clone install / typecheck / 120 tests / build / carried-file verification / negative self-test / CLI smoke all PASS | `phases/m0/closure-evidence.md` |
| M0-E2 | **Superseded 2026-08-30 (verified on disk):** rights attestation IS now recorded in `NOTICE` ("Attested by the author, 2026-08-27"); publication is not blocked on this. `NOTICE.snapshot` (below) is the *pre-correction* capture, not current state. (`STATUS.md` caveat: §1.5 rule 2.) | `.do-not-commit/planning/phases/m0/NOTICE.snapshot` (historical); `NOTICE` (current) |
| F1-E1 | diff3 fix at `ed92803`; 0 → 377 exact regions on `jqlang/jq` | `findings/F1-exact-localization-unreachable.md`; `phases/m0/F1-exact-localization-unreachable.md` |
| M1a-R1 | hermetic fixture + raw `scan-local` assertions pass | `phases/m1a/integration-tests-plan.md` |
| M1a-R2 | preimage contract truncated at 1,200 UTF-16 code units; byte count must come from `Buffer.byteLength(original, "utf8")` | `phases/m1a/integration-tests-plan.md`; `src/forensic/core.ts:5,13,27-52` |
| M1a-R3 | structural-honesty test does not assert preimage-vs-hunk inequality or plausible size | `phases/m1a/integration-tests-plan.md` |
| M1a-R4 | `parseCorpusRecord` drops `evidenceBundles`; CLI test casts `JSON.parse` | `phases/m1a/integration-tests-plan.md` |
| M1a-R5 | `dependency_graph` mixes hunk payloads with path entries | `phases/m1a/integration-tests-plan.md` |
| M1a-R7 | nullable stages required by WP0 merge-replay semantics | `phases/m0/wp0-merge-replay.md:51-54,67` |
| M1a-R8 | `types.ts` and `corpus.ts` are schema authorities | `local/semantic-merge-consolidation-research/phase1-assets-and-seams.md:32,38` |
| M2a-S1 | Round 5.1 adapter / preflight / schedule / adjudicator implemented; preflight PASS | `sources/sessions/fork-composition-round5-1-…md`; `MECHANISM-PREFLIGHT.json` |
| M2a-S2 | `FRAME-LOCK.md` invalidated; post-freeze contract drift + missing immutable `MODEL_BUILD` | `sources/sessions/fork-composition-round5-1-…md`; `MODEL-BUILD-FRAME-MISMATCH.json` |
| M2a-S3 | zero arms launched; no mechanism/topology result | `sources/sessions/fork-composition-round5-1-…md` |
| LIT-1 | Rover (arXiv:2605.17279v1) and ConGra (arXiv:2409.14121v1): selected/dependency context helps; naïve adjacent context usually hurts | `research/adjudication-literature.md` |
| LIT-2 | Merge-Bench (arXiv:2605.25890v1) is test-free; metric is normalized source-text match, not semantic correctness; use companion README's labels, not arXiv HTML table captions | `research/adjudication-literature.md` |
| LIT-3 | AgenticFlict (arXiv:2604.03551v2, AIware'26 DOI `10.1145/3805760.3814923`) is `git merge --no-commit --no-ff` + marker parsing — textual only | `research/adjudication-literature.md` |
| LIT-4 | Two distinct 79.4% figures: PLAN.md's Codex share (23,520/29,609 = 79.44% conflict share; 73,856/107,026 = 69.01% PR share) is arithmetically valid; Xu et al. (arXiv:2607.04697v2) report a different 79.4% (26,691/33,596 of all agent PRs co-active with another agent PR at k=0) | `research/adjudication-literature.md`; `PLAN.md` |
| LIT-5 | SAM (JSS 214:112070), TOM/MCon4J (SCIS 65:199103) implement parent-side behavioural predicates; union oracle is **not novel at the mechanism level**, may be novel at the integration | `research/adjudication-literature.md`; `reviews/mrgr-agent-harness-plan-critique.md` |
| MM-1 | Mergiraf v0.19.0 = commit `7246b03c08c02248035bc20668fde1edf94a09e0`; "discarded" means *not surfaced*, not *destroyed*; in-core blobs may remain reachable | `research/mergiraf-mechanism.md`; `merge-ort.h` |
| MM-2 | `merge.default=mergiraf` is valid configuration but not the recommended one; per-attribute `merge=mergiraf` + `merge=binary` macro removes the D79 failure class at configuration level | `research/mergiraf-mechanism.md` |
| MM-3 | status capture must record all four layers (raw `git merge-file`, Mergiraf, low-level driver, outer Git) separately | `research/mergiraf-mechanism.md`; PLAN.md §3 |
| STALE-2 | `semantic-merge/docs/M1a-evidence-bundles.md` says "Completed"; superseded by `phases/m1a/integration-tests-plan.md` corpus-review addendum | `STATUS.md` |
| STALE-3 | `projects-mrgr/experiment/docs/M0.md` is a misplaced M1a duplicate; not independent evidence | `SOURCES.md` |

