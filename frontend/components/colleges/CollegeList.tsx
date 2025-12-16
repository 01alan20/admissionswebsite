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
  getTopUnitIdsByApplicants,
} from "../../data/api";
import type { Institution } from "../../types";
import type { InstitutionTestScores } from "../../data/api";
import { getTwoDigitPrefix, normalizeMajorSelectionList } from "../../utils/majors";
import { isUSCountry } from "../../utils/usStates";

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

const createRng = (seed: number) => {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
};

const shuffleWithSeed = <T,>(items: T[], seed: number): T[] => {
  const rng = createRng(seed);
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

type RecommendationInputs = {
  stats: AcademicStats;
  homeState: string | null;
  country: string | null;
  majors: string[] | undefined;
  desiredCount?: number;
  seed?: number;
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

const buildRecommendedRows = async ({
  stats,
  homeState,
  country,
  majors,
  desiredCount = 20,
  seed = 0,
}: RecommendationInputs): Promise<CollegeRow[]> => {
  const [allInstitutions, testScoreMap, topApplicantIds] = await Promise.all([
    getAllInstitutions(),
    getInstitutionTestScoreMap(),
    getTopUnitIdsByApplicants(1000),
  ]);

  const institutionById = new Map<number, Institution>();
  for (const inst of allInstitutions) {
    institutionById.set(inst.unitid, inst);
  }

  const applicantRank = new Map<number, number>();
  for (let i = 0; i < topApplicantIds.length; i += 1) {
    applicantRank.set(Number(topApplicantIds[i]), i);
  }

  const normalizedMajors = normalizeMajorSelectionList(majors) ?? majors;
  const majorPrefixes = new Set(
    (normalizedMajors || [])
      .map((m) => getTwoDigitPrefix(m))
      .filter((v): v is string => Boolean(v))
  );

  const isInternational = Boolean(country && country.trim()) && !isUSCountry(country);
  const hasStats = stats.gpa != null || stats.sat != null || stats.act != null;

  const isMajorMatch = (inst: Institution) => {
    if (!majorPrefixes.size) return false;
    const list = inst.majors_cip_two_digit;
    if (!Array.isArray(list)) return false;
    return list.some((code) => majorPrefixes.has(String(code).slice(0, 2)));
  };

  const preferenceScore = (inst: Institution) => {
    let score = 0;
    if (
      homeState &&
      typeof inst.state === "string" &&
      inst.state.toUpperCase() === homeState.toUpperCase()
    ) {
      score += 1000;
    }
    if (isMajorMatch(inst)) score += 500;
    const rank = applicantRank.get(inst.unitid);
    if (typeof rank === "number") {
      score += Math.max(0, 400 - rank);
    }
    if (isInternational && typeof inst.intl_enrollment_pct === "number") {
      score += Math.round(inst.intl_enrollment_pct * 100);
    }
    return score;
  };

  const pickFromPool = <T,>(pool: T[], count: number, shuffleSeed: number) => {
    if (!pool.length) return [];
    if (count >= pool.length) return pool.slice();
    if (shuffleSeed === 0) return pool.slice(0, count);
    return shuffleWithSeed(pool, shuffleSeed).slice(0, count);
  };

  const dedupeIds = (ids: number[]) => Array.from(new Set(ids.map((id) => Number(id))));

  const buildRowsFromIds = (ids: number[]) => {
    const unique = dedupeIds(ids);
    return unique
      .map((id) => {
        const inst = institutionById.get(id);
        if (!inst) return null;
        const scores = testScoreMap.get(id);
        return buildRowForInstitution(inst, scores, stats, homeState);
      })
      .filter((row): row is CollegeRow => row != null);
  };

  // International fallback (no US state matching expected)
  if (!hasStats && isInternational) {
    const majorFilteredTopApps = majorPrefixes.size
      ? topApplicantIds.filter((id) => {
          const inst = institutionById.get(Number(id));
          return inst ? isMajorMatch(inst) : false;
        })
      : topApplicantIds;

    const topAppliedPool = majorFilteredTopApps.slice(0, 200);

    const topIntlPool = allInstitutions
      .filter((i) => i.level === "4-year")
      .filter((i) => (majorPrefixes.size ? isMajorMatch(i) : true))
      .filter((i) => typeof i.intl_enrollment_pct === "number")
      .sort((a, b) => (b.intl_enrollment_pct ?? 0) - (a.intl_enrollment_pct ?? 0))
      .slice(0, 200)
      .map((i) => i.unitid);

    const majorRelevantPool = allInstitutions
      .filter((i) => i.level === "4-year")
      .filter((i) => (majorPrefixes.size ? isMajorMatch(i) : true))
      .slice()
      .sort((a, b) => preferenceScore(b) - preferenceScore(a))
      .slice(0, 500)
      .map((i) => i.unitid);

    const pickTopApplied = pickFromPool(topAppliedPool, 5, seed ? seed + 11 : 0);
    const pickTopIntl = pickFromPool(topIntlPool, 5, seed ? seed + 17 : 0);
    const pickMajors = pickFromPool(majorRelevantPool, 10, seed ? seed + 23 : 0);

    const combined = dedupeIds([...pickTopApplied, ...pickTopIntl, ...pickMajors]).slice(
      0,
      desiredCount
    );
    return buildRowsFromIds(combined);
  }

  // No stats: use top applicants (optionally weighted by location/major)
  if (!hasStats) {
    const candidates = allInstitutions
      .filter((i) => i.level === "4-year")
      .slice()
      .sort((a, b) => preferenceScore(b) - preferenceScore(a));

    const pool = candidates.slice(0, 600).map((i) => i.unitid);
    const picked =
      !homeState && !majorPrefixes.size
        ? pickFromPool(topApplicantIds.slice(0, 300), desiredCount, seed)
        : pickFromPool(pool, desiredCount, seed);

    return buildRowsFromIds(picked);
  }

  // Stats-based recommendations with reach/target/safety spread
  type Scored = {
    unitid: number;
    chance: AdmissionCategory;
    score: number;
  };

  const safety: Scored[] = [];
  const target: Scored[] = [];
  const reach: Scored[] = [];

  for (const inst of allInstitutions) {
    if (inst.level !== "4-year") continue;
    const test = testScoreMap.get(inst.unitid);
    const metrics: CollegeMetrics = {
      acceptanceRate: inst.acceptance_rate ?? null,
      sat25: test?.sat_total_25 ?? null,
      sat75: test?.sat_total_75 ?? null,
      act25: test?.act_composite_25 ?? null,
      act75: test?.act_composite_75 ?? null,
    };
    const hasSignal =
      metrics.acceptanceRate != null ||
      metrics.sat25 != null ||
      metrics.sat75 != null ||
      metrics.act25 != null ||
      metrics.act75 != null;
    if (!hasSignal) continue;

    const chance = calculateChances(stats, metrics);
    const score = preferenceScore(inst);
    const entry: Scored = { unitid: inst.unitid, chance, score };
    if (chance === "Safety") safety.push(entry);
    else if (chance === "Target") target.push(entry);
    else reach.push(entry);
  }

  const sortScored = (arr: Scored[]) => arr.slice().sort((a, b) => b.score - a.score);

  const targetPool = sortScored(target).slice(0, 500).map((s) => s.unitid);
  const safetyPool = sortScored(safety).slice(0, 500).map((s) => s.unitid);
  const reachPool = sortScored(reach).slice(0, 500).map((s) => s.unitid);

  const pickTargets = pickFromPool(targetPool, 10, seed ? seed + 31 : 0);
  const pickSafety = pickFromPool(safetyPool, 5, seed ? seed + 37 : 0);
  const pickReach = pickFromPool(reachPool, 5, seed ? seed + 41 : 0);

  const combined = dedupeIds([...pickTargets, ...pickSafety, ...pickReach]).slice(
    0,
    desiredCount
  );

  const rows = buildRowsFromIds(combined);
  rows.sort((a, b) => {
    const aChanceRank = a.chance != null ? chanceOrder[a.chance] ?? 3 : 3;
    const bChanceRank = b.chance != null ? chanceOrder[b.chance] ?? 3 : 3;
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
  const [seed, setSeed] = useState(0);

  const majorKey = useMemo(
    () => (studentProfile.majors ? studentProfile.majors.join("|") : ""),
    [studentProfile.majors]
  );

  useEffect(() => {
    if (!user) {
      setRows([]);
      setLoading(false);
      setError(null);
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
        const countryRaw =
          demo.country && String(demo.country).trim()
            ? String(demo.country).trim()
            : studentProfile.country && String(studentProfile.country).trim()
            ? String(studentProfile.country).trim()
            : null;

        const studentSatTotal =
          studentProfile.satMath != null && studentProfile.satEBRW != null
            ? Number(studentProfile.satMath) + Number(studentProfile.satEBRW)
            : null;

        const fallbackStats = {
          gpa: studentProfile.gpa ?? null,
          sat: studentSatTotal,
          act: studentProfile.actComposite ?? null,
        };

        const stats = normalizeAcademicStats(
          profile?.academic_stats ?? fallbackStats
        );

        const recommendedRows = await buildRecommendedRows({
          stats,
          homeState,
          country: countryRaw,
          majors: studentProfile.majors,
          desiredCount: 20,
          seed,
        });

        let combinedRows: CollegeRow[] = recommendedRows;

        if (targetUnitIds && targetUnitIds.length) {
          const targetRows = await buildTargetRows(
            stats,
            homeState,
            targetUnitIds
          );
          const recommendedIds = new Set(recommendedRows.map((r) => r.unitid));
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
  }, [
    user?.id,
    targetUnitIds,
    studentProfile.gpa,
    studentProfile.satMath,
    studentProfile.satEBRW,
    studentProfile.actComposite,
    majorKey,
    seed,
  ]);

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
          <button
            type="button"
            onClick={() => setSeed((s) => s + 1)}
            disabled={loading}
            className="inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            Generate Another List
          </button>
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
                      .join(", ") || "N/A"}
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
