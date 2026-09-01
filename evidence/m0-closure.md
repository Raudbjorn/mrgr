# M0 closure evidence

Produced by `scripts/capture-evidence.sh` from a clean clone.
This file describes commit `185bc9219e1f181b49d9f7cb2b474c9b3f18e771`, which is its own parent.

| Field | Value |
|---|---|
| Commit | `185bc9219e1f181b49d9f7cb2b474c9b3f18e771` |
| Tree | `bcf1947f2456033b20fb0896f4cf70993d6fd03e` |
| Archive SHA-256 | `f4c179c1b10194d437bce9d19b186d3cc4a3a50b582ed7e2b6f28e7086af6396` |
| node | `v25.1.0` |
| pnpm | `11.3.0` |
| git | `git version 2.55.0` |
| Host | `Linux 7.1.3-273-tkg-bore` |

### pnpm install --frozen-lockfile

```

devDependencies:
+ @types/node 22.20.1
+ tsx 4.23.12
+ typescript 5.9.3
+ vitest 3.2.7

Done in 532ms using pnpm v11.3.0
```

### pnpm -r typecheck

```
$ tsc -p tsconfig.json --noEmit
exit=0
```

### pnpm -r test

```
 ✓ tests/evaluation/classify.test.ts (27 tests) 6ms
 ✓ tests/evaluation/report.test.ts (5 tests) 3ms
 ✓ tests/m1a/sidecar.test.ts (18 tests) 36ms
 ✓ tests/evaluation/corpus.test.ts (20 tests) 48ms
 ✓ tests/db/llama-cpp-cli.test.ts (6 tests) 72ms
 ✓ tests/db/run-store.test.ts (9 tests) 149ms
 ✓ tests/evaluation/localize.test.ts (10 tests) 156ms
 ✓ tests/db/llama-cpp-run-store.test.ts (10 tests) 167ms
 ✓ tests/m1a/h0-aggregate.test.ts (10 tests) 158ms
 ✓ tests/db/import.test.ts (5 tests) 134ms
 ✓ tests/m1a/h0-evidence-scripts.test.ts (10 tests) 299ms
 ✓ tests/db/ledger-store.test.ts (9 tests) 121ms
 ✓ tests/db/cli.test.ts (12 tests) 179ms
 ✓ tests/db/blob.test.ts (11 tests) 132ms
 ✓ tests/evaluation/types.test.ts (4 tests) 5ms
 ✓ tests/db/export.test.ts (12 tests) 245ms
 ✓ tests/db/open.test.ts (5 tests) 74ms
 ✓ tests/evaluation/git.test.ts (9 tests) 504ms
 ✓ tests/evaluation/cli.test.ts (4 tests) 423ms
 ✓ tests/evaluation/acquire.test.ts (20 tests) 600ms
 ✓ tests/evaluation/materialize.test.ts (8 tests) 623ms
 ✓ tests/db/corpus-store.test.ts (10 tests) 827ms
 ✓ tests/db/concurrency.test.ts (2 tests) 644ms
 ✓ tests/m1a/forensic.test.ts (23 tests) 894ms
 ✓ tests/evaluation/replay.test.ts (13 tests) 955ms
 ✓ tests/m1a/cli.test.ts (4 tests) 1085ms
 ✓ tests/db/evidence-store.test.ts (17 tests) 1259ms
 ✓ tests/m1a/h0-load.test.ts (6 tests) 1580ms
 Test Files  28 passed (28)
      Tests  299 passed (299)
```

### pnpm -r build

```
$ tsc -p tsconfig.build.json
dist entrypoint present: yes
```

### scripts/verify-carried.sh

```
carried modules verified: 24 files unmodified
```

### scripts/verify-carried-selftest.sh

```
verify-carried selftest passed: modification rejected, addition rejected, clean tree accepted
```

### packaged CLI smoke

```
WP0 merge forensics

Usage:
--- structured error path ---
(node:1719138) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)
{"kind":"not-found","operation":"read corpus","message":"Corpus file does not exist","details":{"path":"/nonexistent.jsonl","code":"ENOENT"}}
exit=1 (expected 1)
```

## What this does NOT establish

- Nothing about resolution: no mechanism, oracle, ledger or adjudicator exists in this commit.
- Nothing about real-world recall or precision. The suite is fixture-scale; `git.test.ts`
  deliberately builds a fake `git` executable rather than exercising a real one.
- Nothing about other platforms. One host, one Node, one Git, recorded above.
