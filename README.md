# mrgr

**Evidence, verification and provenance for fork-scale merges.**
Bring your own adjudicator — human, script, or agent.

---

## What this is, and what it is not

**mrgr does:** localize conflicts deterministically across a fork; assemble the evidence that decides a conflict, *including evidence outside the hunk*, with per-source provenance and retrieval status; run pluggable merge mechanisms recording every status layer; verify against declared gates, per-gate and baseline-normalized; audit what a merge **deleted**, independently of what it flagged; record every decision, halt and deferred contradiction as a replayable record.

**mrgr does not:** resolve conflicts; constrain an adjudicator that has other write paths; claim semantic correctness; infer intent; prove that tests cover preserved features; measure historical conflict incidence; replace a merge queue.

> **mrgr does not prevent a bad decision. It makes the decision, its inputs, and its omissions inspectable.**

That is the honest ceiling. An adjudicator with ordinary shell and Git access can edit the tree directly and submit a valid record afterwards; mrgr would not notice. Real enforcement needs an exclusive acceptance boundary, which does not exist here and is not currently being built.

## Why a harness

Merge tools are pure functions of two files. For a conflict where both sides are comparable in scope, the information that decides it is often not in either file — it is in the commit messages, linked issues, the test suite, and the base-to-tip diff on both branches. Whether feeding that to an adjudicator actually helps is an **open question this project treats as a hypothesis, not a premise** (see *Open questions* below): dependency-*selected* context has been shown to help, while naïvely appended adjacent context usually makes LLM resolution worse.

What is not in question is that fork-scale merges fail in ways nothing currently reports. On real long-diverged forks:

- **Structured merge tops out near half, and drops as the fork ages.** On a fork pair with **3,382 both-changed paths** (of **14,853** changed on either side), `git ort` auto-merged 39.95% and Mergiraf 52.07%. Of the 1,621 residue paths, **774 (47.7%) are in classes no content merger can touch** — Mergiraf cleared 0 of 494 modify/delete, 0 of 14 file-location, 0 of 5 rename/delete.
- **A green oracle can be actively misleading.** One N-way composition silently resurrected four deleted test monoliths — **949,331 bytes, zero conflict markers**. It compiled, linted and passed. The only defence that worked was auditing what the merge *deleted*, independently of what it reported.
- **A conflict count is not a completeness signal.** 62% of sampled conflicted files carried fork-only content merged cleanly *outside* every conflict region.
- **The test suite does not constrain deferred contradictions by default.** Seam-scoped mutation found 5 of 6 policy-default constants surviving replacement with `""` — four behaviour-changingly, with no test failing.

mrgr records each of those mechanically: counts come from parsed, deduplicated sets and never from `wc -l` of human-readable output; the resurrection audit derives candidates from the deleted-set relation rather than the merge's own conflict report; deferring a contradiction requires a pinning test that a mutation run actually kills; halt is a first-class outcome reported in its own column, never folded into success or failure.

## Status

Pre-alpha and honest about it. One package exists; part of it is unfinished.
The one experiment that has run returned a null and retired the component it
gated. Everything else is gated on evidence, not scheduled.

| Component | State |
|---|---|
| `@mrgr/core` — replay, localization, classification, corpus, materialize | **works**: 12 modules carried verbatim from the WP0 instrument, 120 tests, dependency-free |
| `@mrgr/core` — M1a evidence bundles (`src/m1a/`) | **P0 complete**: one bundle per conflict region keyed `path` + `ordinal`, uncapped preimages with byte-accurate sizes, null for an absent side, append-only sidecar with fail-closed reads and per-region resume. 24 tests. P1/P2 open — see below. |
| survey / merge-base census (M1a) | next |
| `@mrgr/mechanisms` — `git_text` \| `gnu_diff3` \| `mergiraf` | gated |
| `@mrgr/ledger` — decision \| halt \| debt \| resurrection | gated |
| `@mrgr/oracle` — per-gate vector, baseline, multi-axis reporting | gated |
| entity extraction | gated on its own boundary-quality study |
| agent adapter (MCP and friends) | **retired** — H0's acceptance gate was not met; see *H0 result* below |

## H0 result (frozen 2026-08-30)

H0 asked whether evidence selected from outside the conflict hunk helps an
adjudicator decide a merge conflict. **The answer on this corpus is no, and the
experiment cannot currently answer it any other way.** Full detail:
[`evidence/h0/SIGNIFICANCE-2026-08-30T02-54-42-056Z.md`](evidence/h0/SIGNIFICANCE-2026-08-30T02-54-42-056Z.md).

