import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  getAllInstitutions,
  getInstitutionTestScoreMap,
  getUndergradDemographicsMap,
  getLocationTypeMap,
  getMajorsMeta,
  getMajorsByInstitution,
  getTopUnitIdsByApplicants,
} from "../data/api";
import { categorizeTestPolicy } from "../utils/admissionsModel";
import {
  buildMajorAreaOptions,
  buildSpecificMajorOptions,
  cleanMajorLabel,
} from "../utils/majors";
import type {
  Institution,
  InstitutionDemographics,
  InstitutionMajorsByInstitution,
  MajorsMeta,
} from "../types";
import type { InstitutionTestScores } from "../data/api";

const PAGE_SIZE = 20;
const DEMOGRAPHIC_GROUPS = [
  { key: "white", label: "White", source: ["white"], color: "#4b5563" },
  { key: "asian", label: "Asian", source: ["asian"], color: "#0ea5e9" },
  {
    key: "black",
    label: "Black",
    source: ["black_or_african_american"],
    color: "#7c3aed",
  },
  { key: "latino", label: "Latino", source: ["hispanic_or_latino"], color: "#f59e0b" },
  {
    key: "pacific",
    label: "Hawaii/Pacific",
    source: ["native_hawaiian_or_pacific_islander"],
    color: "#14b8a6",
  },
  { key: "international", label: "International", source: ["nonresident"], color: "#22c55e" },
  {
    key: "other",
    label: "Other",
    source: ["american_indian_or_alaska_native", "two_or_more_races", "unknown"],
    color: "#94a3b8",
  },
];

const TEST_POLICY_LABEL: Record<string, string> = {
  required: "Required",
  flexible: "Test flexible",
  optional: "Test optional",
  not_considered: "Test blind",
};

type BudgetBucket = "under15" | "15to25" | "25to40" | "40to60" | "over60";
type SelectivityBucket = "lottery" | "reach" | "target" | "safety" | "open";
type LocationCategory = "City" | "Suburban" | "Town" | "Rural";
type TestScoreFilter = { type: "sat" | "act"; value: number };

const STATE_NAME_BY_CODE: Record<string, string> = {
  AL: "Alabama",
  AK: "Alaska",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  DC: "District of Columbia",
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
};

type ExplorePageProps = {
  initialMajorAreas?: string[];
  initialSpecificMajors?: string[];
};

const formatCurrency = (value: number | null | undefined): string => {
  if (value == null || Number.isNaN(value)) return "N/A";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
};

const formatPercent = (value: number | null | undefined): string => {
  if (value == null || Number.isNaN(value)) return "Acceptance unknown";
  return `${Math.round(value * 100)}% Acceptance`;
};

const normalizeLocationType = (raw: string | null | undefined): LocationCategory | null => {
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (lower.includes("city")) return "City";
  if (lower.includes("suburb")) return "Suburban";
  if (lower.includes("town")) return "Town";
  if (lower.includes("rural")) return "Rural";
  return null;
};

const pickTuition = (inst: Institution): number | null => {
  return (
    inst.tuition_2023_24_in_state ??
    inst.tuition_2023_24_out_of_state ??
    inst.tuition_2023_24 ??
    null
  );
};

const matchesTuitionBucket = (tuition: number | null, bucket: BudgetBucket): boolean => {
  if (tuition == null) return false;
  switch (bucket) {
    case "under15":
      return tuition < 15000;
    case "15to25":
      return tuition >= 15000 && tuition < 25000;
    case "25to40":
      return tuition >= 25000 && tuition < 40000;
    case "40to60":
      return tuition >= 40000 && tuition < 60000;
    case "over60":
      return tuition >= 60000;
    default:
      return true;
  }
};

const selectivityBucket = (acceptance: number | null | undefined): SelectivityBucket | null => {
  if (acceptance == null) return null;
  if (acceptance < 0.1) return "lottery";
  if (acceptance < 0.25) return "reach";
  if (acceptance < 0.5) return "target";
  if (acceptance < 0.8) return "safety";
  return "open";
};

