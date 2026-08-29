# Correspondence-First Semantic Merge

**A research proposal for agent-assisted conflict resolution grounded in anti-unification and theory colimits**

| | |
| --- | --- |
| Version | 0.1.0 (draft) |
| Date | 2026-08-25 |
| Status | Pre-measurement. No implementation commitment. |
| Working name | TBD |

---

## 0. Abstract

Automated merge conflict resolution is dominated by two families: textual
three-way merge (git), and structured merge over ASTs (3DM, JDime, Spork,
mergiraf). A third family is emerging — LLM agents — which currently resolve
under 60% of real-world conflicts correctly.

This proposal argues that all three families fail for the same reason, and that
the reason is not parsing, not tree matching, and not model capability. It is
that they conflate two distinct problems:

1. **Localization** — determining *which* parts of two edits are in
   correspondence and therefore contested.
2. **Adjudication** — determining *which* contested alternative is correct.

The central claim is that these problems have different mathematical
characters, different information requirements, and should be attacked by
different machinery. Localization is a structural problem, solvable by
anti-unification, and — critically — **solvable without a merge base**.
Adjudication is an inference problem, bounded below by the conditional entropy
of the resolution given the two sides, and *not solvable from the sources
alone at any level of sophistication*.

The proposal formalizes a translation-based architecture for the localization
half, states the information-theoretic bound on the adjudication half, defines
falsifiable research questions for both, and specifies a measurement programme
that must complete before any implementation begins.

---

## 1. Problem statement

### 1.1 Empirical grounding

Two recent results motivate the work:

- **Merge-Bench** (Schesch et al., 2026): frontier commercial LLMs resolve
  under 60% of real-world merge conflicts correctly when evaluated against the
  resolutions developers actually committed. Performance is markedly better on
  *imbalanced* conflicts (one side dominates) and worse on *balanced
  structural* ones.
- **AgenticFlict** (Ogenrwot & Businge, 2026): analysis of 107K+ AI-agent pull
  requests across 59K+ repositories found a 27.67% conflict rate — well above
  the human-authored baseline.

Read together: agent-generated code is producing conflicts at an elevated rate,
and agents are unreliable at resolving them. The failure is concentrated
exactly where the two edits are comparable in scope and coherence.

### 1.2 The failure is not syntactic

No merge tool in wide use produces unparseable output. Structured merge tools
(mergiraf et al.) guarantee well-formedness by construction. The sub-60% figure
is not a well-formedness failure — it is a *choice* failure. Every incorrect
resolution in Merge-Bench compiles.

This rules out an entire class of proposed improvements: better grammars,
better parsers, richer syntax formalisms. The bottleneck is downstream of
parsing.

### 1.3 The failure is not (only) tree matching

Structured merge tools already match ASTs. GumTree-family matching heuristics
are mature. IntelliMerge extends matching to refactoring-aware program element
graphs. These improve on textual merge substantially — and still leave the
balanced-structural category unsolved, because a correct match tells you the
two edits *are* in conflict without telling you which is right.

### 1.4 The actual bottleneck

For a balanced structural conflict, the information distinguishing the correct
resolution frequently does not appear in either source file. It appears in:

- commit messages and their linked issues,
- the test suite (which may itself be conflicted),
- the wider diff from the common ancestor on both branches,
- the author's intent, which may be recorded nowhere.

Any system that is a pure function of the two conflicting files has a hard
ceiling. Establishing where that ceiling sits, empirically, is a prerequisite
for knowing how much engineering the localization half deserves.

---

## 2. Thesis

> **Separate localization from adjudication. Solve localization structurally
> and base-free. Treat adjudication as bounded inference with an explicit halt.
> Never let the localization machinery guess.**

Three consequences:

- A merge system's primary output should be a *precisely localized candidate
  space with substitutions attached*, not a resolved file.
- Halting is a first-class success mode, not a failure. A system that halts on
  40% of conflicts with 99% precision on the 60% it resolves is more valuable
  than one that resolves 100% at 60% accuracy, because the former composes with
  human review and the latter silently loses code.
