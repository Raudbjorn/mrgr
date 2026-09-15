import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { err, ok } from "./result.js";
import { SCHEMA_VERSION } from "./types.js";
export const DEFAULT_GIT_TIMEOUT_MS = 60_000;
export const DEFAULT_GIT_OUTPUT_LIMIT_BYTES = 64 * 1024 * 1024;
export const MINIMUM_GIT_VERSION = "2.38.0";
const INHERITED_ENVIRONMENT_KEYS = [
    "PATH",
    "HOME",
    "TMPDIR",
    "SSL_CERT_FILE",
    "SSL_CERT_DIR",
    "HTTPS_PROXY",
    "HTTP_PROXY",
    "NO_PROXY",
];
const FIXED_GIT_ENVIRONMENT = {
    LC_ALL: "C",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_NO_REPLACE_OBJECTS: "1",
    GIT_OPTIONAL_LOCKS: "0",
    GIT_TERMINAL_PROMPT: "0",
};
export function buildGitEnvironment(inheritedEnvironment = process.env) {
    const environment = {};
    for (const key of INHERITED_ENVIRONMENT_KEYS) {
        const value = inheritedEnvironment[key];
        if (value !== undefined) {
            environment[key] = value;
        }
    }
    return { ...environment, ...FIXED_GIT_ENVIRONMENT };
}
function operationName(args) {
    const command = args[0];
    return command !== undefined && /^[a-z][a-z0-9-]*$/i.test(command)
        ? `git ${command}`
        : "git";
}
function killProcessTree(child) {
    if (child.pid === undefined) {
        return;
    }
    try {
        if (process.platform !== "win32") {
            process.kill(-child.pid, "SIGKILL");
        }
        else {
            child.kill("SIGKILL");
        }
    }
    catch {
        child.kill("SIGKILL");
    }
}
export function runGit(cwd, args, options = {}) {
    const timeoutMs = options.timeoutMs ?? DEFAULT_GIT_TIMEOUT_MS;
    const maxOutputBytes = options.maxOutputBytes ?? DEFAULT_GIT_OUTPUT_LIMIT_BYTES;
    const acceptedExitCodes = options.acceptedExitCodes ?? [0];
    const operation = operationName(args);
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
        return Promise.resolve(err("config", operation, "Git timeout must be a positive integer"));
    }
    if (!Number.isSafeInteger(maxOutputBytes) || maxOutputBytes < 0) {
        return Promise.resolve(err("config", operation, "Git output limit must be a non-negative integer"));
    }
    if (acceptedExitCodes.length === 0 ||
        acceptedExitCodes.some((code) => !Number.isInteger(code) || code < 0)) {
        return Promise.resolve(err("config", operation, "Accepted Git exit codes are invalid"));
    }
    return new Promise((resolve) => {
        const configArgs = Object.entries(options.config ?? {}).flatMap(([key, value]) => ["-c", `${key}=${value}`]);
        const child = spawn(options.gitBinary ?? "git", [...configArgs, ...args], {
            cwd,
            detached: process.platform !== "win32",
            env: buildGitEnvironment(options.inheritedEnvironment),
            stdio: ["ignore", "pipe", "pipe"],
        });
        const stdoutChunks = [];
        const stderrChunks = [];
        let capturedBytes = 0;
        let terminalError;
        let settled = false;
        const fail = (failure) => {
            if (terminalError !== undefined) {
                return;
            }
            terminalError = failure;
            killProcessTree(child);
        };
        const capture = (chunks, chunk) => {
            if (terminalError !== undefined) {
                return;
            }
            const remaining = Math.max(0, maxOutputBytes - capturedBytes);
            if (remaining > 0) {
                chunks.push(chunk.subarray(0, remaining));
            }
            capturedBytes += chunk.length;
            if (capturedBytes > maxOutputBytes) {
                fail(err("output-limit", operation, "Git output exceeded the configured limit", {
                    maxOutputBytes,
                }));
            }
        };
        child.stdout.on("data", (chunk) => capture(stdoutChunks, chunk));
        child.stderr.on("data", (chunk) => capture(stderrChunks, chunk));
        const timer = setTimeout(() => {
            fail(err("timeout", operation, "Git command timed out", { timeoutMs }));
        }, timeoutMs);
        timer.unref();
        child.once("error", (cause) => {
            clearTimeout(timer);
            if (settled) {
                return;
            }
            settled = true;
            resolve(err("config", operation, "Unable to start Git", {
                code: cause.code ?? "unknown",
            }));
        });
        child.once("close", (exitCode) => {
            clearTimeout(timer);
            if (settled) {
                return;
            }
            settled = true;
            if (terminalError !== undefined) {
                resolve(terminalError);
                return;
            }
            if (exitCode === null || !acceptedExitCodes.includes(exitCode)) {
                resolve(err("git", operation, "Git command failed", {
                    exitCode,
                }));
                return;
            }
            const stdout = Buffer.concat(stdoutChunks);
            const stderr = Buffer.concat(stderrChunks);
            resolve(ok({
                exitCode,
                stdout,
                stderr,
                stdoutText: () => stdout.toString("utf8"),
                stderrText: () => stderr.toString("utf8"),
            }));
        });
    });
}
function numericVersion(version) {
    const match = /(\d+)\.(\d+)\.(\d+)/.exec(version);
    if (match === null) {
        return null;
    }
    return [Number(match[1]), Number(match[2]), Number(match[3])];
}
export async function gitVersion(gitBinary = "git") {
    const result = await runGit(process.cwd(), ["--version"], { gitBinary });
    if (!result.ok) {
        return result;
    }
    const version = result.value.stdoutText().trim();
    if (numericVersion(version) === null) {
        return err("config", "git version", "Unable to parse Git version", {
            detected: version,
            required: MINIMUM_GIT_VERSION,
        });
    }
    return ok(version);
}
export function assertMinimumGitVersion(version, required = MINIMUM_GIT_VERSION) {
    const detectedParts = numericVersion(version);
    const requiredParts = numericVersion(required);
    if (detectedParts === null || requiredParts === null) {
        return err("config", "git version", "Git version is unparseable", {
            detected: version,
            required,
        });
    }
    for (let index = 0; index < detectedParts.length; index += 1) {
        const detectedPart = detectedParts[index] ?? 0;
        const requiredPart = requiredParts[index] ?? 0;
        if (detectedPart > requiredPart) {
            return ok(undefined);
        }
        if (detectedPart < requiredPart) {
            return err("config", "git version", "Git version is too old", {
                detected: version,
                required,
            });
        }
    }
    return ok(undefined);
}
/**
 * A conflict style changes what `merge-tree` writes into a conflicted blob, so
 * it changes what was replayed and must change the baseline. Omitting it
 * reproduces the original input byte-for-byte, so corpora produced before this
 * option existed keep their baseline IDs and stay comparable.
 */
export function baselineInput(rawGitVersion, conflictStyle) {
    return JSON.stringify({
        schemaVersion: SCHEMA_VERSION,
        gitVersion: rawGitVersion,
        environmentPolicy: "isolated-v1",
        replayCommand: conflictStyle === undefined
            ? "merge-tree --write-tree --messages -z P1 P2"
            : `-c merge.conflictStyle=${conflictStyle} merge-tree --write-tree --messages -z P1 P2`,
        normalizationVersion: "v1",
    });
}
export function baselineId(rawGitVersion, conflictStyle) {
    return createHash("sha256")
        .update(baselineInput(rawGitVersion, conflictStyle))
        .digest("hex");
}
//# sourceMappingURL=git.js.map