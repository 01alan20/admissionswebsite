import React, { useEffect, useMemo, useState } from "react";
import DashboardLayout from "../components/DashboardLayout";
import { useOnboardingGuard } from "../hooks/useOnboardingGuard";
import { useOnboardingContext } from "../context/OnboardingContext";
import { getSuccessProfiles, getInstitutionsSummariesByIds, getMajorsMeta } from "../data/api";
import type { SuccessApplicationProfile } from "../types";
import { extractMajorLabel } from "../utils/majors";
import {
  buildMajorsIndex,
  mapApplicationIntendedMajor,
  mapApplicationMajorFamily,
  type MajorsIndex,
} from "../utils/majorCipMapping";

type ViewMode = "menu" | "all" | "similar";
type EnrichedEntry = {
  data: SuccessApplicationProfile;
  similarity: number;
  majorFamilyLabel: string;
  majorFamilyCode: string | null;
  intendedMajorLabel: string;
  intendedMajorCode: string | null;
};

const ApplicationsPage: React.FC = () => {
  const loadingGuard = useOnboardingGuard(9);
  const { studentProfile, targetUnitIds } = useOnboardingContext();
  const [view, setView] = useState<ViewMode>("menu");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [applications, setApplications] = useState<SuccessApplicationProfile[]>([]);
  const [majorsIndex, setMajorsIndex] = useState<MajorsIndex | null>(null);
  const [majorsMeta, setMajorsMeta] = useState<any | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [targetSchools, setTargetSchools] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [data, meta] = await Promise.all([getSuccessProfiles(), getMajorsMeta()]);
        if (!cancelled) {
          setApplications(data);
          setMajorsMeta(meta);
          setMajorsIndex(buildMajorsIndex(meta));
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
        const names = await getInstitutionsSummariesByIds(targetUnitIds.slice(0, 50));
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
    if (!majorsIndex || !majorsMeta) {
      return applications.map((app) => ({
        data: app,
        similarity: calculateApplicationSimilarity(app, studentProfile, targetSchools, null),
        majorFamilyLabel: app.assigned_category || "Not specified",
        majorFamilyCode: null,
        intendedMajorLabel: app.demographics?.intended_major || "Not specified",
        intendedMajorCode: null,
      })) as EnrichedEntry[];
    }

    return applications.map((app) => {
      const family = mapApplicationMajorFamily(app.assigned_category, majorsMeta, majorsIndex);
      const intended = mapApplicationIntendedMajor(app.demographics?.intended_major, majorsIndex);
      const majorFamilyLabel = family?.label ?? app.assigned_category ?? "Not specified";
      const majorFamilyCode = family?.code ?? null;
      const intendedMajorLabel = intended?.label ?? app.demographics?.intended_major ?? "Not specified";
      const intendedMajorCode = intended?.code ?? null;

      return {
        data: app,
        similarity: calculateApplicationSimilarity(app, studentProfile, targetSchools, {
          majorFamilyCode,
          intendedMajorCode,
        }),
        majorFamilyLabel,
        majorFamilyCode,
        intendedMajorLabel,
        intendedMajorCode,
      } satisfies EnrichedEntry;
    });
  }, [applications, studentProfile, targetSchools, majorsIndex, majorsMeta]);

  const orderedApplications = useMemo(() => {
    return enrichedApplications
      .slice()
      .sort((a, b) => {
        const yearDiff = (b.data.year || 0) - (a.data.year || 0);
        if (yearDiff !== 0) return yearDiff;
        return (b.data.id || 0) - (a.data.id || 0);
      });
  }, [enrichedApplications]);

  const similarApplications = useMemo(() => {
    return enrichedApplications
      .slice()
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 12);
  }, [enrichedApplications]);

  const activeEntries = view === "similar" ? similarApplications : orderedApplications;

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
              title="Browse Applications"
              description="Explore successful applications from recent cycles."
              accent="from-rose-600 to-rose-400"
              onClick={() => setView("all")}
            />
            <ExperienceCard
              title="Applications Like You"
              description="Find profiles with similar academics and interests."
              accent="from-indigo-600 to-indigo-400"
              onClick={() => setView("similar")}
            />
          </div>
        ) : (
          <section className="space-y-4">
            {loading ? (
              <div className="py-8 text-center text-slate-600">Loading applications...</div>
            ) : error ? (
              <div className="py-8 text-center text-red-600">{error}</div>
            ) : activeEntries.length === 0 ? (
              <div className="py-8 text-center text-slate-500">No applications available yet.</div>
            ) : (
              <div className="grid gap-6 lg:grid-cols-[320px,1fr]">
                <nav className="bg-white rounded-2xl border border-slate-100 shadow-sm max-h-[80vh] overflow-y-auto p-3 space-y-3">
                  {activeEntries.map((entry, idx) => (
                    <ApplicationListCard
                      key={entry.data.id}
                      entry={entry}
                      index={idx}
                      active={Boolean(selected && selected.data.id === entry.data.id)}
                      showSimilarity={view === "similar"}
                      onSelect={() => setSelectedId(entry.data.id)}
                    />
                  ))}
                </nav>
                {selected ? (
                  <ApplicationDetail
                    entry={selected.data}
                    similarity={view === "similar" ? selected.similarity : null}
                    majorFamilyLabel={selected.majorFamilyLabel}
                    intendedMajorLabel={selected.intendedMajorLabel}
                  />
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-slate-500">
                    Select a profile to view the full application.
                  </div>
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
  accent: string;
  onClick: () => void;
}> = ({ title, description, accent, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="bg-white rounded-2xl border border-slate-100 shadow-sm text-left p-6 hover:shadow-md transition flex flex-col gap-3"
  >
    <div className={`w-12 h-12 rounded-full text-white flex items-center justify-center bg-gradient-to-r ${accent}`}>
      <span className="text-lg font-semibold">→</span>
    </div>
    <div>
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      <p className="text-sm text-slate-600 mt-1">{description}</p>
    </div>
    <span className="text-sm font-semibold text-brand-secondary mt-auto">Launch</span>
  </button>
);

const ApplicationListCard: React.FC<{
  entry: EnrichedEntry;
  index: number;
  active: boolean;
  showSimilarity: boolean;
  onSelect: () => void;
}> = ({ entry, index, active, showSimilarity, onSelect }) => {
  const descriptor =
    entry.data.extracurricular_activities?.[0]?.title ||
    entry.data.demographics?.residence ||
    "Completed application";
  const primarySchool = stripQuotes(entry.data.decisions?.acceptances?.[0] || "School not listed");
  const majorLabel = stripQuotes(entry.intendedMajorLabel || "Undeclared");
  const gpaDisplay =
    typeof (entry.data.academics.weighted_gpa ?? entry.data.academics.unweighted_gpa) === "number"
      ? (entry.data.academics.weighted_gpa ?? entry.data.academics.unweighted_gpa)
      : null;
  const satDisplay = parseScore(entry.data.academics.sat);
  const actDisplay = parseScore(entry.data.academics.act);
  const metrics: string[] = [];
  if (gpaDisplay != null) metrics.push(`GPA ${gpaDisplay.toFixed(2)}`);
  if (satDisplay != null) metrics.push(`SAT ${satDisplay}`);
  if (actDisplay != null) metrics.push(`ACT ${actDisplay}`);
  if (entry.majorFamilyLabel) metrics.push(stripQuotes(entry.majorFamilyLabel));

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-left p-4 rounded-2xl border transition flex flex-col gap-2 ${
        active
          ? "border-brand-secondary bg-indigo-50 shadow-sm"
          : "border-slate-200 bg-white hover:border-slate-300"
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <span className="line-clamp-1 text-base font-bold text-slate-900">{primarySchool}</span>
            <span className="text-sm text-slate-500">{entry.data.year || "—"}</span>
          </div>
          <p className="text-sm font-semibold text-slate-900 line-clamp-1 mt-1">{majorLabel}</p>
          <p className="text-sm text-slate-700 line-clamp-2 mt-1">{descriptor}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1">
        {metrics.map((label, idx) => (
          <Badge key={`${entry.data.id}-metric-${idx}`} label={label} tone="slate" compact />
        ))}
      </div>
      {showSimilarity && (
        <div className="text-[11px] font-semibold text-indigo-700">
          Similarity {entry.similarity.toFixed(1)} / 5
        </div>
      )}
    </button>
  );
};

const ApplicationDetail: React.FC<{
  entry: SuccessApplicationProfile;
  similarity: number | null;
  majorFamilyLabel: string;
  intendedMajorLabel: string;
}> = ({ entry, similarity, majorFamilyLabel, intendedMajorLabel }) => {
  const academic = entry.academics;
  const demographics = entry.demographics;
  const decisions = entry.decisions || { acceptances: [], rejections: [], waitlists: [] };
  const gpaDisplay =
    typeof (academic.weighted_gpa ?? academic.unweighted_gpa) === "number"
      ? (academic.weighted_gpa ?? academic.unweighted_gpa)
      : null;
  const satDisplay = parseScore(academic.sat);
  const actDisplay = parseScore(academic.act);
  const majorCategory = stripQuotes(majorFamilyLabel || entry.assigned_category || "Not specified");
  const intendedMajor = stripQuotes(intendedMajorLabel || demographics.intended_major || "Not specified");
  const sanitizedRace = sanitizeRaceOrEthnicity(demographics.race_ethnicity);
  const activities = entry.extracurricular_activities || [];
  const awards = entry.awards || [];
  const residence = parseResidence(demographics.residence);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-blue-100 bg-gradient-to-r from-sky-50 to-indigo-50 shadow-sm p-6 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Overview</p>
          </div>
          {similarity != null && (
            <div className="px-3 py-1 rounded-full bg-white/80 text-xs font-semibold text-indigo-700 border border-indigo-100">
              Similarity {similarity.toFixed(1)} / 5
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge label={majorCategory} tone="amber" size="large" />
          {gpaDisplay != null && <Badge label={`GPA ${gpaDisplay.toFixed(2)}`} tone="emerald" size="large" />}
          {satDisplay != null && <Badge label={`SAT ${satDisplay}`} tone="indigo" size="large" />}
          {actDisplay != null && <Badge label={`ACT ${actDisplay}`} tone="purple" size="large" />}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm text-slate-800">
          <div>
            <span className="font-semibold text-slate-900">Major:</span> <span>{intendedMajor}</span>
          </div>
          <div>
            <span className="font-semibold text-slate-900">Race:</span> <span>{sanitizedRace}</span>
          </div>
          <div>
            <span className="font-semibold text-slate-900">Gender:</span>{" "}
            <span>{demographics.gender || "Not specified"}</span>
          </div>
          <div>
            <span className="font-semibold text-slate-900">Country:</span>{" "}
            <span>{residence.country}</span>
          </div>
          <div>
            <span className="font-semibold text-slate-900">State:</span>{" "}
            <span>{residence.state}</span>
          </div>
          <div>
            <span className="font-semibold text-slate-900">City:</span>{" "}
            <span>{residence.city}</span>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <PanelCard title="Academics" tone="lavender">
          <dl className="space-y-2 text-sm text-slate-700">
            <InfoRow label="Weighted GPA" value={formatNumber(academic.weighted_gpa)} />
            {satDisplay != null && <InfoRow label="SAT" value={satDisplay} />}
            {actDisplay != null && <InfoRow label="ACT" value={actDisplay} />}
            <InfoRow label="Class Rank" value={formatClassRank(academic)} />
            <InfoRow label="AP Courses" value={formatNumber(academic.number_of_ap_courses)} />
            <InfoRow label="IB Courses" value={formatNumber(academic.number_of_ib_courses)} />
          </dl>
        </PanelCard>

        <PanelCard title="Extracurriculars" tone="sky">
          <BulletList
            items={activities.slice(0, 6).map((item) =>
              item.description ? `${item.title}: ${item.description}` : item.title
            )}
            empty="No activities listed."
          />
        </PanelCard>

        <PanelCard title="Awards" tone="sun">
          <BulletList items={awards.slice(0, 8)} empty="No awards shared." />
        </PanelCard>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <PanelCard title="Acceptances" tone="mint">
          <BulletList items={decisions.acceptances?.slice(0, 12) ?? []} empty="No acceptances listed." />
        </PanelCard>
        <PanelCard title="Waitlists" tone="sun">
          <BulletList items={decisions.waitlists?.slice(0, 6) ?? []} empty="None reported." />
        </PanelCard>
        <PanelCard title="Rejections" tone="rose">
          <BulletList items={decisions.rejections?.slice(0, 8) ?? []} empty="None reported." />
        </PanelCard>
      </div>
    </div>
  );
};

const TONE_STYLES: Record<
  "lavender" | "sky" | "mint" | "sun" | "rose" | "blue" | "amber" | "emerald" | "indigo" | "purple" | "slate",
  { bg: string; border: string; text: string }
> = {
  lavender: { bg: "bg-gradient-to-b from-indigo-50 to-purple-50", border: "border-indigo-100", text: "text-slate-800" },
  sky: { bg: "bg-gradient-to-b from-sky-50 to-blue-50", border: "border-sky-100", text: "text-slate-800" },
  mint: { bg: "bg-gradient-to-b from-emerald-50 to-teal-50", border: "border-emerald-100", text: "text-slate-800" },
  sun: { bg: "bg-gradient-to-b from-amber-50 to-orange-50", border: "border-amber-100", text: "text-slate-800" },
  rose: { bg: "bg-gradient-to-b from-rose-50 to-orange-50", border: "border-rose-100", text: "text-slate-800" },
  blue: { bg: "bg-blue-50", border: "border-blue-100", text: "text-blue-800" },
  amber: { bg: "bg-amber-50", border: "border-amber-100", text: "text-amber-800" },
  emerald: { bg: "bg-emerald-50", border: "border-emerald-100", text: "text-emerald-800" },
  indigo: { bg: "bg-indigo-50", border: "border-indigo-100", text: "text-indigo-800" },
  purple: { bg: "bg-purple-50", border: "border-purple-100", text: "text-purple-800" },
  slate: { bg: "bg-slate-100", border: "border-slate-200", text: "text-slate-700" },
};

const PanelCard: React.FC<{
  title: string;
  tone: keyof typeof TONE_STYLES;
  children: React.ReactNode;
}> = ({ title, tone, children }) => {
  const toneClass = TONE_STYLES[tone];
  return (
    <div className={`rounded-2xl border shadow-sm p-5 ${toneClass.bg} ${toneClass.border}`}>
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      <div className="mt-3 text-sm leading-relaxed">{children}</div>
    </div>
  );
};

const BulletList: React.FC<{ items: string[]; empty: string }> = ({ items, empty }) => {
  if (!items || items.length === 0) {
    return <p className="text-sm text-slate-600">{empty}</p>;
  }
  return (
    <ul className="space-y-1 text-sm text-slate-800 list-disc pl-4">
      {items.map((item, idx) => (
        <li key={`${item}-${idx}`}>{item}</li>
      ))}
    </ul>
  );
};

type BadgeSize = "compact" | "normal" | "large";
type BadgeProps = {
  label: React.ReactNode;
  tone: keyof typeof TONE_STYLES;
  compact?: boolean;
  size?: BadgeSize;
};

const Badge = ({ label, tone, compact = false, size = compact ? "compact" : "normal" }: BadgeProps) => {
  const toneClass = TONE_STYLES[tone];
  return (
    <span
      className={`inline-flex items-center ${
        size === "compact"
          ? "px-2 py-1 text-[11px]"
          : size === "large"
          ? "px-4 py-2 text-sm"
          : "px-3 py-1.5 text-xs"
      } rounded-full font-semibold ${toneClass.bg} ${toneClass.border} ${toneClass.text}`}
    >
      {label}
    </span>
  );
};

const InfoRow: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="flex items-center justify-between gap-3">
    <dt className="text-slate-500">{label}</dt>
    <dd className="font-semibold text-slate-900">{value}</dd>
  </div>
);

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
  const withoutReligion = stripped
    .split(/[,/]/)
    .map((part) => part.trim())
    .filter(
      (part) =>
        part &&
        !/jewish|christian|catholic|muslim|islam|hindu|buddhist|atheist|agnostic/i.test(part)
    );
  const result = withoutReligion.join(", ");
  return result || "Not specified";
}

function stripQuotes(value: string): string {
  return String(value ?? "")
    .replace(/[“”"]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function formatClassRank(academic: SuccessApplicationProfile["academics"]): string {
  const exact = academic.class_rank_exact || academic.rank;
  const percentile = academic.class_rank_percentile;
  const category = academic.class_rank_category;

  if (exact && category) return `${exact} (${category})`;
  if (exact && percentile != null) return `${exact} (Top ${percentile}%)`;
  if (exact) return exact;
  if (category) return category;
  if (percentile != null) return `Top ${percentile}%`;
  return "Not reported";
}

function parseResidence(residence: string | null | undefined): { country: string; state: string; city: string } {
  if (!residence) {
    return { country: "Not specified", state: "Not specified", city: "Not specified" };
  }

  const cleaned = String(residence).replace(/\s+/g, " ").trim();
  const parts = cleaned.split(",").map((p) => p.trim()).filter(Boolean);

  if (parts.length >= 2) {
    const city = parts[0] || "Not specified";
    const state = normalizeUSState(parts[1]) ?? parts[1] ?? "Not specified";
    const country = parts[2] || (normalizeUSState(parts[1]) ? "United States" : "Not specified");
    return { country, state, city };
  }

  const inferredState = normalizeUSState(cleaned);
  if (inferredState) {
    return { country: "United States", state: inferredState, city: "Not specified" };
  }

  return { country: "Not specified", state: "Not specified", city: cleaned || "Not specified" };
}

function normalizeUSState(input: string): string | null {
  const raw = String(input ?? "").trim();
  if (!raw) return null;
  const upper = raw.toUpperCase();
  if (US_STATE_ABBREVIATIONS.has(upper)) return upper;

  const normalized = raw.replace(/\./g, "").toLowerCase();
  const fromName = US_STATE_NAME_TO_ABBR.get(normalized);
  if (fromName) return fromName;

  const matchAbbr = normalized.match(/\b([a-z]{2})\b/i)?.[1]?.toUpperCase() ?? null;
  if (matchAbbr && US_STATE_ABBREVIATIONS.has(matchAbbr)) return matchAbbr;

  for (const [name, abbr] of US_STATE_NAME_TO_ABBR.entries()) {
    const re = new RegExp(`\\b${name.replace(/\s+/g, "\\\\s+")}\\b`, "i");
    if (re.test(normalized)) return abbr;
  }
  return null;
}

const US_STATE_ABBREVIATIONS = new Set<string>([
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
  "DC",
]);

const US_STATE_NAME_TO_ABBR = new Map<string, string>([
  ["alabama", "AL"],
  ["alaska", "AK"],
  ["arizona", "AZ"],
  ["arkansas", "AR"],
  ["california", "CA"],
  ["colorado", "CO"],
  ["connecticut", "CT"],
  ["delaware", "DE"],
  ["florida", "FL"],
  ["georgia", "GA"],
  ["hawaii", "HI"],
  ["idaho", "ID"],
  ["illinois", "IL"],
  ["indiana", "IN"],
  ["iowa", "IA"],
  ["kansas", "KS"],
  ["kentucky", "KY"],
  ["louisiana", "LA"],
  ["maine", "ME"],
  ["maryland", "MD"],
  ["massachusetts", "MA"],
  ["michigan", "MI"],
  ["minnesota", "MN"],
  ["mississippi", "MS"],
  ["missouri", "MO"],
  ["montana", "MT"],
  ["nebraska", "NE"],
  ["nevada", "NV"],
  ["new hampshire", "NH"],
  ["new jersey", "NJ"],
  ["new mexico", "NM"],
  ["new york", "NY"],
  ["north carolina", "NC"],
  ["north dakota", "ND"],
  ["ohio", "OH"],
  ["oklahoma", "OK"],
  ["oregon", "OR"],
  ["pennsylvania", "PA"],
  ["rhode island", "RI"],
  ["south carolina", "SC"],
  ["south dakota", "SD"],
  ["tennessee", "TN"],
  ["texas", "TX"],
  ["utah", "UT"],
  ["vermont", "VT"],
  ["virginia", "VA"],
  ["washington", "WA"],
  ["west virginia", "WV"],
  ["wisconsin", "WI"],
  ["wyoming", "WY"],
  ["district of columbia", "DC"],
]);

function calculateApplicationSimilarity(
  profile: SuccessApplicationProfile,
  studentProfile: {
    gpa?: number | null;
    satTotal?: number | null;
    satMath?: number | null;
    satEBRW?: number | null;
    actComposite?: number | null;
    majors?: string[];
  },
  targetSchools: string[],
  mappedMajors: { majorFamilyCode: string | null; intendedMajorCode: string | null } | null
): number {
  let score = 1;
  const userGpa = studentProfile.gpa ?? null;
  const userSat =
    studentProfile.satTotal != null
      ? Number(studentProfile.satTotal)
      : studentProfile.satMath != null && studentProfile.satEBRW != null
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

  const userTwoDigit = new Set(
    (studentProfile.majors || [])
      .map((m) => m.match(/^(\d{2})/)?.[1] ?? null)
      .filter((v): v is string => Boolean(v))
  );
  const appTwoDigit = new Set<string>();
  if (mappedMajors?.majorFamilyCode) {
    appTwoDigit.add(mappedMajors.majorFamilyCode.slice(0, 2));
  }
  if (mappedMajors?.intendedMajorCode) {
    appTwoDigit.add(mappedMajors.intendedMajorCode.slice(0, 2));
  }

  if (userTwoDigit.size && appTwoDigit.size) {
    const match = Array.from(userTwoDigit).some((code) => appTwoDigit.has(code));
    if (match) score += 1.2;
    else score -= 0.8;
  } else if (majorLabels.length) {
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
    if (match) score += 1.0;
    else score -= 0.6;
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
