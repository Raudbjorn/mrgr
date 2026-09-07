# Repaired H0 development finding — 2026-09-07

**VALID instrument. NO DEMONSTRATED BENEFIT / CONFIRMATION STOPPED.**

The one frozen study completed all 1,080 scheduled requests: three runs of the same 60 Go cases in 34 repository lineages, with Mercury-2 and MiniMax-M3 at temperature 0.75. Repetitions do not add independent cases. Both models fail the required context-benefit floors in the first run. This is a completed development finding, not evidence of equivalence or proof that context can never help. No confirmation, additional acquisition, or extra repeats follow this result.

The original unweighted conjunction and fixed 0.25 weights over side-verbatim/blend × module/GOPATH are retained. Cell counts are 15/15/17/13. The first-run stopping condition takes precedence; later variability is reported without averaging it away.

## Reliability

Each yield is behavioral passes / 60. SD is in percentage points, from three runs (only two degrees of freedom); it includes the realized provider/output variability and is not a precise variance estimate.

| Model | Arm | Run 1 | Run 2 | Run 3 | SD (pp) | Cases changing outcome |
|---|---|---:|---:|---:|---:|---:|
| mercury | hunk-only | 31/60 | 29/60 | 28/60 | 2.55 | 16/60 |
| mercury | local-context | 25/60 | 27/60 | 23/60 | 3.33 | 24/60 |
| mercury | selected | 25/60 | 30/60 | 28/60 | 4.19 | 20/60 |
| minimax | hunk-only | 32/60 | 34/60 | 31/60 | 2.55 | 27/60 |
| minimax | local-context | 36/60 | 29/60 | 34/60 | 6.01 | 25/60 |
| minimax | selected | 32/60 | 39/60 | 32/60 | 6.74 | 25/60 |

## Effects in every run

All deltas and interval endpoints below are percentage points, selected minus comparator. Overall and cell/blend intervals use the retained cluster-jackknife CV3/t estimator. Standardized intervals use the accepted independent-lineage Hoeffding bound, conditional on the fixed frame. Its 76.24pp half-width here is very conservative; the rejected weighted jackknife is diagnostic only. These are individual intervals, not a simultaneous positive-utility claim.

Discordance is both pass / selected only / comparator only / neither. Standardized rows have no single integer discordance; consult the cell rows.

### Run 1 — mercury

| Scope | Comparator | Delta | Interval | Paired outcomes |
|---|---|---:|---|---|
| unweighted | hunk-only | -10.00 | [-31.14, 11.14] | 18 / 7 / 13 / 22 |
| unweighted | local-context | 0.00 | [-20.37, 20.37] | 18 / 7 / 7 / 28 |
| unweighted | keep-ours | -1.67 | [-28.62, 25.28] | 17 / 8 / 9 / 26 |
| unweighted | keep-theirs | 8.33 | [-7.59, 24.26] | 11 / 14 / 9 / 26 |
| unweighted | longer-side | -3.33 | [-27.18, 20.51] | 15 / 10 / 12 / 23 |
| unweighted | git-union | 16.67 | [-6.08, 39.41] | 10 / 15 / 5 / 30 |
| unweighted | git_text | 41.67 | [25.53, 57.81] | 0 / 25 / 0 / 35 |
| unweighted | gnu_diff3 | 41.67 | [25.53, 57.81] | 0 / 25 / 0 / 35 |
| unweighted | mergiraf | 8.33 | [-28.98, 45.65] | 4 / 21 / 16 / 19 |
| unweighted | always-halt | 41.67 | [25.53, 57.81] | 0 / 25 / 0 / 35 |
| standardized | hunk-only | -9.98 | [-86.22, 66.25] | see cells |
| standardized | local-context | -0.26 | [-76.49, 75.98] | see cells |
| standardized | keep-ours | -1.49 | [-77.72, 74.75] | see cells |
| standardized | keep-theirs | 8.45 | [-67.78, 84.69] | see cells |
| standardized | longer-side | -2.96 | [-79.19, 73.28] | see cells |
| standardized | git-union | 16.14 | [-60.10, 92.38] | see cells |
| standardized | git_text | 41.71 | [-34.53, 100.00] | see cells |
| standardized | gnu_diff3 | 41.71 | [-34.53, 100.00] | see cells |
| standardized | mergiraf | 10.02 | [-66.22, 86.26] | see cells |
| standardized | always-halt | 41.71 | [-34.53, 100.00] | see cells |
| side-verbatim/module | hunk-only | -6.67 | [-50.35, 37.02] | 3 / 3 / 4 / 5 |
| side-verbatim/module | local-context | -6.67 | [-34.70, 21.37] | 5 / 1 / 2 / 7 |
| side-verbatim/module | keep-ours | -26.67 | [-86.34, 33.01] | 6 / 0 / 4 / 5 |
| side-verbatim/module | keep-theirs | -6.67 | [-77.70, 64.37] | 2 / 4 / 5 / 4 |
| side-verbatim/module | longer-side | -40.00 | [-67.12, -12.88] | 6 / 0 / 6 / 3 |
| side-verbatim/module | git-union | 0.00 | [-36.68, 36.68] | 4 / 2 / 2 / 7 |
| side-verbatim/module | git_text | 40.00 | [10.63, 69.37] | 0 / 6 / 0 / 9 |
| side-verbatim/module | gnu_diff3 | 40.00 | [10.63, 69.37] | 0 / 6 / 0 / 9 |
| side-verbatim/module | mergiraf | 20.00 | [-42.43, 82.43] | 1 / 5 / 2 / 7 |
| side-verbatim/module | always-halt | 40.00 | [10.63, 69.37] | 0 / 6 / 0 / 9 |
| side-verbatim/GOPATH | hunk-only | 13.33 | [-18.19, 44.86] | 7 / 3 / 1 / 4 |
| side-verbatim/GOPATH | local-context | 13.33 | [-17.49, 44.16] | 7 / 3 / 1 / 4 |
| side-verbatim/GOPATH | keep-ours | -20.00 | [-57.78, 17.78] | 9 / 1 / 4 / 1 |
| side-verbatim/GOPATH | keep-theirs | 13.33 | [-21.93, 48.60] | 6 / 4 / 2 / 3 |
| side-verbatim/GOPATH | longer-side | -6.67 | [-52.46, 39.13] | 7 / 3 / 4 / 1 |
| side-verbatim/GOPATH | git-union | 33.33 | [-12.85, 79.51] | 3 / 7 / 2 / 3 |
| side-verbatim/GOPATH | git_text | 66.67 | [32.70, 100.00] | 0 / 10 / 0 / 5 |
| side-verbatim/GOPATH | gnu_diff3 | 66.67 | [32.70, 100.00] | 0 / 10 / 0 / 5 |
| side-verbatim/GOPATH | mergiraf | 40.00 | [-25.04, 100.00] | 0 / 10 / 4 / 1 |
| side-verbatim/GOPATH | always-halt | 66.67 | [32.70, 100.00] | 0 / 10 / 0 / 5 |
| blend/module | hunk-only | -23.53 | [-61.59, 14.53] | 5 / 0 / 4 / 8 |
| blend/module | local-context | 0.00 | [-27.58, 27.58] | 3 / 2 / 2 / 10 |
| blend/module | keep-ours | 17.65 | [-13.01, 48.30] | 1 / 4 / 1 / 11 |
| blend/module | keep-theirs | 11.76 | [-15.66, 39.19] | 2 / 3 / 1 / 11 |
| blend/module | longer-side | 11.76 | [-27.72, 51.25] | 1 / 4 / 2 / 10 |
| blend/module | git-union | 23.53 | [-2.06, 49.12] | 1 / 4 / 0 / 12 |
| blend/module | git_text | 29.41 | [0.96, 57.86] | 0 / 5 / 0 / 12 |
| blend/module | gnu_diff3 | 29.41 | [0.96, 57.86] | 0 / 5 / 0 / 12 |
| blend/module | mergiraf | -35.29 | [-80.94, 10.35] | 3 / 2 / 8 / 4 |
| blend/module | always-halt | 29.41 | [0.96, 57.86] | 0 / 5 / 0 / 12 |
| blend/GOPATH | hunk-only | -23.08 | [-65.22, 19.06] | 3 / 1 / 4 / 5 |
| blend/GOPATH | local-context | -7.69 | [-49.01, 33.63] | 3 / 1 / 2 / 7 |
| blend/GOPATH | keep-ours | 23.08 | [2.82, 43.34] | 1 / 3 / 0 / 9 |
| blend/GOPATH | keep-theirs | 15.38 | [-19.95, 50.72] | 1 / 3 / 1 / 8 |
| blend/GOPATH | longer-side | 23.08 | [2.82, 43.34] | 1 / 3 / 0 / 9 |
| blend/GOPATH | git-union | 7.69 | [-24.90, 40.28] | 2 / 2 / 1 / 8 |
| blend/GOPATH | git_text | 30.77 | [6.14, 55.40] | 0 / 4 / 0 / 9 |
| blend/GOPATH | gnu_diff3 | 30.77 | [6.14, 55.40] | 0 / 4 / 0 / 9 |
| blend/GOPATH | mergiraf | 15.38 | [-26.54, 57.31] | 0 / 4 / 2 / 7 |
| blend/GOPATH | always-halt | 30.77 | [6.14, 55.40] | 0 / 4 / 0 / 9 |
| blend | hunk-only | -23.33 | [-46.09, -0.57] | 8 / 1 / 8 / 13 |
| blend | local-context | -3.33 | [-25.79, 19.13] | 6 / 3 / 4 / 17 |
| blend | keep-ours | 20.00 | [3.14, 36.86] | 2 / 7 / 1 / 20 |
| blend | keep-theirs | 13.33 | [-3.99, 30.65] | 3 / 6 / 2 / 19 |
| blend | longer-side | 16.67 | [-4.38, 37.71] | 2 / 7 / 2 / 19 |
| blend | git-union | 16.67 | [-1.52, 34.86] | 3 / 6 / 1 / 20 |
| blend | git_text | 30.00 | [12.51, 47.49] | 0 / 9 / 0 / 21 |
| blend | gnu_diff3 | 30.00 | [12.51, 47.49] | 0 / 9 / 0 / 21 |
| blend | mergiraf | -13.33 | [-48.93, 22.26] | 3 / 6 / 10 / 11 |
| blend | always-halt | 30.00 | [12.51, 47.49] | 0 / 9 / 0 / 21 |

