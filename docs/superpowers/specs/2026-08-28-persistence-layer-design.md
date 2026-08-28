# Persistence layer: SQLite workspace database

**Status:** approved design, 2026-08-28.
**Scope decision (user):** everything in one database — corpus, evidence bundles, M4 ledger, experiment runs.
**Driver decision:** `node:sqlite` (built into Node ≥ 22.5).

## 1. Context

Every persistence surface in `@mrgr/core` today is a flat file: corpus JSONL
(`CorpusWriter`/`readCorpus`), the M1a evidence sidecar
(`corpus.evidence.jsonl`), materialized-triples JSONL, and the H0 runner's
per-record append files. An audit of all surfaces (this session, plus the
source study in `projects-mrgr`) found:

- **No durability primitives anywhere.** No `fsync`, no `flock`, no atomic
  rename in either repo. The only mutual exclusion is a non-recursive
  `mkdir` EEXIST reservation (`acquire.ts:276`).
- **Resume is O(whole file)** at every surface: `loadResumeKeys`,
  `loadEvidenceKeys`, and the H0 runner each re-read and re-parse the entire
  output file to build a key set.
- **Write-only data is possible.** semantic-merge writes `evidenceBundles`
  inline on `CorpusRecordV2`; `parseCorpusRecord` silently drops the field on
  read. No test caught it because the test bypassed `readCorpus`.
- **D90** (source study, `DECISIONS.md:238-253`): an append-only ledger with
  monotonic next-integer IDs produced two complete colliding D74–D81 series
  under concurrent writers, plus two earlier collisions. The study's own
  conclusion: content-derived or namespaced IDs, and the concurrency itself
  must be handled by the store, not by discipline.
- **Genre research** (2026-08-28, `~/deep-research-output/mrgr-persistence-genre/`):
  mrgr's genre — empirical-SE evidence/ledger harnesses — universally uses
  *content-addressed blob store + relational/KV index + flat-file export for
  distribution* (Software Heritage, World of Code, DVC, MLflow). Vector/search
  stores were evaluated and rejected: no similarity operation exists anywhere
  in the project, and the plan forbids lossy comparators as pass signals.

This design replaces JSONL **as storage**. JSONL remains the **transport**
format: import for existing artifacts, canonical export for distribution,
diffing, and the determinism gate.

## 2. Goals

1. One workspace database file (`mrgr.db` by default, path via `--db`) holding
   corpus records, conflict regions, evidence bundles, the M4 ledger, and
   experiment runs.
2. Durable, transactional, multi-process-safe appends (replaces the missing
   fsync/flock and the hand-rolled disciplines).
3. O(1) resume via primary-key lookup.
4. Schema-enforced invariants: the discriminated unions that
   `parseCorpusRecord` enforces in ~600 lines of hand-rolled validation are
   declared as CHECK constraints.
5. Content-addressed blob storage: preimages, hunks, and triple sides stored
   once, keyed by sha256, deduplicated.
6. Append-only ledger enforced by the store (triggers), with content-derived
   IDs — the D90 class of bug becomes impossible.
7. Canonical, byte-deterministic export, so the plan's "three runs
   byte-identical" gates keep a binding artifact.
8. Fail-closed opens: schema/version mismatch is a typed error, never a silent
   migration.

## 3. Non-goals

- **No modification to carried files.** `src/evaluation/*` and
  `tests/evaluation/*` stay byte-identical; `scripts/carried.sha256` and the
  120 carried tests continue to pass. The DB layer supersedes their storage
  role; it does not edit them.
- **No sync/replication.** tursodb's `--sync-server` is deferred until a
  consumer exists (same rule the plan applies to packages).
- **No vector/similarity operations.** Out of genre; see §1.
- **No auto-migration framework.** v1 ships with `user_version = 1` and a
  fail-closed check. Future versions add explicit migration commands.
- **No analytical sidecar.** DuckDB/Parquet is the genre's answer if volume
  reaches 10^6+ rows; current volumes (≤29 MB corpus, 2.9 M-row one-off
  imports) are inside SQLite's envelope.

