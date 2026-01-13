import type { StudentProfileSummary } from "../context/OnboardingContext";

export type EssayLabRequirements = {
  demographicsComplete: boolean;
  hasTargets: boolean;
  hasThreeActivities: boolean;
  hasGpa: boolean;
  missing: string[];
};

export const getEssayLabRequirements = (input: {
  demographics: Record<string, any> | null | undefined;
  targetUnitIds: number[] | null | undefined;
  studentProfile: StudentProfileSummary | null | undefined;
}): EssayLabRequirements => {
  const demographics = (input.demographics ?? {}) as Record<string, any>;
  const targetUnitIds = input.targetUnitIds ?? [];
  const studentProfile = input.studentProfile ?? ({} as StudentProfileSummary);

  const gender = String(demographics.gender ?? "").trim();
  const race = String(demographics.race ?? "").trim();
  const country = String(demographics.country ?? "").trim();
  const city = String(demographics.city ?? "").trim();
  const gradYear = demographics.grad_year ?? null;

  const demographicsComplete =
    Boolean(gender) &&
    Boolean(race) &&
    Boolean(country) &&
    Boolean(city) &&
    (typeof gradYear === "number"
      ? Number.isFinite(gradYear)
      : Boolean(String(gradYear ?? "").trim()));

  const hasTargets = Array.isArray(targetUnitIds) && targetUnitIds.length > 0;
  const activities = studentProfile.activities ?? [];
  const hasThreeActivities = Array.isArray(activities) && activities.length >= 3;
  const hasGpa = typeof studentProfile.gpa === "number" && Number.isFinite(studentProfile.gpa);

  const missing: string[] = [];
  if (!demographicsComplete) missing.push("Demographics (gender, race, country, city, graduation year)");
  if (!hasTargets) missing.push("Target schools");
  if (!hasThreeActivities) missing.push("3 extracurriculars");
  if (!hasGpa) missing.push("GPA");

  return { demographicsComplete, hasTargets, hasThreeActivities, hasGpa, missing };
};

export const countWords = (text: string): number => {
  const cleaned = String(text ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return 0;
  return cleaned.split(" ").length;
};

