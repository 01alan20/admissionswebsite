import type { Institution } from "../types";

// UI score: 1 (weak / red) -> 6 (strong / green)
export type UiScore = 1 | 2 | 3 | 4 | 5 | 6;

const clampScore = (value: number): UiScore =>
  (Math.max(1, Math.min(6, Math.round(value))) as UiScore);

// Harvard raw scale is 1 (best) -> 6 (weakest).
// We invert to UI scale 1 (weakest) -> 6 (strongest).
const toUiScore = (harvardRaw: UiScore): UiScore =>
  (7 - harvardRaw) as UiScore;

export const scoreGpa = (gpaRaw: number | null | undefined): UiScore | null => {
  if (gpaRaw == null || Number.isNaN(gpaRaw) || gpaRaw <= 0) {
    // Treat missing / zero GPA as weakest for now.
    return toUiScore(6);
  }

  let harvardRaw: UiScore;

  if (gpaRaw >= 3.7) {
    // Summa potential.
    harvardRaw = 1;
  } else if (gpaRaw >= 3.4) {
    // Magna potential.
    harvardRaw = 2;
  } else if (gpaRaw >= 3.0) {
    // Cum laude potential.
    harvardRaw = 3;
  } else if (gpaRaw >= 2.55) {
    // Adequate preparation.
    harvardRaw = 4;
  } else {
    // Marginal potential.
    harvardRaw = 5;
  }

  return toUiScore(harvardRaw);
};

// Combined SAT/ACT strength on 1-6 UI scale.
export const scoreTestsCombined = (
  satTotal: number | null,
  actComposite: number | null
): UiScore | null => {
  if (satTotal == null && actComposite == null) return null;

  // SAT thresholds using requested buckets:
  // < 800  -> red
  // 800-999 -> orange
  // 1000-1299 -> yellow
  // 1300-1499 -> green
  // 1500-1600 -> dark green
  if (satTotal != null) {
    if (satTotal >= 1500) return 6; // dark green / top-tier
    if (satTotal >= 1300) return 5; // strong / green
    if (satTotal >= 1000) return 4; // above average / yellow
    if (satTotal >= 800) return 3; // below-average but workable / orange
    return 1; // red
  }

  // ACT thresholds if SAT missing.
  if (actComposite != null) {
    // Roughly analogous bands for ACT composite.
    if (actComposite >= 34) return 6;
    if (actComposite >= 31) return 5;
    if (actComposite >= 26) return 4;
    if (actComposite >= 22) return 3;
    return 1;
  }

  return null;
};

export const scoreSatOnly = (satTotal: number | null): UiScore | null =>
  scoreTestsCombined(satTotal, null);

export const scoreActOnly = (actComposite: number | null): UiScore | null =>
  scoreTestsCombined(null, actComposite);

// Overall academic strength for the student (global, not school-specific).
// Athletics is intentionally down-weighted; we only give it a small bump if
// the caller passes a positive athleticsBoost (e.g., international-level recruit).
export const scoreAcademicOverall = (
  gpaScore: UiScore | null,
  testScore: UiScore | null,
  athleticsBoost = 0
): UiScore | null => {
  const baseScores = [gpaScore, testScore].filter(
    (s): s is UiScore => s != null
  );
  if (baseScores.length === 0) return null;

  let avg =
    baseScores.reduce((sum, s) => sum + s, 0) / baseScores.length +
    athleticsBoost;

  return clampScore(avg);
};

export type SchoolTestMetrics = {
  sat25?: number | null;
  sat50?: number | null;
  sat75?: number | null;
  act25?: number | null;
  act50?: number | null;
  act75?: number | null;
};

export type TestPolicyCategory = "required" | "optional" | "not_considered";

export const categorizeTestPolicy = (
  rawPolicy: string | null | undefined
): TestPolicyCategory => {
  if (!rawPolicy) return "required";
  const lower = rawPolicy.toLowerCase();
  if (lower.includes("blind") || lower.includes("not considered")) {
    return "not_considered";
  }
  if (lower.includes("optional")) {
    return "optional";
  }
  return "required";
};

const alignmentFromRange = (
  value: number,
  p25: number,
  p50: number | null,
  p75: number
): number => {
  if (value >= p75) return 1; // above typical admitted
  if (p50 != null && value >= p50) return 0; // solidly in the band
  if (value >= p25) return -1; // below median but within band
  return -2; // below 25th
};

