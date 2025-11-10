import { useEffect, useMemo, useState } from "react";
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

function enrichRow(r) {
  const nameState = `${r.name ?? ""} ${r.state ?? ""}`;
  const tokens = tokenize(nameState);
  const compact = normalize(nameState).replace(/\s+/g, "");
  const words = normalize(r.name ?? "").split(" ").filter(Boolean);
  const acronym = words.filter(w => w.length > 2).map(w => w[0]).join("");
  return { ...r, _tokens: tokens, _compact: compact, _acronym: acronym };
}

function scoreRow(row, qTokens, qCompact) {
  if (!row._tokens) return 0;
  let hits = 0;
  for (const qt of qTokens) {
    if (row._tokens.some(rt => rt.startsWith(qt) || rt.includes(qt))) hits++;
  }
  if (hits === 0) return 0;
  let score = hits;
  if (row._compact.includes(qCompact)) score += 2;
  if (hits === qTokens.length) score += 1;
  if (row._acronym && qTokens.includes(row._acronym)) score += 1;
  return score;
}

function formatTuitionPair(inState, outState, fallback) {
  const format = value => `$${Number(value).toLocaleString()}`;
  const hasIn = Number.isFinite(Number(inState));
  const hasOut = Number.isFinite(Number(outState));

  if (hasIn && hasOut) return `${format(outState)} / ${format(inState)}`;
  if (hasOut) return `${format(outState)} (out-of-state)`;
  if (hasIn) return `${format(inState)} (in-state)`;
  if (Number.isFinite(Number(fallback))) return format(fallback);
  return "Not reported";
}

function getAcceptanceBand(rate) {
  const value = Number(rate);
  if (!Number.isFinite(value)) return "unknown";
  if (value < 25) return "reach";
  if (value < 50) return "target";
  if (value < 70) return "balanced";
  return "safety";
}

const BUDGET_OPTIONS = [
  { value: "under20", label: "Up to $20k" },
  { value: "20to40", label: "$20k - $40k" },
  { value: "40to60", label: "$40k - $60k" },
  { value: "over60", label: "$60k+" }
];

const ACCEPTANCE_OPTIONS = [
  { value: "safety", label: "Safety (>=70% admit)" },
  { value: "balanced", label: "Balanced (50% - 69%)" },
  { value: "target", label: "Target (25% - 49%)" },
  { value: "reach", label: "Reach (<25%)" }
];

const TEST_POLICY_ORDER = ["Test optional", "Test flexible", "Required", "Not reported"];

