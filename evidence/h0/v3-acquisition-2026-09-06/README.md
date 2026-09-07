# H0 v3 data acquisition — 2026-09-06

**ConGra is acquired and its published checksum passes. There are zero newly validated behavioral cases.** The archive supplies a substantial sampling frame; it does not by itself satisfy the 60-case development admission requirement. No paid model calls were made in this lane.

The [machine acquisition receipt](acquisition.json), [11,051 candidate mappings](congra-candidates.jsonl), and [existing-source inventory](existing-source-inventory.json) separate acquired source data from usable experimental evidence. Candidate mappings are provisional until their individual Git provenance is checked.

## Acquired primary sources

The [official ConGra repository](https://github.com/HKU-System-Security-Lab/ConGra/tree/c33fc916536497da754e2c0dd6376bce9e921456) names Figshare file 46967428 and its expected MD5. [Figshare article 26011636](https://api.figshare.com/v2/articles/26011636), published 2024-06-11 by Qingyu Zhang, Liangcai Su, Kai Ye and Chenxiong Qian, reports CC BY 4.0 for the dataset. Original source-project licenses must still be recorded per admitted revision. The GitHub repository tree has no LICENSE file.

| Observation | Verified result |
|---|---:|
| Archive bytes | 2,370,920,171 |
| MD5 | `869a312f577adcfe3a8654314a56d2a3` |
| SHA-256 | `65a339779d7cde042f78b3eb6bc421ee38b129d9986eb452bd5237f132d83ef8` |
| Archive members | 314,059 |
| Uncompressed payload bytes | 11,300,876,446 |
| Raw project directories | 35 |
| Raw case directories | 11,234 |
| Project commit-map files | 32 |
| Case directories with a corresponding map row | 11,051 |
| Cases missing a project map | 183 |
| Validated executable behavioral cases | 0 |

Archive project directories are not necessarily independent repositories. The paper's 34-project count differs from the 35 raw directory names; neither count is a count of eligible confirmation clusters. Missing maps affect mysql (114 cases), llvm (17) and php (52); these are excluded from direct mapping pending independent recovery. The complete member stream contained only regular files and directories, with no absolute paths, parent traversal or links. Only metadata and one case were selectively extracted. Full extraction would consume most remaining disk space.

The initial `figshare.com/ndownloader/files/46967428` endpoint returned an AWS WAF challenge. The official alternate `https://api.figshare.com/v2/file/download/46967428` succeeded. A bounded download was resumed once and the completed file matched the published checksum. It is retained at `.do-not-commit/h0-v3-acquisition/figshare-download-response`; raw member inventory, metadata, sample files and the isolated Git repository are beside it. The filename is historical and the bytes are the verified gzip archive.

## Actual provenance and oracle gaps

Raw files are organized by project and `conflict_files_N`, with a/b/base/resolved/merged/merged_without_base/regions subdirectories. Names are flattened; source-relative paths must be recovered by Git blob matching, rejecting ambiguous matches. A separate project-level `conflict_pair_list` contains three SHA-1 values per row. The interpreted columns are merge, first parent, second parent, with zero-based N. This interpretation was independently verified on Keras case 56; other candidate rows are not yet individually verified.

The [Keras provenance check](keras-provenance-check.json) fetches merge `f27c5b05003713db6a5691570a4539acfce6d885` and both parents from the original repository. Archived a, b and resolved files exactly match `keras/backend/theano_backend.py` at their respective commits. The shallow fetch does not establish the original merge base; base reconstruction remains required. Tests and an MIT LICENSE exist at the pinned revision. Its setup identifies Keras 0.3.1 with unpinned Theano/PyYAML/six dependencies. No reproducible historical environment or conflict-sensitive behavioral test has been validated. Existing test filenames cannot count as an oracle passing a reference three times and rejecting harmful mutations.

The categorized `meta_list.txt` files identify raw location, salted filename and conflict ordinal. They provide difficulty labels and localization, not executable correctness claims. Full and tiny variants overlap and cannot be counted as independent samples.

## Existing sources and recorded exposure

The local CLI, Redis, jq and libgit2 histories remain useful development candidates. The source inventory excludes any merge event exposed by v2 input files or historical run triple IDs matched to source rows. It finds candidate `other`-category events in CLI (140), Redis (28), jq (1), and libgit2 (22). The second Redis file is a duplicate source, not extra cases. These are pre-admission counts: `other` is not a validated authored-source category, an absence of recorded exposure is not proof of untouched data, and the sources provide only four repository clusters.

## Admission work still required

1. Recover each original repository URL and verify merge/parent/base objects; match archived bytes and source paths. Record revision licenses and deduplicate shared content, forks and merge events before splitting.
2. Build isolated, credential-free, network-disabled evaluation images with pinned dependencies. Author or recover conflict-specific assertions from declared parent behavior, freeze checks before solver answers, and reject ambiguous intentions.
3. Run the reference three times and verify harmful, preferably compiling, mutations fail. Preserve exclusions; do not choose cases because a solver or deterministic baseline fails.
4. Admit 60 fresh development cases only after those checks. Confirmation additionally requires the approved sample-size analysis and at least 12 verified independent repository clusters.

The bounded acquisition audit stopped after checksum verification, complete archive inventory, commit-map extraction and an original-Git spot check. These resolve dataset access and provenance feasibility; more raw-file downloads would not resolve the missing behavioral oracle. This receipt makes no claim that Phase 3 is measurable or the confirmation experiment has run.

## Follow-up: two C-project Git reconstructions

The [C-project provenance receipt](c-project-provenance.json) now verifies original merge and parent commits for Git case 0 and ReactOS case 0 in isolated depth-2 repositories. Across each of a/b/resolved, 10 of 13 Git archive blobs and 38 of 42 ReactOS blobs match original Git objects; unmatched files are explicitly retained as failures, not silently accepted. Unique matching source paths are recorded. Base history and behavioral oracles remain unvalidated.

[Git’s original repository](https://github.com/git/git) supplies the merge `1bbba455fdb51d70d2a53ca4471f338d21b29f1c`, GPLv2 COPYING, a Makefile, INSTALL and shell tests. The reconstructed C files include merge-ort.c, setup.c, builtin/checkout.c and merge-recursive.c. Its build requires a C compiler, make, zlib and POSIX shell, with Perl and optional libraries documented in the pinned INSTALL. It is the better next environment candidate.

[ReactOS’s original repository](https://github.com/reactos/reactos) supplies merge `c02fdf562c8fd482a1b3c96943edbe0c3e15ba7d`, revision-specific COPYING files and test sources. The pinned INSTALL recommends RosBE or MSVC2010+ with CMake/Ninja. OS-specific code requires a dedicated runtime/emulator; this is a reconstruction success, not an oracle-ready Linux benchmark.

The [C-language frame](c-language-frame.json) has 14 project labels but only 11 with direct commit maps. Therefore ConGra C alone cannot satisfy the 12-repository gate through directly mapped labels, even before lineage deduplication, parser eligibility and executable-test exclusions. Mixed C++ projects contain C-labeled rows, so counts must come from actual meta_list entries rather than project names. The existing four local source repositories can expand the sampling frame; their cases still need individual admission.
