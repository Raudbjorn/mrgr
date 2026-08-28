import { getBlob, putBlob } from "./blob.js";
import { canonicalJson } from "./canonical.js";
import { dbErr, dbOk, type DbResult, type DbToolError } from "./result.js";
import type { DbHandle } from "./open.js";
import type { ToolError } from "../evaluation/result.js";
import { evidenceKey, parseEvidenceRecord, type EvidenceRecord } from "../m1a/sidecar.js";
import type { EvidenceBundle } from "../m1a/evidence.js";

/** SQLite result code for a PRIMARY KEY (or other UNIQUE) constraint violation. */
const SQLITE_CONSTRAINT_PRIMARYKEY = 1555;

type EvidenceKeyFields = Pick<
	EvidenceRecord,
	"repository_id" | "merge_sha" | "baseline_id" | "conflict_path" | "conflict_ordinal"
>;

function keyDetails(record: EvidenceKeyFields): DbToolError["details"] {
	return {
		repository_id: record.repository_id,
		merge_sha: record.merge_sha,
		baseline_id: record.baseline_id,
		conflict_path: record.conflict_path,
		conflict_ordinal: record.conflict_ordinal,
	};
}

/**
 * Evidence persistence over mrgr-db/1.
 *
 * `evidence_bundle`'s foreign key stops at `conflict_path`, not
 * `conflict_region`: a path-level failure (`PATH_LEVEL_ORDINAL`) has no
 * region to point at. The region-existence check for `status: "ok"` rows
 * therefore lives here, not in the schema.
 *
 * `dependency_graph` is a property of the FILE, not of any one region within
 * it — the carried producer derives it once per file and copies it into
 * every region's bundle — so `evidence_dep` stores it once per file and every
 * region is expected to agree. A region whose `dependency_graph` disagrees
 * with a sibling already on file is a producer bug, not something to merge:
 * silently unioning the two would make `get()` return a graph that belongs
 * to no single region, which is exactly the kind of plausible-but-wrong
 * result this store exists to prevent. `append` therefore fails closed with
 * reason `"dependency-graph-conflict"` instead of writing anything.
 */
/**
 * Rebuild one side's OID field from its column, which has lost a distinction
 * the record schema keeps: SQL has a single NULL, while the bundle separates
 * "never recorded" (field absent) from "no path in that parent" (field null).
 *
 * The byte count is the discriminator. A side with a byte count and no OID can
 * only be a row written before the OID existed, so the field is omitted rather
 * than reported as null — which would assert the path was absent, and would
 * also fail the schema's own oid/bytes agreement check.
 */
function readOid(
	side: "ours" | "theirs",
	oid: unknown,
	bytes: unknown,
): Partial<Pick<EvidenceBundle, "preimage_ours_oid" | "preimage_theirs_oid">> {
	const field = `preimage_${side}_oid` as const;
	if (typeof oid === "string") return { [field]: oid };
	if (bytes === null) return { [field]: null };
	return {};
}

export class EvidenceStore {
	constructor(private readonly handle: DbHandle) {}

