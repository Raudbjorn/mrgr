import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { canonicalJson, sha256Hex } from "./canonical.js";
import { SCHEMA_VERSION_STRING } from "./open.js";
import { dbErr, dbOk, type DbResult } from "./result.js";
import type { DbHandle } from "./open.js";

export interface ExportManifest {
	schema_version: string; // "mrgr-db/1"
	meta: Record<string, string>; // verbatim copy of the meta table
	tables: Record<string, { rows: number; sha256: string }>; // per exported file
}

/**
 * Position column each table is ordered by. Most tables carry a natural key
 * that is already stable content (an id, a hash, a foreign key tuple); three
 * tables — conflict_path, conflict_region, merge_base — record array/object
 * position from their source record via an explicit index column
 * (path_index, array_index, base_index) because their natural key (path,
 * (path, ordinal), base_sha) does not preserve the original order and
 * sorting by it would silently re-order recorded evidence. ledger orders by
 * seq, its assigned arrival order, not by id (its content hash).
 *
 * evidence_bundle and evidence_dep have no such index column in the schema:
 * they export in primary-key order, which is the only order available.
 */
const TABLE_SPECS: readonly { name: string; orderBy: string }[] = [
	{ name: "meta", orderBy: "key" },
	{ name: "repository", orderBy: "id" },
	{ name: "baseline", orderBy: "baseline_id" },
	{ name: "corpus_record", orderBy: "repository_id, merge_sha, baseline_id" },
	{ name: "merge_base", orderBy: "repository_id, merge_sha, baseline_id, base_index" },
	{ name: "conflict_path", orderBy: "repository_id, merge_sha, baseline_id, path_index" },
	{ name: "conflict_region", orderBy: "repository_id, merge_sha, baseline_id, array_index" },
	{ name: "evidence_bundle", orderBy: "repository_id, merge_sha, baseline_id, path, ordinal" },
	{ name: "evidence_dep", orderBy: "repository_id, merge_sha, baseline_id, path, side, dep_path" },
	{ name: "blob", orderBy: "sha256" },
	{ name: "ledger", orderBy: "seq" },
	{ name: "run", orderBy: "run_id" },
	{ name: "run_result", orderBy: "run_id, triple_id, run_index" },
];

/**
 * Dump the whole database to deterministic JSONL, one file per table plus a
 * manifest. This is the transport format the evidence store commits to git;
 * the database is the store, this is what gets diffed and digested.
 *
 * Every file except meta.jsonl and manifest.json is a pure function of the
 * database's logical content: same rows in, same bytes out, regardless of
 * insertion order or SELECT * column order (canonicalJson sorts keys).
 * meta.jsonl and manifest.json legitimately vary between databases because
 * meta.created_at records when a given database file was created.
 */
export function exportDb(
	handle: DbHandle,
	outDir: string,
	options: { withBlobs?: boolean } = {},
): DbResult<ExportManifest> {
	const withBlobs = options.withBlobs ?? false;

	try {
		mkdirSync(outDir, { recursive: true });
		if (withBlobs) mkdirSync(join(outDir, "blobs"), { recursive: true });
	} catch (cause) {
		return dbErr("db", "export db", "Output directory could not be created", {
			outDir,
			cause: String(cause),
		});
	}

	const tables: Record<string, { rows: number; sha256: string }> = {};
	let metaRecord: Record<string, string> = {};

	for (const spec of TABLE_SPECS) {
		const isBlob = spec.name === "blob";
		const columns = isBlob ? (withBlobs ? "sha256, byte_len, bytes" : "sha256, byte_len") : "*";

		let rows: Record<string, unknown>[];
		try {
			rows = handle.db
				.prepare(`SELECT ${columns} FROM ${spec.name} ORDER BY ${spec.orderBy}`)
				.all() as Record<string, unknown>[];
		} catch (cause) {
			return dbErr("db", "export db", `Failed to read table ${spec.name}`, {
				table: spec.name,
				cause: String(cause),
			});
		}

		if (spec.name === "meta") {
			metaRecord = {};
			for (const row of rows) metaRecord[row.key as string] = row.value as string;
		}

		// blob.bytes never appears in the jsonl row — it is written, unmodified,
		// to blobs/<sha256> instead when requested.
		const blobBytesBySha: [string, Uint8Array][] = [];
		const jsonlRows = isBlob
			? rows.map((row) => {
					const { sha256, byte_len, bytes } = row as {
						sha256: string;
						byte_len: number;
						bytes?: Uint8Array;
					};
					if (withBlobs && bytes !== undefined) blobBytesBySha.push([sha256, bytes]);
					return { sha256, byte_len };
				})
			: rows;

		let lines: string[];
		try {
			lines = jsonlRows.map((row) => canonicalJson(row));
		} catch (cause) {
			return dbErr(
				"db",
				"export db",
				`A row in table ${spec.name} has no canonical JSON representation`,
				{ table: spec.name, cause: String(cause) },
			);
		}
		const content = lines.length > 0 ? `${lines.join("\n")}\n` : "";

		const filePath = join(outDir, `${spec.name}.jsonl`);
		try {
			writeFileSync(filePath, content, "utf8");
		} catch (cause) {
			return dbErr("db", "export db", `Failed to write ${spec.name}.jsonl`, {
				path: filePath,
				cause: String(cause),
			});
		}

		tables[spec.name] = { rows: jsonlRows.length, sha256: sha256Hex(content) };

		if (isBlob && withBlobs) {
			for (const [sha256, bytes] of blobBytesBySha) {
				try {
					writeFileSync(join(outDir, "blobs", sha256), bytes);
				} catch (cause) {
					return dbErr("db", "export db", "Failed to write blob file", {
						sha256,
						cause: String(cause),
					});
				}
			}
		}
	}

	const manifest: ExportManifest = {
		schema_version: SCHEMA_VERSION_STRING,
		meta: metaRecord,
		tables,
	};

	let manifestJson: string;
	try {
		// canonical-key-order: round-trip through canonicalJson's recursive key
		// sort, then re-indent. JSON.parse preserves the sorted key order that
		// JSON.stringify(..., null, 2) below then renders with pretty spacing.
		manifestJson = `${JSON.stringify(JSON.parse(canonicalJson(manifest)), null, 2)}\n`;
	} catch (cause) {
		return dbErr("db", "export db", "Manifest has no canonical JSON representation", {
			cause: String(cause),
		});
	}

	try {
		writeFileSync(join(outDir, "manifest.json"), manifestJson, "utf8");
	} catch (cause) {
		return dbErr("db", "export db", "Failed to write manifest.json", {
			path: join(outDir, "manifest.json"),
			cause: String(cause),
		});
	}

	return dbOk(manifest);
}
