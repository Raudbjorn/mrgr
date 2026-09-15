import { createHash } from "node:crypto";
import { posix } from "node:path";
const LOCKFILES = {
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
const DOCUMENT_EXTENSIONS = {
    ".md": true,
    ".rst": true,
    ".txt": true,
    ".adoc": true,
};
function bytes(content) {
    return Buffer.isBuffer(content) ? content : Buffer.from(content);
}
export function normalizeV1(content) {
    return bytes(content)
        .toString("utf8")
        .replace(/\r\n?/g, "\n")
        .replace(/\t/g, "    ")
        .replace(/[ \t]+$/gm, "")
        .replace(/\n{3,}/g, "\n\n")
        .replace(/^\n+|\n+$/g, "");
}
function digest(content) {
    return createHash("sha256").update(bytes(content)).digest("hex");
}
function normalizedDigest(content) {
    return digest(normalizeV1(content));
}
function addPresenceTaggedContent(hash, content) {
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
export function tripleKey(base, ours, theirs) {
    const hash = createHash("sha256");
    addPresenceTaggedContent(hash, base);
    addPresenceTaggedContent(hash, ours);
    addPresenceTaggedContent(hash, theirs);
    return hash.digest("hex");
}
export function resolutionDigest(resolution) {
    return normalizedDigest(resolution);
}
function rawCounts(content) {
    if (content.length === 0)
        return { lines: 0, bytes: 0 };
    let lines = 0;
    for (const byte of content) {
        if (byte === 0x0a)
            lines += 1;
    }
    if (content[content.length - 1] !== 0x0a)
        lines += 1;
    return { lines, bytes: content.length };
}
function present(contents, map) {
    return {
        base: map(contents.base),
        ours: map(contents.ours),
        theirs: map(contents.theirs),
        resolution: map(contents.resolution),
    };
}
function rawClass(contents, stageOids) {
    if (contents.resolution.length === 0)
        return "deleted";
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
export function classifyLocalizedRegion(identity, automaticRanges, resolutionRange, contents) {
    const normalizedResolution = normalizeV1(contents.resolution);
    const base = identity.stageOids.base === null ? null : contents.base;
    const ours = identity.stageOids.ours === null ? null : contents.ours;
    const theirs = identity.stageOids.theirs === null ? null : contents.theirs;
    const normalizedInputs = [base, ours, theirs]
        .filter((content) => content !== null)
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
export function categorizePath(path) {
    const name = posix.basename(path);
    if (LOCKFILES[name] === true)
        return "lockfile";
    const lowered = path.toLowerCase();
    const segmentPath = `/${lowered.replace(/^\/+/, "")}`;
    if (segmentPath.includes("/migrations/") ||
        segmentPath.includes("/migrate/") ||
        segmentPath.includes("/db/migrate/") ||
        segmentPath.includes("/alembic/versions/")) {
        return "migration";
    }
    if (/(^|\/)(?:generated|__generated__)(?:\/|$)/.test(lowered) ||
        /\.gen\.[^/]+$/i.test(path) ||
        /(?:Parser|Lexer)\.(?:java|kt|ts|tsx|js|jsx|cs|cpp|cc|c|h|hpp|py)$/i.test(name) ||
        /(?:_parser|_lexer)\.py$/i.test(name) ||
        /(?:\.pb\.[^/]+|_pb2(?:_grpc)?\.py|\.g\.dart|\.freezed\.dart)$/i.test(name)) {
        return "generated";
    }
    if (DOCUMENT_EXTENSIONS[posix.extname(lowered)] === true ||
        /(^|\/)docs(?:\/|$)/.test(lowered)) {
        return "documentation";
    }
    return "other";
}
//# sourceMappingURL=classify.js.map