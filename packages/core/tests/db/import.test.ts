import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { exportDb } from "../../src/db/export.js";
import { importCorpusJsonl, importEvidenceJsonl } from "../../src/db/import.js";
import { EvidenceStore } from "../../src/db/evidence-store.js";
import { closeDb, openDb, type DbHandle } from "../../src/db/open.js";

const FIXTURES_DIR = fileURLToPath(new URL("./fixtures/", import.meta.url));
const CORPUS_FIXTURE = join(FIXTURES_DIR, "legacy-corpus.jsonl");
const EVIDENCE_FIXTURE = join(FIXTURES_DIR, "legacy-evidence.jsonl");

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

let dir: string;
let handle: DbHandle;
beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "mrgr-db-import-"));
	const opened = openDb(join(dir, "mrgr.db"), { create: true });
	if (!opened.ok) throw new Error(opened.error.message);
	handle = opened.value;
});
afterEach(() => {
	closeDb(handle);
	rmSync(dir, { recursive: true, force: true });
});

describe("importCorpusJsonl", () => {
	it("imports both fixture records, then re-import counts them as duplicates", async () => {
		const first = await importCorpusJsonl(handle, CORPUS_FIXTURE);
		expect(first.ok).toBe(true);
		if (!first.ok) return;
		expect(first.value).toEqual({ imported: 2, skippedDuplicate: 0, failed: 0 });

		const second = await importCorpusJsonl(handle, CORPUS_FIXTURE);
		expect(second.ok).toBe(true);
		if (!second.ok) return;
		expect(second.value).toEqual({ imported: 0, skippedDuplicate: 2, failed: 0 });
	});
});

describe("importEvidenceJsonl", () => {
	it("imports both fixture records (including the ordinal-0 failed row) once the corpus is present", async () => {
		const corpus = await importCorpusJsonl(handle, CORPUS_FIXTURE);
		expect(corpus.ok).toBe(true);

		const evidence = await importEvidenceJsonl(handle, EVIDENCE_FIXTURE);
		expect(evidence.ok).toBe(true);
		if (!evidence.ok) return;
		expect(evidence.value).toEqual({ imported: 2, skippedDuplicate: 0, failed: 0 });
	});

	it("keeps a pre-OID record's OID field absent, not null, through the database", async () => {
		// The fixture predates preimage_*_oid. SQL has one NULL, so the column
		// cannot itself say whether the OID was unrecorded or the path was
		// absent; the byte count settles it on read. Reporting null here would
		// claim the path is missing from a parent that has it.
		expect((await importCorpusJsonl(handle, CORPUS_FIXTURE)).ok).toBe(true);
		expect((await importEvidenceJsonl(handle, EVIDENCE_FIXTURE)).ok).toBe(true);

		const store = new EvidenceStore(handle);
		const listed = store.list();
		expect(listed.ok).toBe(true);
		if (!listed.ok) return;
		const record = listed.value.find((entry) => entry.status === "ok");
		if (record === undefined || record.status !== "ok") {
			throw new Error("expected an ok record in the fixture");
		}

		expect(record.bundle.preimage_ours_bytes).not.toBeNull();
		expect("preimage_ours_oid" in record.bundle).toBe(false);
		// The theirs side has no path at all, so its OID is a recorded null.
		expect(record.bundle.preimage_theirs_bytes).toBeNull();
		expect(record.bundle.preimage_theirs_oid).toBeNull();
	});

	it("fails closed on every record when the corpus has not been imported", async () => {
		const evidence = await importEvidenceJsonl(handle, EVIDENCE_FIXTURE);
		expect(evidence.ok).toBe(true);
		if (!evidence.ok) return;
		expect(evidence.value.imported).toBe(0);
		expect(evidence.value.skippedDuplicate).toBe(0);
		expect(evidence.value.failed).toBe(2);
		expect(evidence.value.firstFailure).toBeDefined();
	});
});

describe("import determinism", () => {
	it("is byte-identical across two independently-imported databases, for every table but meta and the manifest", async () => {
		const dirA = mkdtempSync(join(tmpdir(), "mrgr-db-import-a-"));
		const dirB = mkdtempSync(join(tmpdir(), "mrgr-db-import-b-"));
		const openedA = openDb(join(dirA, "mrgr.db"), { create: true });
		const openedB = openDb(join(dirB, "mrgr.db"), { create: true });
		if (!openedA.ok || !openedB.ok) throw new Error("failed to open test dbs");
		const handleA = openedA.value;
		const handleB = openedB.value;

		try {
			const corpusA = await importCorpusJsonl(handleA, CORPUS_FIXTURE);
			const corpusB = await importCorpusJsonl(handleB, CORPUS_FIXTURE);
			expect(corpusA.ok).toBe(true);
			expect(corpusB.ok).toBe(true);

			const evidenceA = await importEvidenceJsonl(handleA, EVIDENCE_FIXTURE);
			const evidenceB = await importEvidenceJsonl(handleB, EVIDENCE_FIXTURE);
			expect(evidenceA.ok).toBe(true);
			expect(evidenceB.ok).toBe(true);

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
			// meta.jsonl and manifest.json carry per-database creation
			// provenance (created_at) and legitimately differ; everything else
			// is a pure function of the imported content.
			expect(resultA.value.meta.created_at).not.toBe(resultB.value.meta.created_at);
		} finally {
			closeDb(handleA);
			closeDb(handleB);
			rmSync(dirA, { recursive: true, force: true });
			rmSync(dirB, { recursive: true, force: true });
		}
	});
});
