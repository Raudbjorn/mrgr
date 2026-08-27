import { createHash } from "node:crypto";
import { mkdir, rm, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";

import {
	assertMinimumGitVersion,
	gitVersion,
	MINIMUM_GIT_VERSION,
	runGit,
} from "./git.js";
import { err, ok, type Result } from "./result.js";
import type { ObjectId, ReplayProvenance, RepositoryRef } from "./types.js";

export const NETWORK_GIT_TIMEOUT_MS = 600_000;
export const OBJECT_GIT_TIMEOUT_MS = 180_000;
export const DEFAULT_MIRROR_CACHE_DIR = join(
	homedir(),
	".cache",
	"semantic-merge",
	"wp0",
	"mirrors",
);

export interface RepositoryHandle {
	gitPath: string;
	repository: RepositoryRef;
}

export interface OpenLocalRepositoryOptions {
	gitBinary?: string;
}

export interface RemoteMirrorOptions {
	host?: string;
	cacheDir?: string;
	refresh?: boolean;
	gitBinary?: string;
}

export interface RemoteMirrorLocation {
	cacheKey: string;
	absolutePath: string;
	repository: Extract<RepositoryRef, { kind: "remote" }>;
}

export interface ReplayPreflight {
	status: "ready" | "unsupported-custom-driver";
	provenance: ReplayProvenance;
}

const SLUG_SEGMENT = /^[A-Za-z0-9](?:[A-Za-z0-9._-]{0,99})$/;
const HOST_LABEL = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/;

export function remoteMirrorLocation(
	slug: string,
	options: Pick<RemoteMirrorOptions, "host" | "cacheDir"> = {},
): Result<RemoteMirrorLocation> {
	const host = options.host ?? "github.com";
	const segments = slug.split("/");
	if (
		segments.length !== 2 ||
		segments.some((segment) => !SLUG_SEGMENT.test(segment))
	) {
		return err(
			"config",
			"remote mirror location",
			"Repository slug must have exact owner/repository form",
		);
	}
	if (
		host.length === 0 ||
		host.length > 253 ||
		host.split(".").some((label) => !HOST_LABEL.test(label))
	) {
		return err(
			"config",
			"remote mirror location",
			"Repository host is invalid",
		);
	}
	const [owner, repositoryName] = segments as [string, string];
	const suffix = createHash("sha256").update(`${host}\0${slug}`).digest("hex");
	const cacheKey = `${owner}--${repositoryName}-${suffix}`;
	const cacheDir = resolve(options.cacheDir ?? DEFAULT_MIRROR_CACHE_DIR);
	return ok({
		cacheKey,
		absolutePath: join(cacheDir, cacheKey),
		repository: {
			kind: "remote",
			id: `${host}/${slug}`,
			host,
			slug,
			cacheKey,
		},
	});
}

export async function openLocalRepository(
	path: string,
	options: OpenLocalRepositoryOptions = {},
): Promise<Result<RepositoryHandle>> {
	const absolutePath = isAbsolute(path)
		? resolve(path)
		: resolve(process.cwd(), path);
	try {
		const metadata = await stat(absolutePath);
		if (!metadata.isDirectory()) {
			return err(
				"not-found",
				"open local repository",
				"Local repository path is not a directory",
			);
		}
	} catch {
		return err(
			"not-found",
			"open local repository",
			"Local repository path does not exist",
		);
	}

	const version = await gitVersion(options.gitBinary);
	if (!version.ok) {
		return version;
	}
	const supportedVersion = assertMinimumGitVersion(
		version.value,
		MINIMUM_GIT_VERSION,
	);
	if (!supportedVersion.ok) {
		return supportedVersion;
	}

	const commandOptions = {
		acceptedExitCodes: [0, 128] as const,
		gitBinary: options.gitBinary,
		timeoutMs: OBJECT_GIT_TIMEOUT_MS,
	};
	const bare = await runGit(
		absolutePath,
		["rev-parse", "--is-bare-repository"],
		commandOptions,
	);
	if (!bare.ok) {
		return bare;
	}
	const insideWorkTree = await runGit(
		absolutePath,
		["rev-parse", "--is-inside-work-tree"],
		commandOptions,
	);
	if (!insideWorkTree.ok) {
		return insideWorkTree;
	}
	const isRepository =
		(bare.value.exitCode === 0 && bare.value.stdoutText().trim() === "true") ||
		(insideWorkTree.value.exitCode === 0 &&
			insideWorkTree.value.stdoutText().trim() === "true");
	if (!isRepository) {
		return err(
			"not-found",
			"open local repository",
			"Path is not a Git repository",
		);
	}

	const shallow = await runGit(
		absolutePath,
		["rev-parse", "--is-shallow-repository"],
		{
			gitBinary: options.gitBinary,
			timeoutMs: OBJECT_GIT_TIMEOUT_MS,
		},
	);
	if (!shallow.ok) {
		return shallow;
	}
	const shallowState = shallow.value.stdoutText().trim();
	if (shallowState !== "false") {
		return err(
			"config",
			"open local repository",
			shallowState === "true"
				? "Shallow repositories are unsupported"
				: "Git returned an invalid shallow-repository state",
		);
	}

	return ok({
		gitPath: absolutePath,
		repository: { kind: "local", id: absolutePath, absolutePath },
	});
}

async function validateRemoteMirror(
	path: string,
	gitBinary?: string,
): Promise<Result<void>> {
	const bare = await runGit(path, ["rev-parse", "--is-bare-repository"], {
		gitBinary,
		timeoutMs: OBJECT_GIT_TIMEOUT_MS,
	});
	if (!bare.ok) {
		return bare.error.kind === "git"
			? err(
					"config",
					"acquire remote mirror",
					"Cached mirror is not a bare Git repository",
				)
			: bare;
	}
	if (bare.value.stdoutText().trim() !== "true") {
		return err(
			"config",
			"acquire remote mirror",
			"Cached mirror is not a bare Git repository",
		);
	}
	const shallow = await runGit(path, ["rev-parse", "--is-shallow-repository"], {
		gitBinary,
		timeoutMs: OBJECT_GIT_TIMEOUT_MS,
	});
	if (!shallow.ok) {
		return shallow.error.kind === "git"
			? err(
					"config",
					"acquire remote mirror",
					"Cached mirror ancestry could not be verified",
				)
			: shallow;
	}
	if (shallow.value.stdoutText().trim() !== "false") {
		return err(
			"config",
			"acquire remote mirror",
			"Cached mirror must contain complete ancestry",
		);
	}
	return ok(undefined);
}

export async function ensureRemoteMirror(
	slug: string,
	options: RemoteMirrorOptions = {},
): Promise<Result<RepositoryHandle>> {
	const location = remoteMirrorLocation(slug, options);
	if (!location.ok) {
		return location;
	}
	const version = await gitVersion(options.gitBinary);
	if (!version.ok) {
		return version;
	}
	const supportedVersion = assertMinimumGitVersion(
		version.value,
		MINIMUM_GIT_VERSION,
	);
	if (!supportedVersion.ok) {
		return supportedVersion;
	}

	const cacheDir = resolve(options.cacheDir ?? DEFAULT_MIRROR_CACHE_DIR);
	try {
		await mkdir(cacheDir, { recursive: true });
	} catch {
		return err(
			"config",
			"acquire remote mirror",
			"Unable to create the mirror cache directory",
		);
	}

	let freshTarget = false;
	try {
		await mkdir(location.value.absolutePath);
		freshTarget = true;
	} catch (cause) {
		if (
			typeof cause !== "object" ||
			cause === null ||
			!("code" in cause) ||
			cause.code !== "EEXIST"
		) {
			return err(
				"config",
				"acquire remote mirror",
				"Unable to reserve the mirror cache path",
			);
		}
	}

	if (freshTarget) {
		const clone = await runGit(
			cacheDir,
			[
				"clone",
				"--bare",
				"--filter=blob:none",
				"--no-single-branch",
				`https://${location.value.repository.host}/${location.value.repository.slug}.git`,
				location.value.absolutePath,
			],
			{
				gitBinary: options.gitBinary,
				timeoutMs: NETWORK_GIT_TIMEOUT_MS,
			},
		);
		if (!clone.ok) {
			try {
				await rm(location.value.absolutePath, { force: true, recursive: true });
			} catch {
				return err(
					"config",
					"acquire remote mirror",
					"Fresh clone failed and its cache directory could not be removed",
				);
			}
			return clone;
		}
	}

	const validatedMirror = await validateRemoteMirror(
		location.value.absolutePath,
		options.gitBinary,
	);
	if (!validatedMirror.ok) {
		if (freshTarget) {
			try {
				await rm(location.value.absolutePath, { force: true, recursive: true });
			} catch {
				return err(
					"config",
					"acquire remote mirror",
					"Invalid fresh mirror could not be removed",
				);
			}
		}
		return validatedMirror;
	}

	if (!freshTarget && options.refresh) {
		const fetch = await runGit(
			location.value.absolutePath,
			["fetch", "--prune", "--tags", "origin", "+refs/heads/*:refs/heads/*"],
			{
				gitBinary: options.gitBinary,
				timeoutMs: NETWORK_GIT_TIMEOUT_MS,
			},
		);
		if (!fetch.ok) {
			return fetch;
		}
	}

	return ok({
		gitPath: location.value.absolutePath,
		repository: location.value.repository,
	});
}

async function parentAttributesOid(
	repository: RepositoryHandle,
	parent: ObjectId,
	gitBinary?: string,
): Promise<Result<ObjectId | null>> {
	const result = await runGit(
		repository.gitPath,
		["rev-parse", "--verify", "--end-of-options", `${parent}:.gitattributes`],
		{
			acceptedExitCodes: [0, 128],
			gitBinary,
			timeoutMs: OBJECT_GIT_TIMEOUT_MS,
		},
	);
	if (!result.ok) {
		return result;
	}
	if (result.value.exitCode === 128) {
		return ok(null);
	}
	const oid = result.value.stdoutText().trim();
	if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(oid)) {
		return err(
			"parse",
			"read parent attributes",
			"Git returned an invalid attributes object ID",
		);
	}
	return ok(oid);
}