- The base (merge-base commit) is required for adjudication but **not** for
  localization. This is the structural novelty and the main testable claim.

---

## 3. Formalization

### 3.1 Notation

Let `L` be a programming language with abstract syntax given by a signature
`Σ`. Programs are ground terms in `T(Σ)`. Introduce a countable set of
variables `X` (holes); patterns are terms in `T(Σ, X)`.

A **substitution** `θ : X ⇀ T(Σ, X)` acts on patterns as usual; `Sθ` denotes
application. Write `dom(θ)` for the holes it binds.

`S` is **more general than** `A` (written `S ⊑ A`) iff `∃θ. Sθ = A`.

Given a conflict, we have three artifacts:

- `O ∈ T(Σ)` — the merge base (common ancestor), possibly absent
- `A ∈ T(Σ)` — "ours"
- `B ∈ T(Σ)` — "theirs"

### 3.2 Three-way merge as a pushout

Classical three-way merge is a **pushout** in a category of programs and
edits. Given the span

```
        A ←──δ_A── O ──δ_B──→ B
```

the merge is the pushout object `M` with `A → M ← B`, when it exists. A
conflict is exactly the *non-existence* of the pushout: the two edits cannot be
glued along `O`.

This framing yields the first precise observation:

> **The span is given by the base.** Three-way merge does not compute a
> correspondence between `A` and `B`; it inherits one from `O`.

That inheritance is the source of a known degradation: as `O` recedes (long-lived
branches, step *n* of an *n*-step rebase, cherry-picks across unrelated
histories), the span it induces becomes a poorer description of how `A` and `B`
actually correspond, and conflict granularity coarsens.

Pijul's patch theory addresses non-existence of pushouts by enlarging the state
space so that conflicts become first-class objects rather than failures — the
category is chosen so the colimit always exists. This is prior art for
"construct a structure in which the problem is expressible," and must be read
before any implementation.

### 3.3 Localization by anti-unification

**Definition (lgg).** The *least general generalization* of `A` and `B` is
`S = A ⊓ B ∈ T(Σ, X)` such that `S ⊑ A`, `S ⊑ B`, and for any `S'` with
`S' ⊑ A` and `S' ⊑ B`, we have `S' ⊑ S`. In the first-order case `S` is unique
up to variable renaming and computable in `O(|A| · |B|)` (Plotkin 1970; Huet
for the higher-order case, where uniqueness fails).

Anti-unification returns a triple:

```
A ⊓ B  =  (S, θ_A, θ_B)      with   Sθ_A = A,   Sθ_B = B
```

`S` is the **skeleton** — everything the two sides agree on, structurally.
`θ_A` and `θ_B` are the **residues** — everything they don't.

**Definition (contested holes).**

```
D(A, B)  =  { x ∈ dom(θ_A) ∪ dom(θ_B)  :  xθ_A ≠ xθ_B }
```

**Proposition 1 (base-free localization).** `D(A, B)` is computable from `A`
and `B` alone. It is a sound and complete description of where the two programs
differ, at AST granularity, without reference to `O`.

This is the structural payoff. Where git's hunk boundaries are an artifact of
line-based diff over a possibly-distant base, `D(A, B)` is intrinsic to the
pair.

### 3.4 Adjudication requires the base

**Definition (unilateral hole).** Given a base `O`, let `(S₃, θ_O, θ_A, θ_B)`
be the ternary anti-unification of `O, A, B`. A hole `x` is:

| Class | Condition | Resolution |
| --- | --- | --- |
| uncontested | `xθ_A = xθ_B` | that value |
| unilateral-A | `xθ_B = xθ_O ≠ xθ_A` | `xθ_A` |
| unilateral-B | `xθ_A = xθ_O ≠ xθ_B` | `xθ_B` |
| contested | `xθ_A ≠ xθ_B`, both ≠ `xθ_O` | **halt** |

