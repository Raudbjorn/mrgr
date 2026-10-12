# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

mrgr: evidence, verification and provenance for fork-scale merges. It records merge decisions, their inputs and their omissions — it does not resolve conflicts or claim semantic correctness. pnpm monorepo with one package, `@mrgr/core` (sole runtime dependency: zod). ESM, Node >= 22.5 (uses `node:sqlite`), pnpm 11.3.

## Commands

```bash
pnpm install --frozen-lockfile  # esbuild build script is explicitly allowed in pnpm-workspace.yaml
pnpm typecheck               # recursive typecheck + evidence/h0/tsconfig.json (run scripts are typechecked too)
pnpm test                    # recursive vitest
pnpm build                   # tsc -p tsconfig.build.json per package; required before running bin/ CLIs
```

Single test file:

```bash
pnpm --dir packages/core exec vitest run tests/m1a/sidecar.test.ts
```

CLIs (in `packages/core/bin/`, all thin wrappers over `dist/`, so build first):

```bash
node packages/core/bin/mrgr-wp0.mjs scan-local /path/to/repo --out corpus.jsonl
node packages/core/bin/mrgr-wp0.mjs report corpus.jsonl
node packages/core/bin/mrgr-wp0.mjs materialize corpus.jsonl --out evidence.jsonl
node packages/core/bin/mrgr-db.mjs        # workspace SQLite persistence (mrgr-db/2)
node packages/core/bin/mrgr-h0-load.mjs   # materialized-triples loader
```

Verification gates:

```bash
scripts/verify-carried.sh            # byte-for-byte digest check of carried WP0 modules against scripts/carried.sha256
scripts/capture-evidence.sh [commit] # clean-clone M0 evidence artifact -> evidence/m0-closure.md
```

## Architecture

`packages/core/src/` has three layers, mirrored 1:1 by `packages/core/tests/`:

- **`evaluation/`** — WP0: enumerate exact two-parent merge candidates (`acquire`, `pool`), replay them under pinned Git (`replay`, `git`), conservatively localize conflict regions (`localize`), mechanically classify resolutions (`classify`), write resumable schema-v2 JSONL corpora (`corpus`), report with explicit denominators (`report`), materialize evaluator inputs (`materialize`). These modules are **carried verbatim** from the original research instrument and digest-locked (see "Carried-file gate" below).
- **`m1a/`** — evidence bundles: one bundle per conflict region keyed `conflict_path` + `conflict_ordinal`, persisted to an append-only **sidecar** (`corpus.evidence.jsonl`), never inline on `CorpusRecordV2` (keeps schema v2 immutable). Uncapped byte-accurate preimages, absent side is `null` not failure, failed extractions are recorded rows. Also `h0-aggregate.ts` / `h0-load.ts`, the tested halves of the H0 machinery.
- **`db/`** — fail-closed SQLite via `node:sqlite`. `openDb` requires exact `application_id`, `user_version` and `meta.schema_version`; anything else is a typed error and the file is untouched. **Never auto-migrates.**

Errors are values throughout: `Result` / `DbResult` types, no exceptions for flow control.

## evidence/ — governed directory, special rules

`evidence/` is durable run output. Every file was produced by executing something. Rules that override normal instincts:

- **Nothing is quietly deleted.** Invalid results stay, with the invalidation/retraction sitting beside them (`RETRACTION.json`, `REVIEW-*.md`, `INVALIDATION-RULE.md`).
- **Cite stamped files only.** `evidence/h0/aggregate.json` is unstamped scratch output — cite `aggregate-<timestamp>.json` instead. The governing document is `SIGNIFICANCE-2026-08-30T02-54-42-056Z.md`.
- Underscore-prefixed files (`_h0_runner.ts`, `_aggregate.ts`, `_baselines.ts`, `_corpus_freeze.ts`, `_corpus_regen.ts`) are run scripts, deliberately not part of `@mrgr/core`. They ARE typechecked (root `pnpm typecheck` includes `evidence/h0/tsconfig.json`) and the aggregator's statistical helpers and kill branch are tested from `packages/core/tests/m1a/h0-evidence-scripts.test.ts`.

### H0 status (load-bearing project state)

The H0 experiment (does outside-hunk evidence help an LLM adjudicator?) returned **null** on 2026-08-30; the agent adapter and `@mrgr/evidence-bundle` are **retired** under the preregistered STOP rule. They reopen only if: the grader's whitespace normalization is fixed so a blended resolution can score correct, the frozen corpus is re-run, and an arm clears the gate. Do not build or plan agent-adapter work without that. Two earlier runs (2026-08-27, 2026-08-29) were retracted/invalidated and are preserved under `evidence/h0/`.

The runner is configured by env vars: `H0_PROVIDER` (local|hf — **local only for citable runs**; local pins the model by GGUF SHA-256 via `H0_MODEL_TAG`/`H0_MODEL_SHA`, cloud providers can swap weights and break reproducibility), `H0_ADJUDICATOR` (llama-server URL, default `http://127.0.0.1:8089`), `H0_REPEATS`, `H0_SEED`, `H0_STAMP`, `H0_SUBSAMPLE`, `H0_DECISION_SCHEMA` (opt-in grammar-constrained decoding — a **different experimental condition**, stamped on every record; never pool constrained and unconstrained runs).

## Carried-file gate

`packages/core` is an extraction, not a rewrite. `scripts/verify-carried.sh` compares digests of carried modules/tests against `scripts/carried.sha256` — the 120 carried tests only mean something if the code under them is byte-identical to what was measured. To carry a deliberate change: make it, re-run with `--update`, and state in the commit message what changed and why the tests still hold. Never edit a carried test to accommodate a changed module.

Similarly, `docs/adr/00-scope-and-verdict.md` and `docs/adr/02-wp0-measurement.md` are carried verbatim from the research tree — repath links only, do not change prose.

## Coding style

Strict TypeScript, ESM, tabs for indentation, double quotes, semicolons. Local imports include the emitted `.js` extension. `camelCase` functions/variables, `PascalCase` types, kebab-case module filenames (`llama-cpp-run-store.ts`). No formatter or linter is configured — `pnpm typecheck` and consistency with neighboring files are the style gates. Tests are `*.test.ts` mirroring the source area; use temp directories for filesystem/Git fixtures.

Commits: concise imperative subjects, Conventional Commit style (`feat(h0): ...`, `fix(db): ...`, `docs: ...`), narrowly scoped. PRs describe the behavioral or evidentiary change, link the relevant ADR/finding, list verification commands, and call out schema, CLI, or generated-evidence effects.

## House style

- **State denominators and limits.** Reports say what they did NOT establish (`historical conflict incidence: not measured`). Counts come from parsed, deduplicated sets, never from `wc -l` of human-readable output. Halt is a first-class outcome in its own column, never folded into success or failure.
- Claims are gated on evidence, not schedules. The binding plan is `docs/planning/final/canonical-final-planning-document.md`; findings live in `docs/findings/`, decisions in `docs/adr/`.
- `mergiraf` (GPL-3.0-only) and `diff3` are invoked as external processes over a file-and-exit-code contract — never linked, vendored, or distributed.

