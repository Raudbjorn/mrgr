import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, expect, test } from "vitest";

const driver = fileURLToPath(new URL("../bin/mrgr-merge-driver.mjs", import.meta.url));
const roots: string[] = [];
const quote = (s: string) => `'${s.replaceAll("'", "'\\''")}'`;
const stamp = "2026-09-06T00:00:00Z";
const evidence = process.env.MRGR_M2A_EVIDENCE_DIR;
const base = "fn first() -> i32 { 1 }\n\n// stable separator one\n// stable separator two\n\nfn last() -> i32 { 2 }\n";
const ours = base.replace("{ 1 }", "{ 10 }");
const theirs = base.replace("{ 2 }", "{ 20 }");
const merged = ours.replace("{ 2 }", "{ 20 }");
const conflict = (n: number) => `fn one() -> i32 { ${n} }\n\n// stable one\n// stable two\n\nfn two() -> i32 { ${n} }\n`;

afterEach(() => { for (const p of roots.splice(0)) rmSync(p, { recursive: true, force: true }); });

function fixture(mechanism: string, kind: "clean" | "binary-first" | "binary-last") {
	const root = mkdtempSync(join(tmpdir(), "mrgr-driver-proof-")); roots.push(root);
	const repo = join(root, "repo"), logs = join(root, "logs"); mkdirSync(repo); mkdirSync(logs);
	const env: NodeJS.ProcessEnv = { ...process.env, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null", GIT_AUTHOR_DATE: stamp,
		GIT_COMMITTER_DATE: stamp, MRGR_MECHANISM_LOG_DIR: logs };
	const command = (...args: string[]) => spawnSync("git", args, { cwd: repo, encoding: "utf8", env });
	const git = (...args: string[]) => { const r = command(...args); if (r.status !== 0) throw Error(`${args}: ${r.stderr}`); return r.stdout.trim(); };
	git("init", "-q", "--initial-branch=base"); git("config", "user.name", "mrgr fixture"); git("config", "user.email", "fixture@example.invalid");
	git("config", "core.autocrlf", "false"); git("config", "commit.gpgSign", "false"); git("config", "merge.conflictStyle", "diff3");
	const text = kind === "binary-first" ? "z resolved ' $(touch INJECTED).rs" : "a resolved ' $(touch INJECTED).rs";
	const binary = kind === "binary-first" ? "a-asset.bin" : "z-asset.bin";
	writeFileSync(join(repo, ".gitattributes"), `*.rs merge=${mechanism} conflict-marker-size=7\n*.bin -text -diff merge=binary\n`);
	const commit = (label: string, content: string, conflicting: string, blob: number) => {
		writeFileSync(join(repo, text), content);
		if (kind !== "clean") { writeFileSync(join(repo, "m-conflict.rs"), conflicting); writeFileSync(join(repo, binary), Buffer.from([0, blob, 255])); }
		git("add", "."); git("commit", "-qm", label); return git("rev-parse", "HEAD");
	};
	const b = commit("base", base, conflict(0), 0);
	git("checkout", "-qb", "ours"); const o = commit("ours", ours, conflict(1), 1);
	git("checkout", "-qb", "theirs", b); const t = commit("theirs", theirs, conflict(2), 2);
	git("checkout", "-q", "ours");
	git("config", `merge.${mechanism}.driver`, `${quote(process.execPath)} ${quote(driver)} ${mechanism} %O %A %B %L %P`);
	git("config", `merge.${mechanism}.recursive`, "binary");
	const records = () => readdirSync(logs).map(f => JSON.parse(readFileSync(join(logs, f), "utf8")));
	const clearLogs = () => { for (const f of readdirSync(logs)) rmSync(join(logs, f)); };
	return { root, repo, logs, env, git, command, records, clearLogs, text, binary, b, o, t };
}

