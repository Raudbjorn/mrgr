# mrgr — Canonical Planning Document: INDEX

**This file no longer holds the plan body.** The plan was split into
`phase-*/` and `reference/` directories on 2026-08-30 so a reader (human or
`/plan`) can open only the section relevant to current work instead of an
855-line single file. Every heading from the prior single-file version
exists in exactly one place below — nothing was deleted, only relocated.
Original `§N` numbers are preserved verbatim inside each file (headings were
not renumbered) because other files in this repo cite them by number (e.g.
`docs/planning/m1a-p0-implementation-plan.md` cites "§1.3";
`evidence/h0/REVIEW-2026-08-29.md` cites "§3.4"). Use the table below to
resolve any `§N` you find quoted elsewhere back to a file.

*Last split:* 2026-08-30. *Last content update:* 2026-09-13 (Phase 3 closure and gate retirement indexed; Mercury follow-up complete; local GPT-OSS follow-up closed incomplete by the user; confirmation and LoRA designs indexed; Phase 4 complete and Phase 5 fresh reconstruction proved locally).

---

## Working on something? Start here.

| If you're working on... | Read |
| --- | --- |
| M0 (`@mrgr/core` extraction, publication) | `notes/m0.md` |
| M1a (schema, persistence, `mrgr-db/2`) | `notes/m1a.md` |
| H0 (evidence-utility discriminator) | `notes/h0.md` |
| M2a (merge mechanisms) — **port complete, evidence available** | `notes/m2a.md` |
| Resurrection proof — **follows Phase 4; read first** | `notes/resurrection.md` |
| M1b/M2b/M3/M4/Replay/Agent adapter (future work) | `notes/future-work.md` |
| Anything, every session | `phase-0-frame-and-status/` (both files) |

Each `notes/<x>.md` is a routing card — pointers to the phase files plus the
specific `reference/` rows relevant to that phase, not a copy of their
content. If a notes file and the file it points to disagree, the pointed-to
file wins; notes files carry no state of their own.

## Read this first

- **Binding ordering rule (was §6 intro):** *"The ordering is binding: a unit
  that depends on a prior unit's frozen artifact may not start until the
  prior unit's gate has been re-run and its output is preserved."* This
  governs every `work-package*.md` file below — do not start a phase-N work
  package until the phase it depends on (per `reference/dependency-graph.md`)
  has a closed gate.
- **`phase-0-frame-and-status/`** is the only directory meant to be read on
  *every* session regardless of which milestone you're working — it carries
  workspace/version pinning, authority/supersession rules, and the
  answer-first verdict table.
- **Phase 3 is closed; positivity is not required for the handoff.** Read its [current state](phase-3-h0-evidence-utility/current-state.md), [closure certificate](phase-3-h0-evidence-utility/phase-3-closure-certificate.md), and [gate retirement / decision register](phase-3-h0-evidence-utility/gate-retirement-2026-09-07.md). The binary `MEASURABLE` gate was retired on September 7; earlier YES/NO wording is historical. The preserved v2 result and closed behavioral studies remain distinct from later exploratory follow-ups.
- **Local GPT-OSS follow-up: closed incomplete, do not resume.** The user terminated it on September 12 after an environment-inventory check stopped execution for approximately 17 hours without effective notification. [The partial closure](../../../evidence/h0/v3-local-gpt-oss-threads12-2026-09-09/PARTIAL-RESULT.md) preserves 782/1,440 completed requests: candidates passed 132/391; hunk-only passed 98/391; 658 requests were not executed. The observed +8.70 percentage-point difference is descriptive, not a completed hypothesis test, confirmation, or a new phase gate. Original receipts and failure records remain preserved.
- **Phase sequence remains Phase 3 → Phase 4 → Phase 5.** The [execution contract / Phase 4 handoff](phase-3-h0-evidence-utility/execution-and-handoff-2026-09-06.md) permits deterministic Phase 4 work regardless of H0 positivity. Phase 4's port and residue freeze are [complete](phase-4-m2a-mechanisms/current-state.md); [Phase 5 fresh reconstruction](phase-5-resurrection-proof/current-state.md) is complete as of September 13: two exact replays, four candidates totaling 949,331 bytes, and an explicit post-edit absence proof with all other tree entries unchanged. Each phase's current-state file wins over historical summaries; the local run's September 12 closure supersedes its earlier continuation and monitoring notes.

---

## Directory map

