import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useOnboardingGuard } from "../hooks/useOnboardingGuard";
import { useOnboardingContext } from "../context/OnboardingContext";
import {
  getAllInstitutions,
  getInstitutionsSummariesByIds,
  getInstitutionMetrics,
  getMajorsMeta,
} from "../data/api";
import type { Institution, InstitutionMetrics, MajorsMeta, Metric } from "../types";
import {
  scoreGpa,
  scoreTestsCombined,
  scoreSatOnly,
  scoreActOnly,
  scoreAcademicOverall,
  adjustAcademicForSchool,
  computeTierLabel,
  tierColorClass,
  buildSchoolMetricsFromInstitution,
} from "../utils/admissionsModel";

const ProfileDashboardPage: React.FC = () => {
  const loading = useOnboardingGuard(9);
  const { targetUnitIds, user, studentProfile, logout } = useOnboardingContext();
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [recommendedInstitutions, setRecommendedInstitutions] = useState<Institution[]>([]);
  const [fetching, setFetching] = useState(false);
  const [metricsByUnit, setMetricsByUnit] = useState<
    Record<
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
  >({});
  const [majorsMeta, setMajorsMeta] = useState<MajorsMeta | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const meta = await getMajorsMeta();
        if (!cancelled) setMajorsMeta(meta);
      } catch {
        if (!cancelled) setMajorsMeta(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const displayMajorLabel = (value: string): string => {
    if (!majorsMeta) return value;
    const code = (value || "").trim();
    if (!code) return value;
    const raw =
      majorsMeta.two_digit?.[code] ??
      majorsMeta.four_digit?.[code] ??
      majorsMeta.six_digit?.[code] ??
      null;
    if (!raw) return value;
    let t = String(raw).trim();
    if (
      (t.startsWith('"') && t.endsWith('"')) ||
      (t.startsWith("'") && t.endsWith("'"))
    ) {
      t = t.slice(1, -1).trim();
    } else {
      if (t.startsWith('"') || t.startsWith("'")) t = t.slice(1).trim();
      if (t.endsWith('"') || t.endsWith("'")) t = t.slice(0, -1).trim();
    }
    return t || value;
  };

  useEffect(() => {
    if (!targetUnitIds || targetUnitIds.length === 0) return;
    let cancelled = false;
    (async () => {
      setFetching(true);
      try {
        const [rows, metricsList] = await Promise.all([
          getInstitutionsSummariesByIds(targetUnitIds),
          Promise.all(targetUnitIds.map((id) => getInstitutionMetrics(id))),
        ]);
        if (!cancelled) {
          setInstitutions(rows);
          const metricMap: Record<
            number,
            {
              sat25?: number | null;
              sat50?: number | null;
              sat75?: number | null;
              act25?: number | null;
              act50?: number | null;
              act75?: number | null;
            }
          > = {};
          targetUnitIds.forEach((id, idx) => {
            const data: InstitutionMetrics = metricsList[idx];
            const latest: Metric | undefined = data.metrics
              ?.slice()
              .sort((a, b) => b.year - a.year)[0];
            if (latest) {
              metricMap[id] = {
                sat25:
                  latest.sat_math_25th_percentile_score != null &&
                  latest.sat_evidence_based_reading_and_writing_25th_percentile_score != null
                    ? latest.sat_math_25th_percentile_score +
                      latest.sat_evidence_based_reading_and_writing_25th_percentile_score
                    : null,
                sat50:
                  latest.sat_math_50th_percentile_score != null &&
                  latest.sat_evidence_based_reading_and_writing_50th_percentile_score != null
                    ? latest.sat_math_50th_percentile_score +
                      latest.sat_evidence_based_reading_and_writing_50th_percentile_score
                    : null,
                sat75:
                  latest.sat_math_75th_percentile_score != null &&
                  latest.sat_evidence_based_reading_and_writing_75th_percentile_score != null
                    ? latest.sat_math_75th_percentile_score +
                      latest.sat_evidence_based_reading_and_writing_75th_percentile_score
                    : null,
                act25: latest.act_composite_25th_percentile_score ?? null,
                act50: latest.act_composite_50th_percentile_score ?? null,
                act75: latest.act_composite_75th_percentile_score ?? null,
              };
            }
          });
          setMetricsByUnit(metricMap);
        }
      } catch {
        if (!cancelled) {
          setInstitutions([]);
          setMetricsByUnit({});
        }
      } finally {
        if (!cancelled) setFetching(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [targetUnitIds]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto text-center py-12">
        <p className="text-gray-600 text-sm">Loading your dashboardΓÇª</p>
      </div>
    );
  }

  const studentSatTotal =
    studentProfile.satMath != null && studentProfile.satEBRW != null
      ? studentProfile.satMath + studentProfile.satEBRW
      : null;
  const studentAct = studentProfile.actComposite ?? null;

  const computeScoreFromGpa = (gpa: number | null | undefined): number | null => {
    if (gpa == null) return null;
    // 4.0 is highest; 3.5ΓÇô4.0 strongest; 3.0ΓÇô3.49 next; then three more bands.
    if (gpa >= 3.5) return 5;
    if (gpa >= 3.0) return 4;
    if (gpa >= 2.5) return 3;
    if (gpa >= 2.0) return 2;
    return 1;
  };

  const computeScoreFromTests = (
    satTotal: number | null,
    actComposite: number | null
  ): number | null => {
    if (satTotal == null && actComposite == null) return null;
    if (satTotal != null) {
      if (satTotal >= 1550) return 6;
      if (satTotal >= 1500) return 5;
      if (satTotal >= 1350) return 4;
      if (satTotal >= 1200) return 3;
      if (satTotal >= 1000) return 2;
      return 1;
    }
    if (actComposite != null) {
      if (actComposite >= 35) return 6;
      if (actComposite >= 33) return 5;
      if (actComposite >= 29) return 4;
      if (actComposite >= 26) return 3;
      if (actComposite >= 22) return 2;
      return 1;
    }
    return null;
  };

  const gpaScore = scoreGpa(studentProfile.gpa ?? null);
  const testScore = scoreTestsCombined(studentSatTotal, studentAct);
  const satOnlyScore = scoreSatOnly(studentSatTotal);
  const actOnlyScore = scoreActOnly(studentAct);
  const overallAcademic = scoreAcademicOverall(gpaScore, testScore, 0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const all = await getAllInstitutions();
        if (cancelled) return;

        const targetSet = new Set(targetUnitIds);
        const majors = (studentProfile.majors || []).map((m) => m.toLowerCase());

        const targetAcceptanceAcademic = (() => {
          if (overallAcademic == null) return 0.45;
          if (overallAcademic >= 5) return 0.15;
          if (overallAcademic >= 4) return 0.25;
          if (overallAcademic >= 3) return 0.35;
          if (overallAcademic >= 2) return 0.55;
          return 0.65;
        })();

        const targetAcceptanceFromTargets = (() => {
          const rates = institutions
            .map((inst) => inst.acceptance_rate)
            .filter((r): r is number => r != null);
          if (!rates.length) return null;
          const avg = rates.reduce((sum, r) => sum + r, 0) / rates.length;
          return avg;
        })();

        const targetAcceptance =
          targetAcceptanceFromTargets != null
            ? (targetAcceptanceAcademic + targetAcceptanceFromTargets) / 2
            : targetAcceptanceAcademic;

        const countryLower = (studentProfile.country ?? "").toLowerCase();
        const internationalBonus =
          countryLower && countryLower !== "united states" ? 2 : 0;

        const scored = all
          .filter((inst) => !targetSet.has(inst.unitid))
          .map((inst) => {
            const acceptance = inst.acceptance_rate ?? 0.5;
            const intl = inst.intl_enrollment_pct ?? 0;
            const acceptanceScore = -Math.abs(acceptance - targetAcceptance) * 100;
            const intlScore = intl >= 0.1 ? 8 : intl >= 0.05 ? 5 : intl >= 0.02 ? 2 : 0;
            const fitsIntlProfile = intlScore > 0 ? internationalBonus : 0;
            const testRequiredPenalty =
              (studentSatTotal == null && studentAct == null && inst.test_policy === "Required") ? -8 : 0;
            const majorMatches =
              majors.length === 0
                ? 0
                : (inst.major_families || []).filter((m) => {
                    const name = (m ?? "").toLowerCase();
                    if (!name) return false;
                    return majors.some((sel) => sel.includes(name) || name.includes(sel));
                  }).length;
            const majorScore =
              majors.length === 0
                ? 0
                : majorMatches > 0
                ? 12 + majorMatches * 2
                : -12;

            const totalScore = acceptanceScore + intlScore + fitsIntlProfile + testRequiredPenalty + majorScore;
            return { inst, score: totalScore };
          })
          .sort((a, b) => b.score - a.score)
          .slice(0, 3)
          .map((r) => r.inst);

        setRecommendedInstitutions(scored);
      } catch {
        if (!cancelled) setRecommendedInstitutions([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [overallAcademic, studentAct, studentSatTotal, studentProfile.country, studentProfile.majors, targetUnitIds]);

  const scoreColor = (score: number | null) => {
    if (score == null) return "bg-slate-300 text-slate-700";
    if (score >= 6) return "bg-green-700 text-white"; // dark green: top tier
    if (score >= 5) return "bg-green-500 text-white"; // green: strong
    if (score >= 4) return "bg-yellow-400 text-slate-900"; // yellow: above average
    if (score >= 3) return "bg-orange-400 text-white"; // orange: below average
    return "bg-red-500 text-white"; // red: lowest band
  };

  const scorePill = (label: string, score: number | null) => (
    <div className="flex items-center justify-between border border-slate-200 rounded-lg px-4 py-2">
      <span className="text-xs font-semibold text-slate-700">{label}</span>
      <span
        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${scoreColor(
          score
        )}`}
      >
        {score == null ? "Unknown" : `Score ${score}/6`}
      </span>
    </div>
  );

  const activitiesForDisplay = (() => {
    const acts = studentProfile.activities ?? [];
    if (!acts.length) return null;
    const levelRank: Record<string, number> = {
      "National/International": 3,
      "Regional/State": 2,
      "School Level": 1,
    };
    return [...acts].sort(
      (a, b) => (levelRank[b.level] ?? 0) - (levelRank[a.level] ?? 0)
    );
  })();

  return (
    <div className="max-w-5xl mx-auto">
      <div className="bg-white p-6 md:p-8 rounded-lg shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
          <h1 className="text-3xl font-bold text-brand-dark">
            Your Admissions Dashboard
          </h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate("/profile/name")}
              className="px-4 py-2 text-sm font-semibold rounded-lg border border-brand-secondary text-brand-secondary bg-white hover:bg-brand-secondary hover:text-white transition"
            >
              Edit Profile
            </button>
            <button
              type="button"
              onClick={async () => {
                await logout();
                navigate("/", { replace: true });
              }}
              className="px-4 py-2 text-sm font-semibold rounded-lg border border-slate-300 text-slate-600 bg-white hover:bg-slate-100 transition"
            >
              Log Out
            </button>
          </div>
        </div>

        {/* Student snapshot */}
        {false && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">
            Your Profile Snapshot
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="border border-slate-200 rounded-lg p-4">
              <div className="text-xs font-semibold text-slate-500 mb-1">
                Logged-in Email
              </div>
              <div className="text-slate-800">
                {user?.email ?? "Not available (magic-link only)"}
              </div>
            </div>
            <div className="border border-slate-200 rounded-lg p-4">
              <div className="text-xs font-semibold text-slate-500 mb-1">
                Location
              </div>
              <div className="text-slate-800">
                {studentProfile.country || studentProfile.city
                  ? `${studentProfile.city ?? ""}${
                      studentProfile.city && studentProfile.country ? ", " : ""
                    }${studentProfile.country ?? ""}`
                  : "Not provided yet"}
              </div>
            </div>
            <div className="border border-slate-200 rounded-lg p-4">
              <div className="text-xs font-semibold text-slate-500 mb-1">
                Class Rank
              </div>
              <div className="text-slate-800">
                {studentProfile.classRank ?? "Not provided yet"}
              </div>
            </div>
            {/* Academics snapshot removed to avoid duplication with GPA/Test cards */}
            {/* <div className="border border-slate-200 rounded-lg p-4">
              <div className="text-xs font-semibold text-slate-500 mb-1">
                Academics
              </div>
              <div className="text-slate-800">
                {studentProfile.gpa != null ? (
                  <>
                    GPA: {studentProfile.gpa.toFixed(2)}
                    {studentProfile.classRank
                      ? ` ΓÇó Class Rank: ${studentProfile.classRank}`
                      : ""}
                    <br />
                    {studentSatTotal != null && (
                      <>SAT Total: {studentSatTotal}</>
                    )}
                    {studentAct != null && (
                      <>
                        {studentSatTotal != null ? " ΓÇó " : ""}
                        ACT: {studentAct}
                      </>
                    )}
                  </>
                ) : (
                  "Not provided yet"
                )}
              </div>
            </div> */}
          </div>
        </section>
        )}

        {/* Profile summary */}
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">
            Profile Summary
          </h2>
          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* GPA */}
              <div className="flex items-center justify-between border border-slate-200 rounded-lg px-4 py-2">
                <span className="font-semibold text-slate-700">GPA</span>
                <span
                  className={`inline-flex items-center px-3 py-1 rounded-full font-semibold ${scoreColor(
                    gpaScore
                  )}`}
                >
                  {studentProfile.gpa != null
                    ? studentProfile.gpa.toFixed(2)
                    : "Not entered"}
                </span>
              </div>

              {/* SAT */}
              <div className="flex items-center justify-between border border-slate-200 rounded-lg px-4 py-2">
                <span className="font-semibold text-slate-700">SAT</span>
                <span
                  className={`inline-flex items-center px-3 py-1 rounded-full font-semibold ${scoreColor(
                    satOnlyScore
                  )}`}
                >
                  {studentSatTotal != null
                    ? `Total ${studentSatTotal}`
                    : "Not entered"}
                </span>
              </div>

              {/* ACT */}
              <div className="flex items-center justify-between border border-slate-200 rounded-lg px-4 py-2">
                <span className="font-semibold text-slate-700">ACT</span>
                <span
                  className={`inline-flex items-center px-3 py-1 rounded-full font-semibold ${scoreColor(
                    actOnlyScore
                  )}`}
                >
                  {studentAct != null ? `Composite ${studentAct}` : "Not entered"}
                </span>
              </div>
            </div>

            {/* Intended majors */}
            <div className="border border-slate-200 rounded-lg px-4 py-2">
              <div className="font-semibold text-slate-700 mb-2">Intended Majors</div>
              {studentProfile.majors && studentProfile.majors.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {studentProfile.majors.slice(0, 3).map((m) => (
                    <span
                      key={m}
                      className="inline-flex items-center px-3 py-1 rounded-full font-semibold bg-brand-light text-brand-dark"
                    >
                      {displayMajorLabel(m)}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="inline-flex items-center px-3 py-1 rounded-full font-semibold bg-slate-300 text-slate-700">
                  Not entered
                </span>
              )}
            </div>

            {/* Extracurriculars */}
            <div className="border border-slate-200 rounded-lg px-4 py-2">
              <div className="font-semibold text-slate-700 mb-2">
                Extracurriculars
              </div>
              {activitiesForDisplay ? (
                <div className="mt-1">
                  <div className="grid grid-cols-3 gap-x-2 text-xs font-semibold text-slate-500 mb-1 text-center">
                    <span>Activity</span>
                    <span className="border-l border-slate-200 pl-2">Role</span>
                    <span className="border-l border-slate-200 pl-2">Level</span>
                  </div>
                  <div className="grid grid-cols-3 gap-x-2 gap-y-0.5 text-xs text-slate-700 text-center">
                    {activitiesForDisplay.map((a) => (
                      <React.Fragment key={a.id}>
                        <span>{a.name || "Activity"}</span>
                        <span className="border-l border-slate-200 pl-2">
                          {a.role}
                        </span>
                        <span className="border-l border-slate-200 pl-2">
                          {a.level}
                        </span>
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              ) : (
                <span className="inline-flex items-center px-3 py-1 rounded-full font-semibold bg-slate-300 text-slate-700">
                  Not entered
                </span>
              )}
            </div>

            {/* Recommendations */}
            <div className="flex items-center justify-between border border-slate-200 rounded-lg px-4 py-2">
              <span className="font-semibold text-slate-700">
                Recommendations
              </span>
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full font-semibold ${scoreColor(
                  studentProfile.recScore ?? null
                )}`}
              >
                {(() => {
                  const s = studentProfile.recScore;
                  if (s == null) return "Unknown";
                  if (s >= 6) return "Strikingly unusual";
                  if (s >= 5) return "Very strong";
                  if (s >= 4) return "Above-average positive";
                  if (s >= 3) return "Neutral / mixed";
                  if (s >= 2) return "Negative / worrisome";
                  return "No rec / unread";
                })()}
              </span>
            </div>
          </div>
        </section>

        {/* Target universities with SAT/ACT comparison */}
        <section>
          <h2 className="text-sm font-semibold text-slate-700 mb-3">
            Your Target Universities
          </h2>
          {(!targetUnitIds || targetUnitIds.length === 0) && (
            <p className="text-sm text-slate-600">
              You haven&apos;t selected any target universities yet. Go back to Step 7
              of onboarding to choose up to three schools.
            </p>
          )}
          {targetUnitIds.length > 0 && (
            <div className="space-y-4">
              {fetching && (
                <p className="text-sm text-slate-500">Loading universitiesΓÇª</p>
              )}
              {!fetching &&
                institutions.map((inst) => {
                  const rate = inst.acceptance_rate;
                  const schoolMetrics = buildSchoolMetricsFromInstitution(
                    inst.unitid,
                    metricsByUnit
                  );
                  const schoolAcademicScore = adjustAcademicForSchool({
                    overallAcademic,
                    satTotal: studentSatTotal,
                    actComposite: studentAct,
                    metrics: schoolMetrics,
                    testPolicyRaw: inst.test_policy,
                  });
                  const tier = computeTierLabel({
                    acceptanceRate: rate,
                    academicScore: schoolAcademicScore,
                  });
                  const color = tierColorClass(tier);

                  const metrics = metricsByUnit[inst.unitid] || {};

                  return (
                    <div
                      key={inst.unitid}
                      className="border border-slate-200 rounded-lg p-4 flex flex-col gap-3"
                    >
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div>
                          <div className="font-semibold text-slate-900">
                            {inst.name}
                          </div>
                          <div className="text-xs text-slate-500">
                            {inst.city}, {inst.state}
                          </div>
                          <div className="text-xs text-slate-500 mt-1">
                            Acceptance rate:{" "}
                            {rate != null
                              ? `${Math.round(rate * 100)}%`
                              : "Not available"}
                          </div>
                        </div>
                        <div className="flex flex-col items-start md:items-end gap-2">
                          <span
                            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${color}`}
                          >
                            {tier}
                          </span>
                        </div>
                      </div>

                      <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] text-slate-600">
                        <div>
                          {metrics.sat25 != null && metrics.sat75 != null ? (
                            (() => {
                              const min = 400;
                              const max = 1600;
                              const range = max - min;
                              const p25 = metrics.sat25!;
                              const p75 = metrics.sat75!;
                              const p50 = metrics.sat50 ?? null;
                              const p25left = ((p25 - min) / range) * 100;
                              const p75right = ((max - p75) / range) * 100;
                              const p50left =
                                p50 != null ? ((p50 - min) / range) * 100 : null;
                              const studentLeft =
                                studentSatTotal != null
                                  ? Math.max(
                                      0,
                                      Math.min(
                                        100,
                                        ((studentSatTotal - min) / range) * 100
                                      )
                                    )
                                  : null;

                              return (
                                <>
                                  <div className="flex justify-between mb-1">
                                    <span className="font-semibold text-slate-700 text-[11px]">
                                      SAT
                                    </span>
                                  </div>
                                  <div className="relative h-3 w-full bg-gray-200 rounded-full">
                                    <div
                                      className="absolute h-3 bg-brand-secondary rounded-full"
                                      style={{
                                        left: `${p25left}%`,
                                        right: `${p75right}%`,
                                      }}
                                    />
                                    {p50left !== null && p50 != null && (
                                      <>
                                        <div
                                          className="absolute h-5 w-[2px] bg-brand-dark -top-1 rounded-full"
                                          style={{
                                            left: `calc(${p50left}% - 2px)`,
                                          }}
                                        />
                                        <div
                                          className="absolute top-4 text-[10px] font-semibold text-slate-700"
                                          style={{
                                            left: `${p50left}%`,
                                            transform: "translateX(-50%)",
                                          }}
                                        >
                                          {p50}
                                        </div>
                                      </>
                                    )}
                                    {studentLeft !== null && (
                                      <>
                                        <div
                                          className="absolute h-5 w-[3px] bg-brand-primary -top-1 rounded-full"
                                          style={{
                                            left: `calc(${studentLeft}% - 1.5px)`,
                                          }}
                                        />
                                        <div
                                          className="absolute -top-5 text-[10px] font-semibold text-brand-primary"
                                          style={{
                                            left: `${studentLeft}%`,
                                            transform: "translateX(-50%)",
                                          }}
                                        >
                                          {studentSatTotal}
                                        </div>
                                      </>
                                    )}
                                  </div>
                                  <div className="flex justify-between text-xs text-gray-500 mt-1 px-1">
                                    <span>{min}</span>
                                    <span>{max}</span>
                                  </div>
                                  {p50 == null && (
                                    <div className="text-center text-[10px] text-slate-500 mt-1">
                                      N/A
                                    </div>
                                  )}
                                </>
                              );
                            })()
                          ) : (
                            <span>SAT comparison: Unknown</span>
                          )}
                        </div>

                        <div>
                          {metrics.act25 != null && metrics.act75 != null ? (
                            (() => {
                              const min = 1;
                              const max = 36;
                              const range = max - min;
                              const p25 = metrics.act25!;
                              const p75 = metrics.act75!;
                              const p50 = metrics.act50 ?? null;
                                  const p25left = ((p25 - min) / range) * 100;
                                  const p75right = ((max - p75) / range) * 100;
                              const p50left =
                                p50 != null ? ((p50 - min) / range) * 100 : null;
                              const studentLeft =
                                studentAct != null
                                  ? Math.max(
                                      0,
                                      Math.min(
                                        100,
                                        ((studentAct - min) / range) * 100
                                      )
                                    )
                                  : null;

                              return (
                                <>
                                  <div className="flex justify-between mb-1">
                                    <span className="font-semibold text-slate-700 text-[11px]">
                                      ACT
                                    </span>
                                  </div>
                                  <div className="relative h-3 w-full bg-gray-200 rounded-full">
                                    <div
                                      className="absolute h-3 bg-brand-secondary rounded-full"
                                      style={{
                                        left: `${p25left}%`,
                                        right: `${p75right}%`,
                                      }}
                                    />
                                    {p50left !== null && p50 != null && (
                                      <>
                                        <div
                                          className="absolute h-5 w-[2px] bg-brand-dark -top-1 rounded-full"
                                          style={{
                                            left: `calc(${p50left}% - 2px)`,
                                          }}
                                        />
                                        <div
                                          className="absolute top-4 text-[10px] font-semibold text-slate-700"
                                          style={{
                                            left: `${p50left}%`,
                                            transform: "translateX(-50%)",
                                          }}
                                        >
                                          {p50}
                                        </div>
                                      </>
                                    )}
                                    {studentLeft !== null && (
                                      <>
                                        <div
                                          className="absolute h-5 w-[3px] bg-brand-primary -top-1 rounded-full"
                                          style={{
                                            left: `calc(${studentLeft}% - 1.5px)`,
                                          }}
                                        />
                                        <div
                                          className="absolute -top-5 text-[10px] font-semibold text-brand-primary"
                                          style={{
                                            left: `${studentLeft}%`,
                                            transform: "translateX(-50%)",
                                          }}
                                        >
                                          {studentAct}
                                        </div>
                                      </>
                                    )}
                                  </div>
                                  <div className="flex justify-between text-xs text-gray-500 mt-1 px-1">
                                    <span>{min}</span>
                                    <span>{max}</span>
                                  </div>
                                  {p50 == null && (
                                    <div className="text-center text-[10px] text-slate-500 mt-1">
                                      N/A
                                    </div>
                                  )}
                                </>
                              );
                            })()
                          ) : (
                            <span>ACT comparison: Unknown</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </section>

        {/* Recommended universities based on your profile */}
        <section className="mt-10">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">
            Suggested Universities For You
          </h2>
          {recommendedInstitutions.length === 0 ? (
            <p className="text-sm text-slate-600">
              We will suggest options once we have enough data about your academics and targets.
            </p>
          ) : (
            (() => {
              const targetStates = new Set(
                institutions
                  .map((inst) => inst.state)
                  .filter((s): s is string => !!s)
              );
              const nearby = recommendedInstitutions.filter((inst) => inst.state && targetStates.has(inst.state));
              const others = recommendedInstitutions.filter((inst) => !inst.state || !targetStates.has(inst.state));
              const renderCards = (list: Institution[]) => (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {list.map((inst) => {
                    const intlPct =
                      inst.intl_enrollment_pct != null
                        ? `${Math.round(inst.intl_enrollment_pct * 100)}% international students`
                        : null;
                    const acceptance =
                      inst.acceptance_rate != null
                        ? `${Math.round(inst.acceptance_rate * 100)}% acceptance`
                        : "Acceptance unknown";
                    const matchingMajors =
                      studentProfile.majors && studentProfile.majors.length > 0
                        ? (inst.major_families || []).filter((m) =>
                            studentProfile.majors?.some((sel) => sel.toLowerCase() === (m ?? "").toLowerCase())
                          )
                        : [];
                    return (
                      <div
                        key={inst.unitid}
                        className="border border-slate-200 rounded-lg p-4 flex flex-col gap-2 bg-white shadow-sm"
                      >
                        <div>
                          <div className="font-semibold text-slate-900">{inst.name}</div>
                          <div className="text-xs text-slate-500">
                            {[inst.city, inst.state].filter(Boolean).join(", ")}
                          </div>
                        </div>
                        <div className="text-xs text-slate-600">
                          {acceptance}
                          {intlPct ? ` \u2022 ${intlPct}` : ""}
                        </div>
                        {studentProfile.majors && studentProfile.majors.length > 0 && (
                          <div className="text-xs text-slate-600">
                            Major fit:{" "}
                            {matchingMajors.length > 0
                              ? matchingMajors.join(", ")
                              : "No exact match listed (still a balanced option)."}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );

              return (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800 mb-2">Near your target locations</h3>
                    {nearby.length === 0 ? (
                      <p className="text-xs text-slate-600">No nearby options yet. Add targets to see location-based ideas.</p>
                    ) : (
                      renderCards(nearby)
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800 mb-2">Similar fits in other locations</h3>
                    {others.length === 0 ? (
                      <p className="text-xs text-slate-600">No additional fits yet.</p>
                    ) : (
                      renderCards(others)
                    )}
                  </div>
                </div>
              );
            })()
          )}
        </section>
      </div>
    </div>
  );
};

export default ProfileDashboardPage;