### Run 1 — minimax

| Scope | Comparator | Delta | Interval | Paired outcomes |
|---|---|---:|---|---|
| unweighted | hunk-only | 0.00 | [-14.72, 14.72] | 23 / 9 / 9 / 19 |
| unweighted | local-context | -6.67 | [-17.74, 4.40] | 25 / 7 / 11 / 17 |
| unweighted | keep-ours | 10.00 | [-13.82, 33.82] | 17 / 15 / 9 / 19 |
| unweighted | keep-theirs | 20.00 | [2.66, 37.34] | 13 / 19 / 7 / 21 |
| unweighted | longer-side | 8.33 | [-10.84, 27.51] | 18 / 14 / 9 / 19 |
| unweighted | git-union | 28.33 | [10.96, 45.71] | 12 / 20 / 3 / 25 |
| unweighted | git_text | 53.33 | [41.81, 64.86] | 0 / 32 / 0 / 28 |
| unweighted | gnu_diff3 | 53.33 | [41.81, 64.86] | 0 / 32 / 0 / 28 |
| unweighted | mergiraf | 20.00 | [-9.41, 49.41] | 9 / 23 / 11 / 17 |
| unweighted | always-halt | 53.33 | [41.81, 64.86] | 0 / 32 / 0 / 28 |
| standardized | hunk-only | 1.30 | [-74.94, 77.53] | see cells |
| standardized | local-context | -6.08 | [-82.32, 70.16] | see cells |
| standardized | keep-ours | 10.11 | [-66.13, 86.34] | see cells |
| standardized | keep-theirs | 20.05 | [-56.19, 96.28] | see cells |
| standardized | longer-side | 8.63 | [-67.60, 84.87] | see cells |
| standardized | git-union | 27.73 | [-48.51, 100.00] | see cells |
| standardized | git_text | 53.30 | [-22.93, 100.00] | see cells |
| standardized | gnu_diff3 | 53.30 | [-22.93, 100.00] | see cells |
| standardized | mergiraf | 21.61 | [-54.62, 97.85] | see cells |
| standardized | always-halt | 53.30 | [-22.93, 100.00] | see cells |
| side-verbatim/module | hunk-only | -6.67 | [-33.22, 19.88] | 6 / 1 / 2 / 6 |
| side-verbatim/module | local-context | 6.67 | [-21.57, 34.90] | 4 / 3 / 2 / 6 |
| side-verbatim/module | keep-ours | -20.00 | [-100.00, 75.99] | 5 / 2 / 5 / 3 |
| side-verbatim/module | keep-theirs | 0.00 | [-42.75, 42.75] | 4 / 3 / 3 / 5 |
| side-verbatim/module | longer-side | -33.33 | [-65.83, -0.83] | 7 / 0 / 5 / 3 |
| side-verbatim/module | git-union | 6.67 | [-56.55, 69.89] | 4 / 3 / 2 / 6 |
| side-verbatim/module | git_text | 46.67 | [-4.72, 98.06] | 0 / 7 / 0 / 8 |
| side-verbatim/module | gnu_diff3 | 46.67 | [-4.72, 98.06] | 0 / 7 / 0 / 8 |
| side-verbatim/module | mergiraf | 26.67 | [-66.79, 100.00] | 1 / 6 / 2 / 6 |
| side-verbatim/module | always-halt | 46.67 | [-4.72, 98.06] | 0 / 7 / 0 / 8 |
| side-verbatim/GOPATH | hunk-only | 20.00 | [-3.07, 43.07] | 8 / 3 / 0 / 4 |
| side-verbatim/GOPATH | local-context | -13.33 | [-42.22, 15.55] | 10 / 1 / 3 / 1 |
| side-verbatim/GOPATH | keep-ours | -13.33 | [-42.22, 15.55] | 10 / 1 / 3 / 1 |
| side-verbatim/GOPATH | keep-theirs | 20.00 | [-16.66, 56.66] | 7 / 4 / 1 / 3 |
| side-verbatim/GOPATH | longer-side | 0.00 | [-30.70, 30.70] | 9 / 2 / 2 / 2 |
| side-verbatim/GOPATH | git-union | 40.00 | [9.23, 70.77] | 4 / 7 / 1 / 3 |
| side-verbatim/GOPATH | git_text | 73.33 | [47.47, 99.20] | 0 / 11 / 0 / 4 |
| side-verbatim/GOPATH | gnu_diff3 | 73.33 | [47.47, 99.20] | 0 / 11 / 0 / 4 |
| side-verbatim/GOPATH | mergiraf | 46.67 | [2.62, 90.71] | 2 / 9 / 2 / 2 |
| side-verbatim/GOPATH | always-halt | 73.33 | [47.47, 99.20] | 0 / 11 / 0 / 4 |
| blend/module | hunk-only | -23.53 | [-50.65, 3.59] | 6 / 2 / 6 / 3 |
| blend/module | local-context | -17.65 | [-38.70, 3.41] | 7 / 1 / 4 / 5 |
| blend/module | keep-ours | 35.29 | [9.29, 61.30] | 2 / 6 / 0 / 9 |
| blend/module | keep-theirs | 29.41 | [3.55, 55.27] | 2 / 6 / 1 / 8 |
| blend/module | longer-side | 29.41 | [-4.69, 63.52] | 2 / 6 / 1 / 8 |
| blend/module | git-union | 41.18 | [18.29, 64.06] | 1 / 7 / 0 / 9 |
| blend/module | git_text | 47.06 | [24.74, 69.38] | 0 / 8 / 0 / 9 |
| blend/module | gnu_diff3 | 47.06 | [24.74, 69.38] | 0 / 8 / 0 / 9 |
| blend/module | mergiraf | -17.65 | [-49.33, 14.04] | 5 / 3 / 6 / 3 |
| blend/module | always-halt | 47.06 | [24.74, 69.38] | 0 / 8 / 0 / 9 |
| blend/GOPATH | hunk-only | 15.38 | [-7.50, 38.27] | 3 / 3 / 1 / 6 |
| blend/GOPATH | local-context | 0.00 | [-29.49, 29.49] | 4 / 2 / 2 / 5 |
| blend/GOPATH | keep-ours | 38.46 | [-3.48, 80.41] | 0 / 6 / 1 / 6 |
| blend/GOPATH | keep-theirs | 30.77 | [-24.56, 86.10] | 0 / 6 / 2 / 5 |
| blend/GOPATH | longer-side | 38.46 | [-3.48, 80.41] | 0 / 6 / 1 / 6 |
| blend/GOPATH | git-union | 23.08 | [-7.74, 53.89] | 3 / 3 / 0 / 7 |
| blend/GOPATH | git_text | 46.15 | [15.67, 76.64] | 0 / 6 / 0 / 7 |
| blend/GOPATH | gnu_diff3 | 46.15 | [15.67, 76.64] | 0 / 6 / 0 / 7 |
| blend/GOPATH | mergiraf | 30.77 | [-6.40, 67.94] | 1 / 5 / 1 / 6 |
| blend/GOPATH | always-halt | 46.15 | [15.67, 76.64] | 0 / 6 / 0 / 7 |
| blend | hunk-only | -6.67 | [-26.98, 13.65] | 9 / 5 / 7 / 9 |
| blend | local-context | -10.00 | [-22.74, 2.74] | 11 / 3 / 6 / 10 |
| blend | keep-ours | 36.67 | [18.11, 55.23] | 2 / 12 / 1 / 15 |
| blend | keep-theirs | 30.00 | [7.81, 52.19] | 2 / 12 / 3 / 13 |
| blend | longer-side | 33.33 | [13.65, 53.01] | 2 / 12 / 2 / 14 |
| blend | git-union | 33.33 | [17.55, 49.11] | 4 / 10 / 0 / 16 |
| blend | git_text | 46.67 | [30.25, 63.09] | 0 / 14 / 0 / 16 |
| blend | gnu_diff3 | 46.67 | [30.25, 63.09] | 0 / 14 / 0 / 16 |
| blend | mergiraf | 3.33 | [-23.54, 30.20] | 6 / 8 / 7 / 9 |
| blend | always-halt | 46.67 | [30.25, 63.09] | 0 / 14 / 0 / 16 |