### `phase-0-frame-and-status/` — governance and current verdict, read every session
| File | Covers (orig. §) |
| --- | --- |
| `frame-lock-and-authority.md` | §1 Frame lock and authority: workspace/timestamp (§1.1), pinned versions (§1.3), authority/supersession rules (§1.5). Trimmed 2026-08-30 — §1.2 (framing pushback) and §1.4 (artifact scope) moved to `reference/framing-pushback-and-scope.md`, since neither is needed for a routine "what's next" read. |
| `answer-first-verdict.md` | §2 Answer-first current verdict (top-line Q&A table) |

### `phase-1-m0-core-extraction/` — `@mrgr/core` extraction, publication gate
| File | Covers (orig. §) |
| --- | --- |
| `current-state.md` | §3.1 M0, §3.2 M0-closure, §3.3 F1 exact-localization fix |
| `work-package.md` | §6 WP0 — M0-closure durable artifact and doc correction |
| `publication-rights.md` | §9 M0 publication-rights disposition |

### `phase-2-m1a-persistence/` — schema/persistence/identity work (`mrgr-db/2`)
| File | Covers (orig. §) |
| --- | --- |
| `current-state.md` | §3.5 M1a — evidence bundles and census plumbing |
| `work-packages.md` | §6 WP1 (P0 schema honesty) + WP2 (P1 load-bearing tests) — both DONE |
| `requirements.md` | §8 M1a schema/persistence/identity/error/test requirements |

### `phase-3-h0-evidence-utility/` — closed studies, decision records and follow-up designs
| File | Covers (orig. §) |
| --- | --- |
| [current-state.md](phase-3-h0-evidence-utility/current-state.md) | §3.4 H0 — closed studies, current decisions and the incomplete local GPT-OSS follow-up |
| `work-packages.md` | §6 WP3 (redesign) + WP4 (execution); 2026-09-06 amendment supersedes the old instrument |
| `redesign-requirements.md` | §7 H0 requirements; current amendment plus historical specification |
| `execution-and-handoff-2026-09-06.md` | Active contract, source research, new data, evidence threshold, reproducibility and Phase 4 implementation steps |
| [research-report-2026-09-06.md](phase-3-h0-evidence-utility/research-report-2026-09-06.md) / [HTML edition](phase-3-h0-evidence-utility/research-report-2026-09-06.html) | Preserved v2 research report and limitations |
| [research-report-v3-2026-09-06.md](phase-3-h0-evidence-utility/research-report-v3-2026-09-06.md) | Historical behavioral-extension research, acquisition rounds and contrast-review findings; running/paused notices are superseded by current state |
| [gate-retirement-2026-09-07.md](phase-3-h0-evidence-utility/gate-retirement-2026-09-07.md) | Authoritative retirement of the binary MEASURABLE gate; terminal findings and decision rules |
| [decision-register.json](phase-3-h0-evidence-utility/decision-register.json) | Machine-readable decisions that depend on findings |
| [phase-3-closure-certificate.md](phase-3-h0-evidence-utility/phase-3-closure-certificate.md) | Falsifiable closure certificate and executable verification entry point |
| [state-history-through-2026-09-07.md](phase-3-h0-evidence-utility/state-history-through-2026-09-07.md) | Preserved state history; not current execution instructions |
| [confirmation-study-design-2026-09-07/README.md](phase-3-h0-evidence-utility/confirmation-study-design-2026-09-07/README.md) | Fresh-cohort confirmation design, not an executed or authorized study |
| [confirmation-study-design-2026-09-07/acquisition-feasibility.md](phase-3-h0-evidence-utility/confirmation-study-design-2026-09-07/acquisition-feasibility.md) | Acquisition feasibility and constraints for that design |
| [confirmation-study-design-2026-09-07/decisions-required.md](phase-3-h0-evidence-utility/confirmation-study-design-2026-09-07/decisions-required.md) | Explicit decisions required before executing confirmation |
| [lora-experiments-2026-09-08/README.md](phase-3-h0-evidence-utility/lora-experiments-2026-09-08/README.md) | Adapter experiment designs; no training performed; its contemporaneous local-benchmark status is superseded by the September 12 closure |
| [lora-experiments-2026-09-08/compatibility-receipt.json](phase-3-h0-evidence-utility/lora-experiments-2026-09-08/compatibility-receipt.json) | Read-only A770/software compatibility audit; GPT-OSS training on this machine remains unverified |
| `SIGNIFICANCE-…` (in `evidence/h0/`, not this tree) | Historical enum-only gate: test, verdict, and why its grader made success impossible |
| `historical-2026-08-29-execution-record.md` | §23 — **superseded** 2026-08-29 broken-PRNG/single-repository run. Historical only; do not read as current H0 status. Current status is `current-state.md`. |

