import { readCorpus } from "../evaluation/corpus.js";
import { readEvidence } from "../m1a/sidecar.js";
import { CorpusStore } from "./corpus-store.js";
import { EvidenceStore } from "./evidence-store.js";
import type { DbHandle } from "./open.js";
import { dbOk, type DbResult, type DbToolError } from "./result.js";

/**
 * JSONL is transport, the database is the store. `failed` counts store-level
 * rejections only: the carried readers (readCorpus / readEvidence) are
 * fail-closed, so a malformed line never reaches this far — it aborts the
 * whole read before any row is attempted.
 *
 * The brief for this importer also asks for "the first [rejection] error
 * returned in details", but DbResult<ImportCounts>'s success branch is
 * `{ ok: true, value: ImportCounts }` with no `details` slot, and `failed`
 * is declared as a plain counter that must stay reachable through `.value`
 * for a partially-failed-but-still-successful import (see the "evidence
 * without corpus" case below). Those two asks conflict, so the first
 * rejection is carried on the optional `firstFailure` field instead —
 * additive, so a caller reading only the three required fields is
 * unaffected, and the diagnostic is not silently dropped.
 */
export interface ImportCounts {
	imported: number;
	skippedDuplicate: number;
	failed: number; // parse-level failures are impossible (readers are fail-closed); this counts store rejections
	firstFailure?: DbToolError;
}

/**
 * Import a legacy corpus JSONL file into the database.
 *
 * readCorpus aborts on the first malformed line (fail-closed); that error is
 * returned as-is rather than partially importing a file the reader
 * rejected. Once the read succeeds, every record is attempted independently:
 * CorpusStore.append() is itself idempotent for an identical re-append, so
 * existence is checked first to tell "already present with the same
 * content" (skippedDuplicate) apart from a fresh insert (imported); any
 * other outcome from append() (a genuine content conflict at the same key,
 * or any other store error) counts as failed and never aborts the loop.
 */
export async function importCorpusJsonl(
	handle: DbHandle,
	path: string,
): Promise<DbResult<ImportCounts>> {
	const read = await readCorpus(path);
	if (!read.ok) return read;

	const store = new CorpusStore(handle);
	const counts: ImportCounts = { imported: 0, skippedDuplicate: 0, failed: 0 };

	for (const record of read.value) {
		const existing = store.get(record.repository.id, record.merge.sha, record.baselineId);
		if (!existing.ok) {
			counts.failed += 1;
			counts.firstFailure ??= existing.error;
			continue;
		}
		const existedBefore = existing.value !== null;

		const appended = store.append(record);
		if (!appended.ok) {
			counts.failed += 1;
			counts.firstFailure ??= appended.error;
			continue;
		}
		if (existedBefore) counts.skippedDuplicate += 1;
		else counts.imported += 1;
	}

	return dbOk(counts);
}

/**
 * Import a legacy evidence JSONL file into the database.
 *
 * Same posture as importCorpusJsonl: readEvidence aborts on the first
 * malformed line, and that error is returned unchanged. Every record read
 * successfully is then attempted independently through EvidenceStore.append,
 * which validates the record and fails closed rather than throwing —
 * including when the corpus row an evidence record depends on is absent: an
 * "ok" record fails its explicit region-existence check, and a "failed"
 * (path-level) record fails the real FOREIGN KEY from evidence_bundle to
 * conflict_path. Both surface as a graceful DbResult, so a missing corpus
 * import counts every evidence record as failed rather than throwing or
 * aborting the loop. Corpus rows must therefore be imported first for any
 * evidence record to succeed.
 */
export async function importEvidenceJsonl(
	handle: DbHandle,
	path: string,
): Promise<DbResult<ImportCounts>> {
	const read = await readEvidence(path);
	if (!read.ok) return read;

	const store = new EvidenceStore(handle);
	const counts: ImportCounts = { imported: 0, skippedDuplicate: 0, failed: 0 };

	for (const record of read.value) {
		const existing = store.get(
			record.repository_id,
			record.merge_sha,
			record.baseline_id,
			record.conflict_path,
			record.conflict_ordinal,
		);
		if (!existing.ok) {
			counts.failed += 1;
			counts.firstFailure ??= existing.error;
			continue;
		}
		const existedBefore = existing.value !== null;

		const appended = store.append(record);
		if (!appended.ok) {
			counts.failed += 1;
			counts.firstFailure ??= appended.error;
			continue;
		}
		if (existedBefore) counts.skippedDuplicate += 1;
		else counts.imported += 1;
	}

	return dbOk(counts);
}
