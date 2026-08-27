// Public library surface for @mrgr/core.
//
// Every module below is carried verbatim from the WP0 merge-forensics
// instrument. This barrel is additive: it names what was already exported and
// changes no behaviour. See docs/adr/00-scope-and-verdict.md for the claim
// boundary these modules stay inside — they collect, replay, localize and
// classify. They do not adjudicate.

export * from "./evaluation/result.js";
export * from "./evaluation/types.js";
export * from "./evaluation/git.js";
export * from "./evaluation/acquire.js";
export * from "./evaluation/replay.js";
export * from "./evaluation/localize.js";
export * from "./evaluation/classify.js";
export * from "./evaluation/corpus.js";
export * from "./evaluation/materialize.js";
export * from "./evaluation/report.js";
export * from "./evaluation/pool.js";

// The CLI entrypoint is exported for programmatic drivers. `main` takes an
// injected CliIo, which is the seam the agent surface wraps; importing this
// module does not run it (cli.ts guards on process.argv[1]).
export { main, type CliIo } from "./evaluation/cli.js";
