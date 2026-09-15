# Post-failure fidelity diagnostic and terminal pilot closeout

Authorized by the user on 2026-09-15, after both original jobs terminated and
before this diagnostic generates outputs. This explicitly permits one new
**diagnostic**, not a retry of the failed secondary held-out study. The original
Q8 amendment is commit `6f830274c56f0beb2fc6be4229769171e1570ae9`.
Executed repository inputs were preserved in commit `3b503d56f` and an exact-byte
snapshot manifest before the launcher repair.

The primary remains INCOMPLETE: 100 repositories, 791 replays, zero admitted
cases in all four cells, zero held-out requests. Instrument/environment losses
remain unresolved. The secondary remains INCOMPLETE (secondary execution):
`systemctl set-property --runtime ... RuntimeMaxSec=...` was rejected before GPU
work. Neither outcome is a model-quality null or proof of population scarcity.

Run the identical eight in-sample cases with the pinned Q4_K_M and Q8_0 bases,
each with the final trained adapter at scales zero and one: **32 scored requests**.
Use unchanged messages, no-thinking template, output/context budgets, seed policy
and sampler, overriding only temperature to zero and top_k to one. Count parsed
selector choices matching the training target; report valid-output, missing and
abstention counts separately. Deployment probes are additional, unscored requests.

Keep the previous numerical reading: Q8 adapter matches >=6/8 and exceeds Q4
adapter matches supports the registered quantization hypothesis; <=2/8 means
fidelity is not established; intermediate results are inconclusive. Incomplete
instrumentation cannot be interpreted using these cutoffs. This is a small,
in-sample **deployment-precision sensitivity diagnostic**. It does not identify
NF4 as ground truth, isolate a causal quantization mechanism, establish that an
adapter is inert, or provide efficacy/generalization evidence. Do not rewrite or
pool the primary or secondary outcomes based on it.

Set the native unit deadline **at launch**, to min(two hours, remaining cumulative
72-hour budget). No runtime timeout-property mutation. Require an idle service,
exclusive GPU lock and available host RAM; do not flush swap. Restore the ordinary
service on successful exit, failure or timeout. Preserve exchanges and terminal
receipts, with the existing single identical-input infrastructure retry policy.
No additional diagnostic launch, new acquisition, retraining, cross-validation or
held-out evaluation is authorized by this closeout. Archive results and close
regardless of direction, including an incomplete diagnostic.
