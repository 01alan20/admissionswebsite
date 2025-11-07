import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { BoxPlot, Sparkline } from "../components/Charts.jsx";

function formatCurrency(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return "Not reported";
  return `$${num.toLocaleString()}`;
}

function formatNumber(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return "Not reported";
  return num.toLocaleString();
}

function formatPercent(value, fallback = "Not reported") {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return `${num}%`;
}

function RequirementList({ title, items }) {
  return (
    <div>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>{title}</div>
      {items.length === 0 ? <p style={{ color: "#64748b", fontSize: 13 }}>Not listed</p> : (
        <ul>
          {items.map(item => <li key={`${title}-${item}`}>{item}</li>)}
        </ul>
      )}
    </div>
  );
}

function SummaryStat({ label, value }) {
  return (
    <div style={{ minWidth: 120 }}>
      <div style={{ fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 18 }}>{value}</div>
    </div>
  );
}

function FunnelBar({ pct, label, absolute }) {
  const value = Number.isFinite(Number(pct)) ? Math.max(0, Math.min(100, Number(pct))) : null;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
        <span>{label}</span>
        <span>{value == null ? "Not reported" : `${value}%`}</span>
      </div>
      <div style={{ height: 10, background: "#f0f2f5", borderRadius: 6 }}>
        <div
          style={{
            width: `${value || 0}%`,
            height: "100%",
            borderRadius: 6,
            background: "#4f46e5",
            transition: "width .2s ease"
          }}
        />
      </div>
      {absolute && <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>{absolute}</div>}
    </div>
  );
}

