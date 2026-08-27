# Chapter 02 — WP0 measurement

> Carried verbatim from the semantic-merge research tree. Only relative
> links were repathed for this monorepo layout; no prose was changed.

## Verdict

**WP0 is runnable measurement code.** It can enumerate, replay, localize, classify, report, and locally materialize exact two-parent merge candidates. It has not produced a real ≥200-conflict corpus result, and it establishes no verdict for RQ1–RQ6. The disposable three-merge fixture verifies the pipeline contract, not the research hypotheses.

The miner measures conflicts produced by one pinned modern-Git replay. It does not recover the historical conflict event.

## Eligibility and evidence funnel

Each narrowing step remains visible in schema-v2 records; a candidate is not silently discarded because it fails to reach exact region evidence.

| Step | Rule | Recorded outcome or next evidence |
| --- | --- | --- |
| 1. Candidate | `git log` selects commits with exactly two parents. Squash commits have one parent; octopus merges have three or more. | One record per exact two-parent candidate. |
| 2. Topology | Attempt to discover every merge base for `P1` and `P2`. | On successful discovery, zero bases becomes `unrelated`; `single` and `multiple` remain separate strata. A pre-topology failure uses the error placeholder below. |
| 3. Reachability | For every base, count commits reachable from each parent but not that base. | Per-base reachability-set sizes; never graph distance. |
| 4. Metric-only overlap | For single-base candidates, compute `changed(base,P1) ∩ changed(base,P2)` with rename detection off. | Stored as `changedPathIntersection`; an empty set never skips replay. |
| 5. Quarantine | Inspect repository-local external merge-driver configuration before replay. | `unsupported-custom-driver`; the driver is not executed. |
| 6. Replay | Run the natural two-parent merge under the pinned baseline. | `clean`, `conflicted`, or structured `error`; unrelated and quarantined records remain in the corpus. |
| 7. Conflict path | Parse Git's NUL-delimited tree OID, stage entries, and conflict messages. | Conflict paths, stage OIDs, and the automatic tree OID. |
| 8. Region localization | Align complete diff3 marker blocks in the automatic blob with zero-context diffs to the shipped merge blob. | `exact`, `ambiguous`, `unsupported-binary`, or `unsupported-structural`. |
| 9. Classification | Compare only exact localized resolution spans with localized base/ours/theirs spans. | Raw class, normalized novelty, region triple key, and resolution digest. |
| 10. Aggregate evidence | Report exact-region distributions and repeated localized triples. | Novelty and deterministic-ambiguity evidence excludes inexact regions. |

Multiple-base candidates are replayed without choosing a base and without an explicit merge-base argument, allowing Git to synthesize its virtual base. Exact-path overlap is metadata only because directory renames and file/directory interactions can conflict without an identical path on both sides.

## Pinned replay baseline

`baselineId` is the SHA-256 digest of this exact tuple:

| Component | Pinned value |
| --- | --- |
| Corpus schema | `2` |
| Git | Exact raw `git --version` output |
| Environment policy | `isolated-v1` |
| Replay command shape | `merge-tree --write-tree --messages -z P1 P2` |
| Normalization | `v1` |

`isolated-v1` inherits only the paths and network/TLS variables needed to run Git, fixes `LC_ALL=C`, disables system/global Git configuration and replacement objects, disables optional locks and terminal prompting, and never records environment values. Provenance separately records the `ort` strategy label, each parent's `.gitattributes` blob OID when present, and a hash of relevant repository-local merge configuration.

Resume identity is:

$$
(\text{repositoryId},\ \text{mergeSha},\ \text{baselineId})
$$

A Git-version change therefore cannot silently reuse earlier measurements. A report containing multiple baseline IDs must select one with `--baseline`.

## Schema-v2 canonical record

The canonical JSONL stores evidence coordinates and hashes, not source text. Schema-v1 records are incompatible and rejected.

Corpus parsing is a trust boundary: every Git ObjectId must be 40 or 64 lowercase hexadecimal characters, while `baselineId` and the nullable repository merge-config hash must be SHA-256. Invalid identities are rejected before materialization can invoke Git.

