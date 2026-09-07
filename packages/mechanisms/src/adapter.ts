import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { err, ok, type Result } from "./result.js";

export type Mechanism = "git_text" | "gnu_diff3" | "mergiraf";
export interface MechanismInput { base: string; ours: string; theirs: string; path: string }
export interface MechanismResult {
	mechanism: Mechanism;
	/** Actual exit code; null when no exit code was obtained. Never a synthetic 130. */
	rawStatus: number | null;
	signal: string | null;
	error: string | null;
	stderr: string;
	normalizedStatus: 0 | 1 | 130;
	durationMs: number;
	hasConflictMarkers: boolean;
}

export async function runMechanism(mechanism: Mechanism, input: MechanismInput): Promise<Result<MechanismResult>> {
	if (!["git_text", "gnu_diff3", "mergiraf"].includes(mechanism)) {
		return err("unsupported", "run-mechanism", `mechanism not yet implemented: ${mechanism}`, { mechanism });
	}
	const start = process.hrtime.bigint();
	let rawStatus: number | null = null, signal: string | null = null, error: string | null = null;
	let stderr = "";
	let normalizedStatus: 0 | 1 | 130 = 130, hasConflictMarkers = false, temp: string | undefined;
	try {
		// Private, same-filesystem staging avoids collisions and preserves arbitrary output bytes.
		temp = mkdtempSync(join(dirname(resolve(input.ours)), ".mrgr-mechanism-"));
		const output = join(temp, "output");
		const base = resolve(input.base), ours = resolve(input.ours), theirs = resolve(input.theirs);
		const mode = statSync(ours).mode;
		const labels = ["-L", "OURS", "-L", "BASE", "-L", "THEIRS"];
		const command = mechanism === "git_text" ? "git" : mechanism === "gnu_diff3" ? "diff3" : process.env.MERGIRAF_BIN ?? "mergiraf";
		const args = mechanism === "git_text" ? ["merge-file", "--stdout", "--diff3", ...labels, ours, base, theirs]
			: mechanism === "gnu_diff3" ? ["-m", "-A", ...labels, ours, base, theirs]
			: ["merge", "-o", output, base, ours, theirs, "-s", "BASE", "-x", "OURS", "-y", "THEIRS", "-p", input.path, "-l", "7", "-t", "0"];
		const override = Number(process.env.MRGR_MECHANISM_TIMEOUT_MS);
		const timeout = Number.isSafeInteger(override) && override > 0 ? override : 30_000;
		const result = spawnSync(command, args, { encoding: "buffer", timeout, maxBuffer: 16 * 1024 * 1024 });
		rawStatus = result.status;
		stderr = result.stderr?.toString("utf8") ?? "";
		signal = result.signal;
		error = result.error?.message ?? null;
		const accepted = !error && !signal && rawStatus !== null && (mechanism === "git_text"
			? rawStatus >= 0 && rawStatus <= 127 : rawStatus === 0 || rawStatus === 1);
		if (accepted) {
			// A missing Mergiraf output is an I/O failure, not a replacement raw engine status.
			const content = mechanism === "mergiraf" ? readFileSync(output) : result.stdout;
			hasConflictMarkers = content.toString("utf8").split("\n").includes("<<<<<<< OURS");
			writeFileSync(output, content, { mode });
			chmodSync(output, mode);
			renameSync(output, ours);
			normalizedStatus = hasConflictMarkers || rawStatus !== 0 ? 1 : 0;
		}
	} catch (cause) {
		error = cause instanceof Error ? cause.message : String(cause);
	} finally {
		if (temp) rmSync(temp, { recursive: true, force: true });
	}
	return ok({ mechanism, rawStatus, signal, error, stderr, normalizedStatus, hasConflictMarkers,
		durationMs: Number((process.hrtime.bigint() - start) / 1_000_000n) });
}