### Run 2 — mercury

| Scope | Comparator | Delta | Interval | Paired outcomes |
|---|---|---:|---|---|
| unweighted | hunk-only | 1.67 | [-13.42, 16.75] | 23 / 7 / 6 / 24 |
| unweighted | local-context | 5.00 | [-7.42, 17.42] | 21 / 9 / 6 / 24 |
| unweighted | keep-ours | 6.67 | [-14.42, 27.76] | 15 / 15 / 11 / 19 |
| unweighted | keep-theirs | 16.67 | [-8.11, 41.44] | 10 / 20 / 10 / 20 |
| unweighted | longer-side | 5.00 | [-14.49, 24.49] | 14 / 16 / 13 / 17 |
| unweighted | git-union | 25.00 | [5.22, 44.78] | 8 / 22 / 7 / 23 |
| unweighted | git_text | 50.00 | [35.62, 64.38] | 0 / 30 / 0 / 30 |
| unweighted | gnu_diff3 | 50.00 | [35.62, 64.38] | 0 / 30 / 0 / 30 |
| unweighted | mergiraf | 16.67 | [-12.13, 45.46] | 8 / 22 / 12 / 18 |
| unweighted | always-halt | 50.00 | [35.62, 64.38] | 0 / 30 / 0 / 30 |
| standardized | hunk-only | 3.08 | [-73.15, 79.32] | see cells |
| standardized | local-context | 5.51 | [-70.72, 81.75] | see cells |
| standardized | keep-ours | 7.93 | [-68.30, 84.17] | see cells |
| standardized | keep-theirs | 17.87 | [-58.36, 94.11] | see cells |
| standardized | longer-side | 6.46 | [-69.77, 82.70] | see cells |
| standardized | git-union | 25.56 | [-50.68, 100.00] | see cells |
| standardized | git_text | 51.13 | [-25.11, 100.00] | see cells |
| standardized | gnu_diff3 | 51.13 | [-25.11, 100.00] | see cells |
| standardized | mergiraf | 19.44 | [-56.80, 95.68] | see cells |
| standardized | always-halt | 51.13 | [-25.11, 100.00] | see cells |
| side-verbatim/module | hunk-only | -20.00 | [-38.34, -1.66] | 6 / 0 / 3 / 6 |
| side-verbatim/module | local-context | 6.67 | [-21.37, 34.70] | 4 / 2 / 1 / 8 |
| side-verbatim/module | keep-ours | -26.67 | [-73.95, 20.61] | 5 / 1 / 5 / 4 |
| side-verbatim/module | keep-theirs | -6.67 | [-96.52, 83.18] | 2 / 4 / 5 / 4 |
| side-verbatim/module | longer-side | -40.00 | [-84.29, 4.29] | 6 / 0 / 6 / 3 |
| side-verbatim/module | git-union | 0.00 | [-31.67, 31.67] | 3 / 3 / 3 / 6 |
| side-verbatim/module | git_text | 40.00 | [11.65, 68.35] | 0 / 6 / 0 / 9 |
| side-verbatim/module | gnu_diff3 | 40.00 | [11.65, 68.35] | 0 / 6 / 0 / 9 |
| side-verbatim/module | mergiraf | 20.00 | [-17.24, 57.24] | 1 / 5 / 2 / 7 |
| side-verbatim/module | always-halt | 40.00 | [11.65, 68.35] | 0 / 6 / 0 / 9 |
| side-verbatim/GOPATH | hunk-only | 13.33 | [-7.27, 33.94] | 7 / 2 / 0 / 6 |
| side-verbatim/GOPATH | local-context | 0.00 | [-31.28, 31.28] | 7 / 2 / 2 / 4 |
| side-verbatim/GOPATH | keep-ours | -26.67 | [-65.71, 12.38] | 8 / 1 / 5 / 1 |
| side-verbatim/GOPATH | keep-theirs | 6.67 | [-32.98, 46.31] | 5 / 4 / 3 / 3 |
| side-verbatim/GOPATH | longer-side | -13.33 | [-60.48, 33.81] | 6 / 3 / 5 / 1 |
| side-verbatim/GOPATH | git-union | 26.67 | [-23.36, 76.70] | 2 / 7 / 3 / 3 |
| side-verbatim/GOPATH | git_text | 60.00 | [25.04, 94.96] | 0 / 9 / 0 / 6 |
| side-verbatim/GOPATH | gnu_diff3 | 60.00 | [25.04, 94.96] | 0 / 9 / 0 / 6 |
| side-verbatim/GOPATH | mergiraf | 33.33 | [-31.18, 97.85] | 0 / 9 / 4 / 2 |
| side-verbatim/GOPATH | always-halt | 60.00 | [25.04, 94.96] | 0 / 9 / 0 / 6 |
| blend/module | hunk-only | -11.76 | [-30.07, 6.54] | 5 / 1 / 3 / 8 |
| blend/module | local-context | 0.00 | [-33.21, 33.21] | 3 / 3 / 3 / 8 |
| blend/module | keep-ours | 23.53 | [-5.01, 52.07] | 1 / 5 / 1 / 10 |
| blend/module | keep-theirs | 17.65 | [-1.66, 36.96] | 2 / 4 / 1 / 10 |
| blend/module | longer-side | 17.65 | [-16.39, 51.68] | 1 / 5 / 2 / 9 |
| blend/module | git-union | 29.41 | [1.03, 57.79] | 0 / 6 / 1 / 10 |
| blend/module | git_text | 35.29 | [12.29, 58.30] | 0 / 6 / 0 / 11 |
| blend/module | gnu_diff3 | 35.29 | [12.29, 58.30] | 0 / 6 / 0 / 11 |
| blend/module | mergiraf | -29.41 | [-59.52, 0.69] | 5 / 1 / 6 / 5 |
| blend/module | always-halt | 35.29 | [12.29, 58.30] | 0 / 6 / 0 / 11 |
| blend/GOPATH | hunk-only | 30.77 | [-22.65, 84.18] | 5 / 4 / 0 / 4 |
| blend/GOPATH | local-context | 15.38 | [-2.40, 33.17] | 7 / 2 / 0 / 4 |
| blend/GOPATH | keep-ours | 61.54 | [18.12, 100.00] | 1 / 8 / 0 / 4 |
| blend/GOPATH | keep-theirs | 53.85 | [-6.37, 100.00] | 1 / 8 / 1 / 3 |
| blend/GOPATH | longer-side | 61.54 | [18.12, 100.00] | 1 / 8 / 0 / 4 |
| blend/GOPATH | git-union | 46.15 | [4.56, 87.75] | 3 / 6 / 0 / 4 |
| blend/GOPATH | git_text | 69.23 | [29.78, 100.00] | 0 / 9 / 0 / 4 |
| blend/GOPATH | gnu_diff3 | 69.23 | [29.78, 100.00] | 0 / 9 / 0 / 4 |
| blend/GOPATH | mergiraf | 53.85 | [15.49, 92.20] | 2 / 7 / 0 / 4 |
| blend/GOPATH | always-halt | 69.23 | [29.78, 100.00] | 0 / 9 / 0 / 4 |
| blend | hunk-only | 6.67 | [-18.49, 31.82] | 10 / 5 / 3 / 12 |
| blend | local-context | 6.67 | [-10.10, 23.44] | 10 / 5 / 3 / 12 |
| blend | keep-ours | 40.00 | [17.21, 62.79] | 2 / 13 / 1 / 14 |
| blend | keep-theirs | 33.33 | [8.71, 57.96] | 3 / 12 / 2 / 13 |
| blend | longer-side | 36.67 | [15.11, 58.22] | 2 / 13 / 2 / 13 |
| blend | git-union | 36.67 | [13.42, 59.92] | 3 / 12 / 1 / 14 |
| blend | git_text | 50.00 | [27.47, 72.53] | 0 / 15 / 0 / 15 |
| blend | gnu_diff3 | 50.00 | [27.47, 72.53] | 0 / 15 / 0 / 15 |
| blend | mergiraf | 6.67 | [-26.57, 39.91] | 7 / 8 / 6 / 9 |
| blend | always-halt | 50.00 | [27.47, 72.53] | 0 / 15 / 0 / 15 |

