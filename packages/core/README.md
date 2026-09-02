# @mrgr/core

Deterministic merge-conflict **evidence** for whole forks. Part of [mrgr](https://github.com/svnbjrn/mrgr).

This package collects, replays, localizes and classifies. **It does not adjudicate.** The boundary is specified in [`docs/adr/00-scope-and-verdict.md`](../../docs/adr/00-scope-and-verdict.md) and the behaviour in [`docs/adr/02-wp0-measurement.md`](../../docs/adr/02-wp0-measurement.md).

## Install

```bash
npm install @mrgr/core
```

Requires Node ≥ 22.5.0 and **Git ≥ 2.38.0** (enforced, not assumed).

> The Node ≥ 22.5.0 floor is the package's declared `engines` value, and it
> is a real requirement, not a conservative guess: `mrgr-db` is built on
> `node:sqlite`, which does not exist before Node 22.5. The carried WP0
> evaluation modules (`src/evaluation/`) have no such dependency and would
> run on an older Node, but the package as a whole does not.

The carried WP0 evaluation modules (`src/evaluation/`) have **zero runtime
dependencies** and shell out only to `git`. The M1a evidence-bundle modules
(`src/m1a/`) add one: `zod`, for schema validation. M1a is partial — see the
root README's status section.

## CLI

```bash
mrgr-wp0 scan <owner/repo...> --out FILE [--host github.com] [--cache DIR] [--since ISO] [--jobs 4] [--refresh]
mrgr-wp0 scan-local <path...> --out FILE [--since ISO] [--rev RANGE] [--jobs 4]
mrgr-wp0 report FILE [--baseline ID]
mrgr-wp0 materialize FILE --out FILE [--baseline ID] [--cache DIR]
mrgr-evidence CORPUS --out FILE [--repo PATH] [--max-bytes N] [--resume]
mrgr-evidence CORPUS --db PATH [--repo PATH] [--max-bytes N]
mrgr-h0-load --db PATH
mrgr-db init   --db PATH
mrgr-db import --db PATH (--corpus FILE | --evidence FILE)
mrgr-db export --db PATH --out DIR [--with-blobs]
mrgr-db verify --db PATH
```

Direct command errors from `mrgr-wp0`, `mrgr-evidence`, and `mrgr-db` are a single JSON `ToolError` on stderr; `mrgr-h0-load` emits a concise text error. `mrgr-evidence` can separately generate a `status: "failed"` record for a single conflict — that's a written extraction-failure row, not a `ToolError`, and it still prints a plain-text summary line and exits 1. All four commands exit 0 on success and 1 for operational failure (including any generated failure record). `mrgr-evidence`, `mrgr-h0-load`, and `mrgr-db` use exit 2 for usage mistakes; `mrgr-wp0` uses exit 1 for both classes. The corpus is append-only JSONL, resumable by `(repoId, mergeSha, baselineId)`, and fails closed on a malformed record rather than skipping it.

## Status

| Component | State |
|---|---|
| `mrgr-db` — workspace SQLite store (mrgr-db/1) | works: corpus + evidence + ledger + runs; canonical export; JSONL import |

## Persistence

`mrgr-db` is the workspace store; JSONL (corpus, sidecar evidence, and `mrgr-db export`'s output) is the transport format. Committed evidence in this repository stays exported JSONL rather than a binary `.db` file — that is what gets reviewed and diffed. `tursodb` may inspect the database file read-only for ad-hoc queries while no writer has it open; querying it while `mrgr-db` is running is not something this package tests or supports. Node ≥ 22.5 is required — `node:sqlite`, which the store is built on, does not exist before that.

`mrgr-db` and `mrgr-evidence` exit `0` on success, `2` for a usage error, and `1` for an operational failure. `mrgr-wp0` retains its historical exit `1` for both usage and operational failures. `mrgr-h0-load` follows the `0`/`2`/`1` split but emits concise text rather than a JSON `ToolError`.
Sidecar mode summarizes `ok`, `failed`, and `skipped` evidence records; database
mode summarizes store outcomes as `imported`, `failed`, and `skipped`. In both
modes, any generated `status: "failed"` record exits `1` even when it was
persisted successfully. Sidecar `--resume` carries this forward across runs:
an unresolved `status: "failed"` row already in `--out` still exits `1` even
if nothing new fails on the resumed run — a region isn't "fixed" just because
it was skipped as already-seen.

## Library

```ts
import { openLocalRepository, listCandidates, replayCandidate, generateReport } from "@mrgr/core";
```

`main(argv, io)` is exported with an injectable `CliIo`, which is the seam the agent surface wraps.

## What the numbers mean

`report` prints explicit denominators and refuses the claims it cannot support:

```
replay attempted=1
pinned modern replay incidence: 1/1 (1.000000)
historical conflict incidence: not measured
observed deterministic ambiguity floor: not measurable (no repeated localized triples)
```

Replaying a historical merge under a modern Git produces both false positives and false negatives relative to what actually happened at the time, so incidence is reported against the **pinned replay baseline** (`baselineId` = SHA-256 over Git version, environment policy, replay algorithm and normalization version) and never against history. A developer's committed resolution is recorded as the observed output, **not** as semantic truth.

Localization is conservative by construction: a region is `exact` only when complete diff3 marker blocks align to the shipped blob under zero-context diffing. Everything else is `ambiguous` or `unsupported`, and both are counted rather than dropped.

## Provenance

These twelve modules and their 120 tests are carried verbatim from the WP0 merge-forensics instrument. See [`NOTICE`](NOTICE).

## License

Apache-2.0.
