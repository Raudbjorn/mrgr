#!/usr/bin/env bash
# Negative test for verify-carried.sh.
#
# A gate that has never been observed to fail is a gate whose passing means
# nothing. This exercises both ways the carried set can drift — a modified file
# and an added file — and requires the verifier to reject each. It restores the
# tree on every exit path, including interrupt.
set -euo pipefail

root=$(cd "$(dirname "$0")/.." && pwd)
verify="$root/scripts/verify-carried.sh"
victim="$root/packages/core/src/evaluation/pool.ts"
intruder="$root/packages/core/src/evaluation/__selftest_intruder.ts"
backup=$(mktemp)

restore() {
	[[ -f "$backup" ]] && cp -p "$backup" "$victim" && rm -f "$backup"
	rm -f "$intruder"
}
trap restore EXIT INT TERM

fail() {
	printf 'verify-carried selftest FAILED: %s\n' "$1" >&2
	exit 1
}

cp -p "$victim" "$backup"

# Baseline: a clean tree must pass, or the rest of the test proves nothing.
"$verify" >/dev/null || fail "clean tree did not verify"

# Case 1 — modified carried file must be rejected.
printf '\n// selftest\n' >>"$victim"
if "$verify" >/dev/null 2>&1; then
	fail "a modified carried file was accepted"
fi
cp -p "$backup" "$victim"
"$verify" >/dev/null || fail "restore after modification did not verify"

# Case 2 — a file ADDED to the carried set must be rejected. sha256sum -c alone
# would not notice this; only the file-count check catches it.
printf 'export const selftest = true;\n' >"$intruder"
if "$verify" >/dev/null 2>&1; then
	fail "a file added to the carried set was accepted"
fi
rm -f "$intruder"
"$verify" >/dev/null || fail "restore after addition did not verify"

echo "verify-carried selftest passed: modification rejected, addition rejected, clean tree accepted"
