import type { AcademicStats, AdmissionCategory } from "../types/supabase";

export type CollegeMetrics = {
  acceptanceRate?: number | null; // 0–1
  sat25?: number | null;
  sat75?: number | null;
  act25?: number | null;
  act75?: number | null;
};

export function calculateChances(
  stats: AcademicStats,
  college: CollegeMetrics
): AdmissionCategory {
  const sat = stats.sat ?? null;
  const act = stats.act ?? null;
  const acceptance =
    typeof college.acceptanceRate === "number"
      ? college.acceptanceRate
      : null;

  let score = 0;

  if (sat != null && college.sat25 != null && college.sat75 != null) {
    const mid = (college.sat25 + college.sat75) / 2;
    if (sat >= college.sat75) score += 2;
    else if (sat >= mid) score += 1;
    else if (sat < college.sat25) score -= 1;
  } else if (
    act != null &&
    college.act25 != null &&
    college.act75 != null
  ) {
    const mid = (college.act25 + college.act75) / 2;
    if (act >= college.act75) score += 2;
    else if (act >= mid) score += 1;
    else if (act < college.act25) score -= 1;
  }

  if (stats.gpa != null) {
    if (stats.gpa >= 3.8) score += 1;
    else if (stats.gpa < 3.0) score -= 1;
  }

  if (acceptance != null) {
    if (acceptance <= 0.25) {
      score -= 1;
    } else if (acceptance >= 0.75) {
      score += 2;
    } else if (acceptance >= 0.5) {
      score += 1;
    }
  }

  // TODO: Adjust weighting logic here if you want
  // to tune how GPA, scores, and admit rate contribute
  // to Safety / Target / Reach thresholds.

  // Treat clearly stronger profiles or very high admit-rate schools
  // as Safety. Only clearly weaker profiles are Reach.
  if (score >= 2) return "Safety";
  if (score <= -1) return "Reach";
  return "Target";
}

