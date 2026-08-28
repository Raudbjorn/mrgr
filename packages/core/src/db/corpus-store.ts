import { canonicalJson } from "./canonical.js";
import { dbErr, dbOk, type DbResult } from "./result.js";
import type { DbHandle } from "./open.js";
import type {
	BaseReachabilityCount,
	ConflictRegionRecord,
	CorpusRecordV2,
	RepositoryRef,
} from "../evaluation/types.js";
import type { ToolError } from "../evaluation/result.js";

/**
 * Corpus persistence over mrgr-db/1.
 *
 * baseline.replay_command: CorpusRecordV2 does not carry the literal replay
 * command string that baselineId was derived from (that lives inside the
 * carried git.ts). The faithful, deterministic stand-in is the canonical JSON
 * of the full provenance envelope, which is exactly what baselineId binds.
 */
export class CorpusStore {
	constructor(private readonly handle: DbHandle) {}

	append(record: CorpusRecordV2): DbResult<void> {
		const db = this.handle.db;
		const existing = this.get(
			record.repository.id,
			record.merge.sha,
			record.baselineId,
		);
		if (!existing.ok) return existing;
		if (existing.value !== null) {
			if (canonicalJson(existing.value) === canonicalJson(record)) {
				return dbOk(undefined); // idempotent re-append
			}
			return dbErr("db", "append corpus record", "Duplicate key with different content", {
				repository_id: record.repository.id,
				merge_sha: record.merge.sha,
				baseline_id: record.baselineId,
			});
		}

		try {
			db.exec("BEGIN IMMEDIATE");
			this.insertRepository(record.repository);
			this.insertBaseline(record);
			db.prepare(
				`INSERT INTO corpus_record
				 (repository_id, merge_sha, baseline_id, parent_ours_sha, parent_theirs_sha,
				  author_date, subject, parent_attr_ours, parent_attr_theirs,
				  repo_merge_config_hash, replay_status, automatic_tree_oid, base_topology,
				  changed_path_intersection, error_json)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			).run(
				record.repository.id,
				record.merge.sha,
				record.baselineId,
				record.merge.parents[0],
				record.merge.parents[1],
				record.merge.authorDate,
				record.merge.subject,
				record.replayProvenance.parentAttributes.ours,
				record.replayProvenance.parentAttributes.theirs,
				record.replayProvenance.repoMergeConfigHash,
				record.replayStatus,
				record.automaticTreeOid,
				record.baseTopology,
				record.changedPathIntersection === null
					? null
					: canonicalJson(record.changedPathIntersection),
				record.error === undefined ? null : canonicalJson(record.error),
			);
			this.insertMergeBases(record);
			this.insertConflicts(record);
			db.exec("COMMIT");
			return dbOk(undefined);
		} catch (cause) {
			try {
				db.exec("ROLLBACK");
			} catch {
				/* nothing to roll back */
			}
			return dbErr("db", "append corpus record", "Insert failed", {
				repository_id: record.repository.id,
				merge_sha: record.merge.sha,
				baseline_id: record.baselineId,
				cause: String(cause),
			});
		}
	}

	private insertRepository(repository: RepositoryRef): void {
		this.handle.db
			.prepare(
				`INSERT OR IGNORE INTO repository
				 (id, kind, host, slug, cache_key, absolute_path)
				 VALUES (?, ?, ?, ?, ?, ?)`,
			)
			.run(
				repository.id,
				repository.kind,
				repository.kind === "remote" ? repository.host : null,
				repository.kind === "remote" ? repository.slug : null,
				repository.kind === "remote" ? repository.cacheKey : null,
				repository.kind === "local" ? repository.absolutePath : null,
			);
	}

	private insertBaseline(record: CorpusRecordV2): void {
		this.handle.db
			.prepare(
				`INSERT OR IGNORE INTO baseline
				 (baseline_id, git_version, algorithm, strategy, environment_policy,
				  normalization_version, replay_command)
				 VALUES (?, ?, ?, ?, ?, ?, ?)`,
			)
			.run(
				record.baselineId,
				record.replayProvenance.gitVersion,
				record.replayProvenance.algorithm,
				record.replayProvenance.strategy,
				record.replayProvenance.environmentPolicy,
				record.replayProvenance.normalizationVersion,
				canonicalJson(record.replayProvenance),
			);
	}

	private insertMergeBases(record: CorpusRecordV2): void {
		const counts = new Map<string, BaseReachabilityCount>(
			record.baseReachabilityCounts.map((c) => [c.baseSha, c]),
		);
		const insert = this.handle.db.prepare(
			`INSERT INTO merge_base
			 (repository_id, merge_sha, baseline_id, base_sha, base_index,
			  ours_exclusive_commits, theirs_exclusive_commits)
			 VALUES (?, ?, ?, ?, ?, ?, ?)`,
		);
		record.mergeBases.forEach((baseSha, index) => {
			const count = counts.get(baseSha);
			insert.run(
				record.repository.id,
				record.merge.sha,
				record.baselineId,
				baseSha,
				index,
				count?.oursExclusiveCommits ?? null,
				count?.theirsExclusiveCommits ?? null,
			);
		});
	}

	private insertConflicts(record: CorpusRecordV2): void {
		const insertPath = this.handle.db.prepare(
			`INSERT INTO conflict_path (repository_id, merge_sha, baseline_id, path, path_index)
			 VALUES (?, ?, ?, ?, ?)`,
		);
		record.conflictPaths.forEach((path, pathIndex) => {
			insertPath.run(
				record.repository.id,
				record.merge.sha,
				record.baselineId,
				path,
				pathIndex,
			);
		});
		const insertRegion = this.handle.db.prepare(
			`INSERT INTO conflict_region
			 (repository_id, merge_sha, baseline_id, path, ordinal, category,
			  conflict_kind, stage_oid_base, stage_oid_ours, stage_oid_theirs,
			  localization_status, resolution_class, novel_after_normalization,
			  triple_key, automatic_ranges, resolution_range, raw_digests,
			  normalized_digests, raw_counts, array_index)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		);
		record.conflictRegions.forEach((region, arrayIndex) => {
			insertRegion.run(
				record.repository.id,
				record.merge.sha,
				record.baselineId,
				region.path,
				region.ordinal,
				region.category,
				region.conflictKind,
				region.stageOids.base,
				region.stageOids.ours,
				region.stageOids.theirs,
				region.localizationStatus,
				region.resolutionClass,
				region.novelAfterNormalization === null
					? null
					: region.novelAfterNormalization
						? 1
						: 0,
				region.tripleKey,
				// These four are always objects on ConflictRegionRecord — their
				// fields are nullable, the containers are not. Only
				// resolutionRange is itself nullable.
				canonicalJson(region.automaticRanges),
				region.resolutionRange === null ? null : canonicalJson(region.resolutionRange),
				canonicalJson(region.rawDigests),
				canonicalJson(region.normalizedDigests),
				canonicalJson(region.rawCounts),
				// (path, ordinal) is unique per record but carries no cross-path
				// array order; arrayIndex is the only thing that records
				// conflictRegions' original position for exact reconstruction.
				arrayIndex,
			);
		});
	}

	get(
		repositoryId: string,
		mergeSha: string,
		baselineId: string,
	): DbResult<CorpusRecordV2 | null> {
		try {
			const row = this.handle.db
				.prepare(
					`SELECT cr.*, r.kind AS repo_kind, r.host, r.slug, r.cache_key,
					        r.absolute_path,
					        b.git_version, b.algorithm, b.strategy, b.environment_policy,
					        b.normalization_version
					 FROM corpus_record cr
					 JOIN repository r ON r.id = cr.repository_id
					 JOIN baseline b ON b.baseline_id = cr.baseline_id
					 WHERE cr.repository_id = ? AND cr.merge_sha = ? AND cr.baseline_id = ?`,
				)
				.get(repositoryId, mergeSha, baselineId) as
				| Record<string, unknown>
				| undefined;
			if (row === undefined) return dbOk(null);
			return dbOk(this.rowToRecord(row));
		} catch (cause) {
			return dbErr("db", "get corpus record", "Read failed", {
				repository_id: repositoryId,
				merge_sha: mergeSha,
				baseline_id: baselineId,
				cause: String(cause),
			});
		}
	}

	list(): DbResult<CorpusRecordV2[]> {
		try {
			const rows = this.handle.db
				.prepare(
					`SELECT cr.*, r.kind AS repo_kind, r.host, r.slug, r.cache_key,
					        r.absolute_path,
					        b.git_version, b.algorithm, b.strategy, b.environment_policy,
					        b.normalization_version
					 FROM corpus_record cr
					 JOIN repository r ON r.id = cr.repository_id
					 JOIN baseline b ON b.baseline_id = cr.baseline_id
					 ORDER BY cr.repository_id, cr.merge_sha, cr.baseline_id`,
				)
				.all() as Record<string, unknown>[];
			return dbOk(rows.map((row) => this.rowToRecord(row)));
		} catch (cause) {
			return dbErr("db", "list corpus records", "Read failed", {
				cause: String(cause),
			});
		}
	}

	resumeKeys(): DbResult<Set<string>> {
		try {
			const rows = this.handle.db
				.prepare("SELECT repository_id, merge_sha, baseline_id FROM corpus_record")
				.all() as { repository_id: string; merge_sha: string; baseline_id: string }[];
			return dbOk(
				new Set(
					rows.map((r) =>
						JSON.stringify([r.repository_id, r.merge_sha, r.baseline_id]),
					),
				),
			);
		} catch (cause) {
			return dbErr("db", "corpus resume keys", "Read failed", {
				cause: String(cause),
			});
		}
	}

	private rowToRecord(row: Record<string, unknown>): CorpusRecordV2 {
		const repositoryId = row.repository_id as string;
		const mergeSha = row.merge_sha as string;
		const baselineId = row.baseline_id as string;

		const repository: RepositoryRef =
			row.repo_kind === "remote"
				? {
						kind: "remote",
						id: repositoryId,
						host: row.host as string,
						slug: row.slug as string,
						cacheKey: row.cache_key as string,
					}
				: {
						kind: "local",
						id: repositoryId,
						absolutePath: row.absolute_path as string,
					};

		const bases = this.handle.db
			.prepare(
				`SELECT base_sha, base_index, ours_exclusive_commits, theirs_exclusive_commits
				 FROM merge_base
				 WHERE repository_id = ? AND merge_sha = ? AND baseline_id = ?
				 ORDER BY base_index`,
			)
			.all(repositoryId, mergeSha, baselineId) as {
			base_sha: string;
			base_index: number;
			ours_exclusive_commits: number | null;
			theirs_exclusive_commits: number | null;
		}[];

		const paths = this.handle.db
			.prepare(
				`SELECT path FROM conflict_path
				 WHERE repository_id = ? AND merge_sha = ? AND baseline_id = ?
				 ORDER BY path_index`,
			)
			.all(repositoryId, mergeSha, baselineId) as { path: string }[];

		const regions = this.handle.db
			.prepare(
				`SELECT * FROM conflict_region
				 WHERE repository_id = ? AND merge_sha = ? AND baseline_id = ?
				 ORDER BY array_index`,
			)
			.all(repositoryId, mergeSha, baselineId) as Record<string, unknown>[];

		const record: CorpusRecordV2 = {
			schemaVersion: 2,
			repository,
			merge: {
				repositoryId,
				sha: mergeSha,
				parents: [row.parent_ours_sha as string, row.parent_theirs_sha as string],
				authorDate: row.author_date as string,
				subject: row.subject as string,
			},
			baselineId,
			replayProvenance: {
				gitVersion: row.git_version as string,
				algorithm: row.algorithm as "merge-tree-write-tree",
				strategy: row.strategy as "ort",
				environmentPolicy: row.environment_policy as "isolated-v1",
				normalizationVersion: row.normalization_version as "v1",
				parentAttributes: {
					ours: row.parent_attr_ours as string | null,
					theirs: row.parent_attr_theirs as string | null,
				},
				repoMergeConfigHash: row.repo_merge_config_hash as string | null,
			},
			mergeBases: bases.map((b) => b.base_sha),
			baseTopology: row.base_topology as CorpusRecordV2["baseTopology"],
			baseReachabilityCounts: bases
				.filter((b) => b.ours_exclusive_commits !== null)
				.map((b) => ({
					baseSha: b.base_sha,
					oursExclusiveCommits: b.ours_exclusive_commits as number,
					theirsExclusiveCommits: b.theirs_exclusive_commits as number,
				})),
			changedPathIntersection:
				row.changed_path_intersection === null
					? null
					: (JSON.parse(row.changed_path_intersection as string) as string[]),
			replayStatus: row.replay_status as CorpusRecordV2["replayStatus"],
			automaticTreeOid: row.automatic_tree_oid as string | null,
			conflictPaths: paths.map((p) => p.path),
			conflictRegions: regions.map((r) => rowToRegion(r)),
		};
		if (row.error_json !== null) {
			return { ...record, error: JSON.parse(row.error_json as string) as ToolError };
		}
		return record;
	}
}

function rowToRegion(row: Record<string, unknown>): ConflictRegionRecord {
	const common = {
		path: row.path as string,
		ordinal: row.ordinal as number,
		category: row.category as ConflictRegionRecord["category"],
		conflictKind: row.conflict_kind as string,
		stageOids: {
			base: row.stage_oid_base as string | null,
			ours: row.stage_oid_ours as string | null,
			theirs: row.stage_oid_theirs as string | null,
		},
	};
	const parse = <T>(column: unknown): T => JSON.parse(column as string) as T;
	if (row.localization_status === "exact") {
		return {
			...common,
			localizationStatus: "exact",
			automaticRanges: parse(row.automatic_ranges),
			resolutionRange: parse(row.resolution_range),
			rawDigests: parse(row.raw_digests),
			normalizedDigests: parse(row.normalized_digests),
			rawCounts: parse(row.raw_counts),
			resolutionClass: row.resolution_class as Exclude<
				ConflictRegionRecord["resolutionClass"],
				"ambiguous"
			>,
			novelAfterNormalization: row.novel_after_normalization === 1,
			tripleKey: row.triple_key as string,
		};
	}
	return {
		...common,
		localizationStatus: row.localization_status as
			| "ambiguous"
			| "unsupported-binary"
			| "unsupported-structural",
		automaticRanges:
			row.automatic_ranges === null
				? { base: null, ours: null, theirs: null }
				: parse(row.automatic_ranges),
		resolutionRange:
			row.resolution_range === null ? null : parse(row.resolution_range),
		rawDigests:
			row.raw_digests === null
				? { base: null, ours: null, theirs: null, resolution: null }
				: parse(row.raw_digests),
		normalizedDigests:
			row.normalized_digests === null
				? { base: null, ours: null, theirs: null, resolution: null }
				: parse(row.normalized_digests),
		rawCounts:
			row.raw_counts === null
				? { base: null, ours: null, theirs: null, resolution: null }
				: parse(row.raw_counts),
		resolutionClass: "ambiguous",
		novelAfterNormalization: null,
		tripleKey: null,
	};
}
