import { useEffect, useMemo, useRef, useState } from "react";
import confetti from "canvas-confetti";
import { useAuth } from "../context/AuthContext.jsx";
import { supabase } from "../lib/supabaseClient.js";
import { calculateProfileScore, calculatePotentialScore, improvementSuggestions } from "../utils/scoring.js";
import "./dashboard.css";

export default function BetaDashboard() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const celebratedRef = useRef(false);

  useEffect(() => {
    if (!user?.id) return;
    let mounted = true;
    async function loadProfile() {
      const { data, error } = await supabase.from("profiles").select("*").eq("user_id", user.id).single();
      if (error) console.error(error);
      if (mounted) {
        setProfile(data || null);
        setLoading(false);
        if (data && !celebratedRef.current) {
          confetti({ particleCount: 100, spread: 80, origin: { y: 0.85 } });
          celebratedRef.current = true;
        }
      }
    }
    loadProfile();
    return () => {
      mounted = false;
    };
  }, [user?.id]);

  const metrics = useMemo(() => {
    if (!profile) return null;
    const score = calculateProfileScore(profile);
    const potential = calculatePotentialScore(profile);
    const lift = Math.max(0, potential - score);
    const improvements = improvementSuggestions(profile);

    const gpaPercent = normalize(profile.gpa, 4) * 100;
    const satTotal = (Number(profile.sat_math) || 0) + (Number(profile.sat_ebrw) || 0);
    const satPercent = normalize(satTotal, 1600) * 100;
    const actPercent = normalize(Number(profile.act_composite) || 0, 36) * 100;
    const extraPercent = Math.min(profile.extracurriculars?.length || 0, 6) / 6 * 100;

    return {
      score,
      potential,
      lift,
      improvements,
      breakdown: [
        { label: "GPA", current: gpaPercent, potential: Math.min(gpaPercent + 15, 100), detail: (profile.gpa || 0).toFixed(2) },
        { label: "SAT", current: satPercent, potential: Math.min(satPercent + 20, 100), detail: satTotal ? satTotal : "TBD" },
        { label: "ACT", current: actPercent, potential: Math.min(actPercent + 20, 100), detail: profile.act_composite || "TBD" },
        { label: "Extracurriculars", current: extraPercent, potential: Math.min(extraPercent + 25, 100), detail: `${profile.extracurriculars?.length || 0}/6` }
      ]
    };
  }, [profile]);

  if (loading) {
    return (
      <div className="dash-stage">
        <div className="dash-loading">
          <div className="spinner" />
          <p>Loading your profile...</p>
        </div>
      </div>
    );
  }

  if (!profile || !metrics) {
    return (
      <div className="dash-stage">
        <div className="dash-empty">
          <h2>No profile yet</h2>
          <p>Finish onboarding to view your personalized dashboard.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dash-stage">
      <div className="dash-page">
        <section className="dash-hero">
          <div className="hero-pill">Results ready</div>
          <h1>Your admission momentum</h1>
          <p>Refreshed {new Date().toLocaleString()}</p>
        </section>

        <section className="score-summary">
          <div className="score-main">
            <div className="score-number">{metrics.score}</div>
            <div className="score-meta">
              <span className="score-label">Profile score</span>
              <span className="score-potential">Potential lift +{metrics.lift}</span>
            </div>
          </div>
          <DualBar current={metrics.score} potential={metrics.potential} />
        </section>

        <section className="dash-grid">
          <article className="dash-card">
            <h3>Profile breakdown</h3>
            <div className="breakdown-list">
              {metrics.breakdown.map((item) => (
                <div key={item.label} className="breakdown-row">
                  <div className="row-label">
                    <span>{item.label}</span>
                    <small>{item.detail}</small>
                  </div>
                  <DualBar current={item.current} potential={item.potential} compact />
                </div>
              ))}
            </div>
          </article>

          <article className="dash-card">
            <h3>Top improvements</h3>
            <ul className="lift-list">
              {metrics.improvements.map((item) => (
                <li key={item.label}>
                  <span>{item.label}</span>
                  <span className="lift">{item.impact}</span>
                </li>
              ))}
            </ul>
          </article>

          <article className="dash-card">
            <h3>Your shortlist</h3>
            <ul className="shortlist">
              {(profile.targets || []).map((inst) => (
                <li key={inst.unitid}>
                  <strong>{inst.name}</strong>
                  <span>{inst.state}</span>
                </li>
              ))}
              {(!profile.targets || profile.targets.length === 0) && <li>Add universities during onboarding.</li>}
            </ul>
          </article>

          <article className="dash-card">
            <h3>Next milestones</h3>
            <p>We&apos;re preparing essay tips, deadline reminders, and scholarship matches. Stay tuned!</p>
          </article>
        </section>
      </div>
    </div>
  );
}

function DualBar({ current, potential, compact }) {
  const currentWidth = Math.min(100, Math.max(0, current || 0));
  const potentialWidthRaw = Number.isFinite(potential) ? Math.min(100, Math.max(0, potential)) : currentWidth;
  const potentialWidth = Math.max(currentWidth, potentialWidthRaw);
  return (
    <div className={compact ? "dual-bar compact" : "dual-bar"}>
      <div className="dual-track">
        <div className="dual-potential" style={{ width: `${potentialWidth}%` }} />
        <div className="dual-current" style={{ width: `${currentWidth}%` }} />
      </div>
      <div className="dual-caption">
        <span>Now</span>
        <span>Potential</span>
      </div>
    </div>
  );
}

function normalize(value, max) {
  if (!max) return 0;
  return Math.min(1, Math.max(0, (Number(value) || 0) / max));
}
