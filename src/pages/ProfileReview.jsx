import { useEffect, useMemo, useState } from "react";

function nudge(label, text) {
  return (
    <details style={{ fontSize: 12, color: "#555", marginTop: 6 }}>
      <summary style={{ cursor: "pointer" }}>What to include for {label}?</summary>
      <div style={{ marginTop: 6, lineHeight: 1.3 }}>{text}</div>
    </details>
  );
}

export default function ProfileReview() {
  const [institutions, setInstitutions] = useState([]);
  const [labelToName, setLabelToName] = useState({});
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [u1, setU1] = useState("");
  const [u2, setU2] = useState("");
  const [u3, setU3] = useState("");
  const [academics, setAcademics] = useState("");
  const [extracurricular, setExtracurricular] = useState("");
  const [athletics, setAthletics] = useState("");
  const [personal, setPersonal] = useState("");
  const [recommendations, setRecommendations] = useState("");
  const [alumni, setAlumni] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/data/institutions.json");
        if (!r.ok) throw new Error("Failed to load institutions");
        const data = await r.json();
        setInstitutions(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  const options = useMemo(() => {
    const out = [];
    const map = {};
    for (const inst of institutions) {
      const name = inst.name || inst.institution_name || "";
      const state = inst.state_abbreviation || inst.state || "";
      const label = state ? `${name} (${state})` : name;
      if (name) {
        out.push({ label, name });
        map[label] = name;
      }
    }
    setLabelToName(map);
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [institutions]);

  function onSubmit(e) {
    e.preventDefault();
    setError("");
    setDone(false);

    const trimmedEmail = (email || "").trim();
    if (!trimmedEmail) {
      setError("Please enter your email so we can contact you.");
      return;
    }

    const universities = [u1, u2, u3]
      .map(value => (labelToName[value] ? labelToName[value] : (value || "").trim()))
      .filter(Boolean);

    const sections = [
      ["Name", (contactName || "").trim() || "Not provided"],
      ["Email", trimmedEmail],
      ["Universities", universities.length ? universities.join("; ") : "Not provided"],
      ["Academics", (academics || "").trim() || "Not provided"],
      ["Extracurricular", (extracurricular || "").trim() || "Not provided"],
      ["Athletics", (athletics || "").trim() || "Not provided"],
      ["Personal", (personal || "").trim() || "Not provided"],
      ["Recommendation letters", (recommendations || "").trim() || "Not provided"],
      ["Alumni or interview context", (alumni || "").trim() || "Not provided"]
    ];

    const body = sections
      .map(([label, value]) => `${label}:\n${value}`)
      .join("\n\n");

    const subjectBase = contactName ? `Profile review - ${contactName}` : `Profile review - ${trimmedEmail}`;
    const mailto = `mailto:seethroughuniadmissions@gmail.com?subject=${encodeURIComponent(subjectBase)}&body=${encodeURIComponent(body)}`;

    setSubmitting(true);
    window.location.href = mailto;

    setContactName("");
    setEmail("");
    setU1("");
    setU2("");
    setU3("");
    setAcademics("");
    setExtracurricular("");
    setAthletics("");
    setPersonal("");
    setRecommendations("");
    setAlumni("");
    setDone(true);
    setSubmitting(false);
  }

  return (
    <div style={{ maxWidth: 1000, margin: "24px auto", padding: "16px" }}>
      <h1 style={{ marginTop: 0 }}>Profile Review</h1>
      <p style={{ color: "#444", marginTop: -8 }}>
        Tell us about yourself and pick up to three universities. We will help you identify priorities and follow up by email.
      </p>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 16 }}>
        <div style={{ display: "grid", gap: 8 }}>
          <label>
            Your Name (optional)
            <input
              type="text"
              value={contactName}
              onChange={e => setContactName(e.target.value)}
              style={{ width: "100%", padding: 10, border: "1px solid #ddd", borderRadius: 8 }}
              placeholder="Jane Doe"
              autoComplete="name"
            />
          </label>
          <label>
            Email (required)
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              style={{ width: "100%", padding: 10, border: "1px solid #ddd", borderRadius: 8 }}
              placeholder="jane@email.com"
              autoComplete="email"
            />
          </label>
        </div>

        <div>
          <h3>Target Universities (up to 3)</h3>
          <p style={{ fontSize: 12, color: "#555", marginTop: -8 }}>
            Type to search and pick exact names if possible.
          </p>

          <input
            list="uniList"
            value={u1}
            onChange={e => setU1(e.target.value)}
            placeholder="University 1"
            style={{ width: "100%", padding: 10, border: "1px solid #ddd", borderRadius: 8, marginBottom: 8 }}
          />
          <input
            list="uniList"
            value={u2}
            onChange={e => setU2(e.target.value)}
            placeholder="University 2"
            style={{ width: "100%", padding: 10, border: "1px solid #ddd", borderRadius: 8, marginBottom: 8 }}
          />
          <input
            list="uniList"
            value={u3}
            onChange={e => setU3(e.target.value)}
            placeholder="University 3"
            style={{ width: "100%", padding: 10, border: "1px solid #ddd", borderRadius: 8 }}
          />

          <datalist id="uniList">
            {options.slice(0, 8000).map(opt => (
              <option key={opt.label} value={opt.label} />
            ))}
          </datalist>
        </div>

        <div>
          <h3>Academics</h3>
          <textarea
            value={academics}
            onChange={e => setAcademics(e.target.value)}
            rows={6}
            placeholder="Grades, rigor, testing, notable coursework, research, awards..."
            style={{ width: "100%", padding: 10, border: "1px solid #ddd", borderRadius: 8 }}
          />
          {nudge(
            "Academics",
            "Aim for a clear snapshot: GPA and rigor (honors/AP/IB), score ranges (SAT/ACT) and evidence of originality (research, competitions, publications)."
          )}
        </div>

        <div>
          <h3>Extracurricular</h3>
          <textarea
            value={extracurricular}
            onChange={e => setExtracurricular(e.target.value)}
            rows={6}
            placeholder="Leadership, impact, scale, continuity, outcomes..."
            style={{ width: "100%", padding: 10, border: "1px solid #ddd", borderRadius: 8 }}
          />
          {nudge(
            "Extracurricular",
            "Highlight depth and impact. Describe roles, scope (school, regional, national), and measurable results."
          )}
        </div>

        <div>
          <h3>Athletics</h3>
          <textarea
            value={athletics}
            onChange={e => setAthletics(e.target.value)}
            rows={5}
            placeholder="Sport, level, rankings, recruit status, coach outreach..."
            style={{ width: "100%", padding: 10, border: "1px solid #ddd", borderRadius: 8 }}
          />
          {nudge(
            "Athletics",
            "Note level (varsity, national, club), achievements, and time commitment. Mention coach conversations if recruiting is active."
          )}
        </div>

        <div>
          <h3>Personal</h3>
          <textarea
            value={personal}
            onChange={e => setPersonal(e.target.value)}
            rows={6}
            placeholder="Character, leadership, kindness, challenges overcome..."
            style={{ width: "100%", padding: 10, border: "1px solid #ddd", borderRadius: 8 }}
          />
          {nudge(
            "Personal",
            "Share specific stories that show character, resilience, curiosity, and community impact. Avoid generic claims."
          )}
        </div>

        <div>
          <h3>Recommendation letters</h3>
          <textarea
            value={recommendations}
            onChange={e => setRecommendations(e.target.value)}
            rows={4}
            placeholder="List teacher and counselor recommenders, strength of relationships, and key themes you expect them to cover."
            style={{ width: "100%", padding: 10, border: "1px solid #ddd", borderRadius: 8 }}
          />
          {nudge(
            "Recommendations",
            "Mention who is writing (subjects, context), how well they know you, and any anecdotes or impact stories they can validate."
          )}
        </div>

        <div>
          <h3>Alumni interview</h3>
          <textarea
            value={alumni}
            onChange={e => setAlumni(e.target.value)}
            rows={4}
            placeholder="Share interview availability, previous alumni interactions, or talking points you want help refining."
            style={{ width: "100%", padding: 10, border: "1px solid #ddd", borderRadius: 8 }}
          />
          {nudge(
            "Alumni interview",
            "Include whether you have already interviewed, notes from the conversation, or questions you want to prepare before meeting an alum."
          )}
        </div>

        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <button
            type="submit"
            disabled={submitting}
            style={{
              padding: "10px 16px",
              borderRadius: 8,
              border: "1px solid #222",
              background: "#222",
              color: "#fff"
            }}
          >
            {submitting ? "Preparing email..." : "Draft email to submit"}
          </button>
          {done && <span style={{ color: "green" }}>Email draft opened. Send it to complete your submission.</span>}
          {error && <span style={{ color: "crimson" }}>{error}</span>}
        </div>
      </form>
    </div>
  );
}
