import { describe, expect, test } from "vitest";

import {
	categorizePath,
	classifyLocalizedRegion,
	normalizeV1,
	resolutionDigest,
	tripleKey,
} from "../../src/evaluation/classify.js";
import type {
	AutomaticRanges,
	LineRange,
	StageObjectIds,
} from "../../src/evaluation/types.js";

const range = (startLine: number, endLineExclusive: number): LineRange => ({
	startLine,
	endLineExclusive,
});

const automaticRanges: AutomaticRanges<LineRange> = {
	base: range(3, 4),
	ours: range(1, 2),
	theirs: range(5, 6),
};
const stageOids: StageObjectIds = {
	base: "base-oid",
	ours: "ours-oid",
	theirs: "theirs-oid",
};

function classify(
	base: Buffer,
	ours: Buffer,
	theirs: Buffer,
	resolution: Buffer,
	oids: StageObjectIds = stageOids,
) {
	return classifyLocalizedRegion(
		{
			path: "src/example.ts",
			ordinal: 1,
			category: "other",
			conflictKind: "CONFLICT (content)",
			stageOids: oids,
		},
		automaticRanges,
		range(1, 2),
		{ base, ours, theirs, resolution },
	);
}

describe("normalizeV1", () => {
	test("only normalizes line endings, tabs, trailing space, and blank lines", () => {
		expect(normalizeV1("\r\n\talpha  \r\n\r\n\r\n  beta\t \r\n")).toBe(
			"    alpha\n\n  beta",
		);
	});

	test("preserves leading indentation and internal horizontal whitespace", () => {
		expect(normalizeV1("  a  b\n    c")).toBe("  a  b\n    c");
	});
});

describe("localized resolution classification", () => {
	test.each([
		[
			"ours",
			Buffer.from("base\n"),
			Buffer.from("ours\n"),
			Buffer.from("theirs\n"),
			Buffer.from("ours\n"),
		],
		[
			"theirs",
			Buffer.from("base\n"),
			Buffer.from("ours\n"),
			Buffer.from("theirs\n"),
			Buffer.from("theirs\n"),
		],
		[
			"base",
			Buffer.from("base\n"),
			Buffer.from("ours\n"),
			Buffer.from("theirs\n"),
			Buffer.from("base\n"),
		],
		[
			"novel",
			Buffer.from("base\n"),
			Buffer.from("ours\n"),
			Buffer.from("theirs\n"),
			Buffer.from("combined\n"),
		],
	] as const)(
		"classifies an exact %s resolution from region bytes",
		(expected, base, ours, theirs, resolution) => {
			expect(classify(base, ours, theirs, resolution).resolutionClass).toBe(
				expected,
			);
		},
	);

	test("classifies an empty resolution as deleted before matching an empty side", () => {
		const record = classify(
			Buffer.alloc(0),
			Buffer.alloc(0),
			Buffer.from("theirs\n"),
			Buffer.alloc(0),
		);
		expect(record.resolutionClass).toBe("deleted");
		expect(record.novelAfterNormalization).toBe(false);
	});

	test("keeps raw novelty separate from whitespace-normalized novelty", () => {
		const record = classify(
			Buffer.from("base\n"),
			Buffer.from("\tvalue  \r\n"),
			Buffer.from("theirs\n"),
			Buffer.from("    value\n"),
		);
		expect(record.resolutionClass).toBe("novel");
		expect(record.novelAfterNormalization).toBe(false);
	});

	test("presence-tags and compares only stages that exist", () => {
		const ours = Buffer.from("ours\n");
		const theirs = Buffer.from("theirs\n");
		const record = classify(
			Buffer.alloc(0),
			ours,
			theirs,
			Buffer.from("\n"),
			{ base: null, ours: "ours-oid", theirs: "theirs-oid" },
		);
		expect(record.tripleKey).toBe(tripleKey(null, ours, theirs));
		expect(record.tripleKey).not.toBe(
			tripleKey(Buffer.alloc(0), ours, theirs),
		);
		expect(record.novelAfterNormalization).toBe(true);
		expect(record.rawCounts.base).toEqual({ lines: 0, bytes: 0 });
		expect(record.rawDigests.base).toMatch(/^[a-f0-9]{64}$/);

		const absentOurs = classify(
			Buffer.from("base\n"),
			ours,
			theirs,
			ours,
			{ base: "base-oid", ours: null, theirs: "theirs-oid" },
		);
		expect(absentOurs.resolutionClass).toBe("novel");
		expect(absentOurs.tripleKey).toBe(
			tripleKey(Buffer.from("base\n"), null, theirs),
		);
		expect(absentOurs.rawCounts.ours).toEqual({ lines: 1, bytes: 5 });
	});

	test("stores localized raw counts and raw/normalized digests", () => {
		const record = classify(
			Buffer.from("base\n"),
			Buffer.from("ours\n"),
			Buffer.from("theirs\n"),
			Buffer.from("one\ntwo\n"),
		);
		expect(record.rawCounts).toEqual({
			base: { lines: 1, bytes: 5 },
			ours: { lines: 1, bytes: 5 },
			theirs: { lines: 1, bytes: 7 },
			resolution: { lines: 2, bytes: 8 },
		});
		expect(record.rawDigests.resolution).toMatch(/^[a-f0-9]{64}$/);
		expect(record.normalizedDigests.resolution).toBe(
			resolutionDigest(Buffer.from("one\ntwo\n")),
		);
	});

	test("presence tags distinguish a missing span from an empty span", () => {
		expect(
			tripleKey(null, Buffer.from("ours"), Buffer.from("theirs")),
		).not.toBe(
			tripleKey(Buffer.alloc(0), Buffer.from("ours"), Buffer.from("theirs")),
		);
	});
});

describe("categorizePath", () => {
	test.each([
		["pnpm-lock.yaml", "lockfile"],
		["nested/Cargo.lock", "lockfile"],
		["db/migrations/20260826_add_table.sql", "migration"],
		["alembic/versions/001.py", "migration"],
		["docs/design/API.MD", "documentation"],
		["guide/readme.rst", "documentation"],
		["generated/client.ts", "generated"],
		["src/generated/client.ts", "generated"],
		["__generated__/query.ts", "generated"],
		["src/model.gen.ts", "generated"],
		["src/grammarParser.ts", "generated"],
		["src/grammarLexer.java", "generated"],
		["proto/service.pb.go", "generated"],
		["proto/service_pb2.py", "generated"],
		["proto/service.pb.ts", "generated"],
		["src/app.ts", "other"],
	] as const)("categorizes %s as %s", (path, category) => {
		expect(categorizePath(path)).toBe(category);
	});
});
