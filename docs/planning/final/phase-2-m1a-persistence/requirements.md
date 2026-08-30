*Part of the [canonical planning document](../canonical-final-planning-document.md).*

## 8. M1a schema/persistence/identity/error/test requirements

Preserving the 1,200 UTF-16 code-unit semantics:

- **Implementation truth:** `CAP = 1200` truncates with JavaScript `string.length` / `slice(0, CAP)`. The cap is **1,200 UTF-16 code units, not 1,200 bytes**.
- **Public contract:** the `EvidenceBundleSchema` exposes `preimage_truncated: boolean`, `preimage_byte_length_original: number` (computed from `Buffer.byteLength(original, "utf8")` of the parent blob before any UTF-16 truncation), and a `preimage_bytes_truncated: number` field equal to `preimage_byte_length_original - Buffer.byteLength(preimage, "utf8")` when truncated. If the contract truly requires full files, the cap is removed and these fields become unused.
- **Identity:** bundle identity is `(conflict_path, conflict_ordinal)` per region *or* `(conflict_path, conflict_hunks[])` per file. The decision is documented in code review and reflected in the schema. Adding only `conflict_path` is insufficient for multi-region files.
- **Persistence:** `parseCorpusRecord` parses `evidenceBundles`; `readCorpus` preserves them; the CLI test calls `parseCorpusRecord`, not `JSON.parse`. A round-trip test asserts the bundles survive write/read.
- **Errors:** extraction failures are preserved per `(conflict_path, conflict_ordinal)` rather than silently dropped. Absent-path-as-null is preserved; missing-revision / Git failure become typed errors.
- **`dependency_graph`:** path-only. If dependency derivation fails, a derived/unpopulated discriminator is exposed; the field does not encode hunk payloads.
- **Tests:** P1 tests assert preimage source semantics, multi-path and multi-region cases, add/add, delete/modify, one per-path extraction failure, write/read round trip.
- **Schema version:** if any field's contract changes, schema version is bumped before publishing schema v2; `types.ts` and `corpus.ts` are the high-blast-radius authorities (`local/semantic-merge-consolidation-research/phase1-assets-and-seams.md:32,38`).
- **Nullable stages:** `add/add` and `delete/modify` cases must return null for the absent side, not error.

