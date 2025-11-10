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
    gpa_value: "",
    sat_total: "",
    sat_math: "",
    act_composite: "",
  });

  const [prefs, setPrefs] = useState({
    majors: [],
    states: [],
    campus_setting: "No Preference",
    size: "No Preference",
    types: new Set(["No Preference"]),
    aid_need: "",
  });

  const [allMajors, setAllMajors] = useState([]);
  const [stateOptions, setStateOptions] = useState([]);

  const US_STATES = useMemo(() => ([
    ["AL","Alabama"],["AK","Alaska"],["AZ","Arizona"],["AR","Arkansas"],["CA","California"],["CO","Colorado"],["CT","Connecticut"],["DE","Delaware"],["DC","District of Columbia"],["FL","Florida"],["GA","Georgia"],["HI","Hawaii"],["ID","Idaho"],["IL","Illinois"],["IN","Indiana"],["IA","Iowa"],["KS","Kansas"],["KY","Kentucky"],["LA","Louisiana"],["ME","Maine"],["MD","Maryland"],["MA","Massachusetts"],["MI","Michigan"],["MN","Minnesota"],["MS","Mississippi"],["MO","Missouri"],["MT","Montana"],["NE","Nebraska"],["NV","Nevada"],["NH","New Hampshire"],["NJ","New Jersey"],["NM","New Mexico"],["NY","New York"],["NC","North Carolina"],["ND","North Dakota"],["OH","Ohio"],["OK","Oklahoma"],["OR","Oregon"],["PA","Pennsylvania"],["RI","Rhode Island"],["SC","South Carolina"],["SD","South Dakota"],["TN","Tennessee"],["TX","Texas"],["UT","Utah"],["VT","Vermont"],["VA","Virginia"],["WA","Washington"],["WV","West Virginia"],["WI","Wisconsin"],["WY","Wyoming"]
  ]), []);

  useEffect(() => {
    fetch("/data/majors_by_institution.json").then(r => r.json()).then(json => {
      const set = new Set();
      Object.values(json).forEach(arr => (arr || []).forEach(t => set.add(t)));
      setAllMajors(Array.from(set).sort());
    }).catch(() => setAllMajors([]));
    // Use full state names for selection
    setStateOptions(US_STATES.map(([, name]) => name));
  }, [US_STATES]);

  function addOrRemove(list, value, limit) {
    const arr = Array.from(list);
    const i = arr.indexOf(value);
    if (i >= 0) arr.splice(i, 1); else if (arr.length < limit) arr.push(value);
    return arr;
  }

  function validateStep1() {
    const v = Number(profile.gpa_value);
    if (!Number.isFinite(v)) return "Enter GPA on a 4.0 scale";
    if (v <= 0 || v > 4) return "GPA must be between 1.0 and 4.0";
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
        gpa_type: 'Converted 4.0',
        gpa_value: Number(profile.gpa_value),
        curriculum: 'N/A',
        sat_total: profile.sat_total ? Number(profile.sat_total) : null,
        sat_math: profile.sat_math ? Number(profile.sat_math) : null,
        act_composite: profile.act_composite ? Number(profile.act_composite) : null,
        majors: prefs.majors,
        target_states: prefs.states,
        target_cities: [],
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
              <span style={{ fontWeight: 600 }}>GPA (4.0 scale)</span>
              <input type="number" step="0.01" min="1" max="4" placeholder="e.g., 3.7" value={profile.gpa_value} onChange={e => setProfile(p => ({ ...p, gpa_value: e.target.value }))} className="search" style={{ height: 44 }} />
              <span className="sub" style={{ fontSize: 12 }}>If your school uses a different scale, please convert to 4.0.</span>
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
            <MultiSelect
              label="Intended majors (up to 5)"
              placeholder="Type to search majors, then press Enter"
              values={prefs.majors}
              setValues={vals => setPrefs(p => ({ ...p, majors: vals }))}
              options={allMajors}
              max={5}
              datalistId="majors-suggest"
            />

            <MultiSelect
              label="Target states (up to 5)"
              placeholder="Type to search states, then press Enter"
              values={prefs.states}
              setValues={vals => setPrefs(p => ({ ...p, states: vals }))}
              options={stateOptions}
              max={5}
              datalistId="states-suggest"
            />

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

function MultiSelect({ label, values, setValues, options, max = 5, datalistId, placeholder }) {
  const [input, setInput] = useState("");
  const norm = (s="") => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  const opts = options || [];

  function add(val) {
    if (!val) return;
    // Prefer exact match; fallback to first includes
    const exact = opts.find(o => norm(o) === norm(val));
    const picked = exact || opts.find(o => norm(o).includes(norm(val)));
    if (!picked) return;
    if (values.includes(picked)) return;
    if (values.length >= max) return;
    setValues([...values, picked]);
    setInput("");
  }

  function onKey(e) {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(input); }
  }

  function remove(item) {
    setValues(values.filter(v => v !== item));
  }

  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <span style={{ fontWeight: 600 }}>{label}</span>
      <div className="card" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: 10 }}>
        {values.map(v => (
          <span key={v} className="badge" style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
            {v}
            <button type="button" onClick={() => remove(v)} style={{ border:'none', background:'transparent', cursor:'pointer' }}>×</button>
          </span>
        ))}
        {values.length < max && (
          <input
            list={datalistId}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onKey}
            placeholder={placeholder}
            style={{ flex: 1, minWidth: 220, border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px' }}
          />
        )}
      </div>
      <datalist id={datalistId}>
        {opts.slice(0, 500).map(o => <option key={o} value={o} />)}
      </datalist>
      <span className="sub" style={{ fontSize: 12 }}>{values.length}/{max} selected</span>
    </div>
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
