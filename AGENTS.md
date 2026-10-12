# Repository Guidelines

## Project Structure & Module Organization

This is a pnpm monorepo targeting Node.js 22+. The shipped package is `packages/core`; its `src/` and `tests/` trees mirror three areas: `evaluation/` for merge replay and classification, `m1a/` for evidence bundles and H0 loading, and `db/` for fail-closed SQLite persistence. Thin CLI wrappers live in `packages/core/bin/` and run compiled code from `dist/`. Project decisions and plans belong in `docs/adr/`, `docs/findings/`, and `docs/planning/`. Reproducible experiment outputs live under `evidence/`; maintenance and verification utilities live in `scripts/`.

## Build, Test, and Development Commands

Run commands from the repository root:

```bash
pnpm install --frozen-lockfile  # install the pinned workspace dependencies
pnpm typecheck                 # check packages plus evidence/h0 scripts
pnpm test                      # run all Vitest suites
pnpm build                     # compile package sources into dist/
./scripts/verify-carried.sh    # confirm carried WP0 files are byte-identical
```

For a focused test, use `pnpm --dir packages/core exec vitest run tests/db/blob.test.ts`. Build before exercising a CLI, for example `node packages/core/bin/mrgr-wp0.mjs --help`.

## Coding Style & Naming Conventions

Use strict TypeScript, ESM, tabs for indentation, double quotes, and semicolons, matching neighboring files. Local imports include the emitted `.js` extension. Prefer `camelCase` for functions and variables, `PascalCase` for types, and kebab-case module filenames such as `llama-cpp-run-store.ts`. Errors are typed `Result`/`DbResult` values; do not use exceptions for normal control flow. No formatter or linter is configured, so `pnpm typecheck` and consistency with existing code are the style gates.

## Testing Guidelines

Vitest tests use `*.test.ts` and mirror the source area under `packages/core/tests/`. Add focused regression coverage for changed behavior and use temporary directories for filesystem or Git fixtures. There is no declared coverage percentage; the required baseline is the full test and typecheck suite. Files in `src/evaluation/` and `tests/evaluation/` are digest-locked research artifacts. Change them only deliberately, update `scripts/carried.sha256` with `./scripts/verify-carried.sh --update`, and explain why in the commit.

## Commit & Pull Request Guidelines

Follow the history's concise, imperative subjects, preferably Conventional Commit style: `feat(h0): ...`, `fix(db): ...`, or `docs: ...`. Keep commits narrowly scoped. Pull requests should describe the behavioral or evidentiary change, link the relevant issue or ADR, list verification commands, and call out schema, CLI, or generated-evidence effects. Never silently delete or rewrite invalidated evidence; preserve it beside its retraction or review record, and cite stamped aggregates rather than `evidence/h0/aggregate.json`.
