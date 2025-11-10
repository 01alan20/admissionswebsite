import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

function normalize(s = "") { return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim(); }
function formatCurrency(v){ const n=Number(v); return Number.isFinite(n)&&n>0?`$${n.toLocaleString()}`:"Not reported"; }

function getAcceptanceBand(rate) {
  const v = Number(rate);
  if (!Number.isFinite(v)) return "unknown";
  if (v < 25) return "Reach";
  if (v < 50) return "Target";
  if (v < 70) return "Balanced";
  return "Safety";
}

function sizeBucket(total) {
  const n = Number(total);
  if (!Number.isFinite(n)) return "unknown";
  if (n < 5000) return "Small (<5k)";
  if (n < 15000) return "Medium (5k-15k)";
  return "Large (15k+)";
}

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
    const preferStatesNames = onboarding.target_states || [];
    const NAME_TO_CODE = {
      "Alabama":"AL","Alaska":"AK","Arizona":"AZ","Arkansas":"AR","California":"CA","Colorado":"CO","Connecticut":"CT","Delaware":"DE","District of Columbia":"DC","Florida":"FL","Georgia":"GA","Hawaii":"HI","Idaho":"ID","Illinois":"IL","Indiana":"IN","Iowa":"IA","Kansas":"KS","Kentucky":"KY","Louisiana":"LA","Maine":"ME","Maryland":"MD","Massachusetts":"MA","Michigan":"MI","Minnesota":"MN","Mississippi":"MS","Missouri":"MO","Montana":"MT","Nebraska":"NE","Nevada":"NV","New Hampshire":"NH","New Jersey":"NJ","New Mexico":"NM","New York":"NY","North Carolina":"NC","North Dakota":"ND","Ohio":"OH","Oklahoma":"OK","Oregon":"OR","Pennsylvania":"PA","Rhode Island":"RI","South Carolina":"SC","South Dakota":"SD","Tennessee":"TN","Texas":"TX","Utah":"UT","Vermont":"VT","Virginia":"VA","Washington":"WA","West Virginia":"WV","Wisconsin":"WI","Wyoming":"WY"
    };
    const preferStates = preferStatesNames.map(n => NAME_TO_CODE[n]).filter(Boolean);
    const preferSize = onboarding.university_size || "No Preference";
    const preferTypes = new Set(onboarding.university_types || []);

    function majorMatchScore(r) {
      const specific = (majorsById?.[r.unitid] || majorsById?.[String(r.unitid)] || []);
      const hasSpecific = specific.some(t => preferMajors.includes(normalize(t)));
      const hasFamily = (r.major_families || []).some(f => preferMajors.includes(normalize(f)));
      if (!preferMajors.length) return 0;
      return hasSpecific ? 5 : hasFamily ? 2 : -5; // penalize if user chose majors but school doesn't match
    }

    function typeScore(r) {
      if (preferTypes.has("No Preference") || preferTypes.size === 0) return 0;
      let s = 0;
      if (preferTypes.has("Public") && r.control === "Public") s += 1;
      if (preferTypes.has("Private") && (r.control || "").startsWith("Private")) s += 1;
      if (preferTypes.has("Liberal Arts") && /Baccalaureate|Arts/.test(r.carnegie_basic || "")) s += 1;
      return s;
    }

    function stateScore(r) {
      if (!preferStates.length) return 0;
      return preferStates.includes(r.state) ? 1 : 0;
    }

    function sizeScore(r) {
      if (!preferSize || preferSize === "No Preference") return 0;
      return sizeBucket(r.total_enrollment) === preferSize ? 1 : 0;
    }

    function tuitionValue(r) {
      const v = Number(r.tuition_2023_24_out_of_state ?? r.tuition_2023_24 ?? r.tuition_2023_24_in_state);
      return Number.isFinite(v) ? v : Number.POSITIVE_INFINITY;
    }

    const scored = rows.map(r => {
      const score = 0
        + majorMatchScore(r)
        + stateScore(r)
        + sizeScore(r)
        + typeScore(r);
      return { r, score, band: getAcceptanceBand(r.acceptance_rate), tuition: tuitionValue(r) };
    })
    // Filter out clear non-matches if majors were provided
    .filter(x => !(preferMajors.length && x.score < 0));

    const ranked = scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.band !== b.band) {
        // Prefer Target/Balanced over Reach; simple order
        const order = { "Target": 0, "Balanced": 1, "Safety": 2, "Reach": 3, "unknown": 4 };
        return order[a.band] - order[b.band];
      }
      return a.tuition - b.tuition; // cheaper first
    });

    return ranked.slice(0, 24);
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
        {recs.map(item => (
          <Link key={item.r.unitid} to={`/institution/${item.r.unitid}`} className="card" style={{ textDecoration: "none", color: "inherit" }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>{item.r.name}</div>
                <div className="sub" style={{ fontSize: 13 }}>{item.r.city ? `${item.r.city}, ` : ""}{item.r.state} - {item.r.control} - {item.r.level}</div>
              </div>
              <span className="badge">{item.band}</span>
            </div>
            <div style={{ marginTop: 8, fontSize: 13, color: '#475569' }}>Est. tuition: {formatCurrency(item.tuition)}</div>
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
