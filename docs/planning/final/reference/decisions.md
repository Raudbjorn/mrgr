*Part of the [canonical planning document](../canonical-final-planning-document.md).*

## 4. Decisions already settled vs decisions still gated

### 4.1 Settled (do not re-open without new evidence)

| Decision | Choice | Source |
| --- | --- | --- |
| Product framing | Adjudicator-agnostic evidence/audit/provenance harness. Bring your own adjudicator (human, script, agent). | PLAN.md revision 2; corpus critique |
| Architecture | Schema-rejected records; independently recomputable evidence; gate vectors; resurrection audit from deleted-set; halt as first-class. **Corrected 2026-08-30:** the ledger's actual persistence is SQLite (`mrgr-db/2`, `packages/core/src/db/schema.ts`), not append-only JSONL directly — JSONL is transport/export (deterministic, canonical byte order) via `mrgr db import`/`export`, not the storage layer itself. This corrects the original PLAN.md-era design intent to match what shipped. | PLAN.md; `packages/core/src/db/schema.ts` |
| Package order | `@mrgr/core` first; everything else gated on evidence, not scheduled. | PLAN.md; STATUS.md |
| Mechanism M2a design | Three file-level content mechanisms (`git_text`, `gnu_diff3`, `mergiraf`) under fixed `ort`/`merge-tree` orchestration; resolution strategies are descriptive metadata, not a factor. | M2a plan §1; Round 5.1 session record |
| Status capture M2a | Record all four statuses separately: raw `git merge-file`, Mergiraf, low-level driver, outer Git. `Discarded` means *not returned as a usable result*, not *destroyed* — earlier in-core resolutions can remain reachable in the object DB. | `research/mergiraf-mechanism.md`; PLAN.md §3 D79 |
| `merge.default` choice | **Do not use `merge.default=mergiraf`.** Use per-attribute `merge=mergiraf` with explicit `merge=binary` macro for binary paths. This removes the class of failure D79 observed at the configuration level. | `research/mergiraf-mechanism.md` |
| M3 union semantics | Four axes, never one bit: side-A baseline-normalized test evidence · side-B baseline-normalized test evidence · composition-side baseline-normalized · human-checklist side. A fifth axis reports raw historical match — labelled **compatibility, not truth**. | PLAN.md §8; `research/adjudication-literature.md` |
| `debt` pattern | A named constant, a documented default, a test seam, and a **pinning test that never calls the seam and asserts a spelled-out literal**. | PLAN.md §7 |
| `halt` record | Reason and evidence required; denominators report `resolved / halted / failed / unsupported` separately. | PLAN.md |
| IDs in ledger | Content-derived or namespaced; never monotonic. | PLAN.md (D90 duplication) |
| Replay comparator | **Raw blob OID is primary pass signal**; normalized digest is descriptive, not binding. | PLAN.md §9; corpus critique |
| F1 reproducer | Conflict style opt-in via `ReplayOptions.conflictStyle`. Default behavior and `baselineId` unchanged. | findings/F1; closure evidence |

### 4.2 Still gated (do not pre-commit)

| Decision | Why gated |
| --- | --- |
| Whether selected evidence improves adjudication at matched model and cost | The old enum-only experiment could not answer this question. The [2026-09-06 concrete-output study](../phase-3-h0-evidence-utility/execution-and-handoff-2026-09-06.md) measures a frozen local-context policy with a fixed model and reported cost, not length-matched relevance or semantic correctness. Use its preserved result and uncertainty; a failed positive gate is inconclusive, not proof of no effect. |
| Whether halt precision/recall/expected utility pays for itself at any plausible wrong-vs-review cost ratio | The corrected H0 analysis reports break-even costs under explicit illustrative historical-disagreement/review losses. A real deployment loss and behavioral labels remain unestablished; this does not gate deterministic M2a. |
| Whether to ship MCP / Claude Code plugin / TypeScript API / four-surface parity | **No surface ships.** WP8 remains retired. Its old normalization-only repair condition is superseded by the concrete-output study; a valid positive can justify reconsideration, not a semantic-safety or deployment claim. |
| Which entity parser, native package, grammar, Node version, config | M1b, on frozen M2a residue, with hand-marked blind set ≥20 units / ≥2 languages |
| Whether the bundled-Mergiraf install path is required | M2a per-attribute setup is the recommended path; needs runtime confirmation on the target host |
| Whether `merge-tree` ever changes a non-binary path's status on identical input across `git_text`/`gnu_diff3`/`mergiraf` arms | M2a port, not the Round 5.1 source experiment |

---

