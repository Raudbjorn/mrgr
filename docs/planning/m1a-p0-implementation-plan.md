# Next-phase implementation plan — `mrgr` M1a P0 (schema honesty & persistence)

> **Audience:** `/plan` consumer. Read top-down; concrete execution steps are in §3.
> **Scope:** This plan covers **only** the P0 + P1 steps from the M1a corpus-review addendum
> (`planning/mrgr/phases/m1a/integration-tests-plan.md`, 2026-08-27). It does **not** cover H0,
> M2a, resurrection proof, M1b, M2b, M3, M4, or the agent adapter. Each of those will get its
> own plan after P0/P1 land.

---

## 0. Executive verdict

**Selected next phase:** `mrgr` **M1a P0** — restore schema honesty and corpus persistence in the
carried-WP0 `@mrgr/core` module. M1a is the only phase in `STATUS.md` with a green-light to start
today, and within M1a the corpus-review addendum is explicit that the P0 schema fixes must precede
P1 tests and any H0 redesign. Verification on disk confirms M1a's reportable subset (hermetic
fixture, raw `scan-local` JSON assertions) is already green; the load-bearing open items (region
identity, bundle persistence, truncation semantics, failure preservation) are net-new code on a
frozen, byte-verified module.

**Phase ordering evidence (audited against `planning/mrgr/STATUS.md` v2026-08-27):**

| Phase | STATUS.md state | Why not next |
|---|---|---|
| M0-closure | ⚠ technical gates complete, publication blocked | Rights attestation, not code |
| F1 | ✅ fixed at `ed92803` | Already done; do not re-touch |
| H0 | 🔄 first run invalidated | Requires M1a P0/P1 to land first |
| **M1a P0** | 🔄 partially complete | **← SELECTED — gating step for every downstream phase** |
| M1a P1 | 📋 planned | Must follow P0 |
| M2a | ⬜ source groundwork stopped at candidate validation | Source passes preflight but `FRAME-LOCK.md` absent; not a code phase yet |
| Resurrection proof | ⬜ not started | Reason-to-exist gate; depends on M2a residue |
| M1b / M2b / M3 / M4 | ⬜ not started | Each waits on its predecessor's frozen artifact |
| Replay | ⬜ characterization only | No valid H0 threshold yet |
| Agent adapter | ⬜ deferred | Needs a positive H0 + a working human/scripted harness |

**Repository ground truth (`/home/svnbjrn/dev/mrgr` @ `83042b5`):**

- Monorepo workspace (`pnpm-workspace.yaml` → `packages/*`).
- Carried WP0 module lives in `packages/core/src/evaluation/` (10 source files), tests in
  `packages/core/tests/evaluation/` (12 files). The carried manifest
  (`scripts/carried.sha256`) lists 24 paths with the relative prefixes `src/evaluation/` and
  `tests/evaluation/` *from the `packages/core/` directory root* — this is the byte-fence.
- Verifications on HEAD: `git log` last 5 commits `83042b5 docs: refresh M0 evidence for ed92803`
  → `2440329 feat: initialize mrgr and extract @mrgr/core from WP0`.
- Workstation: `pnpm@11.3.0`, `node v25.1.0` (engines says `>=22.5.0` as of commit `c55d0aa` "validate ledger createdAt, correct README Node floor"; engines was `>=20` at M0 closure and was bumped post-M0 — see canonical-final-planning-document §1.3), `git 2.55.0`.
- **Working tree:** clean (no uncommitted changes reported by `git status`).

**Path-translation note — read this before touching anything.**
The M1a addendum names paths like `src/evidence.ts`, `src/forensic/core.ts`,
`src/evaluation/corpus.ts:608..728`, `src/evaluation/cli.ts:242..251`,
`tests/forensic.test.ts:73..113`, `tests/evaluation/cli.test.ts:99..108`. On disk these resolve to
`packages/core/src/evaluation/<file>.ts` and `packages/core/tests/evaluation/<file>.ts`. The
`corpus.ts` and `cli.ts` line ranges were confirmed correct for that subtree:

- `parseCorpusRecord` is at `packages/core/src/evaluation/corpus.ts:608`.
- `cli.test.ts:99..108` is `JSON.parse` capture-stderr parser; line 134 is the per-line
  schema-version equal assertion; line 181 is the second such loop. Addendum line ranges stand.

`src/evidence.ts` and `src/forensic/core.ts` do not exist — the addendum's stated sites for
`EvidenceBundleSchema` and `extractEvidenceBundle` are *new-module targets*, not existing files.
Executors must create both: `packages/core/src/evaluation/evidence.ts` (schema + bundle type) and
package the extraction entry point inside it (not a separate `forensic/core.ts` unless the work
earns it — see §3 P0 Step 1 for the fork).

---

## 1. Frame lock and source inventory

### 1.1 Source inventory (`/home/svnbjrn/dev/mrgr`, commit `83042b5b564fa88176844e20bf62a829548abdbe`)

- **Branch:** default (no `git status` output recorded, no upstream configured).
- **M0 closure file `phases/m0/closure-evidence.md`:** technical gates complete.
- **F1 fix:** commits `ced6d13` (record) and `ed92803` (fix, `--conflict-style` plumbing).
- **Carried-WP0 manifest:** `scripts/carried.sha256`, 24 paths, gated by
  `scripts/verify-carried.sh` and `scripts/verify-carried-selftest.sh`.
- **Carried source layout:** `packages/core/src/evaluation/{acquire,classify,cli,corpus,git,localize,materialize,pool,replay,report,result,types}.ts`.
- **Carried test layout:** `packages/core/tests/evaluation/{acquire,build-e2e-fixture,classify,cli,corpus,git-fixture,git,localize,materialize,replay,report,types}.test.ts`.

### 1.2 Plan corpus consulted

