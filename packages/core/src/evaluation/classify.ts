import { createHash, type Hash } from "node:crypto";
import { posix } from "node:path";

import type {
	AutomaticRanges,
	ConflictCategory,
	ExactConflictRegionRecord,
	LineRange,
	RawSpanCounts,
	RegionDigests,
	StageObjectIds,
} from "./types.js";

const LOCKFILES: Readonly<Record<string, true>> = {
	"package-lock.json": true,
	"pnpm-lock.yaml": true,
	"yarn.lock": true,
	"bun.lockb": true,
	"bun.lock": true,
	"Cargo.lock": true,
	"poetry.lock": true,
	"uv.lock": true,
	"Gemfile.lock": true,
	"composer.lock": true,
	"go.sum": true,
	"flake.lock": true,
	"Pipfile.lock": true,
};
const DOCUMENT_EXTENSIONS: Readonly<Record<string, true>> = {
	".md": true,
	".rst": true,
	".txt": true,
	".adoc": true,
};

type Content = string | Buffer;

export interface ConflictRegionIdentity {
	path: string;
	ordinal: number;
	category: ConflictCategory;
	conflictKind: string;
	stageOids: StageObjectIds;
}

export interface LocalizedRegionContents {
	base: Buffer;
	ours: Buffer;
	theirs: Buffer;
	resolution: Buffer;
}

function bytes(content: Content): Buffer {
	return Buffer.isBuffer(content) ? content : Buffer.from(content);
}

export function normalizeV1(content: Content): string {
	return bytes(content)
		.toString("utf8")
		.replace(/\r\n?/g, "\n")
		.replace(/\t/g, "    ")
		.replace(/[ \t]+$/gm, "")
		.replace(/\n{3,}/g, "\n\n")
		.replace(/^\n+|\n+$/g, "");
}

function digest(content: Content): string {
	return createHash("sha256").update(bytes(content)).digest("hex");
}

function normalizedDigest(content: Content): string {
	return digest(normalizeV1(content));
}

function addPresenceTaggedContent(hash: Hash, content: Content | null): void {
	if (content === null) {
		hash.update(Buffer.from([0]));
		return;
	}
	const normalized = Buffer.from(normalizeV1(content));
	const length = Buffer.allocUnsafe(8);
	length.writeBigUInt64BE(BigInt(normalized.length));
	hash.update(Buffer.from([1]));
	hash.update(length);
	hash.update(normalized);
}

export function tripleKey(
	base: Content | null,
	ours: Content | null,
	theirs: Content | null,
): string {
	const hash = createHash("sha256");
	addPresenceTaggedContent(hash, base);
	addPresenceTaggedContent(hash, ours);
	addPresenceTaggedContent(hash, theirs);
	return hash.digest("hex");
}

export function resolutionDigest(resolution: Content): string {
	return normalizedDigest(resolution);
}

function rawCounts(content: Buffer): RawSpanCounts {
	if (content.length === 0) return { lines: 0, bytes: 0 };
	let lines = 0;
	for (const byte of content) {
		if (byte === 0x0a) lines += 1;
	}
	if (content[content.length - 1] !== 0x0a) lines += 1;
	return { lines, bytes: content.length };
}

function present<T>(
	contents: LocalizedRegionContents,
	map: (content: Buffer) => T,
): RegionDigests<T> {
	return {
		base: map(contents.base),
		ours: map(contents.ours),
		theirs: map(contents.theirs),
		resolution: map(contents.resolution),
	};
}

function rawClass(
	contents: LocalizedRegionContents,
	stageOids: StageObjectIds,
): ExactConflictRegionRecord["resolutionClass"] {
	if (contents.resolution.length === 0) return "deleted";
	if (stageOids.ours !== null && contents.ours.equals(contents.resolution)) {
		return "ours";
	}
	if (stageOids.theirs !== null && contents.theirs.equals(contents.resolution)) {
		return "theirs";
	}
	if (stageOids.base !== null && contents.base.equals(contents.resolution)) {
		return "base";
	}
	return "novel";
}

export function classifyLocalizedRegion(
	identity: ConflictRegionIdentity,
	automaticRanges: AutomaticRanges<LineRange>,
	resolutionRange: LineRange,
	contents: LocalizedRegionContents,
): ExactConflictRegionRecord {
	const normalizedResolution = normalizeV1(contents.resolution);
	const base = identity.stageOids.base === null ? null : contents.base;
	const ours = identity.stageOids.ours === null ? null : contents.ours;
	const theirs = identity.stageOids.theirs === null ? null : contents.theirs;
	const normalizedInputs = [base, ours, theirs]
		.filter((content): content is Buffer => content !== null)
		.map(normalizeV1);
	return {
		...identity,
		localizationStatus: "exact",
		automaticRanges,
		resolutionRange,
		rawDigests: present(contents, digest),
		normalizedDigests: present(contents, normalizedDigest),
		rawCounts: present(contents, rawCounts),
		resolutionClass: rawClass(contents, identity.stageOids),
		novelAfterNormalization: !normalizedInputs.includes(normalizedResolution),
		tripleKey: tripleKey(base, ours, theirs),
	};
}

export function categorizePath(path: string): ConflictCategory {
	const name = posix.basename(path);
	if (LOCKFILES[name] === true) return "lockfile";

	const lowered = path.toLowerCase();
	const segmentPath = `/${lowered.replace(/^\/+/, "")}`;
	if (
		segmentPath.includes("/migrations/") ||
		segmentPath.includes("/migrate/") ||
		segmentPath.includes("/db/migrate/") ||
		segmentPath.includes("/alembic/versions/")
	) {
		return "migration";
	}
	if (
		/(^|\/)(?:generated|__generated__)(?:\/|$)/.test(lowered) ||
		/\.gen\.[^/]+$/i.test(path) ||
		/(?:Parser|Lexer)\.(?:java|kt|ts|tsx|js|jsx|cs|cpp|cc|c|h|hpp|py)$/i.test(
			name,
		) ||
		/(?:_parser|_lexer)\.py$/i.test(name) ||
		/(?:\.pb\.[^/]+|_pb2(?:_grpc)?\.py|\.g\.dart|\.freezed\.dart)$/i.test(name)
	) {
		return "generated";
	}
	if (
		DOCUMENT_EXTENSIONS[posix.extname(lowered)] === true ||
		/(^|\/)docs(?:\/|$)/.test(lowered)
	) {
		return "documentation";
	}
	return "other";
}
