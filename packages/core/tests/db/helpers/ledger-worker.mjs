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
