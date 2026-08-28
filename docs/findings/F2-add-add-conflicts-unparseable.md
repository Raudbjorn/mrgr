# F2 — add/add conflicts were silently unparseable

**Status:** confirmed, **fixed** in the same change that introduced per-region
evidence bundles.
**Found:** while writing an add/add test for M1a, by running it rather than
reasoning about the regex.

## Observation

An add/add conflict — both sides create the same path, neither has it at the
merge base — produced `No diff3 conflict markers found` and yielded no evidence
bundle at all. The extraction reported a `parse` error as though Git had emitted
nothing usable.

Git had emitted a perfectly ordinary conflict.

## Cause

Git writes an add/add conflict with an **empty base section**:

```text
<<<<<<< 1fe1bf0...
ours
||||||| d41e07d
=======
theirs
>>>>>>> 31b3715...
```

There is nothing between `|||||||` and `=======`. Verified directly with
`git -c merge.conflictStyle=diff3 merge-tree --write-tree` on a two-sided add.

The section-splitting regex was:

```text
/^<<<<<<<[^\n]*\n([\s\S]*?)\n\|\|\|\|\|\|[^\n]*\n([\s\S]*?)\n=======\n([\s\S]*?)\n>>>>>>>/
```

Each capture is followed by a **mandatory** `\n` before the next marker. For a
non-empty section that newline is the one ending its last line. For an *empty*
section there is no such newline — the only newline present is the one already
consumed by `[^\n]*\n` at the end of the `|||||||` marker line. The pattern
therefore cannot match, `parseDiff3Regions` returns `[]`, and the caller reports
"no markers found" for a file that visibly has them.

The same failure applies to any empty section, so a conflict where one side is
empty was equally invisible.

## Why it survived

The only test exercising the parser used a three-way modify/modify fixture,
where all three sections are non-empty. The one shape that breaks the pattern
was never constructed. This is the same failure mode as F1: a capability
verified only under the configuration that happens to work.

## Fix

Each capture absorbs its own trailing newline instead of requiring one before
the next marker, and a single delimiting newline is stripped afterwards so
non-empty sections keep their previous values exactly:

```text
/^<<<<<<<[^\n]*\n([\s\S]*?)\|{7}[^\n]*\n([\s\S]*?)={7}\n([\s\S]*?)>{7}/
```

An empty section now captures `""`. Marker runs are also pinned at exactly
seven characters rather than six-plus-anything.

## Blast radius

Every add/add conflict in every corpus extracted before this fix produced no
evidence. In the H0 corpus that is silent: the affected regions appear as
absent rather than as failures, because the extractor's error was discarded by
the caller — the defect F2 hides behind is the one P0 item 6 fixes, by making a
failed extraction a recorded `status: "failed"` row instead of an omission.

The two defects compound: a parse failure that is never written is
indistinguishable from a region that was never attempted.

## Not claimed

- No count of how many add/add conflicts exist in the committed H0 corpus. The
  old pipeline did not record its failures, so the number is not recoverable
  from the artifacts — only by re-extracting, which is now possible.
- `zdiff3` was not tested against this pattern. It compacts common lines out of
  the base section and may produce section shapes this regex has never seen.
