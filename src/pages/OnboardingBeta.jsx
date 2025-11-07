import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import confetti from "canvas-confetti";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext.jsx";
import { summarizeExtracurriculars } from "../utils/extracurricularLLM";
import "./onboarding.css";

const STEPS = ["Profile", "Graduation", "Academics", "Tests", "Targets", "Extracurriculars"];
const STEP_DESCRIPTIONS = [
  "Set the baseline so we can personalise your US admissions path.",
  "Lock in your timeline and school context for better forecasting.",
  "Share the academic picture—GPA drives your admissions tier.",
  "Tell us which exams you’re tackling so we can track score goals.",
  "Create a shortlist of US universities to benchmark scholarships and costs.",
  "Capture standout activities so we can surface strengths and gaps."
];
const GPA_VALUES = Array.from({ length: 41 }, (_, i) => Number((i / 10).toFixed(1)));

function useInstitutionIndex() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    fetch("/data/institutions_index.json")
      .then((res) => res.json())
      .then(setItems)
      .catch(() => setItems([]));
  }, []);
  return items;
}

function GpaWheel({ value, onChange }) {
  const containerRef = useRef(null);
  const metricsRef = useRef({ paddingTop: 0, itemHeight: 44 });

  useEffect(() => {
    if (typeof window === "undefined" || !containerRef.current) return;
    const track = containerRef.current;
    const styles = window.getComputedStyle(track);
    metricsRef.current.paddingTop = parseFloat(styles.paddingTop) || 0;
    const firstItem = track.querySelector(".wheel-item");
    if (firstItem) {
      const height = firstItem.getBoundingClientRect().height;
      if (Number.isFinite(height) && height > 0) {
        metricsRef.current.itemHeight = height;
      }
    }
  }, []);

  useEffect(() => {
    const index = GPA_VALUES.findIndex((v) => v === value);
    if (index >= 0 && containerRef.current) {
      const track = containerRef.current;
      const { paddingTop, itemHeight } = metricsRef.current;
      const centerOffset = (track.clientHeight - itemHeight) / 2;
      const target = paddingTop + index * itemHeight;
      const nextTop = Math.max(0, target - centerOffset);
      if (Math.abs(track.scrollTop - nextTop) > 1) {
        track.scrollTo({ top: nextTop, behavior: "smooth" });
      }
    }
  }, [value]);

  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current) return;
      const track = containerRef.current;
      const { paddingTop, itemHeight } = metricsRef.current;
      const index = Math.round((track.scrollTop + paddingTop) / itemHeight);
      const nextValue = GPA_VALUES[Math.max(0, Math.min(GPA_VALUES.length - 1, index))];
      if (nextValue !== value) onChange(nextValue);
    };

    const el = containerRef.current;
    if (!el) return;
    let frame;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(handleScroll);
    };
    el.addEventListener("scroll", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener("scroll", onScroll);
    };
  }, [value, onChange]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let startY = null;
    let startTop = 0;

    const onPointerDown = (event) => {
      event.preventDefault();
      startY = event.clientY;
      startTop = el.scrollTop;
      el.classList.add("dragging");
      el.setPointerCapture?.(event.pointerId);
    };

    const onPointerMove = (event) => {
      if (startY === null) return;
      const delta = event.clientY - startY;
      el.scrollTop = startTop + delta;
    };

    const finishDrag = (event) => {
      if (startY === null) return;
      startY = null;
      el.classList.remove("dragging");
      el.releasePointerCapture?.(event.pointerId);
    };

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", finishDrag);
    el.addEventListener("pointercancel", finishDrag);
    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", finishDrag);
      el.removeEventListener("pointercancel", finishDrag);
    };
  }, []);

  return (
    <div className="wheel">
      <div className="wheel-mask" />
      <div className="wheel-track" ref={containerRef}>
        {GPA_VALUES.map((val) => (
          <div
            key={val}
            className={val === value ? "wheel-item active" : "wheel-item"}
          >
            {val.toFixed(1)}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function OnboardingBeta() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const institutionIndex = useInstitutionIndex();

  const [currentStep, setCurrentStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [targetQuery, setTargetQuery] = useState("");
  const [draftExtra, setDraftExtra] = useState("");
  const [messages, setMessages] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);

  const [form, setForm] = useState({
    full_name: "",
    city: "",
    region: "",
    grad_year: new Date().getFullYear() + 1,
    high_school: "",
    gpa: 3.0,
    tests: [],
    sat_math: "",
    sat_ebrw: "",
    act_composite: "",
    targets: [],
    extracurriculars: []
  });

  useEffect(() => {
    if (!user?.id) return;
    let mounted = true;
    async function loadProfile() {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();
      if (error || !data || !mounted) return;
      const tests = data.tests_taken ? data.tests_taken.split(",").filter(Boolean) : [];
      const noTestsSelected = tests.includes("none");
      setForm((prev) => ({
        ...prev,
        full_name: data.full_name || "",
        city: data.city || "",
        region: data.region || "",
        grad_year: data.grad_year || prev.grad_year,
        high_school: data.high_school || "",
        gpa: data.gpa ?? prev.gpa,
        tests,
        sat_math: noTestsSelected ? "" : data.sat_math ? String(data.sat_math) : "",
        sat_ebrw: noTestsSelected ? "" : data.sat_ebrw ? String(data.sat_ebrw) : "",
        act_composite: noTestsSelected ? "" : data.act_composite ? String(data.act_composite) : "",
        targets: Array.isArray(data.targets) ? data.targets : [],
        extracurriculars: Array.isArray(data.extracurriculars) ? data.extracurriculars : []
      }));
      if (Array.isArray(data.extracurriculars) && data.extracurriculars.length) {
        setMessages(
          data.extracurriculars.map((item, idx) => ({
            role: "assistant",
            id: `saved-${idx}`,
            content: `${item.headline || "Activity"}: ${item.narrative || ""}`
          }))
        );
      }
    }
    loadProfile();
    return () => {
      mounted = false;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`)
          .then((res) => res.json())
          .then((geo) => {
            setForm((prev) => ({
              ...prev,
              city: prev.city || geo?.address?.city || geo?.address?.town || "",
              region: prev.region || geo?.address?.state || ""
            }));
          })
          .catch(() => {});
      },
      () => {}
    );
  }, []);

  const progress = useMemo(
    () => ((currentStep + 1) / STEPS.length) * 100,
    [currentStep]
  );

  const stepValid = useMemo(() => {
    switch (currentStep) {
      case 0:
        return Boolean(form.full_name.trim() && form.city.trim() && form.region.trim());
      case 1:
        return Boolean(form.high_school.trim() && form.grad_year);
      case 2:
        return Number.isFinite(form.gpa);
      case 3: {
        if (form.tests.length === 0) return false;
        const hasSat = form.tests.includes("sat");
        const hasAct = form.tests.includes("act");
        const hasNone = form.tests.includes("none");
        if (hasNone && !hasSat && !hasAct) return true;
        const satValid = !hasSat || (isSatScoreValid(form.sat_math) && isSatScoreValid(form.sat_ebrw));
        const actValid = !hasAct || isActScoreValid(form.act_composite);
        return satValid && actValid;
      }
      case 4:
        return form.targets.length > 0;
      case 5:
        return form.extracurriculars.length > 0;
      default:
        return true;
    }
  }, [currentStep, form]);

  function updateField(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  const clampScore = (field, limits) => {
    const { min, max, step = 1 } = limits;
    setForm((prev) => {
      const raw = prev[field];
      if (raw === "" || raw == null) return prev;
      let num = Number(raw);
      if (!Number.isFinite(num)) {
        return { ...prev, [field]: "" };
      }
      num = Math.max(min, Math.min(max, num));
      if (step > 1) {
        num = Math.round(num / step) * step;
      }
      num = Math.max(min, Math.min(max, num));
      const normalized = String(num);
      if (normalized === raw) return prev;
      return { ...prev, [field]: normalized };
    });
  };

  function toggleTest(value) {
    setForm((prev) => {
      if (value === "none") {
        return {
          ...prev,
          tests: ["none"],
          sat_math: "",
          sat_ebrw: "",
          act_composite: ""
        };
      }
      const withoutNone = prev.tests.filter((item) => item !== "none");
      const next = withoutNone.includes(value)
        ? withoutNone.filter((item) => item !== value)
        : [...withoutNone, value];
      return { ...prev, tests: next };
    });
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
    if (!stepValid) return;
    setSaving(true);
    try {
      switch (currentStep) {
        case 0:
          await upsertProfile({
            full_name: form.full_name.trim(),
            city: form.city.trim(),
            region: form.region.trim()
          });
          break;
        case 1:
          await upsertProfile({
            grad_year: form.grad_year,
            high_school: form.high_school.trim()
          });
          break;
        case 2:
          await upsertProfile({ gpa: form.gpa });
          break;
        case 3: {
          const testsTaken = form.tests.includes("none") ? "none" : form.tests.join(",");
          await upsertProfile({
            tests_taken: testsTaken,
            sat_math: form.tests.includes("sat") ? Number(form.sat_math) : null,
            sat_ebrw: form.tests.includes("sat") ? Number(form.sat_ebrw) : null,
            act_composite: form.tests.includes("act") ? Number(form.act_composite) : null
          });
          break;
        }
        case 4:
          await upsertProfile({ targets: form.targets });
          break;
        case 5: {
          const cleanExtracurriculars = form.extracurriculars.map((item) => ({
            headline: item.headline,
            narrative: item.narrative
          }));
          await upsertProfile({ extracurriculars: cleanExtracurriculars });
          confetti({ particleCount: 140, spread: 90, origin: { y: 0.8 } });
          navigate("/beta/dashboard");
          return;
        }
        default:
          break;
      }
      setCurrentStep((prev) => Math.min(prev + 1, STEPS.length - 1));
    } finally {
      setSaving(false);
    }
  }

  function handleBack() {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  }

  async function handleExtracurricularSubmit(e) {
    e.preventDefault();
    if (!draftExtra.trim()) return;
    const rawText = draftExtra.trim();
    const userMessage = { role: "user", content: rawText, id: `user-${Date.now()}` };
    const assistantId = `assistant-${Date.now()}`;
    const fallbackHighlight = buildFallbackHighlight(rawText);
    const formattedFallback = formatHighlight(fallbackHighlight);

    setMessages((prev) => [
      ...prev,
      userMessage,
      { role: "assistant", content: formattedFallback, id: assistantId }
    ]);
    setDraftExtra("");

    setForm((prev) => ({
      ...prev,
      extracurriculars: [
        ...prev.extracurriculars,
        { ...fallbackHighlight, id: assistantId }
      ]
    }));

    setChatLoading(true);
    try {
      const summary = await summarizeExtracurriculars(rawText);
      const normalized = normalizeHighlight(summary, fallbackHighlight, rawText);
      const formatted = formatHighlight(normalized);
      setMessages((prev) =>
        prev.map((msg) => (msg.id === assistantId ? { ...msg, content: formatted } : msg))
      );
      setForm((prev) => ({
        ...prev,
        extracurriculars: prev.extracurriculars.map((item) =>
          item.id === assistantId ? { ...normalized, id: assistantId } : item
        )
      }));
    } catch (error) {
      console.error(error);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantId
            ? { ...msg, content: `${formattedFallback} • Saved with quick summary` }
            : msg
        )
      );
    } finally {
      setChatLoading(false);
    }
  }

  const filteredTargets = useMemo(() => {
    const query = targetQuery.trim().toLowerCase();
    if (query.length < 2) return [];
    return institutionIndex
      .filter((inst) =>
        inst.name?.toLowerCase().includes(query) || inst.state?.toLowerCase().includes(query)
      )
      .slice(0, 12);
  }, [targetQuery, institutionIndex]);

  function toggleTarget(inst) {
    setForm((prev) => {
      const exists = prev.targets.some((item) => item.unitid === inst.unitid);
      const targets = exists
        ? prev.targets.filter((item) => item.unitid !== inst.unitid)
        : [...prev.targets, { unitid: inst.unitid, name: inst.name, state: inst.state }];
      return { ...prev, targets };
    });
  }

  return (
    <div className="beta-stage">
      <div className="beta-wrap">
        <section className="beta-card">
          <aside className="beta-rail">
            <div className="hero-pill">Step {currentStep + 1} of {STEPS.length}</div>
            <h1>{STEPS[currentStep]}</h1>
            <div className="hero-progress">
              <div className="hero-progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <p className="rail-copy">{STEP_DESCRIPTIONS[currentStep]}</p>
          </aside>

          {currentStep === 0 && (
            <div className="step-col">
              <h2>Tell us about you</h2>
              <div className="grid-two">
                <LabeledInput
                  label="Preferred name"
                  value={form.full_name}
                  onChange={(e) => updateField("full_name", e.target.value)}
                  placeholder="Alex Johnson"
                  required
                />
                <LabeledInput
                  label="City"
                  value={form.city}
                  onChange={(e) => updateField("city", e.target.value)}
                  placeholder="Seattle"
                  required
                />
                <LabeledInput
                  label="State / Region"
                  value={form.region}
                  onChange={(e) => updateField("region", e.target.value)}
                  placeholder="WA"
                  required
                />
              </div>
            </div>
          )}

          {currentStep === 1 && (
            <div className="step-col">
              <h2>High school details</h2>
              <LabeledInput
                label="Expected graduation year"
                type="number"
                min={new Date().getFullYear()}
                max={new Date().getFullYear() + 6}
                value={form.grad_year}
                onChange={(e) => updateField("grad_year", Number(e.target.value))}
              />
              <LabeledInput
                label="High school"
                value={form.high_school}
                onChange={(e) => updateField("high_school", e.target.value)}
                placeholder="Los Angeles College Prep Academy"
                required
              />
            </div>
          )}

          {currentStep === 2 && (
            <div className="step-col">
              <h2>Your current GPA</h2>
              <div className="gpa-wheel">
                <div className="gpa-value">{form.gpa.toFixed(1)} / 4.0</div>
                <GpaWheel value={form.gpa} onChange={(val) => updateField("gpa", val)} />
                <p className="hint">Scroll to match your unweighted GPA to the nearest tenth.</p>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="step-col">
              <h2>Testing</h2>
              <div className="pill-wrap">
                <button
                  type="button"
                  className={form.tests.includes("sat") ? "pill active" : "pill"}
                  onClick={() => toggleTest("sat")}
                  aria-pressed={form.tests.includes("sat")}
                >
                  SAT
                </button>
                <button
                  type="button"
                  className={form.tests.includes("act") ? "pill active" : "pill"}
                  onClick={() => toggleTest("act")}
                  aria-pressed={form.tests.includes("act")}
                >
                  ACT
                </button>
                <button
                  type="button"
                  className={form.tests.includes("none") ? "pill active" : "pill"}
                  onClick={() => toggleTest("none")}
                  aria-pressed={form.tests.includes("none")}
                >
                  None yet
                </button>
              </div>

              {form.tests.includes("sat") && (
                <div className="grid-two">
                  <LabeledInput
                    label="SAT Math"
                    type="number"
                    min={200}
                    max={800}
                    step={10}
                    inputMode="numeric"
                    value={form.sat_math}
                    onChange={(e) => updateField("sat_math", e.target.value)}
                    onBlur={() => clampScore("sat_math", { min: 200, max: 800, step: 10 })}
                    required
                  />
                  <LabeledInput
                    label="SAT Reading & Writing"
                    type="number"
                    min={200}
                    max={800}
                    step={10}
                    inputMode="numeric"
                    value={form.sat_ebrw}
                    onChange={(e) => updateField("sat_ebrw", e.target.value)}
                    onBlur={() => clampScore("sat_ebrw", { min: 200, max: 800, step: 10 })}
                    required
                  />
                  <div className="sat-total">
                    Total: {(Number(form.sat_math) || 0) + (Number(form.sat_ebrw) || 0)}
                  </div>
                </div>
              )}

              {form.tests.includes("act") && (
                <LabeledInput
                  label="ACT composite"
                  type="number"
                  min={1}
                  max={36}
                  step={1}
                  inputMode="numeric"
                  value={form.act_composite}
                  onChange={(e) => updateField("act_composite", e.target.value)}
                  onBlur={() => clampScore("act_composite", { min: 1, max: 36, step: 1 })}
                  required
                />
              )}
            </div>
          )}

          {currentStep === 4 && (
            <div className="step-col">
              <h2>Create your target list</h2>
              <LabeledInput
                label="Search universities"
                value={targetQuery}
                onChange={(e) => setTargetQuery(e.target.value)}
                placeholder="Start typing a university name"
              />
              <div className="target-results">
                {filteredTargets.length === 0 && targetQuery.trim().length >= 2 && (
                  <p className="empty">No universities found. Try another search term.</p>
                )}
                {filteredTargets.map((inst) => {
                  const active = form.targets.some((item) => item.unitid === inst.unitid);
                  return (
                    <button
                      type="button"
                      key={inst.unitid}
                      className={active ? "target-chip active" : "target-chip"}
                      onClick={() => toggleTarget(inst)}
                    >
                      <span>{inst.name}</span>
                      <small>{inst.state}</small>
                    </button>
                  );
                })}
              </div>
              {form.targets.length > 0 && (
                <div className="selected-targets">
                  {form.targets.map((inst) => (
                    <span key={inst.unitid} className="selected-chip">
                      {inst.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {currentStep === 5 && (
            <div className="step-col">
              <h2>Extracurricular highlights</h2>
              <p className="hint">
                Share what you did, the impact, recognition, and time commitment. We&apos;ll condense it
                into a standout bullet.
              </p>
              <div className="chat-window">
                {messages.map((msg) => (
                  <div key={msg.id} className={msg.role === "user" ? "bubble user" : "bubble assistant"}>
                    {msg.content}
                  </div>
                ))}
              </div>
              <form className="chat-input" onSubmit={handleExtracurricularSubmit}>
                <textarea
                  rows={3}
                  value={draftExtra}
                  onChange={(e) => setDraftExtra(e.target.value)}
                  placeholder="e.g., Led environmental club, organized cleanup with 120 volunteers, raised $5k"
                  required
                />
                <button type="submit" disabled={chatLoading}>Add highlight</button>
              </form>
              {chatLoading && <div className="chat-status">Summarizing your highlight...</div>}
            </div>
          )}
        </section>

        <footer className="beta-actions">
          <button type="button" className="ghost" onClick={handleBack} disabled={currentStep === 0 || saving}>
            Back
          </button>
          <button type="button" onClick={handleNext} disabled={!stepValid || saving}>
            {currentStep === STEPS.length - 1 ? "Finish" : "Save & Continue"}
          </button>
        </footer>
      </div>
    </div>
  );
}

function LabeledInput({ label, required, ...rest }) {
  return (
    <label className="field">
      <span>{label}{required ? " *" : ""}</span>
      <input required={required} {...rest} />
    </label>
  );
}

function formatHighlight(highlight) {
  if (!highlight) return "";
  const headline = highlight.headline || "Activity highlight";
  const narrative = highlight.narrative || "";
  return narrative ? `${headline}: ${narrative}` : headline;
}

function normalizeHighlight(summary, fallback, rawText) {
  if (summary && typeof summary === "object") {
    return {
      headline: summary.headline?.trim() || fallback.headline,
      narrative: summary.narrative?.trim() || fallback.narrative
    };
  }
  if (typeof summary === "string" && summary.trim()) {
    return {
      headline: fallback.headline,
      narrative: summary.trim()
    };
  }
  return {
    headline: fallback.headline,
    narrative: fallback.narrative || rawText
  };
}

function buildFallbackHighlight(text) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) {
    return {
      headline: "Activity highlight",
      narrative: "Shared extracurricular details."
    };
  }
  const sentence = clean.charAt(0).toUpperCase() + clean.slice(1);
  const headline = sentence.split(/[.!?]/)[0].split(/[,;:-]/)[0].trim().slice(0, 64);
  return {
    headline: headline || "Activity highlight",
    narrative: sentence
  };
}

function isSatScoreValid(value) {
  const num = Number(value);
  return Number.isFinite(num) && Number.isInteger(num) && num >= 200 && num <= 800 && num % 10 === 0;
}

function isActScoreValid(value) {
  const num = Number(value);
  return Number.isFinite(num) && Number.isInteger(num) && num >= 1 && num <= 36;
}
