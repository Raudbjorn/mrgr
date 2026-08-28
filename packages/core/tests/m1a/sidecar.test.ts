import { afterAll, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
	EVIDENCE_SCHEMA_VERSION,
	EvidenceWriter,
	evidenceKey,
	loadEvidenceKeys,
	parseEvidenceRecord,
	PATH_LEVEL_ORDINAL,
	readEvidence,
	type EvidenceRecord,
} from "../../src/m1a/sidecar.js";

const directories: string[] = [];

async function tempDir(): Promise<string> {
	const path = await mkdtemp(join(tmpdir(), "mrgr-sidecar-"));
	directories.push(path);
	return path;
}

afterAll(async () => {
	await Promise.all(
		directories.map((path) => rm(path, { recursive: true, force: true })),
	);
});

const bundle = {
	conflict_path: "src/a.ts",
	conflict_ordinal: 1,
	conflict_hunk_ours: "ours",
	conflict_hunk_base: "base",
	conflict_hunk_theirs: "theirs",
	preimage_ours: "header\nours\nfooter\n",
	preimage_theirs: null,
	preimage_ours_bytes: 19,
	preimage_theirs_bytes: null,
	preimage_ours_truncated: false,
	preimage_theirs_truncated: false,
	dependency_graph: ["ours:src/a.ts"],
	dependency_graph_status: "derived" as const,
};

const okRecord: EvidenceRecord = {
	schemaVersion: EVIDENCE_SCHEMA_VERSION,
	repository_id: "repo",
	merge_sha: "abc123",
	baseline_id: "baseline",
	conflict_path: "src/a.ts",
	conflict_ordinal: 1,
	status: "ok",
	bundle,
};

const failedRecord: EvidenceRecord = {
	schemaVersion: EVIDENCE_SCHEMA_VERSION,
	repository_id: "repo",
	merge_sha: "abc123",
	baseline_id: "baseline",
	conflict_path: "src/b.ts",
	conflict_ordinal: 1,
	status: "failed",
	error: {
		kind: "parse",
		operation: "extractEvidenceBundles",
		message: "No diff3 conflict markers found",
		details: { path: "src/b.ts" },
	},
};

describe("sidecar round trip", () => {
	it("preserves bundles byte-for-byte through write and read", async () => {
		const path = join(await tempDir(), "evidence.jsonl");
		const writer = await EvidenceWriter.open(path);
		expect(writer.ok).toBe(true);
		if (!writer.ok) return;

		expect((await writer.value.append(okRecord)).ok).toBe(true);
		expect((await writer.value.append(failedRecord)).ok).toBe(true);
		expect((await writer.value.close()).ok).toBe(true);

		// Read back with the real parser, not a JSON.parse cast. Casting is what
		// let the earlier tests miss that the trust boundary dropped the field.
		const read = await readEvidence(path);
		expect(read.ok).toBe(true);
		if (!read.ok) return;

		expect(read.value).toHaveLength(2);
		expect(read.value[0]).toStrictEqual(okRecord);
		expect(read.value[1]).toStrictEqual(failedRecord);

		const first = read.value[0];
		if (first?.status !== "ok") throw new Error("expected an ok record");
		expect(first.bundle.preimage_ours).toBe(bundle.preimage_ours);
		expect(first.bundle.preimage_theirs).toBeNull();
	});

	it("records a failure rather than omitting the region", async () => {
		const path = join(await tempDir(), "evidence.jsonl");
		const writer = await EvidenceWriter.open(path);
		if (!writer.ok) throw new Error("open failed");
		await writer.value.append(failedRecord);
		await writer.value.close();

		const read = await readEvidence(path);
		if (!read.ok) throw new Error("read failed");
		const record = read.value[0];
		expect(record?.status).toBe("failed");
		if (record?.status !== "failed") return;
		// The reason survives; a consumer can distinguish "not attempted" from
		// "attempted and failed".
		expect(record.error.message).toContain("No diff3");
	});
});

