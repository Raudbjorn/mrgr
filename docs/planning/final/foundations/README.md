# Foundations

This directory holds **conceptual-foundation** documents for the `mrgr` project
that are referenced by the canonical-final-planning-document (one level up),
alongside the artifacts that establish the `mrgr` mission, math, and
research-direction framing.

## Layout

```
foundations/
├── README.md                                     (this file)
└── semantic-merge-research-proposal.md            ← mrgr's research proposal (the foundational doc)
```

**There is intentionally no `sycl-fa-research/` subdirectory here.** The
SYCL-FA defect-research material is **not part of the `mrgr` project**; it
concerns `TheTom/llama-cpp-turboquant` on Intel Arc A770. It was
historically located in `/home/svnbjrn/rsrch/` and is now consolidated at
`/home/svnbjrn/rsrch/sycl-fa-research/`. **Do not move SYCL-FA files
into this tree.**

## Why a `foundations/` subdirectory exists

The canonical-final-planning-document references some upstream research
material by absolute path (`/home/svnbjrn/rsrch/semantic-merge-research-proposal.md`).
That coupling makes the canonical doc fragile: if the source file moves or
disappears, every citation breaks. By placing a copy of the proposal under
`foundations/`, the canonical doc can use a relative path
(`foundations/semantic-merge-research-proposal.md`) that is robust to
wherever this artifact tree is checked out.

The **original** at `/home/svnbjrn/rsrch/semantic-merge-research-proposal.md`
remains in place as a sibling reference. SHA-256 of both files matches:
`f51db8bbcaf631ca9a0820a4e8becc028db3671f79cf9a0f14862369593d4d34`. The
in-tree copy here is the canonical citation target for future revisions.

## WP-numbering disambiguation

The `semantic-merge-research-proposal.md` defines **research** work-packages
WP0–WP5 (each tied to a Research Question RQ1–RQ6):

| Proposal WP | Phase | Proposal scope |
| --- | --- | --- |
| WP0 | Measurement (2–3 weeks) | instrument the existing skill; answer RQ1, RQ2 |
| WP1 | Canonicalization baseline (1 week) | formatter/import-sorter/desugar pass |
| WP2 | Semantic conflict detection (4–6 weeks) | Datalog rules (RQ5) |
| WP3 | Anti-unification localization (4–6 weeks) | implement Prop. 1–3; measure RQ3 |
| WP4 | Span computation (open-ended) | RQ4; import/use-list free-span domain |
| WP5 | Equational `L_S` (exploratory) | RQ6 via `egg` and Babble |

The **canonical-final-planning-document** defines **execution** work-packages
WP0–WP8 (each tied to a project milestone):

| Canonical WP | Milestone | Status as of 2026-08-29 |
| --- | --- | --- |
| WP0 | M0-closure durable artifact and doc correction | open |
| WP1 | M1a P0 schema honesty and persistence | **DONE** (`mrgr-db/2`) |
| WP2 | M1a P1 load-bearing tests | **DONE** (`tests/db/`) |
| WP3 | H0 redesign | **DONE** (chain landed on `b87a064`) |
| WP4 | H0 rerun | **DONE 2026-08-29** (verdict `positive`) |
| WP5 | M2a port to `@mrgr/mechanisms` | open |
| WP6 | Resurrection proof | open |
| WP7 | M1b / M2b / M3 / M4 / Replay (placeholders) | not started |
| WP8 | Agent adapter (conditional, single surface) | unblocked on H0; gated on harness |

**These two WP-numbering systems are independent and unrelated.** Reading the
proposal's "WP3 = Anti-unification localization" alongside the canonical's
"WP3 = H0 redesign" creates a coincidence that is not a coordination.

Additionally, the term **"carried-WP0"** (or just **"WP0"**) appears in
`m1a-p0-implementation-plan.md` and `STATUS.md` as a **third meaning**: it
refers to the upstream `WP0` extract — the `@mrgr/core` module that was
**carried in** from the `semantic-merge` project. This is also unrelated to
the proposal's WP0 or the canonical's WP0.

Three WP0s. Different namespaces. None are wrong; none should be conflated.

## Verification

A future planner can verify the in-tree copy by:

```
sha256sum foundations/semantic-merge-research-proposal.md
# expected: f51db8bbcaf631ca9a0820a4e8becc028db3671f79cf9a0f14862369593d4d34
```

If the SHA diverges, the in-tree copy has been modified without coordination;
re-fetch from the upstream `/home/svnbjrn/rsrch/semantic-merge-research-proposal.md`
or the original `mrgr-agent-harness-plan-critique.md` source.
