import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { putBlob } from "../../src/db/blob.js";
import { sha256Hex } from "../../src/db/canonical.js";
import { CorpusStore } from "../../src/db/corpus-store.js";
import { EvidenceStore } from "../../src/db/evidence-store.js";
import { exportDb } from "../../src/db/export.js";
import { LedgerStore, type LedgerInput } from "../../src/db/ledger-store.js";
import { closeDb, openDb, SCHEMA_VERSION_STRING, type DbHandle } from "../../src/db/open.js";
import type { EvidenceRecord } from "../../src/m1a/sidecar.js";
import type { CorpusRecordV2 } from "../../src/evaluation/types.js";

const REPO_ID = "local:/tmp/repo";
const ABS_PATH = "/tmp/repo";
const OID_PARENT1 = "1".repeat(40);
const OID_PARENT2 = "2".repeat(40);
// Deliberately lexicographically reversed relative to recorded order below,
// so a test that sorted by base_sha instead of base_index would disagree
// with one that sorts by base_index.
const OID_BASE_Z = "z".repeat(40);
const OID_BASE_A = "a".repeat(40);
const DIGEST = "9".repeat(64);

const TABLE_NAMES = [
	"meta",
	"repository",
	"baseline",
	"corpus_record",
	"merge_base",
	"conflict_path",
	"conflict_region",
	"evidence_bundle",
	"evidence_dep",
	"blob",
	"ledger",
	"run",
	"run_result",
] as const;

function region(path: string, base: string): CorpusRecordV2["conflictRegions"][number] {
	return {
		path,
		ordinal: 1,
		category: "other",
		conflictKind: "content",
		stageOids: { base, ours: OID_PARENT1, theirs: OID_PARENT2 },
		localizationStatus: "exact",
		automaticRanges: {
			base: { startLine: 1, endLineExclusive: 2 },
			ours: { startLine: 1, endLineExclusive: 3 },
			theirs: { startLine: 1, endLineExclusive: 4 },
		},
		resolutionRange: { startLine: 1, endLineExclusive: 3 },
		rawDigests: { base: DIGEST, ours: DIGEST, theirs: DIGEST, resolution: DIGEST },
		normalizedDigests: { base: DIGEST, ours: DIGEST, theirs: DIGEST, resolution: DIGEST },
		rawCounts: {
			base: { lines: 1, bytes: 5 },
			ours: { lines: 2, bytes: 10 },
			theirs: { lines: 3, bytes: 15 },
			resolution: { lines: 2, bytes: 10 },
		},
		resolutionClass: "ours",
		novelAfterNormalization: false,
		tripleKey: DIGEST,
	};
}

/**
 * A corpus record whose recorded array order for conflictPaths,
 * conflictRegions and mergeBases deliberately disagrees with sorting by
 * their natural key (path / (path, ordinal) / base_sha). This is the exact
 * shape that motivated adding path_index/array_index/base_index: a test
 * built from single-element arrays can't tell an index-column sort from a
 * natural-key sort, since both agree trivially.
 */