| Field | Contract |
| --- | --- |
| `schemaVersion` | Literal `2`. |
| `repository` | Union: remote `{kind,id,host,slug,cacheKey}` or host-local `{kind,id,absolutePath}`. |
| `merge` | `{repositoryId,sha,parents:[P1,P2],authorDate,subject}`; the parent tuple has exactly two OIDs. |
| `baselineId` | Hash of the pinned-baseline tuple above. |
| `replayProvenance` | Raw Git version, `merge-tree-write-tree`, `ort`, `isolated-v1`, normalization `v1`, nullable parent attribute OIDs, and nullable merge-config hash. |
| `mergeBases` | Every merge-base OID, including multiple bases. |
| `baseTopology` | `single`, `multiple`, or `none`. |
| `baseReachabilityCounts` | One `{baseSha,oursExclusiveCommits,theirsExclusiveCommits}` per base. Counts are reachability-set sizes. |
| `changedPathIntersection` | Exact-path intersection for single-base candidates; otherwise `null`. Metric only, never a replay gate. |
| `replayStatus` | `clean`, `conflicted`, `unrelated`, `unsupported-custom-driver`, or `error`. |
| `automaticTreeOid` | Automatic replay tree OID when available; otherwise `null`. |
| `conflictPaths` | Ordered paths reported by Git. |
| `conflictRegions` | Region identity, category, Git conflict kind, localization status, nullable stage OIDs, ranges, raw/normalized digests, raw line/byte counts, class, normalized-novel flag, and triple key. |
| `error` | Optional structured `{kind,operation,message,details}` for expected repository, Git, parsing, configuration, or corpus failures. |

Candidate-level failures that occur before topology or full provenance discovery are still persisted. Their placeholder fields are `mergeBases=[]`, `baseTopology="none"`, `baseReachabilityCounts=[]`, `changedPathIntersection=null`, `automaticTreeOid=null`, and empty conflict paths/regions. They carry minimal provenance—raw Git version plus the pinned algorithm, strategy, environment, and normalization labels, with null parent-attribute OIDs and merge-config hash—and `error.details.provenance="minimal-candidate-error"`. This placeholder `none` is **not evidence of unrelated histories**. Reports count the record under `error` because `replayStatus="error"` is authoritative.

For an exact region, `automaticRanges.{base,ours,theirs}`, `resolutionRange`, `rawDigests`, `normalizedDigests`, and `rawCounts` are complete. `rawCounts` stores `{lines,bytes}` separately for base, ours, theirs, and resolution; it is descriptive evidence, not a balance verdict. Exact regions have a non-null `tripleKey`, a non-ambiguous `resolutionClass`, and a Boolean `novelAfterNormalization`.

For ambiguous or unsupported regions, any unavailable range, digest, or raw count is `null`; `resolutionClass` is `ambiguous`, and novelty and triple key are `null`. `stageOids.base`, `.ours`, and `.theirs` are independently nullable because add/add and delete/modify conflicts can lack a stage.

All `LineRange` values are **1-based and end-exclusive**. Automatic ranges address the automatic replay blob; the resolution range addresses the shipped merge blob.

## Conservative localization and classification

An exact region starts with one complete, well-formed diff3 block from the automatic replay blob. The block must be explained by zero-context diff hunks against the shipped merge:

- every selected hunk is contained within that block and touches no second block;
- the first and last hunks cover the full marker-block boundaries;
- one hunk may replace the block directly; or, under the ledger-approved narrow edit-group rule, multiple hunks may be grouped when each unchanged gap has the same non-negative line extent on the automatic and shipped sides.

The edit-group rule admits Git-selected-side resolutions that Git's diff splits around unchanged lines without admitting arbitrary gaps. A partial block replacement, a hunk crossing blocks, or an unexplained gap is ambiguous. Missing or malformed markers are ambiguous. Binary content and non-content structural conflicts are unsupported. The miner does not synthesize an alternative preimage with `merge-file` or any heuristic fallback.

