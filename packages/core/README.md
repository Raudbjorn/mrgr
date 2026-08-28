# @mrgr/core

Deterministic merge-conflict **evidence** for whole forks. Part of [mrgr](https://github.com/svnbjrn/mrgr).

This package collects, replays, localizes and classifies. **It does not adjudicate.** The boundary is specified in [`docs/adr/00-scope-and-verdict.md`](../../docs/adr/00-scope-and-verdict.md) and the behaviour in [`docs/adr/02-wp0-measurement.md`](../../docs/adr/02-wp0-measurement.md).

## Install

```bash
npm install @mrgr/core
```

Requires Node ≥ 20 and **Git ≥ 2.38.0** (enforced, not assumed).

> The Node ≥ 20 floor is the package's declared `engines` value and is
> **not currently verified**: the dev toolchain (pnpm 11.3.0) requires Node
> ≥ 22.13, so CI builds and tests on Node 22. Nothing in the carried modules
> is known to need more than Node 20, but that is an expectation, not a
> measurement — a Node 20 job would need a pnpm old enough to run there.

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
mrgr-db init   --db PATH
mrgr-db import --db PATH (--corpus FILE | --evidence FILE)
mrgr-db export --db PATH --out DIR [--with-blobs]
mrgr-db verify --db PATH
```

Errors are a single JSON `ToolError` on stderr; exit 0 on success, 1 otherwise (`mrgr-db` also uses 2 for a usage mistake — an unknown or missing flag — distinct from 1 for a failure while doing the work asked). The corpus is append-only JSONL, resumable by `(repoId, mergeSha, baselineId)`, and fails closed on a malformed record rather than skipping it.

## Status

| Component | State |
|---|---|
| `mrgr-db` — workspace SQLite store (mrgr-db/1) | works: corpus + evidence + ledger + runs; canonical export; JSONL import |

## Persistence

`mrgr-db` is the workspace store; JSONL (corpus, sidecar evidence, and `mrgr-db export`'s output) is the transport format. Committed evidence in this repository stays exported JSONL rather than a binary `.db` file — that is what gets reviewed and diffed. `tursodb` may inspect the database file read-only for ad-hoc queries while no writer has it open; querying it while `mrgr-db` is running is not something this package tests or supports. Node ≥ 22.5 is required — `node:sqlite`, which the store is built on, does not exist before that.

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