	append(record: EvidenceRecord): DbResult<void> {
		// Validate before touching the database so a malformed record cannot
		// reach a row.
		const validated = parseEvidenceRecord(record);
		if (!validated.ok) return validated;
		const value = validated.value;

		const db = this.handle.db;
		try {
			// BEGIN IMMEDIATE takes the write lock up front, before the
			// idempotency check, the region-existence check, and the
			// dependency-graph agreement check below run. Those three all
			// read-then-decide; running them before the lock was taken meant
			// two concurrent connections appending different regions of the
			// same file could each read "no conflicting sibling yet" against
			// stale state and both proceed to insert — the exact
			// time-of-check/time-of-use race LedgerStore's in-transaction seq
			// computation exists to close, here defeating the
			// dependency-graph invariant instead of colliding a sequence
			// number. A second connection now blocks here (up to
			// busy_timeout) rather than racing through a stale read.
			db.exec("BEGIN IMMEDIATE");

			const existing = this.get(
				value.repository_id,
				value.merge_sha,
				value.baseline_id,
				value.conflict_path,
				value.conflict_ordinal,
			);
			if (!existing.ok) {
				db.exec("ROLLBACK");
				return existing;
			}
			if (existing.value !== null) {
				let same: boolean;
				try {
					same = canonicalJson(existing.value) === canonicalJson(value);
				} catch (cause) {
					db.exec("ROLLBACK");
					return dbErr("db", "append evidence", "Could not compare existing record", {
						...keyDetails(value),
						cause: String(cause),
					});
				}
				if (same) {
					db.exec("COMMIT"); // idempotent re-append
					return dbOk(undefined);
				}
				db.exec("ROLLBACK");
				return dbErr(
					"db",
					"append evidence",
					"Duplicate key with different content",
					keyDetails(value),
				);
			}

			if (value.status === "ok") {
				const region = db
					.prepare(
						`SELECT 1 FROM conflict_region
						 WHERE repository_id = ? AND merge_sha = ? AND baseline_id = ? AND path = ? AND ordinal = ?`,
					)
					.get(
						value.repository_id,
						value.merge_sha,
						value.baseline_id,
						value.conflict_path,
						value.conflict_ordinal,
					);
				if (region === undefined) {
					db.exec("ROLLBACK");
					return dbErr("db", "append evidence", "No conflict_region row for this bundle", {
						reason: "missing-region",
						...keyDetails(value),
					});
				}

				const conflict = this.checkDependencyGraphAgreement(value);
				if (!conflict.ok) {
					db.exec("ROLLBACK");
					return conflict;
				}

				this.insertOkBundle(value.bundle, value);
			} else {
				const errorJson = canonicalJson(value.error);
				db.prepare(
					`INSERT INTO evidence_bundle
					 (repository_id, merge_sha, baseline_id, path, ordinal, status, error_json)
					 VALUES (?, ?, ?, ?, ?, 'failed', ?)`,
				).run(
					value.repository_id,
					value.merge_sha,
					value.baseline_id,
					value.conflict_path,
					value.conflict_ordinal,
					errorJson,
				);
			}
			db.exec("COMMIT");
			return dbOk(undefined);
		} catch (cause) {
			try {
				db.exec("ROLLBACK");
			} catch {
				/* nothing to roll back */
			}
			return dbErr("db", "append evidence", "Insert failed", {
				...keyDetails(value),
				cause: String(cause),
			});
		}
	}

	/**
	 * Fail closed if this region's `dependency_graph` disagrees with whatever
	 * is already stored for its file.
	 *
	 * Compared as an ORDERED SEQUENCE, not a set: `DependencyGraphSchema` is a
	 * plain array with no ordering or uniqueness constraint, so producer order
	 * is meaningful and duplicate entries are representable — and `get()`
	 * must reproduce both exactly (fix round 4; `evidence_dep.position`
	 * carries the array index for this reason). A set comparison would treat
	 * the same entries in a different order, or with a duplicate collapsed,
	 * as agreement, and then fail to round-trip whichever region's literal
	 * array wasn't chosen as canonical. Two sibling regions with the same
	 * entries in a different order are therefore NOT considered to agree.
	 *
	 * Existence is decided by whether a prior `status: "ok"` `evidence_bundle`
	 * row exists for this file — NOT by whether `evidence_dep` has any rows.
	 * Those disagree exactly when a file's first ok region has a legitimately
	 * empty `dependency_graph`: it writes zero `evidence_dep` rows, but its
	 * empty graph is still authoritative for the file, and a later sibling
	 * with a non-empty graph must be rejected, not accepted as "nothing
	 * stored yet". A `status: "failed"` row (including one at
	 * `PATH_LEVEL_ORDINAL`) carries no dependency graph and does not count.
	 */
	private checkDependencyGraphAgreement(
		record: Extract<EvidenceRecord, { status: "ok" }>,
	): DbResult<void> {
		// Called only from inside append()'s BEGIN IMMEDIATE transaction, so
		// any DB exception here propagates to that method's own catch/
		// ROLLBACK rather than needing its own try/catch.
		const db = this.handle.db;
		const priorOkRow = db
			.prepare(
				`SELECT 1 FROM evidence_bundle
				 WHERE repository_id = ? AND merge_sha = ? AND baseline_id = ? AND path = ? AND status = 'ok'
				 LIMIT 1`,
			)
			.get(record.repository_id, record.merge_sha, record.baseline_id, record.conflict_path);
		// No prior ok region for this file: this is the file's first ok
		// bundle, so there is nothing to agree with yet — insert as-is,
		// including the zero-entry case.
		if (priorOkRow === undefined) return dbOk(undefined);

		const existingDeps = db
			.prepare(
				`SELECT side, dep_path FROM evidence_dep
				 WHERE repository_id = ? AND merge_sha = ? AND baseline_id = ? AND path = ?
				 ORDER BY position`,
			)
			.all(
				record.repository_id,
				record.merge_sha,
				record.baseline_id,
				record.conflict_path,
			) as { side: string; dep_path: string }[];

		const existingSequence = existingDeps.map((d) => `${d.side}:${d.dep_path}`);
		const incomingSequence = record.bundle.dependency_graph;
		const agrees =
			existingSequence.length === incomingSequence.length &&
			existingSequence.every((entry, index) => entry === incomingSequence[index]);
		if (!agrees) {
			return dbErr(
				"db",
				"append evidence",
				"dependency_graph disagrees with another region of the same file",
				{
					reason: "dependency-graph-conflict",
					...keyDetails(record),
					existing_count: existingSequence.length,
					incoming_count: incomingSequence.length,
				},
			);
		}
		return dbOk(undefined);
	}

