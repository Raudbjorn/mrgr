import { spawnSync } from "node:child_process";
import { readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { err, ok, type Result } from "@mrgr/core";

export type Mechanism = "git_text" | "gnu_diff3" | "mergiraf";

export interface MechanismInput {
	base: string;
	ours: string;
	theirs: string;
	path: string;
}

export interface MechanismResult {
	mechanism: Mechanism;
	rawStatus: number;
	normalizedStatus: 0 | 1 | 130;
	durationMs: number;
	hasConflictMarkers: boolean;
}

const CONFLICT_MARKER_LINE = "<<<<<<< OURS";

function hasConflictMarkerLine(content: string): boolean {
	return content.split("\n").some((line) => line === CONFLICT_MARKER_LINE);
}

function runGitText(input: MechanismInput): { rawStatus: number; content: string } {
	const result = spawnSync(
		"git",
		["merge-file", "--stdout", "--diff3", "-L", "OURS", "-L", "BASE", "-L", "THEIRS", input.ours, input.base, input.theirs],
		{ encoding: "buffer" },
	);
	const rawStatus = result.status ?? 130;
	return { rawStatus, content: result.stdout.toString("utf8") };
}

function runGnuDiff3(input: MechanismInput): { rawStatus: number; content: string } {
	const result = spawnSync(
		"diff3",
		["-m", "-A", "-L", "OURS", "-L", "BASE", "-L", "THEIRS", input.ours, input.base, input.theirs],
		{ encoding: "buffer" },
	);
	const rawStatus = result.status ?? 130;
	return { rawStatus, content: result.stdout.toString("utf8") };
}

function runMergiraf(input: MechanismInput): { rawStatus: number; content: string } {
	const out = join(dirname(input.ours), `.mrgr-mergiraf-out.${process.pid}.${Date.now()}`);
	const result = spawnSync(
		process.env.MERGIRAF_BIN ?? "mergiraf",
		[
			"merge",
			"-o", out,
			input.base, input.ours, input.theirs,
			"-s", "BASE",
			"-x", "OURS",
			"-y", "THEIRS",
			"-p", input.path,
			"-l", "7",
			"-t", "0",
		],
		{ encoding: "buffer" },
	);
	const rawStatus = result.status ?? 130;
	let content = "";
	try {
		content = readFileSync(out, "utf8");
	} catch {
		content = "";
	} finally {
		rmSync(out, { force: true });
	}
	return { rawStatus, content };
}

function isAccepted(mechanism: Mechanism, rawStatus: number): boolean {
	if (mechanism === "git_text") return rawStatus >= 0 && rawStatus <= 127;
	return rawStatus === 0 || rawStatus === 1;
}

export async function runMechanism(mechanism: Mechanism, input: MechanismInput): Promise<Result<MechanismResult>> {
	const startNs = process.hrtime.bigint();

	let rawStatus: number;
	let content: string;
	switch (mechanism) {
		case "git_text": {
			const run = runGitText(input);
			rawStatus = run.rawStatus;
			content = run.content;
			break;
		}
		case "gnu_diff3": {
			const run = runGnuDiff3(input);
			rawStatus = run.rawStatus;
			content = run.content;
			break;
		}
		case "mergiraf": {
			const run = runMergiraf(input);
			rawStatus = run.rawStatus;
			content = run.content;
			break;
		}
		default:
			return err("unsupported", "run-mechanism", `mechanism not yet implemented: ${mechanism}`, { mechanism });
	}

	const durationMs = Number((process.hrtime.bigint() - startNs) / 1_000_000n);
	const accepted = isAccepted(mechanism, rawStatus);

	if (!accepted) {
		return ok({ mechanism, rawStatus, normalizedStatus: 130, durationMs, hasConflictMarkers: false });
	}

	const hasConflictMarkers = hasConflictMarkerLine(content);
	const normalizedStatus: 0 | 1 = hasConflictMarkers ? 1 : rawStatus === 0 ? 0 : 1;

	const tmp = join(dirname(input.ours), `.mrgr-mechanism-driver.${process.pid}.${Date.now()}`);
	writeFileSync(tmp, content);
	renameSync(tmp, input.ours);

	return ok({ mechanism, rawStatus, normalizedStatus, durationMs, hasConflictMarkers });
}
