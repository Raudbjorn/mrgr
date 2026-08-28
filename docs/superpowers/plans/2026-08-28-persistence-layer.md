# SQLite Persistence Layer (`mrgr-db/1`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One workspace SQLite database (`mrgr.db`) replacing JSONL as storage for corpus records, conflict regions, evidence bundles, the ledger, and experiment runs — with JSONL demoted to import/export transport.

**Architecture:** New `packages/core/src/db/` module using `node:sqlite` (`DatabaseSync`). Content-addressed `blob` table for preimages/hunks; relational tables whose CHECK constraints enforce the discriminated unions; trigger-guarded append-only `ledger` with content-derived IDs; canonical byte-deterministic export. Carried files (`src/evaluation/*`, `tests/evaluation/*`) are never modified — the DB layer supersedes their storage role via new code and the existing exported readers.

**Tech Stack:** TypeScript (ESM, `type: module`), `node:sqlite` (Node ≥ 22.5, no new deps), zod 4 (already a dep), vitest 2.

**Spec:** `docs/superpowers/specs/2026-08-28-persistence-layer-design.md` — read it first; the DDL there is the schema source of truth and is reproduced in Task 1.

## Global Constraints

- `engines.node`: `>=22.5.0` (root and `packages/core`) — set in Task 1.
- **Never modify** `packages/core/src/evaluation/*`, `packages/core/tests/evaluation/*`, or `scripts/carried.sha256`. `bash scripts/verify-carried.sh` must pass after every task.
- No new runtime dependencies. `node:sqlite` only. zod stays.
- Errors as values: every store method returns `Result<T>`-shaped values; no exceptions cross module boundaries. The carried `ErrorKind` union cannot be edited, so the db module widens it locally (Task 1) — kind `"db"` exists only in `src/db/`.
- All digests lowercase 64-hex sha256; git OIDs lowercase 40-hex.
- All tables `STRICT`. All JSON columns hold canonical JSON (sorted keys, compact).
- Run tests from `packages/core/`: `pnpm exec vitest run tests/db/<file>.test.ts`. Run `pnpm exec tsc -p tsconfig.json --noEmit` before each commit.
- Commit after every task (small commits are fine mid-task too).
- **Deviation from spec §5, recorded here:** `evaluation/cli.ts` is carried, so `mrgr-wp0 scan --db` cannot be added in v1. Corpus ingest path is: scan to JSONL (carried, unchanged) → `mrgr-db import --corpus`. Evidence (`m1a/cli.ts`, not carried) and ledger write to the DB directly.

---

### Task 1: Engines bump, module scaffold, schema, fail-closed `openDb`

**Files:**
- Modify: `package.json` (root) — engines
- Modify: `packages/core/package.json` — engines
- Create: `packages/core/src/db/result.ts`
- Create: `packages/core/src/db/schema.ts`
- Create: `packages/core/src/db/open.ts`
- Test: `packages/core/tests/db/open.test.ts`

**Interfaces:**
- Consumes: `Result`, `ToolError`, `ErrorKind` from `../evaluation/result.js` (read-only import).
- Produces (used by every later task):
  - `type DbErrorKind = ErrorKind | "db"` and `type DbResult<T>` (structurally compatible with `Result<T>` when kind ≠ `"db"`), `dbErr(kind, operation, message, details?)`, from `src/db/result.ts`
  - `SCHEMA_SQL: string` from `src/db/schema.ts`
  - `interface DbHandle { db: DatabaseSync; path: string }`, `openDb(path: string, options?: { create?: boolean }): DbResult<DbHandle>`, `closeDb(handle: DbHandle): DbResult<void>`, constants `APPLICATION_ID = 0x6d726772`, `USER_VERSION = 1`, `SCHEMA_VERSION_STRING = "mrgr-db/1"`, from `src/db/open.ts`

- [ ] **Step 1: Bump engines in both package.json files**

In root `package.json` and `packages/core/package.json`, change:

```json
"engines": { "node": ">=22.5.0" }
```

- [ ] **Step 2: Write `src/db/result.ts`**

```typescript
import type { ErrorKind, ToolError } from "../evaluation/result.js";

/**
 * The carried ErrorKind union cannot be edited (src/evaluation is verbatim,
 * digest-enforced). The db layer widens it locally; a DbToolError with any
 * carried kind is a valid ToolError, and "db" stays inside src/db.
 */
export type DbErrorKind = ErrorKind | "db";

export interface DbToolError extends Omit<ToolError, "kind"> {
	kind: DbErrorKind;
}

export type DbResult<T> =
	| { ok: true; value: T }
	| { ok: false; error: DbToolError };

export function dbOk<T>(value: T): DbResult<T> {
	return { ok: true, value };
}

export function dbErr(
	kind: DbErrorKind,
	operation: string,
	message: string,
	details?: DbToolError["details"],
): DbResult<never> {
	const error: DbToolError =
		details === undefined
			? { kind, operation, message }
			: { kind, operation, message, details };
	return { ok: false, error };
}
```

- [ ] **Step 3: Write `src/db/schema.ts` — the full DDL from spec §6, verbatim**

```typescript
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
  status        TEXT NOT NULL CHECK (status IN ('ok','failed')),
  CHECK (status = 'failed' OR ordinal >= 1),
  hunk_ours_sha   TEXT REFERENCES blob(sha256),
  hunk_base_sha   TEXT REFERENCES blob(sha256),
  hunk_theirs_sha TEXT REFERENCES blob(sha256),
  preimage_ours_sha    TEXT REFERENCES blob(sha256),
  preimage_theirs_sha  TEXT REFERENCES blob(sha256),
  preimage_ours_bytes   INTEGER CHECK (preimage_ours_bytes   IS NULL OR preimage_ours_bytes   >= 0),
  preimage_theirs_bytes INTEGER CHECK (preimage_theirs_bytes IS NULL OR preimage_theirs_bytes >= 0),
  preimage_ours_truncated   INTEGER,
  preimage_theirs_truncated INTEGER,
  dependency_graph_status TEXT CHECK (dependency_graph_status IS NULL
    OR dependency_graph_status IN ('derived','unavailable')),
  error_json TEXT,
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
  PRIMARY KEY (repository_id, merge_sha, baseline_id, path, side, dep_path),
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
```

- [ ] **Step 4: Write the failing test `tests/db/open.test.ts`**

```typescript
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
	APPLICATION_ID,
	SCHEMA_VERSION_STRING,
	USER_VERSION,
	closeDb,
	openDb,
} from "../../src/db/open.js";

let dir: string;
beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "mrgr-db-"));
});
afterEach(() => {
	rmSync(dir, { recursive: true, force: true });
});

describe("openDb", () => {
	it("creates a fresh database with schema, pragmas and meta", () => {
		const opened = openDb(join(dir, "mrgr.db"), { create: true });
		expect(opened.ok).toBe(true);
		if (!opened.ok) return;
		const { db } = opened.value;
		expect(
			(db.prepare("PRAGMA application_id").get() as { application_id: number })
				.application_id,
		).toBe(APPLICATION_ID);
		expect(
			(db.prepare("PRAGMA user_version").get() as { user_version: number })
				.user_version,
		).toBe(USER_VERSION);
		expect(
			(db.prepare("PRAGMA journal_mode").get() as { journal_mode: string })
				.journal_mode,
		).toBe("wal");
		const meta = db
			.prepare("SELECT value FROM meta WHERE key = 'schema_version'")
			.get() as { value: string };
		expect(meta.value).toBe(SCHEMA_VERSION_STRING);
		expect(closeDb(opened.value).ok).toBe(true);
	});

	it("reopens its own database", () => {
		const path = join(dir, "mrgr.db");
		const first = openDb(path, { create: true });
		expect(first.ok).toBe(true);
		if (first.ok) closeDb(first.value);
		const second = openDb(path);
		expect(second.ok).toBe(true);
		if (second.ok) closeDb(second.value);
	});

	it("refuses a missing file without create", () => {
		const opened = openDb(join(dir, "absent.db"));
		expect(opened.ok).toBe(false);
		if (!opened.ok) expect(opened.error.kind).toBe("not-found");
	});

	it("refuses a plain SQLite file (schema mismatch), and writes nothing", () => {
		const path = join(dir, "foreign.db");
		const foreign = new DatabaseSync(path);
		foreign.exec("CREATE TABLE t (x)");
		foreign.close();
		const opened = openDb(path);
		expect(opened.ok).toBe(false);
		if (!opened.ok) {
			expect(opened.error.kind).toBe("db");
			expect(opened.error.details?.reason).toBe("schema-mismatch");
		}
		const check = new DatabaseSync(path);
		const tables = check
			.prepare("SELECT count(*) AS n FROM sqlite_master WHERE name = 'meta'")
			.get() as { n: number };
		expect(tables.n).toBe(0); // fail-closed: no write happened
		check.close();
	});

	it("refuses a non-database file", () => {
		const path = join(dir, "garbage.db");
		writeFileSync(path, "not a database at all");
		const opened = openDb(path);
		expect(opened.ok).toBe(false);
	});
});
```

- [ ] **Step 5: Run test to verify it fails**

Run (from `packages/core/`): `pnpm exec vitest run tests/db/open.test.ts`
Expected: FAIL — cannot resolve `../../src/db/open.js`.

- [ ] **Step 6: Write `src/db/open.ts`**