## 4. Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Store | SQLite file, WAL mode | Genre standard at workshop scale; transactional; multi-process |
| Driver | `node:sqlite` (`DatabaseSync`) | Zero new runtime deps; sync API fits CLI; engines bump to `>=22.5.0` |
| tursodb role | Inspection shell / ad-hoc SQL only | File-format compatible (Turso 0.8.0-pre.1); concurrent cross-engine writes **unsupported and documented as such** |
| Schema version | `mrgr-db/1` in `meta`, plus `PRAGMA user_version = 1`, `PRAGMA application_id = 0x6D726772` (`"mrgr"`) | Namespaced-version convention from round 5; application_id lets `file`-level tools identify the DB |
| JSONL | Transport only | `import` reads legacy artifacts via the carried readers; `export` emits canonical JSONL |
| Committed evidence | Exported JSONL, never the binary DB | DB files don't diff; `evidence/` stays reviewable |
| IDs | Content-derived (sha256) or composite natural keys | D90; matches existing `baselineId`/`tripleKey` discipline |
| Durability | `synchronous=NORMAL` for corpus/evidence writes, `synchronous=FULL` inside ledger transactions | Ledger rows are the audit trail; corpus is regenerable |
| Validation | CHECK constraints in-schema + zod at the API boundary | Two layers, same shape; zod errors are typed `ToolError`s |

## 5. Architecture

```
packages/core/src/db/
  schema.sql        -- full DDL, single source of truth, embedded at build
  open.ts           -- openDb(path, {create}): fail-closed version checks, pragmas
  corpus-store.ts   -- CorpusStore: append/get/resumeKeys/iterate
  evidence-store.ts -- EvidenceStore: append/get/resumeKeys
  ledger-store.ts   -- LedgerStore: append (typed per record_type), read, verify
  run-store.ts      -- RunStore: experiment runs (H0-style)
  import.ts         -- legacy JSONL -> DB (uses carried readCorpus / readEvidence)
  export.ts         -- canonical deterministic JSONL export + manifest
packages/core/tests/db/
  *.test.ts         -- see §11
```

CLI: existing commands gain `--db PATH`; `mrgr-wp0 scan-local --db mrgr.db`
writes corpus records through `CorpusStore` instead of `CorpusWriter`.
`mrgr-evidence --db mrgr.db` writes bundles through `EvidenceStore`. New
commands: `mrgr db import <legacy.jsonl>`, `mrgr db export [--table T] --out DIR`,
`mrgr db verify` (integrity_check + foreign_key_check + schema-version check +
ledger chain re-verification).

The carried in-memory record types (`CorpusRecordV2`, `EvidenceRecord`) remain
the API currency; stores translate to/from rows at the boundary. Nothing
upstream of the store changes shape.

## 6. Schema (`mrgr-db/1`)

Conventions: all digests lowercase 64-hex sha256, all git OIDs lowercase
40-hex — length enforced by CHECK in the DDL, hex-format and lowercase
enforced by the zod layer at the API boundary; JSON payload
columns are `TEXT` holding canonical JSON (sorted keys); timestamps ISO-8601
UTC `TEXT`. `STRICT` tables throughout.

