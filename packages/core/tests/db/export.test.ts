import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { putBlob } from "../../src/db/blob.js";
import { sha256Hex } from "../../src/db/canonical.js";
import { CorpusStore } from "../../src/db/corpus-store.js";
import { exportDb } from "../../src/db/export.js";
import { LedgerStore, type LedgerInput } from "../../src/db/ledger-store.js";
import { closeDb, openDb, type DbHandle } from "../../src/db/open.js";
import type { CorpusRecordV2 } from "../../src/evaluation/types.js";

const REPO_ID = "local:/tmp/repo";
const ABS_PATH = "/tmp/repo";
const OID_PARENT1 = "1".repeat(40);
const OID_PARENT2 = "2".repeat(40);
const OID_BASE = "3".repeat(40);
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

/** A minimal but complete corpus record; only mergeSha varies across calls. */
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
		mergeBases: [OID_BASE],
		baseTopology: "single",
		baseReachabilityCounts: [
			{ baseSha: OID_BASE, oursExclusiveCommits: 1, theirsExclusiveCommits: 2 },
		],
		changedPathIntersection: ["src/a.ts"],
		replayStatus: "conflicted",
		automaticTreeOid: mergeSha,
		conflictPaths: ["src/a.ts"],
		conflictRegions: [
			{
				path: "src/a.ts",
				ordinal: 1,
				category: "other",
				conflictKind: "content",
				stageOids: { base: OID_BASE, ours: OID_PARENT1, theirs: OID_PARENT2 },
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
			},
		],
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

		expect(manifest.schema_version).toBe("mrgr-db/1");
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
	});

	it("without withBlobs, no blobs directory is created", () => {
		putBlob(handle, Buffer.from("hello"));
		const outDir = join(dir, "export");
		const result = exportDb(handle, outDir);
		expect(result.ok).toBe(true);
		expect(existsSync(join(outDir, "blobs"))).toBe(false);
	});
});