const getTestScoreMid = (
  unitid: number,
  type: "sat" | "act",
  map: Map<number, InstitutionTestScores>
): number | null => {
  const scores = map.get(unitid);
  if (!scores) return null;
  if (type === "sat") {
    const { sat_total_25, sat_total_75 } = scores;
    if (sat_total_25 != null && sat_total_75 != null) return Math.round((sat_total_25 + sat_total_75) / 2);
    return sat_total_75 ?? sat_total_25 ?? null;
  }
  const { act_composite_25, act_composite_75 } = scores;
  if (act_composite_25 != null && act_composite_75 != null) return Math.round((act_composite_25 + act_composite_75) / 2);
  return act_composite_75 ?? act_composite_25 ?? null;
};

const institutionHasMajors = (
  inst: Institution,
  majorAreas: string[],
  specificMajors: string[],
  majorsByInstitution: InstitutionMajorsByInstitution | null
): boolean => {
  if (!majorAreas.length && !specificMajors.length) return true;
  const record = majorsByInstitution?.[String(inst.unitid)];
  const twoDigit = new Set<string>();
  const detailed = new Set<string>();
  const addCodes = (arr: string[] | undefined, target: Set<string>, slice?: number) => {
    if (!Array.isArray(arr)) return;
    for (const code of arr) {
      const val = String(code).trim();
      if (!val) continue;
      target.add(slice ? val.slice(0, slice) : val);
    }
  };

  addCodes(inst.majors_cip_two_digit, twoDigit);
  addCodes(record?.two_digit, twoDigit);
  addCodes(inst.majors_cip_four_digit, detailed);
  addCodes(inst.majors_cip_six_digit, detailed);
  addCodes(record?.four_digit, detailed);
  addCodes(record?.six_digit, detailed);

  if (majorAreas.length) {
    const matchesArea = majorAreas.some((area) => twoDigit.has(area.slice(0, 2)));
    if (!matchesArea) return false;
  }

  if (specificMajors.length) {
    const matchesSpecific = specificMajors.some((code) => {
      const normalized = code.trim();
      if (normalized.includes(".")) {
        return detailed.has(normalized) || detailed.has(normalized.slice(0, 6)) || detailed.has(normalized.slice(0, 4));
      }
      return twoDigit.has(normalized.slice(0, 2));
    });
    if (!matchesSpecific) return false;
  }

  return true;
};

const buildDemographicSegments = (
  demo: InstitutionDemographics | undefined
): Array<{ key: string; label: string; percent: number; color: string }> => {
  if (!demo) return [];
  const total = demo.total_undergrad ?? 0;
  const slices = DEMOGRAPHIC_GROUPS.map((group) => {
    let percent: number | null = null;
    for (const source of group.source) {
      const match = demo.breakdown.find((b) => b.key === source);
      if (match && match.percent != null) {
        percent = (percent ?? 0) + match.percent;
      }
    }
    return {
      key: group.key,
      label: group.label,
      percent: percent ?? 0,
      color: group.color,
    };
  });
  const valid = slices.filter((s) => s.percent > 0);
  if (!valid.length && total > 0) return slices;
  return valid;
};

