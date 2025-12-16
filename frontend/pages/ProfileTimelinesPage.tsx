import React, { useEffect, useMemo, useRef, useState } from "react";
import DashboardLayout from "../components/DashboardLayout";
import { useOnboardingGuard } from "../hooks/useOnboardingGuard";
import { useOnboardingContext } from "../context/OnboardingContext";
import { supabase } from "../services/supabaseClient";

type TimelineTask = {
  id: string;
  due: string; // e.g. "Aug 2026"
  title: string;
  category: "Demographics" | "Academics" | "Extracurriculars" | "Essays" | "Colleges" | "Logistics";
};

const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const formatMonthYear = (d: Date) => `${monthNames[d.getMonth()]} ${d.getFullYear()}`;

const addMonths = (base: Date, deltaMonths: number) => {
  const d = new Date(base.getTime());
  d.setMonth(d.getMonth() + deltaMonths);
  return d;
};

const generateTimeline = (gradYear: number): TimelineTask[] => {
  // Assume enrollment in Aug of graduation year.
  const enrollmentStart = new Date(gradYear, 7, 1); // Aug 1

  const schedule: Array<{
    offsetMonths: number;
    category: TimelineTask["category"];
    title: string;
  }> = [
    { offsetMonths: 0, category: "Logistics", title: "Confirm enrollment, housing, and orientation plans." },
    { offsetMonths: -2, category: "Logistics", title: "Compare offers and finalize your commitment decision." },
    { offsetMonths: -3, category: "Colleges", title: "Track decisions and prepare for interviews (if applicable)." },
    { offsetMonths: -4, category: "Colleges", title: "Submit Regular Decision applications (typical January deadlines)." },
    { offsetMonths: -6, category: "Essays", title: "Finalize RD essays and validate every application requirement." },
    { offsetMonths: -8, category: "Colleges", title: "Submit ED/EA applications and send required materials." },
    { offsetMonths: -10, category: "Essays", title: "Draft your personal statement and top supplements." },
    { offsetMonths: -12, category: "Colleges", title: "Finalize a balanced college list (reach/target/safety)." },
    { offsetMonths: -15, category: "Academics", title: "Take/retake SAT or ACT if you want a stronger score." },
    { offsetMonths: -18, category: "Extracurriculars", title: "Deepen impact: leadership, projects, competitions, service." },
    { offsetMonths: -21, category: "Demographics", title: "Lock in your profile basics (location, graduation year, major)." },
    { offsetMonths: -24, category: "Colleges", title: "Start exploring colleges and building your shortlist." },
  ];

  return schedule
    .map((item) => {
      const dueDate = addMonths(enrollmentStart, item.offsetMonths);
      const due = formatMonthYear(dueDate);
      const id = `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, "0")}-${item.category}-${item.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")}`;
      return { id, due, category: item.category, title: item.title } satisfies TimelineTask;
    })
    .sort((a, b) => {
      // Sort most recent first by parsing "Mon YYYY"
      const [aMon, aYr] = a.due.split(" ");
      const [bMon, bYr] = b.due.split(" ");
      const aDate = new Date(Number(aYr), monthNames.indexOf(aMon), 1).getTime();
      const bDate = new Date(Number(bYr), monthNames.indexOf(bMon), 1).getTime();
      return bDate - aDate;
    });
};

const categoryStyles: Record<TimelineTask["category"], string> = {
  Demographics: "bg-blue-50 text-blue-700 border border-blue-200",
  Academics: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  Extracurriculars: "bg-purple-50 text-purple-700 border border-purple-200",
  Essays: "bg-amber-50 text-amber-700 border border-amber-200",
  Colleges: "bg-slate-100 text-slate-700 border border-slate-200",
  Logistics: "bg-indigo-50 text-indigo-700 border border-indigo-200",
};

