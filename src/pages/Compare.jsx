import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

function normalize(s = "") {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s&]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STOP = new Set(["the", "of", "and", "for", "at", "in", "on", "to", "a", "an", "&"]);

function tokenize(s = "") {
  const n = normalize(s);
  const raw = n.split(" ").filter(Boolean);
  const tokens = raw.filter(t => !STOP.has(t));
  const acronym = raw.filter(w => w.length > 2).map(w => w[0]).join("");
  if (acronym.length >= 2) tokens.push(acronym);
  return Array.from(new Set(tokens));
}

function enrich(row) {
  const nameState = `${row.name ?? ""} ${row.state ?? ""}`;
  const tokens = tokenize(nameState);
  const compact = normalize(nameState).replace(/\s+/g, "");
  return { ...row, _tokens: tokens, _compact: compact };
}

function score(row, qTokens, qCompact) {
  if (!row._tokens) return 0;
  let hits = 0;
  for (const qt of qTokens) {
    if (row._tokens.some(rt => rt.startsWith(qt) || rt.includes(qt))) hits++;
  }
  if (hits === 0) return 0;
  let sc = hits;
  if (row._compact.includes(qCompact)) sc += 2;
  if (hits === qTokens.length) sc += 1;
  return sc;
}

function formatNumber(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "Not reported";
  return num.toLocaleString();
}

function formatPercent(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "Not reported";
  return `${num}%`;
}

function formatCurrency(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return "Not reported";
  return `$${num.toLocaleString()}`;
}

function formatTuitionPair(inState, outState, fallback) {
  const hasIn = Number.isFinite(Number(inState));
  const hasOut = Number.isFinite(Number(outState));
  if (hasIn && hasOut) return `${formatCurrency(outState)} (out-of-state) / ${formatCurrency(inState)} (in-state)`;
  if (hasOut) return `${formatCurrency(outState)} (out-of-state)`;
  if (hasIn) return `${formatCurrency(inState)} (in-state)`;
  return formatCurrency(fallback);
}

const METRIC_ROWS = [
  {
    key: "location",
    label: "Location",
    render: inst => {
      const city = inst.city ? `${inst.city}, ` : "";
      return `${city}${inst.state ?? ""}`.trim() || "Not reported";
    }
  },
  { key: "control", label: "Control", render: inst => inst.control ?? "Not reported" },
  { key: "level", label: "Level", render: inst => inst.level ?? "Not reported" },
  {
    key: "applicants",
    label: "Applicants",
    render: (_inst, metric) => formatNumber(metric?.applicants_total)
  },
  {
    key: "admitted",
    label: "Estimated admitted",
    render: (_inst, metric) => formatNumber(metric?.admitted_est ?? metric?.admissions_total)
  },
  {
    key: "enrolled",
    label: "Estimated enrolled",
    render: (_inst, metric) => formatNumber(metric?.enrolled_est ?? metric?.enrolled_total)
  },
  {
    key: "acceptance",
    label: "Acceptance rate",
    render: (inst, metric) => formatPercent(metric?.percent_admitted_total ?? inst?.acceptance_rate)
  },
  {
    key: "yield",
    label: "Yield",
    render: (inst, metric) => formatPercent(metric?.admissions_yield_total ?? inst?.yield)
  },
  {
    key: "intl_tuition",
    label: "International tuition (2023-24)",
    render: inst => (
      formatTuitionPair(inst?.tuition_2023_24_in_state, inst?.tuition_2023_24_out_of_state, inst?.tuition_2023_24)
    )
  },
  {
    key: "intl_population",
    label: "International student share",
    render: inst => (
      inst?.intl_enrollment_pct != null
        ? `${inst.intl_enrollment_pct}% of total enrollment`
        : "Confirm with the International Student Office"
    )
  },
  {
    key: "gradRate",
    label: "6-year graduation rate",
    render: (_inst, metric) => formatPercent(metric?.graduation_rate_bachelor_degree_within_6_years_total)
  },
  {
    key: "retention",
    label: "First-year retention",
    render: (_inst, metric) => formatPercent(metric?.full_time_retention_rate)
  },
  {
    key: "sat50_ebrw",
    label: "SAT Evidence-Based Reading & Writing (50th)",
    render: (_inst, metric) => formatNumber(metric?.sat_evidence_based_reading_and_writing_50th_percentile_score)
  },
  {
    key: "sat50_math",
    label: "SAT Math (50th)",
    render: (_inst, metric) => formatNumber(metric?.sat_math_50th_percentile_score)
  },
  {
    key: "act50_composite",
    label: "ACT Composite (50th)",
    render: (_inst, metric) => formatNumber(metric?.act_composite_50th_percentile_score)
  }
];

