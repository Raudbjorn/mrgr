*Part of the [canonical planning document](../canonical-final-planning-document.md).*

## 7. H0 redesign requirements (preventing repetition of the invalidated experiment)

The five defects must be addressed by construction, not by post-hoc reporting:

1. **No answer leakage.** Audit every prompt for `triple.resolution`, `triple.*`, or any string that contains the developer's merge output. If the system prompt mentions "developer's resolution," it must be abstract; the only path to that text is via an evidence-id retrieval that the grader verifies.
2. **Real preimages or explicit truncation.** Either deliver full parent files (uncapped) via `git show <parent>:<path>` and `Buffer.byteLength(original, "utf8")` for the original byte count, or deliver prefix + `preimage_truncated: true` + `original_byte_length` + truncation flag. No arm is labelled "full preimage" unless `preimage_truncated: false` is asserted.
3. **Trivial baselines.** `keep_ours`, `keep_theirs`, `compose` (current asymmetric grader rule), and one hand-coded heuristic run as standalone arms. The kill condition is computed against the best trivial baseline's wrong count, not zero.
4. **Independent trials.** With `temperature: 0.0` the three repeats are not independent. Use `temperature > 0` (e.g., 0.7) and report per-triple correct as a binary vector; aggregate with a paired test against the constant baseline. Do **not** sum identical per-run counts.
5. **Reachable kill rule.** Define magnitude + significance. A valid positive is "arm correct on ≥N more triples than the best trivial baseline at Fisher exact p < 0.05." The kill branch's numerator/denominator must be non-zero by construction; verify by hand that the kill condition fires when both arms return null against the best baseline.

Additional binding constraints from the corpus review:
- Frozen corpus of 20–30 exact-localized, dev-resolved conflicts across ≥3 repos and ≥2 languages; the Orca arm corpus is contaminated and reported separately, never pooled.
- Pinned model + recorded SHA (in code: `H0_MODEL_TAG` + `MODEL_SHA` constants in `_h0_runner.ts`; **not** via `ollama show` — this host has no Ollama); pinned Node, llama-server, OS versions.
- Resumable runner with atomic rename (`umask 077`, `mktemp` beside the file, `flock` for shared access).
- Three-arm cost accounting: `wrong:halt` cost ratio derived from data after the run, not preregistered.
- Predicted outcome (Rover/ConGra direction) written down *before* the run so the data can refute it; a null H0 is recorded, not re-run to reach positive.

---