**Corpus.** 30 conflict triples, stratified 10 `jqlang/jq` + 10 `cli/cli` + 10
`redis/redis` — three repositories, two languages (C and Go) — drawn from a
frozen 1,050-triple corpus. 3 repeats per triple at temperatures 0.0 / 0.5 /
0.9, six arms, 540 records. Adjudicator: `qwen2.5-coder-7b-instruct-q6_k` on
local `llama-server`, pinned by GGUF SHA-256 and verified before execution.

| arm | correct | wrong | halt | token cost | historical match (triples) | gate outcome |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| hunk-only | 20 | 56 | 10 | 52,154 | 7 / 30 | not met (Δ −2, p = 0.50) |
| selected | 22 | 53 | 12 | 64,033 | 8 / 30 | not met (Δ −1, p = 1.00) |
| full-bundle | 13 | 49 | 27 | 127,645 | 4 / 30 | not met (Δ −5, p = 0.06) |
| baseline-keep_ours | 21 | 69 | 0 | 0 | 7 / 30 | trivial |
| baseline-keep_theirs | 9 | 81 | 0 | 0 | 3 / 30 | trivial |
| baseline-compose | 27 | 63 | 0 | 0 | **9 / 30** | trivial (best) |

*correct/wrong/halt count records (n = 90 per arm); historical match and the
gate outcome are per triple (n = 30, majority of 3 repeats). Δ is the arm's
triple-correct count minus the best trivial baseline's; p is McNemar's exact
two-sided test at α = 0.05.*

**Verdict: null.** No arm is correct on more triples than constant `compose`.
Stronger than that: on every triple and every record, **every conflict an arm
got right, the constant also got right.** The only significant result is
full-bundle being *worse* than a constant (p = 0.0001).

**Derived break-even.** Halts are not free wins, but they are not wrong merges
either. On records valid in both arms, an arm is cheaper than `baseline-compose`
when one halt costs less than 0.600 (hunk-only), 0.583 (selected) or 0.481
(full-bundle) of one wrong merge. Those are plausible ratios. They are also
beaten by a policy that halts on everything, which makes zero wrong decisions
and scores **0.700** on the same measure — so these numbers rank every arm below
deciding nothing at all. That is the measure rewarding refusal, which is why it
is reported as characterization and not used to claim a pass.

**The instrument's ceiling, stated plainly.** The grader normalizes with
`replace(/\s+/g, "")`, which strips newlines, so its "shared line" test for a
composed resolution degenerates to string equality. `compose` is then correct
exactly when `keep_ours` or `keep_theirs` is — the union of both — making the
constant a mathematical upper bound on every arm, for any corpus. On this
corpus the developer's resolution matches a side verbatim on 9 of 30 triples;
**the remaining 21 are unwinnable by any decision the protocol allows.** So the
null is not evidence that evidence-conditioned adjudication fails. It is
evidence that this experiment, as instrumented, could not have shown that it
works.

