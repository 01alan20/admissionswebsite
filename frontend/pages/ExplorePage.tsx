import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Institution, InstitutionMajorsByInstitution, MajorsMeta } from '../types';
import {
  getInstitutionIndex,
  getTopUnitIdsByApplicants,
  getInstitutionsSummariesByIds,
  getAllInstitutions,
  getMajorsMeta,
  getMajorsByInstitution,
  getLocationTypeMap,
  InstitutionIndex,
} from '../data/api';

const InstitutionCard: React.FC<{ institution: Institution }> = ({ institution }) => {
  const tuition = institution.tuition_2023_24_out_of_state ?? institution.tuition_2023_24_in_state ?? institution.tuition_2023_24;
  return (
    <div className="bg-white rounded-lg shadow-md hover:shadow-xl transition-shadow duration-300 overflow-hidden flex flex-col">
      <div className="p-6 flex-grow">
        <h3 className="text-xl font-bold text-brand-primary mb-1">{institution.name}</h3>
        <p className="text-gray-600 mb-4">{institution.city}, {institution.state}</p>
        <div className="flex flex-wrap gap-2 mb-4 text-sm">
          <span className="bg-brand-light text-brand-dark px-2 py-1 rounded-full">{institution.control}</span>
          {institution.acceptance_rate != null && (
            <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
              {(institution.acceptance_rate * 100).toFixed(0)}% Acceptance
            </span>
          )}
          {tuition != null && (
            <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full">
              ${tuition.toLocaleString()}/yr
            </span>
          )}
        </div>
        <p className="text-gray-700 text-sm line-clamp-2">
          Test Policy: {formatTestPolicy(institution.test_policy)}
        </p>
      </div>
      <div className="p-4 bg-gray-50">
        <Link
          to={`/institution/${institution.unitid}`}
          className="w-full text-center block bg-brand-secondary text-white font-semibold py-2 px-4 rounded-lg hover:bg-brand-primary transition-colors"
        >
          View Details
        </Link>
      </div>
    </div>
  );
};