function corpusRecord(mergeSha: string): CorpusRecordV2 {
	return {
		schemaVersion: 2,
		repository: { kind: "local", id: REPO_ID, absolutePath: ABS_PATH },
		merge: {
			repositoryId: REPO_ID,
			sha: mergeSha,
			parents: [OID_PARENT1, OID_PARENT2],
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
		// Recorded order z, a; base_sha sorts a, z — index and natural-key order disagree.
		mergeBases: [OID_BASE_Z, OID_BASE_A],
		baseTopology: "multiple",
		baseReachabilityCounts: [
			{ baseSha: OID_BASE_Z, oursExclusiveCommits: 1, theirsExclusiveCommits: 2 },
			{ baseSha: OID_BASE_A, oursExclusiveCommits: 3, theirsExclusiveCommits: 4 },
		],
		changedPathIntersection: null,
		replayStatus: "conflicted",
		automaticTreeOid: mergeSha,
		// Recorded order z, a; path sorts a, z — index and natural-key order disagree.
		conflictPaths: ["src/z.ts", "src/a.ts"],
		conflictRegions: [region("src/z.ts", OID_BASE_Z), region("src/a.ts", OID_BASE_A)],
	};
}

/**
 * An "ok" evidence record for corpusRecord()'s "src/z.ts" ordinal 1 region,
 * with a caller-supplied dependency_graph. DependencyGraphSchema
 * (m1a/evidence.ts) is a plain array with no ordering or uniqueness
 * constraint, so a sorted, duplicate-free fixture (as one might reach for by
 * default) cannot catch an export that silently sorts by (side, dep_path)
 * instead of by the producer's recorded position — same trap the store's own
 * fix round 4 exists to cover, one layer out.
 */
function evidenceRecord(mergeSha: string, dependencyGraph: string[]): EvidenceRecord {
	return {
		schemaVersion: 1,
		repository_id: REPO_ID,
		merge_sha: mergeSha,
		baseline_id: DIGEST,
		conflict_path: "src/z.ts",
		conflict_ordinal: 1,
		status: "ok",
		bundle: {
			conflict_path: "src/z.ts",
			conflict_ordinal: 1,
			conflict_hunk_ours: "ours-hunk\n",
			conflict_hunk_base: "base-hunk\n",
			conflict_hunk_theirs: "theirs-hunk\n",
			preimage_ours: null,
			preimage_theirs: null,
			preimage_ours_bytes: null,
			preimage_theirs_bytes: null,
			preimage_ours_oid: null,
			preimage_theirs_oid: null,
			preimage_ours_truncated: false,
			preimage_theirs_truncated: false,
			dependency_graph: dependencyGraph,
			dependency_graph_status: "derived",
		},
	};
}

function ledgerInput(n: number): LedgerInput {
	return {
		recordType: "decision",
		recordSchemaVersion: "mrgr-ledger/1",
		inputRefs: [OID_PARENT1],
		intermediateTreeOid: null,
		outputTreeOid: null,
		evidenceDigest: null,
		auditPhase: "post-adjudication",
		adjudicatorKind: "human",
		adjudicatorIdentity: "svnbjrn",
		reason: null,
		payload: { region: "src/a.ts", n },
		supersedes: null,
	};
}

const FIXED_CREATED_AT = "2026-01-01T00:00:00.000Z";

/** Every non-empty-line count in a jsonl buffer; empty buffer is 0 rows. */
function countRows(buf: Buffer): number {
	if (buf.length === 0) return 0;
	return buf.toString("utf8").split("\n").filter((l) => l.length > 0).length;
}

/**
 * True if `handle`'s connection is currently inside a transaction: attempts
 * a BEGIN, which SQLite refuses ("cannot start a transaction within a
 * transaction") only when one is already open. Rolls back the probe
 * transaction it opens on success, so this is side-effect-free either way.
 */
function isInTransaction(handle: DbHandle): boolean {
	try {
		handle.db.exec("BEGIN");
	} catch {
		return true;
	}
	handle.db.exec("ROLLBACK");
	return false;
}

function readJsonl(path: string): Record<string, unknown>[] {
	const buf = readFileSync(path, "utf8");
	if (buf.length === 0) return [];
	return buf
		.split("\n")
		.filter((l) => l.length > 0)
		.map((l) => JSON.parse(l) as Record<string, unknown>);
}

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

describe("exportDb", () => {
	it("writes every table file, and the manifest's row counts and hashes match the files on disk", () => {
		new CorpusStore(handle).append(corpusRecord(OID_PARENT1));
		new LedgerStore(handle).append(ledgerInput(1), FIXED_CREATED_AT);
		putBlob(handle, Buffer.from("hello"));

		const outDir = join(dir, "export");
		const result = exportDb(handle, outDir);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		const manifest = result.value;

		expect(manifest.schema_version).toBe(SCHEMA_VERSION_STRING);
		expect(Object.keys(manifest.tables).sort()).toEqual([...TABLE_NAMES].sort());

		for (const table of TABLE_NAMES) {
			const filePath = join(outDir, `${table}.jsonl`);
			expect(existsSync(filePath)).toBe(true);
			const buf = readFileSync(filePath);
			expect(sha256Hex(buf)).toBe(manifest.tables[table].sha256);
			expect(countRows(buf)).toBe(manifest.tables[table].rows);
		}

		// Tables with no rows inserted still get a file — presence is the contract.
		for (const table of ["evidence_bundle", "evidence_dep", "run", "run_result"]) {
			expect(readFileSync(join(outDir, `${table}.jsonl`)).length).toBe(0);
			expect(manifest.tables[table].rows).toBe(0);
		}
		expect(manifest.tables.corpus_record.rows).toBe(1);
		expect(manifest.tables.ledger.rows).toBe(1);
		expect(manifest.tables.blob.rows).toBe(1);

		// blob.jsonl carries only {sha256, byte_len}, never raw bytes.
		const blobLine = JSON.parse(
			readFileSync(join(outDir, "blob.jsonl"), "utf8").trim(),
		) as Record<string, unknown>;
		expect(Object.keys(blobLine).sort()).toEqual(["byte_len", "sha256"]);

		// manifest.json is pretty-printed, valid JSON, and matches the returned value.
		const manifestOnDisk = readFileSync(join(outDir, "manifest.json"), "utf8");
		expect(JSON.parse(manifestOnDisk)).toEqual(manifest);
		expect(manifestOnDisk).toContain("\n  ");
	});

	it("is byte-deterministic across insertion order, for every table but meta and the manifest", () => {
		// ledger.seq is a global arrival-order counter, not content-derived —
		// unlike path_index/array_index/base_index, which are fixed per-record
		// regardless of when sibling records are inserted. Reversing *ledger*
		// insertion order would legitimately reassign seq per record and change
		// ledger.jsonl's bytes; that is a different history, not the same
		// logical content in a different order. So only corpus-record insertion
		// order is reversed here; ledger append order (and its injected
		// createdAt) is held constant in both databases.
		const dirA = mkdtempSync(join(tmpdir(), "mrgr-db-a-"));
		const dirB = mkdtempSync(join(tmpdir(), "mrgr-db-b-"));
		const openedA = openDb(join(dirA, "mrgr.db"), { create: true });
		const openedB = openDb(join(dirB, "mrgr.db"), { create: true });
		if (!openedA.ok || !openedB.ok) throw new Error("failed to open test dbs");
		const handleA = openedA.value;
		const handleB = openedB.value;

		const mergeShaX = OID_PARENT1;
		const mergeShaY = OID_PARENT2;

		new CorpusStore(handleA).append(corpusRecord(mergeShaX));
		new CorpusStore(handleA).append(corpusRecord(mergeShaY));
		new CorpusStore(handleB).append(corpusRecord(mergeShaY));
		new CorpusStore(handleB).append(corpusRecord(mergeShaX));

		new LedgerStore(handleA).append(ledgerInput(1), FIXED_CREATED_AT);
		new LedgerStore(handleA).append(ledgerInput(2), FIXED_CREATED_AT);
		new LedgerStore(handleB).append(ledgerInput(1), FIXED_CREATED_AT);
		new LedgerStore(handleB).append(ledgerInput(2), FIXED_CREATED_AT);

		try {
			const outA = join(dirA, "export");
			const outB = join(dirB, "export");
			const resultA = exportDb(handleA, outA);
			const resultB = exportDb(handleB, outB);
			expect(resultA.ok).toBe(true);
			expect(resultB.ok).toBe(true);
			if (!resultA.ok || !resultB.ok) return;

			for (const table of TABLE_NAMES) {
				if (table === "meta") continue;
				const bufA = readFileSync(join(outA, `${table}.jsonl`));
				const bufB = readFileSync(join(outB, `${table}.jsonl`));
				expect(bufB.equals(bufA)).toBe(true);
			}

			for (const table of TABLE_NAMES) {
				if (table === "meta") continue;
				expect(resultB.value.tables[table]).toEqual(resultA.value.tables[table]);
			}
			// meta and the manifest carry per-database creation provenance and are
			// expected to differ (different created_at).
			expect(resultA.value.meta.created_at).not.toBe(resultB.value.meta.created_at);
		} finally {
			closeDb(handleA);
			closeDb(handleB);
			rmSync(dirA, { recursive: true, force: true });
			rmSync(dirB, { recursive: true, force: true });
		}
	});

	it("withBlobs writes raw bytes under blobs/<sha256>, matching the filename", () => {
		const bytes1 = Buffer.from("hello world");
		const bytes2 = Buffer.from("");
		const put1 = putBlob(handle, bytes1);
		const put2 = putBlob(handle, bytes2);
		expect(put1.ok && put2.ok).toBe(true);

		const outDir = join(dir, "export");
		const result = exportDb(handle, outDir, { withBlobs: true });
		expect(result.ok).toBe(true);
		if (!result.ok) return;

		const blobsDir = join(outDir, "blobs");
		const files = readdirSync(blobsDir).sort();
		expect(files).toEqual([sha256Hex(bytes1), sha256Hex(bytes2)].sort());

		for (const file of files) {
			const contents = readFileSync(join(blobsDir, file));
			expect(sha256Hex(contents)).toBe(file);
		}

		// blob.jsonl is unaffected by withBlobs — still {sha256, byte_len} only.
		const lines = readFileSync(join(outDir, "blob.jsonl"), "utf8")
			.trim()
			.split("\n")
			.map((l) => JSON.parse(l) as Record<string, unknown>);
		expect(lines).toHaveLength(2);
		for (const line of lines) expect(Object.keys(line).sort()).toEqual(["byte_len", "sha256"]);

		// The manifest's blobs section covers the files on disk, so a missing
		// or extra blob file changes the digested manifest instead of being
		// invisible to it.
		expect(result.value.blobs).toEqual(
			[
				{ sha256: sha256Hex(bytes1), byte_len: bytes1.byteLength },
				{ sha256: sha256Hex(bytes2), byte_len: bytes2.byteLength },
			].sort((a, b) => a.sha256.localeCompare(b.sha256)),
		);
		const manifestOnDisk = JSON.parse(
			readFileSync(join(outDir, "manifest.json"), "utf8"),
		) as Record<string, unknown>;
		expect(manifestOnDisk.blobs).toEqual(result.value.blobs);
	});

	it("without withBlobs, the manifest has no blobs section", () => {
		putBlob(handle, Buffer.from("hello"));
		const outDir = join(dir, "export");
		const result = exportDb(handle, outDir);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.blobs).toBeUndefined();
		const manifestOnDisk = JSON.parse(
			readFileSync(join(outDir, "manifest.json"), "utf8"),
		) as Record<string, unknown>;
		expect("blobs" in manifestOnDisk).toBe(false);
	});

	it("a stale blobs/ directory from a prior withBlobs export does not survive a re-export without it", () => {
		const bytes = Buffer.from("hello");
		putBlob(handle, bytes);
		const outDir = join(dir, "export");

		const first = exportDb(handle, outDir, { withBlobs: true });
		expect(first.ok).toBe(true);
		expect(existsSync(join(outDir, "blobs", sha256Hex(bytes)))).toBe(true);

		const second = exportDb(handle, outDir);
		expect(second.ok).toBe(true);
		expect(existsSync(join(outDir, "blobs"))).toBe(false);
	});

	it("a stale blobs/ directory is replaced, not merged, when blob content changes between exports", () => {
		const bytesOld = Buffer.from("old blob");
		putBlob(handle, bytesOld);
		const outDir = join(dir, "export");
		exportDb(handle, outDir, { withBlobs: true });
		expect(existsSync(join(outDir, "blobs", sha256Hex(bytesOld)))).toBe(true);

		// A fresh database (simulating "the same outDir reused for a different
		// database") should not see the previous database's blob file.
		const dir2 = mkdtempSync(join(tmpdir(), "mrgr-db-2-"));
		const opened2 = openDb(join(dir2, "mrgr.db"), { create: true });
		if (!opened2.ok) throw new Error("failed to open second db");
		const bytesNew = Buffer.from("new blob");
		putBlob(opened2.value, bytesNew);
		try {
			const second = exportDb(opened2.value, outDir, { withBlobs: true });
			expect(second.ok).toBe(true);
			expect(existsSync(join(outDir, "blobs", sha256Hex(bytesOld)))).toBe(false);
			expect(existsSync(join(outDir, "blobs", sha256Hex(bytesNew)))).toBe(true);
		} finally {
			closeDb(opened2.value);
			rmSync(dir2, { recursive: true, force: true });
		}
	});

	it("fails closed on an unwritable output path, and leaves no manifest.json behind", () => {
		// A regular file where a directory component is expected: mkdirSync
		// cannot create outDir under it (ENOTDIR), so nothing gets written —
		// including no manifest.json, which is the signal a reader should use
		// to distinguish a good export directory from a failed one.
		writeFileSync(join(dir, "not-a-directory"), "x");
		const outDir = join(dir, "not-a-directory", "export");

		const result = exportDb(handle, outDir);
		expect(result.ok).toBe(false);
		expect(existsSync(outDir)).toBe(false);
	});

	it("orders conflict_path, conflict_region and merge_base by their position column, not the natural key", () => {
		new CorpusStore(handle).append(corpusRecord(OID_PARENT1));
		const outDir = join(dir, "export");
		const result = exportDb(handle, outDir);
		expect(result.ok).toBe(true);
		if (!result.ok) return;

		const paths = readJsonl(join(outDir, "conflict_path.jsonl"));
		expect(paths.map((r) => r.path_index)).toEqual([0, 1]);
		// Recorded order was z, a — a natural-key (path) sort would have produced a, z.
		expect(paths.map((r) => r.path)).toEqual(["src/z.ts", "src/a.ts"]);

		const regions = readJsonl(join(outDir, "conflict_region.jsonl"));
		expect(regions.map((r) => r.array_index)).toEqual([0, 1]);
		// Recorded order was z, a — a natural-key (path, ordinal) sort would have produced a, z.
		expect(regions.map((r) => r.path)).toEqual(["src/z.ts", "src/a.ts"]);

		const bases = readJsonl(join(outDir, "merge_base.jsonl"));
		expect(bases.map((r) => r.base_index)).toEqual([0, 1]);
		// Recorded order was z, a — a natural-key (base_sha) sort would have produced a, z.
		expect(bases.map((r) => r.base_sha)).toEqual([OID_BASE_Z, OID_BASE_A]);
	});

	it("orders evidence_dep by position, reproducing the producer's dependency_graph order and duplicates", () => {
		new CorpusStore(handle).append(corpusRecord(OID_PARENT1));
		// Deliberately unsorted with a repeated (side, dep_path) pair: a
		// (side, dep_path) sort would produce ours:a.txt, ours:a.txt,
		// ours:b.txt, theirs:z.txt — collapsing nothing (duplicates are still
		// two rows) but reordering everything.
		const graph = ["theirs:z.txt", "ours:b.txt", "ours:a.txt", "ours:a.txt"];
		const appended = new EvidenceStore(handle).append(evidenceRecord(OID_PARENT1, graph));
		expect(appended.ok).toBe(true);

		const outDir = join(dir, "export");
		const result = exportDb(handle, outDir);
		expect(result.ok).toBe(true);
		if (!result.ok) return;

		const deps = readJsonl(join(outDir, "evidence_dep.jsonl"));
		expect(deps.map((r) => `${r.side}:${r.dep_path}`)).toEqual(graph);
		expect(deps.map((r) => r.position)).toEqual([0, 1, 2, 3]);
	});

	it("without withBlobs, no blobs directory is created", () => {
		putBlob(handle, Buffer.from("hello"));
		const outDir = join(dir, "export");
		const result = exportDb(handle, outDir);
		expect(result.ok).toBe(true);
		expect(existsSync(join(outDir, "blobs"))).toBe(false);
	});

	it("leaves no transaction open on the connection after a successful export", () => {
		new CorpusStore(handle).append(corpusRecord(OID_PARENT1));
		const outDir = join(dir, "export");
		const result = exportDb(handle, outDir);
		expect(result.ok).toBe(true);
		expect(isInTransaction(handle)).toBe(false);
		expect(() => handle.db.prepare("SELECT 1").get()).not.toThrow();
	});

	it("rolls back the read transaction and leaves the connection usable when a table read fails partway through", () => {
		// The whole read phase (all 13 tables) runs inside one transaction
		// before any file is written. Dropping a table that sorts after
		// several successful reads (meta, repository, baseline, corpus_record)
		// exercises rollback from mid-loop, not just from the first table.
		const dir2 = mkdtempSync(join(tmpdir(), "mrgr-db-fail-"));
		const opened = openDb(join(dir2, "mrgr.db"), { create: true });
		if (!opened.ok) throw new Error("failed to open test db");
		const handle2 = opened.value;
		try {
			new CorpusStore(handle2).append(corpusRecord(OID_PARENT1));
			handle2.db.exec("DROP TABLE merge_base");

			const outDir = join(dir2, "export");
			const result = exportDb(handle2, outDir);
			expect(result.ok).toBe(false);

			// A read-phase failure writes nothing, not even the tables that
			// were successfully read before the one that failed.
			expect(readdirSync(outDir)).toEqual([]);

			// No transaction left open, and the connection still works.
			expect(isInTransaction(handle2)).toBe(false);
			expect(() => handle2.db.prepare("SELECT 1").get()).not.toThrow();
		} finally {
			closeDb(handle2);
			rmSync(dir2, { recursive: true, force: true });
		}
	});
});
