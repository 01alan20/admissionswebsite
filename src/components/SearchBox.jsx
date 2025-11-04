import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

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
  const words = normalize(row.name ?? "").split(" ").filter(Boolean);
  const acronym = words.filter(w => w.length > 2).map(w => w[0]).join("");
  return { ...row, _tokens: tokens, _compact: compact, _acronym: acronym };
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

function blockKey(str) {
  const normalized = normalize(str);
  if (!normalized) return "misc";
  const first = normalized[0];
  if (first >= "a" && first <= "z") return first;
  return "misc";
}

export default function SearchBox() {
  const [query, setQuery] = useState("");
  const [manifest, setManifest] = useState([]);
  const [blocks, setBlocks] = useState({});
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const nav = useNavigate();
  const boxRef = useRef(null);

  useEffect(() => {
    fetch("/data/indexes/manifest.json")
      .then(r => r.json())
      .then(setManifest)
      .catch(() => setManifest([]));
  }, []);

  const loadBlock = useCallback((key) => {
    if (!key || blocks[key]) return;
    if (manifest.length && !manifest.includes(key)) return;
    fetch(`/data/indexes/${key}.json`)
      .then(r => (r.ok ? r.json() : []))
      .then(rows => {
        setBlocks(prev => ({ ...prev, [key]: rows.map(enrich) }));
      })
      .catch(() => {});
  }, [blocks, manifest]);

  useEffect(() => {
    if (!query.trim()) return;
    const key = blockKey(query);
    loadBlock(key);
  }, [query, loadBlock]);

  const allRows = useMemo(() => Object.values(blocks).flat(), [blocks]);

  const results = useMemo(() => {
    const term = query.trim();
    if (!term) return [];
    const qTokens = tokenize(term);
    const qCompact = normalize(term).replace(/\s+/g, "");
    const scored = [];
    for (const row of allRows) {
      const sc = scoreRow(row, qTokens, qCompact);
      if (sc > 0) scored.push([sc, row]);
    }
    scored.sort((a, b) => b[0] - a[0]);
    return scored.slice(0, 10).map(item => item[1]);
  }, [query, allRows]);

  function choose(row) {
    setOpen(false);
    setQuery("");
    nav(`/institution/${row.unitid}`);
  }

  function onKeyDown(e) {
    if (!results.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight(h => Math.min(h + 1, results.length - 1));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight(h => Math.max(h - 1, 0));
    }
    if (e.key === "Enter") {
      e.preventDefault();
      choose(results[highlight]);
    }
    if (e.key === "Escape") {
      setOpen(false);
    }
  }

  useEffect(() => {
    function onDocClick(ev) {
      if (!boxRef.current?.contains(ev.target)) setOpen(false);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  return (
    <div ref={boxRef} className="search-wrap" role="search" aria-label="Search universities">
      <svg className="search-icon" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="currentColor" d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 1 0-.71.71l.27.28v.79L20 21.5 21.5 20 15.5 14zm-6 0A4.5 4.5 0 1 1 14 9.5a4.5 4.5 0 0 1-4.5 4.5z" />
      </svg>
      <input
        value={query}
        onFocus={() => { setOpen(true); if (!query) loadBlock("misc"); }}
        onChange={e => { setQuery(e.target.value); setOpen(true); setHighlight(0); }}
        onKeyDown={onKeyDown}
        placeholder="Search a university"
        className="search"
      />

      {open && results.length > 0 && (
        <div className="suggest" role="listbox">
          {results.map((row, index) => (
            <div
              key={row.unitid}
              className={`row ${index === highlight ? "active" : ""}`}
              onMouseEnter={() => setHighlight(index)}
              onMouseDown={e => { e.preventDefault(); choose(row); }}
              role="option"
            >
              <div className="name">{row.name}</div>
              <div className="meta">
                {(row.city ? `${row.city}, ` : "")}{row.state}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