export async function inspectReplayPreflight(
	repository: RepositoryHandle,
	parents: readonly [ObjectId, ObjectId],
	rawGitVersion: string,
	options: { gitBinary?: string } = {},
): Promise<Result<ReplayPreflight>> {
	const supportedVersion = assertMinimumGitVersion(
		rawGitVersion,
		MINIMUM_GIT_VERSION,
	);
	if (!supportedVersion.ok) {
		return supportedVersion;
	}
	const drivers = await runGit(
		repository.gitPath,
		["config", "--local", "--get-regexp", "^merge\\..*\\.driver$"],
		{
			acceptedExitCodes: [0, 1],
			gitBinary: options.gitBinary,
			timeoutMs: OBJECT_GIT_TIMEOUT_MS,
		},
	);
	if (!drivers.ok) {
		return drivers;
	}
	const mergeConfig = await runGit(
		repository.gitPath,
		["config", "--local", "--null", "--get-regexp", "^merge\\."],
		{
			acceptedExitCodes: [0, 1],
			gitBinary: options.gitBinary,
			timeoutMs: OBJECT_GIT_TIMEOUT_MS,
		},
	);
	if (!mergeConfig.ok) {
		return mergeConfig;
	}
	const oursAttributes = await parentAttributesOid(
		repository,
		parents[0],
		options.gitBinary,
	);
	if (!oursAttributes.ok) {
		return oursAttributes;
	}
	const theirsAttributes = await parentAttributesOid(
		repository,
		parents[1],
		options.gitBinary,
	);
	if (!theirsAttributes.ok) {
		return theirsAttributes;
	}
	const hasMergeConfig =
		mergeConfig.value.exitCode === 0 && mergeConfig.value.stdout.length > 0;
	const provenance: ReplayProvenance = {
		gitVersion: rawGitVersion,
		algorithm: "merge-tree-write-tree",
		strategy: "ort",
		environmentPolicy: "isolated-v1",
		normalizationVersion: "v1",
		parentAttributes: {
			ours: oursAttributes.value,
			theirs: theirsAttributes.value,
		},
		repoMergeConfigHash: hasMergeConfig
			? createHash("sha256").update(mergeConfig.value.stdout).digest("hex")
			: null,
	};
	return ok({
		status:
			drivers.value.exitCode === 0 && drivers.value.stdout.length > 0
				? "unsupported-custom-driver"
				: "ready",
		provenance,
	});
}
