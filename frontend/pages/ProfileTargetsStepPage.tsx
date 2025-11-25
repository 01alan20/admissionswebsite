import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useOnboardingGuard } from "../hooks/useOnboardingGuard";
import { useOnboardingContext } from "../context/OnboardingContext";
import {
  getInstitutionIndex,
  getAllInstitutions,
  getLocationTypeMap,
  type InstitutionIndex,
  type Institution,
} from "../data/api";

const ProfileTargetsStepPage: React.FC = () => {
  const loading = useOnboardingGuard(7);
  const { setOnboardingStepRemote, setTargetUnitIds } = useOnboardingContext();
  const [index, setIndex] = useState<InstitutionIndex[]>([]);
  const [allInstitutions, setAllInstitutions] = useState<Institution[] | null>(null);
  const [locationMap, setLocationMap] = useState<Map<number, string> | null>(null);
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [localLoading, setLocalLoading] = useState(false);

  const [budget, setBudget] = useState<string[]>([]);
  const [selectivity, setSelectivity] = useState<string[]>([]);
  const [testPolicy, setTestPolicy] = useState<string[]>([]);
  const [locationTypes, setLocationTypes] = useState<string[]>([]);
  const [stateQuery, setStateQuery] = useState("");
  const [selectedStates, setSelectedStates] = useState<string[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    (async () => {
      setLocalLoading(true);
      try {
        const [idx, inst, locMap] = await Promise.all([
          getInstitutionIndex(),
          getAllInstitutions(),
          getLocationTypeMap(),
        ]);
        if (!cancelled) {
          // Fallback: if the compact index fails or is empty but we have full
          // institution records, synthesize an index from those so onboarding
          // still works even if /data/institutions_index.json is missing.
          const effectiveIndex =
            idx && idx.length > 0 && Array.isArray(idx)
              ? idx
              : inst.map((d) => ({
                  unitid: d.unitid,
                  name: d.name,
                  city: d.city,
                  state: d.state,
                }));

          setIndex(effectiveIndex);
          setAllInstitutions(inst);
          setLocationMap(locMap);
        }
      } catch (_err) {
        // ignore for now
      } finally {
        if (!cancelled) setLocalLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loading]);

  // State helpers (reuse logic from ExplorePage)
  const STATE_NAMES: Record<string, string> = {
    AL: "Alabama",
    AK: "Alaska",
    AZ: "Arizona",
    AR: "Arkansas",
    CA: "California",
    CO: "Colorado",
    CT: "Connecticut",
    DE: "Delaware",
    FL: "Florida",
    GA: "Georgia",
    HI: "Hawaii",
    ID: "Idaho",
    IL: "Illinois",
    IN: "Indiana",
    IA: "Iowa",
    KS: "Kansas",
    KY: "Kentucky",
    LA: "Louisiana",
    ME: "Maine",
    MD: "Maryland",
    MA: "Massachusetts",
    MI: "Michigan",
    MN: "Minnesota",
    MS: "Mississippi",
    MO: "Missouri",
    MT: "Montana",
    NE: "Nebraska",
    NV: "Nevada",
    NH: "New Hampshire",
    NJ: "New Jersey",
    NM: "New Mexico",
    NY: "New York",
    NC: "North Carolina",
    ND: "North Dakota",
    OH: "Ohio",
    OK: "Oklahoma",
    OR: "Oregon",
    PA: "Pennsylvania",
    RI: "Rhode Island",
    SC: "South Carolina",
    SD: "South Dakota",
    TN: "Tennessee",
    TX: "Texas",
    UT: "Utah",
    VT: "Vermont",
    VA: "Virginia",
    WA: "Washington",
    WV: "West Virginia",
    WI: "Wisconsin",
    WY: "Wyoming",
    DC: "District of Columbia",
    PR: "Puerto Rico",
    GU: "Guam",
    AS: "American Samoa",
    MP: "Northern Mariana Islands",
    VI: "U.S. Virgin Islands",
  };

  const toFullStateName = (value?: string | null): string => {
    if (!value) return "";
    const v = value.trim();
    if (!v) return "";
    if (v.length === 2) {
      return STATE_NAMES[v.toUpperCase()] || v;
    }
    return v;
  };

  const allStates = useMemo(() => {
    const set = new Set<string>();
    for (const i of index) {
      const full = toFullStateName(i.state);
      if (full) set.add(full);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [index]);

  const stateSuggestions = useMemo(() => {
    const q = stateQuery.trim().toLowerCase();
    if (!q) return allStates.slice(0, 50);
    return allStates.filter((s) => s.toLowerCase().includes(q)).slice(0, 50);
  }, [stateQuery, allStates]);

  const toggleFromList = (curr: string[], value: string) =>
    curr.includes(value) ? curr.filter((v) => v !== value) : [...curr, value];

  const handleBudgetChange = (value: string) =>
    setBudget((b) => toggleFromList(b, value));
  const handleSelectivityChange = (value: string) =>
    setSelectivity((s) => toggleFromList(s, value));
  const handleTestPolicyChange = (value: string) =>
    setTestPolicy((t) => toggleFromList(t, value));

  const filteredIdSet = useMemo<Set<number> | null>(() => {
    if (!allInstitutions) return null;
    let results = allInstitutions.slice();

    if (budget.length > 0) {
      results = results.filter((inst) => {
        const tuition =
          inst.tuition_2023_24_out_of_state ??
          inst.tuition_2023_24_in_state ??
          inst.tuition_2023_24;
        if (tuition == null) return false;
        return budget.some((b) => {
          if (b === "0-10000") return tuition < 10000;
          if (b === "10000-20000") return tuition >= 10000 && tuition < 20000;
          if (b === "20000-30000") return tuition >= 20000 && tuition < 30000;
          if (b === "30000-40000") return tuition >= 30000 && tuition < 40000;
          if (b === "40000-50000") return tuition >= 40000 && tuition < 50000;
          if (b === "50000-60000") return tuition >= 50000 && tuition < 60000;
          if (b === "60000-70000") return tuition >= 60000 && tuition < 70000;
          if (b === "70000+") return tuition >= 70000;
          return false;
        });
      });
    }

    if (selectivity.length > 0) {
      results = results.filter((inst) => {
        const rate = inst.acceptance_rate;
        if (rate == null) return false;
        return selectivity.some((s) => {
          if (s === "selective") return rate < 0.1;
          if (s === "reach") return rate >= 0.1 && rate < 0.25;
          if (s === "target") return rate >= 0.25 && rate < 0.5;
          if (s === "balanced") return rate >= 0.5 && rate < 0.7;
          if (s === "safety") return rate >= 0.7 && rate < 0.91;
          if (s === "supersafe") return rate >= 0.91;
          return false;
        });
      });
    }

    if (testPolicy.length > 0) {
      results = results.filter((inst) => {
        const policy = (inst.test_policy || "").toLowerCase();
        return testPolicy.some((tp) => {
          if (tp === "optional")
            return policy.includes("optional") || policy.includes("flexible");
          if (tp === "required") return policy.includes("required");
          if (tp === "notconsidered") return policy.includes("not considered");
          return false;
        });
      });
    }

    if (selectedStates.length > 0) {
      const set = new Set(selectedStates.map((s) => s.toLowerCase()));
      results = results.filter((inst) =>
        set.has(toFullStateName(inst.state).toLowerCase())
      );
    }

    if (locationTypes.length > 0 && locationMap) {
      const typeSet = new Set(locationTypes);
      const normalizeLocationType = (raw: string | null | undefined): string | null => {
        if (!raw) return null;
        const v = raw.trim().toLowerCase();
        if (!v) return null;
        if (v.startsWith("city")) return "city";
        if (v.startsWith("suburb")) return "suburban";
        if (v.startsWith("town")) return "town";
        if (v.startsWith("rural")) return "rural";
        return null;
      };

      results = results.filter((inst) => {
        const rawLoc = locationMap.get(inst.unitid);
        const normalized = normalizeLocationType(rawLoc);
        if (!normalized) return false;
        return typeSet.has(normalized);
      });
    }

    return new Set(results.map((r) => r.unitid));
  }, [allInstitutions, budget, selectivity, testPolicy, selectedStates, locationTypes, locationMap]);

  const results = useMemo<Institution[]>(() => {
    if (!allInstitutions) return [];
    const q = query.trim().toLowerCase();

    // Start from full institutions list, then apply the unitid set produced by
    // the filter pipeline above (tuition, selectivity, test policy, state, location).
    let base = allInstitutions;
    if (filteredIdSet) {
      base = base.filter((inst) => filteredIdSet.has(inst.unitid));
    }

    if (!q) return base.slice(0, 50);

    const filtered = base.filter((inst) => {
      const hay = `${inst.name ?? ""} ${inst.city ?? ""} ${inst.state ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
    return filtered.slice(0, 50);
  }, [allInstitutions, query, filteredIdSet]);

  if (loading) {
    return (
      <div className="max-w-xl mx-auto text-center py-12">
        <p className="text-gray-600 text-sm">Loading…</p>
      </div>
    );
  }

  const toggleSelect = (unitid: number) => {
    setSelectedIds((prev) => {
      if (prev.includes(unitid)) {
        return prev.filter((id) => id !== unitid);
      }
      if (prev.length >= 3) return prev;
      return [...prev, unitid];
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIds.length === 0) return;
    await setOnboardingStepRemote(6);
    setTargetUnitIds(selectedIds);
    navigate("/profile/dashboard");
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="bg-white p-6 md:p-8 rounded-lg shadow-xl">
        <h1 className="text-2xl font-bold text-slate-900 mb-4">
          Step 7 of 7: Target Universities
        </h1>
        <p className="text-sm text-slate-600 mb-4">
          Choose up to 3 universities you care most about. We&apos;ll use these as the
          focus for your admissions strategy.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-6 md:grid-cols-[260px,1fr]">
            <aside className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Search universities
                </label>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Start typing a university name, city, or state..."
                  className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-ivy-800 outline-none text-sm"
                />
              </div>

              <details className="border rounded-md">
                <summary className="cursor-pointer px-3 py-2 text-sm font-semibold">
                  Tuition Budget (per year)
                </summary>
                <div className="px-3 py-2 space-y-2">
                  {[
                    { value: "0-10000", label: "< $10k" },
                    { value: "10000-20000", label: "$10k - $20k" },
                    { value: "20000-30000", label: "$20k - $30k" },
                    { value: "30000-40000", label: "$30k - $40k" },
                    { value: "40000-50000", label: "$40k - $50k" },
                    { value: "50000-60000", label: "$50k - $60k" },
                    { value: "60000-70000", label: "$60k - $70k" },
                    { value: "70000+", label: "$70k+" },
                  ].map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => handleBudgetChange(value)}
                      className={`w-full text-left px-3 py-2 rounded border text-xs ${
                        budget.includes(value)
                          ? "bg-brand-light border-brand-secondary"
                          : "bg-white border-gray-300"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </details>

              <details className="border rounded-md">
                <summary className="cursor-pointer px-3 py-2 text-sm font-semibold">
                  Selectivity
                </summary>
                <div className="px-3 py-2 space-y-2">
                  {[
                    { value: "selective", label: "Selective (<10%)" },
                    { value: "reach", label: "Reach (10% - 25%)" },
                    { value: "target", label: "Target (25% - 49%)" },
                    { value: "balanced", label: "Balanced (50% - 69%)" },
                    { value: "safety", label: "Safety (70% - 90%)" },
                    { value: "supersafe", label: "Super Safe (91%+)" },
                  ].map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => handleSelectivityChange(value)}
                      className={`w-full text-left px-3 py-2 rounded border text-xs ${
                        selectivity.includes(value)
                          ? "bg-brand-light border-brand-secondary"
                          : "bg-white border-gray-300"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </details>

              <details className="border rounded-md">
                <summary className="cursor-pointer px-3 py-2 text-sm font-semibold">
                  Testing Expectations
                </summary>
                <div className="px-3 py-2 space-y-2">
                  {[
                    { value: "optional", label: "Test Optional" },
                    { value: "required", label: "Test Required" },
                    { value: "notconsidered", label: "Test Not Considered" },
                  ].map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => handleTestPolicyChange(value)}
                      className={`w-full text-left px-3 py-2 rounded border text-xs ${
                        testPolicy.includes(value)
                          ? "bg-brand-light border-brand-secondary"
                          : "bg-white border-gray-300"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </details>

              <details className="border rounded-md">
                <summary className="cursor-pointer px-3 py-2 text-sm font-semibold">
                  State
                </summary>
                <div className="px-3 py-2 space-y-2">
                  <input
                    type="search"
                    value={stateQuery}
                    onChange={(e) => setStateQuery(e.target.value)}
                    placeholder="Search state..."
                    className="w-full p-2 border border-gray-300 rounded-md text-sm"
                  />
                  {stateSuggestions.length > 0 && (
                    <ul className="border border-gray-200 rounded-md divide-y max-h-60 overflow-auto">
                      {stateSuggestions.map((s) => (
                        <li key={s}>
                          <button
                            type="button"
                            className="w-full text-left px-3 py-1.5 hover:bg-brand-light text-xs"
                            onClick={() => {
                              if (!selectedStates.includes(s))
                                setSelectedStates((prev) => [...prev, s]);
                              setStateQuery("");
                            }}
                          >
                            {s}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {selectedStates.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {selectedStates.map((s) => (
                        <span
                          key={s}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-brand-light text-brand-dark rounded-full text-[11px]"
                        >
                          {s}
                          <button
                            type="button"
                            className="text-red-600"
                            onClick={() =>
                              setSelectedStates(selectedStates.filter((x) => x !== s))
                            }
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </details>

              <details className="border rounded-md">
                <summary className="cursor-pointer px-3 py-2 text-sm font-semibold">
                  Location Type
                </summary>
                <div className="px-3 py-2 space-y-2">
                  {[
                    { value: "city", label: "City" },
                    { value: "suburban", label: "Suburban" },
                    { value: "town", label: "Town" },
                    { value: "rural", label: "Rural" },
                  ].map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() =>
                        setLocationTypes((curr) =>
                          curr.includes(value)
                            ? curr.filter((v) => v !== value)
                            : [...curr, value]
                        )
                      }
                      className={`w-full text-left px-3 py-2 rounded border text-xs ${
                        locationTypes.includes(value)
                          ? "bg-brand-light border-brand-secondary"
                          : "bg-white border-gray-300"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </details>
            </aside>

            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
              {localLoading && (
                <p className="text-sm text-slate-500">Loading universities…</p>
              )}
              {!localLoading &&
                results.map((inst) => {
                  const isSelected = selectedIds.includes(inst.unitid);
                  return (
                    <button
                      type="button"
                      key={inst.unitid}
                      onClick={() => toggleSelect(inst.unitid)}
                      className={`w-full flex justify-between items-center p-4 rounded-xl border text-left transition-all ${
                        isSelected
                          ? "bg-brand-primary border-brand-primary text-white shadow-md"
                          : "bg-white border-slate-200 text-slate-800 hover:border-ivy-800"
                      }`}
                    >
                      <div>
                        <div className="font-bold">{inst.name}</div>
                        <div
                          className={`text-xs ${
                            isSelected ? "text-gray-100" : "text-slate-500"
                          }`}
                        >
                          {inst.city ?? ""}, {inst.state ?? ""}
                        </div>
                      </div>
                      {isSelected && <span className="text-xl">✓</span>}
                    </button>
                  );
                })}
              {!localLoading && results.length === 0 && (
                <p className="text-sm text-slate-500">
                  No universities match that search and filter combination yet. Try
                  adjusting your filters.
                </p>
              )}
            </div>
          </div>

          <div className="flex justify-between">
            <button
              type="button"
              onClick={() => navigate("/profile/recs")}
              className="px-6 py-2 rounded-lg font-semibold border border-brand-secondary text-brand-secondary bg-white hover:bg-brand-secondary hover:text-white transition"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={selectedIds.length === 0}
              className="px-8 py-3 bg-brand-primary text-white rounded-lg font-bold shadow-md hover:bg-brand-dark transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Finish and View Dashboard
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProfileTargetsStepPage;
