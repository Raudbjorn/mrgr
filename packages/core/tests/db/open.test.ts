import {
	existsSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
	APPLICATION_ID,
	SCHEMA_VERSION_STRING,
	USER_VERSION,
	closeDb,
	openDb,
} from "../../src/db/open.js";

let dir: string;
beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "mrgr-db-"));
});
afterEach(() => {
	rmSync(dir, { recursive: true, force: true });
});

describe("openDb", () => {
	it("creates a fresh database with schema, pragmas and meta", () => {
		const opened = openDb(join(dir, "mrgr.db"), { create: true });
		expect(opened.ok).toBe(true);
		if (!opened.ok) return;
		const { db } = opened.value;
		expect(
			(db.prepare("PRAGMA application_id").get() as { application_id: number })
				.application_id,
		).toBe(APPLICATION_ID);
		expect(
			(db.prepare("PRAGMA user_version").get() as { user_version: number })
				.user_version,
		).toBe(USER_VERSION);
		expect(
			(db.prepare("PRAGMA journal_mode").get() as { journal_mode: string })
				.journal_mode,
		).toBe("wal");
		const meta = db
			.prepare("SELECT value FROM meta WHERE key = 'schema_version'")
			.get() as { value: string };
		expect(meta.value).toBe(SCHEMA_VERSION_STRING);
		expect(closeDb(opened.value).ok).toBe(true);
	});

	it("reopens its own database", () => {
		const path = join(dir, "mrgr.db");
		const first = openDb(path, { create: true });
		expect(first.ok).toBe(true);
		if (first.ok) closeDb(first.value);
		const second = openDb(path);
		expect(second.ok).toBe(true);
		if (second.ok) closeDb(second.value);
	});

	it("refuses a missing file without create", () => {
		const opened = openDb(join(dir, "absent.db"));
		expect(opened.ok).toBe(false);
		if (!opened.ok) expect(opened.error.kind).toBe("not-found");
	});

	it("refuses a plain SQLite file (schema mismatch), and writes nothing", () => {
		const path = join(dir, "foreign.db");
		const walPath = `${path}-wal`;
		const shmPath = `${path}-shm`;
		const foreign = new DatabaseSync(path);
		foreign.exec("CREATE TABLE t (x)");
		foreign.close();

		const probe = new DatabaseSync(path);
		const journalModeBefore = (
			probe.prepare("PRAGMA journal_mode").get() as { journal_mode: string }
		).journal_mode;
		probe.close();
		expect(journalModeBefore).toBe("delete");
		const bytesBefore = readFileSync(path);
		const mtimeBefore = statSync(path).mtimeMs;

		const opened = openDb(path);
		expect(opened.ok).toBe(false);
		if (!opened.ok) {
			expect(opened.error.kind).toBe("db");
			expect(opened.error.details?.reason).toBe("schema-mismatch");
		}

		// fail-closed: no write happened, and the file was not converted to
		// WAL (a persistent on-disk change) merely by being examined.
		const check = new DatabaseSync(path);
		const tables = check
			.prepare("SELECT count(*) AS n FROM sqlite_master WHERE name = 'meta'")
			.get() as { n: number };
		expect(tables.n).toBe(0);
		const journalModeAfter = (
			check.prepare("PRAGMA journal_mode").get() as { journal_mode: string }
		).journal_mode;
		expect(journalModeAfter).toBe("delete");
		check.close();

		expect(existsSync(walPath)).toBe(false);
		expect(existsSync(shmPath)).toBe(false);
		expect(readFileSync(path)).toEqual(bytesBefore);
		expect(statSync(path).mtimeMs).toBe(mtimeBefore);
	});

	it("refuses a non-database file", () => {
		const path = join(dir, "garbage.db");
		writeFileSync(path, "not a database at all");
		const opened = openDb(path);
		expect(opened.ok).toBe(false);
	});
});
