# M0 closure evidence

Produced by `scripts/capture-evidence.sh` from a clean clone.
This file describes commit `ed928032d4c2786988f1ec8a279975894f099553`, which is its own parent.

| Field | Value |
|---|---|
| Commit | `ed928032d4c2786988f1ec8a279975894f099553` |
| Tree | `072e1d97f102ba2be49ad369481e8dd41f292815` |
| Archive SHA-256 | `1c9f2412a8ecc9624f58c3177a7ee7c113414a1a801285ece947707a675079fe` |
| node | `v25.1.0` |
| pnpm | `11.3.0` |
| git | `git version 2.55.0` |
| Host | `Linux 7.1.3-273-tkg-bore` |

### pnpm install --frozen-lockfile

```

devDependencies:
+ @types/node 20.19.43
+ tsx 4.23.12
+ typescript 5.9.3
+ vitest 2.1.9

Done in 497ms using pnpm v11.3.0
```

### pnpm -r typecheck

```
$ tsc -p tsconfig.json --noEmit
exit=0
```

### pnpm -r test

```
 ✓ tests/evaluation/report.test.ts (5 tests) 3ms
 ✓ tests/evaluation/types.test.ts (4 tests) 3ms
 ✓ tests/evaluation/classify.test.ts (27 tests) 6ms
 ✓ tests/evaluation/corpus.test.ts (20 tests) 23ms
 ✓ tests/evaluation/localize.test.ts (10 tests) 88ms
 ✓ tests/evaluation/cli.test.ts (4 tests) 208ms
 ✓ tests/evaluation/acquire.test.ts (20 tests) 321ms
 ✓ tests/evaluation/materialize.test.ts (8 tests) 337ms
 ✓ tests/evaluation/git.test.ts (9 tests) 431ms
 ✓ tests/evaluation/replay.test.ts (13 tests) 546ms
 Test Files  10 passed (10)
      Tests  120 passed (120)
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
{"kind":"not-found","operation":"read corpus","message":"Corpus file does not exist","details":{"path":"/nonexistent.jsonl","code":"ENOENT"}}
exit=1 (expected 1)
```

## What this does NOT establish

- Nothing about resolution: no mechanism, oracle, ledger or adjudicator exists in this commit.
- Nothing about real-world recall or precision. The suite is fixture-scale; `git.test.ts`
  deliberately builds a fake `git` executable rather than exercising a real one.
- Nothing about publishability: the rights attestation in NOTICE is still unrecorded.
- Nothing about other platforms. One host, one Node, one Git, recorded above.
