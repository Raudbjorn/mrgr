import { getBlob, putBlob } from "./blob.js";
import { canonicalJson } from "./canonical.js";
import { dbErr, dbOk, type DbResult, type DbToolError } from "./result.js";
import type { DbHandle } from "./open.js";
import type { ToolError } from "../evaluation/result.js";
import { evidenceKey, parseEvidenceRecord, type EvidenceRecord } from "../m1a/sidecar.js";
import type { EvidenceBundle } from "../m1a/evidence.js";

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
 */
export class EvidenceStore {
	constructor(private readonly handle: DbHandle) {}

	append(record: EvidenceRecord): DbResult<void> {
		// Validate before touching the database so a malformed record cannot
		// reach a row.
		const validated = parseEvidenceRecord(record);
		if (!validated.ok) return validated;
		const value = validated.value;

		const existing = this.get(
			value.repository_id,
			value.merge_sha,
			value.baseline_id,
			value.conflict_path,
			value.conflict_ordinal,
		);
		if (!existing.ok) return existing;
		if (existing.value !== null) {
			try {
				if (canonicalJson(existing.value) === canonicalJson(value)) {
					return dbOk(undefined); // idempotent re-append
				}
			} catch (cause) {
				return dbErr("db", "append evidence", "Could not compare existing record", {
					...keyDetails(value),
					cause: String(cause),
				});
			}
			return dbErr(
				"db",
				"append evidence",
				"Duplicate key with different content",
				keyDetails(value),
			);
		}

		if (value.status === "ok") {
			let region: unknown;
			try {
				region = this.handle.db
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
			} catch (cause) {
				return dbErr("db", "append evidence", "Region check failed", {
					...keyDetails(value),
					cause: String(cause),
				});
			}
			if (region === undefined) {
				return dbErr("db", "append evidence", "No conflict_region row for this bundle", {
					reason: "missing-region",
					...keyDetails(value),
				});
			}
		}

		const db = this.handle.db;
		try {
			db.exec("BEGIN IMMEDIATE");
			if (value.status === "ok") {
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
				  preimage_ours_truncated, preimage_theirs_truncated,
				  dependency_graph_status)
				 VALUES (?, ?, ?, ?, ?, 'ok', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
				bundle.preimage_ours_truncated ? 1 : 0,
				bundle.preimage_theirs_truncated ? 1 : 0,
				bundle.dependency_graph_status,
			);

		// Per-file, not per-region: two regions of the same file share these
		// rows, so INSERT OR IGNORE dedups across the regions of that file.
		const insertDep = this.handle.db.prepare(
			`INSERT OR IGNORE INTO evidence_dep
			 (repository_id, merge_sha, baseline_id, path, side, dep_path)
			 VALUES (?, ?, ?, ?, ?, ?)`,
		);
		for (const entry of bundle.dependency_graph) {
			// Split on the first colon only: dep paths may themselves contain
			// colons.
			const sep = entry.indexOf(":");
			const side = entry.slice(0, sep);
			const depPath = entry.slice(sep + 1);
			insertDep.run(
				key.repository_id,
				key.merge_sha,
				key.baseline_id,
				key.conflict_path,
				side,
				depPath,
			);
		}
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

		const depRows = this.handle.db
			.prepare(
				`SELECT side, dep_path FROM evidence_dep
				 WHERE repository_id = ? AND merge_sha = ? AND baseline_id = ? AND path = ?
				 ORDER BY side, dep_path`,
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