### Run 2 — minimax

| Scope | Comparator | Delta | Interval | Paired outcomes |
|---|---|---:|---|---|
| unweighted | hunk-only | 8.33 | [-3.52, 20.19] | 30 / 9 / 4 / 17 |
| unweighted | local-context | 16.67 | [1.68, 31.65] | 24 / 15 / 5 / 16 |
| unweighted | keep-ours | 21.67 | [0.67, 42.67] | 19 / 20 / 7 / 14 |
| unweighted | keep-theirs | 31.67 | [7.54, 55.79] | 14 / 25 / 6 / 15 |
| unweighted | longer-side | 20.00 | [3.42, 36.58] | 22 / 17 / 5 / 16 |
| unweighted | git-union | 40.00 | [22.80, 57.20] | 12 / 27 / 3 / 18 |
| unweighted | git_text | 65.00 | [52.27, 77.73] | 0 / 39 / 0 / 21 |
| unweighted | gnu_diff3 | 65.00 | [52.27, 77.73] | 0 / 39 / 0 / 21 |
| unweighted | mergiraf | 31.67 | [5.97, 57.36] | 13 / 26 / 7 / 14 |
| unweighted | always-halt | 65.00 | [52.27, 77.73] | 0 / 39 / 0 / 21 |
| standardized | hunk-only | 9.10 | [-67.14, 85.34] | see cells |
| standardized | local-context | 17.75 | [-58.49, 93.99] | see cells |
| standardized | keep-ours | 22.15 | [-54.09, 98.39] | see cells |
| standardized | keep-theirs | 32.09 | [-44.15, 100.00] | see cells |
| standardized | longer-side | 20.68 | [-55.56, 96.92] | see cells |
| standardized | git-union | 39.77 | [-36.46, 100.00] | see cells |
| standardized | git_text | 65.35 | [-10.89, 100.00] | see cells |
| standardized | gnu_diff3 | 65.35 | [-10.89, 100.00] | see cells |
| standardized | mergiraf | 33.66 | [-42.58, 100.00] | see cells |
| standardized | always-halt | 65.35 | [-10.89, 100.00] | see cells |
| side-verbatim/module | hunk-only | 0.00 | [-21.96, 21.96] | 8 / 1 / 1 / 5 |
| side-verbatim/module | local-context | 13.33 | [-13.73, 40.40] | 6 / 3 / 1 / 5 |
| side-verbatim/module | keep-ours | -6.67 | [-77.28, 63.95] | 6 / 3 / 4 / 2 |
| side-verbatim/module | keep-theirs | 13.33 | [-50.68, 77.35] | 4 / 5 / 3 / 3 |
| side-verbatim/module | longer-side | -20.00 | [-40.62, 0.62] | 9 / 0 / 3 / 3 |
| side-verbatim/module | git-union | 20.00 | [-22.19, 62.19] | 4 / 5 / 2 / 4 |
| side-verbatim/module | git_text | 60.00 | [31.65, 88.35] | 0 / 9 / 0 / 6 |
| side-verbatim/module | gnu_diff3 | 60.00 | [31.65, 88.35] | 0 / 9 / 0 / 6 |
| side-verbatim/module | mergiraf | 40.00 | [-25.02, 100.00] | 2 / 7 / 1 / 5 |
| side-verbatim/module | always-halt | 60.00 | [31.65, 88.35] | 0 / 9 / 0 / 6 |
| side-verbatim/GOPATH | hunk-only | 13.33 | [-5.04, 31.71] | 9 / 2 / 0 / 4 |
| side-verbatim/GOPATH | local-context | 13.33 | [-23.15, 49.81] | 6 / 5 / 3 / 1 |
| side-verbatim/GOPATH | keep-ours | -13.33 | [-42.22, 15.55] | 10 / 1 / 3 / 1 |
| side-verbatim/GOPATH | keep-theirs | 20.00 | [-15.66, 55.66] | 6 / 5 / 2 / 2 |
| side-verbatim/GOPATH | longer-side | 0.00 | [-30.70, 30.70] | 9 / 2 / 2 / 2 |
| side-verbatim/GOPATH | git-union | 40.00 | [8.07, 71.93] | 4 / 7 / 1 / 3 |
| side-verbatim/GOPATH | git_text | 73.33 | [47.47, 99.20] | 0 / 11 / 0 / 4 |
| side-verbatim/GOPATH | gnu_diff3 | 73.33 | [47.47, 99.20] | 0 / 11 / 0 / 4 |
| side-verbatim/GOPATH | mergiraf | 46.67 | [-3.71, 97.04] | 2 / 9 / 2 / 2 |
| side-verbatim/GOPATH | always-halt | 73.33 | [47.47, 99.20] | 0 / 11 / 0 / 4 |
| blend/module | hunk-only | 0.00 | [-32.41, 32.41] | 7 / 3 / 3 / 4 |
| blend/module | local-context | 5.88 | [-16.55, 28.31] | 8 / 2 / 1 / 6 |
| blend/module | keep-ours | 47.06 | [13.05, 81.07] | 2 / 8 / 0 / 7 |
| blend/module | keep-theirs | 41.18 | [6.32, 76.04] | 3 / 7 / 0 / 7 |
| blend/module | longer-side | 41.18 | [4.14, 78.21] | 3 / 7 / 0 / 7 |
| blend/module | git-union | 52.94 | [17.22, 88.66] | 1 / 9 / 0 / 7 |
| blend/module | git_text | 58.82 | [24.41, 93.23] | 0 / 10 / 0 / 7 |
| blend/module | gnu_diff3 | 58.82 | [24.41, 93.23] | 0 / 10 / 0 / 7 |
| blend/module | mergiraf | -5.88 | [-40.44, 28.68] | 7 / 3 / 4 / 3 |
| blend/module | always-halt | 58.82 | [24.41, 93.23] | 0 / 10 / 0 / 7 |
| blend/GOPATH | hunk-only | 23.08 | [2.82, 43.34] | 6 / 3 / 0 / 4 |
| blend/GOPATH | local-context | 38.46 | [6.11, 70.81] | 4 / 5 / 0 / 4 |
| blend/GOPATH | keep-ours | 61.54 | [18.12, 100.00] | 1 / 8 / 0 / 4 |
| blend/GOPATH | keep-theirs | 53.85 | [-6.37, 100.00] | 1 / 8 / 1 / 3 |
| blend/GOPATH | longer-side | 61.54 | [18.12, 100.00] | 1 / 8 / 0 / 4 |
| blend/GOPATH | git-union | 46.15 | [4.56, 87.75] | 3 / 6 / 0 / 4 |
| blend/GOPATH | git_text | 69.23 | [29.78, 100.00] | 0 / 9 / 0 / 4 |
| blend/GOPATH | gnu_diff3 | 69.23 | [29.78, 100.00] | 0 / 9 / 0 / 4 |
| blend/GOPATH | mergiraf | 53.85 | [15.49, 92.20] | 2 / 7 / 0 / 4 |
| blend/GOPATH | always-halt | 69.23 | [29.78, 100.00] | 0 / 9 / 0 / 4 |
| blend | hunk-only | 10.00 | [-10.21, 30.21] | 13 / 6 / 3 / 8 |
| blend | local-context | 20.00 | [-2.59, 42.59] | 12 / 7 / 1 / 10 |
| blend | keep-ours | 53.33 | [29.31, 77.36] | 3 / 16 / 0 / 11 |
| blend | keep-theirs | 46.67 | [17.92, 75.41] | 4 / 15 / 1 / 10 |
| blend | longer-side | 50.00 | [27.90, 72.10] | 4 / 15 / 0 / 11 |
| blend | git-union | 50.00 | [25.06, 74.94] | 4 / 15 / 0 / 11 |
| blend | git_text | 63.33 | [37.80, 88.87] | 0 / 19 / 0 / 11 |
| blend | gnu_diff3 | 63.33 | [37.80, 88.87] | 0 / 19 / 0 / 11 |
| blend | mergiraf | 20.00 | [-9.13, 49.13] | 9 / 10 / 4 / 7 |
| blend | always-halt | 63.33 | [37.80, 88.87] | 0 / 19 / 0 / 11 |

