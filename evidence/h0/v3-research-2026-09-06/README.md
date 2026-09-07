# Phase 3 v3: behavioral evidence utility

The new instrument tests dependency-selected evidence within **both Mercury-2 and MiniMax-M3**. Historical v2 results remain unchanged. This directory records the implemented design and its limits; the active pilots are [Go](../v3-2026-09-06c/README.md) and [C](../v3-2026-09-06d/README.md). The pilot cannot set MEASURABLE=YES: it is explicitly feasibility evidence, not the required 60-case development study or a confirmation cohort.

## Observed pilot results

The two completed feasibility matrices contain 12 requests, no 429 responses, one halt and one truncated answer. Across these two deliberately selected cases, Mercury passes 1/2 with both selected and hunk-only; MiniMax passes 2/2 with both. Neither model passes a local-context case. Selected context therefore does not outperform hunk-only in this pilot. Estimated total token cost is $0.1062; this is not a billing receipt. No inferential claim is made from two cases.

Both archived instruments reproduce byte-identical aggregates. See [machine summary](pilot-summary.json), [verification receipt](verification.json) and [repository tests](tests.log). The delivered code passes 348 tests, typecheck, build and the 24-file carried-source check. More validated cases are required before the frozen development and confirmation procedures can run.

## Acquired evidence

[ConGra acquisition](../v3-acquisition-2026-09-06/README.md) preserves a checksum-verified 2,370,920,171-byte archive, 11,051 provisional commit mappings and original-Git spot checks. The archive has 11,234 raw case directories. Neither these directories nor the paper's 44,948 conflicts are counts of independent, executable trials. 183 raw cases lack project maps. ConGra has 11 directly mapped C-project labels, below the 12-cluster confirmation threshold before adding independent sources or validating historical environments.

[Behavioral feasibility](../v3-behavior-2026-09-06/README.md) supplies two fresh C/Go cases. References pass repeated tests, and compiling behavior-changing mutations fail. The C tests come unchanged from the parents. The Go oracle adds parent-derived registration assertions and runs existing common-scaffold regressions; not all regression files predate the merge. These are finite checks with a documented behavioral contract.

The common scaffold uses the historical merge outside the focal slot. It is evaluator-only context. Thus the claim is focal-conflict utility conditional on that scaffold, not autonomous whole-merge correctness. The v3 runner independently reconstructs each conflict from actual Git base/parent blobs using the existing exact localizer, checks the reference and byte range, and verifies every tracked scaffold file against the merge. This includes preserving Git symlink objects; an early feasibility copy had dereferenced test-fixture links and was corrected before the active pilot.

## Implemented experiment

The runnable entrypoints are [v3.mjs](../v3.mjs), [retrieval/evaluation](../v3-data.mjs) and [design simulation](../v3-design.mjs).

- Three arms per model: hunk-only, local-context and dependency-selected. Expanded arms have the same 32 KiB source budget, not necessarily equal realized lengths or model tokens. Retrieval uses pinned Tree-sitter C/Go parsers, enclosing declarations and identifier-based declaration/caller/test candidates, from parent snapshots only. It records ambiguity and parse-error ranges; it is not a semantic name resolver or a full program graph.
- Raw JSON completion contract, explicit halt, one answer per scheduled cell. Mercury uses high reasoning, temperature 0.75 and 8,192 output tokens. MiniMax uses adaptive thinking, reasoning_split, temperature 0.75 and 16,384 completion tokens. One predefined doubling is available only after complete 60-case development shows more than 5% truncation, then development is rerun and frozen.
- Credentials come from the supplied environment variables or credential helpers into runner memory. There is no dollar cap. One request per provider is in flight; each provider stops dispatching at its first 429. A completed fixed matrix also stops. 429 leaves pending cells and cannot produce a positive result. Restarting the command resumes pending work; interrupted requests of unknown outcome are recorded as failures, not invisibly retried.
- All deterministic baselines are concrete candidates. Git text, diff3 and Mergiraf receive the identical common scaffold with the focal base/ours/theirs substituted. They are **scaffold-conditioned mechanism baselines**, not rates for whole original fork merges. They cannot be penalized for unrelated unresolved conflicts. Engine/infrastructure errors invalidate the study; honest unresolved outputs count as abstentions.
- Every candidate is applied only to the focal byte range. Build and test run through Bubblewrap with separate namespaces, no network, no credentials, read-only system tools and read-only oracle input. Successful test exit also requires recorded completion patterns/counts. A premature-success-exit C mutation is included in admission. Completion checks reduce simple premature-exit false passes; they do not make arbitrary test suites ungameable.
- References pass three times; at least two compiling wrong candidates must fail the tests. Failed admissions remain in the exclusion ledger. Raw requests, responses, finish reasons, test stages and candidate hashes are retained. Offline aggregation reparses responses and validates cached stage/completion evidence.

### Freeze and statistical rules