**Consequence.** The agent adapter and a separate `@mrgr/evidence-bundle`
package are **retired** under the preregistered STOP rule ("a null H0 retires
the agent adapter and `@mrgr/evidence-bundle`; the forensic core ships alone").
They reopen on one named condition and no other: the grader's normalization is
fixed so a blended resolution can score as correct, the frozen corpus is re-run,
and an arm clears the gate on that data.

**What survives:** the corpus (1,050 unique triples across three repositories
and two languages), the run records, the pinned-model provenance, and the
resumable runner. **What does not:** any claim that selected evidence improves
adjudication. Every raw input, arm output and script is under
[`evidence/h0/`](evidence/h0/) so this is checkable rather than asserted.

### Earlier H0 runs

The 2026-08-27 first run was retracted outright — the developer's resolution,
the exact string the grader scores against, was interpolated into every arm's
prompt. The 2026-08-29 run was invalidated by a broken PRNG that collapsed the
sample to a single repository. Both are preserved, not deleted: see
[`evidence/h0/RETRACTION.json`](evidence/h0/RETRACTION.json) and
[`evidence/h0/REVIEW-2026-08-29.md`](evidence/h0/REVIEW-2026-08-29.md).

## M1a: what P0 fixed, and what is still open

Evidence bundles are persisted to a **sidecar** (`corpus.evidence.jsonl`), not
inline on `CorpusRecordV2`. That keeps schema v2 immutable and the carried set
byte-identical at 24 files, and lets evidence be regenerated or discarded
without touching a corpus.

Fixed, each with a test that fails without the fix:

- **Region identity.** One bundle per conflict region, keyed `conflict_path` +
  `conflict_ordinal` — the same key `ConflictRegionRecord` already uses, so a
  bundle joins 1:1 to a region. A file with three conflicts yields three
  bundles.
- **Real preimages.** Uncapped by default. The previous `CAP = 1200` was applied
  with `String.slice`, i.e. UTF-16 code units, so a field documented in bytes
  reported something else. Sizes now come from `Buffer.byteLength` of the
  *original*, and truncation is opt-in, flagged, and never splits a character.
- **`dependency_graph` is path-only.** Extra conflict regions used to be
  serialized into it as `` `+ours|base|theirs` ``. The schema now rejects any
  entry that is not a side-tagged path, and `dependency_graph_status`
  distinguishes "derived and empty" from "could not be derived".
- **Absent path is `null`, not failure.** A missing revision stays a typed
  error; a path simply not present in a parent is evidence.
- **Failures are recorded.** A failed extraction writes `status: "failed"` with
  its error. Absence of a row now means "not attempted"; it no longer doubles
  as "attempted and failed".
- **See [`docs/findings/F2`](docs/findings/F2-add-add-conflicts-unparseable.md)** —
  add/add conflicts were silently unparseable, because Git emits an *empty*
  base section and the section regex required a newline that an empty section
  does not have.

Still open: a runnable smoke over the committed H0 triples (P1.4), plus P2 —
materialization propagation and focused schema snapshots. Two further P1 items
are **void rather than deferred**: they target assertions in a file that was
never carried into this repo, and the sidecar decision means no bundle reaches
`parseCorpusRecord` at all. See
[`docs/adr/03-m1a-evidence-scope.md`](docs/adr/03-m1a-evidence-scope.md). The sidecar is not claimed to
be the final persistence design; moving bundles inline later is a schema
decision with a version bump.

## Try the evidence layer

```bash
pnpm install && pnpm -r build
node packages/core/bin/mrgr-wp0.mjs scan-local /path/to/repo --out corpus.jsonl
node packages/core/bin/mrgr-wp0.mjs report corpus.jsonl
node packages/core/bin/mrgr-wp0.mjs materialize corpus.jsonl --out evidence.jsonl
```

`report` states its denominators and says `historical conflict incidence: not measured`, because replaying history under a modern Git is not the same as observing it. That kind of line is the house style, not an omission.

## Scope of the evidence behind the method

The method mrgr encodes was validated on **one TypeScript/Electron codebase, n = 1**, five forks, one agent family, across four rounds. That study's own limits travel with this tool and are not softened here:

- A preregistered sequential-vs-N-way topology contrast returned a **null**, emitted verbatim by a script written before four of six arms existed. The round established that nothing displaced the null, not that it re-derived it.
- The resurrection-visibility result is **exploratory** — it was not preregistered.
- Auto-merge never reached the study's own ≥80% target in any round.
- No p-values, confidence intervals, or population inference exist anywhere in the corpus.
- **Cross-language generalization is untouched.** No Rust three-way conflict has ever been resolved by this pipeline.

**mrgr generalizes the harness. It does not generalize the result.**

Two approaches were tried and refuted, and are deliberately not built here: facade synthesis as a default unit (62 generated, 11 survived; on its best domain, 0 of 6 survived) and the `union` merge driver (88–96% of what it concatenated was resurrected base code; 21 of 24 audited files corrupt, 6 of those corruptions invisible to `tsc`).

## Open questions

Carried here rather than answered by assertion:

1. Does selected outside-hunk evidence improve adjudication at matched model and cost? Does an unfiltered bundle make it worse? **Measured once (H0, 2026-08-30) and returned null** — no arm beat a constant. That measurement is bounded by its grader, which cannot score a blended resolution as correct; see *H0 result* above. The question stands, the instrument does not yet answer it.
2. What are halt precision, recall, coverage, and expected utility — and at what wrong-vs-review cost ratio does halt pay for itself?
3. Can any tool-only boundary actually be enforced? Today: no.
4. Entity-boundary extraction quality, in any language.
5. Whether short-lived agent-PR conflict distributions transfer to long-lived forks.

### On the numbers people cite about this problem

Two figures motivate work in this area and are routinely quoted without their denominators. Stated properly:

- Merge-Bench reports frontier LLMs at **52.6% (all-language) to 62.5% (Java)** for Gemini. The metric is **normalized match to the developer's committed resolution** — not compilation, not semantic correctness, and the developer's own resolution is observed output rather than ground truth.
- AgenticFlict reports a **27.67% conflict rate = 29,609 of 107,026 successfully simulated** agent-authored pull requests (142,652 was the candidate set; 35,626 were excluded). One agent accounts for **79.4% of the conflicts** — and also **69.0% of the simulated PRs**, at a 31.85% conflict rate of its own. The concentration figure is not a defect rate.

## License

Apache-2.0. See [`LICENSE`](LICENSE) and [`NOTICE`](NOTICE).

`git` is required. `mergiraf` (**GPL-3.0-only**) and `diff3` are planned mechanisms and will be invoked as **external processes** over a file-and-exit-code contract — not linked, not vendored, not distributed with this project.
