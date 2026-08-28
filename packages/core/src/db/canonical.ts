import { createHash } from "node:crypto";

/**
 * Canonical JSON: recursively key-sorted, compact. Two structurally equal
 * values always serialize to identical bytes; this string is what content-
 * derived IDs hash and what JSON columns store.
 *
 * Callers must pass JSON-serializable values: throwing on undefined, functions,
 * and symbols matches JSON.stringify semantics and fails closed on misuse.
 */
export function canonicalJson(value: unknown): string {
	const result = JSON.stringify(sortValue(value));
	if (result === undefined) {
		throw new TypeError(
			"canonicalJson received a value with no JSON representation (undefined, function, or symbol)",
		);
	}
	return result;
}

function sortValue(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(sortValue);
	if (value !== null && typeof value === "object") {
		const maybe = value as { toJSON?: unknown };
		if (typeof maybe.toJSON === "function") {
			return sortValue((maybe.toJSON as () => unknown)());
		}
		const source = value as Record<string, unknown>;
		const out: Record<string, unknown> = {};
		for (const key of Object.keys(source).sort()) {
			if (source[key] !== undefined) out[key] = sortValue(source[key]);
		}
		return out;
	}
	return value;
}

export function sha256Hex(data: Uint8Array | string): string {
	return createHash("sha256").update(data).digest("hex");
}