export const adjustAcademicForSchool = (opts: {
  overallAcademic: UiScore | null;
  satTotal: number | null;
  actComposite: number | null;
  metrics?: SchoolTestMetrics;
  testPolicyRaw?: string | null;
}): UiScore | null => {
  const { overallAcademic, satTotal, actComposite, metrics, testPolicyRaw } =
    opts;
  if (overallAcademic == null) return null;

  const policy = categorizeTestPolicy(testPolicyRaw);
  if (policy === "not_considered" || !metrics) {
    // School is test blind or we have no ranges; do not adjust.
    return overallAcademic;
  }

  const adjustments: number[] = [];

  // SAT alignment
  const { sat25, sat50, sat75, act25, act50, act75 } = metrics;

  if (sat25 != null && sat75 != null) {
    if (satTotal != null) {
      adjustments.push(
        alignmentFromRange(satTotal, sat25, sat50 ?? null, sat75)
      );
    } else if (policy === "required") {
      // Required but missing: modest penalty.
      adjustments.push(-2);
    }
  }

  // ACT alignment
  if (act25 != null && act75 != null) {
    if (actComposite != null) {
      adjustments.push(
        alignmentFromRange(actComposite, act25, act50 ?? null, act75)
      );
    } else if (policy === "required") {
      adjustments.push(-2);
    }
  }

  if (adjustments.length === 0) {
    return overallAcademic;
  }

  const avgAdj =
    adjustments.reduce((sum, v) => sum + v, 0) / adjustments.length;

  return clampScore(overallAcademic + avgAdj);
};

export type TierLabel =
  | "Lottery"
  | "Reach"
  | "Target"
  | "Safety"
  | "Super Safe"
  | "Unknown";

const selectivityFromAcceptance = (
  acceptanceRate: number | null | undefined
): UiScore | null => {
  if (acceptanceRate == null) return null;
  const r = acceptanceRate;
  if (r < 0.1) return 6;
  if (r < 0.25) return 5;
  if (r < 0.4) return 4;
  if (r < 0.6) return 3;
  if (r < 0.8) return 2;
  return 1;
};

export const computeTierLabel = (opts: {
  acceptanceRate: number | null | undefined;
  academicScore: UiScore | null;
}): TierLabel => {
  const { acceptanceRate, academicScore } = opts;
  if (acceptanceRate == null) return "Unknown";

  // Hyper-selective rule: always Lottery under 10% admit.
  if (acceptanceRate < 0.1) return "Lottery";

  const selectivity = selectivityFromAcceptance(acceptanceRate);
  if (selectivity == null || academicScore == null) {
    // Fall back to acceptance-rate-only tiers.
    if (acceptanceRate < 0.25) return "Reach";
    if (acceptanceRate < 0.5) return "Target";
    if (acceptanceRate < 0.75) return "Safety";
    return "Super Safe";
  }

  // Be more generous as acceptance rate climbs: give a small "boost" to the
  // student's academic score for higher-admit schools so tiers lean safer.
  let generosityBoost = 0;
  if (acceptanceRate >= 0.75) {
    generosityBoost = 1;
  } else if (acceptanceRate >= 0.5) {
    generosityBoost = 0.5;
  }

  const effectiveAcademic = academicScore + generosityBoost;
  const diff = effectiveAcademic - selectivity;

  if (diff <= -2) return "Reach";
  if (diff === -1) return "Reach";
  if (diff === 0) return "Target";
  if (diff === 1) return "Safety";
  return "Super Safe";
};

export const tierColorClass = (tier: TierLabel): string => {
  switch (tier) {
    case "Lottery":
      return "bg-red-600 text-white";
    case "Reach":
      return "bg-orange-500 text-white";
    case "Target":
      return "bg-yellow-400 text-slate-900";
    case "Safety":
      return "bg-lime-400 text-slate-900";
    case "Super Safe":
      return "bg-green-500 text-white";
    default:
      return "bg-slate-200 text-slate-800";
  }
};

export const buildSchoolMetricsFromInstitution = (
  unitId: number,
  metricsByUnit: Record<
    number,
    {
      sat25?: number | null;
      sat50?: number | null;
      sat75?: number | null;
      act25?: number | null;
      act50?: number | null;
      act75?: number | null;
    }
  >
): SchoolTestMetrics | undefined => {
  const m = metricsByUnit[unitId];
  if (!m) return undefined;
  return {
    sat25: m.sat25 ?? null,
    sat50: m.sat50 ?? null,
    sat75: m.sat75 ?? null,
    act25: m.act25 ?? null,
    act50: m.act50 ?? null,
    act75: m.act75 ?? null,
  };
};
