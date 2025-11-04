import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as Slider from "@radix-ui/react-slider";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext.jsx";
import confetti from "canvas-confetti";
import { summarizeExtracurriculars } from "../utils/extracurricularLLM";
import { calculateProfileScore } from "../utils/scoring";
import "./onboarding.css";

const steps = [
  "Profile",
  "Graduation",
  "Academics",
  "Tests",
  "Targets",
  "Extracurriculars"
];

function useInstitutionLookup() {
  const [list, setList] = useState([]);
  useEffect(() => {
    fetch("/data/institutions_index.json")
      .then(res => res.json())
      .then(data => setList(data.slice(0, 2000)))
      .catch(() => setList([]));
  }, []);
  return list;
}

export default function OnboardingBeta() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const institutionList = useInstitutionLookup();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    grad_year: new Date().getFullYear() + 1,
    high_school: "",
    city: "",
    region: "",
    gpa: 3.2,
    sat_math: "",
    sat_ebrw: "",
    act_composite: "",
    tests_taken: "none",
    targets: [],
    extracurriculars: [],
    extracurricularDraft: ""
  });

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`)
          .then((res) => res.json())
          .then((geo) => {
            const city = geo?.address?.city || geo?.address?.town || geo?.address?.village || "";
            const region = geo?.address?.state || "";
            setForm((prev) => ({ ...prev, city, region }));
          })
          .catch(() => {});
      },
      () => {}
    );
  }, []);

  useEffect(() => {
    let mounted = true;
    async function loadProfile() {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();
      if (mounted && data) {
        setForm((prev) => ({
          ...prev,
          ...data,
          targets: data.targets || [],
          extracurriculars: data.extracurriculars || []
        }));
      }
    }
    if (user?.id) loadProfile();
    return () => {
      mounted = false;
    };
  }, [user?.id]);

  const progress = useMemo(() => ((currentStep + 1) / steps.length) * 100, [currentStep]);

  function updateField(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function upsertProfile(partial) {
    await supabase.from("profiles").upsert({
      user_id: user.id,
      email: user.email,
      ...partial,
      updated_at: new Date().toISOString()
    });
  }

  async function handleNext() {
    setLoading(true);
    try {
      switch (currentStep) {
        case 0:
          await upsertProfile({
            full_name: form.full_name,
            city: form.city,
            region: form.region
          });
          break;
        case 1:
          await upsertProfile({
            grad_year: form.grad_year,
            high_school: form.high_school
          });
          break;
        case 2:
          await upsertProfile({ gpa: form.gpa });
          break;
        case 3:
          await upsertProfile({
            tests_taken: form.tests_taken,
            sat_math: form.tests_taken === "sat" ? Number(form.sat_math) : null,
            sat_ebrw: form.tests_taken === "sat" ? Number(form.sat_ebrw) : null,
            act_composite: form.tests_taken === "act" ? Number(form.act_composite) : null
          });
          break;
        case 4:
          await upsertProfile({ targets: form.targets });
          break;
        case 5:
          await upsertProfile({ extracurriculars: form.extracurriculars });
          confetti({ particleCount: 120, spread: 90, origin: { y: 0.7 } });
          navigate("/beta/dashboard");
          break;
        default:
          break;
      }
      setCurrentStep((step) => Math.min(step + 1, steps.length - 1));
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateSummary() {
    if (!form.extracurricularDraft.trim()) return;
    setLoading(true);
    try {
      const summary = await summarizeExtracurriculars(form.extracurricularDraft);
      const updated = [...form.extracurriculars, { raw: form.extracurricularDraft, summary }];
      setForm((prev) => ({ ...prev, extracurriculars: updated, extracurricularDraft: "" }));
    } finally {
      setLoading(false);
    }
  }

  function renderStep() {
    switch (currentStep) {
      case 0:
        return (
          <div className="step-card">
            <h2>Tell us about you</h2>
            <div className="input-group">
              <label htmlFor="full_name">Preferred name</label>
              <input
                id="full_name"
                value={form.full_name}
                onChange={(e) => updateField("full_name", e.target.value)}
                placeholder="Alex Johnson"
              />
            </div>
            <div className="dual">
              <div className="input-group">
                <label htmlFor="city">City</label>
                <input
                  id="city"
                  value={form.city}
                  onChange={(e) => updateField("city", e.target.value)}
                  placeholder="Seattle"
                />
              </div>
              <div className="input-group">
                <label htmlFor="region">State / Region</label>
                <input
                  id="region"
                  value={form.region}
                  onChange={(e) => updateField("region", e.target.value)}
                  placeholder="WA"
                  maxLength={32}
                />
              </div>
            </div>
          </div>
        );
      case 1:
        return (
          <div className="step-card">
            <h2>High school and graduation</h2>
            <div className="input-group">
              <label htmlFor="grad_year">Expected graduation year</label>
              <input
                type="number"
                id="grad_year"
                min={new Date().getFullYear()}
                max={new Date().getFullYear() + 6}
                value={form.grad_year}
                onChange={(e) => updateField("grad_year", Number(e.target.value))}
              />
            </div>
            <div className="input-group">
              <label htmlFor="high_school">High school</label>
              <input
                id="high_school"
                value={form.high_school}
                onChange={(e) => updateField("high_school", e.target.value)}
                placeholder="Los Angeles College Prep Academy"
              />
            </div>
          </div>
        );
      case 2:
        return (
          <div className="step-card">
            <h2>Your current GPA</h2>
            <div className="slider-wrap">
              <span>{form.gpa.toFixed(1)} / 4.0</span>
              <Slider.Root
                className="slider"
                value={[Math.round(form.gpa * 10)]}
                min={0}
                max={40}
                step={1}
                onValueChange={(value) => updateField("gpa", value[0] / 10)}
              >
                <Slider.Track className="slider-track">
                  <Slider.Range className="slider-range" />
                </Slider.Track>
                <Slider.Thumb className="slider-thumb" aria-label="GPA" />
              </Slider.Root>
            </div>
            <p className="hint">Slide to match your unweighted GPA to the nearest tenth.</p>
          </div>
        );
      case 3:
        return (
          <div className="step-card">
            <h2>Testing</h2>
            <div className="pill-group">
              {[
                { value: "sat", label: "SAT" },
                { value: "act", label: "ACT" },
                { value: "none", label: "None yet" }
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={form.tests_taken === option.value ? "pill active" : "pill"}
                  onClick={() => updateField("tests_taken", option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {form.tests_taken === "sat" && (
              <div className="dual">
                <div className="input-group">
                  <label htmlFor="sat_math">SAT Math</label>
                  <input
                    id="sat_math"
                    type="number"
                    min={200}
                    max={800}
                    step={10}
                    value={form.sat_math}
                    onChange={(e) => updateField("sat_math", e.target.value)}
                  />
                </div>
                <div className="input-group">
                  <label htmlFor="sat_ebrw">SAT Reading/Writing</label>
                  <input
                    id="sat_ebrw"
                    type="number"
                    min={200}
                    max={800}
                    step={10}
                    value={form.sat_ebrw}
                    onChange={(e) => updateField("sat_ebrw", e.target.value)}
                  />
                </div>
              </div>
            )}
            {form.tests_taken === "act" && (
              <div className="input-group">
                <label htmlFor="act_composite">ACT composite</label>
                <input
                  id="act_composite"
                  type="number"
                  min={11}
                  max={36}
                  value={form.act_composite}
                  onChange={(e) => updateField("act_composite", e.target.value)}
                />
              </div>
            )}
          </div>
        );
      case 4:
        return (
          <div className="step-card">
            <h2>Create your target list</h2>
            <TargetPicker
              list={institutionList}
              selected={form.targets}
              onChange={(targets) => updateField("targets", targets)}
            />
          </div>
        );
      case 5:
        return (
          <div className="step-card">
            <h2>Extracurricular highlights</h2>
            <p className="hint">
              Paste a quick description of one activity. We&apos;ll draft a summary using a local
              Llama model. Add as many entries as you like.
            </p>
            <textarea
              rows={5}
              value={form.extracurricularDraft}
              onChange={(e) => updateField("extracurricularDraft", e.target.value)}
              placeholder="Describe your role, impact, recognition, and time commitment."
            />
            <div className="actions">
              <button type="button" className="ghost" onClick={handleGenerateSummary} disabled={loading}>
                Generate summary
              </button>
            </div>
            <ul className="summary-list">
              {form.extracurriculars.map((item, idx) => (
                <li key={idx}>
                  <strong>{item.summary?.headline || `Activity ${idx + 1}`}</strong>
                  <p>{item.summary?.narrative || item.summary}</p>
                </li>
              ))}
            </ul>
          </div>
        );
      default:
        return null;
    }
  }

  const isLastStep = currentStep === steps.length - 1;

  return (
    <div className="onboarding-shell">
      <header className="onboarding-hero">
        <div className="hero-pill">Step {currentStep + 1} of {steps.length}</div>
        <h1>{steps[currentStep]}</h1>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
      </header>

      {renderStep()}

      <footer className="onboarding-footer">
        <button
          type="button"
          className="ghost"
          onClick={() => setCurrentStep((step) => Math.max(step - 1, 0))}
          disabled={currentStep === 0 || loading}
        >
          Back
        </button>
        <button type="button" onClick={handleNext} disabled={loading}>
          {isLastStep ? "Finish" : "Save & Continue"}
        </button>
      </footer>
    </div>
  );
}

function TargetPicker({ list, selected, onChange }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return list.slice(0, 12);
    return list
      .filter((inst) => inst.name.toLowerCase().includes(q) || inst.state?.toLowerCase().includes(q))
      .slice(0, 12);
  }, [query, list]);

  function toggle(inst) {
    const exists = selected.find((item) => item.unitid === inst.unitid);
    if (exists) {
      onChange(selected.filter((item) => item.unitid !== inst.unitid));
    } else {
      onChange([...selected, inst]);
    }
  }

  return (
    <div className="targets">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search universities"
      />
      <div className="target-grid">
        {filtered.map((inst) => {
          const active = selected.some((item) => item.unitid === inst.unitid);
          return (
            <button
              type="button"
              key={inst.unitid}
              className={active ? "target active" : "target"}
              onClick={() => toggle(inst)}
            >
              <span>{inst.name}</span>
              <small>{inst.state}</small>
            </button>
          );
        })}
      </div>
      {selected.length > 0 && (
        <div className="selected-list">
          <h4>Saved shortlist</h4>
          <ul>
            {selected.map((inst) => (
              <li key={inst.unitid}>{inst.name}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
