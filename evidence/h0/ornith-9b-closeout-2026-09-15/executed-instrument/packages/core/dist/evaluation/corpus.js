import { createReadStream } from "node:fs";
import { access, open } from "node:fs/promises";
import { isAbsolute } from "node:path";
import { TextDecoder } from "node:util";
import { err, ok } from "./result.js";
import { SCHEMA_VERSION, } from "./types.js";
const ERROR_KINDS = {
    config: true,
    "not-found": true,
    timeout: true,
    "output-limit": true,
    git: true,
    parse: true,
    unsupported: true,
    "corrupt-corpus": true,
};
const BASE_TOPOLOGIES = {
    single: true,
    multiple: true,
    none: true,
};
const REPLAY_STATUSES = {
    clean: true,
    conflicted: true,
    unrelated: true,
    "unsupported-custom-driver": true,
    error: true,
};
const LOCALIZATION_STATUSES = {
    exact: true,
    ambiguous: true,
    "unsupported-binary": true,
    "unsupported-structural": true,
};
const CATEGORIES = {
    lockfile: true,
    migration: true,
    documentation: true,
    generated: true,
    other: true,
};
const EXACT_RESOLUTION_CLASSES = {
    ours: true,
    theirs: true,
    base: true,
    deleted: true,
    novel: true,
};
const SHA256 = /^[a-f0-9]{64}$/;
const OBJECT_ID = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;
const UTF8_DECODER = new TextDecoder("utf-8", { fatal: true });
function corpusError(message, details) {
    return err("corrupt-corpus", "parse corpus record", message, details);
}
function isObject(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isObjectId(value) {
    return typeof value === "string" && OBJECT_ID.test(value);
}
function stringField(object, key, path) {
    const value = object[key];
    if (typeof value !== "string" || value.length === 0) {
        return corpusError(`${path}.${key} must be a nonempty string`);
    }
    return ok(value);
}
function nullableStringField(object, key, path) {
    const value = object[key];
    if (value === null)
        return ok(null);
    if (typeof value !== "string" || value.length === 0) {
        return corpusError(`${path}.${key} must be a nonempty string or null`);
    }
    return ok(value);
}
function objectIdField(object, key, path) {
    const value = object[key];
    if (!isObjectId(value)) {
        return corpusError(`${path}.${key} must be a 40- or 64-character lowercase hexadecimal ObjectId`);
    }
    return ok(value);
}
function nullableObjectIdField(object, key, path) {
    const value = object[key];
    if (value === null)
        return ok(null);
    if (!isObjectId(value)) {
        return corpusError(`${path}.${key} must be a 40- or 64-character lowercase hexadecimal ObjectId or null`);
    }
    return ok(value);
}
function integerField(object, key, path, minimum = 0) {
    const value = object[key];
    if (!Number.isSafeInteger(value) || value < minimum) {
        return corpusError(`${path}.${key} must be a safe integer >= ${minimum}`);
    }
    return ok(value);
}
function stringArray(value, path) {
    if (!Array.isArray(value))
        return corpusError(`${path} must be an array`);
    const result = [];
    for (let index = 0; index < value.length; index += 1) {
        const item = value[index];
        if (typeof item !== "string" || item.length === 0) {
            return corpusError(`${path}[${index}] must be a nonempty string`);
        }
        result.push(item);
    }
    return ok(result);
}
function objectIdArray(value, path) {
    if (!Array.isArray(value))
        return corpusError(`${path} must be an array`);
    const result = [];
    for (let index = 0; index < value.length; index += 1) {
        const item = value[index];
        if (!isObjectId(item)) {
            return corpusError(`${path}[${index}] must be a 40- or 64-character lowercase hexadecimal ObjectId`);
        }
        result.push(item);
    }
    return ok(result);
}
function parseRepository(value) {
    if (!isObject(value))
        return corpusError("repository must be an object");
    const kind = value.kind;
    const id = stringField(value, "id", "repository");
    if (!id.ok)
        return id;
    if (kind === "local") {
        const absolutePath = stringField(value, "absolutePath", "repository");
        if (!absolutePath.ok)
            return absolutePath;
        if (!isAbsolute(absolutePath.value))
            return corpusError("repository.absolutePath must be absolute");
        return ok({ kind, id: id.value, absolutePath: absolutePath.value });
    }
    if (kind === "remote") {
        const host = stringField(value, "host", "repository");
        if (!host.ok)
            return host;
        const slug = stringField(value, "slug", "repository");
        if (!slug.ok)
            return slug;
        const cacheKey = stringField(value, "cacheKey", "repository");
        if (!cacheKey.ok)
            return cacheKey;
        return ok({
            kind,
            id: id.value,
            host: host.value,
            slug: slug.value,
            cacheKey: cacheKey.value,
        });
    }
    return corpusError("repository.kind must be local or remote");
}
function parseCandidate(value) {
    if (!isObject(value))
        return corpusError("merge must be an object");
    const repositoryId = stringField(value, "repositoryId", "merge");
    if (!repositoryId.ok)
        return repositoryId;
    const sha = objectIdField(value, "sha", "merge");
    if (!sha.ok)
        return sha;
    if (!Array.isArray(value.parents) || value.parents.length !== 2) {
        return corpusError("merge.parents must be an exact two-item tuple");
    }
    const first = value.parents[0];
    const second = value.parents[1];
    if (!isObjectId(first) || !isObjectId(second)) {
        return corpusError("merge.parents entries must be 40- or 64-character lowercase hexadecimal ObjectIds");
    }
    const authorDate = stringField(value, "authorDate", "merge");
    if (!authorDate.ok)
        return authorDate;
    const subject = value.subject;
    if (typeof subject !== "string")
        return corpusError("merge.subject must be a string");
    return ok({
        repositoryId: repositoryId.value,
        sha: sha.value,
        parents: [first, second],
        authorDate: authorDate.value,
        subject,
    });
}
function parseProvenance(value) {
    if (!isObject(value))
        return corpusError("replayProvenance must be an object");
    const gitVersion = stringField(value, "gitVersion", "replayProvenance");
    if (!gitVersion.ok)
        return gitVersion;
    if (value.algorithm !== "merge-tree-write-tree")
        return corpusError("replayProvenance.algorithm is invalid");
    if (value.strategy !== "ort")
        return corpusError("replayProvenance.strategy is invalid");
    if (value.environmentPolicy !== "isolated-v1")
        return corpusError("replayProvenance.environmentPolicy is invalid");
    if (value.normalizationVersion !== "v1")
        return corpusError("replayProvenance.normalizationVersion is invalid");
    if (!isObject(value.parentAttributes))
        return corpusError("replayProvenance.parentAttributes must be an object");
    const ours = nullableObjectIdField(value.parentAttributes, "ours", "replayProvenance.parentAttributes");
    if (!ours.ok)
        return ours;
    const theirs = nullableObjectIdField(value.parentAttributes, "theirs", "replayProvenance.parentAttributes");
    if (!theirs.ok)
        return theirs;
    const repoMergeConfigHash = nullableStringField(value, "repoMergeConfigHash", "replayProvenance");
    if (!repoMergeConfigHash.ok)
        return repoMergeConfigHash;
    if (repoMergeConfigHash.value !== null &&
        !SHA256.test(repoMergeConfigHash.value)) {
        return corpusError("replayProvenance.repoMergeConfigHash must be a SHA-256 digest or null");
    }
    return ok({
        gitVersion: gitVersion.value,
        algorithm: "merge-tree-write-tree",
        strategy: "ort",
        environmentPolicy: "isolated-v1",
        normalizationVersion: "v1",
        parentAttributes: { ours: ours.value, theirs: theirs.value },
        repoMergeConfigHash: repoMergeConfigHash.value,
    });
}
function parseLineRange(value, path) {
    if (!isObject(value))
        return corpusError(`${path} must be an object`);
    const startLine = integerField(value, "startLine", path, 1);
    if (!startLine.ok)
        return startLine;
    const endLineExclusive = integerField(value, "endLineExclusive", path, 1);
    if (!endLineExclusive.ok)
        return endLineExclusive;
    if (endLineExclusive.value < startLine.value)
        return corpusError(`${path} has an inverted range`);
    return ok({
        startLine: startLine.value,
        endLineExclusive: endLineExclusive.value,
    });
}
function parseNullableRange(value, path) {
    return value === null ? ok(null) : parseLineRange(value, path);
}
function parseAutomaticRanges(value, path, parse) {
    if (!isObject(value))
        return corpusError(`${path} must be an object`);
    const base = parse(value.base, `${path}.base`);
    if (!base.ok)
        return base;
    const ours = parse(value.ours, `${path}.ours`);
    if (!ours.ok)
        return ours;
    const theirs = parse(value.theirs, `${path}.theirs`);
    if (!theirs.ok)
        return theirs;
    return ok({ base: base.value, ours: ours.value, theirs: theirs.value });
}
function parseDigest(value, path) {
    if (typeof value !== "string" || !SHA256.test(value))
        return corpusError(`${path} must be a SHA-256 digest`);
    return ok(value);
}
function parseNullableDigest(value, path) {
    return value === null ? ok(null) : parseDigest(value, path);
}
function parseRegionDigests(value, path, parse) {
    if (!isObject(value))
        return corpusError(`${path} must be an object`);
    const automatic = parseAutomaticRanges(value, path, parse);
    if (!automatic.ok)
        return automatic;
    const resolution = parse(value.resolution, `${path}.resolution`);
    if (!resolution.ok)
        return resolution;
    return ok({ ...automatic.value, resolution: resolution.value });
}
function parseCounts(value, path) {
    if (!isObject(value))
        return corpusError(`${path} must be an object`);
    const lines = integerField(value, "lines", path);
    if (!lines.ok)
        return lines;
    const bytes = integerField(value, "bytes", path);
    if (!bytes.ok)
        return bytes;
    return ok({ lines: lines.value, bytes: bytes.value });
}
function parseNullableCounts(value, path) {
    return value === null ? ok(null) : parseCounts(value, path);
}
function parseStageOids(value, path) {
    if (!isObject(value))
        return corpusError(`${path} must be an object`);
    const base = nullableObjectIdField(value, "base", path);
    if (!base.ok)
        return base;
    const ours = nullableObjectIdField(value, "ours", path);
    if (!ours.ok)
        return ours;
    const theirs = nullableObjectIdField(value, "theirs", path);
    if (!theirs.ok)
        return theirs;
    return ok({ base: base.value, ours: ours.value, theirs: theirs.value });
}
function parseRegionCommon(value, path) {
    const regionPath = stringField(value, "path", path);
    if (!regionPath.ok)
        return regionPath;
    const ordinal = integerField(value, "ordinal", path, 1);
    if (!ordinal.ok)
        return ordinal;
    if (typeof value.category !== "string" ||
        CATEGORIES[value.category] !== true) {
        return corpusError(`${path}.category is invalid`);
    }
    const conflictKind = stringField(value, "conflictKind", path);
    if (!conflictKind.ok)
        return conflictKind;
    const stageOids = parseStageOids(value.stageOids, `${path}.stageOids`);
    if (!stageOids.ok)
        return stageOids;
    return ok({
        path: regionPath.value,
        ordinal: ordinal.value,
        category: value.category,
        conflictKind: conflictKind.value,
        stageOids: stageOids.value,
    });
}
function parseConflictRegion(value, index) {
    const path = `conflictRegions[${index}]`;
    if (!isObject(value))
        return corpusError(`${path} must be an object`);
    const common = parseRegionCommon(value, path);
    if (!common.ok)
        return common;
    const localizationStatus = value.localizationStatus;
    if (typeof localizationStatus !== "string" ||
        LOCALIZATION_STATUSES[localizationStatus] !== true) {
        return corpusError(`${path}.localizationStatus is invalid`);
    }
    if (localizationStatus === "exact") {
        const automaticRanges = parseAutomaticRanges(value.automaticRanges, `${path}.automaticRanges`, parseLineRange);
        if (!automaticRanges.ok)
            return automaticRanges;
        const resolutionRange = parseLineRange(value.resolutionRange, `${path}.resolutionRange`);
        if (!resolutionRange.ok)
            return resolutionRange;
        const rawDigests = parseRegionDigests(value.rawDigests, `${path}.rawDigests`, parseDigest);
        if (!rawDigests.ok)
            return rawDigests;
        const normalizedDigests = parseRegionDigests(value.normalizedDigests, `${path}.normalizedDigests`, parseDigest);
        if (!normalizedDigests.ok)
            return normalizedDigests;
        const rawCounts = parseRegionDigests(value.rawCounts, `${path}.rawCounts`, parseCounts);
        if (!rawCounts.ok)
            return rawCounts;
        if (typeof value.resolutionClass !== "string" ||
            EXACT_RESOLUTION_CLASSES[value.resolutionClass] !== true) {
            return corpusError(`${path}.resolutionClass is invalid for an exact region`);
        }
        if (typeof value.novelAfterNormalization !== "boolean")
            return corpusError(`${path}.novelAfterNormalization must be boolean`);
        const triple = parseDigest(value.tripleKey, `${path}.tripleKey`);
        if (!triple.ok)
            return triple;
        return ok({
            ...common.value,
            localizationStatus,
            automaticRanges: automaticRanges.value,
            resolutionRange: resolutionRange.value,
            rawDigests: rawDigests.value,
            normalizedDigests: normalizedDigests.value,
            rawCounts: rawCounts.value,
            resolutionClass: value.resolutionClass,
            novelAfterNormalization: value.novelAfterNormalization,
            tripleKey: triple.value,
        });
    }
    const automaticRanges = parseAutomaticRanges(value.automaticRanges, `${path}.automaticRanges`, parseNullableRange);
    if (!automaticRanges.ok)
        return automaticRanges;
    const resolutionRange = parseNullableRange(value.resolutionRange, `${path}.resolutionRange`);
    if (!resolutionRange.ok)
        return resolutionRange;
    const rawDigests = parseRegionDigests(value.rawDigests, `${path}.rawDigests`, parseNullableDigest);
    if (!rawDigests.ok)
        return rawDigests;
    const normalizedDigests = parseRegionDigests(value.normalizedDigests, `${path}.normalizedDigests`, parseNullableDigest);
    if (!normalizedDigests.ok)
        return normalizedDigests;
    const rawCounts = parseRegionDigests(value.rawCounts, `${path}.rawCounts`, parseNullableCounts);
    if (!rawCounts.ok)
        return rawCounts;
    if (value.resolutionClass !== "ambiguous" ||
        value.novelAfterNormalization !== null ||
        value.tripleKey !== null) {
        return corpusError(`${path} carries invalid evidence for an inexact region`);
    }
    if (localizationStatus === "ambiguous") {
        return ok({
            ...common.value,
            localizationStatus,
            automaticRanges: automaticRanges.value,
            resolutionRange: resolutionRange.value,
            rawDigests: rawDigests.value,
            normalizedDigests: normalizedDigests.value,
            rawCounts: rawCounts.value,
            resolutionClass: "ambiguous",
            novelAfterNormalization: null,
            tripleKey: null,
        });
    }
    if (localizationStatus !== "unsupported-binary" &&
        localizationStatus !== "unsupported-structural") {
        return corpusError(`${path}.localizationStatus is invalid`);
    }
    return ok({
        ...common.value,
        localizationStatus,
        automaticRanges: automaticRanges.value,
        resolutionRange: resolutionRange.value,
        rawDigests: rawDigests.value,
        normalizedDigests: normalizedDigests.value,
        rawCounts: rawCounts.value,
        resolutionClass: "ambiguous",
        novelAfterNormalization: null,
        tripleKey: null,
    });
}
function parseReachability(value, index) {
    const path = `baseReachabilityCounts[${index}]`;
    if (!isObject(value))
        return corpusError(`${path} must be an object`);
    const baseSha = objectIdField(value, "baseSha", path);
    if (!baseSha.ok)
        return baseSha;
    const ours = integerField(value, "oursExclusiveCommits", path);
    if (!ours.ok)
        return ours;
    const theirs = integerField(value, "theirsExclusiveCommits", path);
    if (!theirs.ok)
        return theirs;
    return ok({
        baseSha: baseSha.value,
        oursExclusiveCommits: ours.value,
        theirsExclusiveCommits: theirs.value,
    });
}
function parseToolError(value) {
    if (!isObject(value))
        return corpusError("error must be an object");
    if (typeof value.kind !== "string" || ERROR_KINDS[value.kind] !== true)
        return corpusError("error.kind is invalid");
    const operation = stringField(value, "operation", "error");
    if (!operation.ok)
        return operation;
    const message = stringField(value, "message", "error");
    if (!message.ok)
        return message;
    let details;
    if (value.details !== undefined) {
        if (!isObject(value.details))
            return corpusError("error.details must be an object");
        details = {};
        for (const [key, detail] of Object.entries(value.details)) {
            if (detail !== null &&
                typeof detail !== "string" &&
                typeof detail !== "number" &&
                typeof detail !== "boolean") {
                return corpusError(`error.details.${key} has an invalid value`);
            }
            details[key] = detail;
        }
    }
    return ok({
        kind: value.kind,
        operation: operation.value,
        message: message.value,
        ...(details === undefined ? {} : { details }),
    });
}
export function parseCorpusRecord(value) {
    if (!isObject(value))
        return corpusError("Corpus record must be an object");
    if (value.schemaVersion !== SCHEMA_VERSION) {
        return corpusError(`schemaVersion must be ${SCHEMA_VERSION}; incompatible corpus versions are not supported`, {
            detectedSchemaVersion: typeof value.schemaVersion === "number" ? value.schemaVersion : null,
        });
    }
    const repository = parseRepository(value.repository);
    if (!repository.ok)
        return repository;
    const merge = parseCandidate(value.merge);
    if (!merge.ok)
        return merge;
    if (merge.value.repositoryId !== repository.value.id)
        return corpusError("merge.repositoryId must equal repository.id");
    const baselineId = parseDigest(value.baselineId, "baselineId");
    if (!baselineId.ok)
        return baselineId;
    const replayProvenance = parseProvenance(value.replayProvenance);
    if (!replayProvenance.ok)
        return replayProvenance;
    const mergeBases = objectIdArray(value.mergeBases, "mergeBases");
    if (!mergeBases.ok)
        return mergeBases;
    if (typeof value.baseTopology !== "string" ||
        BASE_TOPOLOGIES[value.baseTopology] !== true)
        return corpusError("baseTopology is invalid");
    const baseTopology = value.baseTopology;
    if ((baseTopology === "none" && mergeBases.value.length !== 0) ||
        (baseTopology === "single" && mergeBases.value.length !== 1) ||
        (baseTopology === "multiple" && mergeBases.value.length < 2)) {
        return corpusError("baseTopology does not match mergeBases");
    }
    if (!Array.isArray(value.baseReachabilityCounts))
        return corpusError("baseReachabilityCounts must be an array");
    const baseReachabilityCounts = [];
    for (let index = 0; index < value.baseReachabilityCounts.length; index += 1) {
        const parsed = parseReachability(value.baseReachabilityCounts[index], index);
        if (!parsed.ok)
            return parsed;
        baseReachabilityCounts.push(parsed.value);
    }
    if (baseReachabilityCounts.length !== mergeBases.value.length ||
        baseReachabilityCounts.some((count, index) => count.baseSha !== mergeBases.value[index])) {
        return corpusError("baseReachabilityCounts must correspond to mergeBases in order");
    }
    let changedPathIntersection;
    if (value.changedPathIntersection === null)
        changedPathIntersection = null;
    else {
        const parsed = stringArray(value.changedPathIntersection, "changedPathIntersection");
        if (!parsed.ok)
            return parsed;
        changedPathIntersection = parsed.value;
    }
    if (baseTopology === "single"
        ? changedPathIntersection === null
        : changedPathIntersection !== null) {
        return corpusError("changedPathIntersection must be present only for single-base records");
    }
    if (typeof value.replayStatus !== "string" ||
        REPLAY_STATUSES[value.replayStatus] !== true)
        return corpusError("replayStatus is invalid");
    const automaticTreeOid = nullableObjectIdField(value, "automaticTreeOid", "record");
    if (!automaticTreeOid.ok)
        return automaticTreeOid;
    const conflictPaths = stringArray(value.conflictPaths, "conflictPaths");
    if (!conflictPaths.ok)
        return conflictPaths;
    if (!Array.isArray(value.conflictRegions))
        return corpusError("conflictRegions must be an array");
    const conflictRegions = [];
    for (let index = 0; index < value.conflictRegions.length; index += 1) {
        const parsed = parseConflictRegion(value.conflictRegions[index], index);
        if (!parsed.ok)
            return parsed;
        conflictRegions.push(parsed.value);
    }
    let structuredError;
    if (value.error !== undefined) {
        const parsed = parseToolError(value.error);
        if (!parsed.ok)
            return parsed;
        structuredError = parsed.value;
    }
    if (value.replayStatus === "error" && structuredError === undefined)
        return corpusError("error replay records must carry a structured error");
    return ok({
        schemaVersion: SCHEMA_VERSION,
        repository: repository.value,
        merge: merge.value,
        baselineId: baselineId.value,
        replayProvenance: replayProvenance.value,
        mergeBases: mergeBases.value,
        baseTopology,
        baseReachabilityCounts,
        changedPathIntersection,
        replayStatus: value.replayStatus,
        automaticTreeOid: automaticTreeOid.value,
        conflictPaths: conflictPaths.value,
        conflictRegions,
        ...(structuredError === undefined ? {} : { error: structuredError }),
    });
}
function parseLine(line, lineNumber) {
    let text;
    try {
        text = UTF8_DECODER.decode(line);
    }
    catch {
        return err("corrupt-corpus", "read corpus", "JSONL record contains invalid UTF-8", {
            line: lineNumber,
        });
    }
    let value;
    try {
        value = JSON.parse(text);
    }
    catch {
        return err("corrupt-corpus", "read corpus", "Malformed JSONL record", {
            line: lineNumber,
        });
    }
    const parsed = parseCorpusRecord(value);
    if (!parsed.ok)
        return err("corrupt-corpus", "read corpus", parsed.error.message, {
            ...(parsed.error.details ?? {}),
            line: lineNumber,
        });
    return parsed;
}
export async function readCorpus(path) {
    const records = [];
    let carry = Buffer.alloc(0);
    let lineNumber = 0;
    try {
        for await (const chunk of createReadStream(path)) {
            carry = Buffer.concat([
                carry,
                Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk),
            ]);
            let newline = carry.indexOf(0x0a);
            while (newline >= 0) {
                lineNumber += 1;
                const parsed = parseLine(carry.subarray(0, newline), lineNumber);
                if (!parsed.ok)
                    return parsed;
                records.push(parsed.value);
                carry = carry.subarray(newline + 1);
                newline = carry.indexOf(0x0a);
            }
        }
    }
    catch (cause) {
        const code = isObject(cause) && typeof cause.code === "string" ? cause.code : null;
        return err(code === "ENOENT" ? "not-found" : "corrupt-corpus", "read corpus", code === "ENOENT"
            ? "Corpus file does not exist"
            : "Unable to read corpus", { path, code });
    }
    if (carry.length > 0) {
        lineNumber += 1;
        const parsed = parseLine(carry, lineNumber);
        if (parsed.ok)
            records.push(parsed.value);
        // A malformed non-newline tail is an interrupted append and is recoverable.
    }
    return ok(records);
}
export function resumeKey(record) {
    return JSON.stringify([
        record.repository.id,
        record.merge.sha,
        record.baselineId,
    ]);
}
export async function loadResumeKeys(path) {
    try {
        await access(path);
    }
    catch (cause) {
        if (isObject(cause) && cause.code === "ENOENT")
            return ok(new Set());
        return err("corrupt-corpus", "load resume keys", "Unable to access corpus", { path });
    }
    const records = await readCorpus(path);
    if (!records.ok)
        return records;
    return ok(new Set(records.value.map(resumeKey)));
}
async function prepareAppendBoundary(handle, path) {
    const metadata = await handle.stat();
    if (metadata.size === 0)
        return ok(undefined);
    let position = metadata.size;
    let tail = Buffer.alloc(0);
    let tailOffset = 0;
    const chunkSize = 64 * 1024;
    while (position > 0) {
        const length = Math.min(chunkSize, position);
        const start = position - length;
        const chunk = Buffer.allocUnsafe(length);
        const readResult = await handle.read(chunk, 0, length, start);
        const bytes = chunk.subarray(0, readResult.bytesRead);
        const newline = bytes.lastIndexOf(0x0a);
        if (newline >= 0) {
            tailOffset = start + newline + 1;
            tail = Buffer.concat([bytes.subarray(newline + 1), tail]);
            break;
        }
        tail = Buffer.concat([bytes, tail]);
        position = start;
    }
    if (tail.length === 0)
        return ok(undefined);
    if (parseLine(tail, 1).ok) {
        await handle.writeFile("\n", "utf8");
        return ok(undefined);
    }
    await handle.truncate(tailOffset);
    return ok(undefined);
}
export class CorpusWriter {
    handle;
    path;
    queue = Promise.resolve();
    state = "open";
    appendFailure;
    constructor(handle, path) {
        this.handle = handle;
        this.path = path;
    }
    static async open(path) {
        let handle;
        try {
            handle = await open(path, "a+");
            const prepared = await prepareAppendBoundary(handle, path);
            if (!prepared.ok) {
                await handle.close();
                return prepared;
            }
            return ok(new CorpusWriter(handle, path));
        }
        catch (cause) {
            if (handle !== undefined)
                await handle.close().catch(() => undefined);
            const code = isObject(cause) && typeof cause.code === "string" ? cause.code : null;
            return err("config", "open corpus writer", "Unable to open corpus for append", { path, code });
        }
    }
    async append(record) {
        if (this.state !== "open")
            return err("config", "append corpus record", "Corpus writer is not open", { path: this.path });
        let result = err("corrupt-corpus", "append corpus record", "Corpus write did not run");
        const line = Buffer.from(`${JSON.stringify(record)}\n`);
        const task = this.queue.then(async () => {
            if (this.appendFailure !== undefined) {
                result = { ok: false, error: this.appendFailure };
                return;
            }
            try {
                const written = await this.handle.write(line);
                if (written.bytesWritten !== line.length) {
                    const failure = {
                        kind: "corrupt-corpus",
                        operation: "append corpus record",
                        message: "Unable to append a complete corpus record",
                        details: {
                            path: this.path,
                            bytesWritten: written.bytesWritten,
                            bytesExpected: line.length,
                        },
                    };
                    this.appendFailure = failure;
                    result = { ok: false, error: failure };
                    return;
                }
                result = ok(undefined);
            }
            catch (cause) {
                const code = isObject(cause) && typeof cause.code === "string" ? cause.code : null;
                const failure = {
                    kind: "corrupt-corpus",
                    operation: "append corpus record",
                    message: "Unable to append corpus record",
                    details: { path: this.path, code },
                };
                this.appendFailure = failure;
                result = { ok: false, error: failure };
            }
        });
        this.queue = task.catch(() => undefined);
        await task;
        return result;
    }
    async close() {
        if (this.state === "closed")
            return ok(undefined);
        if (this.state === "open")
            this.state = "closing";
        await this.queue;
        try {
            await this.handle.close();
            this.state = "closed";
            return ok(undefined);
        }
        catch (cause) {
            const code = isObject(cause) && typeof cause.code === "string" ? cause.code : null;
            return err("corrupt-corpus", "close corpus writer", "Unable to close corpus", { path: this.path, code });
        }
    }
}
//# sourceMappingURL=corpus.js.map