const numberOrNull = (value) => Number.isFinite(value) ? Number(value) : null;

const total = (values) => {
  const measured = values.map(numberOrNull).filter((value) => value !== null);
  return measured.length ? measured.reduce((sum, value) => sum + value, 0) : null;
};

function releaseIdentity(artifact) {
  const release = artifact?.release ?? artifact?.health?.body?.release ?? null;
  const commitSha = typeof release?.commitSha === "string" && release.commitSha.trim()
    ? release.commitSha.trim()
    : null;
  const commitRef = typeof release?.commitRef === "string" && release.commitRef.trim()
    ? release.commitRef.trim()
    : null;
  return { commitSha, commitRef };
}

export function summariseModeArtifact(artifact, expectedMode) {
  const rows = Array.isArray(artifact?.rows) ? artifact.rows : [];
  const requestedMode = artifact?.requestedMode ?? null;
  const measured = artifact?.status === "measured" && rows.length > 0;
  const successfulRows = rows.filter((row) => row?.apiOk === true);
  const modeHonored = requestedMode === expectedMode && successfulRows.length > 0 &&
    successfulRows.every((row) => row.mode === expectedMode && row.modeHonored !== false);
  const release = releaseIdentity(artifact);

  return {
    status: !measured ? "not_measured" : modeHonored ? "measured" : "invalid",
    requestedMode,
    generatedAt: artifact?.generatedAt ?? null,
    target: artifact?.target ?? null,
    fixture: artifact?.fixture ?? null,
    release,
    releaseVerified: Boolean(release.commitSha && release.commitRef),
    cases: rows.length,
    caseIds: rows.map((row) => String(row.id ?? "")),
    passed: rows.filter((row) => row?.pass === true).length,
    requiredFactAccuracy: numberOrNull(artifact?.quality?.requiredFactAccuracy),
    citationPrecision: numberOrNull(artifact?.quality?.citationPrecision),
    citationCompleteness: numberOrNull(artifact?.quality?.citationCompleteness),
    p50LatencyMs: numberOrNull(artifact?.latencyMs?.p50),
    p95LatencyMs: numberOrNull(artifact?.latencyMs?.p95),
    meanCalls: numberOrNull(artifact?.calls?.mean),
    totalCostUnits: total(rows.map((row) => row?.costUnits)),
    modeHonored,
  };
}

export function compareLiveModes(fastArtifact, thinkingArtifact) {
  const fast = summariseModeArtifact(fastArtifact, "fast");
  const thinking = summariseModeArtifact(thinkingArtifact, "thinking");
  const bothMeasured = fast.status === "measured" && thinking.status === "measured";
  const sameCases = fast.caseIds.length === thinking.caseIds.length &&
    fast.caseIds.every((id, index) => id === thinking.caseIds[index]);
  const sameRelease = fast.releaseVerified && thinking.releaseVerified &&
    fast.release.commitSha === thinking.release.commitSha &&
    fast.release.commitRef === thinking.release.commitRef;
  const compatible = bothMeasured && fast.target === thinking.target &&
    fast.fixture === thinking.fixture && sameCases && sameRelease;

  if (!compatible) {
    const status = !bothMeasured
      ? (fast.status === "not_measured" && thinking.status === "not_measured" ? "not_measured" : "partial")
      : "incompatible";
    const note = !bothMeasured
      ? "Run both explicit modes before comparing accuracy, latency, calls, or cost."
      : !sameRelease
        ? "Fast and Thinking artifacts must identify the same deployed commit and branch."
        : "Fast and Thinking artifacts do not cover the same target, fixture, and ordered case set.";
    return { status, note, comparable: false, fast, thinking, deltas: null, rows: [] };
  }

  const difference = (thinkingValue, fastValue) =>
    thinkingValue === null || fastValue === null ? null : thinkingValue - fastValue;
  const ratio = thinking.p50LatencyMs && fast.p50LatencyMs
    ? thinking.p50LatencyMs / fast.p50LatencyMs
    : null;
  const thinkingRows = new Map(thinkingArtifact.rows.map((row) => [row.id, row]));

  return {
    status: "measured",
    note: "Both modes ran the same frozen cases against the same deployed release.",
    comparable: true,
    fast,
    thinking,
    deltas: {
      thinkingMinusFastPasses: thinking.passed - fast.passed,
      thinkingMinusFastFactAccuracy: difference(thinking.requiredFactAccuracy, fast.requiredFactAccuracy),
      thinkingMinusFastP50LatencyMs: difference(thinking.p50LatencyMs, fast.p50LatencyMs),
      thinkingToFastP50LatencyRatio: ratio,
      thinkingMinusFastMeanCalls: difference(thinking.meanCalls, fast.meanCalls),
      thinkingMinusFastCostUnits: difference(thinking.totalCostUnits, fast.totalCostUnits),
    },
    rows: fastArtifact.rows.map((fastRow) => {
      const thinkingRow = thinkingRows.get(fastRow.id) ?? {};
      return {
        id: fastRow.id,
        label: fastRow.label,
        fast: {
          pass: fastRow.pass === true,
          requiredFactRecall: numberOrNull(fastRow.requiredFactRecall),
          latencyMs: numberOrNull(fastRow.latencyMs),
          callCount: numberOrNull(fastRow.callCount),
          costUnits: numberOrNull(fastRow.costUnits),
        },
        thinking: {
          pass: thinkingRow.pass === true,
          requiredFactRecall: numberOrNull(thinkingRow.requiredFactRecall),
          latencyMs: numberOrNull(thinkingRow.latencyMs),
          callCount: numberOrNull(thinkingRow.callCount),
          costUnits: numberOrNull(thinkingRow.costUnits),
        },
      };
    }),
  };
}