### Phase 3 evidence and follow-up documentation outside the planning tree

These are linked records, not amendments implied by their presence in this index. Keep the separately frozen runs separate; do not pool their settings or treat repeated observations of the same 60 Go cases as new independent cases.

| Record | Status / purpose |
| --- | --- |
| [Repaired-development finding](../../../evidence/h0/v3-repaired-development-2026-09-07/FINDING.md) | Completed 1,080-request study; no demonstrated benefit, confirmation stopped |
| [Candidate-repair finding](../../../evidence/h0/v3-candidate-repair-2026-09-07/FINDING.md) / [environment amendment](../../../evidence/h0/v3-candidate-repair-2026-09-07/ENVIRONMENT-AMENDMENT-1.md) | Completed exploratory study and documented package-drift verification |
| [Final Mercury protocol](../../../evidence/h0/v3-mercury-final-2026-09-07/PROTOCOL.md) / [finding](../../../evidence/h0/v3-mercury-final-2026-09-07/FINDING.md) | Authorized follow-up completed September 8; no demonstrated mean benefit under its frozen terminal rule; supersedes earlier descriptions of this follow-up as unrun |
| [Initial local GPT-OSS protocol](../../../evidence/h0/v3-local-gpt-oss-2026-09-08/PROTOCOL.md) | Historical initial local profile |
| [Local restart protocol](../../../evidence/h0/v3-local-gpt-oss-restart-2026-09-08/PROTOCOL.md) / [configuration audit](../../../evidence/h0/v3-local-gpt-oss-restart-2026-09-08/CONFIGURATION-AUDIT.md) | Historical restart profile and actual server-configuration audit |
| [High-effort protocol](../../../evidence/h0/v3-local-gpt-oss-high-2026-09-08/PROTOCOL.md) | Separate historical high-effort profile |
| [Transport-repaired protocol](../../../evidence/h0/v3-local-gpt-oss-high-transport-2026-09-08/PROTOCOL.md) / [monitoring decision](../../../evidence/h0/v3-local-gpt-oss-high-transport-2026-09-08/monitoring-decision-2026-09-08.md) | Native HTTP transport profile and historical monitoring/continuation decision; not authority to restart the closed run |
| [12-thread protocol](../../../evidence/h0/v3-local-gpt-oss-threads12-2026-09-09/PROTOCOL.md) / [restart-recovery amendment](../../../evidence/h0/v3-local-gpt-oss-threads12-2026-09-09/RECOVERY-AMENDMENT.md) | Frozen local comparison and explicit operational amendment; server retry recovery did not prevent the later inventory-check stoppage |
| [Partial result and closure](../../../evidence/h0/v3-local-gpt-oss-threads12-2026-09-09/PARTIAL-RESULT.md) | **Terminal September 12 record: closed incomplete by user, do not resume**; outcomes, missing evaluations, operational failure and interpretation limits |
| [Partial result ledger](../../../evidence/h0/v3-local-gpt-oss-threads12-2026-09-09/PARTIAL-RESULT.json) / [artifact hashes](../../../evidence/h0/v3-local-gpt-oss-threads12-2026-09-09/PARTIAL-ARTIFACT-HASHES.json) / [recording script](../../../evidence/h0/v3-local-gpt-oss-threads12-2026-09-09/record-partial.mjs) | All 1,440 scheduled slots accounted for, original evidence integrity and reproducible receipt verification without inference |

### `phase-4-m2a-mechanisms/` — merge-mechanism port (`@mrgr/mechanisms`)
| File | Covers (orig. §) |
| --- | --- |
| `current-state.md` | §3.6 M2a — mechanisms, statuses, determinism |
| `work-package.md` | §6 WP5 — M2a port (parallelizable with the H0 rerun) |
| `boundaries.md` | §10 M2a / Round 5.1 boundaries and prerequisites |