```sql
CREATE TABLE meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
) STRICT;
-- rows: schema_version='mrgr-db/1', created_at, created_by (tool+version)

CREATE TABLE blob (
  sha256   TEXT PRIMARY KEY CHECK (length(sha256) = 64),
  byte_len INTEGER NOT NULL CHECK (byte_len >= 0),
  bytes    BLOB NOT NULL
) STRICT;
-- content-addressed; sha256 over raw bytes; INSERT OR IGNORE semantics

CREATE TABLE repository (
  id            TEXT PRIMARY KEY,
  kind          TEXT NOT NULL CHECK (kind IN ('remote','local')),
  host          TEXT,
  slug          TEXT,
  cache_key     TEXT,
  absolute_path TEXT,
  CHECK (kind != 'remote' OR (host IS NOT NULL AND slug IS NOT NULL
         AND cache_key IS NOT NULL AND absolute_path IS NULL)),
  CHECK (kind != 'local'  OR (absolute_path IS NOT NULL AND host IS NULL
         AND slug IS NULL AND cache_key IS NULL))
) STRICT;

CREATE TABLE baseline (
  baseline_id            TEXT PRIMARY KEY CHECK (length(baseline_id) = 64),
  git_version            TEXT NOT NULL,
  algorithm              TEXT NOT NULL,
  strategy               TEXT NOT NULL,
  environment_policy     TEXT NOT NULL,
  normalization_version  TEXT NOT NULL,
  replay_command         TEXT NOT NULL
) STRICT;
-- baseline_id derives from {schemaVersion, gitVersion, environmentPolicy,
-- replayCommand, normalizationVersion}; repoMergeConfigHash varies per repo
-- and lives on corpus_record

CREATE TABLE corpus_record (
  repository_id      TEXT NOT NULL REFERENCES repository(id),
  merge_sha          TEXT NOT NULL CHECK (length(merge_sha) = 40),
  baseline_id        TEXT NOT NULL REFERENCES baseline(baseline_id),
  parent_ours_sha    TEXT NOT NULL CHECK (length(parent_ours_sha) = 40),
  parent_theirs_sha  TEXT NOT NULL CHECK (length(parent_theirs_sha) = 40),
  author_date        TEXT NOT NULL,
  subject            TEXT NOT NULL,
  parent_attr_ours   TEXT,   -- nullable ObjectId (ReplayProvenance.parentAttributes)
  parent_attr_theirs TEXT,
  repo_merge_config_hash TEXT,  -- per-record, nullable (varies per repo)
  replay_status      TEXT NOT NULL CHECK (replay_status IN
    ('clean','conflicted','unrelated','unsupported-custom-driver','error')),
  automatic_tree_oid TEXT CHECK (automatic_tree_oid IS NULL
                                 OR length(automatic_tree_oid) = 40),
  base_topology      TEXT NOT NULL CHECK (base_topology IN
                                          ('single','multiple','none')),
  changed_path_intersection TEXT,   -- canonical JSON array; see CHECK below
  error_json         TEXT,          -- canonical JSON ToolError
  CHECK ((base_topology = 'single') = (changed_path_intersection IS NOT NULL)),
  CHECK ((replay_status = 'error') = (error_json IS NOT NULL)),
  PRIMARY KEY (repository_id, merge_sha, baseline_id)
) STRICT;

CREATE TABLE merge_base (
  repository_id TEXT NOT NULL,
  merge_sha     TEXT NOT NULL,
  baseline_id   TEXT NOT NULL,
  base_sha      TEXT NOT NULL CHECK (length(base_sha) = 40),
  base_index    INTEGER NOT NULL CHECK (base_index >= 0),  -- order in mergeBases[]
  ours_exclusive_commits   INTEGER CHECK (ours_exclusive_commits   IS NULL OR ours_exclusive_commits   >= 0),
  theirs_exclusive_commits INTEGER CHECK (theirs_exclusive_commits IS NULL OR theirs_exclusive_commits >= 0),
  CHECK ((ours_exclusive_commits IS NULL) = (theirs_exclusive_commits IS NULL)),
  PRIMARY KEY (repository_id, merge_sha, baseline_id, base_sha),
  FOREIGN KEY (repository_id, merge_sha, baseline_id)
    REFERENCES corpus_record(repository_id, merge_sha, baseline_id)
) STRICT;

CREATE TABLE conflict_path (
  repository_id TEXT NOT NULL,
  merge_sha     TEXT NOT NULL,
  baseline_id   TEXT NOT NULL,
  path          TEXT NOT NULL,
  PRIMARY KEY (repository_id, merge_sha, baseline_id, path),
  FOREIGN KEY (repository_id, merge_sha, baseline_id)
    REFERENCES corpus_record(repository_id, merge_sha, baseline_id)
) STRICT;

CREATE TABLE conflict_region (
  repository_id TEXT NOT NULL,
  merge_sha     TEXT NOT NULL,
  baseline_id   TEXT NOT NULL,
  path          TEXT NOT NULL,
  ordinal       INTEGER NOT NULL CHECK (ordinal >= 1),
  category      TEXT NOT NULL CHECK (category IN
    ('lockfile','migration','documentation','generated','other')),
  conflict_kind TEXT NOT NULL,
  stage_oid_base   TEXT CHECK (stage_oid_base   IS NULL OR length(stage_oid_base)   = 40),
  stage_oid_ours   TEXT CHECK (stage_oid_ours   IS NULL OR length(stage_oid_ours)   = 40),
  stage_oid_theirs TEXT CHECK (stage_oid_theirs IS NULL OR length(stage_oid_theirs) = 40),
  localization_status TEXT NOT NULL CHECK (localization_status IN
    ('exact','ambiguous','unsupported-binary','unsupported-structural')),
  resolution_class TEXT NOT NULL CHECK (resolution_class IN
    ('ours','theirs','base','deleted','novel','ambiguous')),
  novel_after_normalization INTEGER,          -- 0/1 or NULL
  triple_key TEXT CHECK (triple_key IS NULL OR length(triple_key) = 64),
  automatic_ranges  TEXT,  -- canonical JSON; NULL unless exact
  resolution_range  TEXT,  -- canonical JSON; NULL unless exact
  raw_digests        TEXT, -- canonical JSON {base,ours,theirs,resolution}
  normalized_digests TEXT,
  raw_counts         TEXT,
  -- discriminated union, both directions:
  CHECK (localization_status != 'exact' OR (
    triple_key IS NOT NULL AND novel_after_normalization IS NOT NULL
    AND automatic_ranges IS NOT NULL AND resolution_range IS NOT NULL
    AND raw_digests IS NOT NULL AND normalized_digests IS NOT NULL
    AND raw_counts IS NOT NULL AND resolution_class != 'ambiguous')),
  CHECK (localization_status = 'exact' OR (
    resolution_class = 'ambiguous' AND triple_key IS NULL
    AND novel_after_normalization IS NULL)),
  PRIMARY KEY (repository_id, merge_sha, baseline_id, path, ordinal),
  FOREIGN KEY (repository_id, merge_sha, baseline_id, path)
    REFERENCES conflict_path(repository_id, merge_sha, baseline_id, path)
) STRICT;

CREATE TABLE evidence_bundle (
  repository_id TEXT NOT NULL,
  merge_sha     TEXT NOT NULL,
  baseline_id   TEXT NOT NULL,
  path          TEXT NOT NULL,
  ordinal       INTEGER NOT NULL CHECK (ordinal >= 0),
  -- ordinal 0 = PATH_LEVEL_ORDINAL: a failure before any region was known
  -- (m1a/sidecar.ts). Only failed rows may use it.
  status        TEXT NOT NULL CHECK (status IN ('ok','failed')),
  hunk_ours_sha   TEXT REFERENCES blob(sha256),
  hunk_base_sha   TEXT REFERENCES blob(sha256),
  hunk_theirs_sha TEXT REFERENCES blob(sha256),
  preimage_ours_sha    TEXT REFERENCES blob(sha256),  -- NULL = absent side
  preimage_theirs_sha  TEXT REFERENCES blob(sha256),
  preimage_ours_bytes   INTEGER CHECK (preimage_ours_bytes   IS NULL OR preimage_ours_bytes   >= 0),
  preimage_theirs_bytes INTEGER CHECK (preimage_theirs_bytes IS NULL OR preimage_theirs_bytes >= 0),
  preimage_ours_truncated   INTEGER,  -- 0/1
  preimage_theirs_truncated INTEGER,
  dependency_graph_status TEXT CHECK (dependency_graph_status IS NULL
    OR dependency_graph_status IN ('derived','unavailable')),
  error_json TEXT,
  -- Every table-level constraint must follow the LAST column definition:
  -- SQLite rejects any column-def that appears after a table constraint.
  CHECK (status = 'failed' OR ordinal >= 1),
  CHECK ((status = 'failed') = (error_json IS NOT NULL)),
  CHECK (status != 'ok' OR (hunk_ours_sha IS NOT NULL
    AND hunk_base_sha IS NOT NULL AND hunk_theirs_sha IS NOT NULL
    AND dependency_graph_status IS NOT NULL
    AND preimage_ours_truncated IS NOT NULL
    AND preimage_theirs_truncated IS NOT NULL)),
  -- absent side <=> NULL preimage ref <=> NULL byte count:
  CHECK ((preimage_ours_sha   IS NULL) = (preimage_ours_bytes   IS NULL)),
  CHECK ((preimage_theirs_sha IS NULL) = (preimage_theirs_bytes IS NULL)),
  PRIMARY KEY (repository_id, merge_sha, baseline_id, path, ordinal),
  FOREIGN KEY (repository_id, merge_sha, baseline_id, path)
    REFERENCES conflict_path(repository_id, merge_sha, baseline_id, path)
) STRICT;
-- FK stops at conflict_path because failed rows may carry ordinal 0, which
-- has no region row. For status='ok' rows the store verifies the matching
-- conflict_region row exists before inserting (fail-closed in code).
-- Note: preimage_*_bytes records the ORIGINAL size (pre-truncation), same as
-- the sidecar today. A truncated preimage's blob holds the truncated bytes;
-- byte_len < preimage_*_bytes iff *_truncated = 1.

CREATE TABLE evidence_dep (
  repository_id TEXT NOT NULL,
  merge_sha     TEXT NOT NULL,
  baseline_id   TEXT NOT NULL,
  path          TEXT NOT NULL,
  side          TEXT NOT NULL CHECK (side IN ('ours','theirs')),
  dep_path      TEXT NOT NULL,
  PRIMARY KEY (repository_id, merge_sha, baseline_id, path, side, dep_path),
  FOREIGN KEY (repository_id, merge_sha, baseline_id, path)
    REFERENCES conflict_path(repository_id, merge_sha, baseline_id, path)
) STRICT;
-- keyed per FILE, not per region: fixes today's N-copies-per-region duplication

CREATE TABLE ledger (
  id          TEXT PRIMARY KEY CHECK (length(id) = 64),
  seq         INTEGER NOT NULL UNIQUE CHECK (seq >= 1),
  record_type TEXT NOT NULL CHECK (record_type IN
    ('decision','halt','debt','resurrection','gate_vector')),
  record_schema_version TEXT NOT NULL,      -- e.g. 'mrgr-ledger/1'
  input_refs_json       TEXT NOT NULL,      -- canonical JSON array of OIDs/refs
  intermediate_tree_oid TEXT CHECK (intermediate_tree_oid IS NULL
                                    OR length(intermediate_tree_oid) = 40),
  output_tree_oid       TEXT CHECK (output_tree_oid IS NULL
                                    OR length(output_tree_oid) = 40),
  evidence_digest       TEXT CHECK (evidence_digest IS NULL
                                    OR length(evidence_digest) = 64),
  audit_phase           TEXT NOT NULL,
  adjudicator_kind      TEXT NOT NULL CHECK (adjudicator_kind IN
                                             ('human','script','model')),
  adjudicator_identity  TEXT NOT NULL,      -- name, script path+digest, or model+build
  reason                TEXT,
  payload_json          TEXT NOT NULL,      -- canonical JSON, type-specific body
  supersedes            TEXT REFERENCES ledger(id),  -- corrections append, never edit
  created_at            TEXT NOT NULL,
  CHECK (record_type != 'halt' OR reason IS NOT NULL)
) STRICT;

CREATE TRIGGER ledger_no_update BEFORE UPDATE ON ledger
BEGIN SELECT RAISE(ABORT, 'ledger is append-only'); END;
CREATE TRIGGER ledger_no_delete BEFORE DELETE ON ledger
BEGIN SELECT RAISE(ABORT, 'ledger is append-only'); END;

CREATE TABLE run (
  run_id      TEXT PRIMARY KEY,             -- content-derived: sha256(config)
  arm         TEXT NOT NULL,
  model_name  TEXT,
  model_sha   TEXT,
  config_json TEXT NOT NULL,
  started_at  TEXT NOT NULL
) STRICT;

CREATE TABLE run_result (
  run_id     TEXT NOT NULL REFERENCES run(run_id),
  triple_id  TEXT NOT NULL,
  run_index  INTEGER NOT NULL CHECK (run_index >= 1),
  decision   TEXT NOT NULL CHECK (decision IN
    ('keep_ours','keep_theirs','compose','halt')),
  halt_reason  TEXT,
  reason_text  TEXT,
  input_tokens  INTEGER CHECK (input_tokens  IS NULL OR input_tokens  >= 0),
  output_tokens INTEGER CHECK (output_tokens IS NULL OR output_tokens >= 0),
  duration_ms   INTEGER CHECK (duration_ms   IS NULL OR duration_ms   >= 0),
  schema_valid  INTEGER NOT NULL,           -- 0/1
  CHECK (decision != 'halt' OR halt_reason IS NOT NULL),
  PRIMARY KEY (run_id, triple_id, run_index)
) STRICT;
```