```typescript
import { existsSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

import { SCHEMA_SQL } from "./schema.js";
import { dbErr, dbOk, type DbResult } from "./result.js";

export const APPLICATION_ID = 0x6d726772; // "mrgr"
export const USER_VERSION = 1;
export const SCHEMA_VERSION_STRING = "mrgr-db/1";

export interface DbHandle {
	db: DatabaseSync;
	path: string;
}

/**
 * Fail-closed open. An existing file must carry the exact application_id,
 * user_version and meta.schema_version; anything else is a typed error and
 * the file is left untouched. Never auto-migrates.
 */
export function openDb(
	path: string,
	options: { create?: boolean } = {},
): DbResult<DbHandle> {
	const exists = existsSync(path);
	if (!exists && !options.create) {
		return dbErr("not-found", "open db", "Database file does not exist", {
			path,
		});
	}

	let db: DatabaseSync;
	try {
		db = new DatabaseSync(path);
	} catch (cause) {
		return dbErr("db", "open db", "File could not be opened as SQLite", {
			path,
			cause: String(cause),
		});
	}

	try {
		db.exec("PRAGMA journal_mode=WAL");
		db.exec("PRAGMA foreign_keys=ON");
		db.exec("PRAGMA busy_timeout=10000");
		db.exec("PRAGMA synchronous=NORMAL");

		const appId = (
			db.prepare("PRAGMA application_id").get() as { application_id: number }
		).application_id;
		const userVersion = (
			db.prepare("PRAGMA user_version").get() as { user_version: number }
		).user_version;

		if (!exists || (appId === 0 && userVersion === 0 && isEmpty(db))) {
			db.exec("BEGIN IMMEDIATE");
			try {
				db.exec(SCHEMA_SQL);
				db.exec(`PRAGMA application_id = ${APPLICATION_ID}`);
				db.exec(`PRAGMA user_version = ${USER_VERSION}`);
				const insertMeta = db.prepare(
					"INSERT INTO meta (key, value) VALUES (?, ?)",
				);
				insertMeta.run("schema_version", SCHEMA_VERSION_STRING);
				insertMeta.run("created_at", new Date().toISOString());
				insertMeta.run("created_by", "@mrgr/core");
				db.exec("COMMIT");
			} catch (cause) {
				db.exec("ROLLBACK");
				throw cause;
			}
			return dbOk({ db, path });
		}

		if (appId !== APPLICATION_ID || userVersion !== USER_VERSION) {
			db.close();
			return dbErr("db", "open db", "Database schema mismatch", {
				path,
				reason: "schema-mismatch",
				detected_application_id: appId,
				detected_user_version: userVersion,
				expected_application_id: APPLICATION_ID,
				expected_user_version: USER_VERSION,
			});
		}

		const meta = db
			.prepare("SELECT value FROM meta WHERE key = 'schema_version'")
			.get() as { value: string } | undefined;
		if (meta?.value !== SCHEMA_VERSION_STRING) {
			db.close();
			return dbErr("db", "open db", "Database schema mismatch", {
				path,
				reason: "schema-mismatch",
				detected_schema_version: meta?.value ?? null,
				expected_schema_version: SCHEMA_VERSION_STRING,
			});
		}

		return dbOk({ db, path });
	} catch (cause) {
		try {
			db.close();
		} catch {
			/* already closed or unusable */
		}
		return dbErr("db", "open db", "Database could not be validated", {
			path,
			cause: String(cause),
		});
	}
}

function isEmpty(db: DatabaseSync): boolean {
	const row = db
		.prepare("SELECT count(*) AS n FROM sqlite_master")
		.get() as { n: number };
	return row.n === 0;
}

export function closeDb(handle: DbHandle): DbResult<void> {
	try {
		handle.db.close();
		return dbOk(undefined);
	} catch (cause) {
		return dbErr("db", "close db", "Database could not be closed", {
			path: handle.path,
			cause: String(cause),
		});
	}
}
```

Note the guard: a pre-existing file is only initialized when it is completely
empty (`sqlite_master` has zero rows) *and* both pragmas are 0 — an empty file
created by `touch` opens as an empty SQLite database and is safe to claim.
A file with any tables and the wrong pragmas is rejected without writes
(the "plain SQLite file" test).

- [ ] **Step 7: Run tests to verify they pass**

Run: `pnpm exec vitest run tests/db/open.test.ts`
Expected: PASS (5 tests). Also run: `pnpm exec tsc -p tsconfig.json --noEmit` and `bash ../../scripts/verify-carried.sh` — wait: verify-carried runs from `packages/core/`, check the script's expected cwd with `head -5 ../../scripts/verify-carried.sh`; run it from wherever the M0 docs say (repo root: `bash scripts/verify-carried.sh`).
Expected: clean typecheck, carried manifest passes.

- [ ] **Step 8: Commit**

```bash
git add package.json packages/core/package.json packages/core/src/db packages/core/tests/db
git commit -m "feat(db): mrgr-db/1 schema and fail-closed openDb via node:sqlite"
```

---

### Task 2: Canonical JSON + content-addressed blob store

**Files:**
- Create: `packages/core/src/db/canonical.ts`
- Create: `packages/core/src/db/blob.ts`
- Test: `packages/core/tests/db/blob.test.ts`

**Interfaces:**
- Consumes: `DbHandle`, `openDb`, `closeDb` (Task 1); `dbErr`, `dbOk`, `DbResult` (Task 1).
- Produces:
  - `canonicalJson(value: unknown): string` — recursive key-sort, compact `JSON.stringify` — and `sha256Hex(data: Uint8Array | string): string`, from `src/db/canonical.ts`
  - `putBlob(handle: DbHandle, bytes: Uint8Array): DbResult<string>` (returns sha256, idempotent), `getBlob(handle: DbHandle, sha256: string): DbResult<Uint8Array>` (verifies digest on read; missing row → kind `"not-found"`), from `src/db/blob.ts`

- [ ] **Step 1: Write the failing test `tests/db/blob.test.ts`**

```typescript
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { canonicalJson, sha256Hex } from "../../src/db/canonical.js";
import { getBlob, putBlob } from "../../src/db/blob.js";
import { closeDb, openDb, type DbHandle } from "../../src/db/open.js";

let dir: string;
let handle: DbHandle;
beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "mrgr-db-"));
	const opened = openDb(join(dir, "mrgr.db"), { create: true });
	if (!opened.ok) throw new Error(opened.error.message);
	handle = opened.value;
});
afterEach(() => {
	closeDb(handle);
	rmSync(dir, { recursive: true, force: true });
});

describe("canonicalJson", () => {
	it("sorts keys recursively and is insertion-order independent", () => {
		const a = canonicalJson({ b: 1, a: { d: [2, { z: 3, y: 4 }], c: 5 } });
		const b = canonicalJson({ a: { c: 5, d: [2, { y: 4, z: 3 }] }, b: 1 });
		expect(a).toBe(b);
		expect(a).toBe('{"a":{"c":5,"d":[2,{"y":4,"z":3}]},"b":1}');
	});
});

describe("blob store", () => {
	it("round-trips bytes byte-for-byte", () => {
		const bytes = new TextEncoder().encode("héllo\n\0binary-ish");
		const put = putBlob(handle, bytes);
		expect(put.ok).toBe(true);
		if (!put.ok) return;
		expect(put.value).toBe(sha256Hex(bytes));
		const got = getBlob(handle, put.value);
		expect(got.ok).toBe(true);
		if (got.ok) expect(Buffer.from(got.value)).toEqual(Buffer.from(bytes));
	});

	it("deduplicates: same bytes twice, one row", () => {
		const bytes = new TextEncoder().encode("same content");
		putBlob(handle, bytes);
		putBlob(handle, bytes);
		const n = handle.db
			.prepare("SELECT count(*) AS n FROM blob")
			.get() as { n: number };
		expect(n.n).toBe(1);
	});

	it("fails closed when stored bytes are corrupted", () => {
		const bytes = new TextEncoder().encode("original");
		const put = putBlob(handle, bytes);
		if (!put.ok) throw new Error("put failed");
		handle.db
			.prepare("UPDATE blob SET bytes = ? WHERE sha256 = ?")
			.run(new TextEncoder().encode("tampered!"), put.value);
		const got = getBlob(handle, put.value);
		expect(got.ok).toBe(false);
		if (!got.ok) expect(got.error.kind).toBe("db");
	});

	it("reports a missing blob as not-found", () => {
		const got = getBlob(handle, "0".repeat(64));
		expect(got.ok).toBe(false);
		if (!got.ok) expect(got.error.kind).toBe("not-found");
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/db/blob.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Write `src/db/canonical.ts`**

```typescript
import { createHash } from "node:crypto";

/**
 * Canonical JSON: recursively key-sorted, compact. Two structurally equal
 * values always serialize to identical bytes; this string is what content-
 * derived IDs hash and what JSON columns store.
 */
export function canonicalJson(value: unknown): string {
	return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(sortValue);
	if (value !== null && typeof value === "object") {
		const source = value as Record<string, unknown>;
		const out: Record<string, unknown> = {};
		for (const key of Object.keys(source).sort()) {
			if (source[key] !== undefined) out[key] = sortValue(source[key]);
		}
		return out;
	}
	return value;
}

export function sha256Hex(data: Uint8Array | string): string {
	return createHash("sha256").update(data).digest("hex");
}
```

- [ ] **Step 4: Write `src/db/blob.ts`**

```typescript
import { sha256Hex } from "./canonical.js";
import { dbErr, dbOk, type DbResult } from "./result.js";
import type { DbHandle } from "./open.js";