const filterInstitutions = (
  institutions: Institution[],
  opts: {
    search: string;
    budget: BudgetBucket | null;
    selectivity: SelectivityBucket | null;
    testPolicy: keyof typeof TEST_POLICY_LABEL | null;
    testScore: TestScoreFilter | null;
    states: string[];
    locationTypes: LocationCategory[];
    majorAreas: string[];
    specificMajors: string[];
  },
  majorsByInstitution: InstitutionMajorsByInstitution | null,
  locationMap: Map<number, string>,
  testScoreMap: Map<number, InstitutionTestScores>
): Institution[] => {
  const searchTerm = opts.search.trim().toLowerCase();
  return institutions.filter((inst) => {
    if (searchTerm.length >= 3) {
      const target = `${inst.name} ${inst.city ?? ""} ${inst.state ?? ""}`.toLowerCase();
      if (!target.includes(searchTerm)) return false;
    }

    if (opts.budget) {
      const tuition = pickTuition(inst);
      if (!matchesTuitionBucket(tuition, opts.budget)) return false;
    }

    if (opts.selectivity) {
      const bucket = selectivityBucket(inst.acceptance_rate);
      if (bucket !== opts.selectivity) return false;
    }

    if (opts.testPolicy) {
      const policy = categorizeTestPolicy(inst.test_policy);
      if (policy !== opts.testPolicy) return false;
    }

    if (opts.testScore) {
      const mid = getTestScoreMid(inst.unitid, opts.testScore.type, testScoreMap);
      if (mid == null || mid < opts.testScore.value) return false;
    }

    if (opts.states.length) {
      if (!inst.state || !opts.states.includes(inst.state)) return false;
    }

    if (opts.locationTypes.length) {
      const loc = normalizeLocationType(locationMap.get(inst.unitid));
      if (!loc || !opts.locationTypes.includes(loc)) return false;
    }

    if (!institutionHasMajors(inst, opts.majorAreas, opts.specificMajors, majorsByInstitution)) {
      return false;
    }

    return true;
  });
};

const Pill: React.FC<{
  active: boolean;
  label: string;
  onClick: () => void;
}> = ({ active, label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`px-3 py-1.5 rounded-full border text-sm transition-colors ${
      active
        ? "bg-brand-primary text-white border-brand-primary"
        : "bg-white text-slate-700 border-slate-200 hover:border-slate-300"
    }`}
  >
    {label}
  </button>
);