**Ledger identity.** `id = sha256(canonicalJson(record minus id, seq, created_at))`.
Duplicate append of the same logical record is therefore a primary-key
conflict, handled as idempotent success (`INSERT OR IGNORE` + verify the
existing row matches byte-for-byte; a mismatch is a `db` error). `seq` is
assigned as `COALESCE(MAX(seq),0)+1` **inside the insert transaction** —
SQLite's write lock serializes writers, so the D90 read-then-write race
cannot occur. `seq` is presentation order, never identity; citations use `id`
or `(record_type, id-prefix)`.

**Materialized triples** are not a table: they are a *view* of
`conflict_region` joined to `blob` (when side contents are stored) or a
re-derivation from git (the existing `materializeCorpusFile` path, unchanged,
which re-verifies every digest from git bytes). `mrgr db export --table triples`
emits the same snake_case JSONL the current materializer writes.

## 7. Open / write discipline

`openDb(path, {create})`:

1. `DatabaseSync` open; `PRAGMA journal_mode=WAL`, `PRAGMA foreign_keys=ON`,
   `PRAGMA busy_timeout=10000`, `PRAGMA synchronous=NORMAL`.
2. Fresh file (`create: true`): apply `schema.sql` in one transaction, set
   `application_id`, `user_version`, `meta` rows.
