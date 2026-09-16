# Exact step-two control replacement: precondition stop

**INCOMPLETE (environment fingerprint drift).** The amendment and revalidation
implementation were committed as `074d2adb0` before freezing or attempting the
controls. The run stopped at the exact environment check: **zero control
evaluations, zero training runs, zero model requests**. The ordinary service and
host packages were untouched.

Expected environment: `208b44c2e8fd352ce1b81b8efda8083fea5d0261177fc8adfc40b474af624b73`.
Current environment: `490ca53c6c634f2266e672f57b2bae0c21fd199fdbcbc459a500e0fda1726db8`.

The reason is narrower than a demonstrated toolchain change. The evaluator hashes
all `pacman -Q` entries. Reversing only SABnzbd, Sonarr and graft inventory changes
**in memory**, while retaining current tool binary paths/hashes and Node version,
reproduces the expected hash exactly. [environment-explanation.json](environment-explanation.json)
records that check. No packages were changed and no falsified inventory was
supplied to the evaluator. This proves the identified metadata changes account
for the fingerprint difference; it is not an executed oracle-equivalence test.

The user-approved protocol explicitly requires exact environment equality and
stops on drift. That rule was enforced rather than silently narrowed. The
replacement `step := 2` remains untested. It has not repaired admission yet.

[freeze.json](freeze.json), [execution.json](execution.json), and
[result.json](result.json) retain the new attempt separately from the old audit.
[manifest.json](manifest.json) gives original and portable-export hashes.
The complete nine-control sequence and unchanged-candidate check are implemented
but were not reached. The classifier regression rejects timeouts, signals,
completion-only failures, build failures, missing test failures and unrelated
panics, while accepting an ordinary assertion failure after compilation.

## Consequence

No five-fold training is started. Configuration/budget/service-lease execution
repairs remain deferred. A continuation must explicitly replace the whole-host
inventory-equality requirement with a justified, pinned oracle-environment
contract before rerunning; repeated attempts under this unchanged contract
cannot succeed. Downgrading unrelated host applications is not part of this work.

## Not claimed

No control revalidation success, LoRA result, model-quality null, observed compiler
change, or causal effect of the unrelated applications on the oracle. The
metadata reconstruction is explanatory only. The 57-case cohort and all earlier
receipts remain unchanged; no fallback or new experiment was launched.