const ProfileTimelinesPage: React.FC = () => {
  const loadingGuard = useOnboardingGuard(0);
  const { user } = useOnboardingContext();
  const [gradYear, setGradYear] = useState<number | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const saveTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from("profiles")
          .select("demographics, admissions_scorecard")
          .eq("user_id", user.id)
          .maybeSingle();
        if (cancelled) return;

        const demo = (data?.demographics || {}) as Record<string, any>;
        const year = demo.grad_year != null ? Number(demo.grad_year) : null;
        setGradYear(Number.isFinite(year as any) ? (year as number) : null);

        const scorecard = (data?.admissions_scorecard || {}) as Record<string, any>;
        const timeline = (scorecard.timeline_checklist || {}) as Record<string, any>;
        const checkedMap = (timeline.checked || {}) as Record<string, any>;
        const parsed: Record<string, boolean> = {};
        for (const [k, v] of Object.entries(checkedMap)) {
          parsed[k] = Boolean(v);
        }
        setChecked(parsed);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const tasks = useMemo(() => {
    if (!gradYear) return [];
    return generateTimeline(gradYear);
  }, [gradYear]);

  const grouped = useMemo(() => {
    const map = new Map<string, TimelineTask[]>();
    for (const task of tasks) {
      const list = map.get(task.due) ?? [];
      list.push(task);
      map.set(task.due, list);
    }
    return Array.from(map.entries());
  }, [tasks]);

  // Persist checklist state (debounced).
  useEffect(() => {
    if (!user) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      void (async () => {
        setSaving(true);
        try {
          const { data } = await supabase
            .from("profiles")
            .select("admissions_scorecard")
            .eq("user_id", user.id)
            .maybeSingle();
          const existing = (data?.admissions_scorecard || {}) as Record<string, any>;
          const next = {
            ...existing,
            timeline_checklist: {
              gradYear,
              checked,
            },
          };
          await supabase
            .from("profiles")
            .upsert(
              { user_id: user.id, admissions_scorecard: next },
              { onConflict: "user_id" }
            );
        } catch {
          // ignore best-effort saves
        } finally {
          setSaving(false);
        }
      })();
    }, 600);

    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [checked, gradYear, user?.id]);

  const downloadChecklist = () => {
    const header = ["Due", "Category", "Task", "Done"];
    const lines = [header.join(",")];
    for (const task of tasks) {
      const done = checked[task.id] ? "Yes" : "No";
      lines.push(
        [
          `"${task.due}"`,
          `"${task.category}"`,
          `"${task.title.replace(/"/g, '""')}"`,
          done,
        ].join(",")
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "application_timeline_checklist.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (loadingGuard) {
    return (
      <DashboardLayout>
        <div className="py-10 text-sm text-slate-600">Loading your workspace...</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <header className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <p className="text-xs uppercase tracking-wide text-brand-secondary font-semibold">
            Planning
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 mt-1">Timelines</h1>
              <p className="mt-2 text-sm text-slate-600 max-w-3xl">
                Month-by-month checklist working backwards from your graduation year.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={downloadChecklist}
                disabled={!tasks.length}
                className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                Download Checklist
              </button>
            </div>
          </div>
        </header>

        {!gradYear ? (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 text-sm text-slate-700">
            Set your Graduation Year in <span className="font-semibold">My Profile → Demographics</span>{" "}
            to generate a personalized timeline.
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between text-xs text-slate-500 px-1">
              <span>Graduation year: {gradYear} (Enrollment assumed Aug {gradYear})</span>
              <span>{saving ? "Saving…" : "Saved"}</span>
            </div>

            <div className="space-y-4">
              {grouped.map(([due, dueTasks]) => (
                <section
                  key={due}
                  className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6"
                >
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold text-slate-900">{due}</h2>
                    <span className="text-xs text-slate-500">
                      {dueTasks.filter((t) => checked[t.id]).length}/{dueTasks.length} done
                    </span>
                  </div>

                  <ul className="mt-4 space-y-3">
                    {dueTasks.map((task) => (
                      <li key={task.id} className="flex items-start gap-3">
                        <input
                          id={`task-${task.id}`}
                          name={`task-${task.id}`}
                          type="checkbox"
                          checked={Boolean(checked[task.id])}
                          onChange={(e) =>
                            setChecked((prev) => ({ ...prev, [task.id]: e.target.checked }))
                          }
                          className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <label htmlFor={`task-${task.id}`} className="flex-1 cursor-pointer">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${categoryStyles[task.category]}`}
                            >
                              {task.category}
                            </span>
                            <span className="text-sm text-slate-900">{task.title}</span>
                          </div>
                        </label>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default ProfileTimelinesPage;

