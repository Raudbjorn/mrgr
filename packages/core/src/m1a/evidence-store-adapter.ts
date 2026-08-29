import { EvidenceStore } from "../db/evidence-store.js";
import type { ImportCounts } from "../db/import.js";
import { closeDb, openDb } from "../db/open.js";
import { dbOk, type DbResult } from "../db/result.js";
import type { EvidenceRecord } from "./sidecar.js";

/**
 * Thin translator that mirrors `EvidenceWriter.append` (sidecar path) against
 * `EvidenceStore.append` (mrgr-db path). Mirrors the counting and
 * first-failure semantics of `importEvidenceJsonl`: `imported` covers a fresh
 * insert, `skippedDuplicate` covers a same-key, same-content re-append, and
 * any other store error counts as `failed` and is captured once in
 * `firstFailure`. The loop never aborts mid-stream on a per-record error.
 *
 * The DB is opened in non-create mode so a missing path is a typed error
 * (the CLI surfaces it as exit 2) rather than a silently-created empty
 * database that violates the "DB mode never creates a DB" contract.
 *
 * Fail-closed on close: a close failure is reported even when the import
 * itself succeeded, since silently swallowing it would leave the caller
 * without a signal that the database handle did not release cleanly.
 */
export async function writeEvidenceBundlesViaStore(
	dbPath: string,
	bundles: readonly EvidenceRecord[],
): Promise<DbResult<ImportCounts>> {
	const opened = openDb(dbPath, {});
	if (!opened.ok) return opened;

	const counts: ImportCounts = { imported: 0, skippedDuplicate: 0, failed: 0 };
	const store = new EvidenceStore(opened.value);
	for (const record of bundles) {
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

	const closed = closeDb(opened.value);
	if (!closed.ok) return closed;
	return dbOk(counts);
}