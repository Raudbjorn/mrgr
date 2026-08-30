*Part of the [canonical planning document](../canonical-final-planning-document.md).*

## 9. M0 publication-rights disposition

- **Status (corrected 2026-08-30, verified on disk):** rights attestation, README correction, and NOTICE correction are all **done**. The only remaining WP0 output is regenerating the durable clean-clone evidence artifact at current HEAD — see `phase-1-m0-core-extraction/work-package.md`.
- **What is publishable today:** `@mrgr/core` (Apache-2.0, 24 byte-verified carried files, corrected README, corrected NOTICE with recorded rights attestation). Test count: 232 invocations across 24 files current (120 was the carried-only subset predating `mrgr-db/2`).
- **What is NOT publishable today, regardless of rights:** any package that does not exist; any mechanism driver that is not implemented (the README and NOTICE already carry mechanism invocation in future tense — verified).
- **Required WP0 outputs before publication:**
  1. **DONE:** rights attestation recorded in `NOTICE` — "Attested by the author, 2026-08-27."
  2. **DONE:** README has no references to `docs/method.md`, `@mrgr/mergebase`, `@mrgr/entities`, `packages/mechanisms`, or present-tense mechanism invocation.
  3. **DONE:** NOTICE has the corrected GPL-3.0-only Mergiraf and GPL-3.0-or-later diff3 wording.
  4. **OPEN:** the M0 closure evidence needs to be re-derived at current HEAD — the existing `closure-evidence.md` describes commit `ed928032…`, which predates items 1–3 landing and predates `mrgr-db/2`.
