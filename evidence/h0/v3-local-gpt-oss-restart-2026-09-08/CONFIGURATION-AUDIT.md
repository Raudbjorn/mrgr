# Configuration-pack audit — 2026-09-08

Read-only comparison with the supplied pack description; its ZIP and helper implementations were not available in Downloads. No claim that its reported tests were independently verified. No running source, request, oracle, service or template was changed.

Two verified mismatches with the intended fixed high-effort run:

- The exact archived request renders `Reasoning: medium`. Adding `chat_template_kwargs: {reasoning_effort: high}` renders `Reasoning: high`. The local source's apply-template endpoint calls the same oaicompat_chat_params_parse used for chat requests. Top-level requested effort was previously mistaken for effective effort. This run must not be reported as high-effort evidence.
- The live template contains `strftime_now("%Y-%m-%d")`. A frozen template hash does not freeze its rendered date. A run spanning midnight can therefore change its model input while passing the current template-identity checks. Freeze the recognized date expression and audit rendered bytes in any corrective successor.

Useful pack additions: rendered-prompt effort assertions; full tokenization/capacity audit with 256-token reserve; explicit effective sampler/caching policy; immutable rendered date; shared-library/backend provenance; usage validation; detailed error taxonomy; persistent infrastructure missingness bounds. Adopt these through a separately identified successor, retaining the present run and raw receipts rather than relabeling it.

Changes requiring explicit protocol versioning rather than mechanical adoption: seeded requests (current requests use no fixed seed), reduced sampler list, prompt caching disabled, new deadlines, infrastructure retry allowance, duplicate-key rejection, different uncertainty estimator, and any oracle environment/build/test changes. The old/current outputs remain descriptive unless comparable scoring can be demonstrated from archived raw data. Unknown historical source commit must remain unknown; do not substitute upstream HEAD or another checkout's revision for build b1-1717187.

Existing protections already cover isolated snapshots, unshared network, fresh sandbox tmpfs and cache, GOPROXY=off, pinned vendor/GOPATH recipes, external 120-second command timeout, cleanup in finally, raw receipts, candidate hashes, three passing references and two rejected compiling mutations per case. Go tests are compiled with go test -c and the test binary is executed directly, so successful go test result caching is not the execution path. New go-test defaults must not silently replace that oracle.

Keep V=f16 and native termination. V=q8_0 previously failed on this configuration's non-FA path. Stopping on Harmony end/start tokens would cut reasoning off before final output. The pack correctly retracts that earlier proposal. No model or GPU workload was added by this audit.
