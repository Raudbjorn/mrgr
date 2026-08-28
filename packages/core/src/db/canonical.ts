import { createHash } from "node:crypto";

/**
 * Canonical JSON: recursively key-sorted, compact. Two structurally equal
 * values always serialize to identical bytes; this string is what content-
 * derived IDs hash and what JSON columns store.
 */
export function canonicalJson(value: unknown): string {
	return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(sortValue);
	if (value !== null && typeof value === "object") {
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
