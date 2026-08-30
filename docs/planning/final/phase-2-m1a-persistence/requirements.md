*Part of the [canonical planning document](../canonical-final-planning-document.md).*

## 8. M1a schema/persistence/identity/error/test requirements

Preserving the 1,200 UTF-16 code-unit semantics:

- **Implementation truth:** `CAP = 1200` truncates with JavaScript `string.length` / `slice(0, CAP)`. The cap is **1,200 UTF-16 code units, not 1,200 bytes**.
- **Public contract — corrected 2026-08-30 to match the shipped schema:** `packages/core/src/m1a/evidence.ts`'s `EvidenceBundleSchema` exposes **per-side** fields, not the generic pair this row originally described: `preimage_ours_bytes: number | null`, `preimage_theirs_bytes: number | null`, `preimage_ours_truncated: boolean`, `preimage_theirs_truncated: boolean` (mirrored in `packages/core/src/db/schema.ts`'s SQL DDL with matching `CHECK` constraints). There is no generic `preimage_byte_length_original`/`preimage_bytes_truncated` pair in the shipped contract — that was this row's original, pre-shipping design intent, superseded by the per-side split once `mrgr-db/2` landed.
- **Identity:** bundle identity is `(conflict_path, conflict_ordinal)` per region *or* `(conflict_path, conflict_hunks[])` per file. The decision is documented in code review and reflected in the schema. Adding only `conflict_path` is insufficient for multi-region files.
- **Persistence:** `parseCorpusRecord` parses `evidenceBundles`; `readCorpus` preserves them; the CLI test calls `parseCorpusRecord`, not `JSON.parse`. A round-trip test asserts the bundles survive write/read.
- **Errors:** extraction failures are preserved per `(conflict_path, conflict_ordinal)` rather than silently dropped. Absent-path-as-null is preserved; missing-revision / Git failure become typed errors.
- **`dependency_graph`:** path-only. If dependency derivation fails, a derived/unpopulated discriminator is exposed; the field does not encode hunk payloads.
- **Tests:** P1 tests assert preimage source semantics, multi-path and multi-region cases, add/add, delete/modify, one per-path extraction failure, write/read round trip.
- **Schema version:** if any field's contract changes, schema version is bumped before publishing schema v2. **Corrected 2026-08-30:** `types.ts` and `corpus.ts` were the design-time authorities for the carried-code contract; the actual persistence authority since `mrgr-db/2` landed is `packages/core/src/db/schema.ts` (SQL DDL + `CHECK` constraints), not `types.ts`/`corpus.ts`.
- **Nullable stages:** `add/add` and `delete/modify` cases must return null for the absent side, not error.