/**
 * Content-addressed store. INSERT OR IGNORE + byte_len cross-check: a sha256
 * collision or prior corruption surfaces as an error instead of being merged
 * silently.
 */
export function putBlob(handle: DbHandle, bytes: Uint8Array): DbResult<string> {
	const sha256 = sha256Hex(bytes);
	try {
		handle.db
			.prepare("INSERT OR IGNORE INTO blob (sha256, byte_len, bytes) VALUES (?, ?, ?)")
			.run(sha256, bytes.byteLength, bytes);
		const row = handle.db
			.prepare("SELECT byte_len FROM blob WHERE sha256 = ?")
			.get(sha256) as { byte_len: number };
		if (row.byte_len !== bytes.byteLength) {
			return dbErr("db", "put blob", "Existing blob row disagrees with content", {
				sha256,
				existing_byte_len: row.byte_len,
				byte_len: bytes.byteLength,
			});
		}
		return dbOk(sha256);
	} catch (cause) {
		return dbErr("db", "put blob", "Blob insert failed", {
			sha256,
			cause: String(cause),
		});
	}
}

/** Read a blob, re-verifying its digest. Fail-closed on any mismatch. */
export function getBlob(handle: DbHandle, sha256: string): DbResult<Uint8Array> {
	try {
		const row = handle.db
			.prepare("SELECT bytes FROM blob WHERE sha256 = ?")
			.get(sha256) as { bytes: Uint8Array } | undefined;
		if (row === undefined) {
			return dbErr("not-found", "get blob", "Blob is not in the store", { sha256 });
		}
		if (sha256Hex(row.bytes) !== sha256) {
			return dbErr("db", "get blob", "Stored blob bytes do not match their digest", {
				sha256,
			});
		}
		return dbOk(row.bytes);
	} catch (cause) {
		return dbErr("db", "get blob", "Blob read failed", {
			sha256,
			cause: String(cause),
		});
	}
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm exec vitest run tests/db/blob.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/db/canonical.ts packages/core/src/db/blob.ts packages/core/tests/db/blob.test.ts
git commit -m "feat(db): canonical JSON and content-addressed blob store"
```

---

### Task 3: CorpusStore

**Files:**
- Create: `packages/core/src/db/corpus-store.ts`
- Test: `packages/core/tests/db/corpus-store.test.ts`

**Interfaces:**
- Consumes: `DbHandle` (Task 1), `canonicalJson` (Task 2), types `CorpusRecordV2`, `ConflictRegionRecord`, `RepositoryRef` from `../evaluation/types.js`, `resumeKey` from `../evaluation/corpus.js` (exported there; import read-only).
- Produces (class `CorpusStore`, constructed `new CorpusStore(handle)`):
  - `append(record: CorpusRecordV2): DbResult<void>` — one transaction: repository, baseline (both INSERT OR IGNORE + equality check), corpus_record, merge_base rows, conflict_path rows, conflict_region rows. Duplicate PK with identical content → ok (idempotent); with different content → kind `"db"`.
  - `resumeKeys(): DbResult<Set<string>>` — same string format as carried `resumeKey(record)`: `JSON.stringify([repository.id, merge.sha, baselineId])`.
  - `get(repositoryId: string, mergeSha: string, baselineId: string): DbResult<CorpusRecordV2 | null>`
  - `list(): DbResult<CorpusRecordV2[]>` — ordered by (repository_id, merge_sha, baseline_id).

Row mapping (exact): `repository` → repository table by `record.repository` union; `baseline` row from `record.baselineId` + `record.replayProvenance` fields `gitVersion, algorithm, strategy, environmentPolicy, normalizationVersion` and `replay_command` = `canonicalJson({algorithm, strategy})` is WRONG — the carried code derives baselineId from a replay command string not exposed on the record. The record does not carry the replay command, so store `replay_command` as the empty-marker `"(not recorded on CorpusRecordV2)"`? No — omitted columns must not hold fake data. Resolution: `baseline.replay_command` is dropped from the INSERT and the schema keeps the column NOT NULL — **this is a real conflict; resolve it by storing the only faithful value the record carries**: `replay_command` = `canonicalJson(record.replayProvenance)`. It is derivable, deterministic, and honest (the full provenance envelope, which is what baselineId binds). Document this in a comment in `corpus-store.ts`.
`parent_attr_ours/theirs` = `record.replayProvenance.parentAttributes.ours/theirs`; `repo_merge_config_hash` = `record.replayProvenance.repoMergeConfigHash`; `merge_base.base_index` = index in `record.mergeBases`; reachability counts joined from `record.baseReachabilityCounts` by `baseSha` (absent → NULL pair); region JSON columns = `canonicalJson` of the corresponding record fields; `novel_after_normalization` boolean → 0/1; reconstruction inverts all of this exactly (booleans back from 0/1, `error` field omitted—not null—when `error_json` IS NULL, `changedPathIntersection` null for non-single topology, arrays rebuilt in stored order).

- [ ] **Step 1: Write the failing test `tests/db/corpus-store.test.ts`**

Reuse a real record shape. Build two fixtures inline (do not import test helpers from `tests/evaluation/` — carried):

```typescript
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { CorpusStore } from "../../src/db/corpus-store.js";
import { closeDb, openDb, type DbHandle } from "../../src/db/open.js";
import { resumeKey } from "../../src/evaluation/corpus.js";
import type { CorpusRecordV2 } from "../../src/evaluation/types.js";

const OID_A = "a".repeat(40);
const OID_B = "b".repeat(40);
const OID_C = "c".repeat(40);
const OID_D = "d".repeat(40);
const DIGEST = "e".repeat(64);

function conflictedRecord(): CorpusRecordV2 {
	return {
		schemaVersion: 2,
		repository: { kind: "local", id: "local:/tmp/repo", absolutePath: "/tmp/repo" },
		merge: {
			repositoryId: "local:/tmp/repo",
			sha: OID_A,
			parents: [OID_B, OID_C],
			authorDate: "2026-01-01T00:00:00Z",
			subject: "merge it",
		},
		baselineId: DIGEST,
		replayProvenance: {
			gitVersion: "2.55.0",
			algorithm: "merge-tree-write-tree",
			strategy: "ort",
			environmentPolicy: "isolated-v1",
			normalizationVersion: "v1",
			parentAttributes: { ours: null, theirs: null },
			repoMergeConfigHash: null,
		},
		mergeBases: [OID_D],
		baseTopology: "single",
		baseReachabilityCounts: [
			{ baseSha: OID_D, oursExclusiveCommits: 3, theirsExclusiveCommits: 5 },
		],
		changedPathIntersection: ["src/a.ts", "src/b.ts"],
		replayStatus: "conflicted",
		automaticTreeOid: OID_A,
		conflictPaths: ["src/a.ts"],
		conflictRegions: [
			{
				path: "src/a.ts",
				ordinal: 1,
				category: "other",
				conflictKind: "content",
				stageOids: { base: OID_B, ours: OID_C, theirs: OID_D },
				localizationStatus: "exact",
				automaticRanges: {
					base: { startLine: 1, endLineExclusive: 3 },
					ours: { startLine: 1, endLineExclusive: 4 },
					theirs: { startLine: 1, endLineExclusive: 5 },
				},
				resolutionRange: { startLine: 1, endLineExclusive: 4 },
				rawDigests: { base: DIGEST, ours: DIGEST, theirs: DIGEST, resolution: DIGEST },
				normalizedDigests: { base: DIGEST, ours: DIGEST, theirs: DIGEST, resolution: DIGEST },
				rawCounts: {
					base: { lines: 2, bytes: 10 },
					ours: { lines: 3, bytes: 15 },
					theirs: { lines: 4, bytes: 20 },
					resolution: { lines: 3, bytes: 15 },
				},
				resolutionClass: "ours",
				novelAfterNormalization: false,
				tripleKey: DIGEST,
			},
			{
				path: "src/a.ts",
				ordinal: 2,
				category: "other",
				conflictKind: "content",
				stageOids: { base: null, ours: OID_C, theirs: OID_D },
				localizationStatus: "ambiguous",
				automaticRanges: { base: null, ours: null, theirs: null },
				resolutionRange: null,
				rawDigests: { base: null, ours: null, theirs: null, resolution: null },
				normalizedDigests: { base: null, ours: null, theirs: null, resolution: null },
				rawCounts: { base: null, ours: null, theirs: null, resolution: null },
				resolutionClass: "ambiguous",
				novelAfterNormalization: null,
				tripleKey: null,
			},
		],
	};
}

let dir: string;
let handle: DbHandle;
let store: CorpusStore;
beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "mrgr-db-"));
	const opened = openDb(join(dir, "mrgr.db"), { create: true });
	if (!opened.ok) throw new Error(opened.error.message);
	handle = opened.value;
	store = new CorpusStore(handle);
});
afterEach(() => {
	closeDb(handle);
	rmSync(dir, { recursive: true, force: true });
});

