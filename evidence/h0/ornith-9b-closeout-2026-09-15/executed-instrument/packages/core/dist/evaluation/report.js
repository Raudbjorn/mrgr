import { err, ok } from "./result.js";
export function selectBaseline(records, selectedBaseline) {
    const available = [
        ...new Set(records.map((record) => record.baselineId)),
    ].sort();
    const details = { availableBaselines: available.join(",") };
    if (available.length === 0)
        return err("corrupt-corpus", "select baseline", "Corpus contains no records", details);
    if (selectedBaseline === undefined && available.length !== 1) {
        return err("config", "select baseline", "Corpus contains multiple baselines; select one explicitly", details);
    }
    const baselineId = selectedBaseline ?? available[0];
    if (!available.includes(baselineId)) {
        return err("config", "select baseline", "Selected baseline is not present in the corpus", { ...details, selectedBaseline: baselineId });
    }
    const selected = records.filter((record) => record.baselineId === baselineId);
    const versions = [
        ...new Set(selected.map((record) => record.replayProvenance.gitVersion)),
    ].sort();
    if (versions.length !== 1) {
        return err("corrupt-corpus", "select baseline", "One baseline ID maps to multiple Git versions", {
            baselineId,
            gitVersions: versions.join(","),
        });
    }
    return ok({
        baselineId,
        gitVersion: versions[0],
        records: selected,
    });
}
function countStratum(records, topology) {
    const selected = records.filter((record) => record.baseTopology === topology);
    return {
        candidates: selected.length,
        clean: selected.filter((record) => record.replayStatus === "clean").length,
        conflicted: selected.filter((record) => record.replayStatus === "conflicted").length,
        exactRegions: selected.reduce((count, record) => count +
            record.conflictRegions.filter((region) => region.localizationStatus === "exact").length, 0),
    };
}
function stratumLine(label, counts) {
    return `${label} stratum: candidates=${counts.candidates} clean=${counts.clean} conflicted=${counts.conflicted} exact localized regions=${counts.exactRegions}`;
}
export function generateReport(records, selectedBaseline) {
    const selection = selectBaseline(records, selectedBaseline);
    if (!selection.ok)
        return selection;
    const selected = selection.value.records;
    const replayCounts = {
        clean: 0,
        conflicted: 0,
        unrelated: 0,
        "unsupported-custom-driver": 0,
        error: 0,
    };
    for (const record of selected)
        replayCounts[record.replayStatus] += 1;
    const regions = selected.flatMap((record) => record.conflictRegions);
    const exact = regions.filter((region) => region.localizationStatus === "exact");
    const ambiguous = regions.filter((region) => region.localizationStatus === "ambiguous").length;
    const unsupported = regions.filter((region) => region.localizationStatus === "unsupported-binary" ||
        region.localizationStatus === "unsupported-structural").length;
    const resolutionCounts = {
        ours: 0,
        theirs: 0,
        base: 0,
        deleted: 0,
        novel: 0,
    };
    for (const region of exact)
        resolutionCounts[region.resolutionClass] += 1;
    const normalizedNovel = exact.filter((region) => region.novelAfterNormalization).length;
    const tripleGroups = new Map();
    for (const region of exact) {
        const group = tripleGroups.get(region.tripleKey);
        if (group === undefined)
            tripleGroups.set(region.tripleKey, [region]);
        else
            group.push(region);
    }
    let repeatedGroups = 0;
    let divergentGroups = 0;
    let ambiguityNumerator = 0;
    for (const group of tripleGroups.values()) {
        if (group.length < 2)
            continue;
        repeatedGroups += 1;
        const resolutionFrequencies = new Map();
        for (const region of group) {
            const key = region.normalizedDigests.resolution;
            resolutionFrequencies.set(key, (resolutionFrequencies.get(key) ?? 0) + 1);
        }
        if (resolutionFrequencies.size > 1)
            divergentGroups += 1;
        ambiguityNumerator +=
            group.length - Math.max(...resolutionFrequencies.values());
    }
    const replayAttempted = replayCounts.clean + replayCounts.conflicted;
    const incidence = replayAttempted === 0
        ? "pinned modern replay incidence: not measurable (no attempted replays)"
        : `pinned modern replay incidence: ${replayCounts.conflicted}/${replayAttempted} (${(replayCounts.conflicted / replayAttempted).toFixed(6)})`;
    const ambiguity = repeatedGroups === 0
        ? "observed deterministic ambiguity floor: not measurable (no repeated localized triples)"
        : `observed deterministic ambiguity floor: ${ambiguityNumerator}/${exact.length} (${(ambiguityNumerator / exact.length).toFixed(6)})`;
    const single = countStratum(selected, "single");
    const multiple = countStratum(selected, "multiple");
    return ok([
        `baseline ID: ${selection.value.baselineId}`,
        `Git version: ${selection.value.gitVersion}`,
        `candidates=${selected.length}`,
        `replay: clean=${replayCounts.clean} conflicted=${replayCounts.conflicted} unrelated=${replayCounts.unrelated} quarantined=${replayCounts["unsupported-custom-driver"]} error=${replayCounts.error}`,
        `conflicted path occurrences=${selected.reduce((count, record) => count + record.conflictPaths.length, 0)}`,
        `exact localized regions=${exact.length} ambiguous regions=${ambiguous} unsupported regions=${unsupported}`,
        `exact resolution: ours=${resolutionCounts.ours} theirs=${resolutionCounts.theirs} base=${resolutionCounts.base} deleted=${resolutionCounts.deleted} novel=${resolutionCounts.novel} normalized-novel=${normalizedNovel}`,
        stratumLine("single-base", single),
        stratumLine("multiple-base", multiple),
        `repeated triple groups=${repeatedGroups} divergent resolution groups=${divergentGroups}`,
        `replay attempted=${replayAttempted}`,
        incidence,
        "historical conflict incidence: not measured",
        ambiguity,
    ].join("\n") + "\n");
}
//# sourceMappingURL=report.js.map