export default function Detail() {
  const { unitid } = useParams();
  const [detail, setDetail] = useState(null);
  const [metricsBundle, setMetricsBundle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [profileRes, metricsRes] = await Promise.all([
          fetch(`/data/institutions/${unitid}.json`),
          fetch(`/data/metrics/${unitid}.json`)
        ]);
        if (!profileRes.ok) throw new Error("Profile not found");
        if (!metricsRes.ok) throw new Error("Metrics not found");
        const profileJson = await profileRes.json();
        const metricsJson = await metricsRes.json();
        if (!cancelled) {
          setDetail(profileJson);
          setMetricsBundle(metricsJson);
        }
      } catch (err) {
        if (!cancelled) setError("We could not load this institution. Try again later.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [unitid]);

  const profile = detail?.profile ?? null;
  const requirements = detail?.requirements ?? { required: [], considered: [], not_considered: [], test_policy: "Test optional" };
  const supportNotes = detail?.support_notes ?? {};
  const metricRows = metricsBundle?.metrics ?? [];
  const tuitionRows = metricsBundle?.tuition ?? [];

  const latestMetrics = useMemo(() => {
    if (!metricRows.length) return null;
    return [...metricRows].sort((a, b) => Number(a.year) - Number(b.year)).slice(-1)[0];
  }, [metricRows]);

  const tuitionSparkData = useMemo(() => {
    if (!tuitionRows.length) return [];
    return tuitionRows
      .filter(row => row.tuition_year && (row.tuition_out_of_state != null || row.tuition_and_fees != null))
      .map(row => ({
        label: row.tuition_year,
        value: Number.isFinite(Number(row.tuition_out_of_state))
          ? Number(row.tuition_out_of_state)
          : Number(row.tuition_and_fees)
      }))
      .filter(row => Number.isFinite(row.value));
  }, [tuitionRows]);

  if (loading) return <p style={{ padding: 24 }}>Loading...</p>;
  if (error) return <p style={{ padding: 24, color: "crimson" }}>{error}</p>;
  if (!profile) return <p style={{ padding: 24 }}>Institution not found.</p>;

  const applicants = latestMetrics?.applicants_total;
  const admitted = latestMetrics?.admitted_est ?? latestMetrics?.admissions_total;
  const enrolled = latestMetrics?.enrolled_est ?? latestMetrics?.enrolled_total;

  const tuitionSummary = profile.tuition_summary ?? {};
  const outOfStateTuition = tuitionSummary.out_of_state ?? tuitionSummary.sticker;
  const inStateTuition = tuitionSummary.in_state ?? tuitionSummary.sticker;

  return (
    <div>
      <p style={{ marginBottom: 16 }}><Link to="/explore">&lt;- Back to Explore</Link></p>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 320px", gap: 24 }}>
        <div>
          <div className="page-intro" style={{ marginBottom: 18 }}>
            <h1 className="h1" style={{ marginBottom: 8 }}>{profile.name}</h1>
            <p style={{ color: "#475569", marginBottom: 12 }}>
            {(profile.city ? `${profile.city}, ` : "")}{profile.state} - {profile.control} - {profile.level}
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              <span className="badge">Test policy: {requirements.test_policy}</span>
              {profile.major_families?.map(family => (
                <span key={family} className="badge">{family}</span>
              ))}
            </div>
          </div>

          <div className="card" style={{ display: "flex", flexWrap: "wrap", gap: 24, marginBottom: 20 }}>
            <SummaryStat label="Acceptance rate" value={formatPercent(profile.outcomes?.acceptance_rate)} />
            <SummaryStat label="Yield" value={formatPercent(profile.outcomes?.yield)} />
            <SummaryStat label="6-year graduation" value={formatPercent(profile.outcomes?.grad_rate_6yr)} />
            <SummaryStat label="Retention" value={formatPercent(profile.outcomes?.retention_full_time)} />
            <SummaryStat label="International students" value={formatPercent(profile.intl_enrollment_pct, "Not reported")} />
            <SummaryStat label="Total enrollment" value={formatNumber(profile.outcomes?.total_enrollment)} />
          </div>

          <div className="card" style={{ marginBottom: 20 }}>
            <h3 style={{ marginTop: 0 }}>Admissions funnel</h3>
            <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
              <div>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Applicants</div>
                <div>{formatNumber(applicants)}</div>
              </div>
              <FunnelBar
                label="Admitted"
                pct={profile.outcomes?.acceptance_rate}
                absolute={formatNumber(admitted) !== "Not reported" ? `${formatNumber(admitted)} students` : ""}
              />
              <FunnelBar
                label="Enrolled"
                pct={profile.outcomes?.yield}
                absolute={formatNumber(enrolled) !== "Not reported" ? `${formatNumber(enrolled)} students` : ""}
              />
            </div>
          </div>

          <div className="card" style={{ marginBottom: 20 }}>
            <h3 style={{ marginTop: 0 }}>International cost planner</h3>
            <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
              <div>
                <div style={{ fontWeight: 600 }}>Out-of-state tuition & fees</div>
                <div>{formatCurrency(outOfStateTuition)}</div>
                <p style={{ color: "#64748b", fontSize: 13, marginTop: 8 }}>
                  Use this as the starting point for your annual cost of attendance. Add housing, health insurance,
                  books, and travel from the university&apos;s cost estimator.
                </p>
              </div>
              <div>
                <div style={{ fontWeight: 600 }}>In-state tuition (reference)</div>
                <div>{formatCurrency(inStateTuition)}</div>
              </div>
            </div>
            {tuitionSparkData.length >= 2 && (
              <div style={{ marginTop: 18 }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Tuition trend (last 4 years)</div>
                <Sparkline
                  data={tuitionSparkData.map(row => row.value)}
                  width={240}
                  height={48}
                />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#64748b", marginTop: 4 }}>
                  <span>{tuitionSparkData[0].label.replace("_", "/")}</span>
                  <span>{tuitionSparkData[tuitionSparkData.length - 1].label.replace("_", "/")}</span>
                </div>
              </div>
            )}
          </div>

          <div className="card" style={{ marginBottom: 20 }}>
            <h3 style={{ marginTop: 0 }}>Admission requirements</h3>
            <p style={{ color: "#64748b", fontSize: 13, marginTop: 0 }}>
              Test policy: <strong>{requirements.test_policy}</strong>
            </p>
            <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
              <RequirementList title="Required" items={requirements.required ?? []} />
              <RequirementList title="Considered" items={requirements.considered ?? []} />
              <RequirementList title="Not considered" items={requirements.not_considered ?? []} />
            </div>
          </div>

          <div className="card" style={{ marginBottom: 24 }}>
            <h3 style={{ marginTop: 0 }}>Test scores & submission rates</h3>
            <p style={{ marginTop: -4, marginBottom: 16, fontSize: 13, color: "#475569" }}>
              Submission percentages reference accepted students reporting each exam. Use the 25th/50th/75th percentile
              scores to gauge how you compare to the latest admitted class.
            </p>

            <ScoreSection
              title="SAT"
              submissionRate={latestMetrics?.percent_of_first_time_degree_certificate_seeking_students_submitting_sat_scores}
              submissionCount={latestMetrics?.number_of_first_time_degree_certificate_seeking_students_submitting_sat_scores}
              plots={[
                {
                  label: "SAT Evidence-Based Reading & Writing",
                  q1: latestMetrics?.sat_evidence_based_reading_and_writing_25th_percentile_score,
                  median: latestMetrics?.sat_evidence_based_reading_and_writing_50th_percentile_score,
                  q3: latestMetrics?.sat_evidence_based_reading_and_writing_75th_percentile_score,
                  domain: [200, 800]
                },
                {
                  label: "SAT Math",
                  q1: latestMetrics?.sat_math_25th_percentile_score,
                  median: latestMetrics?.sat_math_50th_percentile_score,
                  q3: latestMetrics?.sat_math_75th_percentile_score,
                  domain: [200, 800]
                }
              ]}
            />

            <ScoreSection
              title="ACT"
              submissionRate={latestMetrics?.percent_of_first_time_degree_certificate_seeking_students_submitting_act_scores}
              submissionCount={latestMetrics?.number_of_first_time_degree_certificate_seeking_students_submitting_act_scores}
              plots={[
                {
                  label: "ACT Composite",
                  q1: latestMetrics?.act_composite_25th_percentile_score,
                  median: latestMetrics?.act_composite_50th_percentile_score,
                  q3: latestMetrics?.act_composite_75th_percentile_score,
                  domain: [1, 36]
                },
                {
                  label: "ACT Math",
                  q1: latestMetrics?.act_math_25th_percentile_score,
                  median: latestMetrics?.act_math_50th_percentile_score,
                  q3: latestMetrics?.act_math_75th_percentile_score,
                  domain: [1, 36]
                },
                {
                  label: "ACT English",
                  q1: latestMetrics?.act_english_25th_percentile_score,
                  median: latestMetrics?.act_english_50th_percentile_score,
                  q3: latestMetrics?.act_english_75th_percentile_score,
                  domain: [1, 36]
                }
              ]}
            />
          </div>

          <div className="card" style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center" }}>
            <div>
              <h3 style={{ marginTop: 0 }}>Need help crafting your pitch?</h3>
              <p style={{ color: "#64748b", marginBottom: 0 }}>
                Submit your stats and extracurriculars for tailored guidance, or chat with the AI advisor for quick answers.
              </p>
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <Link className="btn-primary" to="/review">Start profile review</Link>
              <Link className="btn-outline" to="/assistant">Open AI advisor</Link>
            </div>
          </div>
        </div>

        <aside style={{ position: "sticky", top: 16, alignSelf: "flex-start", display: "grid", gap: 16 }}>
          <div className="card">
            <div style={{ fontWeight: 700, marginBottom: 12 }}>Quick links</div>
            <div style={{ display: "grid", gap: 8 }}>
              {profile.website && (
                <a
                  href={profile.website.startsWith("http") ? profile.website : `https://${profile.website}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Institution website
                </a>
              )}
              {profile.admissions_url && (
                <a
                  href={profile.admissions_url.startsWith("http") ? profile.admissions_url : `https://${profile.admissions_url}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Admissions website
                </a>
              )}
            </div>
            <p style={{ marginTop: 12, fontSize: 12, color: "#64748b" }}>
              Always confirm visa requirements, scholarship forms, and exact deadlines on the official admissions site—dates vary by program and citizenship.
            </p>
          </div>
          <div className="card">
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Contact checklist</div>
            <ul style={{ paddingLeft: 18, margin: 0, color: "#475569", fontSize: 13 }}>
              <li>Confirm document deadlines for your citizenship</li>
              <li>Request estimated cost of attendance (including insurance)</li>
              <li>Ask about scholarships and need-based aid eligibility</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

function SupportBullet({ title, note }) {
  return (
    <div>
      <div style={{ fontWeight: 600 }}>{title}</div>
      <p style={{ marginTop: 4, color: "#475569", fontSize: 14 }}>{note}</p>
    </div>
  );
}

function ScoreSection({ title, submissionRate, submissionCount, plots }) {
  return (
    <section style={{ marginTop: 28 }}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>{title}</div>
      <div style={{ marginBottom: 10, fontSize: 14, color: "#475569" }}>
        Test submission: {formatPercent(submissionRate)}{Number.isFinite(Number(submissionCount)) ? ` (${Number(submissionCount).toLocaleString()} students)` : ""}
      </div>
      <div style={{ display: "grid", gap: 24, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        {plots.map(plot => (
          <BoxPlot
            key={plot.label}
            label={plot.label}
            q1={plot.q1}
            median={plot.median}
            q3={plot.q3}
            domain={plot.domain}
          />
        ))}
      </div>
    </section>
  );
}
