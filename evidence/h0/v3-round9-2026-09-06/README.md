# H0 v3 acquisition — round nine

**MEASURABLE remains NO.** This acquisition round does not make solver calls or supply evidence of selected-context benefit.

The [frozen frame](batch-frame.json) takes the next 30 eligible repositories from the existing pinned Go CSV, excluding the previous frame and known acquired repositories. The rule preserves the previous size, creation-date and name filters. This is a convenience feasibility frame, not a representative sample of software projects.

[Native replay](scan-summary.json) completed 3,325 merge events: 3,206 clean, 117 conflicted and two unrelated. [Materialization](batch-triples.jsonl) yields 357 hunks, including 243 in production Go files. Hunks and replay records are not independent validated trials. Screening uses one eligible hunk per merge event, up to 12 per repository, before any solver outcomes.

## Extraction repair

The original screen used `git archive`, which respects `export-ignore` and `export-subst`. Gobuster's committed attributes omit tracked files, causing full-scaffold provenance validation to reject the extracted directory. The original source and every failed receipt are preserved. The acquisition helper now extracts exact tracked Git blobs, preserving binary contents, executable modes and symlink targets, while retaining path and symlink containment checks. Unsupported tree entries are rejected. The [regression check](extraction-checks.txt) exercises ignored files and literal substitution markers as well as binary, mode and symlink preservation.

All 30 original screens froze the [same pre-fix source](screen-source-provenance.json). Only the two recorded Gobuster extraction failures are re-screened in a new directory with the fixed helper. This does not retry model answers or change test assertions. The behavioral instrument and effect thresholds are unchanged.

## Execution status

The [original screen](screening-summary.json) exercised 35 eligible cases: two passed and 33 were excluded. The [extraction recheck](extraction-recheck-summary.json) recovered one Gobuster candidate; the other candidate passed provenance but failed its original tests. All processes completed.

Three cases pass full admission: Cron `470ac64214586d0702fa4de01803228f211f30f2` (`parser.go`), Gobuster `a6751986209dece1b387803ebc7423a93c38256a` (`libgobuster/libgobuster.go`) and Gopsutil `fcc1747d9f5d49d2adfbee20e3605af2aee13928` (`cpu/cpu.go`). Their receipts are in [first admission](first-admission/), [second admission](second-admission/) and [Gopsutil admission](gopsutil-admission/). Each has three passing reference executions, two compiling mutation rejections, Git/scaffold provenance, lineage verification, genuine parent context and frozen deterministic baselines. Gopsutil initially failed two metadata fetches; those receipts remain preserved, and a subsequent successful endpoint read justified its new preparation attempt. No model answer was retried.

The [combined inventory](development-inventory.json) now contains **25 fresh cases across 12 lineages**, leaving **35 cases** for development. The private candidate manifest is hash-bound in that inventory. Full-cohort preparation and the Mercury-2/MiniMax-M3 development matrix remain outstanding. Confirmation still requires its separately frozen, powered 400–2,000-case cohort with at least 50 balanced lineages. Neither acquisition success nor a mutation-sensitive oracle demonstrates selected-context superiority.