### `phase-5-resurrection-proof/` — the project's stated reason to exist
| File | Covers (orig. §) |
| --- | --- |
| [current-state.md](phase-5-resurrection-proof/current-state.md) | §3.7 Resurrection proof — fresh reconstruction complete locally, 2026-09-13 |
| [work-package.md](phase-5-resurrection-proof/work-package.md) | §6 WP6 — completed fresh reconstruction, historical audits preserved |
| [Fresh proof and reproduction](../../../evidence/resurrection/2026-09-13/README.md) / [result](../../../evidence/resurrection/2026-09-13/result.json) / [manifest](../../../evidence/resurrection/2026-09-13/manifest.json) | Two isolated exact replays, input-history candidate derivation, 949,331-byte accounting, post-edit zero candidates and diagnostic provenance |

### `phase-6-future-work/` — gated, not started
| File | Covers (orig. §) |
| --- | --- |
| `current-state.md` | §3.8 M1b / M2b / M3 / M4 / Replay / Agent adapter |
| `work-packages.md` | §6 WP7 (M1b/M2b/M3/M4/Replay) + WP8 (Agent adapter — **retired 2026-08-30**) |

### `reference/` — cross-cutting material, not tied to one phase
| File | Covers (orig. §) |
| --- | --- |
| `framing-pushback-and-scope.md` | §1.2 Phase 0.5 framing pushback + §1.4 artifact scope — authoring-time rationale, moved out of phase-0 on 2026-08-30 (not needed for routine reads) |
| `decisions.md` | §4 Decisions already settled vs. still gated |
| `dependency-graph.md` | §5 Dependency graph and critical path (unclosed code fence from the original fixed during the split) |
| `risk-register.md` | §11 Risk register |
| `evidence-ledger.md` | §12 Evidence ledger (for `/plan` traceability) |
| `completion-definition.md` | §13 Completion definition |
| `non-goals.md` | §14 Explicit non-goals |
| `self-attack.md` | §15 Self-attack (Phase 4) |
| `committed-recommendations.md` | §16 Committed recommendations (Phase 5) |
| `open-questions.md` | §17 Open questions for the human — **check here before assuming any gated decision has been made** |
| `critical-files.md` | §18 Critical files — **restructured 2026-08-30** from a flat "read all 17 before starting" list into a table scoped by task type (M0 work reads the M0 rows, H0 work reads the H0 rows, etc.) |
| `sources.md` | §19 Sources (canonical for `/plan`) |
| `verification-leads.md` | §20 Verification leads for low-confidence / `[UNVERIFIED]` items |
| `meta-observation.md` | §21 Meta-observation (why the discipline in this corpus exists) |
| `parking-lot.md` | §22 Parking lot |
| `session-close-2026-08-29.md` | §24 Session close summary (2026-08-29T07:42Z) |

### `notes/` — per-phase routing cards (2026-08-30)
One short file per phase/feature, each pointing to its phase files plus the
specific `reference/` rows relevant to that work — not a copy of their
content. See the table at the top of this index ("Working on something?
Start here"). Files: `m0.md`, `m1a.md`, `h0.md`, `m2a.md`, `resurrection.md`,
`future-work.md`.

### `foundations/` — unchanged by this split
Pre-measurement research proposal and WP-numbering disambiguation (three
unrelated "WP0"s across the corpus). See `foundations/README.md`.

---

## Provenance note

Each split file opens with a one-line breadcrumb back to this index (shortened
2026-08-30 from a 40-word explanation to one line, re-read on every file open
so it stays terse). Content inside each file is byte-identical to the
corresponding lines of the prior single-file document as of the 2026-08-30
split (verified by line-range diff at split time), except:
the code fence in `reference/dependency-graph.md` was closed (it was
unclosed in the original, which would have swallowed every following
section into one code block under strict CommonMark rendering), and the
horizontal-rule (`---`) separators between original sections were dropped
since each section is now its own file.

**Historical fact-check snapshot, 2026-08-30 (later phase amendments supersede blockers below):** M0, M1a, H0, M2a,
resurrection, and future-work phases are now verified against the actual
repo (git objects, file existence, test counts) — each carries its findings
inline, including two real blockers the original plan didn't name: the
Round 5.1 M2a source isn't in this repo (`notes/m2a.md`), and the
resurrection proof's five reconstruction refs aren't reachable in this
repo's git history (`notes/resurrection.md`). **Not yet independently
re-verified:** the remaining `reference/` files not already touched by a
correction note (`self-attack.md`, `meta-observation.md`, `parking-lot.md`,
`sources.md`, `completion-definition.md`, `non-goals.md`) — these were
spot-checked (one citation in `decisions.md` confirmed against `PLAN.md`)
but not exhaustively.
