import { canonicalJson, sha256Hex } from "./canonical.js";
import { dbErr, dbOk, type DbResult } from "./result.js";
import type { DbHandle } from "./open.js";

export type LedgerRecordType =
	| "decision"
	| "halt"
	| "debt"
	| "resurrection"
	| "gate_vector";

export interface LedgerInput {
	recordType: LedgerRecordType;
	recordSchemaVersion: string; // "mrgr-ledger/1" for now
	inputRefs: readonly string[];
	intermediateTreeOid: string | null;
	outputTreeOid: string | null;
	evidenceDigest: string | null;
	auditPhase: string;
	adjudicatorKind: "human" | "script" | "model";
	adjudicatorIdentity: string;
	reason: string | null;
	payload: unknown; // JSON-serializable, type-specific body
	supersedes: string | null; // prior ledger id
}

export interface LedgerRecord extends LedgerInput {
	id: string; // sha256Hex(canonicalJson(input)) — createdAt/seq excluded
	seq: number;
	createdAt: string; // ISO-8601 UTC
}

/**
 * Append-only ledger over mrgr-db/1's `ledger` table.
 *
 * The id is the sha256 of the input's canonical JSON — never a counter, never
 * caller-supplied — so two writers proposing the same logical record always
 * land on the same row instead of two rows racing for the same identity. `seq`
 * is presentation order only: it is read back with COALESCE(MAX(seq),0)+1
 * *inside* the same BEGIN IMMEDIATE transaction as the insert, so a second
 * writer starting its transaction while the first is still open blocks on the
 * write lock rather than computing the same next seq (the D90 bug this store
 * exists to make impossible: two concurrent readers of MAX(seq) that agree
 * with each other and collide on insert).
 */
export class LedgerStore {
	constructor(private readonly handle: DbHandle) {}

	append(input: LedgerInput, createdAt: string = new Date().toISOString()): DbResult<LedgerRecord> {
		const db = this.handle.db;
		const id = sha256Hex(canonicalJson(input));
		const canonicalInput = canonicalJson(input);

		try {
			// Ledger rows are the audit trail: force fsync-on-commit for this
			// transaction regardless of the connection's default durability.
			db.exec("PRAGMA synchronous=FULL");
			db.exec("BEGIN IMMEDIATE");

			const existingRow = db
				.prepare("SELECT * FROM ledger WHERE id = ?")
				.get(id) as Record<string, unknown> | undefined;

			if (existingRow !== undefined) {
				const existingRecord = rowToRecord(existingRow);
				const { id: _id, seq: _seq, createdAt: _createdAt, ...existingInput } = existingRecord;
				if (canonicalJson(existingInput) !== canonicalInput) {
					db.exec("ROLLBACK");
					return dbErr(
						"db",
						"append ledger record",
						"Ledger id collision with different content — impossible by construction",
						{ id },
					);
				}
				db.exec("COMMIT");
				return dbOk(existingRecord);
			}

			const next = (
				db.prepare("SELECT COALESCE(MAX(seq), 0) + 1 AS next FROM ledger").get() as {
					next: number;
				}
			).next;

			db.prepare(
				`INSERT INTO ledger
				 (id, seq, record_type, record_schema_version, input_refs_json,
				  intermediate_tree_oid, output_tree_oid, evidence_digest, audit_phase,
				  adjudicator_kind, adjudicator_identity, reason, payload_json,
				  supersedes, created_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			).run(
				id,
				next,
				input.recordType,
				input.recordSchemaVersion,
				canonicalJson(input.inputRefs),
				input.intermediateTreeOid,
				input.outputTreeOid,
				input.evidenceDigest,
				input.auditPhase,
				input.adjudicatorKind,
				input.adjudicatorIdentity,
				input.reason,
				canonicalJson(input.payload),
				input.supersedes,
				createdAt,
			);
			db.exec("COMMIT");

			return dbOk({ ...input, id, seq: next, createdAt });
		} catch (cause) {
			try {
				db.exec("ROLLBACK");
			} catch {
				/* nothing to roll back */
			}
			return dbErr("db", "append ledger record", "Insert failed", {
				id,
				cause: String(cause),
			});
		} finally {
			try {
				db.exec("PRAGMA synchronous=NORMAL");
			} catch {
				/* connection may already be unusable; nothing more to restore */
			}
		}
	}

	get(id: string): DbResult<LedgerRecord | null> {
		try {
			const row = this.handle.db.prepare("SELECT * FROM ledger WHERE id = ?").get(id) as
				| Record<string, unknown>
				| undefined;
			if (row === undefined) return dbOk(null);
			return dbOk(rowToRecord(row));
		} catch (cause) {
			return dbErr("db", "get ledger record", "Read failed", { id, cause: String(cause) });
		}
	}

	list(): DbResult<LedgerRecord[]> {
		try {
			const rows = this.handle.db
				.prepare("SELECT * FROM ledger ORDER BY seq")
				.all() as Record<string, unknown>[];
			return dbOk(rows.map(rowToRecord));
		} catch (cause) {
			return dbErr("db", "list ledger records", "Read failed", { cause: String(cause) });
		}
	}
}

function rowToRecord(row: Record<string, unknown>): LedgerRecord {
	return {
		id: row.id as string,
		seq: row.seq as number,
		recordType: row.record_type as LedgerRecordType,
		recordSchemaVersion: row.record_schema_version as string,
		inputRefs: JSON.parse(row.input_refs_json as string) as readonly string[],
		intermediateTreeOid: row.intermediate_tree_oid as string | null,
		outputTreeOid: row.output_tree_oid as string | null,
		evidenceDigest: row.evidence_digest as string | null,
		auditPhase: row.audit_phase as string,
		adjudicatorKind: row.adjudicator_kind as "human" | "script" | "model",
		adjudicatorIdentity: row.adjudicator_identity as string,
		reason: row.reason as string | null,
		payload: JSON.parse(row.payload_json as string) as unknown,
		supersedes: row.supersedes as string | null,
		createdAt: row.created_at as string,
	};
}