### Run 3 — mercury

| Scope | Comparator | Delta | Interval | Paired outcomes |
|---|---|---:|---|---|
| unweighted | hunk-only | 0.00 | [-19.40, 19.40] | 19 / 9 / 9 / 23 |
| unweighted | local-context | 8.33 | [-6.90, 23.57] | 16 / 12 / 7 / 25 |
| unweighted | keep-ours | 3.33 | [-10.35, 17.01] | 16 / 12 / 10 / 22 |
| unweighted | keep-theirs | 13.33 | [-13.32, 39.98] | 12 / 16 / 8 / 24 |
| unweighted | longer-side | 1.67 | [-11.73, 15.06] | 16 / 12 / 11 / 21 |
| unweighted | git-union | 21.67 | [7.38, 35.95] | 10 / 18 / 5 / 27 |
| unweighted | git_text | 46.67 | [31.81, 61.52] | 0 / 28 / 0 / 32 |
| unweighted | gnu_diff3 | 46.67 | [31.81, 61.52] | 0 / 28 / 0 / 32 |
| unweighted | mergiraf | 13.33 | [-10.30, 36.97] | 8 / 20 / 12 / 20 |
| unweighted | always-halt | 46.67 | [31.81, 61.52] | 0 / 28 / 0 / 32 |
| standardized | hunk-only | 1.75 | [-74.49, 77.99] | see cells |
| standardized | local-context | 9.30 | [-66.94, 85.54] | see cells |
| standardized | keep-ours | 4.28 | [-71.95, 80.52] | see cells |
| standardized | keep-theirs | 14.22 | [-62.01, 90.46] | see cells |
| standardized | longer-side | 2.81 | [-73.42, 79.05] | see cells |
| standardized | git-union | 21.91 | [-54.33, 98.15] | see cells |
| standardized | git_text | 47.48 | [-28.76, 100.00] | see cells |
| standardized | gnu_diff3 | 47.48 | [-28.76, 100.00] | see cells |
| standardized | mergiraf | 15.79 | [-60.45, 92.03] | see cells |
| standardized | always-halt | 47.48 | [-28.76, 100.00] | see cells |
| side-verbatim/module | hunk-only | 6.67 | [-11.08, 24.41] | 6 / 1 / 0 / 8 |
| side-verbatim/module | local-context | 13.33 | [-15.92, 42.59] | 4 / 3 / 1 / 7 |
| side-verbatim/module | keep-ours | -20.00 | [-68.95, 28.95] | 6 / 1 / 4 / 4 |
| side-verbatim/module | keep-theirs | 0.00 | [-80.36, 80.36] | 3 / 4 / 4 / 4 |
| side-verbatim/module | longer-side | -33.33 | [-65.63, -1.03] | 7 / 0 / 5 / 3 |
| side-verbatim/module | git-union | 6.67 | [-21.57, 34.90] | 4 / 3 / 2 / 6 |
| side-verbatim/module | git_text | 46.67 | [25.68, 67.65] | 0 / 7 / 0 / 8 |
| side-verbatim/module | gnu_diff3 | 46.67 | [25.68, 67.65] | 0 / 7 / 0 / 8 |
| side-verbatim/module | mergiraf | 26.67 | [-18.19, 71.53] | 1 / 6 / 2 / 6 |
| side-verbatim/module | always-halt | 46.67 | [25.68, 67.65] | 0 / 7 / 0 / 8 |
| side-verbatim/GOPATH | hunk-only | 6.67 | [-27.95, 41.28] | 6 / 3 / 2 / 4 |
| side-verbatim/GOPATH | local-context | 6.67 | [-26.78, 40.11] | 5 / 4 / 3 / 3 |
| side-verbatim/GOPATH | keep-ours | -26.67 | [-64.77, 11.44] | 7 / 2 / 6 / 0 |
| side-verbatim/GOPATH | keep-theirs | 6.67 | [-26.78, 40.11] | 6 / 3 / 2 / 4 |
| side-verbatim/GOPATH | longer-side | -13.33 | [-54.53, 27.86] | 6 / 3 / 5 / 1 |
| side-verbatim/GOPATH | git-union | 26.67 | [-11.44, 64.77] | 3 / 6 / 2 / 4 |
| side-verbatim/GOPATH | git_text | 60.00 | [33.61, 86.39] | 0 / 9 / 0 / 6 |
| side-verbatim/GOPATH | gnu_diff3 | 60.00 | [33.61, 86.39] | 0 / 9 / 0 / 6 |
| side-verbatim/GOPATH | mergiraf | 33.33 | [-12.85, 79.51] | 2 / 7 / 2 / 4 |
| side-verbatim/GOPATH | always-halt | 60.00 | [33.61, 86.39] | 0 / 9 / 0 / 6 |
| blend/module | hunk-only | -29.41 | [-67.18, 8.36] | 4 / 1 / 6 / 6 |
| blend/module | local-context | -5.88 | [-28.31, 16.55] | 4 / 1 / 2 / 10 |
| blend/module | keep-ours | 17.65 | [-4.64, 39.94] | 2 / 3 / 0 / 12 |
| blend/module | keep-theirs | 11.76 | [-6.54, 30.07] | 2 / 3 / 1 / 11 |
| blend/module | longer-side | 11.76 | [-15.66, 39.19] | 2 / 3 / 1 / 11 |
| blend/module | git-union | 23.53 | [-0.47, 47.52] | 1 / 4 / 0 / 12 |
| blend/module | git_text | 29.41 | [2.87, 55.95] | 0 / 5 / 0 / 12 |
| blend/module | gnu_diff3 | 29.41 | [2.87, 55.95] | 0 / 5 / 0 / 12 |
| blend/module | mergiraf | -35.29 | [-78.01, 7.42] | 3 / 2 / 8 / 4 |
| blend/module | always-halt | 29.41 | [2.87, 55.95] | 0 / 5 / 0 / 12 |
| blend/GOPATH | hunk-only | 23.08 | [-24.88, 71.03] | 3 / 4 / 1 / 5 |
| blend/GOPATH | local-context | 23.08 | [-24.88, 71.03] | 3 / 4 / 1 / 5 |
| blend/GOPATH | keep-ours | 46.15 | [0.91, 91.39] | 1 / 6 / 0 / 6 |
| blend/GOPATH | keep-theirs | 38.46 | [-20.74, 97.66] | 1 / 6 / 1 / 5 |
| blend/GOPATH | longer-side | 46.15 | [0.91, 91.39] | 1 / 6 / 0 / 6 |
| blend/GOPATH | git-union | 30.77 | [-13.71, 75.25] | 2 / 5 / 1 / 5 |
| blend/GOPATH | git_text | 53.85 | [10.84, 96.85] | 0 / 7 / 0 / 6 |
| blend/GOPATH | gnu_diff3 | 53.85 | [10.84, 96.85] | 0 / 7 / 0 / 6 |
| blend/GOPATH | mergiraf | 38.46 | [10.65, 66.27] | 2 / 5 / 0 / 6 |
| blend/GOPATH | always-halt | 53.85 | [10.84, 96.85] | 0 / 7 / 0 / 6 |
| blend | hunk-only | -6.67 | [-42.25, 28.91] | 7 / 5 / 7 / 11 |
| blend | local-context | 6.67 | [-13.40, 26.73] | 7 / 5 / 3 / 15 |
| blend | keep-ours | 30.00 | [9.57, 50.43] | 3 / 9 / 0 / 18 |
| blend | keep-theirs | 23.33 | [-0.48, 47.15] | 3 / 9 / 2 / 16 |
| blend | longer-side | 26.67 | [9.55, 43.78] | 3 / 9 / 1 / 17 |
| blend | git-union | 26.67 | [3.75, 49.59] | 3 / 9 / 1 / 17 |
| blend | git_text | 40.00 | [15.52, 64.48] | 0 / 12 / 0 / 18 |
| blend | gnu_diff3 | 40.00 | [15.52, 64.48] | 0 / 12 / 0 / 18 |
| blend | mergiraf | -3.33 | [-37.46, 30.79] | 5 / 7 / 8 / 10 |
| blend | always-halt | 40.00 | [15.52, 64.48] | 0 / 12 / 0 / 18 |

