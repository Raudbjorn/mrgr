# @mrgr/mechanisms

Three file-level engines (`git_text`, `gnu_diff3`, `mergiraf`) with a Git merge-driver entrypoint. Git selects attributes and constructs the returned tree/index; the library's `mergeFiles` helper remains a per-file batch API.

## Git integration

Build with `pnpm --filter @mrgr/mechanisms build`. Install Mergiraf 0.19.0 and put the package's `mrgr-merge-driver` executable on PATH. The external engine remains a separate executable; it is not bundled into this package. The [Mergiraf installation instructions](https://mergiraf.org/installation.html) describe Cargo and binary distributions.

Configure the repository that will be merged:

```sh
git config merge.mergiraf.driver 'mrgr-merge-driver mergiraf %O %A %B %L %P'
git config merge.mergiraf.recursive binary
export MRGR_MECHANISM_LOG_DIR=/absolute/path/to/run/invocations
```

Example `.gitattributes`:

```gitattributes
*.rs merge=mergiraf conflict-marker-size=7
*.ts merge=mergiraf conflict-marker-size=7
*.tsx merge=mergiraf conflict-marker-size=7
*.bin -text -diff merge=binary
*.png -text -diff merge=binary
```

Register `git_text` or `gnu_diff3` in the same way when selecting another engine. Do not set `merge.default=mergiraf`. Git's native attribute precedence and binary driver are authoritative; the simplified library glob helper is not used by the CLI. The driver accepts positive integer marker widths up to 1,048,576 and regular input files, and returns 130 on malformed or oversized arguments. Git and Mergiraf honor the requested width; GNU diff3 emits its native seven-character markers. Receipts record both requested and emitted widths; the driver does not rewrite source text to resize GNU markers. Git expands and quotes its placeholders; retain the `%O %A %B %L %P` form shown in the [official driver contract](https://git-scm.com/docs/gitattributes#_defining_a_custom_merge_driver).

## Evidence and failure handling

Each invocation reserves its own private JSON record before engine execution. Staging and atomic rename protect `%A`; raw bytes and file mode are preserved. `started`/`prepared` records are incomplete evidence. Only `completed` records paired with the caller's actual outer Git status establish a completed invocation. Log or replacement errors return 130; post-replacement log failure preserves the committed merge, reports `committed: true` on stderr, and returns 130. A failed receipt never restores stale pre-merge content. No filesystem transaction across the log and output is claimed.

`rawStatus` is the actual exit code or null when no exit code exists; `signal`, `error` and `stderr` preserve failure information. This corrects the former synthetic raw-130 behavior, so TypeScript callers must handle nullable `rawStatus`. `normalizedStatus` is 0, 1 or 130. The CLI adds `driverStatus` and separate engine status fields; engines not selected have null status. A driver cannot observe its parent's eventual exit code: callers must capture outer Git status separately, as the integration tests and preflight do. Exit 1 retains unresolved residue; a fatal merge is not a usable tree.

Timeout is controlled by `MRGR_MECHANISM_TIMEOUT_MS` (default 30 seconds); subprocess output is capped at 16 MiB and overflow fails closed. `MERGIRAF_BIN` selects the executable. Mergiraf's internal text fallback is not labeled native structural success merely because its process returned zero.

## Verification

```sh
pnpm --filter @mrgr/mechanisms test
```

The required Git integration gate fails if Mergiraf 0.19.0 is unavailable. CI installs that version with Cargo's locked dependencies. Tests cover real attributes/config, shell-sensitive paths, clean Git-ort equivalence, mixed binary preservation in both path orders, separate raw/driver/outer statuses, fatal errors, and five-run **tree** determinism.

[The frozen Phase 4 evidence](../../evidence/m2a/2026-09-06/README.md) contains public Git bundles plus a hash-pinned summary of the separately retained private fork preflight. Fewer unresolved paths do not establish behavioral correctness or mechanism superiority.
