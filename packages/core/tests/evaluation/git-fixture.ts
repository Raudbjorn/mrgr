import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { runGit } from "../../src/evaluation/git.js";

export type FixtureFiles = Readonly<Record<string, string | Buffer | null>>;

async function git(
	repositoryPath: string,
	args: readonly string[],
): Promise<Buffer> {
	const result = await runGit(repositoryPath, args, { timeoutMs: 30_000 });
	if (!result.ok) {
		throw new Error(`${result.error.operation}: ${result.error.message}`);
	}
	return result.value.stdout;
}

async function applyFiles(
	repositoryPath: string,
	files: FixtureFiles,
): Promise<void> {
	for (const [relativePath, contents] of Object.entries(files)) {
		const absolutePath = join(repositoryPath, relativePath);
		if (contents === null) {
			await rm(absolutePath, { force: true, recursive: true });
			continue;
		}
		await mkdir(dirname(absolutePath), { recursive: true });
		await writeFile(absolutePath, contents);
	}
}

export async function createRepository(
	options: { bare?: boolean; initialBranch?: string } = {},
): Promise<string> {
	const repositoryPath = await mkdtemp(join(tmpdir(), "semantic-merge-git-"));
	const args = options.bare
		? ["init", "--bare"]
		: ["init", "--initial-branch", options.initialBranch ?? "main"];
	await git(repositoryPath, args);
	if (!options.bare) {
		await git(repositoryPath, ["config", "user.name", "WP0 Test"]);
		await git(repositoryPath, ["config", "user.email", "wp0@example.invalid"]);
	}
	return repositoryPath;
}

export async function commitFiles(
	repositoryPath: string,
	files: FixtureFiles,
	message = "fixture commit",
): Promise<string> {
	await applyFiles(repositoryPath, files);
	await git(repositoryPath, ["add", "--all"]);
	await git(repositoryPath, ["commit", "--no-gpg-sign", "-m", message]);
	return (await git(repositoryPath, ["rev-parse", "HEAD"]))
		.toString("utf8")
		.trim();
}

export async function mergeAndResolve(
	repositoryPath: string,
	theirs: string,
	resolution: FixtureFiles,
	message = "fixture merge",
): Promise<string> {
	const merge = await runGit(
		repositoryPath,
		["merge", "--no-commit", "--no-ff", theirs],
		{ acceptedExitCodes: [0, 1], timeoutMs: 30_000 },
	);
	if (!merge.ok) {
		throw new Error(`${merge.error.operation}: ${merge.error.message}`);
	}
	await applyFiles(repositoryPath, resolution);
	await git(repositoryPath, ["add", "--all"]);
	await git(repositoryPath, ["commit", "--no-gpg-sign", "-m", message]);
	return (await git(repositoryPath, ["rev-parse", "HEAD"]))
		.toString("utf8")
		.trim();
}

export async function commitTree(
	repositoryPath: string,
	tree: string,
	parents: readonly string[],
	message = "fixture commit-tree",
): Promise<string> {
	const args = ["commit-tree", tree];
	for (const parent of parents) {
		args.push("-p", parent);
	}
	args.push("-m", message);
	return (await git(repositoryPath, args)).toString("utf8").trim();
}