**Proposition 2 (disjoint-support merge).** If `D(A, B)` contains no contested
holes, then

```
M  =  S₃ θ*      where   xθ* = xθ_A if unilateral-A, xθ_B if unilateral-B, else xθ_O
```

is the unique minimal merge, and it is derived, not guessed.

**Proposition 3 (decoupling).** Localization (Prop. 1) is base-free.
Adjudication (Prop. 2) is not: without `O` the unilateral/contested distinction
is undefined, and every element of `D(A, B)` is contested.

Proposition 3 is the honest form of the base-free hope. Anti-unification buys
**finer localization** without a base — it does not buy adjudication. Its value
in the far-base regime is that `D(A, B)` stays tight even when git's hunks
sprawl, so the *contested* set computed against a distant `O` is smaller and
better-scoped than the corresponding hunk set.

### 3.5 The translation architecture

The formalization above works over one signature. The proposal's distinguishing
idea generalizes it: rather than abstracting both sides into a *shared*
pre-chosen intermediate representation, translate each side into **its own**
simplified theory, then construct a third theory from the pair.

**Definition (translation).** A translation `τ : L ⇀ L'` is a signature
morphism plus a semantic condition — it maps `Σ`-terms to `Σ'`-terms and is
required to preserve the properties of interest.

The architecture:

```
                τ_A                              τ_B
     A  ────────────────→  L_A            L_B  ←────────────────  B
                            │              │
                            │  ι_A    ι_B  │
                            ▼              ▼
                              ╲          ╱
                               ╲        ╱
                                ▼      ▼
                                  L_S            ← solve here
                                    │
                                    │ ρ  (put-back)
                                    ▼
                                    M            ← merged program in L
```

`L_S` is a **pushout in the category of theories** — a colimit of `L_A` and
`L_B` glued along their shared fragment. Institution theory (Goguen & Burstall)
is the formal home for "many logics, translations between them, combine
coherently," and Hets is a working implementation of exactly this: a graph of
logics with computable colimits.

Three conditions must hold for the architecture to be well-defined:

| | Condition | Status |
| --- | --- | --- |
| **C1** | A span `L_A ← L_C → L_B` exists identifying the shared fragment | **Open — this is the hard part** |
| **C2** | The merge problem is solvable in `L_S` | Depends on `L_S` carrying equations, not just structure |
| **C3** | `ρ` admits a put-back satisfying round-tripping laws | Bidirectional transformation problem; known-hard |

**On C1.** Without a specified overlap, the colimit degenerates to the
coproduct — `A` and `B` sitting side by side, disjoint, and useless. *All* of
the merge content is in the choice of correspondence. Category theory then
guarantees the result is uniquely determined and universal, but supplies no
means of finding the span. In classical three-way merge the span is the base;
the base-free version must **compute** it, and computing it is anti-unification
or tree matching or name resolution — the same hard problem, relocated.

C1 is therefore restated as the project's primary research question, not
assumed.

**On C2 — what would justify the machinery.** If `L_S` is constructed fresh per
conflict pair and carries only structure, it collapses to `(S, θ_A, θ_B)` from
§3.3 and the categorical apparatus is decoration. `L_S` earns its place only
under one of two conditions:

- **(a) `L_S` carries equations.** Rewriting *within* `L_S` can then reach
  resolutions whose syntax appears in neither side. This is equality
  saturation; `egg` is the implementation vehicle; Babble (Cao et al., POPL
  2023) already combines e-graphs with anti-unification and is the closest
  existing artifact to this proposal.
- **(b) `L_S` is drawn from a fixed finite family.** Per-pair work becomes
  *selection* rather than construction. Tractable, testable, and almost
  certainly the buildable version.

