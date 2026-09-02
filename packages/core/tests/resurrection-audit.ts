import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

export interface DeletedMonolithCandidate {
	path: string;
	size: number;
}

interface TreeEntry {
	path: string;
	size: number;
}

function listTree(cwd: string, ref: string): TreeEntry[] {
	const out = execFileSync("git", ["ls-tree", "-r", "--long", ref], {
		cwd,
		encoding: "utf8",
		maxBuffer: 64 * 1024 * 1024,
	});
	return out
		.split("\n")
		.filter((line) => line.length > 0)
		.map((line) => {
			const tab = line.indexOf("\t");
			const path = line.slice(tab + 1);
			const size = Number(line.slice(0, tab).trim().split(/\s+/)[3]);
			return { path, size };
		});
}

/**
 * Derives candidate deleted files by comparing what exists across the
 * reconstruction-input refs against what exists across the final refs — not
 * by inspecting a single ref in isolation. A file that appears in any input
 * ref but in none of the final refs is a resurrection candidate; a file
 * present in both is never flagged, no matter which refs it appears in.
 */
export function findDeletedMonolithCandidates(
	cwd: string,
	inputRefs: string[],
	finalRefs: string[],
	pathPattern: RegExp,
): DeletedMonolithCandidate[] {
	const inputEntries = new Map<string, number>();
	for (const ref of inputRefs) {
		for (const entry of listTree(cwd, ref)) inputEntries.set(entry.path, entry.size);
	}

	const finalPaths = new Set<string>();
	for (const ref of finalRefs) {
		for (const entry of listTree(cwd, ref)) finalPaths.add(entry.path);
	}

	const candidates: DeletedMonolithCandidate[] = [];
	for (const [path, size] of inputEntries) {
		if (finalPaths.has(path)) continue;
		// A `g` or `y` flagged pattern advances lastIndex on a match and
		// carries it between calls on the same RegExp instance — reset it so
		// every path is tested independently, not just the first match.
		pathPattern.lastIndex = 0;
		if (!pathPattern.test(path)) continue;
		candidates.push({ path, size });
	}
	return candidates.sort((a, b) => a.path.localeCompare(b.path));
}

export interface SyntheticTopology {
	inputs: Record<string, Record<string, string>>;
	finals: Record<string, Record<string, string>>;
}

export interface SyntheticRepo {
	repositoryPath: string;
	inputRefs: string[];
	finalRefs: string[];
}

async function commitBranch(
	repositoryPath: string,
	branchName: string,
	files: Record<string, string>,
): Promise<void> {
	execFileSync("git", ["checkout", "--orphan", branchName], { cwd: repositoryPath, stdio: "ignore" });
	execFileSync("git", ["rm", "-rf", "--ignore-unmatch", "--quiet", "."], { cwd: repositoryPath });
	for (const [relativePath, content] of Object.entries(files)) {
		const absolutePath = join(repositoryPath, relativePath);
		await mkdir(dirname(absolutePath), { recursive: true });
		await writeFile(absolutePath, content);
	}
	execFileSync("git", ["add", "--all"], { cwd: repositoryPath });
	execFileSync("git", ["commit", "--no-gpg-sign", "-q", "-m", branchName], { cwd: repositoryPath });
}

/**
 * Builds a tiny, disposable git repository reproducing the resurrection
 * proof's topology (N input branches, M final branches) from a declarative
 * spec, so the audit algorithm can be proven without depending on any real,
 * private reconstruction data.
 */
export async function buildSyntheticTopology(topology: SyntheticTopology): Promise<SyntheticRepo> {
	const repositoryPath = await mkdtemp(join(tmpdir(), "mrgr-resurrection-topology-"));
	execFileSync("git", ["init", "-q"], { cwd: repositoryPath });
	execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: repositoryPath });
	execFileSync("git", ["config", "user.name", "test"], { cwd: repositoryPath });

	const inputRefs: string[] = [];
	for (const [name, files] of Object.entries(topology.inputs)) {
		await commitBranch(repositoryPath, name, files);
		inputRefs.push(name);
	}

	const finalRefs: string[] = [];
	for (const [name, files] of Object.entries(topology.finals)) {
		await commitBranch(repositoryPath, name, files);
		finalRefs.push(name);
	}

	return { repositoryPath, inputRefs, finalRefs };
}
