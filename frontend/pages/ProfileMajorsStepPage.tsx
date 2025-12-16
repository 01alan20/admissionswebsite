import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useOnboardingGuard } from "../hooks/useOnboardingGuard";
import { useOnboardingContext } from "../context/OnboardingContext";
import { getMajorsMeta } from "../data/api";
import type { MajorsMeta } from "../types";
import {
  buildMajorAreaOptions,
  buildSpecificMajorOptions,
  extractMajorCode,
  extractMajorLabel,
  formatMajorSelection,
  normalizeMajorSelectionList,
  type MajorOption,
} from "../utils/majors";

const MAX_SELECTED = 3;

const ProfileMajorsStepPage: React.FC = () => {
  const loading = useOnboardingGuard(7);
  const { setOnboardingStepRemote, studentProfile } = useOnboardingContext();
  const [selectedMajors, setSelectedMajors] = useState<string[]>(() => {
    const normalized = normalizeMajorSelectionList(studentProfile.majors);
    return normalized ? normalized.slice(0, MAX_SELECTED) : [];
  });
  const [majorAreaQuery, setMajorAreaQuery] = useState("");
  const [specificMajorQuery, setSpecificMajorQuery] = useState("");
  const [majorsMeta, setMajorsMeta] = useState<MajorsMeta | null>(null);
  const [loadingMajors, setLoadingMajors] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    (async () => {
      setLoadingMajors(true);
      try {
        const meta = await getMajorsMeta();
        if (!cancelled) setMajorsMeta(meta);
      } catch {
        if (!cancelled) setMajorsMeta(null);
      } finally {
        if (!cancelled) setLoadingMajors(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loading]);

  const majorAreaOptions = useMemo<MajorOption[]>(() => buildMajorAreaOptions(majorsMeta), [majorsMeta]);

  const specificMajorOptions = useMemo<MajorOption[]>(
    () => buildSpecificMajorOptions(majorsMeta),
    [majorsMeta]
  );

  const filteredMajorAreas = useMemo(() => {
    const q = majorAreaQuery.trim().toLowerCase();
    if (!q) return majorAreaOptions;
    return majorAreaOptions.filter((m) => m.label.toLowerCase().includes(q));
  }, [majorAreaQuery, majorAreaOptions]);

  const filteredSpecificMajors = useMemo(() => {
    const q = specificMajorQuery.trim().toLowerCase();
    if (!q) return specificMajorOptions;
    return specificMajorOptions.filter((m) => m.label.toLowerCase().includes(q));
  }, [specificMajorQuery, specificMajorOptions]);

  const toggleSelection = (option: MajorOption) => {
    const value = formatMajorSelection(option.code, option.label);
    setSelectedMajors((prev) => {
      const idx = prev.findIndex((entry) => extractMajorCode(entry) === option.code);
      if (idx >= 0) {
        return prev.filter((_, index) => index !== idx);
      }
      if (prev.length >= MAX_SELECTED) return prev;
      return [...prev, value];
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedMajors.length === 0) return;
    await setOnboardingStepRemote(7, { majors: selectedMajors.slice(0, MAX_SELECTED) });
    navigate("/profile/targets");
  };

  if (loading) {
    return (
      <div className="max-w-xl mx-auto text-center py-12">
        <p className="text-gray-600 text-sm">Loading...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white p-6 md:p-8 rounded-lg shadow-xl">
        <h1 className="text-2xl font-bold text-slate-900 mb-4">Step 7 of 8: Intended Majors</h1>
        <p className="text-sm text-slate-600 mb-4">
          Choose up to 3 majors or fields you are considering. We will use this to tailor university
          recommendations, but you can still pick any schools on the next step.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="border rounded-lg p-4 space-y-3">
              <div className="text-xs font-semibold text-slate-700">Major areas</div>
              <input
                type="search"
                value={majorAreaQuery}
                onChange={(e) => setMajorAreaQuery(e.target.value)}
                placeholder="Search major areas..."
                className="w-full p-2 border border-slate-300 rounded-md text-sm"
              />
              <div className="space-y-1 max-h-64 overflow-auto">
                {filteredMajorAreas.map((m) => {
                  const selected = selectedMajors.some((value) => extractMajorCode(value) === m.code);
                  return (
                    <button
                      key={m.code}
                      type="button"
                      onClick={() => toggleSelection(m)}
                      className={`w-full text-left px-3 py-1.5 rounded border text-xs ${
                        selected
                          ? "bg-brand-light border-brand-secondary text-brand-dark"
                          : "bg-white border-gray-300 hover:bg-brand-light"
                      }`}
                    >
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="border rounded-lg p-4 space-y-3">
              <div className="text-xs font-semibold text-slate-700">Specific majors</div>
              <input
                type="search"
                value={specificMajorQuery}
                onChange={(e) => setSpecificMajorQuery(e.target.value)}
                placeholder="Search specific majors..."
                className="w-full p-2 border border-slate-300 rounded-md text-sm"
              />
              <div className="space-y-1 max-h-64 overflow-auto">
                {filteredSpecificMajors.map((m) => {
                  const selected = selectedMajors.some((value) => extractMajorCode(value) === m.code);
                  return (
                    <button
                      key={m.code}
                      type="button"
                      onClick={() => toggleSelection(m)}
                      className={`w-full text-left px-3 py-1.5 rounded border text-xs ${
                        selected
                          ? "bg-brand-light border-brand-secondary text-brand-dark"
                          : "bg-white border-gray-300 hover:bg-brand-light"
                      }`}
                    >
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {loadingMajors && <p className="text-xs text-slate-500">Loading majors...</p>}

          {selectedMajors.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedMajors.slice(0, MAX_SELECTED).map((m) => (
                <span
                  key={m}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-brand-light text-brand-dark text-xs"
                >
                  {extractMajorLabel(m) || m}
                  <button
                    type="button"
                    className="text-red-600 font-bold"
                    onClick={() => setSelectedMajors((prev) => prev.filter((x) => x !== m))}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="flex justify-between pt-2">
            <button
              type="button"
              onClick={() => navigate("/profile/recs")}
              className="px-6 py-2 rounded-lg font-semibold border border-brand-secondary text-brand-secondary bg-white hover:bg-brand-secondary hover:text-white transition"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={selectedMajors.length === 0}
              className="px-8 py-3 bg-brand-primary text-white rounded-lg font-bold shadow-md hover:bg-brand-dark transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue to Universities
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProfileMajorsStepPage;
