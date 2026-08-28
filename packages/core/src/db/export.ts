import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { canonicalJson, sha256Hex } from "./canonical.js";
import { SCHEMA_VERSION_STRING } from "./open.js";
import { dbErr, dbOk, type DbResult } from "./result.js";
import type { DbHandle } from "./open.js";

export interface ExportManifest {
	schema_version: string; // SCHEMA_VERSION_STRING, e.g. "mrgr-db/2"
	meta: Record<string, string>; // verbatim copy of the meta table
	tables: Record<string, { rows: number; sha256: string }>; // per exported file
	// Present only when withBlobs was requested: without it, blobs/ is not
	// written, so there is nothing for this section to describe. Each blob
	// file is already self-verifying (named by its own content hash); listing
	// it here means a stale or missing blob file changes the digested
	// manifest instead of being invisible to it.
	blobs?: { sha256: string; byte_len: number }[];
}

/**
 * Position column each table is ordered by. Most tables carry a natural key
 * that is already stable content (an id, a hash, a foreign key tuple); four
 * tables — conflict_path, conflict_region, merge_base, evidence_dep — record
 * array position from their source record via an explicit index column
 * (path_index, array_index, base_index, position) because their natural key
 * (path, (path, ordinal), base_sha, (side, dep_path)) does not preserve the
 * original order — and, for evidence_dep specifically, does not preserve
 * duplicates either: dependency_graph is a plain array that may repeat the
 * same (side, dep_path) pair, and evidence_dep's own PRIMARY KEY only stays
 * collision-free across duplicates because `position` is part of it.
 * Sorting any of these four by their natural key would silently re-order (or,
 * for evidence_dep, additionally reshuffle relative to) recorded evidence.
 * ledger orders by seq, its assigned arrival order, not by id (its content
 * hash).
 *
 * evidence_bundle has no such index column in the schema: it exports in
 * primary-key order, which is the only order available.
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
	{ name: "evidence_dep", orderBy: "repository_id, merge_sha, baseline_id, path, position" },
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
 *
 * "The database's logical content" means one consistent snapshot — see the
 * transaction in phase 1 below.
 */
