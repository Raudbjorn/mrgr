# H0 v3 acquisition and inference audit — round seven

The [inventory](development-inventory.json) now contains **22 fresh admitted cases across nine verified lineages**, leaving 38 cases before the development matrix can run. Four new Go Playground Validator cases pass three reference executions and reject two compiling wrong resolutions each in [full admission](batch-admission/). Whole-inventory event/content/parent checks pass. No solver calls were made. **MEASURABLE=NO.**

This round also found an unresolved inference defect: the current percentile interval materially under-covers in simulated 12-cluster designs. Confirmation must not be frozen or interpreted using that method until the uncertainty procedure and its operating characteristics are repaired. A tested jackknife candidate is retained for research but is **not adopted by the primary runner**.

## Acquisition

The [source record](acquisition.json) covers 24 additional repository histories: four deliberate additions and a [frozen 20-repository batch](batch-frame.json) selected from the existing pinned Go CSV. Batch selection uses pre-2018 creation, recorded size below 5,000 KiB, exclusion of already acquired remotes and named documentation/example categories, and original star order. These are transparent feasibility criteria, not probability sampling or verified test-quality scores.

The existing native batch scanner replayed these histories. In total, they yielded **3,073 merge replays and 686 localized hunks**, including 195 hunks from the 20-repository batch. Raw scans, materializations, repository HEADs, source hashes, zero-yield repositories and [screening failures](screen-summary.json) are retained. Four Validator events passed admission: `0c80f876cd4555db9c7e7620b89ebaac21bf2884`, `1f676c755a550efeea73eac3f3982af598a5933c`, `ae8ecbca8aba7345da68c58062985ab816d54c5d`, and `e6eee3ea885ae132bdfc7e2c75b03456f72a22c4`.

## Empty parent hunks

The batch included 22 production-code hunks with an empty parent side. The old acquisition/retrieval path rejected these because an empty string cannot locate a unique source span. The revised retrieval policy explicitly records `empty-parent-hunk-no-context` for that side and retrieves from the other side using the same existing rules. It does not invent a source position or substitute the historical answer. Missing parent files and non-text input remain invalid; native Git reproduction and executable admission remain mandatory. The method identifier is now `syntax-ranges-and-identifier-candidates/2`.

All ten [runner checks](runner-checks.txt) pass, including empty-hunk handling, no invented context and rejection of null parent input. The [acquisition checks](screen-checks.txt) pass. The complete development cohort must be prepared again with the final instrument; previous admission snapshots remain archived.

## Prospective interval audit

Few-cluster inference needs specific scrutiny; the number of independent clusters matters, and no universal threshold makes all clustered intervals reliable. [Cameron and Miller's primary guide](https://faculty.econ.ucdavis.edu/faculty/cameron/research/Cameron_Miller_JHR_2014_July_09.pdf) discusses these problems and finite-cluster adjustments. [MacKinnon, Nielsen and Webb](https://arxiv.org/html/2301.04527v2) develop cluster jackknife and bootstrap alternatives, including the CV3 variance formula in equation 18 and Student-t reference distributions. Those sources motivate candidate methods; they do not validate this project's estimator automatically.

The [runnable audit](../v3-inference-audit.mjs) generates paired binary outcomes with a known population mean difference of zero, independent repository effects and fixed cluster sizes. Each scenario uses 1,000 simulated studies. The current pairs-cluster percentile method uses 2,000 bootstrap resamples per study. These are instrument checks, not empirical merge cases or evidence of context benefit.

| Scenario | Current percentile coverage | Candidate CV3-t coverage |
|---|---:|---:|
| 12 equal clusters, no repository effect shifts | 91.1% | 94.0% |
| 12 equal clusters, independent ±25pp shifts | 92.4% | 94.7% |
| 12 unequal clusters, all within 15% cap, ±25pp shifts | 91.1% | 91.3% |
| 50 equal clusters, ±25pp shifts | 95.2% | 96.1% |

[Original interval results](inference-coverage-audit.json) and [candidate results](inference-jackknife-audit.json) include Monte Carlo Wilson intervals, seeds and source hashes. The original audit source is preserved with a verified matching hash in `inference-audit-pairs-v1.mjs`. The primary interval implementation used by this audit is archived in the batch admission instrument. The original 12-cluster coverage intervals exclude 95%; the unequal-cluster jackknife interval does too. The candidate's balanced results are compatible with nominal coverage at this simulation precision, not proof of universal calibration.

The [candidate implementation](../v3-inference.mjs) computes an intercept-only CV3 cluster jackknife variance and uses tabulated Student-t critical values, conservatively capping degrees of freedom at 30. The [independent numerical table](student-critical-values.json) records SciPy 1.18.1 values rounded upward. [Runnable checks](../v3-inference.test.mjs) verify a fixed variance, ordering, single-cluster handling, invalid input and deterministic simulations; [results](inference-checks.txt) pass. Passing these implementation checks does not remove the candidate's observed calibration failure.

## Required next evidence

Continue the 60-case development acquisition and model matrix, while repairing inference before confirmation. Evaluate a defensible correction or a more balanced cluster allocation against independently seeded simulations, uneven allocation, heterogeneous effects and least-favorable nulls of the full two-model conjunction. Validate the exact primary method and its power calculation together. The present audit checks marginal interval coverage; it does not yet establish joint false-positive rates or sufficient confirmation power.

Do not adopt the jackknife candidate merely because it improves some scenarios, treat more bootstrap iterations as a cure for finite-cluster bias, or count simulated rows as acquired evidence. The effect thresholds, two-provider replication, independent confirmation requirement and original minimum cluster/concentration constraints remain intact. Phase 4's completed independent integration and Phase 5's separate resurrection proof remain unchanged.