- `planning/README.md` — canonical entry: redirects to `planning/mrgr/README.md`.
- `planning/mrgr/README.md` — authority order: direct source > STATUS > phase plan > PLAN.md > sessions > `../docs/`.
- `planning/mrgr/STATUS.md` — milestone table + §"Next execution order" (5 steps, M1a P0 is #1).
- `planning/mrgr/PLAN.md` — annotated revision-2 plan with `🔄` markers on M1a.
- `planning/mrgr/phases/m1a/integration-tests-plan.md` — addendum governing body for this plan
  (rendered from local disk via shell; verbatim read in this session).

### 1.3 Freshness limitations

- `STATUS.md` last-updated `2026-08-27`; current date `2026-08-28`. Single-day drift is the
  planned gap; no intervening commits in `git log -10`.
- **Plan-name vs disk-name divergence.** The addendum uses pre-extraction paths
  (`src/evidence.ts`, `src/forensic/core.ts`). Either the addendum is stale, or extraction was
  partly incomplete. On disk the latter is true; this plan documents the rewrite, not the
  drift.
- **R3 truncation claim not directly verified.** Addendum asserts
  "`CAP = 1200` truncates preimages at 1,200 UTF-16 code units via JavaScript `string.length` /
  `slice`". Grep over `packages/core/src/evaluation/` finds **no occurrence** of `1200` and **no
  `CAP` constant**; `localize.ts:169` does `Buffer.concat(splitLines(blob).slice(...))` — byte
  slice, not code-unit slice. `[UNVERIFIED]` flag is applied to any executor action that
  assumes the addendum's specific truncation mechanism; the executor must locate the actual
  cap before rewriting it.

### 1.4 Working-tree state and authorship

`git status` reported no changes in the executive-verdict section. Treat uncommitted changes as
authoritative and do not discard or modify them — there are none, so this clause is a no-op
today.

### 1.5 Carried-byte fence

The schema/persistence work in §3 is **not** permitted to edit any path in
`scripts/carried.sha256` without a deliberate `--update` and a commit message naming the
intended change. Per `STATUS.md` §"Before changing code" item 3, `scripts/verify-carried.sh`
must continue to pass after P0/P1.

**Implication for §3:** if a change is needed in a file listed in `carried.sha256`, the executor
must (a) re-run `pnpm --filter @mrgr/core test` (or its equivalents below) and (b) update the
manifest with `scripts/verify-carried.sh --update` plus a commit message noting the change. The
green-light rule is the *test pass + the manifest update + the commit-message rationale*; the
change is not a stealth edit.

---

## 2. Phase 0.5 — Framing pushback

The user prompt asks for "the next part of the plan" with a single, uniquely determined phase.
That assumption holds against the current corpus: `STATUS.md` and `PLAN.md` are aligned. Three
real framings nevertheless deserve an explicit answer before drafting the plan.

### 2.1 Is "next" actually defined?

**Yes.** `STATUS.md` §"Next execution order" lists five numbered steps, M1a P0 is step 1, and
`PLAN.md` marks M1a P0 as `🔄 partially complete`. No competing candidate from the planning
corpus (or the wide staging `planning/docs/` directory) claims to be next: H0 is invalidated,
M2a has stopped source groundwork, all of M1b through M4 are downstream or feed-forward.

The `planning/docs/` directory contains **35 `.md` files** (round-3/4/5 adversarial research,
AUR/non-GumTree admission research, integration-tests-plan duplicates) plus 7 `mrgr`-directory
research artefacts. Several are titled `integration-tests-plan.md` (two copies: one in
`planning/docs/integration-tests-plan.md` and one in `planning/mrgr/phases/m1a/`). Per
`planning/docs/README.md`, `docs/` is staging corpus with superseded and stale plans; per
`planning/mrgr/README.md` §"Authority order", **`STATUS.md` and the governing phase plan outrank
it**. The `planning/mrgr/phases/m1a/integration-tests-plan.md` is read first; `planning/docs/integration-tests-plan.md` is provenance.

### 2.2 Is an implementation plan already present and sufficient?

**Partially.** The governing phase plan (`planning/mrgr/phases/m1a/integration-tests-plan.md`)
gives the architectural policy and the P0/P1 task list but not the executor-grade detail this
deliverable requires: not the exact integration-test file, not exact asserted-on values, not
the deterministic-snapshot discipline, not the failure-mode tests (`add/add`, `delete/modify`,
extraction failure). `PLAN.md` mirrors the same task list at lower fidelity. Neither names
which carried test files assert which behavior; neither pre-registers the `expect(...)` shape.
That gap is what this artifact fills.

### 2.3 Have current source or completed changes overtaken the plan?

**No.** `STATUS.md` and HEAD agree: F1 is closed, M1a is partial, M2a source groundwork stopped
on a documented `MODEL-BUILD-FRAME-MISMATCH.json` (do not re-launch M2a), H0 was already
invalidated. Working tree clean. The documented completed subset (Steps 1–3 of the addendum:
hermetic fixture, scan-local typed-JSON parse, hermetic suite passes 13+4+4 = 21 tests) is
verified-in-place by the corpus-review addendum line "Hermetic fixture coverage and raw
scan-local bundle assertions are complete". Executors must not re-do Step 1–3.

**However — two source-of-truth corrections to the addendum are required before drafting the
exact edit plan:**

- The addendum names `src/evidence.ts`; reality is `packages/core/src/evaluation/evidence.ts`
  (new module).
- The addendum names `src/forensic/core.ts`; reality is no such file exists. The P0 step that
  the addendum describes — adding `conflict_path: z.string()` to an `EvidenceBundleSchema`
  and populating it from the `conflictPath` argument in `extractEvidenceBundle` — has no
  currently-existing receiver function. Executors will create
  `extractEvidenceBundle(merge: ReplayResult, options: { conflictPath: string; ... })` in the
  new `evidence.ts`.

These are *corrections to the addendum's staging copy*, not changes to its intent.

### 2.4 Are prerequisites unresolved, making implementation premature?

**Almost none.** The single prerequisite that is **unresolved** is R5:

> R5 §"Verdict table": *"the current bundle cannot be mapped honestly to conflict regions. … `extractEvidenceBundle` returns an error whenever either parent lacks the path. `Add/add` and `delete/modify` conflicts can therefore lose the whole bundle instead of carrying a null side."*

R5 requires a region-identity choice (one bundle per `path + ordinal` *or* one file bundle with
typed `conflict_hunks[]`). The two options have materially different downstream impact:

- **Per-region bundle (path + ordinal):** smallest blast radius; matches materialized-record
  identity (`MaterializeOptions` already keys by `path + ordinal`); requires one bundle record
  per region; bundles are independently consumable by downstream `materialize`.
- **File bundle with typed `conflict_hunks[]`:** fewer records to write but couples one bundle's
  validity to a single file's full materialization; one extraction failure can lose a whole
  file's hunks unless error-preservation is mandatory per-region anyway.

This plan **commits to per-region (path + ordinal) bundles** because:

1. `localize.ts` already produces one record per region (`ConflictRegionRecord`) keyed by
   `path + ordinal`.
2. `materialize.ts` already keys by `path + ordinal`. If the bundle adopts the same key, the
   whole pipeline reads a single partitioning.
3. R5's "carry a null side" requirement only needs to be addressed at region granularity to
   add/delete a single line in the diff3 path; collapsing to file-level loses per-region
   error preservation.

R6 (schema-version increment for additive change) is also a real prerequisite: bumping
`SCHEMA_VERSION` from `2` to `3` is required before publishing v3 records. Add `v3` to
`corpus.ts` enum, validate `2` records read cleanly, and write v3 only after the schema is
frozen. Do this in P0 Step 2.

R4 (lossy `scan-local` writer) is **not** an architectural fork; it is a code fix: add
`evidenceBundles?: EvidenceBundle[]` to `CorpusRecordV2` (v3), parse it in `parseCorpusRecord`
(v3 branch), and have `cli.scanLocal` populate it.

R7 (nullable-stage semantics for absent-path vs revision-failure) requires distinguishing
`git show <rev>:<path>` exit 128 (no such path on this side) from "extraction failed for some
other reason". The existing `readBlob` in `localize.ts` collapses both into `null`; P0 must
split them via a tool-error envelope: `ok(null)` means "absent path", `err(...)` means
"unsupported / timeout / output-limit / not-found / corrupt". This is a *new* error variant
("absent-path"); add it to `ToolError.kind` and `error.types` test.

R2 (drop the `dependency_graph` hunk payload) is mechanical: rename the field if needed,
remove the `lookup` logic. Verify the field is genuinely used by `report.ts` before deleting;
if not, delete.

R3 (truncation honesty) is **UNVERIFIED**: see §1.3. Before any code change, the executor must
locate the actual cap and the actual truncation mechanism in the byte-current source. If, as
appears likely on disk, the addendum's specific claim about JavaScript `string.length` is
stale and the system already slices `Buffer`s, then R3 reduces to "make the cap constant
explicit and document its unit" rather than "stop using code-unit slice". Treat as
*verify-before-edit*.

### 2.5 What evidence would make this analysis unnecessary?

- If a schema v3 record with `evidenceBundles[]` already shipped on a commit after `83042b5` —
  the executor must `git log -p -- packages/core/src/evaluation/types.ts` and re-evaluate.
- If `Error | { absent: true }` (or equivalent nullable-stage type) already exists — verify
  with `git grep -n 'absent' packages/core/src/`.
- If `extractEvidenceBundle` already exists in the tree — re-evaluate with `git grep -n
  'extractEvidenceBundle'`. (Today's check returned zero hits.)

### 2.6 What would invalidate the selected phase?

- A new STATUS bump that explicitly deprioritizes M1a (none on file).
- A working tree where M1a is already complete (`git status` shows otherwise-clean tree; no
  branch change in `git log -10`).
- A user instruction in this conversation that overrides `STATUS.md` (none present).

---

## 3. Implementation blueprint (executor-grade)

All paths below are relative to `/home/svnbjrn/dev/mrgr` unless noted. The carried manifest is
byte-fenced; an edit to any file in `scripts/carried.sha256` requires the explicit
`--update` + commit-message discipline in §1.5.

### 3.1 Dependency graph (P0 then P1)

```
P0.1  New module: packages/core/src/evaluation/evidence.ts  (schema + extractEvidenceBundle)
  │
  ├──▶ P0.2  Extend types.ts CorpusRecordV2 (v3): add evidenceBundles + conflictHunks
  │       Extend result.ts Error kind: "absent-path"
  │       Extend types.ts: Error absent-path semantics
  │       Extend corpus.ts: parseCorpusRecord v2/v3 + SCHEMA_VERSION bump + writeCorpusV3
  │       Extend materialize.ts: pair bundles to materialized regions
  │       Extend cli.ts: scanLocal writes v3 records (and emits bundles)
  │       Extend report.ts: pass-through of bundles (verify use before deleting)
  │
  ├──▶ P0.3  R3: locate existing truncation; either fix the unit or document
  │       Locate CAP=??: grep for any literal numeric slice cap or named constant; if none,
  │       annotate absence.
  │
  ├──▶ P0.4  R2: drop serialized-extra-hunks payload from dependency_graph
  │       Verify with grep that no consumer (tests included) reads the per-hunk entries
  │
  └──▶ P0.5  R7: nullable-stage envelope — split readBlob's null-path vs error

P1.1  Tests parseCorpusRecord v3 records (not TypeScript cast)
P1.2  Tests narrow conflicted record; assert both conflicted records independently
P1.3  Preimage semantics tests (preimage vs hunk; byte counts)
P1.4  Five-triple corpus smoke test becomes runnable
P1.5  Multi-path/multi-region/add-add/delete-modify/extraction-failure/write-read round-trip tests
P1.6  Local-jq vs local-cli-cli schema equivalence (acceptance)

P2.x  Cleanup: rerun H0 discriminator ONLY after P0/P1 land and H0 redesign per
       planning/mrgr/phases/h0/independent-review.md lands. OUT OF SCOPE for this plan.
```

### 3.2 P0 — Schema honesty and persistence (8 steps)

Each step lists: target files, exact edits, exact verification, expected output.

#### P0.1 — Create the evidence module

**File:** `packages/core/src/evaluation/evidence.ts` (NEW, not in carried manifest).

Exports:
- `EvidenceBundleSchema` — Zod schema. Fields:
  - `conflict_path: z.string()` (non-empty; normalized via `resolve()`).
  - `conflict_ordinal: z.number().int().nonnegative()` — region ordinal.
  - `base_preimage: BufferLike` (`{ utf8_byte_length, truncated_bytes, content }`).
    **Delete the field**
    **`base_preimage` is a wrong design.** A bundle must carry all sides, not only base.
    Replace `base_preimage` with three optional fields: `base`, `ours`, `theirs`. Make each
    nullable when the path is absent on that side or extraction failed; carry a per-side
    `preimage_status: "ok" | "absent" | "error"` and `preimage_error?: ToolError`. Preimages
    are stored as raw bytes plus a `byte_length` field; no implicit string slicing.
  - `dependency_graph: { entries: PathDigest[]; truncated: boolean; truncation_reason?:
    "depth-cap" | "node-cap" | "exact" }`.
  - `provenance: { git_version, conflict_style, normalized_at: ISODateString, ... }`.
  - `schema_version: 3`.
- `extractEvidenceBundle(...)` — the receiver the addendum names. Signature:

```ts
async function extractEvidenceBundle(input: {
  repository: RepositoryHandle;
  merge: ReplayResult;
  baselineId: string;
  conflictPath: string;
  conflictOrdinal: number;
  conflictStyle: ConflictStyle;
  gitVersion: string;
}): Promise<Result<EvidenceBundle>>
```

Behaviour:
- For each of `base | ours | theirs`, call `readBlobWithError(rev, path)`. If
  `ok(buffer)` → write preimage bytes; if `err({kind: "absent-path"})` → set
  `preimage_status = "absent"` and the byte/null form; otherwise → preserve the error
  envelope in the bundle and mark `preimage_status = "error"`. Bundle never *throws*; it
  surfaces errors as values.
- Build `dependency_graph` from existing `selectDependencyGraph(...)` on a path-only basis
  (hunk entries excluded). Record a `truncation_reason` only when truncation actually
  occurred (compare to a longer untruncated pass; if no cheaper test, the existing
  deterministic-truncation seam is enough).
- Return `ok(bundle)`.

**Verification (must pass before merge):**
```sh
pnpm --filter @mrgr/core exec vitest run \
  tests/evaluation/evidence.test.ts  # P1.1 below creates this; at P0.1 close, run typecheck only
pnpm --filter @mrgr/core typecheck
```
Expected: typecheck passes; P1.1 lands test cases against this module in P1.

#### P0.2 — Bump schema to v3 and thread bundle through the corpus

Files and exact edits:
- `packages/core/src/evaluation/types.ts:1..170`:
  - Add `SCHEMA_VERSION` constant → bump from `2` to `3`.
  - Add `EvidenceBundleV3 = z.infer<typeof EvidenceBundleSchema>`.
  - Add `evidenceBundles?: EvidenceBundleV3[]` to `CorpusRecordV2` (or rename to `CorpusRecord`).
- `packages/core/src/evaluation/corpus.ts`:
  - Update `parseCorpusRecord` to accept v3 (retain v2 read-only acceptance: reject
    v2-with-bundles, parse v2-without-bundles as before; reject pre-v2).
  - Update `CorpusWriter.write` and `writeCorpus` to write v3 only when at least one bundle
    is present; bump `schema_version` field on each record to `3`.
- `packages/core/src/evaluation/cli.ts` (line range targets ~185..260):
  - In the candidate processing path, when `replayStatus === "conflicted"`, build
    `evidenceBundles` via `extractEvidenceBundle` (P0.1) for each `conflictRegions[*]`.
  - Persist as part of the v3 record.
- `packages/core/src/evaluation/materialize.ts`:
  - When consuming a v3 record, walk the conflict record's `evidenceBundles` and key
    bundles to materialized regions by `(conflict_path, conflict_ordinal)`. If a bundle is
    missing for a region that has hunks, propagate a structured error in
    `evidenceBundleStatus = "missing"`. The bundle must be **adjacent** to, not **inside**,
    the materialized-region type — keep types separate and emit a `bundle: EvidenceBundle |
    null` link from each region in the materialization output.
- `packages/core/src/evaluation/result.ts`:
  - Extend the `kind` enum to include `"absent-path"`. Add the same key to
    `ErrorKindSchema` / `corpus.ts` `ERROR_KINDS` set. Update the
    `parseCorpusRecord` error branch that validates `value.error.kind`.

**Verification:**
```sh
pnpm --filter @mrgr/core typecheck
pnpm --filter @mrgr/core test -- --run tests/evaluation/corpus.test.ts tests/evaluation/cli.test.ts tests/evaluation/materialize.test.ts
scripts/verify-carried.sh
```
Expected: typecheck passes; carried test subset still passes (parses old v2 fixture corpus);
manifest unchanged because the modified files are already in the manifest (the executor may
need `scripts/verify-carried.sh --update` ONLY after deliberately carrying the change).

#### P0.3 — R3: locate the existing truncation; document or fix

The addendum claims `CAP = 1200` truncates at 1,200 UTF-16 code units via JavaScript
`string.length / slice`. Direct read on disk finds **no** `1200` or `CAP` constant in
`packages/core/src/evaluation/`. The likely materialization path is the encoded JSON
serializer; verify with:

```sh
grep -rn '\.slice(' packages/core/src/evaluation/ | grep -v 'sliceRange\|slice(0,' | head -40
grep -rn 'Buffer.byteLength\|TextEncoder\|TextDecoder' packages/core/src/evaluation/
```

Possible interpretations:
1. The cap was already removed in carried-WP0 → R3 is vacuously satisfied; document the
   absence in `evidence.ts` and move on.
2. The cap exists in a specific function the addendum targets. If so, the fix is:
   - Replace any `slice(0, CAP)` on a JS string with an explicit `Buffer` byte boundary
     using the source bytes when available, or remove the implicit cap entirely.
   - Add `byte_length: number` and `truncated_bytes: Buffer | null` to the bundle; declare
     the contract in the bundle schema.
3. The cap exists but in a different unit — fix and document.

**Hard rule:** *do not modify tests to pass this gate*. Tests are partial specifications; do
not soften expectations. If the current behaviour violates the addendum's contract, the
behaviour must change; if it satisfies it, document why R3 is closed.

**Verification:**
```sh
# Grep evidence: archive grep results into docs/M1a-P0-R3-truncation-audit.md
mkdir -p docs
PNPM=pnpm
$PNPM --filter @mrgr/core exec node -e '
  process.stdout.write(require("fs").readFileSync(
    "packages/core/src/evaluation/localize.ts","utf8"
  ).split("\n").filter(l => /truncat|prefix|CAP|1200|slic/i.test(l)).join("\n"))
'
```
Expected: at least one audit record. If zero hits, file `docs/M1a-P0-R3-truncation-audit.md`
with the grep transcript and a one-paragraph absence justification.

#### P0.4 — R2: drop the serialized-extra-hunks payload from `dependency_graph`

**Files:** `packages/core/src/evaluation/corpus.ts`, `packages/core/src/evaluation/report.ts`.

Inspect first:
```sh
grep -n 'dependency_graph\|dependencyGraph' packages/core/src/evaluation/{corpus,report,types}.ts
grep -n 'lookupPreimageHunks\|hunkLookup\|hunkEntries' packages/core/src/evaluation/{corpus,report,types}.ts packages/core/tests/evaluation/*.test.ts
```

If any consumer or test reads the per-hunk entries: keep the field optional and rename to
`legacy_hunk_payload` with a deprecation comment; alternatively, ask the user (recorded in
`Open questions for the human` §6). Otherwise delete and re-export `dependency_graph` as a
path-only node set.

**Verification:**
```sh
pnpm --filter @mrgr/core test -- --run tests/evaluation/corpus.test.ts tests/evaluation/report.test.ts
```
Expected: both suites pass; consumers (if any) updated.

#### P0.5 — R7: nullable-stage envelope (split null vs error)

**Files:** `packages/core/src/evaluation/localize.ts` (readBlob at the bottom of the
modular list), `packages/core/src/evaluation/result.ts`, `packages/core/src/evaluation/types.ts`.

Edit:
- Add `"absent-path"` to the `ToolError.kind` enum in `result.ts` (alongside the existing
  `"not-found"`, distinguishing "no such path on this revision" from "repository not found").
- In `localize.ts:readBlob` (~line 295 of 339 lines), when `git show` exits 128 on
  `path-not-found` (parse stderr for `does not exist`/`Not a valid object name`), return
  `err({ kind: "absent-path", ... })` rather than `ok(null)`. Otherwise leave the `ok(null)`
  semantic unchanged for `add/add` round-trip cases (P1.5 covers this).
- `extractEvidenceBundle` consumes the new variant and surfaces it as
  `preimage_status = "absent"` while keeping the rest of the record valid.

**Verification:**
```sh
pnpm --filter @mrgr/core test -- --run tests/evaluation/localize.test.ts tests/evaluation/evidence.test.ts
```
Expected: localized-error tests stay green; add/add tests pass with `preimage_status =
"absent"` on the new side without dropping the bundle.

#### P0.6 — Schema tests for parseCorpusRecord v3

**Files:** `packages/core/tests/evaluation/corpus.test.ts` (extend, do not rewrite).

Add a new `describe("CorpusRecord v3")` block (not a new file) covering:
1. A v3 record with `evidenceBundles: [valid_v3_bundle]` round-trips through
   `CorpusWriter` + `parseCorpusRecord`.
2. A v2 record without bundles parses as v2 (read-only).
3. A v2 record **with** bundles is rejected with a structured error (cannot mix versions).
4. A v3 record with a bundle whose `conflict_path` doesn't match any region is rejected
   with `corrupt-corpus`.
5. A v3 record with two bundles for the same `(conflict_path, conflict_ordinal)` is
   rejected.
6. A bundle whose `preimage_status === "absent"` on one side parses cleanly with the
   other two sides present.

**Verification:**
```sh
pnpm --filter @mrgr/core test -- --run tests/evaluation/corpus.test.ts
```
Expected: 6 new passing tests; total counts now reported in SUMMARY output.

**Test discipline:** do not skip negative cases; do not weaken error-string equality to
`expect.stringContaining`. Each test must fail on a plausible mistake (wrong kind, wrong
field, wrong ordinal).

#### P0.7 — Independent lockstep test for scan-local v3 output

**Files:** `packages/core/tests/evaluation/cli.test.ts` (extend).

Add a test that:
1. Sets up an in-memory Git repo with two conflicted paths (use existing
   `build-e2e-fixture` driver; assert exact mode `git merge-tree` for determinism).
2. Calls `cli.ts scan-local` → JSONL bytes.
3. **Does not** use `JSON.parse(...).schemaVersion` (per R1 of addendum). Walks the output
   line-by-line and re-runs each through `parseCorpusRecord(value)` (the actual boundary).
4. Asserts: each parsed `record.conflictRegions.length > 0`; for at least one region,
   `evidenceBundles.length === 1` and `evidenceBundles[0].conflict_path ===
   record.conflictRegions[0].path`.
5. Asserts round-trip: `CorpusWriter.write(record)` produces JSON containing the same
   bundles (string-equal for the bundle block).

**Verification:**
```sh
pnpm --filter @mrgr/core test -- --run tests/evaluation/cli.test.ts
```
Expected: ≥4 new tests pass; existing `cli.test.ts` tests pass without modification.

#### P0.8 — Carry-byte gate: re-run `scripts/verify-carried.sh`

**Files:** none (gate script only).

```sh
scripts/verify-carried.sh
```
Expected:
```
carried modules verified: 24 files unmodified
```
or, if P0 deliberately modifies a carried file, the executor must `scripts/verify-carried.sh
--update` and add a commit message that names the change. **Empty or non-substantive changes
to the manifest are a hard error.** Do not "refresh the manifest" without a real change.

### 3.3 P1 — Load-bearing tests

#### P1.1 — `extractEvidenceBundle` semantic tests

**Files:** `packages/core/tests/evaluation/evidence.test.ts` (NEW).

Tests must cover:
- `preimage_status = "ok"` on all three sides (clean merge with dirty sides).
- `preimage_status = "absent"` on a single side (path missing in ours but present in theirs).
- `preimage_status = "error"` on a side that times out (use the fake-`git` mechanism from
  `git.test.ts` if reusable; otherwise inject at the `runGit` boundary via `gitBinary`).
- `add/add` (both sides absent in base, both sides present) → both preimages populated.
- `delete/modify` (path deleted on one side) → that side marked absent, bundle still
  written.
- Determinism: three same-input runs produce byte-identical bundles.

**Verification:**
```sh
pnpm --filter @mrgr/core test -- --run tests/evaluation/evidence.test.ts
```

#### P1.2 — `parseCorpusRecord` Trust-boundary test

**Files:** `packages/core/tests/evaluation/corpus.test.ts` (extend).

Add cases:
- v2 record with no bundles (from `local/jq` fixture) parses without modifying the bundle field
  (omitted).
- v3 record rejects extra unknown fields (write a v3-compatible record with
  `extra_junk: "x"`; must error `parse: invalid-corpus-record-shape`).
- A bundle with `conflict_path === null` is rejected.
- Conflict-region count and bundle count must differ by 0 across the round-trip when the
  writer has run.

**Verification:**
```sh
pnpm --filter @mrgr/core test -- --run tests/evaluation/corpus.test.ts
```
Expected: 4 new tests; existing tests untouched.

#### P1.3 — Local-`jq` regression test

**Files:** `packages/core/tests/evaluation/cli.test.ts` (extend).

Temp-rename `local/jq`, observe `pnpm test` result, restore. The test must pass without
flagging `local/cli-cli`. Add a true regression: scan `local/cli-cli` with a small known-good
fixture and assert the v3 record's `evidenceBundles[0].conflict_path` matches an expected
path list literal (no regex).

**Verification:**
```sh
pnpm --filter @mrgr/core test -- --run tests/evaluation/cli.test.ts tests/evaluation/localize.test.ts tests/evaluation/materialize.test.ts
```
Expected: full targeted suite passes; the regression specifically asserts at least one
`conflict_path` literal.

#### P1.4 — Five-triple corpus smoke test (runnable)

**Files:** `packages/core/tests/evaluation/corpus.test.ts` (extend).

The addendum says "the five-triple `forensic-corpus-smoke.json` artifact is not referenced
by a runnable test". Add:

```ts
it("runs the five-triple smoke and asserts source semantics, not lengths", async () => {
  const fixture = JSON.parse(
    await readFile("tests/evaluation/fixtures/forensic-corpus-smoke.json", "utf8"),
  ) as unknown[];
  for (const value of fixture) {
    const parsed = parseCorpusRecord(value);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) continue;  // type-narrow only
    expect(parsed.value.conflictRegions.length).toBeGreaterThan(0);
    expect(parsed.value.conflictRegions[0].localizationStatus).toMatch(/^(exact|ambiguous)/);
  }
});
```

If the fixture file does not exist, either skip with a clearly named `it.skip` and a
commented TODO referencing the addendum, or copy the file from the carried-WP0 source it
came from (path: `semantic-merge/tests/evaluation/`). Do not invent a new fixture.

**Verification:**
```sh
pnpm --filter @mrgr/core test -- --run tests/evaluation/corpus.test.ts
```

#### P1.5 — Multi-path / multi-region / add-add / delete-modify / extraction-failure / round-trip

**Files:** `packages/core/tests/evaluation/materialize.test.ts` (extend) and the new
`evidence.test.ts` (P1.1).

Tests must cover, with explicit records:
- A record with two regions on different paths and matching bundles; full `materialize`
  emits a region for each, each with the `bundle: EvidenceBundle | null` link.
- `add/add`: bundle has both `ours` and `theirs`; `base` is `preimage_status = "absent"`.
- `delete/modify`: bundle has `delete_side` marked absent; the non-deleted side is
  populated.
- Extraction failure: `preimage_status = "error"` on a side; bundle still surfaces an
  error envelope; `materialize` does **not** crash and reports a per-region error in its
  own output.
- Round-trip: write a record with bundles, read it back via `readCorpus`, run
  `materialize`, and assert the materialized output references the same bundles by
  content hash.

**Verification:**
```sh
pnpm --filter @mrgr/core test -- --run tests/evaluation/materialize.test.ts tests/evaluation/evidence.test.ts
```
Expected: a clear pass/fail per category.

#### P1.6 — Acceptance: lockstep local/jq vs local/cli-cli schema

**Files:** `packages/core/tests/evaluation/cli.test.ts` (extend).

Use both fixtures (if `local/cli-cli` does not exist, document its absence and skip with a
named skip block). Assert that the JSON produced by `scan-local` on either fixture has
identical v3 schema keys for the same conflict shape.

**Verification:**
```sh
pnpm --filter @mrgr/core exec vitest run tests/evaluation/cli.test.ts
```

### 3.4 Cleanup sequence (mandatory, same turn as final commit)

Per `STATUS.md` §"Before changing code" item 4: "Run the changed path before claiming it
works." A partial P0 that does not run end-to-end is not done.

- `pnpm --filter @mrgr/core typecheck`
- `pnpm --filter @mrgr/core test` (full carried suite)
- `scripts/verify-carried.sh` (with `--update` only if P0 modified a carried file
  deliberately)
- Update `docs/M1a-evidence-bundles.md` to record: v3 schema added; `evidenceBundles`
  wired through scan-local and `parseCorpusRecord`; preimage semantics
  (absent/error/ok); region-identity chosen (per-region per §2.4); truncation audit
  outcome (R3, per §1.3 — verified or fixed).
- Append a `## M1a P0/P1 closure (date)` note to `planning/mrgr/STATUS.md` per the existing
  format. **Do not claim M1a complete until §"Resurrection proof"and the agent-adapter
  sequence are explicitly addressed in the closure file.**

### 3.5 STOP conditions and falsifiers

**Hard STOPS:**
- Test edits to make any check pass. The executor must not edit `tests/...` to weaken
  expected values; if a test blocks P0 the *implementation* is wrong, not the test.
- Manifest "refresh" without a named change. Calling
  `scripts/verify-carried.sh --update` over a no-op edit is a hard error and forfeits the
  closure.
- Skipping a step that the addendum lists (R1 through R8). If a step is discovered to be
  unfounded, the executor must record the discovery in `docs/M1a-evidence-bundles.md` and
  move on, not skip.
- Merging P0 with any H0/M2a/agent-adapter commit. P0 is its own commit stream. Rebase
  before merge.

**Falsifiers — observations that would prove the implementation wrong:**
- A `parseCorpusRecord` pass that returns a record whose `evidenceBundles[i].conflict_path`
  cannot be found in `record.conflictRegions[*].path + "." + ordinal` after a write/read
  round trip.
- A materialized output that drops a bundle's preimage contents when the byte length is
  well below the truncation cap.
- A test that asserts `expect(getX()).toBe(DEFAULT_X)` without a `expect(DEFAULT_X).toBe(<literal>)`
  companion — vacuous under mutation (this is the load-bearing pattern from `debt` in
  `PLAN.md` §7).
- A v3 record that is silently accepted by `parseCorpusRecord` when its bundle's
  `preimage_status = "absent"` field is missing on at least one absent side.

### 3.6 Risks, edge cases, mitigations

- **Risk:** P0 changes break the carried fixture in `local/jq`. **Mitigation:** run
  `pnpm --filter @mrgr/core test` after each step; revert on green-loss and isolate the
  cause. Per `STATUS.md` §"Before changing code", do not claim a step works until the
  targeted suite passes.
- **Risk:** The schema v3 is not accepted by downstream consumers reading v2. **Mitigation:**
  retain v2 read-only path (`parseCorpusRecord` accepts v2 without bundles; v3 with
  bundles; rejects v2-with-bundles). Document in `docs/M1a-evidence-bundles.md` that
  v3-only writes happen for new records.
- **Risk:** Per-region key collision in `materialize`. **Mitigation:** assert uniqueness in
  P1.5 (round-trip test); add a single ordinal-per-path invariant to the schema.
- **Risk:** Hindsight/llama context overflow if `evidenceBundles` triples record size on a
 1,200-record corpus. **Mitigation:** add `Buffer.byteLength(JSON.stringify(bundles))`
  guard or a stream-only reader; defer optimization to a follow-up, but record the
  observation.
- **Risk:** Truncation cap (R3) in a unit other than documented. **Mitigation:** R3 audit
  file (`docs/M1a-P0-R3-truncation-audit.md`) records what the cap actually is, in what
  unit, before any change is made.

### 3.7 What to skip (and why)

- **Skip pre-publication rights attestation work.** That is M0-closure, not M1a P0.
- **Skip any change to `mergr`'s resurrection-proof logic.** That is a separate phase.
- **Skip H0 redesign.** It depends on P0/P1 finishing.
- **Skip M2a source re-launch.** Stop was documented; the executor should not regenerate
  arms without a `FRAME-LOCK.md`.
- **Skip the agent adapter, MCP surfaces, or four-surface parity.** Deferred.
- **Do not** introduce new abstraction layers (e.g., a "bundle factory") without at least
  two concrete call sites demanding it. Plan is to ship one minimal `extractEvidenceBundle`
  function. Pre-empting future reuse is speculative.

### 3.8 Non-goals (explicit)

- Not refactoring `replay.ts` or `localize.ts` beyond what R5/R7 strictly require.
- Not implementing `ast-grep` entity extraction (M1b).
- Not building the `@mrgr/ledger` package (M4).
- Not running H0 with the new schema; H0 redesign is its own task.
- Not publishing a v3 npm package. Publishing requires the rights attestation and a public
  gate per `PLAN.md` §0.
- Not modifying `tests/...` to make any test pass. If a test blocks P0, the implementation
  is wrong; the test stands.

---

## 4. Source / citation ledger

| ID | Path / Section | Evidence class |
|---|---|---|
| S1 | `planning/README.md` | direct read |
| S2 | `planning/mrgr/README.md` | direct read |
| S3 | `planning/mrgr/STATUS.md` v2026-08-27 §"Milestone status" and §"Next execution order" | direct read |
| S4 | `planning/mrgr/PLAN.md` Sequence §0..§10, markers | direct read |
| S5 | `planning/mrgr/phases/m1a/integration-tests-plan.md` "Status: Partially complete" + revised-implementation-order sections | direct read |
| S6 | `planning/mrgr/findings/F1-exact-localization-unreachable.md` — `--conflict-style` fix landed at `ed92803` | direct read |
| S7 | `scripts/verify-carried.sh` (byte-fence logic) | direct read on disk |
| S8 | `scripts/carried.sha256` — 24 paths | direct read on disk |
| S9 | `packages/core/src/evaluation/corpus.ts:608` `parseCorpusRecord` (line confirmed) | direct read |
| S10 | `packages/core/tests/evaluation/cli.test.ts:39,134,181` (parser locations for the addendum claim) | direct read |
| S11 | `git log --oneline -10` from `/home/svnbjrn/dev/mrgr` (HEAD `83042b5`, closure commits `1942085` / `1fe1847`, F1 commits `ced6d13` / `ed92803`) | shell evidence |
| S12 | `pnpm --version` (`11.3.0`), `node --version` (`v25.1.0`), `git --version` (`2.55.0`) | shell evidence |
| S13 | `grep -rn 'EvidenceBundle\|conflict_path\|conflict_hunks\|extractEvidenceBundle' packages/core/` returned zero matches | negative evidence |
| S14 | `grep -rn '1200\|CAP' packages/core/src/evaluation/` returned zero matches | negative evidence (R3 unverified) |
| S15 | `planning/mrgr/phases/h0/independent-review.md` — governs any H0 redesign | referenced, not re-read this turn |
| S16 | `planning/mrgr/phases/m2a/round5-merge-mechanism-refreeze-plan.md` — preserves Round 5.1 source groundwork | referenced, not re-read this turn |

External sources (none required for P0/P1; the addendum is the design source):
- None. The P0 work is structural to a TypeScript module whose public surface is local; no
  external API or library research is needed. **If a future executor change touches an
  external library (zod, tsx, vitest), re-run a `librarian` agent against the new version.**
  Library version pins today: `pnpm@11.3.0`, `node>=22.5.0` (bumped from `>=20` post-M0), `typescript@^5.5`,
  `vitest@^3.2.7` (bumped from `vitest@^2.0` post-M0), `tsx@^4.16`, `zod@^4.4.3`. Per the audit no upgrade is required. **Note:** this plan was authored against `vitest@^2.0`; the actual current pin is `vitest@^3.2.7` per `package.json` — see canonical-final-planning-document §1.3.

---

## 5. Open questions for the human

These decisions were not made by the planning corpus; defer to the user when execution hits
them:

1. **Deprecation policy for the carried `dependency_graph` legacy field.** Plan §3.2 P0.4
   sketches deletion; if a downstream consumer outside `packages/core/src/` (e.g., a private
   Orca-class study) reads it, the executor cannot detect that without your input. Decision
   needed: delete outright, keep as read-only with a deprecation comment, or carry a
   compat-shim emit.
2. **Schema version bump policy on every additive change** (R6). Plan §2.4 commits to
   bumping `SCHEMA_VERSION` on the v2→v3 transition. The corpus does not name a policy for
   v3→v4. If the executor prefers a single-version-bump rule across all of M1a/M1b/M2,
   they should adopt `MrgrHarnessPlanCritique.PlanThesis` revision-2's pattern.
3. **Whether to expose the v3 schema in the docs.** `docs/M1a-evidence-bundles.md` is a
   status note; a separate `docs/schemas/v3.md` may be wanted at publication. Out of scope
   for P0/P1 but the closure file should name the decision.
4. **Unit preference for R3 truncation (when the cap is real).** Bytes vs UTF-8 vs UTF-16
   code units vs lines: the schema must declare one. The corpus does not pick; an
   authority order is needed (likely bytes, matching `Buffer`).
5. **Bundle lifetime in the materialized output.** Plan §3.2 P0.2 puts the bundle adjacent
   to the region, not inside the region type. Some downstream consumers prefer in-region
   (simpler access). Confirm before the materialization tests ship.
6. **Status field for `evidenceBundles` in the schema.** Plan §3.2 P0.6 mandates rejection
   of unknown fields; if a forward-compat additive policy is preferred (accept-then-warn),
   document it.
7. **Whether to ship a `pnpm --filter @mrgr/core pack` tarball as part of M0-closure**
   separately from P0. Plan is silent on P0 publishing; defer.

---

## 6. Phase 4 — Adversarial self-attack

Every load-bearing claim and step above was stress-tested before finalization.

### 6.1 Misreading risk (status markers, document hierarchy)

- **Could "next" be `H0` instead of `M1a`?** No: `STATUS.md` §"Next execution order" puts
  M1a P0 at step 1; H0 redesign follows at step 3 and explicitly depends on M1a P0+P1.
  PLAN.md markers agree (`🔄 partially complete` on M1a; `🔄 first run invalidated` on H0).
  The current order is unique.
- **Could the carry manifest have changed?** `wc -l scripts/carried.sha256` is `24`; the
  git log near the closure commits shows the manifest was deliberately seeded at 24. The
  executor must re-verify with `scripts/verify-carried.sh` before claiming P0 done. Risk:
  low; control: P0.8 mandatory.
- **Could a planning claim in `docs/` outrank `STATUS.md`?** Per
  `planning/mrgr/README.md` §"Authority order", `STATUS.md` outranks `docs/`. Re-stated
  explicitly in §2.1.

### 6.2 Partial-implementation / conflicting-dependency check

- **Could `EvidenceBundle` already exist on a branch I don't see?** `grep -rn
  'EvidenceBundle' packages/core/` returned zero. `git log -10` shows no post-HIT
  candidates. Risk: low.
- **Could `extractEvidenceBundle` live outside `packages/core`?** `find / -name
  'evidence.ts' -not -path '*/node_modules/*'` returned only `semantic-merge/src/evidence.ts`
  (a 432-byte types stub, not the addendum's `EvidenceBundleSchema`). Risk: low; the file is
  there but its content is unrelated; the new module has to be authored fresh.
- **Could `pnpm-lock.yaml` have a stale `vitest` version that fails P1?** The carried
  `vitest@^3.2.7` pin (as of 2026-08-29; was `vitest@^2.0` when this plan was authored — see canonical-final-planning-document §1.3) allows minor upgrades; the carried suite passes today per the addendum.
  New tests must target the same surface (no new plugin).

### 6.3 Smaller / native / stdlib solution

- **Could `Buffer.toString("utf8").length` replace a `string.length`-based cap?** Yes, and
  this is the spirit of R3; the executor does not need a new library. Status of R3 is
  `UNVERIFIED`; the audit will resolve.
- **Could the schema be expressed in TypeScript types instead of Zod?** The carried code
  uses both types and ad-hoc parsing. The addendum mandates Zod-style validation
  (`EvidenceBundleSchema` is named like a Zod export). For consistency with the addendum,
  do not switch parsers; the existing pattern is fine.
- **Could `extractEvidenceBundle` collapse into `localize.ts`?** No: `localize.ts` already
  has one job per function, and bundling mixes concerns. Keeping it as a new module is
  right-sized.

### 6.4 Verification: circular / weak / environment-dependent

- **Test-suite green doesn't prove P0.** It only proves the tests pass. The P0.6 / P1.5
  acceptance criteria add: round-trip integrity of
  `conflict_path` ↔ `path + "." + ordinal`, byte length of preimage payload matches
  `preimage.byte_length`, all three sides surfaced on a clean merge. These are not in the
  current carried suite, which is why P1 is its own phase.
- **Preimage byte-length test is hardware-independent.** It depends only on fixture bytes
  in `build-e2e-fixture`. No I/O race conditions in fixtures.
- **Fake `git` test for timeouts** uses `git-fixture.ts` already. If P1.1 requires a new
  fake, prefer the existing helper. Document if not.
- **`scripts/verify-carried.sh` is on `packages/core/`.** That means the executor must
  `cd` into it explicitly when running `--update`. The plan's commands above use absolute
  paths via `scripts/verify-carried.sh` from repo root (it is `cd` self-anchoring); this
  is verified by the head of the script.

### 6.5 Concurrency / security / compatibility / performance / data loss / rollback

- **Concurrency:** bundles share JSON shape; no shared mutable state.
- **Security:** preimages are local bytes; no new surface for adversaries. The
  `extractEvidenceBundle` reads via `runGit`, which is already sandboxed.
- **Compatibility:** v3 changes affect anyone reading v2 records. `parseCorpusRecord` v2
  read-only path keeps backward compat for legacy readers. Writer emits v3 only on new
  records.
- **Performance:** record size grows by `(preimages × 3 + dependency_graph)`. The plan
  adds no implicit cap; truncation is honest.
- **Data loss:** None; the writer reads/throws; the reader rejects.
- **Rollback:** revert via `git revert` of the P0/P1 commit stream. No schema migration
  table for v2 consumers exists, but v2 readers will fail closed.

### 6.6 Rejected alternatives

- **Reject "ship H0 redesign first".** H0 leak prevention requires real preimages (per
  the addendum), which is exactly what M1a P0/P1 produces. Order is locked.
- **Reject "delay M1a P0 until M2a source runs".** M2a depended on
  `FRAME-LOCK.md`; M2a source groundwork is paused. Independent track.
- **Reject "drop v3 entirely, v2 read only".** R6 (additive schema change) and R2
  (drop serialized hunks) are spec-driven; reverting those regressions while continuing
  to claim M1a complete is incoherent.
- **Reject "build a new schema crate".** TypeScript-only modules; no polyglot scope.
- **Reject "introduce a `bundle` namespace package".** Single-file move (`evidence.ts`)
  is enough.
- **Reject "ship via the agent adapter first".** Agent adapter is deferred.

### 6.7 What could surprise a later reviewer

- **Path divergence** between the addendum and disk. The reviewer will ask why
  `src/evidence.ts` and `src/forensic/core.ts` are not in their `carried.sha256`
  references. Answer in the closure file: the addendum is staging; the canonical layout is
  `packages/core/src/evaluation/evidence.ts`.
- **Schema version bump mid-M1a.** Reviewers may expect a single v2→v3 transition
  policy. The plan scopes that decision to a single bump for now.

---

## 7. Meta-observation

Three things surprised this analysis:

1. **Path drift.** The addendum's `src/evidence.ts` and `src/forensic/core.ts` were both
   absence-on-disk. The most likely failure mode of "executing the addendum verbatim" is
   creating files outside the carried layout, which `scripts/verify-carried.sh` will
   silently tolerate (the script only checks files *listed* in the manifest). The plan
   commits the new module to `packages/core/src/evaluation/evidence.ts` and treats
   `forensic/core.ts` as a non-target (the work moves into the new `evidence.ts`).
2. **R3 unverified.** The plan treats R3 as audit-then-edit. The most likely outcome is
   "the addendum's truncation claim refers to a code path that has since been changed or
   never made it into this branch"; the grep evidence on disk supports this. The plan's
   R3 step is an audit, not an edit, by default — and only becomes an edit if the audit
   finds a real cap.
3. **H0 dependency.** `STATUS.md` is unusually explicit: H0 must follow M1a P0/P1. The
   plan respects this. Without respecting it, the agent-adapter sequence gets rebuilt
   against a stale schema — the exact failure mode `STATUS.md` warns about.

**LLM bias threats to this plan:**
- **Plausibility-as-evidence.** The risk is high here because the addendum mentions
  `fetchPreimage`/`git show <parent>:<path>`. I did not find a function of that exact
  name; the actual `readBlob` is byte-`Buffer`-based. The plan honours that finding and
  flags R3 as UNVERIFIED, not as fact.
- **Smoothing contradictions.** The plan separates "what STATUS.md says" from "what the
  addendum specifies" from "what the disk contains" and surfaces the conflicts in §1.3
  and §2.4.
- **Sycophancy gradient.** The framing was loaded toward "M1a P0 is next because
  STATUS.md says so" — which is correct, but I cross-checked against the carried manifest,
  the schema grep results, and the carried test counts to confirm the framing survived the
  load.
- **First-pass convergence.** The obvious answer is "do M1a P0". The plan commits to that,
   but the next move down the obvious path is "write all the bundled tests in one go";
   instead the plan splits P0 (schema/persistence) from P1 (new tests) and refuses to
   combine them, on the explicit addendum instruction that P0 must come first.

**Confidence:** **high** for the existence and ordering of M1a P0 as the next phase,
**high** for the path-translation between addendum and disk, **medium** for the
region-identity recommendation (the addendum presents it as a fork; the executor must be
prepared to re-decide if new evidence arrives), **low** for any claim about R3 (see §1.3,
plan flags as UNVERIFIED).

---

## 8. Parking lot (out of scope)

These surfaced during analysis but do not belong in this round:

- H0 redesign and re-run. Addressed separately.
- M2a source re-launch; `FRAME-LOCK.md`; `MODEL-BUILD-FRAME-MISMATCH.json` resolution.
- Resurrection proof (M2a residue required).
- M1b entity extraction; ast-grep pinning policy.
- M4 ledger package; Halt/Decision/Resurrection record schema.
- M3 verification gates; replay characterization; D74-D96 ID collisions.
- Agent adapter; MCP surfaces; four-surface parity.
- M0-closure rights attestation (publication prerequisite).
- Updating `mergr` docs README/NOTICE for `survey`/`mergebase`/etc. (M0-closure concern).
