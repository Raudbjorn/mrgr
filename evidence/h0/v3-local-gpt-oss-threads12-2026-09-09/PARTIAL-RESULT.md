# GPT-OSS local run — closed incomplete, 2026-09-12

**User-terminated after an operational failure. Do not resume.** 782 of 1,440 planned requests completed (54.3%); 658 were not executed. The incomplete study does not establish the planned effect, a null result, or a Phase 3 gate outcome.

| Outcome | With candidates | Hunk-only |
|---|---:|---:|
| Completed | 391 | 391 |
| Behavioral pass | 132 (33.8%) | 98 (25.1%) |
| Build failure | 113 | 163 |
| Truncated | 114 | 95 |
| Invalid output | 20 | 21 |
| Test failure | 12 | 13 |
| Abstention | 0 | 1 |
| Not executed | 329 | 329 |

The completed-attempt, unadjusted pass-rate difference is +8.70 percentage points for candidates. This is descriptive: repeated attempts are not independent cases, the randomized schedule is incomplete, and the planned full-grid analysis was not run. Unexecuted requests are missing evaluations, not model failures. Conservative full-planned-denominator success bounds are 18.3–64.0% for candidates and 13.6–59.3% for hunk-only; these are missing-outcome bounds, not confidence intervals. No significance or superiority claim follows.

## Why it ended

At 2026-09-12 01:57:59 UTC, the evaluator stopped on the whole-machine environment fingerprint, following the 01:51:50 WebStorm installation. The server remained healthy. The stop was discovered during the requested status check at 18:59:33 UTC, approximately 17.03 hours later. The watchdog recorded local failure state but provided no effective user-visible notification or recovery from this class of stop. That unattended operational design was inadequate for this run.

One earlier server-disconnect exchange is preserved separately from its successful retry. No further transport failures were recorded. The server-recovery amendment did not cover changes to the package inventory. The user rejected continuing after the prolonged unnoticed stoppage and instructed that results be recorded as they stood. The dependency-check repair was abandoned before deployment; no new inference or oracle re-evaluation was performed in this closure.

## Preserved evidence

- [PARTIAL-RESULT.json](PARTIAL-RESULT.json): all 1,440 scheduled slots, completed outcomes, missing slots, per-arm counts, usage, inference time and retry accounting.
- [PARTIAL-ARTIFACT-HASHES.json](PARTIAL-ARTIFACT-HASHES.json): hashes of the recorded responses, oracle evaluations, attempt histories and frozen inputs.
- [record-partial.mjs](record-partial.mjs): reproducible read-only verification of source receipts and generation of the partial summary. It checks schedule/request identity, usage, candidate hashes and oracle receipt consistency; it runs no model inference or tests.
- Original run/state.json and FAILURE.json retain the failure timestamps and fingerprint mismatch. They are not relabeled as successful completion.

The benchmark remains stopped, the watchdog timer is stopped, and run/DRAIN prevents accidental continuation through the existing runner. The healthy llama-server is left available. Original response, evaluation, protocol, schedule and recovery-amendment files are unchanged. This closure does not alter earlier Phase 3 findings or authorize Phase 4/5 claims.