for (const mechanism of ["git_text", "gnu_diff3", "mergiraf"]) {
	for (const kind of ["clean", "binary-first", "binary-last"] as const) {
		test(`${mechanism}: real Git ${kind}, five identical returned trees and preserved residue`, () => {
			// Required here: CI installs the pinned binary; absence must fail this gate, not skip.
			if (mechanism === "mergiraf") expect(execFileSync(process.env.MERGIRAF_BIN ?? "mergiraf", ["--version"], { encoding: "utf8" }).trim()).toBe("mergiraf 0.19.0");
			const f = fixture(mechanism, kind), trees: string[] = [], runs: unknown[] = [];
			writeFileSync(join(f.repo, ".git/info/attributes"), "*.rs merge=text\n");
			const baseline = f.command("merge-tree", "--write-tree", "--name-only", "ours", "theirs");
			rmSync(join(f.repo, ".git/info/attributes"));
			for (let i = 0; i < 5; i++) {
				f.clearLogs();
				const r = f.command("merge-tree", "--write-tree", "--name-only", "ours", "theirs");
				expect(r.status).toBe(kind === "clean" ? 0 : 1);
				const tree = r.stdout.split("\n")[0]; expect(tree).toMatch(/^[a-f0-9]{40}$/); trees.push(tree);
				expect(execFileSync("git", ["show", `${tree}:${f.text}`], { cwd: f.repo, encoding: "utf8" })).toBe(merged);
				const invocations = f.records(); expect(invocations).toHaveLength(kind === "clean" ? 1 : 2);
				for (const record of invocations) {
					expect(record.state).toBe("completed"); expect(record.error).toBeNull(); expect(record.signal).toBeNull();
					expect(record.driverStatus).toBe(record.path === f.text ? 0 : 1);
					expect(record.gitTextRawStatus).toBe(mechanism === "git_text" ? (record.path === f.text ? 0 : 2) : null);
					expect(record.mergirafRawStatus).toBe(mechanism === "mergiraf" ? record.rawStatus : null);
				}
				const residue = kind === "clean" ? [] : [f.binary, "m-conflict.rs"];
				if (kind === "clean") expect(tree).toBe(baseline.stdout.split("\n")[0]);
				else {
					expect(execFileSync("git", ["show", `${tree}:${f.binary}`], { cwd: f.repo })).toEqual(Buffer.from([0, 1, 255]));
					expect(f.git("show", `${tree}:m-conflict.rs`)).toContain("<<<<<<< OURS");
					expect(invocations.some(r => r.path === f.binary)).toBe(false);
					expect(r.stdout).toContain(f.binary); expect(r.stdout).toContain("m-conflict.rs");
				}
				runs.push({ outerGitStatus: r.status, tree, stdout: r.stdout, stderr: r.stderr, invocations,
					residue, binaryFallback: kind === "clean" ? null : { path: f.binary, attribute: "merge=binary", invokedTextMechanism: false, retained: "ours", unresolved: true } });
				if (evidence) {
					const commit = execFileSync("git", ["commit-tree", tree, "-p", f.o, "-p", f.t, "-m", "synthetic mechanism result; residue may remain"], { cwd: f.repo, env: f.env, encoding: "utf8" }).trim();
					f.git("update-ref", `refs/mrgr-evidence/run-${i}`, commit);
				}
			}
			expect(new Set(trees).size).toBe(1);
			// Also exercise the working-tree/index integration, not just merge-tree plumbing.
			f.clearLogs(); const work = f.command("merge", "--no-commit", "--no-ff", "theirs");
			expect(work.status).toBe(kind === "clean" ? 0 : 1);
			expect(readFileSync(join(f.repo, f.text), "utf8")).toBe(merged);
			expect(f.git("ls-files", "--stage", "--", f.text)).toMatch(/ 0\t/);
			if (kind !== "clean") { expect(readFileSync(join(f.repo, f.binary))).toEqual(Buffer.from([0, 1, 255])); expect(f.git("ls-files", "-u", "--", f.binary).split("\n")).toHaveLength(3); }
			expect(readdirSync(f.repo)).not.toContain("INJECTED");
			if (evidence) {
				mkdirSync(evidence, { recursive: true }); const name = `${mechanism}-${kind}`;
				if (existsSync(join(evidence, `${name}.json`)) || existsSync(join(evidence, `${name}.bundle`))) throw Error(`Refusing to overwrite frozen evidence: ${name}`);
			f.git("bundle", "create", resolve(evidence, `${name}.bundle`), "--all");
				writeFileSync(join(evidence, `${name}.json`), JSON.stringify({ mechanism, kind, refs: { base: f.b, ours: f.o, theirs: f.t }, textPath: f.text,
					baseline: { outerGitStatus: baseline.status, stdout: baseline.stdout, stderr: baseline.stderr }, runs,
					workingMerge: { outerGitStatus: work.status, stdout: work.stdout, stderr: work.stderr, index: f.git("ls-files", "--stage"), invocations: f.records() } }, null, 2) + "\n", { flag: "wx" });
			}
		}, 30_000);
	}
}

test("driver rejects invalid contracts, unavailable engines and unwritable logs without changing ours", () => {
	const f = fixture("mergiraf", "clean"), dir = join(f.root, "inputs"); mkdirSync(dir);
	const files = ["base", "ours", "theirs"].map((n, i) => { const p = join(dir, n); writeFileSync(p, [base, ours, theirs][i]); return p; });
	const invoke = (args: string[], env = f.env) => spawnSync(process.execPath, [driver, ...args], { env, encoding: "utf8" });
	for (const args of [[], ["bogus", ...files, "7", "file.rs"], ["mergiraf", ...files, "9", "file.rs"]]) expect(invoke(args).status).toBe(130);
	const missing = invoke(["mergiraf", ...files, "7", "file.rs"], { ...f.env, MERGIRAF_BIN: join(f.root, "missing") });
	expect(missing.status).toBe(130); expect(readFileSync(files[1], "utf8")).toBe(ours);
	const record = f.records().find(r => r.state === "completed"); expect(record.rawStatus).toBeNull(); expect(record.driverStatus).toBe(130); expect(record.error).toContain("ENOENT");
	expect(invoke(["git_text", ...files, "7", "file.rs"], { ...f.env, MRGR_MECHANISM_LOG_DIR: files[0] }).status).toBe(130);
	expect(readFileSync(files[1], "utf8")).toBe(ours);
});

test("outer Git reports a fatal engine failure separately from unresolved residue", () => {
	const f = fixture("mergiraf", "binary-first"); f.env.MERGIRAF_BIN = join(f.root, "missing-mergiraf");
	const r = f.command("merge-tree", "--write-tree", "--name-only", "ours", "theirs");
	expect(r.status).not.toBe(0); expect(r.status).not.toBe(1);
	expect(r.stdout.split("\n")[0]).not.toMatch(/^[a-f0-9]{40}$/);
	const records = f.records(); expect(records.length).toBeGreaterThan(0);
	for (const record of records) { expect(record.rawStatus).toBeNull(); expect(record.driverStatus).toBe(130); }
	expect(readFileSync(join(f.repo, f.text), "utf8")).toBe(ours);
	if (evidence) writeFileSync(join(evidence, "fatal-engine.json"), JSON.stringify({ outerGitStatus: r.status, stdout: r.stdout, stderr: r.stderr, usableTree: null, invocations: records }, null, 2) + "\n", { flag: "wx" });
});
