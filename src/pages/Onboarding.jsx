import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

function clamp(num, min, max) { return Math.max(min, Math.min(max, num)); }

export default function Onboarding() {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const [profile, setProfile] = useState({
    gpa_type: "None",
    gpa_value: "",
    curriculum: "US High School",
    sat_total: "",
    sat_math: "",
    act_composite: "",
  });

  const [prefs, setPrefs] = useState({
    majors: [],
    states: [],
    cities: [],
    campus_setting: "No Preference",
    size: "No Preference",
    types: new Set(["No Preference"]),
    aid_need: "",
  });

  const [allMajors, setAllMajors] = useState([]);
  const [stateOptions, setStateOptions] = useState([]);

  useEffect(() => {
    fetch("/data/majors_by_institution.json").then(r => r.json()).then(json => {
      const set = new Set();
      Object.values(json).forEach(arr => (arr || []).forEach(t => set.add(t)));
      setAllMajors(Array.from(set).sort());
    }).catch(() => setAllMajors([]));
    fetch("/data/institutions.json").then(r => r.json()).then(rows => {
      const states = Array.from(new Set(rows.map(r => r.state))).filter(Boolean).sort();
      setStateOptions(states);
    }).catch(() => setStateOptions([]));
  }, []);

  function addOrRemove(list, value, limit) {
    const arr = Array.from(list);
    const i = arr.indexOf(value);
    if (i >= 0) arr.splice(i, 1); else if (arr.length < limit) arr.push(value);
    return arr;
  }

  function validateStep1() {
    if (!profile.gpa_type) return "Select GPA type";
    if (profile.gpa_type !== "None") {
      const v = Number(profile.gpa_value);
      if (!Number.isFinite(v)) return "Enter a GPA number";
      if (v <= 0 || v > 5) return "GPA must be between 1.0 and 5.0";
    }
    if (profile.sat_total) {
      const v = Number(profile.sat_total); if (v < 400 || v > 1600) return "SAT total 400–1600";
    }
    if (profile.sat_math) {
      const v = Number(profile.sat_math); if (v < 200 || v > 800) return "SAT math 200–800";
    }
    if (profile.act_composite) {
      const v = Number(profile.act_composite); if (v < 1 || v > 36) return "ACT 1–36";
    }
    return "";
  }

  function validateStep2() {
    if (!prefs.majors.length) return "Select at least one major";
    return "";
  }

  async function saveAll() {
    setSaving(true); setError("");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("You must be signed in");
      const payload = {
        user_id: user.id,
        gpa_type: profile.gpa_type,
        gpa_value: profile.gpa_type === "None" ? null : Number(profile.gpa_value),
        curriculum: profile.curriculum,
        sat_total: profile.sat_total ? Number(profile.sat_total) : null,
        sat_math: profile.sat_math ? Number(profile.sat_math) : null,
        act_composite: profile.act_composite ? Number(profile.act_composite) : null,
        majors: prefs.majors,
        target_states: prefs.states,
        target_cities: prefs.cities,
        campus_setting: prefs.campus_setting,
        university_size: prefs.size,
        university_types: Array.from(prefs.types),
        financial_aid_need: prefs.aid_need || null,
        completed_at: new Date().toISOString(),
      };
      const { error: upErr } = await supabase.from("onboarding").upsert(payload, { onConflict: "user_id" });
      if (upErr) throw upErr;
      navigate("/dashboard");
    } catch (err) {
      setError(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <div className="page-intro"><h1 className="h1">Get your matches</h1></div>
      <div className="card" style={{ display: "grid", gap: 18 }}>
        <div className="sub">Step {step} of 3</div>

        {step === 1 && (
          <div style={{ display: "grid", gap: 12 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontWeight: 600 }}>GPA type</span>
              <select value={profile.gpa_type} onChange={e => setProfile(p => ({ ...p, gpa_type: e.target.value }))} className="search" style={{ height: 44 }}>
                <option>Weighted GPA</option>
                <option>Unweighted GPA</option>
                <option>None</option>
              </select>
            </label>
            {profile.gpa_type !== "None" && (
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontWeight: 600 }}>GPA value</span>
                <input type="number" step="0.01" placeholder="e.g., 3.7" value={profile.gpa_value} onChange={e => setProfile(p => ({ ...p, gpa_value: e.target.value }))} className="search" style={{ height: 44 }} />
                <span className="sub" style={{ fontSize: 12 }}>Allowed range 1.0–5.0 depending on school scale</span>
              </label>
            )}
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontWeight: 600 }}>Curriculum</span>
              <select value={profile.curriculum} onChange={e => setProfile(p => ({ ...p, curriculum: e.target.value }))} className="search" style={{ height: 44 }}>
                <option>US High School</option>
                <option>International (IB/A-Levels)</option>
                <option>GED/HiSET</option>
              </select>
            </label>
            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontWeight: 600 }}>SAT total (optional)</span>
                <input type="number" min="400" max="1600" value={profile.sat_total} onChange={e => setProfile(p => ({ ...p, sat_total: e.target.value }))} className="search" style={{ height: 44 }} />
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontWeight: 600 }}>SAT Math (optional)</span>
                <input type="number" min="200" max="800" value={profile.sat_math} onChange={e => setProfile(p => ({ ...p, sat_math: e.target.value }))} className="search" style={{ height: 44 }} />
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ fontWeight: 600 }}>ACT composite (optional)</span>
                <input type="number" min="1" max="36" value={profile.act_composite} onChange={e => setProfile(p => ({ ...p, act_composite: e.target.value }))} className="search" style={{ height: 44 }} />
              </label>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn-primary" onClick={() => { const err = validateStep1(); if (err) { setError(err); return; } setError(""); setStep(2); }}>
                Continue
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div style={{ display: "grid", gap: 12 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontWeight: 600 }}>Primary major</span>
              <select value={prefs.majors[0] || ""} onChange={e => setPrefs(p => ({ ...p, majors: e.target.value ? [e.target.value, ...p.majors.slice(1)] : [] }))} className="search" style={{ height: 44 }}>
                <option value="">Select major</option>
                {allMajors.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </label>
            <div className="sub" style={{ fontSize: 12 }}>Add up to 4 additional majors</div>
            {[1,2,3,4].map(i => (
              <label key={i} style={{ display: "grid", gap: 6 }}>
                <span style={{ fontWeight: 600 }}>Major {i+1} (optional)</span>
                <select value={prefs.majors[i] || ""} onChange={e => setPrefs(p => { const arr = [...(p.majors||[])]; arr[i] = e.target.value || undefined; return { ...p, majors: arr.filter(Boolean) }; })} className="search" style={{ height: 44 }}>
                  <option value="">Select major</option>
                  {allMajors.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </label>
            ))}

            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontWeight: 600 }}>Target states (up to 5)</span>
              <select multiple value={prefs.states} onChange={e => setPrefs(p => ({ ...p, states: Array.from(e.target.selectedOptions).map(o => o.value).slice(0,5) }))} className="search" style={{ height: 120 }}>
                {stateOptions.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>

            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn-outline" onClick={() => setStep(1)}>Back</button>
              <button className="btn-primary" onClick={() => { const err = validateStep2(); if (err) { setError(err); return; } setError(""); setStep(3); }}>Continue</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
              <RadioGroup label="Campus setting" value={prefs.campus_setting} onChange={v => setPrefs(p => ({ ...p, campus_setting: v }))} options={["Urban","Suburban","Rural","No Preference"]} />
              <RadioGroup label="University size" value={prefs.size} onChange={v => setPrefs(p => ({ ...p, size: v }))} options={["Small (<5k)","Medium (5k-15k)","Large (15k+)","No Preference"]} />
              <CheckboxGroup label="University type" values={prefs.types} onToggle={v => setPrefs(p => { const s = new Set(p.types); if (v === "No Preference") { return { ...p, types: new Set(["No Preference"]) }; } if (s.has("No Preference")) s.delete("No Preference"); s.has(v) ? s.delete(v) : s.add(v); return { ...p, types: s }; })} options={["Public","Private","Liberal Arts","No Preference"]} />
              <RadioGroup label="Financial aid need" value={prefs.aid_need} onChange={v => setPrefs(p => ({ ...p, aid_need: v }))} options={["Yes","No","Maybe/Unsure"]} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn-outline" onClick={() => setStep(2)}>Back</button>
              <button className="btn-primary" disabled={saving} onClick={saveAll}>{saving ? "Saving..." : "See my matches"}</button>
            </div>
          </div>
        )}

        {error && <div style={{ color: "crimson" }}>{error}</div>}
      </div>
    </section>
  );
}

function RadioGroup({ label, value, onChange, options }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontWeight: 600 }}>{label}</span>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {options.map(opt => (
          <label key={opt} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <input type="radio" name={label} checked={value === opt} onChange={() => onChange(opt)} />
            <span>{opt}</span>
          </label>
        ))}
      </div>
    </label>
  );
}

function CheckboxGroup({ label, values, onToggle, options }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontWeight: 600 }}>{label}</span>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {options.map(opt => (
          <label key={opt} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <input type="checkbox" checked={values.has(opt)} onChange={() => onToggle(opt)} />
            <span>{opt}</span>
          </label>
        ))}
      </div>
    </label>
  );
}