describe("CorpusStore", () => {
	it("round-trips a conflicted record exactly", () => {
		const record = conflictedRecord();
		expect(store.append(record).ok).toBe(true);
		const got = store.get(record.repository.id, record.merge.sha, record.baselineId);
		expect(got.ok).toBe(true);
		if (got.ok) expect(got.value).toEqual(record);
	});

	it("is idempotent for an identical duplicate, errors on a different one", () => {
		const record = conflictedRecord();
		store.append(record);
		expect(store.append(record).ok).toBe(true);
		const different = { ...conflictedRecord(), automaticTreeOid: OID_B };
		const second = store.append(different);
		expect(second.ok).toBe(false);
		if (!second.ok) expect(second.error.kind).toBe("db");
	});

	it("resumeKeys matches the carried resumeKey format", () => {
		const record = conflictedRecord();
		store.append(record);
		const keys = store.resumeKeys();
		expect(keys.ok).toBe(true);
		if (keys.ok) expect(keys.value.has(resumeKey(record))).toBe(true);
	});

	it("the store rejects an exact region missing its digests even when app validation is bypassed", () => {
		const record = conflictedRecord();
		store.append(record);
		expect(() =>
			handle.db
				.prepare(
					`INSERT INTO conflict_region
					 (repository_id, merge_sha, baseline_id, path, ordinal, category,
					  conflict_kind, localization_status, resolution_class)
					 VALUES (?, ?, ?, ?, 9, 'other', 'content', 'exact', 'ours')`,
				)
				.run(record.repository.id, record.merge.sha, record.baselineId, "src/a.ts"),
		).toThrow(/CHECK/i);
	});

	it("get returns null for an absent record", () => {
		const got = store.get("nope", OID_A, DIGEST);
		expect(got.ok).toBe(true);
		if (got.ok) expect(got.value).toBeNull();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/db/corpus-store.test.ts`
Expected: FAIL — `corpus-store.js` not found. (If `resumeKey` is not exported from `../evaluation/corpus.js`, check with `grep -n "export function resumeKey" src/evaluation/corpus.ts`; it is exported at corpus.ts:800. Do not modify the carried file either way — if it were not exported, reimplement the three-element `JSON.stringify` inline in the test.)

- [ ] **Step 3: Write `src/db/corpus-store.ts`**

```typescript
import { canonicalJson } from "./canonical.js";
import { dbErr, dbOk, type DbResult } from "./result.js";
import type { DbHandle } from "./open.js";
import type {
	BaseReachabilityCount,
	ConflictRegionRecord,
	CorpusRecordV2,
	RepositoryRef,
} from "../evaluation/types.js";
import type { ToolError } from "../evaluation/result.js";

/**
 * Corpus persistence over mrgr-db/1.
 *
 * baseline.replay_command: CorpusRecordV2 does not carry the literal replay
 * command string that baselineId was derived from (that lives inside the
 * carried git.ts). The faithful, deterministic stand-in is the canonical JSON
 * of the full provenance envelope, which is exactly what baselineId binds.
 */
export class CorpusStore {
	constructor(private readonly handle: DbHandle) {}

	append(record: CorpusRecordV2): DbResult<void> {
		const db = this.handle.db;
		const existing = this.get(
			record.repository.id,
			record.merge.sha,
			record.baselineId,
		);
		if (!existing.ok) return existing;
		if (existing.value !== null) {
			if (canonicalJson(existing.value) === canonicalJson(record)) {
				return dbOk(undefined); // idempotent re-append
			}
			return dbErr("db", "append corpus record", "Duplicate key with different content", {
				repository_id: record.repository.id,
				merge_sha: record.merge.sha,
				baseline_id: record.baselineId,
			});
		}

		try {
			db.exec("BEGIN IMMEDIATE");
			this.insertRepository(record.repository);
			this.insertBaseline(record);
			db.prepare(
				`INSERT INTO corpus_record
				 (repository_id, merge_sha, baseline_id, parent_ours_sha, parent_theirs_sha,
				  author_date, subject, parent_attr_ours, parent_attr_theirs,
				  repo_merge_config_hash, replay_status, automatic_tree_oid, base_topology,
				  changed_path_intersection, error_json)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			).run(
				record.repository.id,
				record.merge.sha,
				record.baselineId,
				record.merge.parents[0],
				record.merge.parents[1],
				record.merge.authorDate,
				record.merge.subject,
				record.replayProvenance.parentAttributes.ours,
				record.replayProvenance.parentAttributes.theirs,
				record.replayProvenance.repoMergeConfigHash,
				record.replayStatus,
				record.automaticTreeOid,
				record.baseTopology,
				record.changedPathIntersection === null
					? null
					: canonicalJson(record.changedPathIntersection),
				record.error === undefined ? null : canonicalJson(record.error),
			);
			this.insertMergeBases(record);
			this.insertConflicts(record);
			db.exec("COMMIT");
			return dbOk(undefined);
		} catch (cause) {
			try {
				db.exec("ROLLBACK");
			} catch {
				/* nothing to roll back */
			}
			return dbErr("db", "append corpus record", "Insert failed", {
				repository_id: record.repository.id,
				merge_sha: record.merge.sha,
				baseline_id: record.baselineId,
				cause: String(cause),
			});
		}
	}

	private insertRepository(repository: RepositoryRef): void {
		this.handle.db
			.prepare(
				`INSERT OR IGNORE INTO repository
				 (id, kind, host, slug, cache_key, absolute_path)
				 VALUES (?, ?, ?, ?, ?, ?)`,
			)
			.run(
				repository.id,
				repository.kind,
				repository.kind === "remote" ? repository.host : null,
				repository.kind === "remote" ? repository.slug : null,
				repository.kind === "remote" ? repository.cacheKey : null,
				repository.kind === "local" ? repository.absolutePath : null,
			);
	}

	private insertBaseline(record: CorpusRecordV2): void {
		this.handle.db
			.prepare(
				`INSERT OR IGNORE INTO baseline
				 (baseline_id, git_version, algorithm, strategy, environment_policy,
				  normalization_version, replay_command)
				 VALUES (?, ?, ?, ?, ?, ?, ?)`,
			)
			.run(
				record.baselineId,
				record.replayProvenance.gitVersion,
				record.replayProvenance.algorithm,
				record.replayProvenance.strategy,
				record.replayProvenance.environmentPolicy,
				record.replayProvenance.normalizationVersion,
				canonicalJson(record.replayProvenance),
			);
	}

	private insertMergeBases(record: CorpusRecordV2): void {
		const counts = new Map<string, BaseReachabilityCount>(
			record.baseReachabilityCounts.map((c) => [c.baseSha, c]),
		);
		const insert = this.handle.db.prepare(
			`INSERT INTO merge_base
			 (repository_id, merge_sha, baseline_id, base_sha, base_index,
			  ours_exclusive_commits, theirs_exclusive_commits)
			 VALUES (?, ?, ?, ?, ?, ?, ?)`,
		);
		record.mergeBases.forEach((baseSha, index) => {
			const count = counts.get(baseSha);
			insert.run(
				record.repository.id,
				record.merge.sha,
				record.baselineId,
				baseSha,
				index,
				count?.oursExclusiveCommits ?? null,
				count?.theirsExclusiveCommits ?? null,
			);
		});
	}

	private insertConflicts(record: CorpusRecordV2): void {
		const insertPath = this.handle.db.prepare(
			`INSERT INTO conflict_path (repository_id, merge_sha, baseline_id, path)
			 VALUES (?, ?, ?, ?)`,
		);
		for (const path of record.conflictPaths) {
			insertPath.run(record.repository.id, record.merge.sha, record.baselineId, path);
		}
		const insertRegion = this.handle.db.prepare(
			`INSERT INTO conflict_region
			 (repository_id, merge_sha, baseline_id, path, ordinal, category,
			  conflict_kind, stage_oid_base, stage_oid_ours, stage_oid_theirs,
			  localization_status, resolution_class, novel_after_normalization,
			  triple_key, automatic_ranges, resolution_range, raw_digests,
			  normalized_digests, raw_counts)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		);
		for (const region of record.conflictRegions) {
			insertRegion.run(
				record.repository.id,
				record.merge.sha,
				record.baselineId,
				region.path,
				region.ordinal,
				region.category,
				region.conflictKind,
				region.stageOids.base,
				region.stageOids.ours,
				region.stageOids.theirs,
				region.localizationStatus,
				region.resolutionClass,
				region.novelAfterNormalization === null
					? null
					: region.novelAfterNormalization
						? 1
						: 0,
				region.tripleKey,
				region.localizationStatus === "exact" || hasAnyRange(region)
					? canonicalJson(region.automaticRanges)
					: canonicalJson(region.automaticRanges),
				region.resolutionRange === null ? null : canonicalJson(region.resolutionRange),
				region.rawDigests === null ? null : canonicalJson(region.rawDigests),
				region.normalizedDigests === null
					? null
					: canonicalJson(region.normalizedDigests),
				region.rawCounts === null ? null : canonicalJson(region.rawCounts),
			);
		}
	}

	get(
		repositoryId: string,
		mergeSha: string,
		baselineId: string,
	): DbResult<CorpusRecordV2 | null> {
		try {
			const row = this.handle.db
				.prepare(
					`SELECT cr.*, r.kind AS repo_kind, r.host, r.slug, r.cache_key,
					        r.absolute_path,
					        b.git_version, b.algorithm, b.strategy, b.environment_policy,
					        b.normalization_version
					 FROM corpus_record cr
					 JOIN repository r ON r.id = cr.repository_id
					 JOIN baseline b ON b.baseline_id = cr.baseline_id
					 WHERE cr.repository_id = ? AND cr.merge_sha = ? AND cr.baseline_id = ?`,
				)
				.get(repositoryId, mergeSha, baselineId) as
				| Record<string, unknown>
				| undefined;
			if (row === undefined) return dbOk(null);
			return dbOk(this.rowToRecord(row));
		} catch (cause) {
			return dbErr("db", "get corpus record", "Read failed", {
				repository_id: repositoryId,
				merge_sha: mergeSha,
				baseline_id: baselineId,
				cause: String(cause),
			});
		}
	}

	list(): DbResult<CorpusRecordV2[]> {
		try {
			const rows = this.handle.db
				.prepare(
					`SELECT cr.*, r.kind AS repo_kind, r.host, r.slug, r.cache_key,
					        r.absolute_path,
					        b.git_version, b.algorithm, b.strategy, b.environment_policy,
					        b.normalization_version
					 FROM corpus_record cr
					 JOIN repository r ON r.id = cr.repository_id
					 JOIN baseline b ON b.baseline_id = cr.baseline_id
					 ORDER BY cr.repository_id, cr.merge_sha, cr.baseline_id`,
				)
				.all() as Record<string, unknown>[];
			return dbOk(rows.map((row) => this.rowToRecord(row)));
		} catch (cause) {
			return dbErr("db", "list corpus records", "Read failed", {
				cause: String(cause),
			});
		}
	}

	resumeKeys(): DbResult<Set<string>> {
		try {
			const rows = this.handle.db
				.prepare("SELECT repository_id, merge_sha, baseline_id FROM corpus_record")
				.all() as { repository_id: string; merge_sha: string; baseline_id: string }[];
			return dbOk(
				new Set(
					rows.map((r) =>
						JSON.stringify([r.repository_id, r.merge_sha, r.baseline_id]),
					),
				),
			);
		} catch (cause) {
			return dbErr("db", "corpus resume keys", "Read failed", {
				cause: String(cause),
			});
		}
	}

	private rowToRecord(row: Record<string, unknown>): CorpusRecordV2 {
		const repositoryId = row.repository_id as string;
		const mergeSha = row.merge_sha as string;
		const baselineId = row.baseline_id as string;

		const repository: RepositoryRef =
			row.repo_kind === "remote"
				? {
						kind: "remote",
						id: repositoryId,
						host: row.host as string,
						slug: row.slug as string,
						cacheKey: row.cache_key as string,
					}
				: {
						kind: "local",
						id: repositoryId,
						absolutePath: row.absolute_path as string,
					};

		const bases = this.handle.db
			.prepare(
				`SELECT base_sha, base_index, ours_exclusive_commits, theirs_exclusive_commits
				 FROM merge_base
				 WHERE repository_id = ? AND merge_sha = ? AND baseline_id = ?
				 ORDER BY base_index`,
			)
			.all(repositoryId, mergeSha, baselineId) as {
			base_sha: string;
			base_index: number;
			ours_exclusive_commits: number | null;
			theirs_exclusive_commits: number | null;
		}[];

		const paths = this.handle.db
			.prepare(
				`SELECT path FROM conflict_path
				 WHERE repository_id = ? AND merge_sha = ? AND baseline_id = ?
				 ORDER BY path`,
			)
			.all(repositoryId, mergeSha, baselineId) as { path: string }[];

		const regions = this.handle.db
			.prepare(
				`SELECT * FROM conflict_region
				 WHERE repository_id = ? AND merge_sha = ? AND baseline_id = ?
				 ORDER BY path, ordinal`,
			)
			.all(repositoryId, mergeSha, baselineId) as Record<string, unknown>[];

		const record: CorpusRecordV2 = {
			schemaVersion: 2,
			repository,
			merge: {
				repositoryId,
				sha: mergeSha,
				parents: [row.parent_ours_sha as string, row.parent_theirs_sha as string],
				authorDate: row.author_date as string,
				subject: row.subject as string,
			},
			baselineId,
			replayProvenance: {
				gitVersion: row.git_version as string,
				algorithm: row.algorithm as "merge-tree-write-tree",
				strategy: row.strategy as "ort",
				environmentPolicy: row.environment_policy as "isolated-v1",
				normalizationVersion: row.normalization_version as "v1",
				parentAttributes: {
					ours: row.parent_attr_ours as string | null,
					theirs: row.parent_attr_theirs as string | null,
				},
				repoMergeConfigHash: row.repo_merge_config_hash as string | null,
			},
			mergeBases: bases.map((b) => b.base_sha),
			baseTopology: row.base_topology as CorpusRecordV2["baseTopology"],
			baseReachabilityCounts: bases
				.filter((b) => b.ours_exclusive_commits !== null)
				.map((b) => ({
					baseSha: b.base_sha,
					oursExclusiveCommits: b.ours_exclusive_commits as number,
					theirsExclusiveCommits: b.theirs_exclusive_commits as number,
				})),
			changedPathIntersection:
				row.changed_path_intersection === null
					? null
					: (JSON.parse(row.changed_path_intersection as string) as string[]),
			replayStatus: row.replay_status as CorpusRecordV2["replayStatus"],
			automaticTreeOid: row.automatic_tree_oid as string | null,
			conflictPaths: paths.map((p) => p.path),
			conflictRegions: regions.map((r) => rowToRegion(r)),
		};
		if (row.error_json !== null) {
			return { ...record, error: JSON.parse(row.error_json as string) as ToolError };
		}
		return record;
	}
}

function rowToRegion(row: Record<string, unknown>): ConflictRegionRecord {
	const common = {
		path: row.path as string,
		ordinal: row.ordinal as number,
		category: row.category as ConflictRegionRecord["category"],
		conflictKind: row.conflict_kind as string,
		stageOids: {
			base: row.stage_oid_base as string | null,
			ours: row.stage_oid_ours as string | null,
			theirs: row.stage_oid_theirs as string | null,
		},
	};
	const parse = <T>(column: unknown): T => JSON.parse(column as string) as T;
	if (row.localization_status === "exact") {
		return {
			...common,
			localizationStatus: "exact",
			automaticRanges: parse(row.automatic_ranges),
			resolutionRange: parse(row.resolution_range),
			rawDigests: parse(row.raw_digests),
			normalizedDigests: parse(row.normalized_digests),
			rawCounts: parse(row.raw_counts),
			resolutionClass: row.resolution_class as Exclude<
				ConflictRegionRecord["resolutionClass"],
				"ambiguous"
			>,
			novelAfterNormalization: row.novel_after_normalization === 1,
			tripleKey: row.triple_key as string,
		};
	}
	return {
		...common,
		localizationStatus: row.localization_status as
			| "ambiguous"
			| "unsupported-binary"
			| "unsupported-structural",
		automaticRanges:
			row.automatic_ranges === null
				? { base: null, ours: null, theirs: null }
				: parse(row.automatic_ranges),
		resolutionRange:
			row.resolution_range === null ? null : parse(row.resolution_range),
		rawDigests:
			row.raw_digests === null
				? { base: null, ours: null, theirs: null, resolution: null }
				: parse(row.raw_digests),
		normalizedDigests:
			row.normalized_digests === null
				? { base: null, ours: null, theirs: null, resolution: null }
				: parse(row.normalized_digests),
		rawCounts:
			row.raw_counts === null
				? { base: null, ours: null, theirs: null, resolution: null }
				: parse(row.raw_counts),
		resolutionClass: "ambiguous",
		novelAfterNormalization: null,
		tripleKey: null,
	};
}

function hasAnyRange(region: ConflictRegionRecord): boolean {
	return (
		region.automaticRanges.base !== null ||
		region.automaticRanges.ours !== null ||
		region.automaticRanges.theirs !== null
	);
}
```

Implementation note: inexact regions store `automatic_ranges`/`rawDigests`
etc. as canonical JSON of the *nullable* structures (the round trip preserves
partial values like `{base: null, ours: {...}, theirs: null}`); the
reconstruction only substitutes the all-null object when the column itself is
NULL. Both directions are exercised by the round-trip test's second region.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run tests/db/corpus-store.test.ts`
Expected: PASS (5 tests). Fix any mapping asymmetry the round-trip test finds; `toEqual(record)` is the contract.

- [ ] **Step 5: Typecheck and commit**

```bash
pnpm exec tsc -p tsconfig.json --noEmit
git add packages/core/src/db/corpus-store.ts packages/core/tests/db/corpus-store.test.ts
git commit -m "feat(db): CorpusStore with CHECK-enforced region unions and exact round trip"
```

---

### Task 4: EvidenceStore

**Files:**
- Create: `packages/core/src/db/evidence-store.ts`
- Test: `packages/core/tests/db/evidence-store.test.ts`

**Interfaces:**
- Consumes: `DbHandle` (Task 1), `putBlob`/`getBlob` (Task 2), `canonicalJson` (Task 2), `CorpusStore` (Task 3, in tests to satisfy FKs), types `EvidenceRecord`, `evidenceKey`, `PATH_LEVEL_ORDINAL` from `../m1a/sidecar.js`, `EvidenceBundle` from `../m1a/evidence.js`.
- Produces (class `EvidenceStore`, constructed `new EvidenceStore(handle)`):
  - `append(record: EvidenceRecord): DbResult<void>` — validates with `parseEvidenceRecord` first; for `status: "ok"` verifies the matching `conflict_region` row exists (fail-closed, kind `"db"`, reason `"missing-region"`); stores hunks + non-null preimages as blobs; `dependency_graph` entries land in `evidence_dep` (per file — `INSERT OR IGNORE`, entries are `"ours:path"`/`"theirs:path"` strings split on the first `:`); idempotent identical duplicate; different duplicate → kind `"db"`.
  - `resumeKeys(): DbResult<Set<string>>` — carried `evidenceKey` format (5-element JSON array).
  - `get(repositoryId: string, mergeSha: string, baselineId: string, conflictPath: string, ordinal: number): DbResult<EvidenceRecord | null>` — reconstructs the exact record including `schemaVersion: 1`, hunk/preimage strings decoded from blobs, `dependency_graph` re-assembled sorted (`ours:` entries then `theirs:` entries, each path-sorted — deterministic; the sidecar's array order is not semantically meaningful, and the round-trip test fixture uses that same sorted order so `toEqual` holds).
  - `list(): DbResult<EvidenceRecord[]>` — PK order.

Key tests (write first, exactly this list): (1) ok-record round trip byte-for-byte on a fixture with a multi-byte-UTF-8 preimage and a `null` theirs preimage; (2) failed record with `conflict_ordinal: PATH_LEVEL_ORDINAL` (0) appends and rounds trip; (3) ok record for a region that has no `conflict_region` row → error `missing-region`; (4) crash-resume equivalent: append region 1 only, `resumeKeys` contains region 1's key and not region 2's, append region 2 succeeds, both present (PK lookup, no file scan — mirror of `tests/m1a/sidecar.test.ts:209`); (5) two ok bundles sharing an identical preimage produce one `blob` row for it (dedup across regions).

- [ ] **Step 1: Write the failing test** — follow the pattern of Task 3's test file: `beforeEach` opens a DB and appends `conflictedRecord()` from a local copy of the Task 3 fixture (copy the fixture function into this test file; tests must not import from other test files), then build `EvidenceRecord` fixtures keyed to it:

```typescript
// Fixture sketch — complete the file following Task 3's structure.
import { EvidenceStore } from "../../src/db/evidence-store.js";
import { PATH_LEVEL_ORDINAL, evidenceKey } from "../../src/m1a/sidecar.js";
import type { EvidenceRecord } from "../../src/m1a/sidecar.js";

function okRecord(): EvidenceRecord {
	return {
		schemaVersion: 1,
		repository_id: "local:/tmp/repo",
		merge_sha: "a".repeat(40),
		baseline_id: "e".repeat(64),
		conflict_path: "src/a.ts",
		conflict_ordinal: 1,
		status: "ok",
		bundle: {
			conflict_path: "src/a.ts",
			conflict_ordinal: 1,
			conflict_hunk_ours: "ours-hunk\n",
			conflict_hunk_base: "base-hunk\n",
			conflict_hunk_theirs: "theirs-hunk\n",
			preimage_ours: "héllo wörld\n",
			preimage_theirs: null,
			preimage_ours_bytes: Buffer.byteLength("héllo wörld\n", "utf8"),
			preimage_theirs_bytes: null,
			preimage_ours_truncated: false,
			preimage_theirs_truncated: false,
			dependency_graph: ["ours:src/a.ts", "theirs:src/b.ts"],
			dependency_graph_status: "derived",
		},
	};
}

function failedPathLevelRecord(): EvidenceRecord {
	return {
		schemaVersion: 1,
		repository_id: "local:/tmp/repo",
		merge_sha: "a".repeat(40),
		baseline_id: "e".repeat(64),
		conflict_path: "src/a.ts",
		conflict_ordinal: PATH_LEVEL_ORDINAL,
		status: "failed",
		error: { kind: "git", operation: "extract", message: "boom" },
	};
}
```

Assertions per the five key tests above; test (3) uses `{...okRecord(), conflict_ordinal: 7, bundle: {...okRecord().bundle, conflict_ordinal: 7}}` (no region 7 exists) and expects `error.details?.reason === "missing-region"`.

- [ ] **Step 2: Run to verify failure** — `pnpm exec vitest run tests/db/evidence-store.test.ts` → module not found.

- [ ] **Step 3: Implement `src/db/evidence-store.ts`**

Structure mirrors `CorpusStore`: idempotency pre-check via `get` + `canonicalJson` equality; `BEGIN IMMEDIATE` transaction wrapping blob puts + row insert + `evidence_dep` inserts; rollback on any failure. Row mapping:

```typescript
// insert (status "ok"):
//   hunk_*_sha        = putBlob(utf8(bundle.conflict_hunk_*))
//   preimage_*_sha    = bundle.preimage_* === null ? null : putBlob(utf8(...))
//   preimage_*_bytes  = bundle.preimage_*_bytes
//   preimage_*_truncated = bundle.preimage_*_truncated ? 1 : 0
//   dependency_graph_status = bundle.dependency_graph_status
//   evidence_dep rows: for entry of bundle.dependency_graph:
//     const sep = entry.indexOf(":");
//     side = entry.slice(0, sep) as "ours" | "theirs"; dep_path = entry.slice(sep + 1)
//     INSERT OR IGNORE (dedup across regions of the same file)
// insert (status "failed"): error_json = canonicalJson(record.error); all bundle columns NULL
// region existence check (status "ok" only):
//   SELECT 1 FROM conflict_region WHERE repository_id=? AND merge_sha=? AND baseline_id=? AND path=? AND ordinal=?
//   absent -> dbErr("db", "append evidence", "No conflict_region row for this bundle", { reason: "missing-region", ... })
// get(): reconstruct; dependency_graph = SELECT side, dep_path FROM evidence_dep WHERE (file key) ORDER BY side, dep_path
//        mapped back to `${side}:${dep_path}`; note "ours" < "theirs" lexically, matching the sorted contract.
// resumeKeys(): SELECT the five key columns; JSON.stringify five-element array (same as evidenceKey()).
```

Write it in full following those comments and Task 3's error-handling shape (every catch → `dbErr("db", ...)` with the record key in details).

- [ ] **Step 4: Run to verify pass** — all 5 tests green.

- [ ] **Step 5: Typecheck, verify-carried, commit**

```bash
pnpm exec tsc -p tsconfig.json --noEmit
cd ../.. && bash scripts/verify-carried.sh && cd packages/core
git add packages/core/src/db/evidence-store.ts packages/core/tests/db/evidence-store.test.ts
git commit -m "feat(db): EvidenceStore with blob-backed bundles, path-level failures, PK resume"
```

---

### Task 5: LedgerStore — append-only, content-derived IDs

**Files:**
- Create: `packages/core/src/db/ledger-store.ts`
- Test: `packages/core/tests/db/ledger-store.test.ts`

**Interfaces:**
- Consumes: `DbHandle`, `canonicalJson`, `sha256Hex` (Tasks 1–2).
- Produces:

```typescript
export type LedgerRecordType =
	| "decision" | "halt" | "debt" | "resurrection" | "gate_vector";

export interface LedgerInput {
	recordType: LedgerRecordType;
	recordSchemaVersion: string;      // "mrgr-ledger/1" for now
	inputRefs: readonly string[];
	intermediateTreeOid: string | null;
	outputTreeOid: string | null;
	evidenceDigest: string | null;
	auditPhase: string;
	adjudicatorKind: "human" | "script" | "model";
	adjudicatorIdentity: string;
	reason: string | null;
	payload: unknown;                 // JSON-serializable, type-specific body
	supersedes: string | null;        // prior ledger id
}

export interface LedgerRecord extends LedgerInput {
	id: string;        // sha256Hex(canonicalJson(input)) — createdAt/seq excluded
	seq: number;
	createdAt: string; // ISO-8601 UTC
}

export class LedgerStore {
	constructor(handle: DbHandle);
	append(input: LedgerInput): DbResult<LedgerRecord>;
	get(id: string): DbResult<LedgerRecord | null>;
	list(): DbResult<LedgerRecord[]>; // ORDER BY seq
}
```

`append` semantics: `id = sha256Hex(canonicalJson(input))`. Inside one `BEGIN IMMEDIATE`: if a row with `id` exists and its canonical input matches → return the existing record (idempotent); exists with different content → impossible by construction (id is the content hash) but check anyway and fail kind `"db"`; else `seq = (SELECT COALESCE(MAX(seq), 0) + 1 FROM ledger)`, `PRAGMA synchronous=FULL` for the transaction (set before BEGIN, restore NORMAL after COMMIT), insert, commit.

- [ ] **Step 1: Write the failing test** — five tests:

```typescript
// (fixtures + beforeEach/afterEach as in Task 2's test)
import { LedgerStore, type LedgerInput } from "../../src/db/ledger-store.js";

function decisionInput(n = 1): LedgerInput {
	return {
		recordType: "decision",
		recordSchemaVersion: "mrgr-ledger/1",
		inputRefs: ["a".repeat(40), "b".repeat(40)],
		intermediateTreeOid: "c".repeat(40),
		outputTreeOid: "d".repeat(40),
		evidenceDigest: "e".repeat(64),
		auditPhase: "post-adjudication",
		adjudicatorKind: "human",
		adjudicatorIdentity: "svnbjrn",
		reason: null,
		payload: { region: "src/a.ts", ordinal: n, choice: "compose" },
		supersedes: null,
	};
}

describe("LedgerStore", () => {
	it("appends with content-derived id and dense seq", () => {
		const store = new LedgerStore(handle);
		const first = store.append(decisionInput(1));
		const second = store.append(decisionInput(2));
		expect(first.ok && second.ok).toBe(true);
		if (!first.ok || !second.ok) return;
		expect(first.value.id).toMatch(/^[0-9a-f]{64}$/);
		expect(first.value.seq).toBe(1);
		expect(second.value.seq).toBe(2);
		expect(first.value.id).not.toBe(second.value.id);
	});

	it("re-appending the same logical record is idempotent: one row, same id", () => {
		const store = new LedgerStore(handle);
		const a = store.append(decisionInput(1));
		const b = store.append(decisionInput(1));
		expect(a.ok && b.ok).toBe(true);
		if (a.ok && b.ok) expect(b.value.id).toBe(a.value.id);
		const n = handle.db.prepare("SELECT count(*) AS n FROM ledger").get() as { n: number };
		expect(n.n).toBe(1);
	});

	it("UPDATE and DELETE are refused by the store's triggers", () => {
		const store = new LedgerStore(handle);
		const appended = store.append(decisionInput(1));
		if (!appended.ok) throw new Error("append failed");
		expect(() =>
			handle.db.prepare("UPDATE ledger SET reason = 'edited' WHERE id = ?").run(appended.value.id),
		).toThrow(/append-only/);
		expect(() =>
			handle.db.prepare("DELETE FROM ledger WHERE id = ?").run(appended.value.id),
		).toThrow(/append-only/);
	});

	it("a halt without a reason is refused at the SQL layer", () => {
		const store = new LedgerStore(handle);
		const halt = store.append({ ...decisionInput(1), recordType: "halt", reason: null });
		expect(halt.ok).toBe(false);
	});

	it("corrections append with supersedes, never edit", () => {
		const store = new LedgerStore(handle);
		const original = store.append(decisionInput(1));
		if (!original.ok) throw new Error("append failed");
		const correction = store.append({
			...decisionInput(1),
			payload: { region: "src/a.ts", ordinal: 1, choice: "keep_ours" },
			supersedes: original.value.id,
		});
		expect(correction.ok).toBe(true);
		const listed = store.list();
		if (listed.ok) expect(listed.value).toHaveLength(2);
	});
});
```

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement `src/db/ledger-store.ts`** — per the semantics above; row↔record mapping stores `inputRefs` as `canonicalJson`, `payload` as `canonicalJson`; `get`/`list` parse them back. Full error-value discipline as in Task 3.

- [ ] **Step 4: Run to verify pass (5 tests).**

- [ ] **Step 5: Commit** — `git commit -m "feat(db): append-only LedgerStore with content-derived ids and trigger enforcement"`.

---

### Task 6: Concurrency — the D90 regression test

**Files:**
- Test: `packages/core/tests/db/concurrency.test.ts`
- Create: `packages/core/tests/db/helpers/ledger-worker.mjs` (plain JS worker; no TS loader needed in a worker thread)

**Interfaces:**
- Consumes: built store code — this test runs against the compiled behavior via `tsx`-executed vitest, but the worker itself must not import TS. Solution: the worker uses `node:sqlite` directly with the same SQL the store uses (append transaction inline). That keeps the test dependency-free and still exercises the schema + locking, which is what D90 is about.

- [ ] **Step 1: Write `tests/db/helpers/ledger-worker.mjs`**

```javascript
import { parentPort, workerData } from "node:worker_threads";
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

const { dbPath, workerName, count } = workerData;
const db = new DatabaseSync(dbPath);
db.exec("PRAGMA busy_timeout=10000");
db.exec("PRAGMA foreign_keys=ON");

const inserted = [];
for (let i = 0; i < count; i++) {
	const payload = JSON.stringify({ worker: workerName, i });
	const id = createHash("sha256").update(payload).digest("hex");
	for (;;) {
		try {
			db.exec("BEGIN IMMEDIATE");
			const { next } = db
				.prepare("SELECT COALESCE(MAX(seq), 0) + 1 AS next FROM ledger")
				.get();
			db.prepare(
				`INSERT INTO ledger (id, seq, record_type, record_schema_version,
				 input_refs_json, audit_phase, adjudicator_kind, adjudicator_identity,
				 reason, payload_json, created_at)
				 VALUES (?, ?, 'decision', 'mrgr-ledger/1', '[]', 'test', 'script', ?,
				         NULL, ?, ?)`,
			).run(id, next, workerName, payload, new Date().toISOString());
			db.exec("COMMIT");
			inserted.push({ id, seq: next });
			break;
		} catch (cause) {
			try { db.exec("ROLLBACK"); } catch { /* not in a transaction */ }
			if (!String(cause).includes("locked") && !String(cause).includes("busy")) throw cause;
			// busy_timeout already waits; loop as a belt-and-braces retry
		}
	}
}
db.close();
parentPort.postMessage(inserted);
```

- [ ] **Step 2: Write the failing-in-spirit test `tests/db/concurrency.test.ts`**

```typescript
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Worker } from "node:worker_threads";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { closeDb, openDb } from "../../src/db/open.js";

const WORKER = new URL("./helpers/ledger-worker.mjs", import.meta.url);
const PER_WORKER = 25;

let dir: string;
let dbPath: string;
beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "mrgr-db-"));
	dbPath = join(dir, "mrgr.db");
	const opened = openDb(dbPath, { create: true });
	if (!opened.ok) throw new Error(opened.error.message);
	closeDb(opened.value);
});
afterEach(() => {
	rmSync(dir, { recursive: true, force: true });
});

function runWorker(name: string): Promise<{ id: string; seq: number }[]> {
	return new Promise((resolve, reject) => {
		const worker = new Worker(WORKER, {
			workerData: { dbPath, workerName: name, count: PER_WORKER },
		});
		worker.once("message", resolve);
		worker.once("error", reject);
	});
}

describe("concurrent ledger writers (D90 regression)", () => {
	it("two writers, zero id collisions, dense unique seq, all rows survive", async () => {
		const [a, b] = await Promise.all([runWorker("worker-a"), runWorker("worker-b")]);
		expect(a).toHaveLength(PER_WORKER);
		expect(b).toHaveLength(PER_WORKER);

		const opened = openDb(dbPath);
		expect(opened.ok).toBe(true);
		if (!opened.ok) return;
		const rows = opened.value.db
			.prepare("SELECT id, seq FROM ledger ORDER BY seq")
			.all() as { id: string; seq: number }[];
		closeDb(opened.value);

		expect(rows).toHaveLength(PER_WORKER * 2);
		expect(new Set(rows.map((r) => r.id)).size).toBe(PER_WORKER * 2);
		expect(rows.map((r) => r.seq)).toEqual(
			Array.from({ length: PER_WORKER * 2 }, (_, i) => i + 1),
		);
	});
});
```

- [ ] **Step 3: Run** — `pnpm exec vitest run tests/db/concurrency.test.ts`
Expected: PASS. If it fails on lock contention, the schema/pragma layer is wrong — investigate before touching the test (systematic-debugging skill). This test is the direct D90 regression: the source study's failure was two writers computing MAX+1 outside a transaction.

- [ ] **Step 4: Commit** — `git commit -m "test(db): D90 regression — concurrent ledger writers cannot collide"`.

---

### Task 7: RunStore

**Files:**
- Create: `packages/core/src/db/run-store.ts`
- Test: `packages/core/tests/db/run-store.test.ts`

**Interfaces:**
- Consumes: Tasks 1–2.
- Produces:

```typescript
export interface RunConfig {
	arm: string;
	modelName: string | null;
	modelSha: string | null;
	config: unknown; // JSON-serializable
}
export interface RunResultRecord {
	runId: string;
	tripleId: string;
	runIndex: number; // 1-based
	decision: "keep_ours" | "keep_theirs" | "compose" | "halt";
	haltReason: string | null;
	reasonText: string | null;
	inputTokens: number | null;
	outputTokens: number | null;
	durationMs: number | null;
	schemaValid: boolean;
}
export class RunStore {
	constructor(handle: DbHandle);
	createRun(config: RunConfig): DbResult<string>; // runId = sha256Hex(canonicalJson(config)); idempotent
	appendResult(result: RunResultRecord): DbResult<void>; // idempotent identical; differing duplicate -> "db"
	resumeKeys(runId: string): DbResult<Set<string>>; // `${tripleId}|${runIndex}` — replaces _h0_runner's fail-open scan
	listResults(runId: string): DbResult<RunResultRecord[]>;
}
```

- [ ] **Step 1: Write the failing test** — four tests following Task 5's pattern: (1) createRun twice with same config → same id, one row; (2) result round trip incl. `schemaValid` boolean ↔ 0/1; (3) `decision: "halt"` with `haltReason: null` refused at SQL layer; (4) resumeKeys contains appended `${tripleId}|${runIndex}` keys.
- [ ] **Step 2: Run to verify failure.**
- [ ] **Step 3: Implement** following Task 5's transaction/idempotency shape.
- [ ] **Step 4: Run to verify pass.**
- [ ] **Step 5: Commit** — `git commit -m "feat(db): RunStore for experiment arms with PK resume"`.

---### Task 8: Canonical export

**Files:**
- Create: `packages/core/src/db/export.ts`
- Test: `packages/core/tests/db/export.test.ts`

**Interfaces:**
- Consumes: Tasks 1–3, 5 (stores used to populate test DBs).
- Produces:

```typescript
export interface ExportManifest {
	schema_version: string;                 // "mrgr-db/1"
	meta: Record<string, string>;           // the meta table minus created_at? NO — verbatim copy
	tables: Record<string, { rows: number; sha256: string }>; // per exported file
}
export function exportDb(
	handle: DbHandle,
	outDir: string,
	options?: { withBlobs?: boolean },
): DbResult<ExportManifest>;
```

Behavior: for each table in the fixed order `meta, repository, baseline, corpus_record, merge_base, conflict_path, conflict_region, evidence_bundle, evidence_dep, blob, ledger, run, run_result` — `SELECT * ORDER BY <primary key columns>`; each row serialized as `canonicalJson` of the column→value object **excluding** `blob.bytes` (replaced by nothing — the blob table exports `{sha256, byte_len}` only); one row per line, LF, UTF-8, written to `<outDir>/<table>.jsonl` (a table with zero rows writes an empty file — presence is part of the contract). With `withBlobs: true`, raw bytes additionally land in `<outDir>/blobs/<sha256>` (no extension). `manifest.json` = pretty-printed (2-space) canonical-key-order JSON of `ExportManifest`, written last. Directory created with `mkdir recursive`; existing files overwritten (export is a pure function of the DB).

- [ ] **Step 1: Write the failing test** — three tests: (1) export a DB populated via `CorpusStore` + `LedgerStore`; every listed table file exists, manifest row counts match, manifest sha256 of each file matches a recomputed hash; (2) **determinism**: build two DBs inserting the same two corpus records and two ledger records in opposite orders; both exports produce byte-identical files (compare file hashes for every table) — this is the spec's binding "byte-identical export" property; (3) `withBlobs` writes `blobs/<sha256>` files whose recomputed sha256 equals their name.
- [ ] **Step 2: Run to verify failure.**
- [ ] **Step 3: Implement.** PK orderings, explicit per table: `meta(key)`, `repository(id)`, `baseline(baseline_id)`, `corpus_record(repository_id, merge_sha, baseline_id)`, `merge_base(+ base_sha)`, `conflict_path(+ path)`, `conflict_region(+ path, ordinal)`, `evidence_bundle(+ path, ordinal)`, `evidence_dep(+ path, side, dep_path)`, `blob(sha256)`, `ledger(seq)`, `run(run_id)`, `run_result(run_id, triple_id, run_index)`.
- [ ] **Step 4: Run to verify pass.**
- [ ] **Step 5: Commit** — `git commit -m "feat(db): canonical byte-deterministic export with manifest"`.

---

### Task 9: Import from legacy JSONL

**Files:**
- Create: `packages/core/src/db/import.ts`
- Create: `packages/core/tests/db/fixtures/legacy-corpus.jsonl` (2 lines: the Task 3 `conflictedRecord()` fixture serialized, plus a `replayStatus: "clean"` variant with empty conflict arrays, `baseTopology: "none"`, `changedPathIntersection: null`, different `merge_sha`)
- Create: `packages/core/tests/db/fixtures/legacy-evidence.jsonl` (2 lines: Task 4's `okRecord()` and `failedPathLevelRecord()` serialized)
- Test: `packages/core/tests/db/import.test.ts`

**Interfaces:**
- Consumes: carried `readCorpus` from `../evaluation/corpus.js`, carried `readEvidence` from `../m1a/sidecar.js`, `CorpusStore`, `EvidenceStore`, `exportDb`.
- Produces:

```typescript
export interface ImportCounts {
	imported: number;
	skippedDuplicate: number;
	failed: number; // parse-level failures are impossible (readers are fail-closed); this counts store rejections
}
export async function importCorpusJsonl(handle: DbHandle, path: string): Promise<DbResult<ImportCounts>>;
export async function importEvidenceJsonl(handle: DbHandle, path: string): Promise<DbResult<ImportCounts>>;
```

Both: run the carried fail-closed reader (a malformed file aborts the whole import — same posture as everywhere else), then append each record; identical duplicate → `skippedDuplicate`; store rejection → `failed` with the first error returned in `details`. Evidence import order: corpus must be imported first (FKs); an evidence record whose corpus row is absent counts as `failed` with reason in details.

- [ ] **Step 1: Write fixtures + failing test** — three tests: (1) corpus import: `imported: 2`, re-import → `skippedDuplicate: 2`; (2) evidence import after corpus import: `imported: 2` (including the ordinal-0 failed row); evidence import *without* corpus → both `failed`; (3) **round-trip**: import both fixtures → export → import the exported `*.jsonl`? No — export format ≠ legacy format; instead: import fixtures into DB A, export A; import the same fixtures into DB B, export B; A's and B's exports are byte-identical.
- [ ] **Step 2: Run to verify failure.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run to verify pass. Also run the whole suite once:** `pnpm exec vitest run` — carried 120 + m1a + db all green.
- [ ] **Step 5: Commit** — `git commit -m "feat(db): legacy JSONL import via carried fail-closed readers"`.

---

### Task 10: CLI (`mrgr-db`), `--db` on the evidence CLI, docs

**Files:**
- Create: `packages/core/src/db/cli.ts`
- Create: `packages/core/bin/mrgr-db.mjs`
- Modify: `packages/core/package.json` — add `"mrgr-db": "./bin/mrgr-db.mjs"` to `bin`
- Modify: `packages/core/src/m1a/cli.ts` — add `--db PATH` (mutually exclusive with `--out`; with `--db`, corpus comes from `CorpusStore.list()` when `--corpus` is omitted, evidence writes via `EvidenceStore`, resume via `EvidenceStore.resumeKeys()`)
- Modify: `packages/core/README.md` — status table row + short "Persistence" section + engines note
- Test: `packages/core/tests/db/cli.test.ts`

**Interfaces:**
- Consumes: everything above.
- Produces CLI surface:

```
mrgr-db init   --db PATH
mrgr-db import --db PATH (--corpus FILE | --evidence FILE)
mrgr-db export --db PATH --out DIR [--with-blobs]
mrgr-db verify --db PATH
```

`verify` = `PRAGMA integrity_check` + `PRAGMA foreign_key_check` + the openDb version checks + blob digest sweep (`getBlob` every row) — any failure exits 1 with the error on stderr as JSON; success prints per-table row counts. `bin/mrgr-db.mjs` mirrors the existing `bin/mrgr-evidence.mjs` launcher pattern (read it first and copy its structure).

- [ ] **Step 1: Read `bin/mrgr-evidence.mjs` and `src/m1a/cli.ts`** to copy the argument-parsing and exit-code conventions exactly (structured errors to stderr, no exception text).
- [ ] **Step 2: Write the failing test `tests/db/cli.test.ts`** — drives `src/db/cli.ts`'s exported `main(argv: string[]): Promise<number>` directly (same in-process pattern as `tests/evaluation/cli.test.ts` uses for the carried CLI — read that file's structure, do not import it): (1) `init` creates a DB that `openDb` accepts; (2) `import --corpus` on the Task 9 fixture then `export` produces the manifest; (3) `verify` on a good DB exits 0, on a DB with a tampered blob (UPDATE via raw SQL) exits 1; (4) unknown flag exits 2 with usage on stderr.
- [ ] **Step 3: Run to verify failure; implement `src/db/cli.ts` + `bin/mrgr-db.mjs`; run to verify pass.**
- [ ] **Step 4: Wire `--db` into `src/m1a/cli.ts`** — add a test to `tests/db/cli.test.ts` (not to `tests/m1a/` — keep new tests in the db suite): end-to-end on a temp git fixture is heavy, so the test asserts flag plumbing only: `--db` + `--out` together is a usage error; `--db` on a DB containing the Task 9 corpus fixture selects conflicted records (assert via a dry-run/listing mode if one exists — read `src/m1a/cli.ts` first; if no listing mode exists, assert the error path for a DB with zero conflicted records: exit message names the DB, not a JSONL path).
- [ ] **Step 5: Update `packages/core/README.md`** — add to the status table: `| mrgr-db — workspace SQLite store (mrgr-db/1) | works: corpus + evidence + ledger + runs; canonical export; JSONL import |`; a "Persistence" paragraph: DB is storage, JSONL is transport, committed evidence stays exported JSONL, tursodb may inspect the file read-only while no writer runs, engines ≥ 22.5.
- [ ] **Step 6: Full suite + typecheck + verify-carried**

```bash
pnpm exec vitest run
pnpm exec tsc -p tsconfig.json --noEmit
cd ../.. && bash scripts/verify-carried.sh
```

Expected: all green, carried manifest untouched.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/db/cli.ts packages/core/bin/mrgr-db.mjs packages/core/package.json packages/core/src/m1a/cli.ts packages/core/README.md packages/core/tests/db/cli.test.ts
git commit -m "feat(db): mrgr-db CLI (init/import/export/verify) and --db evidence path"
```

---

## Self-review (done at plan-writing time)

- **Spec coverage:** §5 module list → Tasks 1–10 (schema.ts stands in for schema.sql — TS constant survives `tsc` builds without an asset-copy step; spirit preserved, noted in Task 1). §6 DDL → Task 1 verbatim. §7 open/write discipline → Tasks 1, 3–5 (synchronous=FULL in Task 5). §8 export/import → Tasks 8–9. §11 test list items 1–10 → Tasks 3 (2), 4 (1, 3), 5 (4, 6), 6 (5), 8 (8), 9 (9), 2+10 (10), 1 (7). Spec §11 item 9 names the committed `evidence/h0/*.jsonl` as fixtures; the plan substitutes purpose-built 2-line fixtures (the h0 files are 4.9 MB and slow the suite) — the reader/writer pair exercised is identical. Deviation on `mrgr-wp0 scan --db` recorded in Global Constraints.
- **Placeholder scan:** Task 4 Step 3 and Task 7 use directive comments plus a reference implementation pattern (Task 3/5) rather than full listings; every named symbol, column, and semantic is specified exactly — acceptable under "assume a skilled developer", flagged here for the executor.
- **Type consistency:** `DbResult`/`dbErr` (Task 1) used throughout; `evidenceKey` 5-element format (Task 4) matches carried sidecar; `resumeKey` 3-element format (Task 3) matches carried corpus; export table order (Task 8) covers every table in Task 1's DDL.
