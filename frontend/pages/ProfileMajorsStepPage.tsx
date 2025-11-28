import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useOnboardingGuard } from "../hooks/useOnboardingGuard";
import { useOnboardingContext } from "../context/OnboardingContext";
import { getAllInstitutions, type Institution } from "../data/api";

const ProfileMajorsStepPage: React.FC = () => {
  const loading = useOnboardingGuard(7);
  const { setOnboardingStepRemote, studentProfile } = useOnboardingContext();
  const [allInstitutions, setAllInstitutions] = useState<Institution[] | null>(null);
  const [selectedMajors, setSelectedMajors] = useState<string[]>(studentProfile.majors ?? []);
  const [majorQuery, setMajorQuery] = useState("");
  const [localLoading, setLocalLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    (async () => {
      setLocalLoading(true);
      try {
        const inst = await getAllInstitutions();
        if (!cancelled) setAllInstitutions(inst);
      } catch {
        if (!cancelled) setAllInstitutions([]);
      } finally {
        if (!cancelled) setLocalLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loading]);

  const majorOptions = useMemo(() => {
    if (!allInstitutions) return [];
    const set = new Set<string>();
    allInstitutions.forEach((i) => {
      (i.major_families || []).forEach((m) => {
        if (typeof m === "string" && m.trim()) set.add(m.trim());
      });
    });
    const list = Array.from(set).sort((a, b) => a.localeCompare(b));
    const q = majorQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter((m) => m.toLowerCase().includes(q));
  }, [allInstitutions, majorQuery]);

  if (loading) {
    return (
      <div className="max-w-xl mx-auto text-center py-12">
        <p className="text-gray-600 text-sm">Loading...</p>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedMajors.length === 0) return;
    await setOnboardingStepRemote(7, { majors: selectedMajors });
    navigate("/profile/targets");
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white p-6 md:p-8 rounded-lg shadow-xl">
        <h1 className="text-2xl font-bold text-slate-900 mb-4">Step 7 of 8: Intended Majors</h1>
        <p className="text-sm text-slate-600 mb-4">
          Choose up to 3 majors or fields you are considering. We will use this to tailor university
          recommendations, but you can still pick any schools on the next step.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Search and select majors (up to 3)
            </label>
            <input
              type="search"
              value={majorQuery}
              onChange={(e) => setMajorQuery(e.target.value)}
              placeholder="Search majors..."
              className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-ivy-800 outline-none text-sm"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {localLoading && <span className="text-xs text-slate-500">Loading majors...</span>}
            {!localLoading &&
              majorOptions.slice(0, 60).map((major) => {
                const selected = selectedMajors.includes(major);
                return (
                  <button
                    key={major}
                    type="button"
                    onClick={() => {
                      setSelectedMajors((prev) => {
                        if (prev.includes(major)) {
                          return prev.filter((m) => m !== major);
                        }
                        if (prev.length >= 3) return prev;
                        return [...prev, major];
                      });
                    }}
                    className={`px-3 py-1.5 rounded-full border text-xs transition ${
                      selected
                        ? "bg-brand-primary text-white border-brand-primary"
                        : "bg-white text-slate-700 border-slate-300 hover:border-brand-secondary"
                    }`}
                  >
                    {major}
                  </button>
                );
              })}
          </div>
          {majorOptions.length > 60 && (
            <p className="text-[11px] text-slate-500">
              Showing top matches. Use search to find more majors.
            </p>
          )}

          {selectedMajors.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedMajors.map((m) => (
                <span
                  key={m}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-brand-light text-brand-dark text-xs"
                >
                  {m}
                  <button
                    type="button"
                    className="text-red-600"
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