const ExplorePage: React.FC<ExplorePageProps> = ({
  initialMajorAreas = [],
  initialSpecificMajors = [],
}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [demographicsMap, setDemographicsMap] = useState<Map<number, InstitutionDemographics>>(new Map());
  const [testScoreMap, setTestScoreMap] = useState<Map<number, InstitutionTestScores>>(new Map());
  const [locationMap, setLocationMap] = useState<Map<number, string>>(new Map());
  const [majorsMeta, setMajorsMeta] = useState<MajorsMeta | null>(null);
  const [majorsByInstitution, setMajorsByInstitution] = useState<InstitutionMajorsByInstitution | null>(null);
  const [topApplicants, setTopApplicants] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Draft filters (user edits) and applied filters (used for results)
  const [draftBudget, setDraftBudget] = useState<BudgetBucket | null>(null);
  const [draftSelectivity, setDraftSelectivity] = useState<SelectivityBucket | null>(null);
  const [draftTestPolicy, setDraftTestPolicy] = useState<keyof typeof TEST_POLICY_LABEL | null>(null);
  const [draftTestScore, setDraftTestScore] = useState<TestScoreFilter | null>(null);
  const [draftStates, setDraftStates] = useState<string[]>([]);
  const [draftLocationTypes, setDraftLocationTypes] = useState<LocationCategory[]>([]);
  const [draftMajorAreas, setDraftMajorAreas] = useState<string[]>(initialMajorAreas);
  const [draftSpecificMajors, setDraftSpecificMajors] = useState<string[]>(initialSpecificMajors);
  const [majorAreaQuery, setMajorAreaQuery] = useState("");
  const [specificMajorQuery, setSpecificMajorQuery] = useState("");

  const [budget, setBudget] = useState<BudgetBucket | null>(null);
  const [selectivity, setSelectivity] = useState<SelectivityBucket | null>(null);
  const [testPolicy, setTestPolicy] = useState<keyof typeof TEST_POLICY_LABEL | null>(null);
  const [testScore, setTestScore] = useState<TestScoreFilter | null>(null);
  const [selectedStates, setSelectedStates] = useState<string[]>([]);
  const [locationTypes, setLocationTypes] = useState<LocationCategory[]>([]);
  const [majorAreas, setMajorAreas] = useState<string[]>(initialMajorAreas);
  const [specificMajors, setSpecificMajors] = useState<string[]>(initialSpecificMajors);
  const [page, setPage] = useState(1);

  const searchQuery = searchParams.get("q") ?? "";
  const [searchInput, setSearchInput] = useState(searchQuery);

  const applySearchQuery = useCallback((value: string) => {
    const current = searchParams.get("q") ?? "";
    if (value === current) return;

    const params = new URLSearchParams(searchParams);
    if (value) {
      params.set("q", value);
    } else {
      params.delete("q");
    }
    setSearchParams(params, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    setSearchInput(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      applySearchQuery(searchInput);
    }, 350);
    return () => {
      window.clearTimeout(handle);
    };
  }, [searchInput, applySearchQuery]);

  useEffect(() => {
    setMajorAreas(initialMajorAreas);
    setSpecificMajors(initialSpecificMajors);
    setDraftMajorAreas(initialMajorAreas);
    setDraftSpecificMajors(initialSpecificMajors);
  }, [initialMajorAreas, initialSpecificMajors]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const [all, demoMap, testMap, locMap, meta, majors, topIds] = await Promise.all([
          getAllInstitutions(),
          getUndergradDemographicsMap(),
          getInstitutionTestScoreMap(),
          getLocationTypeMap(),
          getMajorsMeta().catch(() => null),
          getMajorsByInstitution().catch(() => null),
          getTopUnitIdsByApplicants(100).catch(() => []),
        ]);
        if (cancelled) return;
        setInstitutions(all);
        setDemographicsMap(demoMap);
        setTestScoreMap(testMap);
        setLocationMap(locMap);
        setMajorsMeta(meta);
        setMajorsByInstitution(majors);
        setTopApplicants(topIds);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Failed to load colleges");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, budget, selectivity, testPolicy, testScore, selectedStates, locationTypes, majorAreas, specificMajors]);

  const majorAreaOptions = useMemo(() => buildMajorAreaOptions(majorsMeta), [majorsMeta]);
  const specificMajorOptions = useMemo(() => buildSpecificMajorOptions(majorsMeta), [majorsMeta]);

  const stateOptions = useMemo(() => {
    const set = new Set<string>();
    institutions.forEach((inst) => {
      const code = inst.state ? String(inst.state).toUpperCase() : "";
      if (code && STATE_NAME_BY_CODE[code]) {
        set.add(code);
      }
    });
    return Array.from(set).sort((a, b) =>
      STATE_NAME_BY_CODE[a].localeCompare(STATE_NAME_BY_CODE[b])
    );
  }, [institutions]);

  const filteredMajorAreaOptions = useMemo(() => {
    const q = majorAreaQuery.trim().toLowerCase();
    if (!q) return majorAreaOptions;
    return majorAreaOptions.filter((opt) => opt.label.toLowerCase().includes(q));
  }, [majorAreaOptions, majorAreaQuery]);

  const filteredSpecificMajorOptions = useMemo(() => {
    const q = specificMajorQuery.trim().toLowerCase();
    if (!q) return specificMajorOptions;
    return specificMajorOptions.filter((opt) => opt.label.toLowerCase().includes(q));
  }, [specificMajorOptions, specificMajorQuery]);

  const locationTypeOptions = useMemo(() => {
    const set = new Set<LocationCategory>();
    locationMap.forEach((value) => {
      const norm = normalizeLocationType(value);
      if (norm) set.add(norm);
    });
    return Array.from(set).sort();
  }, [locationMap]);

  const orderedInstitutions = useMemo(() => {
    const order = new Map<number, number>();
    topApplicants.forEach((id, idx) => order.set(id, idx));
    return [...institutions].sort((a, b) => {
      const aRank = order.get(a.unitid);
      const bRank = order.get(b.unitid);
      if (aRank != null || bRank != null) {
        return (aRank ?? Number.POSITIVE_INFINITY) - (bRank ?? Number.POSITIVE_INFINITY);
      }
      const aAcc = a.acceptance_rate ?? 0;
      const bAcc = b.acceptance_rate ?? 0;
      return bAcc - aAcc;
    });
  }, [institutions, topApplicants]);

  const filteredInstitutions = useMemo(() => {
    return filterInstitutions(
      orderedInstitutions,
      {
        search: searchQuery,
        budget,
        selectivity,
        testPolicy,
        testScore,
        states: selectedStates,
        locationTypes,
        majorAreas,
        specificMajors,
      },
      majorsByInstitution,
      locationMap,
      testScoreMap
    );
  }, [orderedInstitutions, searchQuery, budget, selectivity, testPolicy, testScore, selectedStates, locationTypes, majorAreas, specificMajors, majorsByInstitution, locationMap, testScoreMap]);

  const totalPages = Math.max(1, Math.ceil(filteredInstitutions.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const startIdx = (currentPage - 1) * PAGE_SIZE;
  const visibleInstitutions = filteredInstitutions.slice(startIdx, startIdx + PAGE_SIZE);

  const handleApplyFilters = () => {
    setBudget(draftBudget);
    setSelectivity(draftSelectivity);
    setTestPolicy(draftTestPolicy);
    setTestScore(draftTestScore);
    setSelectedStates(draftStates);
    setLocationTypes(draftLocationTypes);
    setMajorAreas(draftMajorAreas);
    setSpecificMajors(draftSpecificMajors);
    setPage(1);
  };

  const resetFilters = () => {
    setDraftBudget(null);
    setDraftSelectivity(null);
    setDraftTestPolicy(null);
    setDraftTestScore(null);
    setDraftStates([]);
    setDraftLocationTypes([]);
    setDraftMajorAreas(initialMajorAreas);
    setDraftSpecificMajors(initialSpecificMajors);
    setBudget(null);
    setSelectivity(null);
    setTestPolicy(null);
    setTestScore(null);
    setSelectedStates([]);
    setLocationTypes([]);
    setMajorAreas(initialMajorAreas);
    setSpecificMajors(initialSpecificMajors);
    setSearchParams(new URLSearchParams(), { replace: true });
    setSearchInput("");
    setPage(1);
  };

  const renderDemographicsBar = (unitid: number) => {
    const segments = buildDemographicSegments(demographicsMap.get(unitid));
    if (!segments.length) return null;
    const total = segments.reduce((sum, s) => sum + s.percent, 0) || 100;
    return (
      <div className="mt-3">
        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden flex">
          {segments.map((seg) => (
            <div
              key={seg.key}
              style={{ width: `${Math.max(2, (seg.percent / total) * 100)}%`, backgroundColor: seg.color }}
              className="h-full"
              title={`${seg.label}: ${seg.percent.toFixed(1)}%`}
            />
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-600">
          {segments.map((seg) => (
            <span key={seg.key} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-50 border border-slate-200">
              <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: seg.color }}></span>
              {seg.label}
            </span>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="py-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 space-y-4">
            <div className="space-y-2">
              <label htmlFor="college-search" className="text-sm font-semibold text-slate-700">
                Search colleges
              </label>
              <input
                id="college-search"
                name="college-search"
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") applySearchQuery(searchInput);
                }}
                onBlur={() => applySearchQuery(searchInput)}
                placeholder="Type at least 3 letters to search"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/30"
              />
            </div>

            <details className="space-y-2">
              <summary className="cursor-pointer text-xs uppercase font-semibold text-slate-500">
                Tuition Budget (per year)
              </summary>
              <div className="flex flex-wrap gap-2">
                {[
                  { key: "under15", label: "Under $15k" },
                  { key: "15to25", label: "$15k-$25k" },
                  { key: "25to40", label: "$25k-$40k" },
                  { key: "40to60", label: "$40k-$60k" },
                  { key: "over60", label: "$60k+" },
                ].map((opt) => (
                  <Pill
                    key={opt.key}
                    active={draftBudget === opt.key}
                    label={opt.label}
                    onClick={() => setDraftBudget(draftBudget === opt.key ? null : (opt.key as BudgetBucket))}
                  />
                ))}
              </div>
            </details>

            <details className="space-y-2">
              <summary className="cursor-pointer text-xs uppercase font-semibold text-slate-500">
                Selectivity
              </summary>
              <div className="flex flex-wrap gap-2">
                {[
                  { key: "lottery", label: "<10%" },
                  { key: "reach", label: "10-24%" },
                  { key: "target", label: "25-49%" },
                  { key: "safety", label: "50-79%" },
                  { key: "open", label: "80%+" },
                ].map((opt) => (
                  <Pill
                    key={opt.key}
                    active={draftSelectivity === opt.key}
                    label={opt.label}
                    onClick={() =>
                      setDraftSelectivity(draftSelectivity === opt.key ? null : (opt.key as SelectivityBucket))
                    }
                  />
                ))}
              </div>
            </details>

            <details className="space-y-2">
              <summary className="cursor-pointer text-xs uppercase font-semibold text-slate-500">
                Testing expectations
              </summary>
              <div className="flex flex-wrap gap-2">
                {[
                  { key: "required", label: "Required" },
                  { key: "flexible", label: "Flexible" },
                  { key: "optional", label: "Optional" },
                  { key: "not_considered", label: "Test blind" },
                ].map((opt) => (
                  <Pill
                    key={opt.key}
                    active={draftTestPolicy === opt.key}
                    label={opt.label}
                    onClick={() =>
                      setDraftTestPolicy(
                        draftTestPolicy === opt.key ? null : (opt.key as keyof typeof TEST_POLICY_LABEL)
                      )
                    }
                  />
                ))}
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-500">Test score floor</label>
                <div className="flex items-center gap-2 text-sm flex-wrap">
                  <Pill
                    active={draftTestScore?.type === "sat"}
                    label="SAT"
                    onClick={() =>
                      setDraftTestScore(
                        draftTestScore?.type === "sat"
                          ? null
                          : { type: "sat", value: draftTestScore?.value ?? 1300 }
                      )
                    }
                  />
                  <Pill
                    active={draftTestScore?.type === "act"}
                    label="ACT"
                    onClick={() =>
                      setDraftTestScore(
                        draftTestScore?.type === "act"
                          ? null
                          : { type: "act", value: draftTestScore?.value ?? 28 }
                      )
                    }
                  />
                  <input
                    id="score-min"
                    name="score-min"
                    type="number"
                    min={draftTestScore?.type === "act" ? 10 : 600}
                    max={draftTestScore?.type === "act" ? 36 : 1600}
                    value={draftTestScore?.value ?? ""}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      if (!draftTestScore?.type) return;
                      if (Number.isNaN(val)) {
                        setDraftTestScore(null);
                      } else {
                        setDraftTestScore({ type: draftTestScore.type, value: val });
                      }
                    }}
                    placeholder={draftTestScore?.type === "act" ? "ACT" : "SAT"}
                    className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-sm focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/40"
                  />
                  <button
                    type="button"
                    className="text-xs text-brand-primary underline"
                    onClick={() => setDraftTestScore(null)}
                  >
                    Clear
                  </button>
                </div>
              </div>
            </details>

            <details className="space-y-2">
              <summary className="cursor-pointer text-xs uppercase font-semibold text-slate-500">
                State
              </summary>
              <div className="flex flex-wrap gap-2 max-h-48 overflow-auto pr-1">
                {stateOptions.map((code) => {
                  const active = draftStates.includes(code);
                  return (
                    <Pill
                      key={code}
                      active={active}
                      label={`${STATE_NAME_BY_CODE[code]} (${code})`}
                      onClick={() =>
                        setDraftStates((prev) =>
                          prev.includes(code)
                            ? prev.filter((v) => v !== code)
                            : [...prev, code]
                        )
                      }
                    />
                  );
                })}
              </div>
            </details>

            <details className="space-y-3">
              <summary className="cursor-pointer text-xs uppercase font-semibold text-slate-500">
                Majors
              </summary>
              <div>
                <p className="text-xs font-semibold text-slate-500">Major area</p>
                <input
                  id="major-area-search"
                  name="major-area-search"
                  type="search"
                  value={majorAreaQuery}
                  onChange={(e) => setMajorAreaQuery(e.target.value)}
                  placeholder="Search major areas..."
                  className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm mb-2 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/40"
                />
                <div className="flex flex-wrap gap-2 max-h-40 overflow-auto pr-1">
                  {filteredMajorAreaOptions.map((opt) => {
                    const active = draftMajorAreas.includes(opt.code);
                    return (
                      <Pill
                        key={opt.code}
                        active={active}
                        label={cleanMajorLabel(opt.label)}
                        onClick={() =>
                          setDraftMajorAreas((prev) =>
                            prev.includes(opt.code)
                              ? prev.filter((v) => v !== opt.code)
                              : [...prev, opt.code]
                          )
                        }
                      />
                    );
                  })}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500">Specific majors</p>
                <input
                  id="specific-major-search"
                  name="specific-major-search"
                  type="search"
                  value={specificMajorQuery}
                  onChange={(e) => setSpecificMajorQuery(e.target.value)}
                  placeholder="Search majors..."
                  className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm mb-2 focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/40"
                />
                <div className="flex flex-wrap gap-2 max-h-40 overflow-auto pr-1">
                  {filteredSpecificMajorOptions.map((opt) => {
                    const active = draftSpecificMajors.includes(opt.code);
                    return (
                      <Pill
                        key={opt.code}
                        active={active}
                        label={cleanMajorLabel(opt.label)}
                        onClick={() =>
                          setDraftSpecificMajors((prev) =>
                            prev.includes(opt.code)
                              ? prev.filter((v) => v !== opt.code)
                              : [...prev, opt.code]
                          )
                        }
                      />
                    );
                  })}
                </div>
              </div>
            </details>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={handleApplyFilters}
                className="w-full rounded-lg bg-brand-primary text-white px-3 py-2 text-sm font-semibold hover:bg-brand-primary/90"
              >
                Apply filters
              </button>
              <button
                type="button"
                onClick={resetFilters}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Reset filters
              </button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-9 space-y-4">
          <div className="flex items-center justify-end">
            <div className="text-sm text-slate-600">Showing {visibleInstitutions.length} of {filteredInstitutions.length} result(s)</div>
          </div>

          {loading ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 text-slate-700">
              Loading universities...
            </div>
          ) : error ? (
            <div className="bg-white rounded-2xl border border-red-200 shadow-sm p-6 text-red-700">
              {error}
            </div>
          ) : visibleInstitutions.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center text-slate-600">
              No universities found. Try adjusting filters.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {visibleInstitutions.map((inst) => {
                const policy = categorizeTestPolicy(inst.test_policy);
                const tuition = pickTuition(inst);
                const acceptanceLabel = formatPercent(inst.acceptance_rate);
                const testPolicyLabel = TEST_POLICY_LABEL[policy] ?? inst.test_policy;
                const location = [inst.city, inst.state].filter(Boolean).join(", ");
                return (
                  <div
                    key={inst.unitid}
                    className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col h-full hover:border-brand-primary/40 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-semibold text-slate-900 leading-tight">{inst.name}</h3>
                          <p className="text-sm text-slate-600">{location || "Location unavailable"}</p>
                        </div>
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                          {inst.control || ""}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                        <span className="inline-flex items-center px-2 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-semibold">
                          {acceptanceLabel}
                        </span>
                        <span className="inline-flex items-center px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                          {formatCurrency(tuition)}
                        </span>
                        <span className="inline-flex items-center px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-semibold">
                          {testPolicyLabel}
                        </span>
                      </div>
                      {renderDemographicsBar(inst.unitid)}
                    </div>
                    <div className="mt-4">
                      <Link
                        to={`/institution/${inst.unitid}`}
                        className="inline-flex w-full items-center justify-center rounded-lg bg-brand-primary text-white font-semibold py-2 hover:bg-brand-primary/90"
                      >
                        View Details
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!loading && filteredInstitutions.length > PAGE_SIZE && (
            <div className="flex items-center justify-between text-sm text-slate-700">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white disabled:opacity-60"
              >
                Previous
              </button>
              <span>
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white disabled:opacity-60"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExplorePage;
