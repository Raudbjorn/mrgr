# Behavioral evaluator feasibility: libgit2

One fresh historical C merge now has a concrete executable development oracle. This is a feasibility case, not the planned 60-case development cohort or a confirmation result.

The earliest eligible event in deterministic SHA/path/ordinal order is `190a4c55df72b32adf4d60f77cbc47276b74f84b`, `src/libgit2/repository.c`, hunk 1. Its two branches add `load_grafts` and environment-aware repository discovery. Tests inherited unchanged from the respective parents establish shallow-graft behavior and `GIT_DIR` handling without inferring expected behavior from the historical replacement.

| Candidate | Build exit | Behavioral exit | Interpretation |
|---|---:|---:|---|
| Historical reference, repetition 1 | 0 | 0 | 15 checks pass |
| Historical reference, repetition 2 | same build | 0 | repeatable |
| Historical reference, repetition 3 | same build | 0 | repeatable |
| Wrong shallow filename | 0 | 5 | five assertions reject compiling wrong behavior |
| Ignore `GIT_DIR` | 0 | 1 | environment assertion rejects compiling wrong behavior |

See [proof.json](proof.json), the individual logs, and [inventory.json](inventory.json). The conservative freshness audit excludes a merge SHA whenever that 40-character value occurs in any pre-v3 H0 JSON/JSONL; [exposure-sources.json](exposure-sources.json) records the audited files and hashes. Across the existing libgit2 and Redis materializations, 37 C/Go hunks in 14 events remain fresh, all in libgit2. Only the earliest event was built; the other 13 are candidates, not validated cases. This frame cannot provide 60 independent development events, 400 confirmation events, or 12 repositories.

## Inputs and reconstruction

The reusable machine input is `.do-not-commit/h0-v3-behavior/pilot.json`, containing the base/parent hunk bytes, historical reference, exact focal byte interval, target preimage hash, two mutations, and evaluator paths. Source is the local bare clone of [libgit2](https://github.com/libgit2/libgit2). The private directory also contains the source archive, scaffold, build logs and two oracle scripts.

The scaffold is the historical merge tree with only the focal replacement removed and replaced by conflict markers. All non-target bytes are therefore common evaluation-only state. This establishes focal behavior conditional on that scaffold; it does not prove the full historical merge can be reconstructed or that other merged changes are correct. Neither scaffold nor historical reference may enter solver context. Parent snapshots remain the sole source for retrieval.

The inherited test files are `tests/libgit2/grafts/shallow.c` from parent `e288f874a3a73ef31f88bb524f6d25d5ff3c5a3a` and `tests/libgit2/repo/env.c` from parent `8a62616f43fe5ea37d41296f40293ff97aa88cfa`. Each is byte-identical to the evaluation copy; hashes are in the proof. Revision-specific `COPYING` remains in the scaffold.

## Reproduction and limits

The root v3 prepare operation consumes `pilot.json` and repeats reference and mutation validation using its sandbox. Oracle build argv is `/bin/sh /oracle/build.sh`; test argv is `/bin/sh /oracle/test.sh`. Build uses CMake with `BUILD_TESTS=ON`, `BUILD_CLI=OFF`, `USE_SSH=OFF`, and `USE_HTTPS=OFF`, followed by `cmake --build /work/.build -j 4`. Tests run `libgit2_tests -sgrafts::shallow -srepo::env` from a writable temporary directory.

This lane's initial trusted reference/mutation compilation ran on the host. Executions used Bubblewrap `--unshare-all --clearenv`, read-only `/usr` and source/build mounts, fresh `/tmp`, no credentials and no network. They are feasibility evidence; the root's complete build-and-test sandbox receipt is the production admission check. No OCI image digest is claimed. No model requests, confirmation scoring, correctness rate, cross-repository generalization or `MEASURABLE=YES` is inferred from this pilot.

## Go expansion

A second pilot is available as `.do-not-commit/h0-v3-behavior/pilot-go.json`: `cli/cli` event `026dc4657a2ca768b039f726ebd7ea32d1893903`, `pkg/cmd/run/run.go`. Its parents independently register `download` and `watch` commands. The evaluator checks both remain registered and runs the existing download/list/rerun/view/watch package tests. The behavioral claim concerns command availability, not remote Actions service correctness. Both compiling mutations remove one registration while retaining constructor evaluation; the new assertion rejects each. Reference tests passed three host repetitions; root admission repeats the entire offline sandbox procedure.

[go-proof.json](go-proof.json) records parent assertions and existing test-file provenance. Five of six existing test files match a parent byte-for-byte; the remaining file is common evaluation scaffold regression coverage, not evidence for a newly inferred expected behavior. Dependencies are vendored from the revision's `go.mod` and `go.sum` and remain inside the frozen private scaffold.

This expansion uses the root v3 freshness definition: events in prior v2 inputs, plus archived model trial IDs joined back to corpus event identities. Merely appearing in a raw corpus or provenance inventory is not model exposure. The earlier libgit2-only inventory applied the stricter any-SHA rule and is preserved as that scoped audit; its counts are not the full acquisition frame.

Ordered inspection reached this Go pilot after an import-only focal conflict (`00e8c070`), a deferred complex codespaces API oracle (`017632d6`), and a repository-create reference (`01bcdbc8`) that compiles but fails three existing URL-output assertions; its [failure log](go-reference-test.log) is retained. These are development feasibility choices, not an unbiased population sample or evidence of baseline inferiority. No baseline/model outputs were used to choose the command-registration case.
