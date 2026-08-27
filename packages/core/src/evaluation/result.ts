export type ErrorKind =
	| "config"
	| "not-found"
	| "timeout"
	| "output-limit"
	| "git"
	| "parse"
	| "unsupported"
	| "corrupt-corpus";

export interface ToolError {
	kind: ErrorKind;
	operation: string;
	message: string;
	details?: Record<string, string | number | boolean | null>;
}

export type Result<T> =
	| { ok: true; value: T }
	| { ok: false; error: ToolError };

export function ok<T>(value: T): Result<T> {
	return { ok: true, value };
}

export function err(
	kind: ErrorKind,
	operation: string,
	message: string,
	details?: ToolError["details"],
): Result<never> {
	const error: ToolError =
		details === undefined
			? { kind, operation, message }
			: { kind, operation, message, details };

	return { ok: false, error };
}