Use 60 fresh, validated development cases. Confirmation sizes are 400, 800, 1,200, 1,600 or 2,000, at least 12 verified repository-lineage clusters and at most 15% from any cluster. Sampling excludes exposed merges, duplicate focal content and shared reconstruction parents. GitHub source-repository metadata prevents counting fork names or case variants as separate clusters; undetected older shared-history dependence remains a limitation.

The design simulator applies the joint decision to synthetic paired outcomes, using development nuisance estimates, a prespecified 10pp gain scenario, 10,000 cluster-bootstrap resamples and 200 simulation trials. It selects the smallest feasible sample whose lower 95% Wilson bound on simulated joint power is at least 80%. The actual selected IDs and cluster allocation are frozen. Sensitivities use 5pp gain and stronger repository-effect variation. These are planning assumptions, not observed gains or guarantees. If no eligible cohort exists, no confirmation is authorized by the instrument.

For **both models separately**, selected evidence must improve behavioral pass yield by at least 5pp versus both model controls and have paired repository-clustered 95% intervals above zero. It must also beat all deterministic baselines with intervals above zero. Every condition is required; there is no best-model or best-subgroup substitution. A significant five-point observed gain does not establish that the population gain exceeds five points.

Coverage, failed-output risk, invalid/truncated outputs, historical agreement and token cost are separate fields. Transport failures remain in the scheduled denominator; over 5% in any arm invalidates the run. Always-halt has zero coverage and undefined conditional risk.

## Reproduction and platform limits

```sh
pnpm build
node --test evidence/h0/v3.test.mjs
node evidence/h0/v3.mjs prepare /absolute/cases.json /absolute/NEW-RUN feasibility
node evidence/h0/v3.mjs run /absolute/NEW-RUN
node evidence/h0/v3.mjs aggregate /absolute/NEW-RUN
# After a complete, valid 60-case development run:
node evidence/h0/v3-design.mjs /absolute/DEVELOPMENT /absolute/admitted-confirmation-cases.json /absolute/NEW-design.json
node evidence/h0/v3.mjs prepare /absolute/selected-cases.json /absolute/NEW-CONFIRMATION confirmation /absolute/NEW-design.json
```

The combined pilot manifest is `.do-not-commit/h0-v3-behavior/combined-pilot-checked.json`; the C-only retry uses `libgit2-pilot-checked.json`. Local scaffolds, dependencies and oracles are beside them. A transient GitHub metadata request excluded C from the first strengthened admission; both attempt ledgers are preserved. C/Go parser libraries are under `.do-not-commit/h0-v3-tools/`. Their source revisions and binary hashes are in the companion tooling receipt. Model calls do not depend on a local LLM server.

This implementation uses the working host's Bubblewrap and Arch package/toolchain fingerprint rather than the unavailable Docker/Podman wrappers. It rechecks executable hashes and the package inventory before dispatch/evaluation, and input trees before evaluating or accepting cached results. It is **not an immutable OCI image**: unrecorded manual edits to transitive system libraries remain outside this fingerprint. Cross-machine or updated-toolchain execution is a new study version, not a silent replay of this one. Running the archived instrument reproduces aggregation on this same unchanged environment without API calls.

Study source files are copied into each run's `instrument/` tree. Use `node RUN/instrument/evidence/h0/v3.mjs aggregate RUN` if the workspace instrument has changed. The initial `v3-2026-09-06` and `v3-2026-09-06b` preparation artifacts precede the strengthened audit and have no paid solver results; they are superseded preflights.

## Research reconciliation

- Exact historical disagreement does not prove semantic failure; it also does not establish hidden superiority. The old 92-case result remains intact.
- [Merge-Bench](https://homes.cs.washington.edu/~mernst/pubs/merge-bench-icpr2026.pdf) distinguishes exact matching, equivalence and finite tests. Its supplied archive lacks the event identities needed for automatic pooling here.
- [ConGra](https://github.com/HKU-System-Security-Lab/ConGra) provides conflict files and grading categories. Its raw commit maps were found and checked rather than assumed from the README.
- [ConflictAgent](https://arxiv.org/html/2607.27674v1) reports 117 true positives and zero false positives in a particular judge-calibration set. That observation is not a guarantee for new outputs. No LLM judge controls this experiment's primary endpoint.
- [Inception's API](https://docs.inceptionlabs.ai/api-reference/chat/create-a-chat-completion) and [MiniMax's API](https://platform.minimax.io/docs/api-reference/text-chat-openai) support the selected model settings. The request receipt records returned model IDs; hosted aliases do not establish immutable model weights.
- Weave, a full Rover graph, LLVM analysis and agent deployment are outside this implementation. Phase 4 remains complete and Phase 5 remains the separate resurrection proof.

Source research stopped after primary-source access, artifact inspection and original-Git checks resolved the acquisition questions. The remaining bottleneck is validated behavioral cases, not additional benchmark claims. No positive result is promised or inferred from a successful pilot.
