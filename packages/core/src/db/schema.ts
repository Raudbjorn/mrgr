/** mrgr-db/1. Single source of truth; spec §6 mirrors this constant. */
export const SCHEMA_SQL = `
CREATE TABLE meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
) STRICT;

CREATE TABLE blob (
  sha256   TEXT PRIMARY KEY CHECK (length(sha256) = 64),
  byte_len INTEGER NOT NULL CHECK (byte_len >= 0),
  bytes    BLOB NOT NULL
) STRICT;

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

CREATE TABLE corpus_record (
  repository_id      TEXT NOT NULL REFERENCES repository(id),
  merge_sha          TEXT NOT NULL CHECK (length(merge_sha) = 40),
  baseline_id        TEXT NOT NULL REFERENCES baseline(baseline_id),
  parent_ours_sha    TEXT NOT NULL CHECK (length(parent_ours_sha) = 40),
  parent_theirs_sha  TEXT NOT NULL CHECK (length(parent_theirs_sha) = 40),
  author_date        TEXT NOT NULL,
  subject            TEXT NOT NULL,
  parent_attr_ours   TEXT,
  parent_attr_theirs TEXT,
  repo_merge_config_hash TEXT,
  replay_status      TEXT NOT NULL CHECK (replay_status IN
    ('clean','conflicted','unrelated','unsupported-custom-driver','error')),
  automatic_tree_oid TEXT CHECK (automatic_tree_oid IS NULL
                                 OR length(automatic_tree_oid) = 40),
  base_topology      TEXT NOT NULL CHECK (base_topology IN
                                          ('single','multiple','none')),
  changed_path_intersection TEXT,
  error_json         TEXT,
  CHECK ((base_topology = 'single') = (changed_path_intersection IS NOT NULL)),
  CHECK ((replay_status = 'error') = (error_json IS NOT NULL)),
  PRIMARY KEY (repository_id, merge_sha, baseline_id)
) STRICT;

CREATE TABLE merge_base (
  repository_id TEXT NOT NULL,
  merge_sha     TEXT NOT NULL,
  baseline_id   TEXT NOT NULL,
  base_sha      TEXT NOT NULL CHECK (length(base_sha) = 40),
  base_index    INTEGER NOT NULL CHECK (base_index >= 0),
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
  path_index    INTEGER NOT NULL CHECK (path_index >= 0),
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
  novel_after_normalization INTEGER,
  triple_key TEXT CHECK (triple_key IS NULL OR length(triple_key) = 64),
  automatic_ranges  TEXT,
  resolution_range  TEXT,
  raw_digests        TEXT,
  normalized_digests TEXT,
  raw_counts         TEXT,
  array_index        INTEGER NOT NULL CHECK (array_index >= 0),
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
  ordinal       INTEGER NOT NULL,
  status        TEXT NOT NULL,
  hunk_ours_sha   TEXT REFERENCES blob(sha256),
  hunk_base_sha   TEXT REFERENCES blob(sha256),
  hunk_theirs_sha TEXT REFERENCES blob(sha256),
  preimage_ours_sha    TEXT REFERENCES blob(sha256),
  preimage_theirs_sha  TEXT REFERENCES blob(sha256),
  preimage_ours_bytes   INTEGER,
  preimage_theirs_bytes INTEGER,
  preimage_ours_truncated   INTEGER,
  preimage_theirs_truncated INTEGER,
  dependency_graph_status TEXT,
  error_json TEXT,
  CHECK (ordinal >= 0),
  CHECK (status IN ('ok','failed')),
  CHECK (status = 'failed' OR ordinal >= 1),
  CHECK (preimage_ours_bytes IS NULL OR preimage_ours_bytes >= 0),
  CHECK (preimage_theirs_bytes IS NULL OR preimage_theirs_bytes >= 0),
  CHECK (dependency_graph_status IS NULL OR dependency_graph_status IN ('derived','unavailable')),
  CHECK ((status = 'failed') = (error_json IS NOT NULL)),
  CHECK (status != 'ok' OR (hunk_ours_sha IS NOT NULL
    AND hunk_base_sha IS NOT NULL AND hunk_theirs_sha IS NOT NULL
    AND dependency_graph_status IS NOT NULL
    AND preimage_ours_truncated IS NOT NULL
    AND preimage_theirs_truncated IS NOT NULL)),
  CHECK ((preimage_ours_sha   IS NULL) = (preimage_ours_bytes   IS NULL)),
  CHECK ((preimage_theirs_sha IS NULL) = (preimage_theirs_bytes IS NULL)),
  PRIMARY KEY (repository_id, merge_sha, baseline_id, path, ordinal),
  FOREIGN KEY (repository_id, merge_sha, baseline_id, path)
    REFERENCES conflict_path(repository_id, merge_sha, baseline_id, path)
) STRICT;

CREATE TABLE evidence_dep (
  repository_id TEXT NOT NULL,
  merge_sha     TEXT NOT NULL,
  baseline_id   TEXT NOT NULL,
  path          TEXT NOT NULL,
  side          TEXT NOT NULL CHECK (side IN ('ours','theirs')),
  dep_path      TEXT NOT NULL,
  position      INTEGER NOT NULL CHECK (position >= 0),
  -- position is the entry's index in the producer's dependency_graph array.
  -- DependencyGraphSchema (m1a/evidence.ts) is a plain array with no
  -- ordering or uniqueness constraint, so the same (side, dep_path) pair can
  -- legitimately appear more than once; without position in the key, a
  -- second identical pair would collide with the first and either vanish
  -- (INSERT OR IGNORE) or be rejected as a duplicate (plain INSERT) instead
  -- of being preserved as its own entry. Every column here is part of the
  -- primary key, so a PK conflict is always a byte-identical duplicate.
  PRIMARY KEY (repository_id, merge_sha, baseline_id, path, side, dep_path, position),
  FOREIGN KEY (repository_id, merge_sha, baseline_id, path)
    REFERENCES conflict_path(repository_id, merge_sha, baseline_id, path)
) STRICT;

CREATE TABLE ledger (
  id          TEXT PRIMARY KEY CHECK (length(id) = 64),
  seq         INTEGER NOT NULL UNIQUE CHECK (seq >= 1),
  record_type TEXT NOT NULL CHECK (record_type IN
    ('decision','halt','debt','resurrection','gate_vector')),
  record_schema_version TEXT NOT NULL,
  input_refs_json       TEXT NOT NULL,
  intermediate_tree_oid TEXT CHECK (intermediate_tree_oid IS NULL
                                    OR length(intermediate_tree_oid) = 40),
  output_tree_oid       TEXT CHECK (output_tree_oid IS NULL
                                    OR length(output_tree_oid) = 40),
  evidence_digest       TEXT CHECK (evidence_digest IS NULL
                                    OR length(evidence_digest) = 64),
  audit_phase           TEXT NOT NULL,
  adjudicator_kind      TEXT NOT NULL CHECK (adjudicator_kind IN
                                             ('human','script','model')),
  adjudicator_identity  TEXT NOT NULL,
  reason                TEXT,
  payload_json          TEXT NOT NULL,
  supersedes            TEXT REFERENCES ledger(id),
  created_at            TEXT NOT NULL,
  CHECK (record_type != 'halt' OR reason IS NOT NULL)
) STRICT;

CREATE TRIGGER ledger_no_update BEFORE UPDATE ON ledger
BEGIN SELECT RAISE(ABORT, 'ledger is append-only'); END;
CREATE TRIGGER ledger_no_delete BEFORE DELETE ON ledger
BEGIN SELECT RAISE(ABORT, 'ledger is append-only'); END;

CREATE TABLE run (
  run_id      TEXT PRIMARY KEY CHECK (length(run_id) = 64),
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
  schema_valid  INTEGER NOT NULL,
  CHECK (decision != 'halt' OR halt_reason IS NOT NULL),
  PRIMARY KEY (run_id, triple_id, run_index)
) STRICT;
`;
