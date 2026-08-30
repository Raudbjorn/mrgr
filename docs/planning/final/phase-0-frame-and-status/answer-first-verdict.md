*Part of the [canonical planning document](../canonical-final-planning-document.md).*

## 2. Answer-first current verdict

| Question | Answer |
| --- | --- |
| What runs next? | **Correction (2026-08-30, verified on disk):** WP0's rights attestation + doc correction are already DONE — see `phase-1-m0-core-extraction/current-state.md`. The one open WP0 item is regenerating the durable clean-clone evidence artifact at current HEAD, which is small and not a real blocker on other work. **WP5 (M2a port) and WP6 (resurrection proof) are the next open streams.** H0 is done and VALID — corpus diversity, PRNG, adjudicator pinning, citation validity, and six-arm execution gates are all closed. No H0 rerun is needed. |
| What does H0 still mean? | **VALID.** The fresh 2026-08-30 run closes every acceptance gate (§7/§3.4). **Correction (2026-08-30, user-confirmed):** the three records once read as citing non-exposed IDs are non-canonical citation-tag *formatting*, not fabricated references — see `phase-3-h0-evidence-utility/current-state.md` for the corrected §3.4 entry. The count-based characterization favors full-bundle by 10.060 percentage points over hunk-only, exceeding the approved 5pp threshold. |
| Does M2a have a result? | **No.** Round 5.1 produced tooling and contracts; zero arms launched. Its artifacts are reusable source implementation for the mrgr port, not a mechanism result. |
| Is anything publishable today? | **Yes — `@mrgr/core` is publishable now.** **Correction (2026-08-30, verified on disk):** the rights attestation is already recorded and README/NOTICE are already corrected (previously this row said "after ... corrections land," implying they hadn't). The only remaining M0 item is re-deriving the durable clean-clone artifact at current HEAD. The mrgr-db/2 persistence layer is the on-disk storage; JSONL is transport. No other package is built. |
| Does an agent adapter ship? | **YES.** WP8 is open — H0 is VALID, so corpus diversity, PRNG, citation validity, and local adjudicator availability are no longer blockers. The one remaining gate is a working human/scripted adjudicator harness (§17 Q4). |
| Does the resurrection proof run? | **It runs before any oracle and before M2a residue is consumed.** The private gate reconstructs from pinned refs; the public gate uses a synthetic repository with the same topology. |
| What's the cap semantic? | **1,200 UTF-16 code units** in the carried in-memory representation. Byte counts come from the original UTF-8 bytes; mrgr-db/2 stores content-addressed preimages. |
| What's the kill-safe outcome? | If the resurrection proof fails, or the harness is shown to be advisory via the bypass test, ship @mrgr/core alone and retire the agent adapter/evidence-bundle surfaces. H0 count-based characterization favors evidence-utility (10.060pp); the kill-safe path remains reserved for the independent gates (resurrection, adjudicator harness) |

---

