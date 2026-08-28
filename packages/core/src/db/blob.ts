import { sha256Hex } from "./canonical.js";
import { dbErr, dbOk, type DbResult } from "./result.js";
import type { DbHandle } from "./open.js";

/**
 * Content-addressed store. INSERT OR IGNORE, branching on the insert's own
 * `changes` count: `changes === 1` means SQLite just wrote exactly the bytes
 * it was handed, so there is nothing to verify and no read-back happens on
 * that path. `changes === 0` means the row already existed under this
 * digest — the only case where a byte_len short-circuit plus a full
 * `Buffer.equals` comparison against the stored bytes has any value — and a
 * sha256 collision or prior corruption there surfaces as an error instead of
 * being merged silently. getBlob's digest re-verification is the backstop
 * for corruption discovered after a write.
 */
export function putBlob(handle: DbHandle, bytes: Uint8Array): DbResult<string> {
	const sha256 = sha256Hex(bytes);
	try {
		const result = handle.db
			.prepare("INSERT OR IGNORE INTO blob (sha256, byte_len, bytes) VALUES (?, ?, ?)")
			.run(sha256, bytes.byteLength, bytes);
		if (typeof result.changes !== "number") {
			return dbErr("db", "put blob", "INSERT result did not report a changes count", {
				sha256,
			});
		}
		if (result.changes === 1) {
			return dbOk(sha256);
		}
		const row = handle.db
			.prepare("SELECT byte_len, bytes FROM blob WHERE sha256 = ?")
			.get(sha256) as { byte_len: number; bytes: Uint8Array };
		if (row.byte_len !== bytes.byteLength || !Buffer.from(row.bytes).equals(Buffer.from(bytes))) {
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