export default function Explore() {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState([]);
  // Multi-select filters for search controls
  const [budgets, setBudgets] = useState([]);
  const [acceptanceBands, setAcceptanceBands] = useState([]);
  const [majorFamilies, setMajorFamilies] = useState([]);
  const [testPolicies, setTestPolicies] = useState([]);
  const [specificMajors, setSpecificMajors] = useState([]);
  const [specificMajorInput, setSpecificMajorInput] = useState("");
  const [majorsById, setMajorsById] = useState({});

  useEffect(() => {
    async function load() {
      try {
        const [instRes, metricsRes] = await Promise.all([
          fetch("/data/institutions.json"),
          fetch("/data/metrics_by_year.json")
        ]);
        const instJson = await instRes.json();
        const metricsJson = await metricsRes.json();
        const latestApplicants = new Map();

        for (const metric of metricsJson) {
          const unitid = Number(metric.unitid);
          const applicants = Number(metric.applicants_total);
          if (!Number.isFinite(unitid) || !Number.isFinite(applicants)) continue;
          const year = Number(metric.year) || 0;
          const prior = latestApplicants.get(unitid);
          if (!prior || year > prior.year || (year === prior.year && applicants > prior.applicants)) {
            latestApplicants.set(unitid, { applicants, year });
          }
        }

        const enriched = instJson.map(row => {
          const volume = latestApplicants.get(Number(row.unitid));
          return enrichRow({
            ...row,
            applicants_total: volume?.applicants ?? null,
            applicants_year: volume?.year ?? null
          });
        });
        setRows(enriched);
      } catch (err) {
        console.error("Failed to load explore data", err);
        setRows([]);
      }
    }
    load();
  }, []);

  // Load majors by institution if available (generated via Scorecard script)
  useEffect(() => {
    let cancelled = false;
    fetch(`/data/majors_by_institution.json?t=${Date.now()}`)
      .then(r => (r.ok ? r.json() : null))
      .then(json => {
        if (!cancelled && json && typeof json === "object") setMajorsById(json);
      })
      .catch(err => {
        console.error("Failed to load majors_by_institution.json", err);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const majorOptions = useMemo(() => {
    const set = new Set();
    rows.forEach(row => (row.major_families ?? []).forEach(f => set.add(f)));
    return Array.from(set).sort();
  }, [rows]);

  const testPolicyOptions = useMemo(() => {
    const set = new Set(rows.map(r => r.test_policy || "Not reported"));
    return Array.from(set).sort((a, b) => TEST_POLICY_ORDER.indexOf(a) - TEST_POLICY_ORDER.indexOf(b));
  }, [rows]);

  const allMajors = useMemo(() => {
    const set = new Set();
    try {
      for (const key of Object.keys(majorsById || {})) {
        const arr = majorsById[key] || [];
        for (const title of arr) if (title) set.add(String(title).replace(/\.$/, ""));
      }
    } catch {}
    return Array.from(set).sort();
  }, [majorsById]);

  const normalizedSpecificMajors = useMemo(
    () => specificMajors.map(value => normalize(value)),
    [specificMajors]
  );
  const normalizedSpecificMajorsSet = useMemo(
    () => new Set(normalizedSpecificMajors),
    [normalizedSpecificMajors]
  );

  const handleSpecificMajorAdd = () => {
    const value = specificMajorInput.trim();
    if (!value) return;
    const normalizedValue = normalize(value);
    setSpecificMajors(prev => {
      if (prev.some(existing => normalize(existing) === normalizedValue)) return prev;
      return [...prev, value];
    });
    setSpecificMajorInput("");
  };

  const handleSpecificMajorRemove = title => {
    setSpecificMajors(prev => prev.filter(item => item !== title));
  };

  const filtered = useMemo(() => {
    if (!rows.length) return [];

    const result = [];
    const hasQuery = query.trim().length > 0;
    const qTokens = hasQuery ? tokenize(query) : [];
    const qCompact = hasQuery ? normalize(query).replace(/\s+/g, "") : "";

    for (const row of rows) {
      if (!passesBudget(row, budgets)) continue;
      if (!passesAcceptance(row, acceptanceBands)) continue;
      if (!passesMajor(row, majorFamilies)) continue;
      if (!passesTestPolicy(row, testPolicies)) continue;
      if (!passesSpecificMajor(row, normalizedSpecificMajorsSet, majorsById)) continue;

      if (hasQuery) {
        const sc = scoreRow(row, qTokens, qCompact);
        if (sc > 0) result.push({ score: sc, row });
      } else {
        result.push({ score: 0, row });
      }
    }

    const sorted = result.sort((a, b) => {
      if (hasQuery) return b.score - a.score;
      const aApps = Number(a.row.applicants_total);
      const bApps = Number(b.row.applicants_total);
      const bothFinite = Number.isFinite(aApps) && Number.isFinite(bApps);
      if (bothFinite && aApps !== bApps) return bApps - aApps;
      if (Number.isFinite(bApps) && !Number.isFinite(aApps)) return 1;
      if (Number.isFinite(aApps) && !Number.isFinite(bApps)) return -1;
      return a.row.name.localeCompare(b.row.name);
    });

    const limit = hasQuery ? 60 : 10;
    return sorted.slice(0, limit).map(item => item.row);
  }, [rows, query, budgets, acceptanceBands, majorFamilies, testPolicies, normalizedSpecificMajorsSet, majorsById]);

  return (
    <section className="page">
      <div className="page-intro">
        <h1 className="h1">Explore US universities</h1>
      </div>

      <div
        className="section"
        style={{
          display: "grid",
          gap: "20px",
          marginTop: 24,
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))"
        }}
      >
        <article className="card">
          <h3 style={{ marginTop: 0 }}>Match by budget</h3>
          <p>Sort schools quickly with international tuition estimates so you know where scholarships are essential.</p>
        </article>

        <article className="card">
          <h3 style={{ marginTop: 0 }}>Balance your list</h3>
          <p>Slice by acceptance band to ensure your shortlist includes reach, target, and safety options.</p>
        </article>

        <article className="card">
          <h3 style={{ marginTop: 0 }}>Focus on fit</h3>
          <p>Highlight majors and testing expectations, then use Compare to dive deeper into outcomes and support.</p>
        </article>
      </div>

      <div className="card" style={{ marginTop: 28, display: "grid", gap: 16 }}>
        <div className="search-wrap" style={{ maxWidth: "100%" }}>
          <svg className="search-icon" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="currentColor" d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 1 0-.71.71l.27.28v.79L20 21.5 21.5 20 15.5 14zm-6 0A4.5 4.5 0 1 1 14 9.5a4.5 4.5 0 0 1-4.5 4.5z" />
          </svg>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by university name or state"
            className="search"
          />
        </div>

        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
          <FilterDropdownMulti
            label="Budget (out-of-state tuition)"
            values={budgets}
            onChange={setBudgets}
            options={BUDGET_OPTIONS}
          />
          <FilterDropdownMulti
            label="Selectivity band"
            values={acceptanceBands}
            onChange={setAcceptanceBands}
            options={ACCEPTANCE_OPTIONS}
          />
          <FilterDropdownMulti
            label="Major family"
            values={majorFamilies}
            onChange={setMajorFamilies}
            options={majorOptions.map(value => ({ value, label: value }))}
          />
          <FilterDropdownMulti
            label="Testing expectations"
            values={testPolicies}
            onChange={setTestPolicies}
            options={testPolicyOptions.map(v => ({ value: v, label: v }))}
          />
          <FilterDropdownSearchMulti
            label="Specific majors"
            values={specificMajors}
            onChange={setSpecificMajors}
            options={allMajors}
            limit={MAX_SPECIFIC_MAJORS}
          />
        </div>
      </div>

      <div className="grid" style={{ marginTop: 28 }}>
        {filtered.map(row => (
          <Link
            key={row.unitid}
            to={`/institution/${row.unitid}`}
            className="card"
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
              <div>
                <div style={{ fontWeight: 700, marginBottom: 2 }}>{row.name}</div>
                <div className="sub" style={{ fontSize: 13 }}>
                  {row.city ? `${row.city}, ` : ""}{row.state} - {row.control} - {row.level}
                </div>
              </div>
              <span className="badge">View profile</span>
            </div>

            <div style={{ marginTop: 12, display: "flex", gap: 16, flexWrap: "wrap", fontSize: 14 }}>
              {row.applicants_total != null && (
                <span>
                  Applications ({row.applicants_year ?? "latest"}): {Number(row.applicants_total).toLocaleString()}
                </span>
              )}
              <span>Acceptance: {row.acceptance_rate != null ? `${row.acceptance_rate}%` : "Not reported"}</span>
              <span>Yield: {row.yield != null ? `${row.yield}%` : "Not reported"}</span>
              <span>Tuition (intl): {formatTuitionPair(row.tuition_2023_24_in_state, row.tuition_2023_24_out_of_state, row.tuition_2023_24)}</span>
              <span>Test policy: {row.test_policy ?? "Not reported"}</span>
            </div>

            {Array.isArray(row.major_families) && row.major_families.length > 0 && (
              <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                {row.major_families.map(f => (
                  <span key={`${row.unitid}-${f}`} className="badge">{f}</span>
                ))}
              </div>
            )}
          </Link>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="card" style={{ marginTop: 24, textAlign: "center", color: "#64748b" }}>
          No universities match the current filters. Try widening the budget or selectivity range.
        </div>
      )}
    </section>
  );
}

function passesBudget(row, selectedBudgets) {
  if (!selectedBudgets?.length) return true;
  return selectedBudgets.some(bucket => matchesBudget(row, bucket));
}

function matchesBudget(row, bucket) {
  const tuition = Number(row.tuition_2023_24_out_of_state ?? row.tuition_2023_24 ?? row.tuition_2023_24_in_state);
  if (!Number.isFinite(tuition) || tuition <= 0) return false;
  switch (bucket) {
    case "under20":
      return tuition < 20000;
    case "20to40":
      return tuition >= 20000 && tuition < 40000;
    case "40to60":
      return tuition >= 40000 && tuition < 60000;
    case "over60":
      return tuition >= 60000;
    default:
      return true;
  }
}

function passesAcceptance(row, selectedBands) {
  if (!selectedBands?.length) return true;
  const band = getAcceptanceBand(row.acceptance_rate);
  if (band === "unknown") return false;
  return selectedBands.includes(band);
}

function passesMajor(row, selected) {
  if (!selected?.length) return true;
  if (!Array.isArray(row.major_families)) return false;
  return selected.some(f => row.major_families.includes(f));
}

function passesTestPolicy(row, selectedPolicies) {
  if (!selectedPolicies?.length) return true;
  const value = row.test_policy || "Not reported";
  return selectedPolicies.includes(value);
}

function passesSpecificMajor(row, selectedSet, majorsById = {}) {
  if (!selectedSet || selectedSet.size === 0) return true;
  if (!majorsById || Object.keys(majorsById).length === 0) return true; // no majors data loaded yet
  const arr = majorsById?.[row.unitid] || majorsById?.[String(row.unitid)] || [];
  if (!Array.isArray(arr) || arr.length === 0) return false;
  return arr.some(title => selectedSet.has(normalize(title)));
}

function FilterSelect({ label, value, onChange, options }) {
  return (
    <label style={{ display: "grid", gap: 6, fontSize: 14 }}>
      <span style={{ fontWeight: 600 }}>{label}</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid var(--border)" }}
      >
        {options.map(opt => (
          <option key={opt.value ?? opt} value={opt.value ?? opt}>
            {opt.label ?? opt}
          </option>
        ))}
      </select>
    </label>
  );
}

function FilterDropdownMulti({ label, values = [], onChange, options = [] }) {
  const [open, setOpen] = useState(false);
  const id = useMemo(() => `ms-${Math.random().toString(36).slice(2)}`, []);

  useEffect(() => {
    function onDoc(e) {
      const within = e.target.closest ? e.target.closest(`#${id}`) : null;
      if (!within) setOpen(false);
    }
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, [id]);

  function toggle(value) {
    if (!value) return;
    if (values.includes(value)) onChange(values.filter(v => v !== value));
    else onChange([...values, value]);
  }

  const text = values.length === 0
    ? "Any"
    : (options
        .filter(o => values.includes(o.value ?? o))
        .map(o => (o.label ?? o))
        .slice(0, 2)
        .join(", ") + (values.length > 2 ? ` +${values.length - 2}` : ""));

  return (
    <label style={{ display: "grid", gap: 6, fontSize: 14 }} id={id}>
      <span style={{ fontWeight: 600 }}>{label}</span>
      <div style={{ position: "relative" }}>
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          style={{
            width: "100%",
            textAlign: "left",
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid var(--border)",
            background: "#fff",
            cursor: "pointer"
          }}
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          {text}
        </button>
        {open && (
          <div
            className="card"
            role="listbox"
            style={{ position: "absolute", zIndex: 60, marginTop: 8, left: 0, right: 0, maxHeight: 260, overflow: "auto" }}
          >
            <div style={{ display: "grid", gap: 6 }}>
              {options.map(opt => {
                const value = opt.value ?? opt;
                const labelText = opt.label ?? opt;
                const active = values.includes(value);
                return (
                  <label key={value} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 2px" }}>
                    <input type="checkbox" checked={active} onChange={() => toggle(value)} />
                    <span>{labelText}</span>
                  </label>
                );
              })}
            </div>
            {values.length > 0 && (
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                <button type="button" onClick={() => onChange([])} className="btn-outline">Clear</button>
              </div>
            )}
          </div>
        )}
      </div>
    </label>
  );
}

function FilterDropdownSearchMulti({ label, values = [], onChange, options = [], limit = 5 }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const id = useMemo(() => `sm-${Math.random().toString(36).slice(2)}`, []);

  useEffect(() => {
    function onDoc(e) {
      const within = e.target.closest ? e.target.closest(`#${id}`) : null;
      if (!within) setOpen(false);
    }
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, [id]);

  const filtered = useMemo(() => {
    const n = normalize(q);
    if (!n) return options;
    return options.filter(title => normalize(title).includes(n));
  }, [q, options]);

  function toggle(value) {
    if (!value) return;
    if (values.includes(value)) onChange(values.filter(v => v !== value));
    else if (values.length < limit) onChange([...values, value]);
  }

  const text = values.length === 0
    ? "Any"
    : values.slice(0, 2).join(", ") + (values.length > 2 ? ` +${values.length - 2}` : "");

  const limitReached = values.length >= limit;

  return (
    <label style={{ display: "grid", gap: 6, fontSize: 14 }} id={id}>
      <span style={{ fontWeight: 600 }}>{label}</span>
      <div style={{ position: "relative" }}>
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          style={{
            width: "100%",
            textAlign: "left",
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid var(--border)",
            background: "#fff",
            cursor: "pointer"
          }}
          aria-haspopup="listbox"
          aria-expanded={open}
        >
          {text}
        </button>
        {open && (
          <div className="card" role="listbox" style={{ position: "absolute", zIndex: 60, marginTop: 8, left: 0, right: 0, maxHeight: 320, overflow: "auto" }}>
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search majors"
              style={{ width: "100%", padding: 10, border: "1px solid var(--border)", borderRadius: 8 }}
            />
            <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
              {filtered.slice(0, 1000).map(title => {
                const active = values.includes(title);
                const disabled = !active && limitReached;
                return (
                  <label key={title} style={{ display: "flex", alignItems: "center", gap: 8, opacity: disabled ? .6 : 1 }}>
                    <input type="checkbox" checked={active} disabled={disabled} onChange={() => toggle(title)} />
                    <span>{title}</span>
                  </label>
                );
              })}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 12, color: "#64748b" }}>
              <span>{limitReached ? `Limit ${limit} reached` : `Select up to ${limit}`}</span>
              {values.length > 0 && (
                <button type="button" onClick={() => onChange([])} className="btn-outline">Clear</button>
              )}
            </div>
          </div>
        )}
      </div>
    </label>
  );
}


