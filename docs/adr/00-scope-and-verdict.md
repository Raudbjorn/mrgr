# Chapter 00 — Scope and verdict

> Carried verbatim from the semantic-merge research tree. Only relative
> links were repathed for this monorepo layout; no prose was changed.

## Verdict first

**WP0 now has a runnable TypeScript miner and evaluation tests.** It enumerates exact two-parent merge candidates, replays them under a pinned Git baseline, conservatively localizes conflict regions, classifies exact localized resolutions, writes resumable schema-v2 JSONL, reports explicit denominators, and locally materializes evaluator inputs.

There is still no real ≥200-conflict corpus result and no RQ1–RQ6 verdict. WP1–WP5 are design/scaffold only. The repository is not a production semantic merge driver.

## No-invention boundary

> A source-only computation may collect, replay, localize, or classify observed differences. It must not choose between inequivalent alternatives—or claim developer intent or semantic correctness—without additional evidence.

WP0 obeys this boundary by separating three activities:

| Activity | WP0 does | WP0 does not do |
| --- | --- | --- |
| Corpus collection | Enumerate every exact two-parent candidate in scope and persist clean, conflicted, unrelated, quarantined, and error outcomes. | Infer whether the historical merge conflicted. |
| Localization/classification | Align conservative local regions and label exact shipped spans by mechanical equality with base/ours/theirs. | Guess ambiguous regions or treat normalized novelty as semantic novelty. |
| Semantic adjudication | Preserve evidence for later evaluation. | Decide which resolution was correct, infer intent, or answer RQ1–RQ6. |

A larger parser, graph database, language-specific IR, or model would not remove this information boundary.

## Implemented and unimplemented scope

| Proposal part | Repository state | Claim boundary |
| --- | --- | --- |
| WP0 | Runnable TypeScript CLI in [`src/evaluation`](../../packages/core/src/evaluation/) with tests in [`tests/evaluation`](../../packages/core/tests/evaluation/). | Local fixture gate passed; no real ≥200-conflict result. |
| WP1 | Design/scaffold only. | No canonicalization work-package implementation or result. |
| WP2 | Design/scaffold only. | No semantic detector implementation or result. |
| WP3 | Design/scaffold only. | No anti-unification implementation or result. |
| WP4 | Design/scaffold only. | No span/colimit implementation or result. |
| WP5 | Design/scaffold only. | No equational-search implementation or result. |
| Semantic merge driver | Absent. | No production integration, automatic resolution, or semantic accuracy claim. |

## What is not claimed

- No real corpus result is reported for RQ1–RQ6.
- The three-merge fixture does not estimate historical conflict incidence, developer-intent entropy, or semantic accuracy.
- A modern replay is not the historical event: it can add or miss conflicts relative to the original environment.
- A committed resolution is observed developer output, not semantic truth.
- An exact localized `novel` label means only that the shipped bytes equal none of the localized base/ours/theirs spans; it does not prove correctness or irreducible invention.
- A passing test proves only its exercised contract.

These limits are part of the result. Preserving them prevents a runnable measurement pipeline from being mistaken for completed semantic-merge research.

## Artifact map

| Artifact | Role |
| --- | --- |
| [Primary index](../../README.md) | Current status, navigation, quick start, and materialized evaluator fields. |
| [Chapter 02 — WP0 measurement](02-wp0-measurement.md) | Behavioral specification, schema, equations, command surface, and interpretation limits. |
| [WP0 merge-replay source note](wp0-merge-replay.md) | Reviewed Python-input provenance, adopted Git semantics, and rejected behaviors. |
| [`src/evaluation`](../../packages/core/src/evaluation/) | Runnable WP0 TypeScript implementation. |
| [`tests/evaluation`](../../packages/core/tests/evaluation/) | WP0 contract and generated-Git-graph tests. |

Chapter 01 records conceptual foundations only. WP1–WP5 remain design-only until they gain real implementations and evidence.
