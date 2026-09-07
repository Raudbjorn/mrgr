# H0 v3 acquisition continuation — round six

The [fresh inventory](development-inventory.json) contains **18 admitted, unexposed cases across eight verified repository lineages**. This round adds five cases: one DNS, three Pelletier TOML and one BurntSushi TOML. All pass three reference runs and reject two compiling wrong resolutions in full admission. Whole-inventory event/content/parent grouping passes. Development still needs 42 fresh admitted cases before executing its 60-case matrix. **MEASURABLE=NO; no new solver requests.**

| Admission | Event | Target |
|---|---|---|
| [DNS](dns-admission/) | `5c37b9e564de3a3d5c5d2463b641b7869bbb700d` | `server.go` |
| [Pelletier TOML](toml-admission/) | `daad45893b61648c9081cf294d58f77c9684382b` | `marshaler.go` |
| [Pelletier TOML](toml-admission/) | `1fe62f3000bea76f82b2ace5624e22712d1aca16` | `queryparser.go` |
| [Pelletier TOML](toml-admission/) | `288db0c1dbd69fa679fe375272ccd73020bf21a6` | `unmarshaler.go` |
| [BurntSushi TOML](burntsushi-admission/) | `4a2c3ba5899eff0d2d1fa947928f30835482827b` | `type_fields.go` |

## Acquired histories

[Acquisition receipts](acquisition.json) freeze HEADs, timestamps, raw scan/triple files and hashes for seven additional Go repositories. They yield 487 native merge replays and 58 localized hunks. Reusing the earlier BurntSushi history adds no new replay count. These repositories were deliberately selected; this is not a probability sample of software projects.

| Repository | Replayed merges | Localized hunks |
|---|---:|---:|
| google/go-cmp | 4 | 0 |
| go-yaml/yaml | 61 | 4 |
| google/btree | 10 | 0 |
| miekg/dns | 300 | 33 |
| pelletier/go-toml | 35 | 14 |
| gorilla/websocket | 39 | 0 |
| hashicorp/golang-lru | 38 | 7 |

Zero-yield histories and failed candidates remain recorded in the [screening summary](screen-summary.json) and corresponding frozen frames. Screen versions overlap and are not independent observations.

## Repairs supported by observed failures

The shared Git verifier previously tried to read a base blob even for genuine add/add conflicts. It now checks the base tree and uses empty bytes when that path is absent. Parent paths must still exist, the base commit must be valid, and native Git conflict reproduction and exact historical localization remain mandatory. A real temporary Git add/add fixture checks success, invented base text, an invalid base commit and a missing parent. All ten [runner checks](runner-checks.txt) pass.

The acquisition helper normalizes materializer null base text to empty text and freezes the complete existing instrument source hashes. Earlier excluded screens did not include those imported-source hashes; their limitations are preserved rather than retroactively relabeled. Each final admission archives the complete instrument it used. Final development must be prepared again with the current instrument.

The acquisition-only reference-size cap increased from 3,000 to 8,192 bytes to inspect a real 6,247-byte add/add hunk. The new cap is explicit in frozen profiles. Primary scoring, provider limits, effect thresholds, cohort sizes, cluster constraints and oracle requirements did not change. The helper remains restricted to production Go targets, one eligible hunk per event and eight automatic mutation attempts. Larger hunks, test-only conflicts and other languages remain outside this acquisition profile, not proven outside the research claim.

## Historical execution compatibility

YAML initially failed to build because its historical test dependency was absent. The helper can now copy an explicitly supplied, hash-frozen legacy GOPATH into the read-only oracle and map the historical self-import path. [Dependency provenance](yaml-dependency-provenance.json) pins Go Check to `91ae5f88a67b14891cfd43895b01164f6c120420`, the latest reachable commit dated before the YAML merge. This reconstructs an execution dependency; it does not establish the original CI pin. Source bytes are unmodified. YAML then compiles but fails three original tests and stays excluded. This demonstrates the dependency path without converting an invalid reference into a pass.

BurntSushi TOML's original `out_test.go` calls `flag.Parse` during package initialization, before modern Go registers `-test.v`. The [additive compatibility file](burntsushi-compat-oracle/000_h0_init_test.go) calls idempotent `testing.Init` from a lexically earlier test init. The [build command](burntsushi-compat-oracle/build.sh) copies only that new file. All original production files, tests, assertions and fixtures remain intact. The original rejection and compatibility [reference receipt](burntsushi-compat-receipt.json) remain available.

The first eight automatic mutations did not demonstrate sensitivity for the larger file. An explicit [field-discovery mutation audit](burntsushi-compat-targeted-mutations.json) retains a surviving tag mutation and a rejected exported-field-filter mutation. A separate [anonymous-field mutation](burntsushi-compat-embedding-mutation.json) is also rejected. Those two compiling, behavior-changing failures qualify the finite oracle; no claim of complete semantic equivalence follows. No mutation or compatibility work used solver outcomes.

## Verification and next evidence

The [acquisition check](screen-checks.txt) passes, including mutation scope and shell-path checks. Actual frozen YAML execution checks the reconstructed dependency path, and native admission validates each added case's full scaffold, lineage, executable oracle and deterministic baselines. The model-exposed pilots remain excluded.

Reprepare the complete 60-case development cohort with the final instrument, run both Mercury-2 and MiniMax-M3, audit clustered inference and joint power, then freeze and execute an independent powered confirmation. The existing 400–2,000-case confirmation grid, at least 12 lineage clusters, 15% concentration cap and replicated superiority rule remain in force. Phase 4's completed integration handoff and Phase 5's separate resurrection-proof scope remain unchanged.
