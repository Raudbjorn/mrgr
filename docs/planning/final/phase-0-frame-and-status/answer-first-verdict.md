*Part of the [canonical planning document](../canonical-final-planning-document.md).*

## 2. Answer-first current verdict

| Question | Answer |
| --- | --- |
| What runs next? | **Correction (2026-08-30, verified on disk):** WP0's rights attestation + doc correction are already DONE — see `phase-1-m0-core-extraction/current-state.md`. The one open WP0 item is regenerating the durable clean-clone evidence artifact at current HEAD, which is small and not a real blocker on other work. **WP5 (M2a port) and WP6 (resurrection proof) are the next open streams.** H0 is done and VALID — corpus diversity, PRNG, adjudicator pinning, citation validity, and six-arm execution gates are all closed. No H0 rerun is needed. |
| What does H0 still mean? | **VALID and NULL — two separate claims.** VALID: the run is clean (`_aggregate.ts`'s any-flag fabrication rule mechanically computes `invalid` on 3 citation-formatting records; human review of 2026-08-30 overrides that — `evidence/h0/INVALIDATION-RULE.md`'s recorded exception). NULL: the acceptance gate was executed 2026-08-30 and not met. Validity was measured; positivity never was. Read `significance_verdict` in the aggregate, not `verdict`, for whether the hypothesis held. |
| Does M2a have a result? | **No.** Round 5.1 produced tooling and contracts; zero arms launched. Its artifacts are reusable source implementation for the mrgr port, not a mechanism result. |
| Is anything publishable today? | **Yes — `@mrgr/core` is publishable now.** **Correction (2026-08-30, verified on disk):** the rights attestation is already recorded and README/NOTICE are already corrected (previously this row said "after ... corrections land," implying they hadn't). The only remaining M0 item is re-deriving the durable clean-clone artifact at current HEAD. The mrgr-db/2 persistence layer is the on-disk storage; JSONL is transport. No other package is built. |
| Does an agent adapter ship? | **No. Retired 2026-08-30.** H0's acceptance gate was executed and not met (no arm beats the best trivial baseline; `arm_only = 0`), firing WP4's preregistered STOP rule. WP8 and `@mrgr/evidence-bundle`-as-a-package are retired, not deferred. They reopen on one named condition only — fix `isHistoricalMatch`'s normalization so a blended resolution can score correct, re-run the frozen corpus, clear the gate. See `../phase-3-h0-evidence-utility/current-state.md`. |
| Does the resurrection proof run? | **It runs before any oracle and before M2a residue is consumed.** The private gate reconstructs from pinned refs; the public gate uses a synthetic repository with the same topology. |
| What's the cap semantic? | **1,200 UTF-16 code units** in the carried in-memory representation. Byte counts come from the original UTF-8 bytes; mrgr-db/2 stores content-addressed preimages. |
| What's the kill-safe outcome? | **Partly taken already.** H0's null retired the agent adapter and evidence-bundle surfaces on 2026-08-30; `@mrgr/core` is what ships. The remaining kill-safe triggers are independent: if the resurrection proof fails, or the harness is shown to be advisory via the bypass test, `@mrgr/core` ships alone on those grounds too. The 10.060pp count-based characterization that once appeared here favoured evidence utility and was superseded — it compared two model arms, not an arm against the trivial baseline the gate names. |

---

