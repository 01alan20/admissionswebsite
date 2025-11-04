import { useEffect, useMemo, useState } from "react";
import confetti from "canvas-confetti";
import { useAuth } from "../context/AuthContext.jsx";
import { supabase } from "../lib/supabaseClient.js";
import { calculateProfileScore, improvementSuggestions } from "../utils/scoring.js";
import "./dashboard.css";

export default function BetaDashboard() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function fetchProfile() {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();
      if (error) console.error(error);
      if (mounted) {
        setProfile(data || null);
        setLoading(false);
        confetti({ particleCount: 60, origin: { y: 0.9 }, spread: 70 });
      }
    }
    if (user?.id) fetchProfile();
    return () => {
      mounted = false;
    };
  }, [user?.id]);

  const metrics = useMemo(() => {
    if (!profile) return null;
    const score = calculateProfileScore(profile);
    const improvements = improvementSuggestions(profile);
    return { score, improvements };
  }, [profile]);

  if (loading) {
    return (
      <div className="dash-loading">
        <div className="spinner" />
        <p>Loading your profile...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="dash-empty">
        <h2>No profile yet</h2>
        <p>Finish onboarding first to unlock your dashboard.</p>
      </div>
    );
  }

  return (
    <div className="dash-shell">
      <header className="dash-hero">
        <div className="hero-pill">Results Ready</div>
        <h1>Your Admission Profile</h1>
        <p>Refreshed {new Date().toLocaleString()}</p>
      </header>

      <section className="dash-score">
        <div className="score-card">
          <div className="score-left">
            <span className="score-label">Profile score</span>
            <span className="score-value">{metrics.score}</span>
            <span className="score-of">/100</span>
          </div>
          <div className="score-bar">
            <div className="score-bar-fill" style={{ width: `${metrics.score}%` }} />
          </div>
          <div className="score-cta">
            <span>Early momentum</span>
            <button type="button" onClick={() => confetti({ particleCount: 200, spread: 80 })}>
              Celebrate 🎉
            </button>
          </div>
        </div>
      </section>

      <section className="dash-grid">
        <article className="dash-card">
          <h3>Profile breakdown</h3>
          <div className="metric">
            <span>GPA</span>
            <Progress value={((profile.gpa || 0) / 4) * 100} label={(profile.gpa || 0).toFixed(2)} />
          </div>
          <div className="metric">
            <span>SAT</span>
            <Progress
              value={
                (((Number(profile.sat_math) || 0) + (Number(profile.sat_ebrw) || 0)) / 1600) * 100
              }
              label={
                (Number(profile.sat_math) || 0) + (Number(profile.sat_ebrw) || 0) || "TBD"
              }
            />
          </div>
          <div className="metric">
            <span>ACT</span>
            <Progress
              value={normalize(Number(profile.act_composite) || 0, 36) * 100}
              label={profile.act_composite || "TBD"}
            />
          </div>
          <div className="metric">
            <span>Extracurriculars</span>
            <Progress
              value={Math.min(profile.extracurriculars?.length || 0, 6) / 6 * 100}
              label={`${profile.extracurriculars?.length || 0}/6`}
            />
          </div>
        </article>

        <article className="dash-card">
          <h3>Top improvements</h3>
          <ul className="improve-list">
            {metrics.improvements.map((item) => (
              <li key={item.label}>
                <span>{item.label}</span>
                <span className="impact">{item.impact}</span>
              </li>
            ))}
          </ul>
        </article>

        <article className="dash-card">
          <h3>Shortlist</h3>
          <ul className="shortlist">
            {(profile.targets || []).map((inst) => (
              <li key={inst.unitid}>
                <strong>{inst.name}</strong>
                <span>{inst.state}</span>
              </li>
            ))}
            {profile.targets?.length === 0 && <li>Add universities in onboarding.</li>}
          </ul>
        </article>

        <article className="dash-card">
          <h3>Essay guidance</h3>
          <p>Coming soon — we will store your drafts and AI feedback here.</p>
        </article>
      </section>
    </div>
  );
}

function Progress({ value, label }) {
  return (
    <div className="progress-item">
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${Math.min(100, value)}%` }} />
      </div>
      <span className="progress-label">{label}</span>
    </div>
  );
}

function normalize(value, max) {
  if (!max) return 0;
  return Math.min(1, Math.max(0, value / max));
}

