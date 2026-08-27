#!/usr/bin/env node
// Executable wrapper for the M1a evidence extractor.
//
// A separate entrypoint from mrgr-wp0 on purpose: evaluation/cli.ts is a
// carried file under scripts/verify-carried.sh, and adding a subcommand there
// would put the carried set into churn for a feature its own phase plan calls
// partial.
import { main } from "../dist/m1a/cli.js";

main(process.argv.slice(2)).then(
	(code) => {
		process.exitCode = code;
	},
	() => {
		process.exitCode = 1;
	},
);
