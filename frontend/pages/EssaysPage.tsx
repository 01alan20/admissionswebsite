import React, { useEffect, useMemo, useState } from "react";
import DashboardLayout from "../components/DashboardLayout";
import { useOnboardingGuard } from "../hooks/useOnboardingGuard";
import { useOnboardingContext } from "../context/OnboardingContext";
import { BookOpen, Users } from "lucide-react";
import {
  getAnonymousEssays,
  getInstitutionsSummariesByIds,
} from "../data/api";
import type { AnonymousEssayEntry } from "../types";
import { extractMajorLabel } from "../utils/majors";

type EssayView = "menu" | "browse" | "similar";

const EssaysPage: React.FC = () => {
  const loadingGuard = useOnboardingGuard(9);
  const { studentProfile, targetUnitIds } = useOnboardingContext();
  const [view, setView] = useState<EssayView>("menu");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [essays, setEssays] = useState<AnonymousEssayEntry[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [enabledTypes, setEnabledTypes] = useState<string[]>([]);
  const [enabledCategories, setEnabledCategories] = useState<string[]>([]);
  const [targetSchools, setTargetSchools] = useState<string[]>([]);
  const [browseSeed, setBrowseSeed] = useState(0);
  const [similarSeed, setSimilarSeed] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getAnonymousEssays();
        if (!cancelled) {
          setEssays(data);
          setError(null);
        }
      } catch {
        if (!cancelled) setError("Unable to load essays.");
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
        if (!cancelled) setTargetSchools(names.map((n) => n.name));
      } catch {
        if (!cancelled) setTargetSchools([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [targetUnitIds]);

  const allTypes = useMemo(
    () => Array.from(new Set(essays.map((e) => e.type || "Unknown"))).sort(),
    [essays]
  );
  const allCategories = useMemo(
    () => Array.from(new Set(essays.map((e) => e.category || "General"))).sort(),
    [essays]
  );

  useEffect(() => {
    setEnabledTypes(allTypes);
  }, [allTypes]);

  useEffect(() => {
    setEnabledCategories(allCategories);
  }, [allCategories]);

  const filteredEssays = useMemo(() => {
    return essays.filter(
      (essay) =>
        (enabledTypes.length === 0 || enabledTypes.includes(essay.type || "Unknown")) &&
        (enabledCategories.length === 0 || enabledCategories.includes(essay.category || "General"))
    );
  }, [essays, enabledTypes, enabledCategories]);

  const browseList = useMemo(() => {
    if (!filteredEssays.length) return [];
    const shuffled = filteredEssays.slice();
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const picks: AnonymousEssayEntry[] = [];
    const usedSchools = new Set<string>();
    for (const essay of shuffled) {
      const key = (essay.school || `school-${essay.essay_id}`).toLowerCase();
      if (usedSchools.has(key) && picks.length < 7) continue;
      usedSchools.add(key);
      picks.push(essay);
      if (picks.length >= 10) break;
    }
    if (picks.length < 10) {
      for (const essay of shuffled) {
        if (picks.length >= 10) break;
        if (!picks.includes(essay)) picks.push(essay);
      }
    }
    return picks.slice(0, 10);
  }, [filteredEssays, browseSeed]);

  const similarList = useMemo(() => {
    const ranked = filteredEssays
      .map((essay) => ({
        data: essay,
        similarity: calculateEssaySimilarity(essay, studentProfile, targetSchools),
      }))
      .sort((a, b) => b.similarity - a.similarity);
    const seenSchools = new Set<string>();
    const unique: typeof ranked = [];
    for (const entry of ranked) {
      const key = (entry.data.school || `school-${entry.data.essay_id}`).toLowerCase();
      if (seenSchools.has(key) && unique.length < 7) continue;
      seenSchools.add(key);
      unique.push(entry);
      if (unique.length >= 10) break;
    }
    if (unique.length < 10) {
      for (const entry of ranked) {
        if (unique.length >= 10) break;
        if (!unique.includes(entry)) unique.push(entry);
      }
    }
    return unique;
  }, [filteredEssays, studentProfile, targetSchools, similarSeed]);

  const activeList =
    view === "similar" ? similarList.map((entry) => entry.data) : browseList;

  useEffect(() => {
    if (view === "menu") {
      setSelectedId(null);
      return;
    }
    if (activeList.length && !activeList.some((essay) => essay.essay_id === selectedId)) {
      setSelectedId(activeList[0].essay_id);
    }
  }, [view, activeList, selectedId]);

  const selectedEssay =
    activeList.find((essay) => essay.essay_id === selectedId) ||
    activeList[0] ||
    null;

  if (loadingGuard) {
    return (
      <DashboardLayout>
        <div className="py-10 text-sm text-slate-600">Loading essays...</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <header className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <p className="text-xs uppercase tracking-wide text-brand-secondary font-semibold">Essentials</p>
          <h1 className="text-3xl font-bold text-slate-900 mt-1">Essays</h1>
          <p className="mt-2 text-sm text-slate-600 max-w-3xl">
            Hundreds of essays that led to admits. Browse freely or find the stories closest to your background.
          </p>
        </header>

        {view === "menu" ? (
          <div className="grid gap-4 md:grid-cols-2">
            <ExperienceCard
              title="Browse Essays"
              description="Explore 100+ successful college essays from top schools."
              accent="from-rose-600 to-rose-400"
              icon={<BookOpen className="h-5 w-5" />}
              onClick={() => {
                setBrowseSeed((prev) => prev + 1);
                setView("browse");
              }}
            />
            <ExperienceCard
              title="Essays Like You"
              description="Find essays from students with similar backgrounds and stories."
              accent="from-indigo-600 to-indigo-400"
              icon={<Users className="h-5 w-5" />}
              onClick={() => {
                setSimilarSeed((prev) => prev + 1);
                setView("similar");
              }}
            />
          </div>
        ) : (
          <section className="space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex gap-2">
                <button
                  className="px-4 py-2 rounded-full border border-slate-200 text-sm text-slate-600 bg-white"
                  onClick={() => {
                    setFiltersOpen(false);
                    setSelectedId(null);
                    setView("menu");
                  }}
                >
                  Back
                </button>
                <button
                  className="px-4 py-2 rounded-full border border-slate-200 text-sm text-slate-600 bg-white"
                  onClick={() => setFiltersOpen((prev) => !prev)}
                >
                  Filters {filtersOpen ? "▲" : "▼"}
                </button>
              </div>
            </div>

            {filtersOpen && (
              <EssayFilters
                allTypes={allTypes}
                enabledTypes={enabledTypes}
                onToggleType={(value) =>
                  setEnabledTypes((prev) => toggleInList(prev, value))
                }
                allCategories={allCategories}
                enabledCategories={enabledCategories}
                onToggleCategory={(value) =>
                  setEnabledCategories((prev) => toggleInList(prev, value))
                }
                onReset={() => {
                  setEnabledTypes(allTypes);
                  setEnabledCategories(allCategories);
                }}
              />
            )}

            {loading ? (
              <div className="py-8 text-center text-slate-600">Loading essays...</div>
            ) : error ? (
              <div className="py-8 text-center text-red-600">{error}</div>
            ) : activeList.length === 0 ? (
              <div className="py-8 text-center text-slate-500">No essays match your current filters.</div>
            ) : (
              <div className="grid gap-6 lg:grid-cols-[320px,1fr]">
                <nav className="bg-white rounded-2xl border border-slate-100 shadow-sm max-h-[80vh] overflow-y-auto p-3 space-y-3">
                  {activeList.map((essay) => (
                    <button
                      key={essay.essay_id}
                      type="button"
                      onClick={() => setSelectedId(essay.essay_id)}
                      className={`w-full text-left p-4 rounded-2xl border transition ${
                        selectedEssay && selectedEssay.essay_id === essay.essay_id
                          ? "border-brand-secondary bg-indigo-50"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs text-slate-500 uppercase">
                        <span>{essay.school}</span>
                        <span>{essay.year}</span>
                      </div>
                      <div className="mt-2 text-base font-semibold text-slate-900 capitalize">
                        {formatEssayType(essay.type)}
                      </div>
                      <p className="text-sm text-slate-600">{essay.category}</p>
                      <p className="text-xs text-slate-500 line-clamp-2 mt-2">
                        {essay.question || "Common App Essay"}
                      </p>
                    </button>
                  ))}
                </nav>
                {selectedEssay && (
                  <EssayDetail
                    essay={selectedEssay}
                    similarity={
                      view === "similar"
                        ? calculateEssaySimilarity(selectedEssay, studentProfile, targetSchools)
                        : null
                    }
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

export default EssaysPage;

const ExperienceCard: React.FC<{
  title: string;
  description: string;
  icon: React.ReactNode;
  accent: string;
  onClick: () => void;
}> = ({ title, description, icon, accent, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="bg-white rounded-2xl border border-slate-100 shadow-sm text-left p-6 hover:shadow-md transition flex flex-col gap-3"
  >
    <div className={`w-12 h-12 rounded-full text-white flex items-center justify-center bg-gradient-to-r ${accent}`}>
      {icon}
    </div>
    <div>
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      <p className="text-sm text-slate-600 mt-1">{description}</p>
    </div>
    <span className="text-sm font-semibold text-brand-secondary mt-auto">Launch Tool -&gt;</span>
  </button>
);

const EssayFilters: React.FC<{
  allTypes: string[];
  enabledTypes: string[];
  allCategories: string[];
  enabledCategories: string[];
  onToggleType: (value: string) => void;
  onToggleCategory: (value: string) => void;
  onReset: () => void;
}> = ({
  allTypes,
  enabledTypes,
  allCategories,
  enabledCategories,
  onToggleType,
  onToggleCategory,
  onReset,
}) => (
  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-4">
    <div>
      <h3 className="text-sm font-semibold text-slate-900 mb-2">Essay Type</h3>
      <div className="flex flex-wrap gap-2">
        {allTypes.map((type) => (
          <ToggleChip
            key={type}
            label={formatEssayType(type)}
            active={enabledTypes.includes(type)}
            onClick={() => onToggleType(type)}
          />
        ))}
      </div>
    </div>
    <div>
      <h3 className="text-sm font-semibold text-slate-900 mb-2">Essay Category</h3>
      <div className="flex flex-wrap gap-2">
        {allCategories.map((category) => (
          <ToggleChip
            key={category}
            label={category}
            active={enabledCategories.includes(category)}
            onClick={() => onToggleCategory(category)}
          />
        ))}
      </div>
    </div>
    <button
      type="button"
      className="px-4 py-2 rounded-full border border-slate-200 text-sm text-slate-600 bg-white"
      onClick={onReset}
    >
      Reset Filters
    </button>
  </div>
);

const ToggleChip: React.FC<{
  label: string;
  active: boolean;
  onClick: () => void;
}> = ({ label, active, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`px-3 py-1.5 rounded-full border text-xs font-semibold ${
      active ? "bg-brand-secondary text-white border-brand-secondary" : "border-slate-200 text-slate-600 bg-white"
    }`}
  >
    {label}
  </button>
);

const Tag: React.FC<{ label: React.ReactNode; color: string }> = ({ label, color }) => (
  <span className={`inline-flex items-center px-4 py-1.5 rounded-full text-sm font-semibold ${color}`}>
    {label}
  </span>
);

const EssayDetail: React.FC<{
  essay: AnonymousEssayEntry;
  similarity: number | null;
}> = ({ essay, similarity }) => {
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Tag label={essay.school || "Unknown"} color="bg-emerald-50 text-emerald-800 border border-emerald-200" />
          <Tag label={essay.year || "Year"} color="bg-blue-50 text-blue-800 border border-blue-200" />
          <Tag label={formatEssayType(essay.type)} color="bg-indigo-50 text-indigo-800 border border-indigo-200" />
          <Tag label={essay.category || "Category"} color="bg-amber-50 text-amber-800 border border-amber-200" />
          {similarity != null && (
            <Tag
              label={`Similarity ${similarity.toFixed(1)} / 5`}
              color="bg-purple-50 text-purple-800 border border-purple-200"
            />
          )}
        </div>
        {essay.question && (
          <div>
            <h3 className="text-sm font-semibold text-slate-900 uppercase">Prompt</h3>
            <p className="text-sm text-slate-600 mt-1">{essay.question}</p>
          </div>
        )}
        <div>
          <h3 className="text-sm font-semibold text-slate-900 uppercase">Essay</h3>
          <article className="mt-2 whitespace-pre-wrap text-slate-800 leading-relaxed bg-slate-50 rounded-xl p-4 max-h-[60vh] overflow-y-auto">
            {essay.essay}
          </article>
          <p className="mt-2 text-xs text-slate-500">
            {essay.essay.split(/\s+/).filter(Boolean).length} words
          </p>
        </div>
      </div>
    </div>
  );
};

function toggleInList(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function formatEssayType(raw: string | undefined): string {
  if (!raw) return "Essay";
  if (raw.toLowerCase().includes("common")) return "Common App Essay";
  if (raw.toLowerCase().includes("supp")) return "Supplemental Essay";
  return raw.replace(/_/g, " ");
}

function calculateEssaySimilarity(
  essay: AnonymousEssayEntry,
  studentProfile: { majors?: string[] },
  targetSchools: string[]
): number {
  let score = 1;
  const normalizedCategory = (essay.category || "").toLowerCase();
  const majors = (studentProfile.majors || [])
    .map((major) => extractMajorLabel(major).toLowerCase())
    .filter((label) => label.length > 0);

  if (majors.length) {
    const comparisonFields = [
      normalizedCategory,
      (essay.question || "").toLowerCase(),
      (essay.type || "").toLowerCase(),
    ];
    const match = majors.some((major) =>
      comparisonFields.some((field) => field.includes(major))
    );
    if (match) score += 2;
  }

  if (targetSchools.length) {
    const match = targetSchools.some((school) =>
      (essay.school || "").toLowerCase().includes(school.toLowerCase())
    );
    if (match) score += 1;
  }

  if ((essay.type || "").toLowerCase().includes("common")) {
    score += 0.5;
  }

  return Math.min(5, Math.max(1, score));
}
