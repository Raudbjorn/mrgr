import type { ErrorKind, ToolError } from "../evaluation/result.js";

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
