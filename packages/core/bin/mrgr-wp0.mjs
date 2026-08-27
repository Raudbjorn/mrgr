#!/usr/bin/env node
// Executable wrapper for the carried WP0 CLI.
//
// cli.ts self-invokes only when process.argv[1] resolves to its own module
// path, which is false when it is imported. The wrapper therefore calls main
// explicitly and maps its return value onto the exit code, preserving the
// module's contract: 0 on success, 1 with a JSON ToolError on stderr.
import { main } from "../dist/evaluation/cli.js";

main(process.argv.slice(2)).then(
	(code) => {
		process.exitCode = code;
	},
	() => {
		process.exitCode = 1;
	},
);