**On C3 — the return leg is not a function.** Lossy abstraction means `ρ` needs
a `put` operation, with `get`/`put` round-tripping laws — the lens literature
(Foster et al.; Diskin's delta lenses; Boomerang). Put-back is the known-open
hard part of that field, not an implementation detail. Note the cautionary
datum: Scala does not compile through DOT. DOT was extracted to prove
soundness; establishing the Scala↔DOT correspondence took roughly a decade and
is not a mechanical translation. The architecture that does work at scale is
MLIR — many dialects, explicit conversion, meeting at common dialects — and
MLIR is deliberately lossy downward, with nobody reconstructing source from it.

### 3.6 The information bound

**Proposition 4 (no-invention).** Let `Π` be any resolution pipeline that is a
function of `(A, B)` alone — including any choice of `τ_A, τ_B, L_S, ρ`. Then
the resolution `Π(A, B)` is determined by `(A, B)`. Consequently, if there exist
observed ground-truth resolutions `R₁ ≠ R₂` for the same pair `(A, B)` in
different contexts, no such `Π` is correct on both.

**Corollary.** The accuracy ceiling for base-and-source-only pipelines is
governed by `H(R | A, B, O)`. Lowering it requires side-channels: commit
messages, linked issues, the wider branch diff, the test suite, or the human.

Proposition 4 is not a limitation of a particular formalism. It applies to
anti-unification, e-graphs, theory colimits, and LLMs equally. Its practical
consequence is the design rule in §2: **`L_S` is a candidate generator with an
explicit halt, never a solver.**

It is also empirically measurable — see RQ1.

---

## 4. Research questions

Each is stated with a falsifiable prediction and a kill condition.

### RQ1 — What is the entropy ceiling?

> For pairs `(O, A, B)` appearing more than once across a corpus with divergent
> committed resolutions, what fraction of conflicts admit multiple correct
> resolutions?

**Prediction.** Non-trivial (>10%) for balanced structural conflicts, near-zero
for imbalanced ones — consistent with Merge-Bench's reported skew.

**Why it comes first.** It bounds every other line of work. If `H(R | A,B,O)`
is high, effort belongs in side-channel extraction (commit messages, tests) and
in halting precision, not in merge algebra.

### RQ2 — How much survives canonicalization?

> Of conflicts that reach the "genuinely ambiguous" category, how many dissolve
> after running both sides through the language's deterministic formatter,
> import sorter, and desugaring passes, then re-merging?

**Prediction.** 15–35% dissolve. This is the cheapest possible `L_S` —
formatters *are* a normalizing translation — and it establishes the baseline
that any sophisticated approach must beat.

**Kill condition for the whole project.** If canonicalization plus mergiraf
plus a competent LLM already resolves >90% of the `other` category correctly,
the remaining headroom does not justify novel machinery.

### RQ3 — Is base-free localization tighter?

> Does `D(A, B)` (Prop. 1) localize the contested region more tightly than
> git's hunk boundaries, and does the gap widen as the base recedes?

**Prediction.** Yes, and the gap grows monotonically with base distance
(measured in commits, or in `|δ_O→A| + |δ_O→B|`). This is the strongest
structural claim in the proposal and the most directly testable.

**Metric.** Ratio of contested-AST-node-count to hunk-covered-AST-node-count,
plotted against base distance.

### RQ4 — Can the span be computed?

> For conflicts where the base is distant or absent (cherry-pick, cross-repo),
> can a correspondence `L_A ← L_C → L_B` be computed that agrees with a
> human-annotated correspondence?

This is condition C1. It is the intellectual core and the highest-risk item.

**Decomposition.** Report separately: (i) conflicts where the correspondence is
obvious but the choice is hard; (ii) conflicts where the correspondence *itself*
is hard. If (i) dominates, the categorical apparatus buys nothing three-way
merge did not have, and the project reduces to RQ5.

### RQ5 — Does Datalog-based semantic conflict detection work?

> Can silent semantic conflicts — those producing no markers — be detected by a
> def/ref fixpoint query over a cross-file symbol index?

The minimal rule set:

```prolog
// Soufflé
.decl DefChanged(sym:Symbol, side:Side)
.decl RefChanged(sym:Symbol, side:Side)
.decl SilentSemanticConflict(sym:Symbol)

SilentSemanticConflict(s) :-
    DefChanged(s, "ours"),
    RefChanged(s, "theirs"),
    !DefChanged(s, "theirs").

SilentSemanticConflict(s) :-
    DefChanged(s, "theirs"),
    RefChanged(s, "ours"),
    !DefChanged(s, "ours").
```

**Prediction.** High recall, poor precision without type information; precision
recoverable by joining against an LSP/SCIP index rather than a syntactic one.

**Why this is the highest expected-value work package.** It mechanizes a step
currently posed as a prose question to an LLM, it requires no new theory, and
it targets the failure mode with the worst consequences (silent code loss
discovered a week later).

### RQ6 — Does `L_S` with equations beat `L_S` without?

> Given an e-graph over the union of both sides' rewrite-equivalent forms, are
> there conflicts resolved correctly that structural merge cannot reach?

Condition C2(a). Tests whether the third language earns its existence.
Vehicle: `egg` + Babble.

---

## 5. Work packages

Ordered by dependency. **WP0 gates everything.**

### WP0 — Measurement (2–3 weeks)

No new code beyond instrumentation.

- Instrument the existing `git-conflict-resolver` skill to log every
  `other`-category halt with: both sides, base, def/ref sets, base distance,
  final human resolution.
- Assemble a corpus of ≥200 real conflicts from own repositories plus
  Merge-Bench.
- Answer RQ1 and RQ2.
- **Gate:** if RQ2's kill condition fires, stop.

### WP1 — Canonicalization baseline (1 week)

- Formatter/import-sorter/desugar normalization pass before merge.
- Compare against `git merge -X renormalize` and clean/smudge filters, which
  are the existing weak version of this.
- Establishes the number every later phase must beat.

### WP2 — Semantic conflict detection (4–6 weeks)

- Fact extraction via stack-graphs or SCIP indexers; fall back to LSP
  `textDocument/references` where a server exists.
- Datalog rules per RQ5, in Soufflé (or CodeQL if licensing permits, for
  faster time-to-signal).
- **Deliverable:** a detector that upgrades §Step 4 of the existing skill from
  prose to a query. Independently useful even if WP3–4 never happen.

### WP3 — Anti-unification localization (4–6 weeks)

- Ternary anti-unification over tree-sitter CSTs, normalized to a canonical AST
  (CST shape is a grammar-authoring artifact and must be quotiented out).
- Implement Props. 1–3; measure RQ3.
- Pull the three sides from the index, never the marker-laden working tree:

  ```bash
  git show :1:path > base && git show :2:path > ours && git show :3:path > theirs
  ```

- Prototype the skeleton/residue split with Comby first — metavariable holes
  without a full parse, days rather than weeks to signal.

### WP4 — Span computation (open-ended, high risk)

- RQ4. Start with the free-span domain: **import/use lists**, where the
  correspondence is identity, merge genuinely is a colimit, and put-back is
  trivial.
- **Gate:** if the machinery does not pay for itself where the hard part is
  given away free, it will not pay for itself elsewhere.

### WP5 — Equational `L_S` (exploratory)

- RQ6, via `egg` and Babble.
- Only if WP3 succeeds and WP0 showed headroom.

---

## 6. Avenues surveyed

Complete disposition of everything considered, including rejections and why.

### 6.1 Rejected

| Avenue | Disposition |
| --- | --- |
| **Dapper / distributed tracing** | **Rejected as design inspiration.** Its central innovation — sampling at 1/1024, justified by "a notable pattern surfaces thousands of times" — is inverted for this domain, where the rare case *is* the point and 100% retention is required. Its hardest design goal (application-level transparency via library instrumentation) solves a problem that does not exist when you control the whole stack. Its 204 ns span-creation budget is irrelevant against LLM inference at ~10⁹ ns. Its nested-RPC causality model cannot express "step 7 invalidated step 3," which is normal agent behaviour. **Retained:** out-of-band collection as an invariant; and the organizational lesson that opening the trace datastore through a simple API produced tools the authors never anticipated. For actual tracing, use OpenTelemetry GenAI semantic conventions — Dapper's productionized descendant — not the 2010 paper. |
| **ANTLR** | **Rejected as parser.** Grammar quality in `grammars-v4` is uneven; tree-sitter grammars are maintained because editors depend on them. ANTLR's error recovery is bolted-on, and mid-rebase files frequently do not fully parse. ANTLR yields a CST shaped by the grammar author's rule factoring, so merging on it means merging on someone's left-recursion elimination. Java-first ecosystem. |
| **"Grammar of conflict" (context-free)** | **Rejected on expressiveness.** The invariant to be exploited — "it presumably runs" — is not context-free. Declare-before-use is the canonical proof that programming languages are not context-free; name binding and type correctness are context-sensitive. ANTLR provides LL(\*), strictly weaker. **More decisively:** syntactic validity is a near-useless filter here, because the set of grammar-legal resolutions for a typical conflict is combinatorially large and a generative grammar makes it *larger*. The problem is discriminative. Adding context-sensitivity via semantic predicates amounts to writing a compiler frontend per language; those exist (rust-analyzer, tsc, mypy). |
| **Apache TinkerPop / Gremlin** | **Rejected.** A repo's symbol graph at two commits is 10³–10⁶ nodes — in-memory territory (`petgraph`, `rustworkx`, `networkx`). A graph DB buys persistence and distributed traversal, neither needed, and costs an ingest pipeline plus operational surface. Gremlin's `repeat().until()` is clumsy for the recursive fixpoint queries that constitute the entire workload, and the engines lack Datalog's semi-naive evaluation. Java-centric. **90% of the work is extraction, which is identical regardless of store — choose the store last.** |
| **DOT-style single shared IR** | **Rejected as literal model.** Scala does not compile through DOT; the correspondence took ~a decade to establish and is not mechanical. Retained as the source of the *insight* (simplify, solve, translate back) with MLIR as the engineered version — but MLIR is deliberately one-way. |

### 6.2 Adopted or under evaluation

| Avenue | Role |
| --- | --- |
| **mergiraf** | Layer 1, already in use. Tree-sitter structural merge. The baseline. |
| **tree-sitter** | Parsing substrate. Error-tolerant, incrementally reparsing, editor-funded grammar maintenance. |
| **Anti-unification** (Plotkin 1970; Huet for higher-order) | **Core formalism** for §3.3. Provides skeleton + explicit substitutions, which is the property that makes the abstraction survivable — a lossy abstraction that discards the residue cannot be inverted. |
| **e-graphs / `egg`** | Vehicle for equational `L_S` (C2a, RQ6). Represents exponentially many equivalent programs compactly, extracts by cost function. |
| **Babble** (Cao et al., POPL 2023) | E-graphs + anti-unification for library learning. **Closest existing artifact to this proposal — read first.** |
| **Datalog** (Soufflé, CodeQL, Glean) | Query layer for RQ5. Program analysis is a recursive-fixpoint problem; Datalog is the fitted formalism. |
| **stack-graphs** (GitHub) | Tree-sitter + incremental cross-file name binding. Closest drop-in for the fact-extraction half of WP2. |
| **SCIP / LSIF / LSP** | Precomputed cross-repo indexes; LSP `textDocument/references` and call hierarchy come from real compiler frontends and beat hand-rolled resolvers on inference. |
| **Comby** | Structural match-and-rewrite with metavariable holes, language-approximate, no full parse. **Prototyping vehicle for the skeleton/residue split — days to signal.** |
| **ast-grep** | Structural pattern queries where a full index is overkill. Rust, tree-sitter. |
| **GumTree** (Falleri et al.) | Reference AST diff algorithm. Everything downstream borrows its matching heuristics. |
| **difftastic** | Shipping structural diff, Rust + tree-sitter. Reference implementation for practical tree matching. |
| **IntelliMerge** (Shen et al., OOPSLA 2019) | Refactoring-aware merge via program element graph matching. **Prior art for the graph-correspondence idea, with an evaluation. Read before implementing WP4.** |
| **Spork / JDime / 3DM / FSTMerge** | The structured-merge lineage. Establishes that every practical system uses per-language matching heuristics rather than principled edit scripts — because optimal unordered tree edit distance is NP-hard and ordered (Zhang–Shasha) is O(n²)–O(n³) with poor constants. |
| **pijul / darcs patch theory** | Merge as an algebraic operation on a partial order of changes; conflicts as first-class objects so colimits always exist. **The genuinely principled prior attack on this problem. Either this project reinvents it or extends it.** |
| **Institution theory** (Goguen & Burstall) / **Hets** | Formal home for §3.5. A graph of logics with translations along edges and computable colimits. |
| **Lens / BX literature** (Foster, Diskin, Boomerang) | Formalism for condition C3 (put-back). Flags the return leg as a known-hard research area, not an implementation detail. |
| **Abstract interpretation** (Cousot & Cousot) | Galois connections give the precise account of what a given abstraction `L_S` can and cannot decide. |
| **LASE / Sydit** (Meng et al.) / **Refazer** (Rolim et al., ICSE 2017) | Generalize an edit from examples into a transformation, then apply. Existing `S`-and-`θ` machinery for the refactoring-propagation slice of the `other` category. |
| **Metamorphic / property-based differential testing** | The correct frame for "did the merge preserve both intents" — a test-oracle problem, not an observability one. |
| **OpenTelemetry (GenAI conventions)** | If agent-run tracing is wanted, this, not Dapper. |

---

## 7. Evaluation

### 7.1 Metrics

The system is a **triage classifier plus a resolver**, and must be measured as
both.

| Metric | Definition | Target |
| --- | --- | --- |
| Resolution precision | correct / attempted | ≥ 0.95 |
| Halt recall | halts / (conflicts where the system would have been wrong) | ≥ 0.90 |
| Coverage | attempted / total | maximize subject to the above |
| Localization tightness | contested nodes / hunk-covered nodes | < 1, decreasing with base distance |
| Silent-conflict recall | detected / injected | ≥ 0.90 on synthetic |

Precision is prioritized over coverage without apology. Auto-resolving at
sub-60% per-hunk accuracy across a 12-step rebase is how a merge silently loses
code in a place nobody looks for a week.

### 7.2 Ground truth

- **Merge-Bench** for comparability with published LLM baselines.
- Own-repository corpus from WP0 instrumentation, with human-adjudicated
  resolutions.
- **Synthetic injection** for RQ5: mechanically rename a symbol on one branch
  and add a reference on the other; ground truth is known by construction.

### 7.3 Threats to validity

| Threat | Mitigation |
| --- | --- |
| Committed resolution ≠ correct resolution | Sample-audit against subsequent bug-fix commits touching the same region |
| Own-repo corpus is unrepresentative (AI-authored PRs skew per AgenticFlict) | Report own-corpus and Merge-Bench separately; never pool |
| Language monoculture | Stratify by language; report per-language |
| Selection bias toward conflicts the current skill halts on | Log *all* conflicts, including auto-resolved ones, not just halts |
| Formalism-fitting: choosing conflicts the algebra handles | Pre-register the corpus before implementing WP3 |

---

## 8. Deliverables

1. **Measurement report** (WP0) — RQ1, RQ2. Publishable independently; the
   entropy result (RQ1) is of general interest to the merge-tooling and
   LLM-evaluation communities.
2. **Semantic conflict detector** (WP2) — standalone, usable, upgrades the
   existing skill regardless of whether WP3–5 proceed.
3. **Localization library** (WP3) — anti-unification over canonical ASTs,
   emitting `(S, θ_A, θ_B)` and the contested set. Consumable by an agent as
   structured context rather than raw markers.
4. **Paper** — the base-free localization result (Prop. 1–3) plus the RQ3
   measurement is the strongest candidate contribution, provided pijul's patch
   theory and IntelliMerge do not already subsume it.

---

## 9. Kill criteria

Stated in advance, to be honoured.

- **RQ2 kill:** canonicalization + mergiraf + competent LLM resolves >90% of
  the `other` category correctly → insufficient headroom, stop.
- **RQ3 kill:** `D(A, B)` is not measurably tighter than hunk boundaries, and
  the gap does not widen with base distance → the central structural claim is
  false, drop WP3–5 and ship WP2.
- **RQ4 kill:** correspondence-is-hard cases are a minority of `other`-category
  halts → the categorical apparatus is decoration; the project reduces to
  better adjudication, i.e. side-channel extraction and prompt engineering.
- **Prior-art kill:** if IntelliMerge or pijul already contains Props. 1–3 with
  an evaluation → contribute upstream rather than rebuild.
- **Any WP overruns its estimate by 2×** without a corresponding measured
  result → re-enter WP0 and re-measure rather than pushing on.

---

## 10. Immediate next actions

1. Read Babble (POPL 2023), IntelliMerge (OOPSLA 2019), and pijul's patch
   theory. Establish whether the contribution already exists. *(days)*
2. Instrument the existing skill per WP0. *(days)*
3. Run the canonicalization baseline (WP1) against the first 50 logged halts.
   *(1 week)*
4. Prototype skeleton/residue extraction with Comby on the import/use-list
   domain. *(1 week)*

Nothing in §3 justifies writing a parser, a graph database, or a new IR before
step 3 returns a number.

---

## References

- Aguilera, M. K. et al. *Performance Debugging for Distributed Systems of Black Boxes.* SOSP 2003.
- Apel, S. et al. *Semistructured merge: rethinking merge in revision control systems.* ESEC/FSE 2011.
- Cao, D. et al. *Babble: Learning Better Abstractions with E-Graphs and Anti-Unification.* POPL 2023.
- Cousot, P. & Cousot, R. *Abstract Interpretation.* POPL 1977.
- Diskin, Z. et al. *From State- to Delta-Based Bidirectional Model Transformations.* 2011.
- Falleri, J.-R. et al. *Fine-grained and Accurate Source Code Differencing (GumTree).* ASE 2014.
- Foster, J. N. et al. *Combinators for Bidirectional Tree Transformations.* TOPLAS 2007.
- Goguen, J. & Burstall, R. *Institutions: Abstract Model Theory for Specification and Programming.* JACM 1992.
- Huet, G. *Résolution d'équations dans des langages d'ordre 1, 2, …, ω.* Thèse, 1976.
- Lattner, C. et al. *MLIR: Scaling Compiler Infrastructure for Domain Specific Computation.* CGO 2021.
- Meng, N. et al. *LASE: Locating and Applying Systematic Edits by Learning from Examples.* ICSE 2013.
- Ogenrwot, D. & Businge, J. *AgenticFlict: merge conflicts in AI-agent pull requests.* 2026.
- Plotkin, G. D. *A Note on Inductive Generalization.* Machine Intelligence 5, 1970.
- Rolim, R. et al. *Learning Syntactic Program Transformations from Examples (Refazer).* ICSE 2017.
- Rompf, T. & Amin, N. *Type Soundness for Dependent Object Types (DOT).* OOPSLA 2016.
- Schesch, B. et al. *Merge-Bench.* 2026.
- Shen, B. et al. *IntelliMerge: A Refactoring-Aware Software Merging Technique.* OOPSLA 2019.
- Sigelman, B. H. et al. *Dapper, a Large-Scale Distributed Systems Tracing Infrastructure.* Google Technical Report, 2010.
- Zhang, K. & Shasha, D. *Simple Fast Algorithms for the Editing Distance Between Trees.* SIAM J. Comput. 1989.
- The Pijul manual — patch theory. <https://pijul.org>
