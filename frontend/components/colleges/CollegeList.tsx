import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../services/supabaseClient";
import { useOnboardingContext } from "../../context/OnboardingContext";
import type {
  AcademicStats,
  DemographicsJson,
  AdmissionCategory,
} from "../../types/supabase";
import {
  calculateChances,
  type CollegeMetrics,
} from "../../lib/admissions";
import {
  getAllInstitutions,
  getInstitutionTestScoreMap,
} from "../../data/api";
import type { Institution, InstitutionTestScores } from "../../types";
import { getTwoDigitPrefix } from "../../utils/majors";

type CollegeRow = {
  unitid: number;
  name: string;
  city: string | null;
  state: string | null;
  acceptanceRate: number | null;
  sat: number | null;
  act: number | null;
  tuition: number | null;
  chance: AdmissionCategory | null;
  isTarget?: boolean;
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const normalizeAcademicStats = (raw: any): AcademicStats => {
  if (!raw || typeof raw !== "object") {
    return { gpa: null, gpaScale: "4.0", sat: null, act: null, rank: null };
  }
  const gpaRaw = raw.gpa ?? raw.unweighted_gpa;
  const satRaw = raw.sat ?? raw.sat_total;
  const actRaw = raw.act ?? raw.act_composite;
  const rankRaw = raw.rank ?? raw.class_rank;
  return {
    gpa:
      typeof gpaRaw === "number"
        ? gpaRaw
        : gpaRaw != null
        ? Number(gpaRaw)
        : null,
    gpaScale: raw.gpaScale ?? raw.gpa_scale ?? "4.0",
    sat:
      typeof satRaw === "number"
        ? satRaw
        : satRaw != null
        ? Number(satRaw)
        : null,
    act:
      typeof actRaw === "number"
        ? actRaw
        : actRaw != null
        ? Number(actRaw)
        : null,
    rank:
      typeof rankRaw === "number"
        ? rankRaw
        : rankRaw != null
        ? Number(rankRaw)
        : null,
  };
};

const chanceOrder: Record<AdmissionCategory, number> = {
  Reach: 0,
  Target: 1,
  Safety: 2,
};

const buildRowForInstitution = (
  inst: Institution,
  scores: InstitutionTestScores | undefined,
  stats: AcademicStats,
  homeState: string | null
): CollegeRow => {
  const metrics: CollegeMetrics = {
    acceptanceRate: inst.acceptance_rate ?? null,
    sat25: scores?.sat_total_25 ?? null,
    sat75: scores?.sat_total_75 ?? null,
    act25: scores?.act_composite_25 ?? null,
    act75: scores?.act_composite_75 ?? null,
  };

  const hasScoreOrAcceptance =
    metrics.sat25 != null ||
    metrics.sat75 != null ||
    metrics.act25 != null ||
    metrics.act75 != null ||
    metrics.acceptanceRate != null;

  const chance = hasScoreOrAcceptance
    ? calculateChances(stats, metrics)
    : null;

  let tuition: number | null = inst.tuition_2023_24 ?? null;
  if (homeState && inst.state) {
    const instState = String(inst.state).toUpperCase();
    if (instState === homeState) {
      tuition =
        inst.tuition_2023_24_in_state ??
        inst.tuition_2023_24 ??
        inst.tuition_2023_24_out_of_state ??
        null;
    } else {
      tuition =
        inst.tuition_2023_24_out_of_state ??
        inst.tuition_2023_24 ??
        inst.tuition_2023_24_in_state ??
        null;
    }
  }

  const satMid =
    scores &&
    scores.sat_total_25 != null &&
    scores.sat_total_75 != null
      ? Math.round(
          (scores.sat_total_25 + scores.sat_total_75) / 2
        )
      : null;
  const actMid =
    scores &&
    scores.act_composite_25 != null &&
    scores.act_composite_75 != null
      ? Math.round(
          (scores.act_composite_25 + scores.act_composite_75) / 2
        )
      : null;

  return {
    unitid: inst.unitid,
    name: inst.name,
    city: inst.city ?? null,
    state: inst.state ?? null,
    acceptanceRate: inst.acceptance_rate ?? null,
    sat: satMid,
    act: actMid,
    tuition,
    chance,
  };
};

const buildRecommendedRows = async (
  stats: AcademicStats,
  homeState: string | null,
  userMajors: string[] | undefined,
  desiredCount = 20
): Promise<CollegeRow[]> => {
  const [allInstitutions, testScoreMap] = await Promise.all([
    getAllInstitutions(),
    getInstitutionTestScoreMap(),
  ]);

  const majorPrefixes = new Set(
    (userMajors || [])
      .map((m) => getTwoDigitPrefix(m))
      .filter((prefix): prefix is string => Boolean(prefix))
  );

  const scoreInstitution = (inst: Institution): {
    unitid: number;
    chance: AdmissionCategory;
    isSameState: boolean;
    majorMatch: boolean;
  } | null => {
    if (!inst.acceptance_rate || inst.level !== "4-year") return null;
    const test: InstitutionTestScores | undefined =
      testScoreMap.get(inst.unitid);
    const metrics: CollegeMetrics = {
      acceptanceRate: inst.acceptance_rate,
      sat25: test?.sat_total_25 ?? null,
      sat75: test?.sat_total_75 ?? null,
      act25: test?.act_composite_25 ?? null,
      act75: test?.act_composite_75 ?? null,
    };
    const chance = calculateChances(stats, metrics);
    const isSameState =
      !!homeState &&
      typeof inst.state === "string" &&
      inst.state.toUpperCase() === homeState.toUpperCase();
    const majorMatch =
      majorPrefixes.size > 0 &&
      Array.isArray(inst.majors_cip_two_digit) &&
      inst.majors_cip_two_digit.some((code) =>
        majorPrefixes.has(String(code).slice(0, 2))
      );
    return { unitid: inst.unitid, chance, isSameState, majorMatch };
  };

  const safety: number[] = [];
  const target: number[] = [];
  const reach: number[] = [];

  for (const inst of allInstitutions) {
    const scored = scoreInstitution(inst);
    if (!scored) continue;
    const bucket =
      scored.chance === "Safety"
        ? safety
        : scored.chance === "Target"
        ? target
        : reach;
    if (scored.isSameState) {
      bucket.unshift(scored.unitid);
    } else {
      bucket.push(scored.unitid);
    }
  }

  const recommendedIds: number[] = [
    ...target.slice(0, 10),
    ...safety.slice(0, 5),
    ...reach.slice(0, 5),
  ].slice(0, desiredCount);

  const institutionById = new Map<number, Institution>();
  for (const inst of allInstitutions) {
    institutionById.set(inst.unitid, inst);
  }

  const rows = recommendedIds
    .map((id) => {
      const inst = institutionById.get(id);
      if (!inst) return null;
      const scores = testScoreMap.get(id);
      return buildRowForInstitution(inst, scores, stats, homeState);
    })
    .filter((row): row is CollegeRow => row != null);

  rows.sort((a, b) => {
    const aChanceRank =
      a.chance != null ? chanceOrder[a.chance] ?? 3 : 3;
    const bChanceRank =
      b.chance != null ? chanceOrder[b.chance] ?? 3 : 3;
    if (aChanceRank !== bChanceRank) return aChanceRank - bChanceRank;

    const aAcc = a.acceptanceRate ?? 1;
    const bAcc = b.acceptanceRate ?? 1;
    return aAcc - bAcc;
  });

  return rows;
};

const buildTargetRows = async (
  stats: AcademicStats,
  homeState: string | null,
  targetUnitIds: number[]
): Promise<CollegeRow[]> => {
  if (!targetUnitIds.length) return [];

  const [allInstitutions, testScoreMap] = await Promise.all([
    getAllInstitutions(),
    getInstitutionTestScoreMap(),
  ]);

  const institutionById = new Map<number, Institution>();
  for (const inst of allInstitutions) {
    institutionById.set(inst.unitid, inst);
  }

  const uniqueIds = Array.from(new Set(targetUnitIds));

  const rows = uniqueIds
    .map((id) => {
      const inst = institutionById.get(id);
      if (!inst) return null;
      const scores = testScoreMap.get(id);
      return buildRowForInstitution(inst, scores, stats, homeState);
    })
    .filter((row): row is CollegeRow => row != null);

  rows.sort((a, b) => {
    const aChanceRank =
      a.chance != null ? chanceOrder[a.chance] ?? 3 : 3;
    const bChanceRank =
      b.chance != null ? chanceOrder[b.chance] ?? 3 : 3;
    if (aChanceRank !== bChanceRank) return aChanceRank - bChanceRank;

    const aAcc = a.acceptanceRate ?? 1;
    const bAcc = b.acceptanceRate ?? 1;
    return aAcc - bAcc;
  });

  return rows;
};

const CollegeList: React.FC = () => {
  const { user, studentProfile, targetUnitIds } = useOnboardingContext();
  const [rows, setRows] = useState<CollegeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("demographics, academic_stats")
          .eq("user_id", user.id)
          .maybeSingle();
        if (profileError) throw profileError;

        const demo = (profile?.demographics || {}) as DemographicsJson;
        const homeState =
          demo.location_state && String(demo.location_state).trim()
            ? String(demo.location_state).toUpperCase()
            : null;
        const stats = normalizeAcademicStats(profile?.academic_stats);
        const recommendedRows = await buildRecommendedRows(
          stats,
          homeState,
          studentProfile.majors,
          20
        );

        let combinedRows: CollegeRow[] = recommendedRows;

        if (targetUnitIds && targetUnitIds.length) {
          const targetRows = await buildTargetRows(
            stats,
            homeState,
            targetUnitIds
          );
          const recommendedIds = new Set(
            recommendedRows.map((r) => r.unitid)
          );
          const extraTargetRows = targetRows.filter(
            (row) => !recommendedIds.has(row.unitid)
          );
          combinedRows = [...extraTargetRows, ...recommendedRows];
          const targetIdSet = new Set(
            targetUnitIds.map((id) => Number(id))
          );
          combinedRows = combinedRows.map((row) => ({
            ...row,
            isTarget: targetIdSet.has(row.unitid),
          }));
        }

        if (!cancelled) {
          setRows(combinedRows);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message ?? "Failed to load colleges");
          setRows([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, targetUnitIds]);

  const handleDownload = () => {
    if (!rows.length) return;
    const header = [
      "UnitID",
      "School Name",
      "Location",
      "Admit Rate",
      "Avg SAT",
      "Avg ACT",
      "Tuition",
      "My Chance",
      "My Target",
    ];
    const lines = [header.join(",")];
    for (const r of rows) {
      const location = [r.city, r.state].filter(Boolean).join(", ");
      const admit =
        r.acceptanceRate != null
          ? `${Math.round(r.acceptanceRate * 100)}%`
          : "";
      const sat = r.sat != null ? String(r.sat) : "";
      const act = r.act != null ? String(r.act) : "";
      const tuition =
        r.tuition != null
          ? currencyFormatter.format(r.tuition)
          : "";
      const chance = r.chance ?? "";
      const isTarget = r.isTarget ? "My Target" : "";
      lines.push(
        [
          r.unitid,
          `"${r.name.replace(/"/g, '""')}"`,
          `"${location.replace(/"/g, '""')}"`,
          admit,
          sat,
          act,
          tuition,
          chance,
          isTarget,
        ].join(",")
      );
    }
    const blob = new Blob([lines.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "my_colleges.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const hasColleges = useMemo(() => rows.length > 0, [rows]);

  const renderChanceBadge = (chance: AdmissionCategory | null) => {
    if (!chance) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-slate-50 text-slate-600 border border-slate-200 text-[11px]">
          Unknown
        </span>
      );
    }
    let classes =
      "inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium border ";
    if (chance === "Reach") {
      classes += "bg-red-50 text-red-700 border-red-200";
    } else if (chance === "Target") {
      classes += "bg-amber-50 text-amber-700 border-amber-200";
    } else {
      classes += "bg-emerald-50 text-emerald-700 border-emerald-200";
    }
    return <span className={classes}>{chance}</span>;
  };

  return (
    <section className="bg-white rounded-xl shadow-sm border border-slate-200">
      <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-800">
          My Colleges
        </h2>
        <div className="flex items-center gap-2">
          {hasColleges && (
            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center rounded-md bg-blue-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-blue-700"
            >
              Download Spreadsheet
            </button>
          )}
        </div>
      </div>
      {loading ? (
        <div className="px-4 py-6 text-base text-slate-600">
          Loading your colleges...
        </div>
      ) : error ? (
        <div className="px-4 py-6 text-base text-red-600">{error}</div>
      ) : !hasColleges ? (
        <div className="px-4 py-6 text-base text-slate-600">
          You don&apos;t have any colleges saved yet. Use &quot;My Profile&quot; or College Search to start building your list.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-2 text-left font-semibold text-slate-600">
                  School Name
                </th>
                <th className="px-4 py-2 text-left font-semibold text-slate-600">
                  Location
                </th>
                <th className="px-4 py-2 text-right font-semibold text-slate-600">
                  Admit Rate
                </th>
                <th className="px-4 py-2 text-right font-semibold text-slate-600">
                  Avg SAT
                </th>
                <th className="px-4 py-2 text-right font-semibold text-slate-600">
                  Avg ACT
                </th>
                <th className="px-4 py-2 text-right font-semibold text-slate-600">
                  Tuition
                </th>
                <th className="px-4 py-2 text-center font-semibold text-slate-600">
                  My Chance
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.unitid} className="hover:bg-slate-50">
                  <td className="px-4 py-2 whitespace-nowrap text-slate-900">
                    <div className="flex items-center gap-2">
                      <span>{row.name}</span>
                      {row.isTarget && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-semibold uppercase tracking-wide">
                          My Target
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap text-slate-600">
                    {[row.city, row.state]
                      .filter(Boolean)
                      .join(", ") || "—"}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap text-right text-slate-700">
                    {row.acceptanceRate != null
                      ? `${Math.round(row.acceptanceRate * 100)}%`
                      : "N/A"}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap text-right text-slate-700">
                    {row.sat != null ? row.sat : "N/A"}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap text-right text-slate-700">
                    {row.act != null ? row.act : "N/A"}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap text-right text-slate-700">
                    {row.tuition != null
                      ? currencyFormatter.format(row.tuition)
                      : "N/A"}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap text-center">
                    {renderChanceBadge(row.chance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

export default CollegeList;
