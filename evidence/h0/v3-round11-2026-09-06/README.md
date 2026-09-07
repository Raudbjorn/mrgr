# H0 v3 acquisition — round eleven

**MEASURABLE remains NO.** No new solver calls are made during this acquisition.

The [frozen frame](batch-frame.json) contains the remaining 80 repositories under the existing pinned Go-list size, creation-date and name filters, excluding all earlier frames and known remotes. [Native replay](scan-summary.json) completed 6,158 merge events and localized 670 hunks, 412 in production Go files. This exhausts that particular filtered acquisition frame, not the available universe of historical merge cases.

The [completed screen](screening-summary.json) exercised 67 eligible cases: four passed and 63 were excluded. Three cases pass full admission: [JSON parser](jsonparser-admission/), [Maddy](maddy-admission/) and [Ozzo Validation](ozzo-admission/). JSON parser required a new preparation after a recorded metadata-fetch failure. Each admitted case passes three reference runs, rejects two compiling mutations, and has verified Git/scaffold provenance, repository lineage, genuine parent context and frozen deterministic baselines.

Prometheus failed all three reference executions in [checkpoint admission](checkpoint-admission/) despite passing its first screening execution. It is excluded. The failed control outputs and all other [screening receipts](screening-receipts/) remain preserved. The earlier execution checkpoint records a historical observation of live jobs; those jobs have now completed.

The [verified inventory](development-inventory.json) contains **38 fresh cases across 19 lineages**, leaving **22 development cases**. No new solver calls were made.

This completes the batch; the convenience sample is not representative of all projects. Solver development and confirmation remain unstarted. The original effect thresholds, both-provider replication, separation of development and confirmation, and round-eight inference constraints remain in force.

The earlier below-5,000-KiB acquisition frame is exhausted. [Round twelve](../v3-round12-2026-09-06/README.md) broadens repository size prospectively while preserving all admission and effect requirements.