### Run 3 — minimax

| Scope | Comparator | Delta | Interval | Paired outcomes |
|---|---|---:|---|---|
| unweighted | hunk-only | 1.67 | [-15.33, 18.67] | 22 / 10 / 9 / 19 |
| unweighted | local-context | -3.33 | [-17.68, 11.02] | 24 / 8 / 10 / 18 |
| unweighted | keep-ours | 10.00 | [-10.45, 30.45] | 17 / 15 / 9 / 19 |
| unweighted | keep-theirs | 20.00 | [-4.20, 44.20] | 13 / 19 / 7 / 21 |
| unweighted | longer-side | 8.33 | [-6.92, 23.59] | 21 / 11 / 6 / 22 |
| unweighted | git-union | 28.33 | [13.30, 43.37] | 10 / 22 / 5 / 23 |
| unweighted | git_text | 53.33 | [39.75, 66.92] | 0 / 32 / 0 / 28 |
| unweighted | gnu_diff3 | 53.33 | [39.75, 66.92] | 0 / 32 / 0 / 28 |
| unweighted | mergiraf | 20.00 | [-0.33, 40.33] | 13 / 19 / 7 / 21 |
| unweighted | always-halt | 53.33 | [39.75, 66.92] | 0 / 32 / 0 / 28 |
| standardized | hunk-only | 1.47 | [-74.77, 77.71] | see cells |
| standardized | local-context | -4.10 | [-80.34, 72.14] | see cells |
| standardized | keep-ours | 9.20 | [-67.04, 85.44] | see cells |
| standardized | keep-theirs | 19.14 | [-57.10, 95.38] | see cells |
| standardized | longer-side | 7.73 | [-68.51, 83.97] | see cells |
| standardized | git-union | 26.83 | [-49.41, 100.00] | see cells |
| standardized | git_text | 52.40 | [-23.84, 100.00] | see cells |
| standardized | gnu_diff3 | 52.40 | [-23.84, 100.00] | see cells |
| standardized | mergiraf | 20.71 | [-55.53, 96.95] | see cells |
| standardized | always-halt | 52.40 | [-23.84, 100.00] | see cells |
| side-verbatim/module | hunk-only | -13.33 | [-40.40, 13.73] | 6 / 1 / 3 / 5 |
| side-verbatim/module | local-context | -13.33 | [-29.15, 2.48] | 7 / 0 / 2 / 6 |
| side-verbatim/module | keep-ours | -20.00 | [-97.39, 57.39] | 4 / 3 / 6 / 2 |
| side-verbatim/module | keep-theirs | 0.00 | [-57.77, 57.77] | 4 / 3 / 3 / 5 |
| side-verbatim/module | longer-side | -33.33 | [-56.85, -9.82] | 7 / 0 / 5 / 3 |
| side-verbatim/module | git-union | 6.67 | [-38.64, 51.97] | 3 / 4 / 3 / 5 |
| side-verbatim/module | git_text | 46.67 | [13.39, 79.95] | 0 / 7 / 0 / 8 |
| side-verbatim/module | gnu_diff3 | 46.67 | [13.39, 79.95] | 0 / 7 / 0 / 8 |
| side-verbatim/module | mergiraf | 26.67 | [-44.07, 97.41] | 1 / 6 / 2 / 6 |
| side-verbatim/module | always-halt | 46.67 | [13.39, 79.95] | 0 / 7 / 0 / 8 |
| side-verbatim/GOPATH | hunk-only | 13.33 | [-6.19, 32.85] | 8 / 3 / 1 / 3 |
| side-verbatim/GOPATH | local-context | 20.00 | [-19.93, 59.93] | 6 / 5 / 2 / 2 |
| side-verbatim/GOPATH | keep-ours | -13.33 | [-42.22, 15.55] | 10 / 1 / 3 / 1 |
| side-verbatim/GOPATH | keep-theirs | 20.00 | [-16.66, 56.66] | 6 / 5 / 2 / 2 |
| side-verbatim/GOPATH | longer-side | 0.00 | [-22.12, 22.12] | 10 / 1 / 1 / 3 |
| side-verbatim/GOPATH | git-union | 40.00 | [8.07, 71.93] | 4 / 7 / 1 / 3 |
| side-verbatim/GOPATH | git_text | 73.33 | [47.47, 99.20] | 0 / 11 / 0 / 4 |
| side-verbatim/GOPATH | gnu_diff3 | 73.33 | [47.47, 99.20] | 0 / 11 / 0 / 4 |
| side-verbatim/GOPATH | mergiraf | 46.67 | [8.11, 85.22] | 3 / 8 / 1 / 3 |
| side-verbatim/GOPATH | always-halt | 73.33 | [47.47, 99.20] | 0 / 11 / 0 / 4 |
| blend/module | hunk-only | 5.88 | [-29.29, 41.06] | 6 / 4 / 3 / 4 |
| blend/module | local-context | 0.00 | [-26.17, 26.17] | 8 / 2 / 2 / 5 |
| blend/module | keep-ours | 47.06 | [13.05, 81.07] | 2 / 8 / 0 / 7 |
| blend/module | keep-theirs | 41.18 | [1.71, 80.64] | 2 / 8 / 1 / 6 |
| blend/module | longer-side | 41.18 | [4.14, 78.21] | 3 / 7 / 0 / 7 |
| blend/module | git-union | 52.94 | [17.22, 88.66] | 1 / 9 / 0 / 7 |
| blend/module | git_text | 58.82 | [24.41, 93.23] | 0 / 10 / 0 / 7 |
| blend/module | gnu_diff3 | 58.82 | [24.41, 93.23] | 0 / 10 / 0 / 7 |
| blend/module | mergiraf | -5.88 | [-35.07, 23.31] | 8 / 2 / 3 / 4 |
| blend/module | always-halt | 58.82 | [24.41, 93.23] | 0 / 10 / 0 / 7 |
| blend/GOPATH | hunk-only | 0.00 | [-55.16, 55.16] | 2 / 2 / 2 / 7 |
| blend/GOPATH | local-context | -23.08 | [-63.85, 17.70] | 3 / 1 / 4 / 5 |
| blend/GOPATH | keep-ours | 23.08 | [-19.06, 65.22] | 1 / 3 / 0 / 9 |
| blend/GOPATH | keep-theirs | 15.38 | [-34.22, 64.99] | 1 / 3 / 1 / 8 |
| blend/GOPATH | longer-side | 23.08 | [-19.06, 65.22] | 1 / 3 / 0 / 9 |
| blend/GOPATH | git-union | 7.69 | [-25.40, 40.78] | 2 / 2 / 1 / 8 |
| blend/GOPATH | git_text | 30.77 | [-15.32, 76.86] | 0 / 4 / 0 / 9 |
| blend/GOPATH | gnu_diff3 | 30.77 | [-15.32, 76.86] | 0 / 4 / 0 / 9 |
| blend/GOPATH | mergiraf | 15.38 | [-14.89, 45.66] | 1 / 3 / 1 / 8 |
| blend/GOPATH | always-halt | 30.77 | [-15.32, 76.86] | 0 / 4 / 0 / 9 |
| blend | hunk-only | 3.33 | [-27.92, 34.58] | 8 / 6 / 5 / 11 |
| blend | local-context | -10.00 | [-32.13, 12.13] | 11 / 3 / 6 / 10 |
| blend | keep-ours | 36.67 | [11.20, 62.13] | 3 / 11 / 0 / 16 |
| blend | keep-theirs | 30.00 | [0.17, 59.83] | 3 / 11 / 2 / 14 |
| blend | longer-side | 33.33 | [9.79, 56.88] | 4 / 10 / 0 / 16 |
| blend | git-union | 33.33 | [5.97, 60.70] | 3 / 11 / 1 / 15 |
| blend | git_text | 46.67 | [18.10, 75.23] | 0 / 14 / 0 / 16 |
| blend | gnu_diff3 | 46.67 | [18.10, 75.23] | 0 / 14 / 0 / 16 |
| blend | mergiraf | 3.33 | [-15.56, 22.23] | 9 / 5 / 4 / 12 |
| blend | always-halt | 46.67 | [18.10, 75.23] | 0 / 14 / 0 / 16 |

