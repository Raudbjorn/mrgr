# WP0 merge-replay source note

> Carried verbatim from the semantic-merge research tree. Only relative
> links were repathed for this monorepo layout; no prose was changed.

## Result

WP0 adopts the reviewed handoff's useful Git-level mechanisms but corrects its sampling, replay, localization, schema, and historical-claim faults. The implementation is TypeScript under [`src/evaluation`](../../packages/core/src/evaluation/); the Python handoff was reviewed as design input. This note does not claim that Python source was copied or executed to produce the implementation or corpus.

## Reviewed input

The reviewed input is the four-file set at:

```text
/home/svnbjrn/rsrch/projects-mrgr/sources/conflict-language/README.md
/home/svnbjrn/rsrch/projects-mrgr/sources/conflict-language/replay.py
/home/svnbjrn/rsrch/projects-mrgr/sources/conflict-language/classify.py
/home/svnbjrn/rsrch/projects-mrgr/sources/conflict-language/acquire.py
```

Useful source anchors:

| Source range | Reviewed idea or fault |
| --- | --- |
| `README.md:20-45` | Object-database replay and stage 1/2/3 meaning. |
| `README.md:46-83` | Blobless full-ancestry acquisition, plus the unsafe exact-path negative prefilter. |
| `README.md:123-173` | OID-only corpus intent, normalized triples, and schema-v1 path-level/distance claims. |
| `README.md:202-227` | Historical replay caveats, squash/octopus exclusions, committed-resolution caveat, and first-base handling. |
| `acquire.py:1-29` | Why partial is acceptable and shallow history is not. |
| `acquire.py:97-167` | Deterministic cached bare clone and fresh-clone cleanup. |
| `acquire.py:188-204` | Batched object-read motivation. |
| `replay.py:38-66` | Conflict-stage parsing and nullable stages. |
| `replay.py:82-118` | Exact two-parent enumeration and the rejected graph-order limit. |
| `replay.py:121-157` | All-base discovery and exact-path intersection. |
| `replay.py:160-217` | Rejected first-base selection, prefilter skip, and explicit-base replay. |
| `replay.py:220-282` | Merge-tree output/stage parsing and object lookup. |
| `replay.py:285-293` | `rev-list --count`; a reachability-set size, not shortest-path distance. |
| `classify.py:21-49,98-132` | File strata and conservative normalization. |
| `classify.py:85-95` | Rejected byte-size imbalance verdict. |
| `classify.py:141-193` | Normalized triple identity and rejected whole-file resolution classification. |

## Commands and semantics adopted

The current command shapes are authoritative; see [`acquire.ts`](../../packages/core/src/evaluation/acquire.ts), [`replay.ts`](../../packages/core/src/evaluation/replay.ts), and [`materialize.ts`](../../packages/core/src/evaluation/materialize.ts).

| Purpose | Command shape | Semantics |
| --- | --- | --- |
| Remote acquisition | `git clone --bare --filter=blob:none --no-single-branch https://HOST/OWNER/REPO.git CACHE` | Full ancestry for all branch tips, with tags handled by normal clone behavior and blobs fetched on demand; arbitrary custom refs are not claimed. |
| Candidate enumeration | `git log --min-parents=2 --max-parents=2 --format=%H%x00%P%x00%aI%x00%s -z [--since=ISO] REV` | Exactly two parents; no graph-order count limit. |
| Merge bases | `git merge-base --all P1 P2` | Preserve zero, one, or every multiple base. |
| Per-base counts | `git rev-list --count BASE..PARENT` | Commits reachable from the parent but not the base. This is a set cardinality. |
| Metric-only path overlap | `git diff --name-only --no-renames -z BASE PARENT` for both parents | Store the path-set intersection only for a single base; never use it to skip replay. |
| Natural replay | `git merge-tree --write-tree --messages -z P1 P2` | Let Git perform its natural `ort` replay and virtual-base synthesis; exit 0 is clean and exit 1 is conflicted. |
| Localization object read | `git show REVISION:PATH` | Read automatic and shipped blobs during initial localization; exit 128 is represented as absent evidence. |
| Materialization object read | `git show --end-of-options REVISION:PATH`; on exit 128, `git rev-parse --verify --end-of-options REVISION^{tree}` | Terminate option parsing before corpus-derived object expressions. Only an existing revision with an absent path becomes `null`; an unavailable revision returns `not-found`. |

The NUL-delimited merge-tree parser maps stage 1 to `base`, stage 2 to `ours`, and stage 3 to `theirs`. Each stage OID is nullable: add/add lacks a base; delete/modify can lack one side. The parser retains conflict messages and paths, rejects unknown output shapes, and records the automatic tree OID.

Before replay, WP0 inspects repository-local `merge.*.driver` configuration and quarantines any candidate repository with an external custom driver rather than executing it. Parent `.gitattributes` OIDs and a hash of relevant merge configuration preserve provenance without storing command text, configuration values, credentials, or remote URLs.

Before materialization, schema-v2 parsing validates every Git ObjectId as 40 or 64 lowercase hexadecimal characters and validates `baselineId` plus the nullable repository merge-config hash as SHA-256. Malformed corpus identities fail closed rather than reaching a Git object read.

## Ideas retained

| Idea | Why retained |
| --- | --- |
| Full-ancestry blobless bare mirrors | Merge-base correctness needs complete ancestry; source blobs can remain lazy. |
| Git CLI object-database replay | It preserves Git's own merge semantics without a checkout, worktree, or index. |
| Exact two-parent enumeration | It gives one well-defined candidate class and excludes squash/octopus ambiguity. |
| Stage 1/2/3 mapping with absent stages | It represents content, add/add, and delete/modify inputs without inventing blobs. |
| Append-only resumable JSONL | Long scans retain completed records and resume by repository, merge, and baseline identity. |
| Conservative normalization and localized triple hashes | They distinguish whitespace dissolution and repeated local input triples without storing source in the canonical corpus. |
| Category strata | Lockfiles, migrations, documentation, generated files, and other files can be reported separately without treating a filename heuristic as semantic truth. |

## Behaviors rejected

| Rejected behavior | Reason |
| --- | --- |
| Graph-order `--max-count` sampling | Traversal order biases the sample toward the branch Git visits first. `--since` is the implemented bound. |
| Exact-path intersection as a negative replay prefilter | File/directory and directory-rename interactions can conflict with an empty exact-path intersection. The metric is recorded, not trusted as proof of cleanliness. |
| Selecting the first merge base or passing an explicit base to replay | Criss-cross histories require Git's virtual-base synthesis. Every base is recorded and multiple-base results form a separate stratum. |
| Whole-file novelty classification | Disjoint auto-merged edits outside a conflict make an otherwise side-selected resolution look novel. WP0 classifies only conservatively localized regions. |
| Byte-size imbalance verdict | Byte deltas are not a structural conflict measure. WP0 stores raw line/byte counts without a balance headline. |
| Schema-v1 singular-base and distance names | They collapse multiple-base evidence and misname reachability-set sizes. Schema v2 stores all bases and per-base exclusive-commit counts. |
| Treating only conflicted successes as corpus records | It erases denominators. WP0 persists clean, conflicted, unrelated, quarantined, and error candidates. |
| Treating a committed resolution as semantic ground truth | It is observed shipped output and may be mistaken or policy-driven. Semantic adjudication remains outside WP0. |
| Historical lower-bound claim | Modern replay can add as well as miss conflicts relative to history. It measures neither historical incidence nor a bound on that incidence. |

The resulting behavioral contract is specified in [Chapter 02](02-wp0-measurement.md).
