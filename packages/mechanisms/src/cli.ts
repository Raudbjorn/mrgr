import { randomUUID, createHash } from "node:crypto";
import { lstatSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { runMechanism, type Mechanism } from "./adapter.js";

/** Git driver: mechanism %O %A %B %L %P. Git owns attribute selection and outer status. */
export async function main(args = process.argv.slice(2)): Promise<number> {
	let temp: string | undefined, recordPath: string | undefined;
	let committed = false, original: Buffer | undefined, target: string | undefined;
	let record: Record<string, unknown> = { version: "mrgr-driver/1", driverStatus: 130 };
	try {
		if (args.length !== 6 || !["git_text", "gnu_diff3", "mergiraf"].includes(args[0]) || args[4] !== "7" || !args[5]) {
			throw new Error("Usage: mrgr-merge-driver <git_text|gnu_diff3|mergiraf> %O %A %B 7 %P");
		}
		const [mechanism, baseArg, oursArg, theirsArg, , path] = args;
		const [base, ours, theirs] = [baseArg, oursArg, theirsArg].map(p => resolve(p));
		const logDir = process.env.MRGR_MECHANISM_LOG_DIR;
		if (!logDir) throw new Error("MRGR_MECHANISM_LOG_DIR is required for invocation evidence");
		for (const p of [base, ours, theirs]) if (!lstatSync(p).isFile()) throw new Error(`Not a regular input file: ${p}`);
		const preimages = [base, ours, theirs].map(p => readFileSync(p));
		original = preimages[1]; target = ours;
		mkdirSync(logDir, { recursive: true });
		recordPath = join(logDir, `${randomUUID()}.json`);
		// Reserve the log before any mechanism runs; each invocation has its own file.
		writeFileSync(recordPath, JSON.stringify({ ...record, path, state: "started" }) + "\n", { flag: "wx", mode: 0o600 });
		temp = mkdtempSync(join(dirname(ours), ".mrgr-driver-"));
		const staged = join(temp, "ours");
		writeFileSync(staged, preimages[1], { mode: lstatSync(ours).mode });
		const outcome = await runMechanism(mechanism as Mechanism, { base, ours: staged, theirs, path });
		if (!outcome.ok) throw new Error(outcome.error.message);
		const r = outcome.value;
		record = { version: "mrgr-driver/1", path, ...r,
			gitTextRawStatus: mechanism === "git_text" ? r.rawStatus : null,
			gnuDiff3RawStatus: mechanism === "gnu_diff3" ? r.rawStatus : null,
			mergirafRawStatus: mechanism === "mergiraf" ? r.rawStatus : null,
			driverStatus: r.normalizedStatus, state: "prepared",
			inputSha256: preimages.map(b => createHash("sha256").update(b).digest("hex")),
			outputSha256: r.normalizedStatus === 130 ? null : createHash("sha256").update(readFileSync(staged)).digest("hex") };
		// A prepared record records intent, not proof of a completed replacement.
		writeFileSync(recordPath, JSON.stringify(record) + "\n");
		if (r.normalizedStatus !== 130) { renameSync(staged, ours); committed = true; }
		record.state = "completed";
		writeFileSync(recordPath, JSON.stringify(record) + "\n");
		return r.normalizedStatus;
	} catch (cause) {
		record = { ...record, driverStatus: 130, state: "failed", driverError: String(cause) };
		if (committed && temp && target && original) {
			try { const rollback = join(temp, "rollback"); writeFileSync(rollback, original, { mode: lstatSync(target).mode }); renameSync(rollback, target); }
			catch (failure) { record.rollbackError = String(failure); }
		}
		try { if (recordPath) writeFileSync(recordPath, JSON.stringify(record) + "\n"); } catch { /* stderr and outer Git retain failure */ }
		process.stderr.write(JSON.stringify(record) + "\n");
		return 130;
	} finally {
		if (temp) rmSync(temp, { recursive: true, force: true });
	}
}