## Request outcomes and cost

Coverage means a decoded resolution was evaluated; failure risk is failure among those resolutions. A passing oracle establishes the tested focal behavior, not general semantic safety. Transport failures remain in the 60-case denominator.

| Run/model/arm | Pass | Categories | Coverage | Failure risk | Estimated USD |
|---|---:|---|---:|---:|---:|
| 1/mercury/hunk-only | 31/60 | build-failure: 19; behavioral-pass: 31; transport-error: 1; test-failure: 3; truncated: 4; halt: 2 | 88.33% | 41.51% | 0.3274 |
| 1/mercury/local-context | 25/60 | behavioral-pass: 25; build-failure: 25; transport-error: 1; truncated: 4; test-failure: 4; halt: 1 | 90.00% | 53.70% | 0.3370 |
| 1/mercury/selected | 25/60 | behavioral-pass: 25; build-failure: 26; truncated: 3; test-failure: 5; halt: 1 | 93.33% | 55.36% | 0.3386 |
| 1/minimax/hunk-only | 32/60 | invalid-output: 7; behavioral-pass: 32; build-failure: 14; transport-error: 1; truncated: 1; test-failure: 2; halt: 3 | 80.00% | 33.33% | 0.2553 |
| 1/minimax/local-context | 36/60 | behavioral-pass: 36; invalid-output: 4; build-failure: 13; transport-error: 2; test-failure: 3; truncated: 1; halt: 1 | 86.67% | 30.77% | 0.3483 |
| 1/minimax/selected | 32/60 | behavioral-pass: 32; invalid-output: 6; transport-error: 3; build-failure: 12; test-failure: 3; halt: 2; truncated: 2 | 78.33% | 31.91% | 0.3210 |
| 2/mercury/local-context | 27/60 | behavioral-pass: 27; truncated: 5; build-failure: 21; test-failure: 4; halt: 1; invalid-output: 2 | 86.67% | 48.08% | 0.3971 |
| 2/mercury/selected | 30/60 | behavioral-pass: 30; build-failure: 22; truncated: 5; test-failure: 2; halt: 1 | 90.00% | 44.44% | 0.3779 |
| 2/minimax/hunk-only | 34/60 | behavioral-pass: 34; build-failure: 11; invalid-output: 8; halt: 3; test-failure: 1; truncated: 1; transport-error: 2 | 76.67% | 26.09% | 0.2584 |
| 2/minimax/local-context | 29/60 | behavioral-pass: 29; invalid-output: 9; halt: 2; transport-error: 3; build-failure: 10; test-failure: 3; truncated: 4 | 70.00% | 30.95% | 0.3237 |
| 2/minimax/selected | 39/60 | behavioral-pass: 39; build-failure: 9; invalid-output: 4; transport-error: 3; test-failure: 2; halt: 2; truncated: 1 | 83.33% | 22.00% | 0.3502 |
| 2/mercury/hunk-only | 29/60 | behavioral-pass: 29; build-failure: 24; halt: 2; test-failure: 1; truncated: 4 | 90.00% | 46.30% | 0.3153 |
| 3/mercury/selected | 28/60 | halt: 1; behavioral-pass: 28; truncated: 7; test-failure: 3; build-failure: 20; transport-error: 1 | 85.00% | 45.10% | 0.3998 |
| 3/minimax/hunk-only | 31/60 | halt: 5; behavioral-pass: 31; test-failure: 2; build-failure: 14; transport-error: 3; invalid-output: 4; truncated: 1 | 78.33% | 34.04% | 0.2358 |
| 3/minimax/local-context | 34/60 | halt: 4; behavioral-pass: 34; test-failure: 2; build-failure: 12; invalid-output: 6; transport-error: 1; truncated: 1 | 80.00% | 29.17% | 0.3341 |
| 3/minimax/selected | 32/60 | behavioral-pass: 32; invalid-output: 7; build-failure: 13; test-failure: 3; halt: 2; transport-error: 2; truncated: 1 | 80.00% | 33.33% | 0.3622 |
| 3/mercury/hunk-only | 28/60 | halt: 3; behavioral-pass: 28; truncated: 6; test-failure: 3; build-failure: 20 | 85.00% | 45.10% | 0.3338 |
| 3/mercury/local-context | 23/60 | behavioral-pass: 23; invalid-output: 1; test-failure: 3; build-failure: 28; truncated: 4; halt: 1 | 90.00% | 57.41% | 0.3657 |

