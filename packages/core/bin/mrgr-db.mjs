#!/usr/bin/env node
// Executable wrapper for the mrgr-db workspace database CLI.
import { main } from "../dist/db/cli.js";

main(process.argv.slice(2)).then(
	(code) => {
		process.exitCode = code;
	},
	() => {
		process.exitCode = 1;
	},
);
