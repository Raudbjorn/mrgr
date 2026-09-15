# Ornith-1.5-9B selector pilot closeout

The primary is **INCOMPLETE**: the bounded acquisition exhausted 100 repositories
and 791 merge replays without admitting a fresh case. All four required cells
remain empty; **zero held-out model requests** were made. This is not a model
quality null, an efficacy estimate, or proof that admissible cases do not exist.
The original Q8 secondary is **INCOMPLETE (secondary execution)**: its launcher
attempted to change `RuntimeMaxSec` through `systemctl set-property`, which the
installed systemd rejected before any GPU work.

The separately authorized post-failure fidelity diagnostic is reported below.
It does not reopen either experiment or Phase 3.

## What completed

The 9B LoRA training admitted 57 of the 60 source examples after three length
exclusions: three epochs, 45 optimizer steps, about 815 seconds, approximately
11 GiB peak allocated device memory, and approximately 1.1 million trainable
parameters. Frozen-weight, save/reload and disabled-adapter checks passed.
These are training/deployment feasibility checks, not evidence of useful selection.

The final trained adapter—not the earlier three-step feasibility adapter—was
converted to GGUF. Its SHA-256 is
`8aab71e8edbddabe6f04f23dcf6e2095c3e192a5f4a9dfeed7ba1758b1f95bce`.
The original stochastic pipeline check completed 16 requests on eight training
cases, with valid selector JSON and matching prompt-token accounting. Base-only
and adapter-scale-zero deployment probes matched. No inference about efficacy
is made from that in-sample check.

Q8_0 base conversion completed in about 58 seconds, producing 9,786,060,160 bytes,
SHA-256 `533a2d9577b499f073c8972b14e25e7a69b39dbaca86b971a000650ce235cb9a`.
The preregistered Q8 amendment is commit `6f830274c56f0beb2fc6be4229769171e1570ae9`;
its committed hash precedes all potential held-out requests. No such requests
subsequently occurred.

## Post-failure fidelity diagnostic

**Inconclusive under the predeclared thresholds.** All 32 scored requests
completed with no infrastructure missingness. Target matching means parsed
candidate choice equals the training label, including a correct `halt`; it is
not the same as proposing an oracle-passing merge replacement.

| Base / adapter | Training-target matches | Oracle-passing selections | Format failures | Abstentions |
| --- | ---: | ---: | ---: | ---: |
| Q4_K_M / disabled | 2/8 | 2/8 | 0 | 0 |
| Q4_K_M / enabled | 4/8 | 3/8 | 0 | 1 |
| Q8_0 / disabled | 3/8 | 3/8 | 2 | 0 |
| Q8_0 / enabled | 5/8 | 4/8 | 0 | 1 |

Q8 with the adapter did not reach the required >=6/8 target matches, although it
exceeded Q4's count. This neither confirms nor rules out the proposed NF4-to-Q4
mismatch explanation. These are eight previously trained/inspected cases, with
one greedy request per setting, not an independent efficacy estimate. The two
Q8 base-format failures count as unsuccessful assigned attempts, not missing data.

The new diagnostic used the existing base and final adapter hashes, identical
messages, no-thinking mode, temperature zero and top_k one. Both base-only versus
zero-scale probes passed. The native unit's two-hour deadline was set at launch;
no runtime property update was attempted. A preflight rejected the inherited
24 GiB training guard before any run existed; the inference-only amendment then
fixed a 16 GiB available-RAM requirement and 16 GiB host cgroup cap for both bases.
The cap was reached by accounted memory during execution; completion under this
cap is observed, not a claim that it never induced memory reclaim or affected
latency. No system-wide swap or memory setting was changed. The ordinary service
was restored and checked healthy. The failed original secondary was not restarted.

## Acquisition and remaining instrument losses

The 159 reason rows mix pre-screen **hunk** exclusions and attempted **event**
screens; they are not 159 independent cases. The 51 `one-hunk-per-event-screen`
rows skip additional hunks after a hunk was selected. They do not mean the
protocol excludes every event containing multiple conflicts.

