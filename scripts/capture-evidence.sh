#!/usr/bin/env bash
# Produce a durable M0 evidence artifact from a CLEAN CLONE of a pinned commit.
#
# Running the gates in the working tree proves that the working tree works. It
# does not prove that what is committed works, and a session transcript is not
# an artifact anyone else can check. This clones the named commit into a temp
# directory, runs every gate there, and writes the result to evidence/.
#
# Chicken-and-egg, stated rather than hidden: the artifact records the commit it
# was produced FROM. Committing the artifact necessarily creates a new commit.
# So evidence/m0-closure.md always describes its own parent, and re-running this
# after any source change is what keeps it honest.
#
# Usage: scripts/capture-evidence.sh [commit-ish]   (default: HEAD)
set -euo pipefail

root=$(cd "$(dirname "$0")/.." && pwd)
commitish="${1:-HEAD}"
sha=$(git -C "$root" rev-parse "$commitish")
out="$root/evidence/m0-closure.md"
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

step() { printf '\n### %s\n\n```\n' "$1" >>"$out"; }
endstep() { printf '```\n' >>"$out"; }

git -C "$root" clone -q --no-local "$root" "$work/clone"
git -C "$work/clone" checkout -q "$sha"

{
	printf '# M0 closure evidence\n\n'
	printf 'Produced by `scripts/capture-evidence.sh` from a clean clone.\n'
	printf 'This file describes commit `%s`, which is its own parent.\n\n' "$sha"
	printf '| Field | Value |\n|---|---|\n'
	printf '| Commit | `%s` |\n' "$sha"
	printf '| Tree | `%s` |\n' "$(git -C "$work/clone" rev-parse "$sha^{tree}")"
	printf '| Archive SHA-256 | `%s` |\n' \
		"$(git -C "$work/clone" archive --format=tar "$sha" | sha256sum | cut -d' ' -f1)"
	printf '| node | `%s` |\n' "$(node --version)"
	printf '| pnpm | `%s` |\n' "$(pnpm --version)"
	printf '| git | `%s` |\n' "$(git --version)"
	printf '| Host | `%s` |\n' "$(uname -sr)"
} >"$out"

cd "$work/clone"

step "pnpm install --frozen-lockfile"
pnpm install --frozen-lockfile 2>&1 | tail -8 >>"$out"
endstep

step "pnpm -r typecheck"
pnpm -r typecheck 2>&1 | tail -6 >>"$out"
printf 'exit=%s\n' "$?" >>"$out"
endstep

step "pnpm -r test"
pnpm -r test 2>&1 | grep -E 'Test Files|Tests |FAIL|✓ tests' >>"$out"
endstep

step "pnpm -r build"
pnpm -r build 2>&1 | tail -4 >>"$out"
printf 'dist entrypoint present: %s\n' \
	"$([ -f packages/core/dist/index.js ] && echo yes || echo NO)" >>"$out"
endstep

step "scripts/verify-carried.sh"
./scripts/verify-carried.sh >>"$out" 2>&1
endstep

step "scripts/verify-carried-selftest.sh"
./scripts/verify-carried-selftest.sh >>"$out" 2>&1
endstep

step "packaged CLI smoke"
node packages/core/bin/mrgr-wp0.mjs --help 2>&1 | head -3 >>"$out"
printf -- '--- structured error path ---\n' >>"$out"
node packages/core/bin/mrgr-wp0.mjs report /nonexistent.jsonl 2>>"$out" || \
	printf 'exit=%s (expected 1)\n' "$?" >>"$out"
endstep

{
	printf '\n## What this does NOT establish\n\n'
	printf -- '- Nothing about resolution: no mechanism, oracle, ledger or adjudicator exists in this commit.\n'
	printf -- '- Nothing about real-world recall or precision. The suite is fixture-scale; `git.test.ts`\n'
	printf -- '  deliberately builds a fake `git` executable rather than exercising a real one.\n'
	printf -- '- Nothing about publishability: the rights attestation in NOTICE is still unrecorded.\n'
	printf -- '- Nothing about other platforms. One host, one Node, one Git, recorded above.\n'
} >>"$out"

printf 'wrote %s\n' "$out"