const ExplorePage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [index, setIndex] = useState<InstitutionIndex[]>([]);
  const [defaultUnitIds, setDefaultUnitIds] = useState<number[]>([]);
  const [filteredUnitIds, setFilteredUnitIds] = useState<number[]>([]);
  const [displayed, setDisplayed] = useState<Institution[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const [query, setQuery] = useState(searchParams.get('q') || '');
  const pageSize = 20;
  const [page, setPage] = useState<number>(1);

  // Filters (dropdowns)
  const [budget, setBudget] = useState<string[]>([]); // tuition buckets, e.g. "0-10000", "70000+"
  const [selectivity, setSelectivity] = useState<string[]>([]); // selective, reach, target, balanced, safety, supersafe
  const [testPolicy, setTestPolicy] = useState<string[]>([]); // optional, required, notconsidered
  const [majorQuery, setMajorQuery] = useState<string>('');
  const [selectedMajors, setSelectedMajors] = useState<string[]>([]); // CIP 4-digit codes
  const [allInstitutions, setAllInstitutions] = useState<Institution[] | null>(null);
  const [majorsMeta, setMajorsMeta] = useState<MajorsMeta | null>(null);
  const [majorsByInstitution, setMajorsByInstitution] = useState<InstitutionMajorsByInstitution | null>(null);
  // State filter
  const [stateQuery, setStateQuery] = useState<string>('');
  const [selectedStates, setSelectedStates] = useState<string[]>([]);
  // Location type filter
  const [locationTypes, setLocationTypes] = useState<string[]>([]);

  // Load index and default top 10 by applicants
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [idx, top10] = await Promise.all([
          getInstitutionIndex(),
          getTopUnitIdsByApplicants(10),
        ]);
        setIndex(idx);
        setDefaultUnitIds(top10);
        setFilteredUnitIds(top10);
        setPage(1);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Apply query + filters (search only after 3+ letters)
  useEffect(() => {
    const run = async () => {
      const q = query.trim().toLowerCase();
      const hasQuery = q.length >= 3;
      const hasFilter =
        budget.length > 0 ||
        selectivity.length > 0 ||
        testPolicy.length > 0 ||
        selectedMajors.length > 0 ||
        selectedStates.length > 0 ||
        locationTypes.length > 0;

      if (!hasQuery && !hasFilter) {
        setFilteredUnitIds(defaultUnitIds);
        setPage(1);
        return;
      }

      let searchUnitIds: number[] | null = null;
      if (hasQuery && index.length > 0) {
        const matched = index
          .filter((i) => {
            const hay = `${i.name ?? ''} ${i.city ?? ''} ${i.state ?? ''}`.toLowerCase();
            return hay.includes(q);
          })
          .map((i) => i.unitid);
        searchUnitIds = matched;
      }

      let filterUnitIds: number[] | null = null;
      if (hasFilter) {
        const all = allInstitutions || await getAllInstitutions();
        if (!allInstitutions) setAllInstitutions(all);
        const locationMap = await getLocationTypeMap();
        filterUnitIds = filterInstitutions(
          all,
          budget,
          selectivity,
          testPolicy,
          selectedMajors,
          selectedStates,
          locationTypes,
          majorsByInstitution,
          locationMap,
        ).map((i) => i.unitid);
      }

      let ids: number[];
      if (searchUnitIds && filterUnitIds) {
        const set = new Set(filterUnitIds);
        ids = searchUnitIds.filter((id) => set.has(id));
      } else if (searchUnitIds) {
        ids = searchUnitIds;
      } else if (filterUnitIds) {
        ids = filterUnitIds;
      } else {
        ids = defaultUnitIds;
      }

      setFilteredUnitIds(ids);
      setPage(1);
    };
    run();
  }, [
    query,
    budget,
    selectivity,
    testPolicy,
    selectedMajors,
    selectedStates,
    locationTypes,
    index,
    defaultUnitIds,
    allInstitutions,
    majorsByInstitution,
  ]);

  // Update URL params as user types
  useEffect(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    setSearchParams(params);
  }, [query, setSearchParams]);

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(filteredUnitIds.length / pageSize));
  }, [filteredUnitIds.length]);

  // Load current page worth of institutions with request guard
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const start = (page - 1) * pageSize;
        const end = start + pageSize;
        const ids = filteredUnitIds.slice(start, end);
        if (ids.length === 0) {
          if (!cancelled) setDisplayed([]);
        } else {
          const rows = await getInstitutionsSummariesByIds(ids);
          if (!cancelled) setDisplayed(rows);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [filteredUnitIds, page]);

  const prevPage = () => setPage((p) => Math.max(1, p - 1));
  const nextPage = () => setPage((p) => Math.min(totalPages, p + 1));

  // Dropdown UI helpers
  const toggleFromList = (curr: string[], value: string) =>
    curr.includes(value) ? curr.filter((v) => v !== value) : [...curr, value];

  const handleBudgetChange = (value: string) => setBudget((b) => toggleFromList(b, value));
  const handleSelectivityChange = (value: string) => setSelectivity((s) => toggleFromList(s, value));
  const handleTestPolicyChange = (value: string) => setTestPolicy((t) => toggleFromList(t, value));

  type CipMajorOption = { code: string; title: string; label: string };

  const allMajors = useMemo<CipMajorOption[]>(() => {
    if (!majorsMeta) return [];
    const entries = Object.entries(majorsMeta.four_digit || {});
    return entries
      .map(([code, rawTitle]) => {
        const title = cleanCipTitle(rawTitle);
        return {
          code,
          title,
          label: title,
        };
      })
      .sort((a, b) => a.title.localeCompare(b.title) || a.code.localeCompare(b.code));
  }, [majorsMeta]);

  const majorSuggestions = useMemo<CipMajorOption[]>(() => {
    const q = majorQuery.trim().toLowerCase();
    if (!q || q.length < 2) return [];
    return allMajors
      .filter((m) => m.title.toLowerCase().includes(q) || m.code.toLowerCase().includes(q))
      .slice(0, 10);
  }, [majorQuery, allMajors]);

  const addMajor = (m: CipMajorOption) => {
    if (!selectedMajors.includes(m.code)) setSelectedMajors((prev) => [...prev, m.code]);
    setMajorQuery('');
  };

  // State dropdown helpers (match by full state name)
  const STATE_NAMES: Record<string, string> = {
    AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut',
    DE: 'Delaware', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
    KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan',
    MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire',
    NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
    OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota',
    TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia',
    WI: 'Wisconsin', WY: 'Wyoming', DC: 'District of Columbia', PR: 'Puerto Rico', GU: 'Guam', AS: 'American Samoa',
    MP: 'Northern Mariana Islands', VI: 'U.S. Virgin Islands',
  };

  function toFullStateName(value?: string | null): string {
    if (!value) return '';
    const v = value.trim();
    if (!v) return '';
    if (v.length === 2) {
      return STATE_NAMES[v.toUpperCase()] || v;
    }
    return v;
  }

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

  const addState = (s: string) => {
    if (!selectedStates.includes(s)) setSelectedStates((prev) => [...prev, s]);
    setStateQuery('');
  };

  return (
    <div className="flex flex-col md:flex-row gap-6">
      <aside className="w-full md:w-72">
        <div className="bg-white p-4 rounded-lg shadow-md sticky top-24 space-y-4">
          <form onSubmit={(e) => e.preventDefault()}>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type at least 3 letters to search..."
              className="w-full p-3 border border-gray-300 rounded-md focus:ring-brand-secondary focus:border-brand-secondary"
            />
          </form>

          <details className="border rounded-md">
            <summary className="cursor-pointer px-3 py-2 font-semibold">Tuition Budget (per year)</summary>
            <div className="px-3 py-2 space-y-2">
              {[
                { value: '0-10000', label: '< $10k' },
                { value: '10000-20000', label: '$10k - $20k' },
                { value: '20000-30000', label: '$20k - $30k' },
                { value: '30000-40000', label: '$30k - $40k' },
                { value: '40000-50000', label: '$40k - $50k' },
                { value: '50000-60000', label: '$50k - $60k' },
                { value: '60000-70000', label: '$60k - $70k' },
                { value: '70000+', label: '$70k+' },
              ].map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => handleBudgetChange(value)}
                  className={`w-full text-left px-3 py-2 rounded border ${
                    budget.includes(value) ? 'bg-brand-light border-brand-secondary' : 'bg-white border-gray-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </details>

          <details className="border rounded-md">
            <summary className="cursor-pointer px-3 py-2 font-semibold">Selectivity</summary>
            <div className="px-3 py-2 space-y-2">
              {[
                { value: 'selective', label: 'Selective (<10%)' },
                { value: 'reach', label: 'Reach (10% - 25%)' },
                { value: 'target', label: 'Target (25% - 49%)' },
                { value: 'balanced', label: 'Balanced (50% - 69%)' },
                { value: 'safety', label: 'Safety (70% - 90%)' },
                { value: 'supersafe', label: 'Super Safe (91%+)' },
              ].map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => handleSelectivityChange(value)}
                  className={`w-full text-left px-3 py-2 rounded border ${
                    selectivity.includes(value) ? 'bg-brand-light border-brand-secondary' : 'bg-white border-gray-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </details>

          <details className="border rounded-md">
            <summary className="cursor-pointer px-3 py-2 font-semibold">Testing Expectations</summary>
            <div className="px-3 py-2 space-y-2">
              {[
                { value: 'optional', label: 'Test Optional' },
                { value: 'required', label: 'Test Required' },
                { value: 'notconsidered', label: 'Test Not Considered' },
              ].map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => handleTestPolicyChange(value)}
                  className={`w-full text-left px-3 py-2 rounded border ${
                    testPolicy.includes(value) ? 'bg-brand-light border-brand-secondary' : 'bg-white border-gray-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </details>

          <details className="border rounded-md">
            <summary className="cursor-pointer px-3 py-2 font-semibold">State (full name)</summary>
            <div className="px-3 py-2 space-y-2">
              <input
                type="search"
                value={stateQuery}
                onChange={(e) => setStateQuery(e.target.value)}
                placeholder="Search state..."
                className="w-full p-2 border border-gray-300 rounded-md"
              />
              {stateSuggestions.length > 0 && (
                <ul className="border border-gray-200 rounded-md divide-y max-h-80 overflow-auto">
                  {stateSuggestions.map((s) => (
                    <li key={s}>
                      <button
                        className="w-full text-left px-3 py-2 hover:bg-brand-light"
                        onClick={() => addState(s)}
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
                      className="inline-flex items-center gap-2 px-2 py-1 bg-brand-light text-brand-dark rounded-full text-xs"
                    >
                      {s}
                      <button
                        className="text-red-600"
                        onClick={() => setSelectedStates(selectedStates.filter((x) => x !== s))}
                      >
                        &times;
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </details>

          <details className="border rounded-md">
            <summary className="cursor-pointer px-3 py-2 font-semibold">Location Type</summary>
            <div className="px-3 py-2 space-y-2">
              {[
                { value: 'city', label: 'City' },
                { value: 'suburban', label: 'Suburban' },
                { value: 'town', label: 'Town' },
                { value: 'rural', label: 'Rural' },
              ].map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() =>
                    setLocationTypes((curr) =>
                      curr.includes(value) ? curr.filter((v) => v !== value) : [...curr, value]
                    )
                  }
                  className={`w-full text-left px-3 py-2 rounded border ${
                    locationTypes.includes(value)
                      ? 'bg-brand-light border-brand-secondary'
                      : 'bg-white border-gray-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </details>

          <details
            className="border rounded-md"
            onToggle={(e: any) => {
              if (e.currentTarget.open) {
                if (!allInstitutions) {
                  getAllInstitutions().then(setAllInstitutions);
                }
                if (!majorsMeta) {
                  getMajorsMeta().then(setMajorsMeta);
                }
                if (!majorsByInstitution) {
                  getMajorsByInstitution().then(setMajorsByInstitution);
                }
              }
            }}
          >
            <summary className="cursor-pointer px-3 py-2 font-semibold">Major</summary>
            <div className="px-3 py-2 space-y-2">
              <input
                type="search"
                value={majorQuery}
                onChange={(e) => setMajorQuery(e.target.value)}
                placeholder="Search majors..."
                className="w-full p-2 border border-gray-300 rounded-md"
              />
              {(majorSuggestions.length > 0 || (majorQuery.trim().length < 2 && allMajors.length > 0)) && (
                <ul className="border border-gray-200 rounded-md divide-y max-h-80 overflow-auto">
                  {(majorQuery.trim().length < 2 ? allMajors : majorSuggestions).map((m) => (
                    <li key={m.code}>
                      <button
                        className="w-full text-left px-3 py-2 hover:bg-brand-light"
                        onClick={() => addMajor(m)}
                      >
                        {m.label}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {selectedMajors.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedMajors.map((code) => {
                    const rawTitle = majorsMeta?.four_digit?.[code] || code;
                    const title = cleanCipTitle(rawTitle);
                    return (
                      <span
                        key={code}
                        className="inline-flex items-center gap-2 px-2 py-1 bg-brand-light text-brand-dark rounded-full text-xs"
                      >
                        {title}
                        <button
                          className="text-red-600"
                          onClick={() => setSelectedMajors(selectedMajors.filter((x) => x !== code))}
                        >
                          &times;
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          </details>
        </div>
      </aside>

      <main className="flex-1">
        <div className="mb-2">
          <p className="text-gray-600">
            Showing {displayed.length} of {filteredUnitIds.length || 0} result(s)
          </p>
        </div>
        {loading ? (
          <p>Loading universities...</p>
        ) : displayed.length > 0 ? (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {displayed.map((inst) => (
                <InstitutionCard key={inst.unitid} institution={inst} />
              ))}
            </div>
            <div className="flex items-center justify-center gap-4 mt-6">
              <button
                onClick={prevPage}
                disabled={page === 1}
                className="px-3 py-2 rounded bg-gray-100 text-gray-700 disabled:opacity-50"
              >
                Prev
              </button>
              <span className="text-gray-700">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={nextPage}
                disabled={page === totalPages}
                className="px-3 py-2 rounded bg-gray-100 text-gray-700 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </>
        ) : (
          <div className="text-center py-12 bg-white rounded-lg shadow-md">
            <h3 className="text-xl font-semibold text-gray-800">No Universities Found</h3>
            <p className="text-gray-500 mt-2">Try a different search term or adjust filters.</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default ExplorePage;

// Helpers
function matchesTuitionBucket(tuition: number, bucket: string): boolean {
  if (!Number.isFinite(tuition)) return false;
  if (bucket.endsWith('+')) {
    const min = Number(bucket.slice(0, -1));
    if (Number.isNaN(min)) return false;
    return tuition >= min;
  }
  const [minStr, maxStr] = bucket.split('-');
  const min = Number(minStr);
  const max = Number(maxStr);
  if (Number.isNaN(min) || Number.isNaN(max)) return false;
  return tuition >= min && tuition < max;
}

function formatTestPolicy(value: string | null | undefined): string {
  if (!value) return 'Unknown';
  const raw = value.trim();
  const lower = raw.toLowerCase();
  if (lower === 'test flexible') return 'Flex optional';
  if (lower === 'test optional') return 'Test optional';
  return raw;
}

function cleanCipTitle(value: string | null | undefined): string {
  if (!value) return "";
  let t = String(value).trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    t = t.slice(1, -1).trim();
  } else {
    if (t.startsWith('"') || t.startsWith("'")) t = t.slice(1).trim();
    if (t.endsWith('"') || t.endsWith("'")) t = t.slice(0, -1).trim();
  }
  return t;
}

function normalizeLocationType(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const v = raw.trim().toLowerCase();
  if (!v) return null;
  if (v.startsWith('city')) return 'city';
  if (v.startsWith('suburb')) return 'suburban';
  if (v.startsWith('town')) return 'town';
  if (v.startsWith('rural')) return 'rural';
  return null;
}

function filterInstitutions(
  institutions: Institution[],
  budget: string[],
  selectivity: string[],
  testPolicy: string[],
  selectedMajors: string[],
  selectedStates: string[],
  selectedLocationTypes: string[],
  majorsByInstitution: InstitutionMajorsByInstitution | null,
  locationMap: Map<number, string> | null,
): Institution[] {
  let results = institutions.slice();

  if (budget.length > 0) {
    results = results.filter((inst) => {
      const tuition = inst.tuition_2023_24_out_of_state ?? inst.tuition_2023_24_in_state ?? inst.tuition_2023_24;
      if (tuition == null) return false;
      return budget.some((b) => matchesTuitionBucket(tuition, b));
    });
  }

  if (selectivity.length > 0) {
    results = results.filter((inst) => {
      const rate = inst.acceptance_rate;
      if (rate == null) return false;
      return selectivity.some((s) => {
        if (s === 'selective') return rate < 0.1;
        if (s === 'reach') return rate >= 0.1 && rate < 0.25;
        if (s === 'target') return rate >= 0.25 && rate < 0.5;
        if (s === 'balanced') return rate >= 0.5 && rate < 0.7;
        if (s === 'safety') return rate >= 0.7 && rate < 0.91;
        if (s === 'supersafe') return rate >= 0.91;
        return false;
      });
    });
  }

  if (testPolicy.length > 0) {
    results = results.filter((inst) => {
      const policy = (inst.test_policy || '').toLowerCase();
      return testPolicy.some((tp) => {
        if (tp === 'optional') return policy.includes('optional') || policy.includes('flexible');
        if (tp === 'required') return policy.includes('required');
        if (tp === 'notconsidered') return policy.includes('not considered');
        return false;
      });
    });
  }

  if (selectedMajors.length > 0 && majorsByInstitution) {
    const selectedSet = new Set(selectedMajors);
    results = results.filter((inst) => {
      const entry = majorsByInstitution[String(inst.unitid)];
      if (!entry || !entry.four_digit || entry.four_digit.length === 0) return false;
      return entry.four_digit.some((code) => selectedSet.has(code));
    });
  }

  if (selectedStates.length > 0) {
    const set = new Set(selectedStates.map((s) => s.toLowerCase()));
    results = results.filter((inst) => {
      const full = toFullStateName(inst.state).toLowerCase();
      return set.has(full);
    });
  }

  if (selectedLocationTypes.length > 0 && locationMap) {
    const typeSet = new Set(selectedLocationTypes);
    results = results.filter((inst) => {
      const rawLoc = locationMap.get(inst.unitid);
      const normalized = normalizeLocationType(rawLoc);
      if (!normalized) return false;
      return typeSet.has(normalized);
    });
  }

  return results;
}