| Recorded reason | Rows |
| --- | ---: |
| Outside production Go | 76 |
| Additional hunk from an already selected event | 51 |
| Package has no test files | 8 |
| Fewer than two available mutations | 6 |
| Missing parent, empty reference or reference-size limit | 2 |
| Tests did not reject two compiling mutants | 1 |
| Reference behavioral failure (requires detail below) | 5 |
| Missing/pinned/module dependency acquisition failures | 6 |
| Target-span parse error | 2 |
| Multiple merge bases without selected base metadata | 1 |
| EISDIR read failure | 1 |

The five reference-failure receipts contain detailed stage logs, even though the
reason-summary rows omit them:

| Repository / event | Observed failure | Bounded interpretation |
| --- | --- | --- |
| caddyserver/caddy `b216d285` | `qtls.CertificateRequestInfo` incompatibility with `tls.CertificateRequestInfo` during package initialization | Dependency/toolchain compatibility failure before behavioral tests |
| go-resty/resty `0953f5ac` | External 120-second evaluator timeout, SIGTERM, during retry-delay tests | Reference did not complete under the timeout; not an observed failed behavior assertion |
| go-resty/resty `dd8bec80` | Same timeout class during retry-delay tests | Same limitation; a second event, not independent evidence about model quality |
| ibm/sarama `af26fcd3` | `localhost` lookup attempts DNS at `[::1]:53` and fails in the isolated environment | Sandbox name-resolution failure |
| google/go-github `c2ddceba` | `TestNewRequest_invalidJSON` expected `json.UnsupportedTypeError` but received no error | Observed assertion failure under this toolchain; historical-toolchain causality not established |

The EISDIR, parser, dependency, timeout and environment losses remain documented;
this closeout does not fix them and acquire another frame. Low observed yield
under these rules and this implementation cannot establish a population yield or
justify an estimate of thousands of repositories.

## Protocol and provenance corrections

The acquisition frame enforced 100 repositories, at most ten events each, and
1,000 total replays. The copied config value `acquisition_events=200` was stale;
791 replays exhausted the repository frame first. Requests used the frozen 9B
sampler with `top_k=40`, not the copied config's stale value 20.

The primary repair edited two tracked instrument files. Exact executed repository
inputs were preserved before later repairs in commit `3b503d56f`, including
otherwise ignored compiled JavaScript. [The snapshot manifest](executed-instrument.json)
and [verification receipt](instrument-verification.json) bind all 67 protocol
entries to their exact bytes. Branch HEAD intentionally contains the later
launcher repair; it must not be described as the historical executed instrument.
These snapshots preserve historical code, not a standalone runnable checkout.

[The receipt manifest](receipt-manifest.json) records separate original and
exported hashes for portable derivatives. Public receipts replace declared local
path prefixes; they do **not** claim byte identity with the private originals.
Raw model/dependency caches, weights and repository mirrors stay outside Git.

## Validation

[Validation receipt](validation.json): repository typechecks, full test suite,
builds, carried-file verification and negative self-test passed. Eleven stdlib
Python orchestration checks and the pinned-environment training-loss regression
passed. All 187 exported receipt hashes and 67 committed historical instrument
entries were verified; new documentation links resolve. The diagnostic unit
exited successfully and the ordinary service returned healthy. Archived unit
status/journal receipts precede reset of the stale failed experiment units.

## Terminal scope

The primary and original secondary remain closed incomplete regardless of the
new diagnostic's direction. No additional acquisition, retraining, cross-validation
or held-out inference follows. Future changes require a new protocol.

## Not claimed

No held-out efficacy or generalization result; no causal proof that NF4-to-Q4
mismatch erased the adapter; no representative repository yield; no repair of
all screening limitations; no safety guarantee for merged code; no reopening of
the retired Phase 3 gate. The diagnostic uses inspected training examples and
finite oracle labels. New local state consists of diagnostic receipts and
portable evidence exports; no new package dependency was installed.
