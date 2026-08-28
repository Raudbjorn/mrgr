import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { canonicalJson, sha256Hex } from "../../src/db/canonical.js";
import { getBlob, putBlob } from "../../src/db/blob.js";
import { closeDb, openDb, type DbHandle } from "../../src/db/open.js";

let dir: string;
let handle: DbHandle;
beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "mrgr-db-"));
	const opened = openDb(join(dir, "mrgr.db"), { create: true });
	if (!opened.ok) throw new Error(opened.error.message);
	handle = opened.value;
});
afterEach(() => {
	closeDb(handle);
	rmSync(dir, { recursive: true, force: true });
});

describe("canonicalJson", () => {
	it("sorts keys recursively and is insertion-order independent", () => {
		const a = canonicalJson({ b: 1, a: { d: [2, { z: 3, y: 4 }], c: 5 } });
		const b = canonicalJson({ a: { c: 5, d: [2, { y: 4, z: 3 }] }, b: 1 });
		expect(a).toBe(b);
		expect(a).toBe('{"a":{"c":5,"d":[2,{"y":4,"z":3}]},"b":1}');
	});
});

describe("blob store", () => {
	it("round-trips bytes byte-for-byte", () => {
		const bytes = new TextEncoder().encode("héllo\n\0binary-ish");
		const put = putBlob(handle, bytes);
		expect(put.ok).toBe(true);
		if (!put.ok) return;
		expect(put.value).toBe(sha256Hex(bytes));
		const got = getBlob(handle, put.value);
		expect(got.ok).toBe(true);
		if (got.ok) expect(Buffer.from(got.value)).toEqual(Buffer.from(bytes));
	});

	it("deduplicates: same bytes twice, one row", () => {
		const bytes = new TextEncoder().encode("same content");
		putBlob(handle, bytes);
		putBlob(handle, bytes);
		const n = handle.db
			.prepare("SELECT count(*) AS n FROM blob")
			.get() as { n: number };
		expect(n.n).toBe(1);
	});

	it("fails closed when stored bytes are corrupted", () => {
		const bytes = new TextEncoder().encode("original");
		const put = putBlob(handle, bytes);
		if (!put.ok) throw new Error("put failed");
		handle.db
			.prepare("UPDATE blob SET bytes = ? WHERE sha256 = ?")
			.run(new TextEncoder().encode("tampered!"), put.value);
		const got = getBlob(handle, put.value);
		expect(got.ok).toBe(false);
		if (!got.ok) expect(got.error.kind).toBe("db");
	});

	it("reports a missing blob as not-found", () => {
		const got = getBlob(handle, "0".repeat(64));
		expect(got.ok).toBe(false);
		if (!got.ok) expect(got.error.kind).toBe("not-found");
	});
});
