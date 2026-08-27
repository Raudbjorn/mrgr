import { z } from "zod";

export const DependencyGraphSchema = z.array(z.string());

export const EvidenceBundleSchema = z.object({
  conflict_hunk_ours: z.string(),
  conflict_hunk_base: z.string(),
  conflict_hunk_theirs: z.string(),
  preimage_ours: z.string().nullable(),
  preimage_theirs: z.string().nullable(),
  dependency_graph: DependencyGraphSchema,
});

export type EvidenceBundle = z.infer<typeof EvidenceBundleSchema>;