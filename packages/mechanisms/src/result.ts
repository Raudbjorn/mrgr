// A small, local Result type — @mrgr/mechanisms deliberately doesn't depend
// on @mrgr/core. It's meant to be an independently-consumable package, and a
// workspace dependency on core's dist-based type exports doesn't resolve
// during `pnpm -r typecheck`/`test`, which run before `pnpm -r build` in CI.

export type MechanismErrorKind = "unsupported";

export interface MechanismError {
	kind: MechanismErrorKind;
	operation: string;
	message: string;
	details?: Record<string, string | number | boolean | null>;
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: MechanismError };

export function ok<T>(value: T): Result<T> {
	return { ok: true, value };
}

export function err(
	kind: MechanismErrorKind,
	operation: string,
	message: string,
	details?: MechanismError["details"],
): Result<never> {
	return details === undefined
		? { ok: false, error: { kind, operation, message } }
		: { ok: false, error: { kind, operation, message, details } };
}
