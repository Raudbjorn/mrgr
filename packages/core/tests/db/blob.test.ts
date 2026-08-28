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

	it("Date values serialize to ISO strings via toJSON, not empty objects", () => {
		const d1 = new Date("2020-01-01T00:00:00Z");
		const d2 = new Date("2099-12-31T23:59:59Z");
		const a = canonicalJson({ ts: d1 });
		const b = canonicalJson({ ts: d2 });
		expect(a).not.toBe(b);
		expect(a).toBe('{"ts":"2020-01-01T00:00:00.000Z"}');
		expect(b).toBe('{"ts":"2099-12-31T23:59:59.000Z"}');
	});

	it("Date inside array and nested object both serialize via toJSON", () => {
		const d = new Date("2020-06-15T12:30:45Z");
		const fromArray = canonicalJson([d]);
		const fromNested = canonicalJson({ a: { b: d } });
		expect(fromArray).toBe('["2020-06-15T12:30:45.000Z"]');
		expect(fromNested).toBe('{"a":{"b":"2020-06-15T12:30:45.000Z"}}');
	});

	it("throws TypeError when passed undefined", () => {
		expect(() => canonicalJson(undefined)).toThrow(TypeError);
	});

	it("throws TypeError when passed a function", () => {
		expect(() => canonicalJson(() => {})).toThrow(TypeError);
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

	it("detects same-length byte disagreement on dedup", () => {
		const correct = new TextEncoder().encode("correctx");
		const wrong = new TextEncoder().encode("wrong!!!"); // same length, different content
		const sha256 = sha256Hex(correct);
		// Insert wrong bytes under the correct hash
		handle.db
			.prepare("INSERT INTO blob (sha256, byte_len, bytes) VALUES (?, ?, ?)")
			.run(sha256, wrong.byteLength, wrong);
		// Try to put the correct bytes with same sha256
		const put = putBlob(handle, correct);
		expect(put.ok).toBe(false);
		if (!put.ok) expect(put.error.kind).toBe("db");
	});

	it("reports a missing blob as not-found", () => {
		const got = getBlob(handle, "0".repeat(64));
		expect(got.ok).toBe(false);
		if (!got.ok) expect(got.error.kind).toBe("not-found");
	});
});
