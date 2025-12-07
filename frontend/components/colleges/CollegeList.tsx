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

const CollegeList: React.FC = () => {
  const { user } = useOnboardingContext();
  const [rows, setRows] = useState<CollegeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [studentState, setStudentState] = useState<string | null>(null);
  const [studentStats, setStudentStats] = useState<AcademicStats>({
    gpa: null,
    gpaScale: "4.0",
    sat: null,
    act: null,
    rank: null,
  });

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
          .select("demographics, academic_stats, target_universities")
          .eq("user_id", user.id)
          .maybeSingle();
        if (profileError) throw profileError;

        const demo = (profile?.demographics || {}) as DemographicsJson;
        setStudentState(
          demo.location_state
            ? String(demo.location_state).toUpperCase()
            : null
        );
        setStudentStats(normalizeAcademicStats(profile?.academic_stats));

        const rawTargets = (profile?.target_universities ||
          []) as any[];
        const unitids: number[] = [];
        for (const t of rawTargets) {
          if (typeof t === "number") {
            if (Number.isFinite(t)) unitids.push(t);
          } else if (t && typeof t === "object" && "unitid" in t) {
            const id = Number((t as any).unitid);
            if (Number.isFinite(id)) unitids.push(id);
          }
        }
        if (unitids.length === 0) {
          if (!cancelled) setRows([]);
          return;
        }

        const { data: instRows, error: instError } = await supabase
          .from("institutions")
          .select(
            "unitid, name, city, state, acceptance_rate, tuition_2023_24, tuition_2023_24_in_state, tuition_2023_24_out_of_state"
          )
          .in("unitid", unitids);
        if (instError) throw instError;

        const { data: metricRows, error: metricsError } = await supabase
          .from("institution_metrics")
          .select(
            "unitid, year, sat_evidence_based_reading_and_writing_25th_percentile_score, sat_evidence_based_reading_and_writing_75th_percentile_score, sat_math_25th_percentile_score, sat_math_75th_percentile_score, act_composite_25th_percentile_score, act_composite_75th_percentile_score"
          )
          .in("unitid", unitids)
          .order("year", { ascending: false });
        if (metricsError) throw metricsError;

        const latestMetrics = new Map<number, CollegeMetrics>();
        for (const m of metricRows || []) {
          const id = Number((m as any).unitid);
          if (!Number.isFinite(id)) continue;
          if (latestMetrics.has(id)) continue;
          const sat25 =
            (m as any).sat_math_25th_percentile_score != null &&
            (m as any)
              .sat_evidence_based_reading_and_writing_25th_percentile_score !=
              null
              ? (m as any).sat_math_25th_percentile_score +
                (m as any)
                  .sat_evidence_based_reading_and_writing_25th_percentile_score
              : null;
          const sat75 =
            (m as any).sat_math_75th_percentile_score != null &&
            (m as any)
              .sat_evidence_based_reading_and_writing_75th_percentile_score !=
              null
              ? (m as any).sat_math_75th_percentile_score +
                (m as any)
                  .sat_evidence_based_reading_and_writing_75th_percentile_score
              : null;
          latestMetrics.set(id, {
            sat25,
            sat75,
            act25: (m as any).act_composite_25th_percentile_score ?? null,
            act75: (m as any).act_composite_75th_percentile_score ?? null,
          });
        }

        const tableRows: CollegeRow[] = (instRows || []).map(
          (inst: any) => {
            const id = Number(inst.unitid);
            const metrics = latestMetrics.get(id);
            const chance =
              studentStats &&
              (metrics?.sat25 != null || metrics?.act25 != null)
                ? calculateChances(studentStats, {
                    acceptanceRate: inst.acceptance_rate ?? null,
                    sat25: metrics?.sat25 ?? null,
                    sat75: metrics?.sat75 ?? null,
                    act25: metrics?.act25 ?? null,
                    act75: metrics?.act75 ?? null,
                  })
                : null;

            let tuition: number | null =
              inst.tuition_2023_24 ?? null;
            if (studentState && inst.state) {
              const instState = String(inst.state).toUpperCase();
              if (instState === studentState) {
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

            const metricsSatMid =
              metrics && metrics.sat25 != null && metrics.sat75 != null
                ? Math.round((metrics.sat25 + metrics.sat75) / 2)
                : null;
            const metricsActMid =
              metrics && metrics.act25 != null && metrics.act75 != null
                ? Math.round((metrics.act25 + metrics.act75) / 2)
                : null;

            return {
              unitid: id,
              name: inst.name ?? "Unknown",
              city: inst.city ?? null,
              state: inst.state ?? null,
              acceptanceRate: inst.acceptance_rate ?? null,
              sat: metricsSatMid,
              act: metricsActMid,
              tuition,
              chance,
            };
          }
        );

        if (!cancelled) {
          setRows(tableRows);
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
  }, [user?.id]);

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
        <div className="px-4 py-6 text-sm text-slate-600">
          Loading your colleges…
        </div>
      ) : error ? (
        <div className="px-4 py-6 text-sm text-red-600">{error}</div>
      ) : !hasColleges ? (
        <div className="px-4 py-6 text-sm text-slate-600">
          You don&apos;t have any colleges saved yet. Add targets in
          your profile to see them here.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-xs">
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
                    {row.name}
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

