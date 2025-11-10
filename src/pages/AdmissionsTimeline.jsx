export default function AdmissionsTimeline() {
  return (
    <section>
      <div className="page-intro">
        <h1 className="h1">US Admissions Timeline</h1>
      </div>
      <div className="timeline">
        <Milestone id="grade-9" title="4 Years Out (Grade 9)" summary="Build foundations and explore interests">
          <Checklist items={[
            "Build study habits; target strong GPA",
            "Place into appropriate math and world‑language tracks",
            "Sample clubs/sports/arts; begin depth in 1–2 areas",
            "Start an activity log (hours, roles, impact)",
          ]} />
        </Milestone>

        <Milestone id="grade-10" title="3 Years Out (Grade 10)" summary="Choose rigor, diagnostics, deepen activities">
          <Checklist items={[
            "Plan next‑year schedule (honors/AP/IB/dual when ready)",
            "Take diagnostics (PSAT/Pre‑ACT) and set a testing plan",
            "Pursue roles or measurable outcomes in activities",
            "Visit campuses/virtual tours; note preferences (size, setting, majors)",
            "Use summer for programs, work, volunteering, or self‑driven projects",
          ]} />
        </Milestone>

        <Milestone id="grade-11" title="2 Years Out (Grade 11)" summary="Testing + leadership; build the college list">
          <Checklist items={[
            "Take the most challenging courses you can succeed in",
            "SAT/ACT in spring; retake in fall if needed",
            "AP/IB exams in May",
            "Document outcomes (awards, code, recordings, press)",
            "Build reach/target/safety list; track testing policy and costs",
            "Draft personal statement over summer; outline activities and research prompts",
          ]} />
        </Milestone>

        <Milestone id="grade-12" title="1 Year Out (Grade 12)" summary="Applications, essays, recommendations, aid (more detail)">
          <Checklist items={[
            "Finalize college list and choose ED/EA/RD strategy",
            "Create Common App and Coalition accounts; complete profile + FERPA",
            "Request teacher/counselor recommendations and provide resume",
            "Write and refine personal statement + all supplements",
            "File FAFSA and CSS Profile (if required); track scholarships",
            "Send test scores if needed; request transcripts",
            "Submit apps; check portals and to‑do items",
          ]} />
          <div className="card" style={{ marginTop: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Estimated Windows (typical)</div>
            <ul>
              <li><strong>ED I:</strong> often Nov 1 (mid‑Oct–Nov 15); decisions mid‑Dec; binding</li>
              <li><strong>EA:</strong> often Nov 1 (mid‑Oct–Nov 15); decisions mid‑Dec–Jan; non‑binding; Restrictive EA similar</li>
              <li><strong>ED II:</strong> Jan 1–15; decisions mid‑Feb; binding</li>
              <li><strong>RD:</strong> Jan 1–15 (some Dec 15–Jan 31); decisions Mar–Apr</li>
              <li><strong>Reply by:</strong> May 1 at most colleges</li>
            </ul>
          </div>
        </Milestone>

        <Milestone id="platforms" title="Platforms: Common App & Coalition" summary="Accounts, recommenders, essays, supplements, waivers">
          <Checklist items={[
            "Create accounts (summer before Grade 12); Common App rollover supported",
            "Complete profile, schooling history, coursework, activities, honors",
            "Add colleges; note platform‑specific requirements",
            "Complete FERPA; invite counselor/teachers; align with Naviance/Scoir if used",
            "Review essay prompts; many colleges add platform‑specific supplements",
            "Request fee waivers if eligible; track rounds and deadlines in each platform",
            "After submit: monitor college portals; link test scores and aid forms",
          ]} />
        </Milestone>
      </div>

      <div className="card" style={{ marginTop: 24 }}>
        <h3>Quick Links</h3>
        <ul>
          <li><a href="/explore">Explore universities</a> &mdash; filter by selectivity, budget, majors, and testing.</li>
          <li><a href="/compare">Compare</a> &mdash; side‑by‑side metrics for shortlisted schools.</li>
          <li><a href="/review">Profile Review</a> &mdash; get feedback on academic plan and list balance.</li>
        </ul>
      </div>
    </section>
  );
}

function Milestone({ id, title, summary, children }) {
  return (
    <div id={id} className="milestone">
      <span className="dot" aria-hidden="true" />
      <details open={id === 'grade-12'}>
        <summary>
          <div className="summary-row">
            <span>{title}</span>
            <span className="summary-sub">{summary}</span>
          </div>
        </summary>
        <div style={{ marginTop: 10 }}>{children}</div>
      </details>
    </div>
  );
}

function Checklist({ items = [] }) {
  return (
    <ul style={{ paddingLeft: 18, margin: 0 }}>
      {items.map((text, i) => (
        <li key={i} style={{ marginBottom: 6 }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" />
            <span>{text}</span>
          </label>
        </li>
      ))}
    </ul>
  );
}
