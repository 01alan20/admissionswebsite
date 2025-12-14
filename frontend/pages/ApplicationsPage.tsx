import React, { useEffect, useMemo, useState } from "react";
import DashboardLayout from "../components/DashboardLayout";
import { useOnboardingGuard } from "../hooks/useOnboardingGuard";
import { useOnboardingContext } from "../context/OnboardingContext";
import {
  getSuccessProfiles,
  getInstitutionsSummariesByIds,
} from "../data/api";
import type { SuccessApplicationProfile } from "../types";
import { extractMajorLabel } from "../utils/majors";

type ViewMode = "menu" | "all" | "similar";

const ApplicationsPage: React.FC = () => {
  const loadingGuard = useOnboardingGuard(9);
  const { studentProfile, targetUnitIds } = useOnboardingContext();
  const [view, setView] = useState<ViewMode>("menu");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [applications, setApplications] = useState<SuccessApplicationProfile[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [targetSchools, setTargetSchools] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getSuccessProfiles();
        if (!cancelled) {
          setApplications(data);
          setError(null);
        }
      } catch {
        if (!cancelled) setError("Unable to load successful applications.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!targetUnitIds.length) {
      setTargetSchools([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const names = await getInstitutionsSummariesByIds(
          targetUnitIds.slice(0, 50)
        );
        if (!cancelled) {
          setTargetSchools(names.map((n) => n.name));
        }
      } catch {
        if (!cancelled) setTargetSchools([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [targetUnitIds]);

  const enrichedApplications = useMemo(() => {
    return applications.map((app) => ({
      data: app,
      similarity: calculateApplicationSimilarity(
        app,
        studentProfile,
        targetSchools
      ),
    }));
  }, [applications, studentProfile, targetSchools]);

  const randomApplications = useMemo(() => {
    return pickRandomSubset(enrichedApplications, 10);
  }, [enrichedApplications]);

  const similarApplications = useMemo(() => {
    return enrichedApplications
      .slice()
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 10);
  }, [enrichedApplications]);

  const activeEntries =
    view === "similar" ? similarApplications : randomApplications;

  useEffect(() => {
    if (view === "menu") {
      setSelectedId(null);
      return;
    }
    if (activeEntries.length && !activeEntries.some((e) => e.data.id === selectedId)) {
      setSelectedId(activeEntries[0].data.id);
    }
  }, [view, activeEntries, selectedId]);

  if (loadingGuard) {
    return (
      <DashboardLayout>
        <div className="py-10 text-sm text-slate-600">Loading your workspace...</div>
      </DashboardLayout>
    );
  }

  const selected =
    activeEntries.find((entry) => entry.data.id === selectedId) ??
    activeEntries[0] ??
    null;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <header className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <p className="text-xs uppercase tracking-wide text-brand-secondary font-semibold">Essentials</p>
          <h1 className="text-3xl font-bold text-slate-900 mt-1">Applications</h1>
          <p className="mt-2 text-sm text-slate-600 max-w-3xl">
            Dive into successful application profiles for inspiration or see which students look most like you.
          </p>
        </header>

        {view === "menu" ? (
          <div className="grid gap-4 md:grid-cols-2">
            <ExperienceCard
              title="Application Database"
              description="Browse detailed application files from successful admits."
              accent="from-rose-600 to-rose-400"
              onClick={() => setView("all")}
              icon="🔎"
            />
            <ExperienceCard
              title="Applications Like You"
              description="Find successful profiles with similar academics and interests."
              accent="from-indigo-600 to-indigo-400"
              onClick={() => setView("similar")}
              icon="🤝"
            />
          </div>
        ) : (
          <section className="space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex gap-2">
                <button
                  type="button"
                  className="px-4 py-2 rounded-full border border-slate-200 text-sm text-slate-600 bg-white"
                  onClick={() => setView("menu")}
                >
                  Back
                </button>
              </div>
            </div>

            {loading ? (
              <div className="py-8 text-center text-slate-600">Loading applications...</div>
            ) : error ? (
              <div className="py-8 text-center text-red-600">{error}</div>
            ) : activeEntries.length === 0 ? (
              <div className="py-8 text-center text-slate-500">No applications available yet.</div>
            ) : (
              <div className="grid gap-6 lg:grid-cols-[320px,1fr]">
                <nav className="bg-white rounded-2xl border border-slate-100 shadow-sm max-h-[80vh] overflow-y-auto p-3 space-y-3">
                  {activeEntries.map((entry) => (
                    <button
                      key={entry.data.id}
                      type="button"
                      onClick={() => setSelectedId(entry.data.id)}
                      className={`w-full text-left p-4 rounded-2xl border transition ${
                        selected && selected.data.id === entry.data.id
                          ? "border-brand-secondary bg-indigo-50"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs text-slate-500 uppercase">
                        <span>{entry.data.year}</span>
                        <span>{entry.data.assigned_category || "General"}</span>
                      </div>
                      <div className="mt-2 text-base font-semibold text-slate-900">
                        {entry.data.demographics.intended_major || "Undeclared"}
                      </div>
                      <p className="mt-1 text-sm text-slate-600 line-clamp-2">
                        {(entry.data.extracurricular_activities[0]?.title ||
                          entry.data.demographics.residence ||
                          "Completed application")}
                      </p>
                      {view === "similar" && (
                        <div className="mt-3 text-xs font-semibold text-slate-700">
                          Similarity {entry.similarity.toFixed(1)} / 5
                        </div>
                      )}
                    </button>
                  ))}
                </nav>
                {selected && (
                  <ApplicationDetail
                    entry={selected.data}
                    similarity={view === "similar" ? selected.similarity : null}
                  />
                )}
              </div>
            )}
          </section>
        )}
      </div>
    </DashboardLayout>
  );
};

export default ApplicationsPage;

const ExperienceCard: React.FC<{
  title: string;
  description: string;
  icon: string;
  accent: string;
  onClick: () => void;
}> = ({ title, description, icon, accent, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="bg-white rounded-2xl border border-slate-100 shadow-sm text-left p-6 hover:shadow-md transition flex flex-col gap-3"
  >
    <div className={`w-12 h-12 rounded-full text-white flex items-center justify-center bg-gradient-to-r ${accent}`}>
      <span className="text-lg">{icon}</span>
    </div>
    <div>
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      <p className="text-sm text-slate-600 mt-1">{description}</p>
    </div>
    <span className="text-sm font-semibold text-brand-secondary mt-auto">Launch Tool -&gt;</span>
  </button>
);

const ApplicationDetail: React.FC<{
  entry: SuccessApplicationProfile;
  similarity: number | null;
}> = ({ entry, similarity }) => {
  const academic = entry.academics;
  const demographics = entry.demographics;
  const decisions = entry.decisions || { acceptances: [], rejections: [], waitlists: [] };
  const gpaDisplay = typeof (academic.weighted_gpa ?? academic.unweighted_gpa) === "number"
    ? (academic.weighted_gpa ?? academic.unweighted_gpa)
    : null;
  const satDisplay = parseScore(academic.sat);
  const actDisplay = parseScore(academic.act);
  const majorCategory = entry.assigned_category || "Not specified";
  const intendedMajor = demographics.intended_major || "Not specified";
  const sanitizedRace = sanitizeRaceOrEthnicity(demographics.race_ethnicity);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-xl font-bold text-slate-900">Overview</h3>
        </div>
        <div className="flex flex-wrap gap-3 text-base">
          <Pill label="GPA" value={gpaDisplay != null ? gpaDisplay.toFixed(2) : "N/A"} color="bg-emerald-50 text-emerald-800 border border-emerald-200" />
          <Pill label="SAT" value={satDisplay != null ? satDisplay : "N/A"} color="bg-blue-50 text-blue-800 border border-blue-200" />
          <Pill label="ACT" value={actDisplay != null ? actDisplay : "N/A"} color="bg-indigo-50 text-indigo-800 border border-indigo-200" />
          <Pill label="Major Family" value={majorCategory} color="bg-amber-50 text-amber-800 border border-amber-200" />
        </div>
        <dl className="grid gap-4 grid-cols-2 md:grid-cols-3 text-base text-slate-800">
          <div>
            <dt className="font-semibold">Intended Major</dt>
            <dd>{intendedMajor}</dd>
          </div>
          <div>
            <dt className="font-semibold">Race / Ethnicity</dt>
            <dd>{sanitizedRace}</dd>
          </div>
          <div>
            <dt className="font-semibold">Gender</dt>
            <dd>{demographics.gender || "Not specified"}</dd>
          </div>
          {similarity != null && (
            <div>
              <dt className="font-semibold">Similarity Score</dt>
              <dd className="text-base font-bold text-brand-secondary">{similarity.toFixed(1)} / 5</dd>
            </div>
          )}
        </dl>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <DetailCard title="Academics">
          <dl className="text-sm text-slate-700 space-y-2">
            <DetailRow label="GPA (Weighted)" value={formatNumber(academic.weighted_gpa)} />
            <DetailRow label="SAT" value={academic.sat || "Not reported"} />
            <DetailRow label="ACT" value={academic.act || "Not reported"} />
            <DetailRow label="AP Courses" value={academic.number_of_ap_courses ?? "—"} />
            <DetailRow label="IB Courses" value={academic.number_of_ib_courses ?? "—"} />
          </dl>
        </DetailCard>

        <DetailCard title="Extracurriculars">
          <ul className="text-sm text-slate-700 space-y-2 list-disc pl-5">
            {entry.extracurricular_activities?.slice(0, 6).map((item, idx) => (
              <li key={`${entry.id}-activity-${idx}`}>
                <span className="font-semibold">{item.title}</span>
                {item.description && <span className="text-slate-500"> — {item.description}</span>}
              </li>
            )) || <li>No activities listed.</li>}
          </ul>
        </DetailCard>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <DetailCard title="Awards">
          <ul className="text-sm text-slate-700 space-y-1 list-disc pl-5">
            {entry.awards?.slice(0, 6).map((award, idx) => (
              <li key={`${entry.id}-award-${idx}`}>{award}</li>
            )) || <li>No awards listed.</li>}
          </ul>
        </DetailCard>
        <DetailCard title="Letters & Interviews">
          <p className="text-sm text-slate-700">
            Letters: {entry.letters_of_recommendation?.length ?? 0} • Interviews: {entry.interviews?.length ?? 0}
          </p>
        </DetailCard>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <DecisionCard title="Acceptances" color="bg-emerald-50" list={decisions.acceptances} />
        <DecisionCard title="Waitlists" color="bg-amber-50" list={decisions.waitlists} />
        <DecisionCard title="Rejections" color="bg-rose-50" list={decisions.rejections} />
      </div>
    </div>
  );
};

const DetailCard: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
    <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
    {children}
  </div>
);

const DetailRow: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="flex items-center justify-between gap-3">
    <dt className="text-slate-500">{label}</dt>
    <dd className="font-semibold text-slate-900">{value}</dd>
  </div>
);

const Pill: React.FC<{ label: string; value: React.ReactNode; color: string }> = ({
  label,
  value,
  color,
}) => (
  <span
    className={`inline-flex items-center gap-3 px-4 py-1.5 rounded-full text-sm font-semibold ${color}`}
  >
    <span className="uppercase tracking-wide text-[11px]">{label}</span>
    <span className="text-base">{value}</span>
  </span>
);

const DecisionCard: React.FC<{ title: string; list: string[]; color: string }> = ({
  title,
  list,
  color,
}) => (
  <div className={`rounded-2xl border border-slate-100 shadow-sm p-5 ${color}`}>
    <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
    {list && list.length ? (
      <ul className="mt-3 space-y-1 text-sm text-slate-700 list-disc pl-5">
        {list.slice(0, 10).map((item, idx) => (
          <li key={`${title}-${idx}`}>{item}</li>
        ))}
      </ul>
    ) : (
      <p className="mt-3 text-sm text-slate-600">None listed.</p>
    )}
  </div>
);

function pickRandomSubset<T>(list: T[], count: number): T[] {
  const copy = list.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}

function parseScore(value: string | number | null | undefined): number | null {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const cleaned = Number(String(value).replace(/[^\d.]/g, ""));
  return Number.isFinite(cleaned) ? cleaned : null;
}

function formatNumber(value: number | string | null | undefined): string {
  if (value == null || value === "") return "N/A";
  const num = typeof value === "number" ? value : Number(value);
  if (Number.isFinite(num)) return num.toString();
  return String(value);
}

function sanitizeRaceOrEthnicity(value: string | null | undefined): string {
  if (!value) return "Not specified";
  const stripped = value.replace(/\s*\([^)]*\)\s*/g, "").trim();
  return stripped || "Not specified";
}

function calculateApplicationSimilarity(
  profile: SuccessApplicationProfile,
  studentProfile: {
    gpa?: number | null;
    satMath?: number | null;
    satEBRW?: number | null;
    actComposite?: number | null;
    majors?: string[];
  },
  targetSchools: string[]
): number {
  let score = 1;
  const userGpa = studentProfile.gpa ?? null;
  const userSat =
    studentProfile.satMath != null && studentProfile.satEBRW != null
      ? Number(studentProfile.satMath) + Number(studentProfile.satEBRW)
      : null;
  const userAct = studentProfile.actComposite ?? null;
  const appGpa = profile.academics.unweighted_gpa ?? profile.academics.weighted_gpa ?? null;
  const appSat = parseScore(profile.academics.sat);
  const appAct = parseScore(profile.academics.act);

  if (userGpa != null && appGpa != null) {
    const diff = Math.abs(userGpa - appGpa);
    if (diff <= 0.1) score += 2;
    else if (diff <= 0.3) score += 1;
  }

  if (userSat != null && appSat != null) {
    const diff = Math.abs(userSat - appSat);
    if (diff <= 30) score += 1;
    else if (diff <= 100) score += 0.5;
  }

  if (userAct != null && appAct != null) {
    const diff = Math.abs(userAct - appAct);
    if (diff <= 1) score += 0.7;
    else if (diff <= 3) score += 0.4;
  }

  const majorLabels = (studentProfile.majors || [])
    .map((major) => extractMajorLabel(major).toLowerCase())
    .filter((label) => label.length > 0);
  if (majorLabels.length) {
    const comparisonFields = [
      profile.assigned_category,
      profile.demographics?.intended_major,
      ...(profile.flair || []),
      ...(Array.isArray(profile.tags) ? profile.tags : []),
    ]
      .map((field) => (field ?? "").toLowerCase())
      .filter(Boolean);
    const match = majorLabels.some((major) =>
      comparisonFields.some((field) => field.includes(major))
    );
    if (match) score += 1.2;
    else score -= 0.8;
  }

  if (targetSchools.length) {
    const accepts = (profile.decisions?.acceptances || []).map((s) => s.toLowerCase());
    const match = targetSchools.some((school) =>
      accepts.some((acc) => acc.includes(school.toLowerCase()))
    );
    if (match) score += 0.5;
  }

  return Math.min(5, Math.max(1, score));
}
