import type { ErrorKind, Result, ToolError } from "../evaluation/result.js";

/**
 * The carried ErrorKind union cannot be edited (src/evaluation is verbatim,
 * digest-enforced). The db layer widens it locally; a DbToolError with any
 * carried kind is a valid ToolError, and "db" stays inside src/db.
 */
export type DbErrorKind = ErrorKind | "db";

export interface DbToolError extends Omit<ToolError, "kind"> {
	kind: DbErrorKind;
}

export type DbResult<T> =
	| { ok: true; value: T }
	| { ok: false; error: DbToolError };

export function dbOk<T>(value: T): DbResult<T> {
	return { ok: true, value };
}

export function dbErr(
	kind: DbErrorKind,
	operation: string,
	message: string,
	details?: DbToolError["details"],
): DbResult<never> {
	const error: DbToolError =
		details === undefined
			? { kind, operation, message }
			: { kind, operation, message, details };
	return { ok: false, error };
}

/**
 * Translate a DbToolError to a ToolError suitable for code outside src/db
 * (e.g. CLI modules that only carry the carried ErrorKind union). The
 * `"db"` kind collapses to `"config"` — the pragmatic choice, since a db
 * error reaching a CLI caller is always a caller-side issue. The original
 * kind is preserved in `details.kind`.
 */
export function dbToolErrorToToolError(e: DbToolError): ToolError {
	const carriedKind: ErrorKind = e.kind === "db" ? "config" : e.kind;
	const details: ToolError["details"] = { ...(e.details ?? {}), kind: e.kind };
	return { kind: carriedKind, operation: e.operation, message: e.message, details };
}

/** Translate a DbResult into a Result<T> for cross-module consumption. */
export function dbResultToResult<T>(r: DbResult<T>): Result<T> {
	return r.ok ? { ok: true, value: r.value } : { ok: false, error: dbToolErrorToToolError(r.error) };
}