export default function Compare() {
  const [institutions, setInstitutions] = useState(null);
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [metricsById, setMetricsById] = useState({});

  const metricsRef = useRef(metricsById);
  useEffect(() => { metricsRef.current = metricsById; }, [metricsById]);

  useEffect(() => {
    fetch("/data/institutions.json")
      .then(r => r.json())
      .then(data => setInstitutions(data.map(enrich)))
      .catch(() => setInstitutions([]));
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    selectedIds.forEach(id => {
      if (metricsRef.current[id]) return;
      fetch(`/data/metrics/${id}.json`, { signal: controller.signal })
        .then(r => (r.ok ? r.json() : null))
        .then(data => {
          if (!data) return;
          metricsRef.current = { ...metricsRef.current, [id]: data };
          setMetricsById(metricsRef.current);
        })
        .catch(() => {});
    });
    return () => controller.abort();
  }, [selectedIds]);

  const institutionsById = useMemo(() => {
    const map = new Map();
    (institutions ?? []).forEach(inst => map.set(String(inst.unitid), inst));
    return map;
  }, [institutions]);

  const latestMetrics = useMemo(() => {
    const map = new Map();
    Object.entries(metricsById).forEach(([id, bundle]) => {
      const rows = bundle?.metrics ?? [];
      if (!rows.length) return;
      const latest = [...rows].sort((a, b) => Number(a.year) - Number(b.year)).slice(-1)[0];
      map.set(String(id), latest);
    });
    return map;
  }, [metricsById]);

  const results = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed || !institutions?.length) return [];
    const qTokens = tokenize(trimmed);
    const qCompact = normalize(trimmed).replace(/\s+/g, "");
    const scored = [];
    for (const inst of institutions) {
      const sc = score(inst, qTokens, qCompact);
      if (sc > 0) scored.push([sc, inst]);
    }
    scored.sort((a, b) => b[0] - a[0]);
    return scored.slice(0, 12).map(x => x[1]);
  }, [query, institutions]);

  const selectedInstitutions = selectedIds
    .map(id => institutionsById.get(String(id)))
    .filter(Boolean);

  function addInstitution(inst) {
    const id = String(inst.unitid);
    setSelectedIds(prev => {
      if (prev.includes(id)) return prev;
      if (prev.length >= 3) return prev;
      return [...prev, id];
    });
    setQuery("");
  }

  function removeInstitution(id) {
    setSelectedIds(prev => prev.filter(x => x !== String(id)));
  }

  const gridColumns = `220px repeat(${Math.max(selectedInstitutions.length, 1)}, minmax(220px, 1fr))`;

  return (
    <section>
      <div className="page-intro">
        <h1 className="h1">Compare institutions</h1>
        <p className="sub">
          Shortlist up to three universities and review admissions, affordability, and support insights side by side. Use the columns below to pinpoint where to invest your application time.
        </p>
      </div>

      <div style={{ marginTop: 24 }} className="search-wrap">
        <svg className="search-icon" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="currentColor" d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 1 0-.71.71l.27.28v.79L20 21.5 21.5 20 15.5 14zm-6 0A4.5 4.5 0 1 1 14 9.5a4.5 4.5 0 0 1-4.5 4.5z" />
        </svg>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Add a university by name"
          className="search"
        />
        {query && results.length > 0 && (
          <div className="suggest" role="listbox">
            {results.map(inst => {
              const alreadySelected = selectedIds.includes(String(inst.unitid));
              return (
                <button
                  key={inst.unitid}
                  onClick={() => addInstitution(inst)}
                  disabled={alreadySelected || selectedIds.length >= 3}
                  className="row"
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "10px 12px",
                    border: "none",
                    background: alreadySelected ? "#eef2ff" : "#fff",
                    cursor: alreadySelected ? "default" : "pointer"
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{inst.name}</div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>
                    {(inst.city ? `${inst.city}, ` : "")}{inst.state}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ marginTop: 24 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {selectedInstitutions.map(inst => (
            <span key={`pill-${inst.unitid}`} className="badge" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              {inst.name}
              <button onClick={() => removeInstitution(inst.unitid)} style={{ border: "none", background: "transparent", cursor: "pointer" }} aria-label={`Remove ${inst.name}`}>
                x
              </button>
            </span>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 32 }}>
        {selectedInstitutions.length === 0 ? (
          <div className="card" style={{ padding: 32, textAlign: "center", color: "#64748b" }}>
            Search above to add universities and compare them side by side.
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflowX: "auto" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: gridColumns,
                minWidth: selectedInstitutions.length ? 520 : "auto"
              }}
            >
              <div style={{ padding: "18px", fontWeight: 700, borderBottom: "1px solid var(--border)" }}>
                Metric
              </div>
              {selectedInstitutions.map(inst => (
                <div
                  key={`col-${inst.unitid}`}
                  style={{
                    padding: "18px",
                    borderBottom: "1px solid var(--border)",
                    borderLeft: "1px solid var(--border)"
                  }}
                >
                  <div style={{ fontWeight: 700 }}>{inst.name}</div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>
                    <Link to={`/institution/${inst.unitid}`} style={{ color: "#4338ca" }}>
                      View profile -&gt;
                    </Link>
                  </div>
                </div>
              ))}

              {METRIC_ROWS.map(row => (
                <FragmentRow
                  key={row.key}
                  row={row}
                  institutions={selectedInstitutions}
                  latestMetrics={latestMetrics}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function FragmentRow({ row, institutions, latestMetrics }) {
  return (
    <>
      <div
        style={{
          padding: "16px 18px",
          borderTop: "1px solid var(--border)",
          fontWeight: 600,
          background: "#f8f9fc"
        }}
      >
        {row.label}
      </div>
      {institutions.map(inst => {
        const metric = latestMetrics.get(String(inst.unitid)) ?? {};
        return (
          <div
            key={`${row.key}-${inst.unitid}`}
            style={{
              padding: "16px 18px",
              borderTop: "1px solid var(--border)",
              borderLeft: "1px solid var(--border)"
            }}
          >
            {row.render(inst, metric)}
          </div>
        );
      })}
    </>
  );
}
