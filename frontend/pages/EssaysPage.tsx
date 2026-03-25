import React, { useEffect, useMemo, useState } from "react";
import DashboardLayout from "../components/DashboardLayout";
import { useOnboardingGuard } from "../hooks/useOnboardingGuard";
import { useOnboardingContext } from "../context/OnboardingContext";
import { getAnonymousEssays, getInstitutionsSummariesByIds } from "../data/api";
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
        (enabledCategories.length === 0 ||
          enabledCategories.includes(essay.category || "General"))
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

  const activeList = view === "similar" ? similarList.map((entry) => entry.data) : browseList;

  useEffect(() => {
    if (view === "menu") {
      setSelectedId(null);
      return;
    }
    if (activeList.length && !activeList.some((e) => e.essay_id === selectedId)) {
      setSelectedId(activeList[0]?.essay_id ?? null);
    }
  }, [view, activeList, selectedId]);

  const selectedEssay = useMemo(() => {
    if (selectedId == null) return null;
    return activeList.find((e) => e.essay_id === selectedId) ?? null;
  }, [activeList, selectedId]);

  const selectedSimilarity = useMemo(() => {
    if (view !== "similar" || selectedId == null) return null;
    const entry = similarList.find((e) => e.data.essay_id === selectedId) ?? null;
    return entry?.similarity ?? null;
  }, [view, selectedId, similarList]);

  const startBrowse = () => {
    setView("browse");
    setBrowseSeed((s) => s + 1);
    setFiltersOpen(false);
  };

  const startSimilar = () => {
    setView("similar");
    setSimilarSeed((s) => s + 1);
    setFiltersOpen(false);
  };

  const onToggleType = (t: string) => setEnabledTypes((prev) => toggleInList(prev, t));
  const onToggleCategory = (c: string) => setEnabledCategories((prev) => toggleInList(prev, c));

  const resetFilters = () => {
    setEnabledTypes(allTypes);
    setEnabledCategories(allCategories);
  };

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
          <p className="text-xs uppercase tracking-wide text-brand-secondary font-semibold">
            Review
          </p>
          <h1 className="text-3xl font-bold text-slate-900 mt-1">Essays</h1>
          <p className="mt-2 text-sm text-slate-600">
            Learn from successful essays and browse examples similar to your background.
          </p>
        </header>

        {loading ? (
          <div className="py-10 text-sm text-slate-600">Loading essays...</div>
        ) : error ? (
          <div className="bg-white rounded-2xl border border-red-200 p-4 text-sm text-red-600">
            {error}
          </div>
        ) : view === "menu" ? (
          <div className="grid gap-6 md:grid-cols-2">
            <button
              type="button"
              onClick={startBrowse}
              className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 text-left hover:border-slate-200 transition"
            >
              <p className="text-xs uppercase font-semibold text-slate-500">Browse</p>
              <h2 className="mt-2 text-xl font-bold text-slate-900">Explore Top Essays</h2>
              <p className="mt-2 text-sm text-slate-600">
                Get a broad mix of essays across schools, types, and categories.
              </p>
            </button>

            <button
              type="button"
              onClick={startSimilar}
              className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 text-left hover:border-slate-200 transition"
            >
              <p className="text-xs uppercase font-semibold text-slate-500">Similar</p>
              <h2 className="mt-2 text-xl font-bold text-slate-900">Essays Like You</h2>
              <p className="mt-2 text-sm text-slate-600">
                Prioritize essays that match your intended major and target schools.
              </p>
            </button>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setView("menu")}
                    className="text-sm font-semibold text-slate-700 hover:text-slate-900"
                  >
                    ← Back
                  </button>
                  <button
                    type="button"
                    onClick={() => setFiltersOpen((o) => !o)}
                    className="px-3 py-1.5 rounded-full border border-slate-200 text-xs font-semibold text-slate-600 bg-white"
                  >
                    Filters
                  </button>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={startBrowse}
                    className={`flex-1 px-3 py-2 rounded-xl text-sm font-semibold border ${
                      view === "browse"
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-slate-700 border-slate-200"
                    }`}
                  >
                    Browse
                  </button>
                  <button
                    type="button"
                    onClick={startSimilar}
                    className={`flex-1 px-3 py-2 rounded-xl text-sm font-semibold border ${
                      view === "similar"
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-slate-700 border-slate-200"
                    }`}
                  >
                    Similar
                  </button>
                </div>
              </div>

              {filtersOpen && (
                <FilterPanel
                  allTypes={allTypes}
                  enabledTypes={enabledTypes}
                  allCategories={allCategories}
                  enabledCategories={enabledCategories}
                  onToggleType={onToggleType}
                  onToggleCategory={onToggleCategory}
                  onReset={resetFilters}
                />
              )}

              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-2 max-h-[70vh] overflow-y-auto pr-1">
                {activeList.map((e) => (
                  <button
                    key={e.essay_id}
                    type="button"
                    onClick={() => setSelectedId(e.essay_id)}
                    className={`w-full text-left p-3 rounded-xl border transition ${
                      e.essay_id === selectedId
                        ? "border-brand-secondary bg-indigo-50"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <div className="text-sm font-semibold text-slate-900 truncate">
                      {e.school || "Unknown School"}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-slate-600">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100">
                        {formatEssayType(e.type)}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-slate-100">
                        {e.category || "General"}
                      </span>
                    </div>
                  </button>
                ))}
                {activeList.length === 0 && (
                  <div className="text-sm text-slate-500">No essays match these filters.</div>
                )}
              </div>
            </div>

            <div>
              {!selectedEssay ? (
                <div className="text-sm text-slate-500">Select an essay to read.</div>
              ) : (
                <EssayDetail essay={selectedEssay} similarity={selectedSimilarity} />
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default EssaysPage;

const FilterPanel: React.FC<{
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
      active
        ? "bg-brand-secondary text-white border-brand-secondary"
        : "border-slate-200 text-slate-600 bg-white"
    }`}
  >
    {label}
  </button>
);

const Tag: React.FC<{ label: React.ReactNode; color: string }> = ({ label, color }) => (
  <span
    className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${color}`}
  >
    {label}
  </span>
);

const EssayDetail: React.FC<{
  essay: AnonymousEssayEntry;
  similarity: number | null;
}> = ({ essay, similarity }) => {
  const acceptedSchools = Array.isArray(essay.demographics?.accepted_schools)
    ? essay.demographics?.accepted_schools.filter(Boolean)
    : [];
  const guessedMajor = essay.demographics?.guessed_intended_major?.trim() || "";

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Tag
            label={essay.school || "Unknown"}
            color="bg-emerald-50 text-emerald-800 border border-emerald-200"
          />
          <Tag label={essay.year || "Year"} color="bg-blue-50 text-blue-800 border border-blue-200" />
          <Tag
            label={formatEssayType(essay.type)}
            color="bg-indigo-50 text-indigo-800 border border-indigo-200"
          />
          <Tag
            label={essay.category || "Category"}
            color="bg-amber-50 text-amber-800 border border-amber-200"
          />
          {guessedMajor && (
            <Tag
              label={`Major guess: ${guessedMajor}`}
              color="bg-slate-50 text-slate-800 border border-slate-200"
            />
          )}
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
        {acceptedSchools.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-slate-900 uppercase">Accepted To</h3>
            <p className="text-sm text-slate-600 mt-1">{acceptedSchools.join(", ")}</p>
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
  const guessedMajor = (essay.demographics?.guessed_intended_major || "").toLowerCase();
  const guessedBucket = (essay.demographics?.guessed_major_bucket || "").toLowerCase();
  const tagFields = Array.isArray(essay.demographics?.tags)
    ? essay.demographics.tags.map((tag) => String(tag).toLowerCase())
    : [];
  const acceptedSchools = Array.isArray(essay.demographics?.accepted_schools)
    ? essay.demographics.accepted_schools.map((school) => String(school).toLowerCase())
    : [(essay.school || "").toLowerCase()];
  const majors = (studentProfile.majors || [])
    .map((major) => extractMajorLabel(major).toLowerCase())
    .filter((label) => label.length > 0);

  if (majors.length) {
    const comparisonFields = [
      normalizedCategory,
      (essay.question || "").toLowerCase(),
      (essay.type || "").toLowerCase(),
      guessedMajor,
      guessedBucket,
      ...tagFields,
    ];
    const match = majors.some((major) => comparisonFields.some((field) => field.includes(major)));
    if (match) score += 2;
  }

  if (targetSchools.length) {
    const match = targetSchools.some((school) => {
      const normalizedSchool = school.toLowerCase();
      return acceptedSchools.some((accepted) => accepted.includes(normalizedSchool));
    });
    if (match) score += 1;
  }

  if ((essay.type || "").toLowerCase().includes("common")) {
    score += 0.5;
  }

  return Math.min(5, Math.max(1, score));
}
