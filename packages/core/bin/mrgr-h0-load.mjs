#!/usr/bin/env node
// Executable wrapper for the mrgr-h0-load materialized-triples loader.
import { main } from "../dist/m1a/h0-load.js";

main(process.argv.slice(2)).then(
	(code) => {
		process.exitCode = code;
	},
	(error) => {
		console.error(error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
	},
);