Totals: {"build-failure":313,"behavioral-pass":545,"transport-error":23,"test-failure":49,"truncated":55,"halt":37,"invalid-output":58}. Estimated API cost from recorded usage and frozen rates: $5.9815; not a billing receipt.

## Scope and limitations

This is focal conflict resolution conditional on other historical integration decisions being fixed, not end-to-end whole-merge correctness. Immediate fixed splice edges agree for 60/60 cases. The broader parent-derived automatic surroundings agree with the evaluator scaffold for 59/60; the documented go-toml suffix edit remains a limitation. All arms receive the same boundary contract.

The sparse selector retrieves lexical same-package Go declarations, not a full dependency graph or proven semantic bindings. Ten of 120 parent slots use the explicit oversized-enclosing fallback. All 60 cases are Go; no C or multilingual generalization is established. Historical development exposure and reference-build/test admission limit external validity.

GOPATH recovery recorded era before outcomes. Of 345 scheduled retained cases, nine were excluded before evaluation for unsupported historical wrapper layouts; 336 reference evaluations yielded 16 behavioral passes, 307 build failures and 13 test failures. Only two cases satisfied all admission requirements, both from Git LFS. Neither entered this frozen 60-case study. Missing retained inputs and the older-era recovery composition are preserved in the recovery ledger; no sixfold supply claim is supported.

## Decision and artifacts

The first-run selected-minus-hunk contrast is −10.00pp for Mercury and 0.00pp for MiniMax; standardized values are −9.98pp and +1.30pp. Selected-minus-local is 0.00pp and −6.67pp (standardized −0.26pp and −6.08pp). Each fails the unchanged >5pp development requirement. Mercury also fails required deterministic-baseline floors. Later runs cannot rescue a failed first run.

The decision register remains off the critical path: WP8 stays retired; this finding does not justify reopening it or authorize shipping. Phase 4/M2a and Phase 5 do not wait on H0 positivity. Power assessment is not reached because development readiness failed.

- [Full machine aggregate](aggregate.json): exact effects, intervals, binding comparisons, per-case success counts and pairwise run discordances.
- [Frozen protocol](protocol.json), [schedule](schedule.json), [execution state](state.json).
- [GOPATH recovery](../v3-gopath-recovery-2026-09-07/RESULT.md).
- [Retirement and decision register](../../../docs/planning/final/phase-3-h0-evidence-utility/gate-retirement-2026-09-07.md).
