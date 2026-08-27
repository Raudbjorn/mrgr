#!/usr/bin/env bash
# Verify that the carried WP0 modules and tests are byte-for-byte unmodified.
#
# packages/core is an extraction, not a rewrite. Its 120 passing tests only
# mean what they appear to mean if the code under them is the code that was
# measured. A test edited to accommodate a changed module turns a green run
# into a statement about nothing, so the gate is mechanical: compare digests,
# never judgement.
#
# To carry a deliberate change: make it, re-run with --update, and say in the
# commit message what changed and why the tests still hold.
set -euo pipefail

root=$(cd "$(dirname "$0")/.." && pwd)
manifest="$root/scripts/carried.sha256"
cd "$root/packages/core"

if [[ "${1:-}" == "--update" ]]; then
	command find src/evaluation tests/evaluation -type f -name '*.ts' -print0 |
		LC_ALL=C sort -z |
		xargs -0 sha256sum >"$manifest"
	printf 'updated %s (%d files)\n' "$manifest" "$(wc -l <"$manifest")"
	exit 0
fi

if [[ ! -f "$manifest" ]]; then
	echo "missing manifest: $manifest" >&2
	exit 2
fi

# Catch modified content and, separately, files added to or removed from the
# carried set — sha256sum -c alone would not notice an addition.
if ! sha256sum -c --quiet "$manifest"; then
	echo "carried modules differ from their recorded digests" >&2
	exit 1
fi

recorded=$(wc -l <"$manifest")
present=$(command find src/evaluation tests/evaluation -type f -name '*.ts' | wc -l)
if [[ "$recorded" -ne "$present" ]]; then
	printf 'carried file count changed: manifest %s, tree %s\n' "$recorded" "$present" >&2
	exit 1
fi

printf 'carried modules verified: %s files unmodified\n' "$recorded"