describe("sidecar fail-closed parsing", () => {
	it("rejects a malformed line instead of skipping it", async () => {
		const path = join(await tempDir(), "evidence.jsonl");
		const writer = await EvidenceWriter.open(path);
		if (!writer.ok) throw new Error("open failed");
		await writer.value.append(okRecord);
		await writer.value.close();

		// Append a line that is valid JSON but not a valid record.
		await writeFile(path, `${JSON.stringify({ nonsense: true })}\n`, { flag: "a" });

		const read = await readEvidence(path);
		expect(read.ok).toBe(false);
		if (read.ok) return;
		expect(read.error.kind).toBe("corrupt-corpus");
		expect(read.error.details?.line).toBe(2);
	});

	it("rejects a line that is not JSON at all", async () => {
		const path = join(await tempDir(), "evidence.jsonl");
		await writeFile(path, "not json\n");
		const read = await readEvidence(path);
		expect(read.ok).toBe(false);
		if (read.ok) return;
		expect(read.error.message).toContain("not valid JSON");
	});

	it("refuses to write a record that does not match the schema", async () => {
		const path = join(await tempDir(), "evidence.jsonl");
		const writer = await EvidenceWriter.open(path);
		if (!writer.ok) throw new Error("open failed");

		const bad = { ...okRecord, conflict_ordinal: 0 } as unknown as EvidenceRecord;
		const appended = await writer.value.append(bad);
		expect(appended.ok).toBe(false);
		await writer.value.close();

		// Nothing reached the file.
		expect(await readFile(path, "utf8")).toBe("");
	});

	it("reports a missing file rather than pretending it is empty", async () => {
		const read = await readEvidence(join(await tempDir(), "absent.jsonl"));
		expect(read.ok).toBe(false);
		if (read.ok) return;
		expect(read.error.details?.code).toBe("ENOENT");
	});
});

describe("resume keys", () => {
	it("keys on repository, merge, baseline, path and ordinal", () => {
		const a = evidenceKey(okRecord);
		const b = evidenceKey({ ...okRecord, conflict_ordinal: 2 });
		expect(a).not.toBe(b);
		// Two regions of the same file are distinct rows.
		expect(JSON.parse(a)).toHaveLength(5);
	});

	it("treats an absent sidecar as no keys, not as an error", async () => {
		const keys = await loadEvidenceKeys(join(await tempDir(), "absent.jsonl"));
		expect(keys.ok).toBe(true);
		if (!keys.ok) return;
		expect(keys.value.size).toBe(0);
	});

	it("loads keys for every written record", async () => {
		const path = join(await tempDir(), "evidence.jsonl");
		const writer = await EvidenceWriter.open(path);
		if (!writer.ok) throw new Error("open failed");
		await writer.value.append(okRecord);
		await writer.value.append(failedRecord);
		await writer.value.close();

		const keys = await loadEvidenceKeys(path);
		if (!keys.ok) throw new Error("load failed");
		expect(keys.value.size).toBe(2);
		expect(keys.value.has(evidenceKey(okRecord))).toBe(true);
	});
});

describe("parseEvidenceRecord", () => {
	it("requires the discriminant to match its payload", () => {
		// status "ok" without a bundle must not parse.
		const { bundle: _bundle, ...withoutBundle } = okRecord as typeof okRecord & {
			bundle: unknown;
		};
		expect(parseEvidenceRecord(withoutBundle).ok).toBe(false);
	});
});

describe("resume must not lose a region", () => {
	it("recovers region 2 when only region 1 was written before a crash", async () => {
		// A path-level skip keyed on ordinal 1 would treat the whole file as
		// done and drop region 2 permanently. Resume is per-region for exactly
		// this case.
		const path = join(await tempDir(), "partial.jsonl");
		const writer = await EvidenceWriter.open(path);
		if (!writer.ok) throw new Error("open failed");
		await writer.value.append(okRecord); // ordinal 1 only
		await writer.value.close();

		const keys = await loadEvidenceKeys(path);
		if (!keys.ok) throw new Error("load failed");

		expect(keys.value.has(evidenceKey({ ...okRecord, conflict_ordinal: 1 }))).toBe(true);
		// Region 2 of the SAME path is not covered by region 1's key, so a
		// resuming run still has work to do for this file.
		expect(keys.value.has(evidenceKey({ ...okRecord, conflict_ordinal: 2 }))).toBe(false);
	});
});

