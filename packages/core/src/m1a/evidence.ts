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
 * A Git object name: SHA-1 today, SHA-256 in repositories using the newer
 * object format. Both are accepted; neither is normalized.
 */
export const GitObjectIdSchema = z
	.string()
	.regex(/^([0-9a-f]{40}|[0-9a-f]{64})$/, "not a Git object name");

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

	/**
	 * The Git object name of that parent's blob.
	 *
	 * Three states, deliberately distinct:
	 *
	 * - **absent** — the record predates this field. Legacy evidence is still
	 *   true; the OID was simply never recorded. Not the same as `null`.
	 * - **`null`** — the path is absent from that parent, so there is no blob.
	 * - **set** — the parent-side blob.
	 *
	 * The preimage bytes are recoverable from the repository with
	 * `git cat-file blob <oid>`, which makes the OID a substitute for carrying
	 * them: an artifact too large to commit can store the reference and stay
	 * exactly checkable by anyone holding the repository. That is the
	 * *referenced* form — `preimage_*` null while `preimage_*_oid` is set —
	 * and it is why null content alone cannot mean "path absent".
	 *
	 * Optional rather than required so records written before the field
	 * existed stay readable. When the referenced-export path lands it can
	 * require the OID at write time; nothing reads it yet, so nothing is
	 * weakened by allowing its absence here.
	 */
	preimage_ours_oid: GitObjectIdSchema.nullable().optional(),
	preimage_theirs_oid: GitObjectIdSchema.nullable().optional(),

	/** True when the stored preimage is a prefix of the original. */
	preimage_ours_truncated: z.boolean(),
	preimage_theirs_truncated: z.boolean(),

	dependency_graph: DependencyGraphSchema,
	dependency_graph_status: DependencyGraphStatusSchema,
})
	.superRefine((bundle, context) => {
		// A side either has a blob — an OID and an original byte count — or it
		// does not have the path at all. Anything in between would make the
		// referenced form indistinguishable from add/add and delete/modify
		// evidence, which is the one thing this field exists to prevent.
		for (const side of ["ours", "theirs"] as const) {
			const oid = bundle[`preimage_${side}_oid`];
			// Absent means the field was never recorded, which constrains
			// nothing. Only a field that is actually present is held to the
			// invariant.
			if (oid === undefined) continue;
			const bytes = bundle[`preimage_${side}_bytes`];
			if ((oid === null) === (bytes === null)) continue;
			context.addIssue({
				code: "custom",
				path: [`preimage_${side}_oid`],
				message:
					`preimage_${side}_oid and preimage_${side}_bytes must both be set ` +
					"or both be null: a blob has a size, an absent path has neither",
			});
		}
	});

export type EvidenceBundle = z.infer<typeof EvidenceBundleSchema>;
export type DependencyGraphStatus = z.infer<typeof DependencyGraphStatusSchema>;
