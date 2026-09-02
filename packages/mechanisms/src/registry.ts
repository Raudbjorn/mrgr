import { ok, type Result } from "./result.js";
import { runMechanism, type Mechanism, type MechanismInput, type MechanismResult } from "./adapter.js";

export type AttributeMechanism = Mechanism | "binary";

export interface AttributeRule {
	pattern: string;
	merge: AttributeMechanism;
}

function globToRegExp(pattern: string): RegExp {
	const escaped = pattern
		.split("*")
		.map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
		.join(".*");
	return new RegExp(`^${escaped}$`);
}

/**
 * Gitattributes semantics: rules are checked in order and the last matching
 * rule wins, so a more specific pattern listed later overrides an earlier
 * one. A pattern with no "/" matches against the basename anywhere in the
 * tree (like a plain gitattributes glob); a pattern containing "/" is
 * directory-qualified and matches against the full path instead.
 */
export function classifyPath(rules: AttributeRule[], path: string): AttributeMechanism | undefined {
	const basename = path.split("/").pop() ?? path;
	let matched: AttributeMechanism | undefined;
	for (const rule of rules) {
		const candidate = rule.pattern.includes("/") ? path : basename;
		if (globToRegExp(rule.pattern).test(candidate)) matched = rule.merge;
	}
	return matched;
}

export interface FileMergeRequest extends MechanismInput {}

export type FileMergeOutcome =
	| { path: string; outcome: { kind: "merged"; result: MechanismResult } }
	| { path: string; outcome: { kind: "binary-fallback" } };

/**
 * Routes each file to its attribute-selected mechanism and runs them
 * independently. A binary-macro match never invokes a text mechanism and is
 * always recorded as its own outcome (never silently skipped) — and, being
 * independent per file, it can neither clobber nor be clobbered by another
 * file's already-written merge result in the same batch.
 */
export async function mergeFiles(
	rules: AttributeRule[],
	defaultMechanism: Mechanism,
	requests: FileMergeRequest[],
): Promise<Result<FileMergeOutcome[]>> {
	const outcomes: FileMergeOutcome[] = [];
	for (const request of requests) {
		const classified = classifyPath(rules, request.path) ?? defaultMechanism;
		if (classified === "binary") {
			outcomes.push({ path: request.path, outcome: { kind: "binary-fallback" } });
			continue;
		}
		const result = await runMechanism(classified, request);
		if (!result.ok) return result;
		outcomes.push({ path: request.path, outcome: { kind: "merged", result: result.value } });
	}
	return ok(outcomes);
}