describe("review fixes — sidecar", () => {
	it("rejects a row whose bundle identity disagrees with its key", () => {
		// Parses field-by-field, but the row is keyed to one region and carries
		// another's evidence. A consumer joining on the key and reading the
		// bundle would silently get the wrong region.
		const mismatched = {
			...okRecord,
			conflict_ordinal: 2,
			bundle: { ...bundle, conflict_ordinal: 1 },
		};
		const parsed = parseEvidenceRecord(mismatched);
		expect(parsed.ok).toBe(false);
		if (parsed.ok) return;
		expect(parsed.error.details?.issues).toContain("conflict_ordinal");
	});

	it("rejects a path mismatch between key and bundle", () => {
		const mismatched = {
			...okRecord,
			bundle: { ...bundle, conflict_path: "src/other.ts" },
		};
		expect(parseEvidenceRecord(mismatched).ok).toBe(false);
	});

	it("distinguishes a missing file from an unreadable one", async () => {
		const missing = await readEvidence(join(await tempDir(), "absent.jsonl"));
		expect(missing.ok).toBe(false);
		if (missing.ok) return;
		expect(missing.error.kind).toBe("not-found");

		// A directory is readable-as-a-path but not as a file: EISDIR, which is
		// an unreadable sidecar rather than an absent one.
		const dir = await tempDir();
		const unreadable = await readEvidence(dir);
		expect(unreadable.ok).toBe(false);
		if (unreadable.ok) return;
		expect(unreadable.error.kind).toBe("corrupt-corpus");
	});

	it("repairs a truncated tail instead of appending onto it", async () => {
		const path = join(await tempDir(), "evidence.jsonl");
		const first = await EvidenceWriter.open(path);
		if (!first.ok) throw new Error("open failed");
		await first.value.append(okRecord);
		await first.value.close();

		// Simulate a crash mid-write: a partial record with no newline.
		await writeFile(path, '{"schemaVersion":1,"repository_id":"re', { flag: "a" });

		const second = await EvidenceWriter.open(path);
		if (!second.ok) throw new Error("reopen failed");
		await second.value.append(failedRecord);
		await second.value.close();

		// The fragment is gone and both complete records read back.
		const read = await readEvidence(path);
		expect(read.ok, read.ok ? "" : JSON.stringify(read.error)).toBe(true);
		if (!read.ok) return;
		expect(read.value).toHaveLength(2);
	});

	it("terminates a complete final record that lost only its newline", async () => {
		const path = join(await tempDir(), "evidence.jsonl");
		await writeFile(path, JSON.stringify(okRecord)); // no trailing newline
		const writer = await EvidenceWriter.open(path);
		if (!writer.ok) throw new Error("open failed");
		await writer.value.append(failedRecord);
		await writer.value.close();

		const read = await readEvidence(path);
		expect(read.ok, read.ok ? "" : JSON.stringify(read.error)).toBe(true);
		if (!read.ok) return;
		// Nothing lost: the newline was added rather than the record discarded.
		expect(read.value).toHaveLength(2);
	});

	it("keeps a path-level failure distinct from a region-1 failure", () => {
		expect(PATH_LEVEL_ORDINAL).toBe(0);
		const pathLevel = {
			...failedRecord,
			conflict_ordinal: PATH_LEVEL_ORDINAL,
		};
		expect(parseEvidenceRecord(pathLevel).ok).toBe(true);
		// It also keys differently from region 1, so resume treats them apart.
		expect(evidenceKey(pathLevel)).not.toBe(
			evidenceKey({ ...failedRecord, conflict_ordinal: 1 }),
		);
	});

	it("does not allow ordinal 0 on an ok record", () => {
		// Only failures can be path-level; a bundle always describes a region.
		expect(
			parseEvidenceRecord({
				...okRecord,
				conflict_ordinal: 0,
				bundle: { ...bundle, conflict_ordinal: 0 },
			}).ok,
		).toBe(false);
	});
});