3. Existing file: verify `application_id = 0x6D726772`, `user_version = 1`,
   `meta.schema_version = 'mrgr-db/1'`. Any mismatch returns a typed
   `ToolError { kind: 'db', reason: 'schema-mismatch', detected, expected }`.
   Never write to a file that fails these checks.
4. Every store method returns `Result`-shaped values (the repo's existing
   errors-as-values idiom); no exceptions cross the store boundary.

Writes: one transaction per logical record (corpus record + its child rows;
evidence bundle + its blobs; ledger row). Blob inserts are `INSERT OR IGNORE`
followed by a `byte_len` cross-check against the existing row (a sha256
collision or corruption surfaces as a `db` error, fail-closed). Ledger
transactions run with `PRAGMA synchronous=FULL` for their duration.

Multi-process: WAL + busy_timeout make concurrent CLI invocations safe;
writers queue on SQLite's write lock. This subsumes the flock discipline the
round-5 merge driver hand-rolled, and keeps its key property: *the ledger row
commits before any tree mutation is reported, or neither happens.* (The
tree-mutation ordering itself stays in the mechanism driver at M2a; the store
guarantees the row's atomicity and durability.)

Cross-engine access: tursodb may open the file for **read-only inspection
while no mrgr process is writing**. Concurrent tursodb writes are unsupported;
`mrgr db verify` is the recovery check if anyone does it anyway.

## 8. Determinism, export, import

`mrgr db export --out DIR`:

- One JSONL file per table, rows ordered by primary key, keys sorted,
  `JSON.stringify` with no whitespace options beyond defaults, LF line
  endings, UTF-8.
- Blobs export as `{sha256, byte_len}` refs by default; `--with-blobs` writes
  `blobs/<sha256>` files (raw bytes).
- A `manifest.json` records per-file sha256 + row counts + `schema_version` +
  the source DB's `meta`.
- **Binding property: two exports of the same logical content produce
  byte-identical content-table files**, regardless of insertion order, vacuum
  state, or page layout. This is the artifact the plan's "three runs
  byte-identical JSON" gates bind to; the `.db` file itself is never a digest
  target.
- **Excluded from that property: `meta.jsonl` and `manifest.json`.** `meta`
  records when and by what this particular database was created, and the
  manifest embeds it. Two databases holding identical content but created at
  different moments legitimately differ there. Every other table — including
  `ledger`, whose `created_at` is a caller-supplied input, not a wall-clock
  read inside the store — is covered.

`mrgr db import`:

- `--corpus legacy.jsonl` — parses via the carried `readCorpus` (fail-closed,
  unchanged), inserts transactionally, reports
  `imported / skipped-duplicate / failed` counts separately.
- `--evidence corpus.evidence.jsonl` — via `readEvidence`, same discipline.
  Preimage strings are converted to blobs (`sha256` over UTF-8 bytes).
- `--h0-runs runs/*.jsonl` — via a new strict zod parser (the legacy runner's
  fail-open `catch {}` is not reproduced).
- Import + export round-trip of the committed `evidence/h0/*.jsonl` artifacts
  is a test fixture (§11).

## 9. Compatibility and migration path

- Carried WP0 code untouched; `verify-carried.sh` passes unmodified.
- `CorpusWriter`/`readCorpus` remain for JSONL transport; CLI defaults decide:
  when `--db` is present, stores are used; `--out *.jsonl` keeps the legacy
  path working during transition. Deprecation of JSONL-as-storage is a later,
  separate decision.
- `engines` bumps to `>=22.5.0` in root and `packages/core` (Node 22.5 is the
  first with `node:sqlite`). The experimental-warning noise is suppressed in
  the CLI entry via `--no-warnings=ExperimentalWarning` equivalent
  (`process.removeAllListeners('warning')` is NOT used; a scoped filter only).
- zod stays (already a runtime dep) for API-boundary validation of rows read
  back from the DB.

## 10. Error handling

`ToolError` gains `kind: 'db'`. Every store error carries `table`, the
violated constraint (SQLite extended error string), and the offending key.
Fail-closed everywhere a read feeds a decision: schema mismatch, foreign-key
violation, blob length mismatch, ledger duplicate-with-different-content.
`resolved / halted / failed / unsupported` denominators in reports come from
SQL aggregates over explicit status columns — never from row absence.

## 11. Testing

Mirror the strongest existing suites, per surface:

1. **Round trip byte-for-byte:** bundle in → rows → bundle out, deep-equal and
   blob-bytes identical (sidecar.test.ts:74 equivalent).
2. **Union invariants enforced by the store:** inserting an `exact` region
   with a NULL digest, or an `ambiguous` region with a `triple_key`, fails at
   the SQL layer even when the zod layer is bypassed.
3. **Crash-resume:** write region 1 of a 2-region file, reopen, resume; region
   2 is written, region 1 not duplicated (sidecar.test.ts:209 equivalent) —
   via PK lookup, not file scan.
4. **Append-only ledger:** UPDATE and DELETE on `ledger` abort with the
   trigger message; correction-by-append with `supersedes` works.
5. **Concurrent writers:** two child processes append disjoint ledger records
   through the real CLI simultaneously; afterwards all records present, `seq`
   dense and unique, zero id collisions (the D90 regression test).
6. **Idempotent re-append:** same logical ledger record twice → one row;
   same id with different payload → `db` error.
7. **Fail-closed open:** wrong `user_version`, wrong `application_id`, missing
   `meta` row, and a plain-SQLite file each produce the typed mismatch error
   and no write.
8. **Deterministic export:** build the same logical DB in two different
   insertion orders; exports are byte-identical; manifest digests match.
9. **Import round-trip:** `evidence/h0/scan-*.jsonl` and the evidence sidecar
   fixtures import, export, and re-import to identical exports.
10. **Blob integrity:** corrupt a blob row's bytes directly; the store's read
    path detects `sha256` mismatch and fails closed.

## 12. Not claimed

- Not tested: cross-engine behavior under tursodb writes (documented
  unsupported, not prevented); WAL behavior on network filesystems; databases
  beyond ~10^6 rows.
- Verification does not prove: that the ledger constrains an adjudicator with
  shell access (the plan's bypass-test result stands — an unledgered tree is
  still undetectable); that CHECK constraints capture every invariant
  `parseCorpusRecord` enforces (they capture the union shape; field-format
  checks stay in zod).
- Residual risk: `node:sqlite` is still flagged experimental; API breakage in
  a future Node major would require a driver shim (the schema and SQL are
  driver-neutral; better-sqlite3 is the fallback with no schema change).
- New state introduced: the workspace `.db` file and its `-wal`/`-shm`
  siblings; `engines >= 22.5.0` requirement.