Exact spans are classified by raw equality in this order: `deleted`, `ours`, `theirs`, `base`, then `novel`. Normalization v1 separately canonicalizes line endings, expands tabs to four spaces, strips trailing horizontal whitespace, collapses repeated blank lines, and trims outer blank lines. It does not make an inexact region classifiable.

## Report denominators

Let $N_x$ be the number of exact localized regions in the selected baseline.

| Measure | Definition |
| --- | --- |
| Replay attempted | $N_{attempt}=N_{clean}+N_{conflicted}$ |
| Pinned modern replay incidence | $N_{conflicted}/N_{attempt}$; unrelated, quarantined, and error records remain reported but outside this denominator. If $N_{attempt}=0$, it is not measurable. |
| Exact resolution share for class $c$ | $\#\{x: class(x)=c\}/N_x$ |
| Normalized-novel share | $\#\{x: novelAfterNormalization(x)=true\}/N_x$ |

For each localized triple key $g$, let $n_g$ be its number of exact regions and $n_{g,r}$ the number with normalized resolution digest $r$. The observed deterministic ambiguity floor is:

$$
\frac{\sum_g\left(n_g-\max_r n_{g,r}\right)}{N_x}
$$

Singleton groups contribute zero. If no localized triple key repeats, the report says `observed deterministic ambiguity floor: not measurable (no repeated localized triples)` rather than reporting zero. This is an observed floor for deterministic functions of the localized inputs under this corpus and baseline; it is not a verdict about semantic correctness.

Reports show single-base and multiple-base candidate, replay, and exact-region counts separately. They also print `historical conflict incidence: not measured`.

## Interpretation limits

The committed resolution is the **observed developer output that shipped**, not an oracle for semantic truth or intent. It may contain mistakes, policy compromises, or later-fixed behavior. Corpus collection, replay localization, and mechanical resolution classification stop before semantic adjudication; RQ1–RQ6 require separately designed evidence.

Modern replay differs from the historical environment. Strategy changes, attributes, custom drivers, configuration, `rerere`, and repository state can make a historically conflicted merge replay clean or a historically clean merge replay conflicted. Modern replay can therefore create both false negatives and false positives relative to the historical event. Its incidence is neither historical incidence nor a lower bound on it.

Squash merges are outside the candidate set because they are not exact two-parent merge commits. Octopus merges are excluded because their conflict semantics differ. Repositories that favor either policy are not evidence of low historical conflict incidence.

## Run locally

Git 2.38 or newer, Node 20 or newer, and pnpm 9 are required.

```bash
pnpm wp0 scan-local /absolute/path/to/repository \
  --out corpus.jsonl \
  --since 1970-01-01

pnpm wp0 report corpus.jsonl

pnpm wp0 materialize corpus.jsonl \
  --out evaluator.jsonl
```

`scan-local` accepts `--rev RANGE` and `--jobs 1..32`; the default revision is `--all` and the default worker count is 4. `report` and `materialize` accept `--baseline ID`; `materialize` also accepts `--cache DIR` for reopening remote mirrors.

Materialization emits only exact regions. Before any Git object read, schema-v2 parsing validates every Git ObjectId and the baseline/config hashes described above. It then reopens the referenced repository and reads automatic and shipped blobs with `git show --end-of-options REVISION:PATH`. If that returns exit 128, `git rev-parse --verify --end-of-options REVISION^{tree}` distinguishes an existing revision with an absent path (`null`) from an unavailable revision (`not-found`). Materialization slices stored ranges and verifies raw/normalized digests, raw counts, triple keys, and resolution digests before writing source-bearing evaluator JSONL. `base`, `ours`, or `theirs` is `null` when its Git stage is absent. `base_reachability` is present only for single-base records. This output is intentionally local and potentially source-bearing; the canonical corpus remains coordinate-and-digest evidence.

See the [reviewed source note](wp0-merge-replay.md) for command provenance and rejected behaviors, and the [primary index](../../README.md) for repository status.
