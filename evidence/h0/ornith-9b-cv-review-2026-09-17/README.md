# PR 18 admission review correction — 2026-09-17

**INCOMPLETE. 26 of 57 cases lack two verified ordinary assertion rejections.**
This is an offline reinterpretation of existing receipts. Zero control executions,
training runs, model requests, or service changes occurred.

| Saved control outcomes | Count |
| --- | ---: |
| Compiled; ordinary exit 1 with explicit Go test failure | 72 |
| Exit 2 with panic and test failure output | 31 |
| Exit 2 with init panic, no test-run output | 10 |
| External timeout (including three failure lines before hanging) | 1 |
| Total mutation controls | 114 |

The September 16 Python audit's **113 verified rejections is withdrawn**. It did
not inspect stdout/stderr. The old JavaScript predicate's 69 also understated
ordinary rejections: it rejected caught/logged panic text and failure markers
appearing after log output. The shared classifier yields 72. Panic cases are
unverified under the ordinary-assertion control rule, not evidence that a mutant
is correct. The timeout likewise remains incomplete despite its failure lines.
No case was dropped or reclassified as a model-quality null.

[audit.json](audit.json) includes all 57 cases and complete saved control stages,
including stdout/stderr. [manifest.json](manifest.json) binds the new export to
its private source bytes, original public audit hashes and current classifier.
[inputs.json](inputs.json) adds configuration, training protocol and revision
metadata to the original 61 inputs. Local path prefixes are redacted. The original
September 16 JSON files remain byte-for-byte unchanged.

The audit checks the training protocol's tokenized hash, tokenization's prepared
hash, checkpoint revision, complete pinned CV configuration, historical sampler,
ordered regenerated prompts, candidate identities/labels, and distinct control
names **and** candidate hashes. It reads checkpoint metadata; it does not rehash
all model shards or certify a future training environment. The earlier wording
“All 61 original input hashes” meant those 61 listed artifacts only, not every
artifact needed to train. Candidate availability remains 47/57 and is descriptive
of historical labels, not a validated efficacy cohort.

## Code and execution boundary

- One dependency-free `mutant-disposition.mjs` supplies the maintained Go screen,
  LoRA admission/preparation, Python CV audit (via Node), and repair predicate.
  Frozen `v3-data.mjs` and historical `v3.mjs` semantics are not rewritten; their
  `oracle.valid` alone is never sufficient for maintained LoRA admission.
- Node regression checks pass without a core `dist/` tree. PR head `f972d0eb0`'s
  CI failure was this PR's early test import, not the separate main dependency
  mismatch. The latter remains a separate repository-wide check failure.
- Audits atomically reserve a new directory, preserve per-row errors, use explicit
  checks under Python `-O`, and never automatically overwrite public evidence.
  The explicit exporter refuses an existing destination. The closed audit CLI
  exits nonzero even if diagnostic checks pass: it cannot authorize training.
- The sole control-repair attempt already terminated before any controls.
  `repair_control.mjs freeze/run` now unconditionally exits nonzero and writes
  nothing. Removing the unsafe unused executor eliminates editable-freeze,
  caller-directory retry, unenforced deadline, false-PASSED/finally and concurrent
  execution paths. This is retirement, **not a repaired executable continuation**.
  The original implementation remains in commit `074d2adb0` and frozen receipts.
  There is no correction-receipt consumer because no successful correction exists
  and this protocol is closed.

## Protocol decisions remain open

The later [control amendment](../../../docs/planning/final/phase-3-h0-evidence-utility/lora-experiments-2026-09-08/ornith-9b-control-repair-2026-09-16.md)
superseded only its named case's admission stop, conditional on successful
revalidation. It subsequently stopped on its own environment precondition.
Neither document currently authorizes continuation. This correction changes no
preregistered control, cohort, fold assignment, environment rule, or budget.

The provisional case-balanced folds remain as originally specified. With an
equal-lineage primary estimand, fold 0 has one of 32 lineages (13 cases); fold 3
has no blend/GOPATH case. A new protocol must explicitly retain or change this
allocation and state the resulting scope. No silent rebalance was made.

The whole-package-inventory fingerprint remains the historical environment rule.
A new protocol must define a feasible environment identity and reserve/validate
its scope-wide attempt before execution. The prior unrelated package drift does
not license narrowing that rule retroactively. Acquisition, oracle revalidation,
fold training and GPU jobs remain stopped.

## Review disposition

| Findings | Disposition |
| --- | --- |
| 1 | Early Node test no longer imports compiled core; checked without `dist/`. |
| 2, 6, 7, 8 | Shared classifier, raw stages, distinct control identities; corrected offline counts. Maintained LoRA admission no longer trusts the historical `valid` flag. |
| 3, 5, 12, 14 | Closed executor removed; freeze/run always fail before writes. No editable freeze, late success assignment, unbounded retry or deadline path remains executable. Historical receipt bindings are preserved, not retroactively manufactured. |
| 4 | New-directory-only audit and explicit export; no overwrite or successful-repair consumer. A consumer belongs to a new authorized protocol. |
| 9, 13 | Independent guard checks, synthetic complete audit, missing receipt, duplicate output, optimized Python and CLI tests; explicit exceptions and retained grouping failures. |
| 10 | Complete hash-pinned configuration; tokenized/prepared linkage; checkpoint revision and metadata; ordered prompt equality; expanded inputs. Full checkpoint shard validation remains a training gate. |
| 11, 15 | Separate precedence clarification; original preregistration bytes retained. Fold/environment decisions deferred explicitly to a new protocol. |

The historical environment-explanation receipt remains historical: its generator
and complete package-list snapshot were not recovered in this change. No new
independent reproduction of that attribution is claimed. It cannot authorize
changing the environment guard. The current correction needs only saved oracle
receipts, not that explanation.

## Not claimed

No CV efficacy/generalization result; no fresh observation, new admission,
revalidated oracle, tested replacement mutant, full checkpoint verification, or
working execution coordinator. No new runtime package dependencies. New state is
an immutable diagnostic export, complete CV configuration snapshot, and explicit
closed-command behavior. Node is required for the Python classifier bridge and
is already part of this repository's CI/runtime.

