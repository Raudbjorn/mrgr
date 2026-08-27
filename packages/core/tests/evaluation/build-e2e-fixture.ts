import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { runGit } from "../../src/evaluation/git.js";
import {
	commitFiles,
	createRepository,
	mergeAndResolve,
} from "./git-fixture.js";

async function git(
	repositoryPath: string,
	args: readonly string[],
): Promise<string> {
	const result = await runGit(repositoryPath, args, { timeoutMs: 30_000 });
	if (!result.ok)
		throw new Error(`${result.error.operation}: ${result.error.message}`);
	return result.value.stdoutText().trim();
}

export async function buildE2eFixture(
	outputDirectory: string,
): Promise<string> {
	const target = resolve(outputDirectory);
	await rm(target, { recursive: true, force: true });
	const repositoryPath = await createRepository();
	await git(repositoryPath, ["config", "merge.conflictStyle", "diff3"]);
	await commitFiles(
		repositoryPath,
		{
			"clean-main.txt": "base\n",
			"clean-side.txt": "base\n",
			"ours-conflict.txt":
				"shared\nbase choice\nmiddle\nline four\nfar base\nend\n",
			"novel-conflict.txt": "base choice\n",
		},
		"initial fixture",
	);

	await git(repositoryPath, ["switch", "-c", "clean-side"]);
	await commitFiles(
		repositoryPath,
		{ "clean-side.txt": "side change\n" },
		"clean side",
	);
	await git(repositoryPath, ["switch", "main"]);
	await commitFiles(
		repositoryPath,
		{ "clean-main.txt": "main change\n" },
		"clean main",
	);
	await mergeAndResolve(repositoryPath, "clean-side", {}, "clean merge");

	await git(repositoryPath, ["switch", "-c", "ours-side"]);
	await commitFiles(
		repositoryPath,
		{
			"ours-conflict.txt":
				"shared\ntheirs choice\nmiddle\nline four\nfar theirs\nend\n",
		},
		"ours side",
	);
	await git(repositoryPath, ["switch", "main"]);
	await commitFiles(
		repositoryPath,
		{
			"ours-conflict.txt":
				"shared\nours choice\nmiddle\nline four\nfar base\nend\n",
		},
		"ours main",
	);
	await mergeAndResolve(
		repositoryPath,
		"ours-side",
		{
			"ours-conflict.txt":
				"shared\nours choice\nmiddle\nline four\nfar theirs\nend\n",
		},
		"resolve to ours",
	);

	await git(repositoryPath, ["switch", "-c", "novel-side"]);
	await commitFiles(
		repositoryPath,
		{ "novel-conflict.txt": "theirs choice\n" },
		"novel side",
	);
	await git(repositoryPath, ["switch", "main"]);
	await commitFiles(
		repositoryPath,
		{ "novel-conflict.txt": "ours choice\n" },
		"novel main",
	);
	await mergeAndResolve(
		repositoryPath,
		"novel-side",
		{
			"novel-conflict.txt": "genuinely novel choice\n",
		},
		"resolve novel",
	);

	const mergeCount = await git(repositoryPath, [
		"rev-list",
		"--all",
		"--min-parents=2",
		"--max-parents=2",
		"--count",
	]);
	if (mergeCount !== "3")
		throw new Error(
			`fixture must contain exactly three two-parent merges, got ${mergeCount}`,
		);
	await rm(target, { recursive: true, force: true });
	await git(process.cwd(), ["clone", "--no-local", repositoryPath, target]);
	await rm(repositoryPath, { recursive: true, force: true });
	await git(target, ["config", "merge.conflictStyle", "diff3"]);
	return target;
}

const invokedPath =
	process.argv[1] === undefined ? "" : resolve(process.argv[1]);
if (invokedPath === fileURLToPath(import.meta.url)) {
	const outputDirectory = process.argv[2];
	if (outputDirectory === undefined || process.argv.length !== 3) {
		process.stderr.write(
			"usage: tsx tests/evaluation/build-e2e-fixture.ts OUTPUT_DIRECTORY\n",
		);
		process.exitCode = 2;
	} else {
		buildE2eFixture(outputDirectory).catch((cause: unknown) => {
			process.stderr.write(
				`${cause instanceof Error ? cause.message : String(cause)}\n`,
			);
			process.exitCode = 1;
		});
	}
}
