import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

function normalize(s = "") { return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim(); }

export default function Dashboard() {
  const [onboarding, setOnboarding] = useState(null);
  const [rows, setRows] = useState([]);
  const [majorsById, setMajorsById] = useState({});
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase.from("onboarding").select("*").eq("user_id", user.id).maybeSingle();
        setOnboarding(data || null);
      }
      const [instRes, majorsRes] = await Promise.all([
        fetch("/data/institutions.json"),
        fetch("/data/majors_by_institution.json"),
      ]);
      setRows(await instRes.json());
      setMajorsById(await majorsRes.json());
    })();
  }, []);

  const recs = useMemo(() => {
    if (!onboarding || !rows.length) return [];
    const preferMajors = (onboarding.majors || []).map(normalize);
    return rows.filter(r => {
      // Major filter: either family overlap or specific majors map
      const hasSpecific = (majorsById?.[r.unitid] || majorsById?.[String(r.unitid)] || []).some(t => preferMajors.includes(normalize(t)));
      const hasFamily = (r.major_families || []).some(f => preferMajors.includes(normalize(f)));
      if (preferMajors.length && !(hasSpecific || hasFamily)) return false;
      // States filter
      if ((onboarding.target_states || []).length && !onboarding.target_states.includes(r.state)) return false;
      // Size preference (rough proxy using total enrollment buckets if present)
      return true;
    }).slice(0, 24);
  }, [onboarding, rows, majorsById]);

  return (
    <section>
      <div className="page-intro">
        <h1 className="h1">Your Dashboard</h1>
        <p className="sub">Personalized recommendations you can refine and compare.</p>
      </div>

      <div className="card" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Link className="btn-primary" to="/explore">Explore all universities</Link>
        <Link className="btn-outline" to="/compare">Open Compare</Link>
        <button className="btn-outline" onClick={() => setHelpOpen(true)}>Need more help?</button>
      </div>

      <div className="grid" style={{ marginTop: 20 }}>
        {recs.map(row => (
          <Link key={row.unitid} to={`/institution/${row.unitid}`} className="card" style={{ textDecoration: "none", color: "inherit" }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>{row.name}</div>
            <div className="sub" style={{ fontSize: 13 }}>{row.city ? `${row.city}, ` : ""}{row.state} - {row.control} - {row.level}</div>
          </Link>
        ))}
      </div>

      {helpOpen && <NeedHelpModal onClose={() => setHelpOpen(false)} />}
    </section>
  );
}

function NeedHelpModal({ onClose }) {
  const [choices, setChoices] = useState(new Set());
  const options = ["GPA", "Extracurriculars", "Essays", "College choice", "Scholarships", "Testing plan", "Other"];
  const [sent, setSent] = useState(false);

  function toggle(v) {
    setChoices(prev => { const s = new Set(prev); s.has(v) ? s.delete(v) : s.add(v); return s; });
  }

  async function submit() {
    const { data: { user } } = await supabase.auth.getUser();
    const payload = { user_id: user?.id || null, choices: Array.from(choices), created_at: new Date().toISOString() };
    try { await supabase.from("help_requests").insert(payload); } catch {}
    setSent(true);
  }

  const mailto = `mailto:you@example.com?subject=Help%20request&body=${encodeURIComponent(Array.from(choices).join(", "))}`;

  return (
    <div className="card" style={{ position: "fixed", inset: "20% 10% auto 10%", zIndex: 60, background: "#fff" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ marginTop: 0 }}>How can we help?</h3>
        <button className="btn-outline" onClick={onClose}>Close</button>
      </div>
      <div style={{ display: "grid", gap: 10 }}>
        {options.map(o => (
          <label key={o} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" checked={choices.has(o)} onChange={() => toggle(o)} />
            <span>{o}</span>
          </label>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button className="btn-primary" onClick={submit}>Submit</button>
        <a className="btn-outline" href={mailto}>Email us</a>
        {sent && <span className="sub">Thanks — we’ll be in touch.</span>}
      </div>
    </div>
  );
}

