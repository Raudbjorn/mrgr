import { OBJECT_GIT_TIMEOUT_MS } from "./acquire.js";
import { categorizePath, classifyLocalizedRegion } from "./classify.js";
import { runGit } from "./git.js";
import { err, ok } from "./result.js";
const nullDigests = () => ({
    base: null,
    ours: null,
    theirs: null,
    resolution: null,
});
function splitLines(blob) {
    const lines = [];
    let start = 0;
    for (let index = 0; index < blob.length; index += 1) {
        if (blob[index] !== 0x0a)
            continue;
        lines.push(blob.subarray(start, index + 1));
        start = index + 1;
    }
    if (start < blob.length)
        lines.push(blob.subarray(start));
    return lines;
}
function markerKind(line) {
    const text = line.toString("utf8").replace(/\r?\n$/, "");
    if (/^<<<<<<<(?: |$)/.test(text))
        return "ours";
    if (/^\|\|\|\|\|\|\|(?: |$)/.test(text))
        return "base";
    if (/^=======$/.test(text))
        return "separator";
    if (/^>>>>>>>(?: |$)/.test(text))
        return "theirs";
    return null;
}
export function parseDiff3Blocks(automaticBlob) {
    const lines = splitLines(automaticBlob);
    const blocks = [];
    let state = "outside";
    let blockStart = 0;
    let oursStart = 0;
    let oursEnd = 0;
    let baseStart = 0;
    let baseEnd = 0;
    let theirsStart = 0;
    for (let index = 0; index < lines.length; index += 1) {
        const lineNumber = index + 1;
        const marker = markerKind(lines[index]);
        if (state === "outside") {
            if (marker === null)
                continue;
            if (marker !== "ours")
                return { blocks, malformed: true };
            blockStart = lineNumber;
            oursStart = lineNumber + 1;
            state = "ours";
            continue;
        }
        if (state === "ours" && marker === "base") {
            oursEnd = lineNumber;
            baseStart = lineNumber + 1;
            state = "base";
            continue;
        }
        if (state === "base" && marker === "separator") {
            baseEnd = lineNumber;
            theirsStart = lineNumber + 1;
            state = "theirs";
            continue;
        }
        if (state === "theirs" && marker === "theirs") {
            blocks.push({
                blockRange: { startLine: blockStart, endLineExclusive: lineNumber + 1 },
                automaticRanges: {
                    base: { startLine: baseStart, endLineExclusive: baseEnd },
                    ours: { startLine: oursStart, endLineExclusive: oursEnd },
                    theirs: { startLine: theirsStart, endLineExclusive: lineNumber },
                },
            });
            state = "outside";
            continue;
        }
        if (marker !== null)
            return { blocks, malformed: true };
    }
    return { blocks, malformed: state !== "outside" };
}
function diffRange(start, count) {
    const startLine = count === 0 ? start + 1 : start;
    return { startLine, endLineExclusive: startLine + count };
}
function parseDiffHunks(diff) {
    const hunks = [];
    for (const line of diff.toString("utf8").split("\n")) {
        if (!line.startsWith("@@"))
            continue;
        const match = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(?: |$)/.exec(line);
        if (match === null)
            return null;
        const oldStart = Number(match[1]);
        const oldCount = match[2] === undefined ? 1 : Number(match[2]);
        const newStart = Number(match[3]);
        const newCount = match[4] === undefined ? 1 : Number(match[4]);
        if (![oldStart, oldCount, newStart, newCount].every(Number.isSafeInteger))
            return null;
        hunks.push({
            oldStart,
            oldCount,
            newStart,
            newCount,
            oldRange: diffRange(oldStart, oldCount),
            newRange: diffRange(newStart, newCount),
        });
    }
    return hunks;
}
function rangesOverlap(left, right) {
    return (left.startLine < right.endLineExclusive &&
        right.startLine < left.endLineExclusive);
}
function hunkTouchesBlock(hunk, block) {
    if (hunk.oldCount > 0)
        return rangesOverlap(hunk.oldRange, block);
    return (hunk.oldRange.startLine >= block.startLine &&
        hunk.oldRange.startLine <= block.endLineExclusive);
}
function sliceRange(blob, range) {
    return Buffer.concat(splitLines(blob).slice(range.startLine - 1, range.endLineExclusive - 1));
}
function inexactRecord(input, ordinal, localizationStatus, automaticRanges = {
    base: null,
    ours: null,
    theirs: null,
}) {
    return {
        path: input.path,
        ordinal,
        category: categorizePath(input.path),
        conflictKind: input.conflictKind,
        stageOids: input.stageOids,
        localizationStatus,
        automaticRanges,
        resolutionRange: null,
        rawDigests: nullDigests(),
        normalizedDigests: nullDigests(),
        rawCounts: nullDigests(),
        resolutionClass: "ambiguous",
        novelAfterNormalization: null,
        tripleKey: null,
    };
}
export function localizeConflictPathEvidence(input) {
    if (!/^CONFLICT \(contents?\)$/i.test(input.conflictKind)) {
        return ok([inexactRecord(input, 1, "unsupported-structural")]);
    }
    if (input.automaticBlob === null) {
        return ok([inexactRecord(input, 1, "unsupported-structural")]);
    }
    if (input.automaticBlob.includes(0) ||
        (input.shippedBlob !== null && input.shippedBlob.includes(0))) {
        return ok([inexactRecord(input, 1, "unsupported-binary")]);
    }
    const parsed = parseDiff3Blocks(input.automaticBlob);
    if (parsed.malformed || parsed.blocks.length === 0) {
        return ok([inexactRecord(input, 1, "ambiguous")]);
    }
    const hunks = input.diff === null ? null : parseDiffHunks(input.diff);
    const shippedBlob = input.shippedBlob ?? Buffer.alloc(0);
    const records = parsed.blocks.map((block, index) => {
        const ranges = block.automaticRanges;
        if (hunks === null)
            return inexactRecord(input, index + 1, "ambiguous", ranges);
        const touching = hunks.filter((hunk) => hunkTouchesBlock(hunk, block.blockRange));
        const first = touching[0];
        const last = touching[touching.length - 1];
        const confinedToThisBlock = touching.length > 0 &&
            touching.every((hunk) => hunk.oldRange.startLine >= block.blockRange.startLine &&
                hunk.oldRange.endLineExclusive <= block.blockRange.endLineExclusive &&
                parsed.blocks.filter((candidate) => hunkTouchesBlock(hunk, candidate.blockRange)).length === 1);
        const explainedGaps = touching.slice(1).every((hunk, index) => {
            const previous = touching[index];
            const oldGap = hunk.oldRange.startLine - previous.oldRange.endLineExclusive;
            const newGap = hunk.newRange.startLine - previous.newRange.endLineExclusive;
            return oldGap >= 0 && oldGap === newGap;
        });
        if (first === undefined ||
            last === undefined ||
            !confinedToThisBlock ||
            !explainedGaps ||
            first.oldRange.startLine !== block.blockRange.startLine ||
            last.oldRange.endLineExclusive !== block.blockRange.endLineExclusive) {
            return inexactRecord(input, index + 1, "ambiguous", ranges);
        }
        const resolutionRange = {
            startLine: first.newRange.startLine,
            endLineExclusive: last.newRange.endLineExclusive,
        };
        if (resolutionRange.startLine > resolutionRange.endLineExclusive) {
            return inexactRecord(input, index + 1, "ambiguous", ranges);
        }
        return classifyLocalizedRegion({
            path: input.path,
            ordinal: index + 1,
            category: categorizePath(input.path),
            conflictKind: input.conflictKind,
            stageOids: input.stageOids,
        }, ranges, resolutionRange, {
            base: sliceRange(input.automaticBlob, ranges.base),
            ours: sliceRange(input.automaticBlob, ranges.ours),
            theirs: sliceRange(input.automaticBlob, ranges.theirs),
            resolution: sliceRange(shippedBlob, resolutionRange),
        });
    });
    return ok(records);
}
async function readBlob(repository, revision, path, options) {
    const output = await runGit(repository.gitPath, ["show", `${revision}:${path}`], {
        acceptedExitCodes: [0, 128],
        gitBinary: options.gitBinary,
        timeoutMs: OBJECT_GIT_TIMEOUT_MS,
    });
    if (!output.ok)
        return output;
    return ok(output.value.exitCode === 0 ? output.value.stdout : null);
}
function conflictKindFor(replay, path) {
    return (replay.informationalMessages.find((message) => message.kind.startsWith("CONFLICT") && message.paths.includes(path))?.kind ?? "unknown");
}
export async function localizeConflictRegions(repository, replay, options = {}) {
    if (replay.replayStatus !== "conflicted")
        return ok([]);
    if (replay.automaticTreeOid === null) {
        return err("parse", "localize conflict regions", "Conflicted replay has no automatic tree OID");
    }
    const records = [];
    for (const path of replay.conflictPaths) {
        const stageOids = replay.stageOidsByPath[path] ?? {
            base: null,
            ours: null,
            theirs: null,
        };
        const automatic = await readBlob(repository, replay.automaticTreeOid, path, options);
        if (!automatic.ok)
            return automatic;
        const shipped = await readBlob(repository, replay.candidate.sha, path, options);
        if (!shipped.ok)
            return shipped;
        let diff = null;
        if (automatic.value !== null) {
            const diffResult = await runGit(repository.gitPath, [
                "diff",
                "--no-renames",
                "--unified=0",
                replay.automaticTreeOid,
                replay.candidate.sha,
                "--",
                path,
            ], { gitBinary: options.gitBinary, timeoutMs: OBJECT_GIT_TIMEOUT_MS });
            if (!diffResult.ok)
                return diffResult;
            diff = diffResult.value.stdout;
        }
        const localized = localizeConflictPathEvidence({
            path,
            conflictKind: conflictKindFor(replay, path),
            stageOids,
            automaticBlob: automatic.value,
            shippedBlob: shipped.value,
            diff,
        });
        if (!localized.ok)
            return localized;
        records.push(...localized.value);
    }
    return ok(records);
}
//# sourceMappingURL=localize.js.map