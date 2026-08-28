import { z } from "zod";

/**
 * Paths touched on one side, relative to the merge base, tagged by side:
 * `"ours:<path>"` / `"theirs:<path>"`.
 *
 * Paths only. An earlier version serialized additional conflict regions into
 * this array as `` `+${ours}|${base}|${theirs}` ``, which mixed hunk payloads
 * into a path list and made the field unusable for its stated purpose. Extra
 * regions now get their own bundles, keyed by ordinal.
 */
export const DependencyGraphSchema = z.array(
	z.string().regex(/^(ours|theirs):/, "dependency_graph entries are side-tagged paths"),
);

/**
 * Whether `dependency_graph` was actually derived.
 *
 * Derivation needs a merge base; on unrelated histories `git merge-base` fails
 * and there is nothing to derive. An empty derived graph (the sides touched no
 * common paths) and an underivable one are different facts, so they are not
 * both represented as `[]`.
 */
export const DependencyGraphStatusSchema = z.enum(["derived", "unavailable"]);

/**
 * Evidence for exactly one conflict region.
 *
 * `conflict_path` + `conflict_ordinal` is the same stable identity
 * `ConflictRegionRecord` uses, so a bundle joins 1:1 to a region in the corpus
 * rather than to a whole file.
 */
export const EvidenceBundleSchema = z.object({
	conflict_path: z.string().min(1),
	/** 1-based, matching `ConflictRegionRecord.ordinal`. */
	conflict_ordinal: z.number().int().positive(),

	conflict_hunk_ours: z.string(),
	conflict_hunk_base: z.string(),
	conflict_hunk_theirs: z.string(),

	/**
	 * The parent-side file content. `null` means the path does not exist in
	 * that parent — an add/add or delete/modify conflict — which is evidence,
	 * not an error. A missing revision or any other Git failure is reported as
	 * a typed error instead and produces no bundle.
	 */
	preimage_ours: z.string().nullable(),
	preimage_theirs: z.string().nullable(),

	/**
	 * Size of the ORIGINAL content in bytes, via `Buffer.byteLength(s, "utf8")`
	 * — not `String.length`, which counts UTF-16 code units and disagrees with
	 * byte length for any non-ASCII input. When truncated, this is still the
	 * original size, so a consumer can tell how much it is missing.
	 */
	preimage_ours_bytes: z.number().int().nonnegative().nullable(),
	preimage_theirs_bytes: z.number().int().nonnegative().nullable(),

	/** True when the stored preimage is a prefix of the original. */
	preimage_ours_truncated: z.boolean(),
	preimage_theirs_truncated: z.boolean(),

	dependency_graph: DependencyGraphSchema,
	dependency_graph_status: DependencyGraphStatusSchema,
});

export type EvidenceBundle = z.infer<typeof EvidenceBundleSchema>;
export type DependencyGraphStatus = z.infer<typeof DependencyGraphStatusSchema>;
