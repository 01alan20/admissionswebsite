export function calculateProfileScore(profile) {
  const tests = parseTestsTaken(profile);
  const hasSat = tests.includes("sat");
  const hasAct = tests.includes("act");
  const gpaScore = normalize(profile.gpa, 4) * 40;

  const satTotal = (Number(profile.sat_math) || 0) + (Number(profile.sat_ebrw) || 0);
  const satScore = hasSat ? normalize(satTotal, 1600) * 35 : 0;

  const actComposite = Number(profile.act_composite) || 0;
  const actScore = hasAct ? normalize(actComposite, 36) * 35 : 0;

  const testScore = Math.max(satScore, actScore);

  const extracurricularsCount = Array.isArray(profile.extracurriculars) ? profile.extracurriculars.length : 0;
  const extraScore = Math.min(extracurricularsCount * 12, 25);

  const base = gpaScore + testScore + extraScore;
  return Math.round(Math.min(base, 100));
}

function normalize(value = 0, max = 1) {
  if (!max) return 0;
  const num = Math.max(0, Math.min(Number(value) || 0, max));
  return num / max;
}

function parseTestsTaken(profile) {
  if (!profile || profile.tests_taken == null) return [];
  if (Array.isArray(profile.tests_taken)) {
    return profile.tests_taken.map((item) => String(item).toLowerCase()).filter(Boolean);
  }
  if (typeof profile.tests_taken === "string") {
    return profile.tests_taken
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter((item) => item && item !== "none");
  }
  return [];
}

export function improvementSuggestions(profile) {
  const suggestions = [];
  const tests = parseTestsTaken(profile);
  const hasSat = tests.includes("sat");
  const hasAct = tests.includes("act");

  const satTotal = (Number(profile.sat_math) || 0) + (Number(profile.sat_ebrw) || 0);
  const actComposite = Number(profile.act_composite) || 0;
  const bestTestPercent = Math.max(
    hasSat ? normalize(satTotal, 1600) : 0,
    hasAct ? normalize(actComposite, 36) : 0
  );

  if (!hasSat && !hasAct) {
    suggestions.push({
      label: "Plan your SAT/ACT timeline",
      delta: 14
    });
  } else {
    const delta = Math.max(0, (0.94 - bestTestPercent) * 55);
    if (delta >= 2.5) {
      const label =
        hasSat && hasAct
          ? "Target a higher test percentile"
          : hasSat
            ? "Sharpen SAT pacing"
            : "Raise ACT composite";
      suggestions.push({
        label,
        delta: Math.min(delta, 18)
      });
    }
  }

  const extracurricularsCount = Array.isArray(profile.extracurriculars) ? profile.extracurriculars.length : 0;
  if (extracurricularsCount < 5) {
    const extraDelta = Math.min(12, (5 - extracurricularsCount) * 2.8 + 3);
    suggestions.push({
      label: "Level up extracurricular impact",
      delta: extraDelta
    });
  }

  const gpa = Number(profile.gpa) || 0;
  if (gpa && gpa < 3.85) {
    suggestions.push({
      label: "Sustain GPA momentum",
      delta: Math.min(8, Math.max(2.5, (3.85 - gpa) * 9))
    });
  }

  if (!suggestions.length) {
    suggestions.push({
      label: "Polish personal narrative & recommendations",
      delta: 4
    });
  }

  return suggestions.slice(0, 3).map((item) => ({
    ...item,
    impact: `${item.delta >= 0 ? "+" : ""}${item.delta.toFixed(1)}%`
  }));
}

export function calculatePotentialScore(profile) {
  const current = calculateProfileScore(profile);
  const totalDelta = improvementSuggestions(profile).reduce((sum, item) => sum + (item.delta || 0), 0);
  const gap = Math.max(0, 100 - current);
  const realisticLift = Math.min(totalDelta, 28);
  return Math.min(100, Math.round(current + Math.min(realisticLift, gap)));
}
