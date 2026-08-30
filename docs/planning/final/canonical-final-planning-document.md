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

*Last split:* 2026-08-30. *Last content update before the split:* 2026-08-30
(fresh H0 rerun closure).

---

## Working on something? Start here.

| If you're working on... | Read |
| --- | --- |
| M0 (`@mrgr/core` extraction, publication) | `notes/m0.md` |
| M1a (schema, persistence, `mrgr-db/2`) | `notes/m1a.md` |
| H0 (evidence-utility discriminator) | `notes/h0.md` |
| M2a (merge mechanisms) — **blocked, read first** | `notes/m2a.md` |
| Resurrection proof — **blocked, read first** | `notes/resurrection.md` |
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
- **H0 is VALID; WP0 is 3/4 done; M1a's persistence layer is not on `main`.**
  Current state for all three lives at point of use — §3.4, §3.1/§3.2, §3.5
  respectively — not summarized here to avoid a second copy going stale. If
  you find text elsewhere still contradicting these, it's the stale copy —
  the phase-N `current-state.md` file wins (§1.5 rule 2, which also covers
  the `STATUS.md`/`SOURCES.md` caveat — read that one rule, not scattered
  mentions of it).

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

### `phase-3-h0-evidence-utility/` — does selected evidence help adjudication?
| File | Covers (orig. §) |
| --- | --- |
| `current-state.md` | §3.4 H0 — evidence-utility discriminator (current 2026-08-30 verdict) |
| `work-packages.md` | §6 WP3 (H0 redesign) + Work package 4 (H0 rerun) |
| `redesign-requirements.md` | §7 H0 redesign requirements (the 5 defects, addressed by construction) |
| `historical-2026-08-29-execution-record.md` | §23 — **superseded** 2026-08-29 broken-PRNG/single-repository run. Historical only; do not read as current H0 status. Current status is `current-state.md`. |

### `phase-4-m2a-mechanisms/` — merge-mechanism port (`@mrgr/mechanisms`)
| File | Covers (orig. §) |
| --- | --- |
| `current-state.md` | §3.6 M2a — mechanisms, statuses, determinism |
| `work-package.md` | §6 WP5 — M2a port (parallelizable with the H0 rerun) |
| `boundaries.md` | §10 M2a / Round 5.1 boundaries and prerequisites |

### `phase-5-resurrection-proof/` — the project's stated reason to exist
| File | Covers (orig. §) |
| --- | --- |
| `current-state.md` | §3.7 Resurrection proof |
| `work-package.md` | §6 WP6 — Resurrection proof |

### `phase-6-future-work/` — gated, not started
| File | Covers (orig. §) |
| --- | --- |
| `current-state.md` | §3.8 M1b / M2b / M3 / M4 / Replay / Agent adapter |
| `work-packages.md` | §6 WP7 (M1b/M2b/M3/M4/Replay) + WP8 (Agent adapter) |

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

**Fact-check status against disk, updated 2026-08-30:** M0, M1a, H0, M2a,
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
