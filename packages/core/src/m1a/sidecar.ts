import { createReadStream } from "node:fs";
import { open, type FileHandle } from "node:fs/promises";
import { createInterface } from "node:readline";
import { z } from "zod";

import { EvidenceBundleSchema } from "./evidence.js";
import { err, ok, type Result, type ToolError } from "../evaluation/result.js";

export const EVIDENCE_SCHEMA_VERSION = 1 as const;

const ToolErrorSchema: z.ZodType<ToolError> = z.object({
	kind: z.enum([
		"config",
		"not-found",
		"timeout",
		"output-limit",
		"git",
		"parse",
		"unsupported",
		"corrupt-corpus",
	]),
	operation: z.string(),
	message: z.string(),
	details: z
		.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
		.optional(),
});

/**
 * One conflict region's evidence, or the reason there is none.
 *
 * A failed extraction is a record, not an omission. Absence of a record means
 * the region was never attempted; `status: "failed"` means it was attempted and
 * why it did not produce a bundle. Collapsing those two into "no bundle" is
 * what made extraction failures invisible before.
 *
 * The first three fields mirror `resumeKey()` in `evaluation/corpus.ts`; adding
 * path and ordinal gives the same stable identity `ConflictRegionRecord` uses,
 * so a sidecar row joins 1:1 to a corpus region.
 */
export const EvidenceRecordSchema = z.discriminatedUnion("status", [
	z.object({
		schemaVersion: z.literal(EVIDENCE_SCHEMA_VERSION),
		repository_id: z.string().min(1),
		merge_sha: z.string().min(1),
		baseline_id: z.string().min(1),
		conflict_path: z.string().min(1),
		conflict_ordinal: z.number().int().positive(),
		status: z.literal("ok"),
		bundle: EvidenceBundleSchema,
	}),
	z.object({
		schemaVersion: z.literal(EVIDENCE_SCHEMA_VERSION),
		repository_id: z.string().min(1),
		merge_sha: z.string().min(1),
		baseline_id: z.string().min(1),
		conflict_path: z.string().min(1),
		conflict_ordinal: z.number().int().positive(),
		status: z.literal("failed"),
		error: ToolErrorSchema,
	}),
]);

export type EvidenceRecord = z.infer<typeof EvidenceRecordSchema>;

/**
 * Stable identity for one sidecar row. Used to resume without duplicating.
 */
export function evidenceKey(
	record: Pick<
		EvidenceRecord,
		"repository_id" | "merge_sha" | "baseline_id" | "conflict_path" | "conflict_ordinal"
	>,
): string {
	return JSON.stringify([
		record.repository_id,
		record.merge_sha,
		record.baseline_id,
		record.conflict_path,
		record.conflict_ordinal,
	]);
}

/**
 * Parse one sidecar line. Fail-closed: a malformed line is an error, never a
 * skipped row, so a truncated or corrupted sidecar cannot silently read as a
 * smaller-but-valid one.
 */
export function parseEvidenceRecord(value: unknown): Result<EvidenceRecord> {
	const parsed = EvidenceRecordSchema.safeParse(value);
	if (!parsed.success) {
		return err(
			"corrupt-corpus",
			"parse evidence record",
			"Evidence record does not match the schema",
			{ issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") },
		);
	}
	return ok(parsed.data);
}

/** Read every record, failing on the first malformed line. */
export async function readEvidence(path: string): Promise<Result<EvidenceRecord[]>> {
	const records: EvidenceRecord[] = [];
	let lineNumber = 0;
	try {
		const stream = createReadStream(path, { encoding: "utf8" });
		const lines = createInterface({ input: stream, crlfDelay: Infinity });
		for await (const line of lines) {
			lineNumber += 1;
			if (line.trim() === "") continue;
			let value: unknown;
			try {
				value = JSON.parse(line);
			} catch {
				return err("corrupt-corpus", "read evidence", "Line is not valid JSON", {
					path,
					line: lineNumber,
				});
			}
			const record = parseEvidenceRecord(value);
			if (!record.ok) {
				return err("corrupt-corpus", "read evidence", record.error.message, {
					path,
					line: lineNumber,
					...record.error.details,
				});
			}
			records.push(record.value);
		}
	} catch (cause) {
		const code = (cause as NodeJS.ErrnoException).code ?? null;
		return err("not-found", "read evidence", "Evidence file could not be read", {
			path,
			code,
		});
	}
	return ok(records);
}

/** Keys already present, for resuming an interrupted extraction. */
export async function loadEvidenceKeys(path: string): Promise<Result<Set<string>>> {
	const existing = await readEvidence(path);
	if (!existing.ok) {
		if (existing.error.details?.code === "ENOENT") return ok(new Set());
		return existing;
	}
	return ok(new Set(existing.value.map(evidenceKey)));
}

/**
 * Append-only writer with a failure latch.
 *
 * Mirrors `CorpusWriter` in `evaluation/corpus.ts`: writes are serialized
 * through a promise chain, a short write latches the error, and every
 * subsequent call reports it rather than continuing to append to a file whose
 * contents are already in doubt.
 */
export class EvidenceWriter {
	private queue: Promise<void> = Promise.resolve();
	private state: "open" | "closed" = "open";
	private failure: ToolError | undefined;

	private constructor(
		private readonly handle: FileHandle,
		private readonly path: string,
	) {}

	static async open(path: string): Promise<Result<EvidenceWriter>> {
		try {
			const handle = await open(path, "a");
			return ok(new EvidenceWriter(handle, path));
		} catch (cause) {
			const code = (cause as NodeJS.ErrnoException).code ?? null;
			return err("config", "open evidence", "Evidence file could not be opened", {
				path,
				code,
			});
		}
	}

	append(record: EvidenceRecord): Promise<Result<void>> {
		if (this.failure) return Promise.resolve({ ok: false, error: this.failure });
		if (this.state === "closed") {
			return Promise.resolve(
				err("config", "append evidence", "Writer is closed", { path: this.path }),
			);
		}

		// Validate before writing so a malformed record cannot reach the file.
		const validated = parseEvidenceRecord(record);
		if (!validated.ok) return Promise.resolve(validated);

		const line = `${JSON.stringify(validated.value)}\n`;
		const expected = Buffer.byteLength(line, "utf8");

		const result = this.queue.then(async () => {
			if (this.failure) return;
			try {
				const { bytesWritten } = await this.handle.write(line, null, "utf8");
				if (bytesWritten !== expected) {
					this.failure = {
						kind: "corrupt-corpus",
						operation: "append evidence",
						message: "Short write; evidence file may be truncated",
						details: { path: this.path, expected, written: bytesWritten },
					};
				}
			} catch (cause) {
				this.failure = {
					kind: "corrupt-corpus",
					operation: "append evidence",
					message: "Evidence append failed",
					details: {
						path: this.path,
						code: (cause as NodeJS.ErrnoException).code ?? null,
					},
				};
			}
		});
		this.queue = result;
		return result.then(() =>
			this.failure ? { ok: false as const, error: this.failure } : ok(undefined),
		);
	}

	async close(): Promise<Result<void>> {
		if (this.state === "closed") return ok(undefined);
		this.state = "closed";
		await this.queue;
		try {
			await this.handle.close();
		} catch (cause) {
			return err("config", "close evidence", "Evidence file could not be closed", {
				path: this.path,
				code: (cause as NodeJS.ErrnoException).code ?? null,
			});
		}
		return this.failure ? { ok: false, error: this.failure } : ok(undefined);
	}
}
