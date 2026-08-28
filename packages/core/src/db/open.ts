import { existsSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

import { SCHEMA_SQL } from "./schema.js";
import { dbErr, dbOk, type DbResult } from "./result.js";

export const APPLICATION_ID = 0x6d726772; // "mrgr"
export const USER_VERSION = 2;
export const SCHEMA_VERSION_STRING = "mrgr-db/2";

export interface DbHandle {
	db: DatabaseSync;
	path: string;
}

/**
 * Fail-closed open. An existing file must carry the exact application_id,
 * user_version and meta.schema_version; anything else is a typed error and
 * the file is left untouched. Never auto-migrates.
 */
export function openDb(
	path: string,
	options: { create?: boolean } = {},
): DbResult<DbHandle> {
	const exists = existsSync(path);
	if (!exists && !options.create) {
		return dbErr("not-found", "open db", "Database file does not exist", {
			path,
		});
	}

	let db: DatabaseSync;
	try {
		db = new DatabaseSync(path);
	} catch (cause) {
		return dbErr("db", "open db", "File could not be opened as SQLite", {
			path,
			cause: String(cause),
		});
	}

	try {
		// Identity checks first: PRAGMA application_id/user_version and the
		// meta table are plain reads that do not touch the file on disk. No
		// persistent pragma (journal_mode) may be set until the file has
		// been accepted below — otherwise a rejected foreign file gets
		// converted to WAL on disk before we refuse it.
		const appId = (
			db.prepare("PRAGMA application_id").get() as { application_id: number }
		).application_id;
		const userVersion = (
			db.prepare("PRAGMA user_version").get() as { user_version: number }
		).user_version;

		const isNew = !exists || (appId === 0 && userVersion === 0 && isEmpty(db));

		if (!isNew) {
			if (appId !== APPLICATION_ID || userVersion !== USER_VERSION) {
				db.close();
				return dbErr("db", "open db", "Database schema mismatch", {
					path,
					reason: "schema-mismatch",
					detected_application_id: appId,
					detected_user_version: userVersion,
					expected_application_id: APPLICATION_ID,
					expected_user_version: USER_VERSION,
				});
			}

			const meta = db
				.prepare("SELECT value FROM meta WHERE key = 'schema_version'")
				.get() as { value: string } | undefined;
			if (meta?.value !== SCHEMA_VERSION_STRING) {
				db.close();
				return dbErr("db", "open db", "Database schema mismatch", {
					path,
					reason: "schema-mismatch",
					detected_schema_version: meta?.value ?? null,
					expected_schema_version: SCHEMA_VERSION_STRING,
				});
			}
		}

		// File is accepted from here on: either a fresh/empty database this
		// tool is about to claim, or one that already carries our identity.
		db.exec("PRAGMA journal_mode=WAL");
		db.exec("PRAGMA foreign_keys=ON");
		db.exec("PRAGMA busy_timeout=10000");
		db.exec("PRAGMA synchronous=NORMAL");

		if (isNew) {
			db.exec("BEGIN IMMEDIATE");
			try {
				db.exec(SCHEMA_SQL);
				db.exec(`PRAGMA application_id = ${APPLICATION_ID}`);
				db.exec(`PRAGMA user_version = ${USER_VERSION}`);
				const insertMeta = db.prepare(
					"INSERT INTO meta (key, value) VALUES (?, ?)",
				);
				insertMeta.run("schema_version", SCHEMA_VERSION_STRING);
				insertMeta.run("created_at", new Date().toISOString());
				insertMeta.run("created_by", "@mrgr/core");
				db.exec("COMMIT");
			} catch (cause) {
				db.exec("ROLLBACK");
				throw cause;
			}
		}

		return dbOk({ db, path });
	} catch (cause) {
		try {
			db.close();
		} catch {
			/* already closed or unusable */
		}
		return dbErr("db", "open db", "Database could not be validated", {
			path,
			cause: String(cause),
		});
	}
}

function isEmpty(db: DatabaseSync): boolean {
	const row = db
		.prepare("SELECT count(*) AS n FROM sqlite_master")
		.get() as { n: number };
	return row.n === 0;
}

export function closeDb(handle: DbHandle): DbResult<void> {
	try {
		handle.db.close();
		return dbOk(undefined);
	} catch (cause) {
		return dbErr("db", "close db", "Database could not be closed", {
			path: handle.path,
			cause: String(cause),
		});
	}
}