export function exportDb(
	handle: DbHandle,
	outDir: string,
	options: { withBlobs?: boolean } = {},
): DbResult<ExportManifest> {
	const withBlobs = options.withBlobs ?? false;
	const blobsDir = join(outDir, "blobs");

	try {
		mkdirSync(outDir, { recursive: true });
		// A prior withBlobs:true export can leave blobs/ behind. Without this,
		// a withBlobs:false re-export of the same outDir would inherit those
		// files untouched, and manifest.tables never mentions blob files at
		// all — so the digested manifest would read clean while the directory
		// silently carried content from a different export. Scoped to exactly
		// the one subdirectory this function owns, never the caller's outDir.
		rmSync(blobsDir, { recursive: true, force: true });
		if (withBlobs) mkdirSync(blobsDir, { recursive: true });
	} catch (cause) {
		return dbErr("db", "export db", "Output directory could not be prepared", {
			outDir,
			cause: String(cause),
		});
	}

	// Phase 1: read every table inside one deferred transaction, so the
	// snapshot is consistent across all 13 SELECTs. Without this, a writer
	// committing between two of them (e.g. a new conflict_path row landing
	// after conflict_path was read but before its child conflict_region is)
	// produces a directory that is internally hash-consistent — every
	// manifest digest matches its file — while describing a database state
	// that never existed. Under WAL a deferred read transaction does not
	// block concurrent writers; it only fixes what *this* export sees.
	try {
		handle.db.exec("BEGIN DEFERRED");
	} catch (cause) {
		return dbErr("db", "export db", "Could not open a read transaction", {
			cause: String(cause),
		});
	}

	const rowsByTable = new Map<string, Record<string, unknown>[]>();
	for (const spec of TABLE_SPECS) {
		const isBlob = spec.name === "blob";
		const columns = isBlob ? (withBlobs ? "sha256, byte_len, bytes" : "sha256, byte_len") : "*";

		try {
			const rows = handle.db
				.prepare(`SELECT ${columns} FROM ${spec.name} ORDER BY ${spec.orderBy}`)
				.all() as Record<string, unknown>[];
			rowsByTable.set(spec.name, rows);
		} catch (cause) {
			rollbackSafely(handle);
			return dbErr("db", "export db", `Failed to read table ${spec.name}`, {
				table: spec.name,
				cause: String(cause),
			});
		}
	}

	try {
		handle.db.exec("COMMIT");
	} catch (cause) {
		rollbackSafely(handle);
		return dbErr("db", "export db", "Failed to close the read transaction", {
			cause: String(cause),
		});
	}

	// Phase 2: serialize and write. No further DB access — everything needed
	// was captured in the snapshot above.
	const tables: Record<string, { rows: number; sha256: string }> = {};
	let metaRecord: Record<string, string> = {};
	let manifestBlobs: { sha256: string; byte_len: number }[] | undefined;

	for (const spec of TABLE_SPECS) {
		const isBlob = spec.name === "blob";
		// Populated for every TABLE_SPECS entry in phase 1 above; cannot miss.
		const rows = rowsByTable.get(spec.name) as Record<string, unknown>[];

		if (spec.name === "meta") {
			metaRecord = {};
			for (const row of rows) metaRecord[row.key as string] = row.value as string;
		}

		// blob.bytes never appears in the jsonl row — it is written, unmodified,
		// to blobs/<sha256> instead when requested.
		const blobFiles: [string, Uint8Array][] = [];
		const jsonlRows = isBlob
			? rows.map((row) => {
					// bytes is only selected (and only present) when withBlobs is
					// true; blob.bytes is NOT NULL, so within that branch it is
					// always defined — no guard, so an unreachable state can't
					// silently turn into a skipped blob file.
					if (!withBlobs) {
						const { sha256, byte_len } = row as { sha256: string; byte_len: number };
						return { sha256, byte_len };
					}
					const { sha256, byte_len, bytes } = row as {
						sha256: string;
						byte_len: number;
						bytes: Uint8Array;
					};
					blobFiles.push([sha256, bytes]);
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
			for (const [sha256, bytes] of blobFiles) {
				try {
					writeFileSync(join(blobsDir, sha256), bytes);
				} catch (cause) {
					return dbErr("db", "export db", "Failed to write blob file", {
						sha256,
						cause: String(cause),
					});
				}
			}
			// Same rows, same order as jsonlRows above (both derived from the
			// sha256-ordered query) — reused rather than re-sorted.
			manifestBlobs = jsonlRows as { sha256: string; byte_len: number }[];
		}
	}

	const manifest: ExportManifest = {
		schema_version: SCHEMA_VERSION_STRING,
		meta: metaRecord,
		tables,
		...(manifestBlobs !== undefined ? { blobs: manifestBlobs } : {}),
	};

	let manifestJson: string;
	try {
		manifestJson = `${canonicalPretty(manifest, 0)}\n`;
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

/**
 * Best-effort rollback of the read-phase transaction. Swallows the error:
 * this only runs after something has already gone wrong, and a connection
 * that isn't actually inside a transaction (e.g. BEGIN itself never
 * succeeded) throwing on ROLLBACK must not shadow the original failure or
 * leave the caller unsure whether cleanup happened.
 */
function rollbackSafely(handle: DbHandle): void {
	try {
		handle.db.exec("ROLLBACK");
	} catch {
		/* nothing to roll back, or the connection is already unusable */
	}
}

/**
 * Pretty-print with recursively sorted object keys, 2-space indent.
 *
 * Deliberately not `JSON.stringify(JSON.parse(canonicalJson(value)), null, 2)`:
 * JSON.parse builds a plain object, and V8 (like every JS engine) always
 * iterates integer-like string keys ("0", "1", ...) in ascending numeric
 * order before any other keys, regardless of the order they were inserted in
 * — so a round trip through parse can silently undo a lexicographic sort the
 * moment a key looks like an integer. No manifest key is integer-like today,
 * and §8 excludes manifest.json from the determinism property regardless,
 * but "canonical key order" should mean what it says. This sorts and renders
 * in one pass instead, so there is no intermediate object for the engine to
 * reorder.
 */
function canonicalPretty(value: unknown, depth: number): string {
	const pad = "  ".repeat(depth);
	const childPad = "  ".repeat(depth + 1);

	if (Array.isArray(value)) {
		if (value.length === 0) return "[]";
		const items = value.map((item) => `${childPad}${canonicalPretty(item, depth + 1)}`);
		return `[\n${items.join(",\n")}\n${pad}]`;
	}

	if (value !== null && typeof value === "object") {
		const record = value as Record<string, unknown>;
		// Mirrors canonicalJson: an object property whose value is undefined is
		// omitted, matching JSON.stringify's own behavior for objects.
		const keys = Object.keys(record)
			.filter((key) => record[key] !== undefined)
			.sort();
		if (keys.length === 0) return "{}";
		const entries = keys.map(
			(key) => `${childPad}${JSON.stringify(key)}: ${canonicalPretty(record[key], depth + 1)}`,
		);
		return `{\n${entries.join(",\n")}\n${pad}}`;
	}

	const json = JSON.stringify(value);
	if (json === undefined) {
		throw new TypeError(
			"Manifest contains a value with no JSON representation (undefined, function, or symbol)",
		);
	}
	return json;
}