	private insertOkBundle(bundle: EvidenceBundle, key: EvidenceKeyFields): void {
		const hunkOursSha = this.putBlobOrThrow(bundle.conflict_hunk_ours);
		const hunkBaseSha = this.putBlobOrThrow(bundle.conflict_hunk_base);
		const hunkTheirsSha = this.putBlobOrThrow(bundle.conflict_hunk_theirs);
		const preimageOursSha =
			bundle.preimage_ours === null ? null : this.putBlobOrThrow(bundle.preimage_ours);
		const preimageTheirsSha =
			bundle.preimage_theirs === null ? null : this.putBlobOrThrow(bundle.preimage_theirs);

		this.handle.db
			.prepare(
				`INSERT INTO evidence_bundle
				 (repository_id, merge_sha, baseline_id, path, ordinal, status,
				  hunk_ours_sha, hunk_base_sha, hunk_theirs_sha,
				  preimage_ours_sha, preimage_theirs_sha,
				  preimage_ours_bytes, preimage_theirs_bytes,
				  preimage_ours_oid, preimage_theirs_oid,
				  preimage_ours_truncated, preimage_theirs_truncated,
				  dependency_graph_status)
				 VALUES (?, ?, ?, ?, ?, 'ok', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			)
			.run(
				key.repository_id,
				key.merge_sha,
				key.baseline_id,
				key.conflict_path,
				key.conflict_ordinal,
				hunkOursSha,
				hunkBaseSha,
				hunkTheirsSha,
				preimageOursSha,
				preimageTheirsSha,
				bundle.preimage_ours_bytes,
				bundle.preimage_theirs_bytes,
				// An unrecorded OID and an absent path both store as SQL NULL;
				// `readOid` below tells them apart again from the byte count.
				bundle.preimage_ours_oid ?? null,
				bundle.preimage_theirs_oid ?? null,
				bundle.preimage_ours_truncated ? 1 : 0,
				bundle.preimage_theirs_truncated ? 1 : 0,
				bundle.dependency_graph_status,
			);

		// Per-file, not per-region: two regions of the same file share these
		// rows. `position` (the entry's index in the producer's array) is part
		// of the primary key specifically so a repeated (side, dep_path) pair
		// is stored as its own row rather than colliding with an earlier
		// identical one — DependencyGraphSchema allows duplicates, and they
		// must round-trip, not collapse (fix round 4).
		//
		// A plain INSERT (not OR IGNORE) is used deliberately, mirroring
		// insertRepository/insertBaseline in corpus-store.ts: INSERT OR IGNORE
		// swallows a CHECK-constraint violation exactly like it swallows a
		// uniqueness conflict, so a future producer bug that emitted a bad
		// `side` value would vanish silently instead of being rejected —
		// exactly the silent-omission failure this store exists to prevent.
		// Catching only the PK-conflict code and re-throwing everything else
		// keeps the legitimate cross-region dedup working while still letting
		// a genuine CHECK violation surface as a real, typed error.
		const insertDep = this.handle.db.prepare(
			`INSERT INTO evidence_dep
			 (repository_id, merge_sha, baseline_id, path, side, dep_path, position)
			 VALUES (?, ?, ?, ?, ?, ?, ?)`,
		);
		bundle.dependency_graph.forEach((entry, position) => {
			// Split on the first colon only: dep paths may themselves contain
			// colons.
			const sep = entry.indexOf(":");
			const side = entry.slice(0, sep);
			const depPath = entry.slice(sep + 1);
			try {
				insertDep.run(
					key.repository_id,
					key.merge_sha,
					key.baseline_id,
					key.conflict_path,
					side,
					depPath,
					position,
				);
			} catch (cause) {
				if ((cause as { errcode?: number }).errcode !== SQLITE_CONSTRAINT_PRIMARYKEY) {
					throw cause;
				}
				// evidence_dep's PRIMARY KEY (repository_id, merge_sha,
				// baseline_id, path, side, dep_path, position) covers every
				// column the table has — unlike repository/baseline, there is
				// no non-key content left that could disagree, so a PK
				// conflict here is always a byte-identical duplicate (a
				// sibling region re-inserting the same entry at the same
				// position, which checkDependencyGraphAgreement already
				// verified matches). No content verification needed.
			}
		});
	}

	private putBlobOrThrow(text: string): string {
		const result = putBlob(this.handle, Buffer.from(text, "utf8"));
		if (!result.ok) {
			throw new Error(
				`putBlob failed: ${result.error.message} (${JSON.stringify(result.error.details ?? {})})`,
			);
		}
		return result.value;
	}

	get(
		repositoryId: string,
		mergeSha: string,
		baselineId: string,
		conflictPath: string,
		ordinal: number,
	): DbResult<EvidenceRecord | null> {
		try {
			const row = this.handle.db
				.prepare(
					`SELECT * FROM evidence_bundle
					 WHERE repository_id = ? AND merge_sha = ? AND baseline_id = ? AND path = ? AND ordinal = ?`,
				)
				.get(repositoryId, mergeSha, baselineId, conflictPath, ordinal) as
				| Record<string, unknown>
				| undefined;
			if (row === undefined) return dbOk(null);
			return this.rowToRecord(row);
		} catch (cause) {
			return dbErr("db", "get evidence", "Read failed", {
				repository_id: repositoryId,
				merge_sha: mergeSha,
				baseline_id: baselineId,
				conflict_path: conflictPath,
				conflict_ordinal: ordinal,
				cause: String(cause),
			});
		}
	}

	list(): DbResult<EvidenceRecord[]> {
		try {
			const rows = this.handle.db
				.prepare(
					`SELECT * FROM evidence_bundle
					 ORDER BY repository_id, merge_sha, baseline_id, path, ordinal`,
				)
				.all() as Record<string, unknown>[];
			const records: EvidenceRecord[] = [];
			for (const row of rows) {
				const result = this.rowToRecord(row);
				if (!result.ok) return result;
				records.push(result.value);
			}
			return dbOk(records);
		} catch (cause) {
			return dbErr("db", "list evidence", "Read failed", { cause: String(cause) });
		}
	}

	resumeKeys(): DbResult<Set<string>> {
		try {
			const rows = this.handle.db
				.prepare(
					"SELECT repository_id, merge_sha, baseline_id, path, ordinal FROM evidence_bundle",
				)
				.all() as {
				repository_id: string;
				merge_sha: string;
				baseline_id: string;
				path: string;
				ordinal: number;
			}[];
			return dbOk(
				new Set(
					rows.map((r) =>
						evidenceKey({
							repository_id: r.repository_id,
							merge_sha: r.merge_sha,
							baseline_id: r.baseline_id,
							conflict_path: r.path,
							conflict_ordinal: r.ordinal,
						}),
					),
				),
			);
		} catch (cause) {
			return dbErr("db", "evidence resume keys", "Read failed", { cause: String(cause) });
		}
	}

	private rowToRecord(row: Record<string, unknown>): DbResult<EvidenceRecord> {
		const repository_id = row.repository_id as string;
		const merge_sha = row.merge_sha as string;
		const baseline_id = row.baseline_id as string;
		const conflict_path = row.path as string;
		const conflict_ordinal = row.ordinal as number;

		if (row.status === "failed") {
			try {
				const error = JSON.parse(row.error_json as string) as ToolError;
				return dbOk({
					schemaVersion: 1,
					repository_id,
					merge_sha,
					baseline_id,
					conflict_path,
					conflict_ordinal,
					status: "failed",
					error,
				});
			} catch (cause) {
				return dbErr("db", "get evidence", "Stored error_json is not valid JSON", {
					repository_id,
					merge_sha,
					baseline_id,
					conflict_path,
					conflict_ordinal,
					cause: String(cause),
				});
			}
		}

		const hunkOurs = getBlob(this.handle, row.hunk_ours_sha as string);
		if (!hunkOurs.ok) return hunkOurs;
		const hunkBase = getBlob(this.handle, row.hunk_base_sha as string);
		if (!hunkBase.ok) return hunkBase;
		const hunkTheirs = getBlob(this.handle, row.hunk_theirs_sha as string);
		if (!hunkTheirs.ok) return hunkTheirs;

		const preimageOursSha = row.preimage_ours_sha as string | null;
		let preimageOurs: string | null = null;
		if (preimageOursSha !== null) {
			const got = getBlob(this.handle, preimageOursSha);
			if (!got.ok) return got;
			preimageOurs = Buffer.from(got.value).toString("utf8");
		}
		const preimageTheirsSha = row.preimage_theirs_sha as string | null;
		let preimageTheirs: string | null = null;
		if (preimageTheirsSha !== null) {
			const got = getBlob(this.handle, preimageTheirsSha);
			if (!got.ok) return got;
			preimageTheirs = Buffer.from(got.value).toString("utf8");
		}

		// ORDER BY position, not (side, dep_path): dependency_graph is an
		// unordered-schema array that may contain duplicates, and position
		// (the producer's array index) is what makes both round-trip exactly
		// (fix round 4).
		const depRows = this.handle.db
			.prepare(
				`SELECT side, dep_path FROM evidence_dep
				 WHERE repository_id = ? AND merge_sha = ? AND baseline_id = ? AND path = ?
				 ORDER BY position`,
			)
			.all(repository_id, merge_sha, baseline_id, conflict_path) as {
			side: string;
			dep_path: string;
		}[];

		const bundle: EvidenceBundle = {
			conflict_path,
			conflict_ordinal,
			conflict_hunk_ours: Buffer.from(hunkOurs.value).toString("utf8"),
			conflict_hunk_base: Buffer.from(hunkBase.value).toString("utf8"),
			conflict_hunk_theirs: Buffer.from(hunkTheirs.value).toString("utf8"),
			preimage_ours: preimageOurs,
			preimage_theirs: preimageTheirs,
			preimage_ours_bytes: row.preimage_ours_bytes as number | null,
			preimage_theirs_bytes: row.preimage_theirs_bytes as number | null,
			...readOid("ours", row.preimage_ours_oid, row.preimage_ours_bytes),
			...readOid("theirs", row.preimage_theirs_oid, row.preimage_theirs_bytes),
			preimage_ours_truncated: row.preimage_ours_truncated === 1,
			preimage_theirs_truncated: row.preimage_theirs_truncated === 1,
			dependency_graph: depRows.map((d) => `${d.side}:${d.dep_path}`),
			dependency_graph_status:
				row.dependency_graph_status as EvidenceBundle["dependency_graph_status"],
		};

		return dbOk({
			schemaVersion: 1,
			repository_id,
			merge_sha,
			baseline_id,
			conflict_path,
			conflict_ordinal,
			status: "ok",
			bundle,
		});
	}
}
