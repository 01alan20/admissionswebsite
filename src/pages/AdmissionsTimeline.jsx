export default function AdmissionsTimeline() {
  return (
    <section>
      <div className="page-intro">
        <h1 className="h1">US Admissions Timeline</h1>
        <p className="sub">
          A grade-by-grade roadmap from four years out to application deadlines, including platform steps for Common App and Coalition.
        </p>
      </div>

      <div
        className="section"
        style={{
          display: "grid",
          gap: "24px",
          marginTop: 24,
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          alignItems: "start",
        }}
      >
        <article id="grade-9" className="card">
          <h2>4 Years Out (Grade 9)</h2>
          <ul>
            <li><strong>Academics:</strong> Build study habits, target strong GPA; place into appropriate math/world language tracks.</li>
            <li><strong>Activities:</strong> Sample broadly, then begin depth in 1–2 areas (clubs, sports, arts, community).</li>
            <li><strong>Exploration:</strong> Note interests and possible majors; light college awareness.</li>
            <li><strong>Records:</strong> Start an activity log (hours, roles, impact).</li>
          </ul>
        </article>

        <article id="grade-10" className="card">
          <h2>3 Years Out (Grade 10)</h2>
          <ul>
            <li><strong>Rigor:</strong> Choose next-year courses thoughtfully (honors/AP/IB/dual when prepared).</li>
            <li><strong>Testing:</strong> Take diagnostics (PSAT/Pre‑ACT) to set a plan; no high stakes yet.</li>
            <li><strong>Activities:</strong> Deepen commitment; pursue roles or measurable outcomes.</li>
            <li><strong>Exploration:</strong> Visit local campuses or virtual tours; note preferences (size, setting, majors).</li>
            <li><strong>Summer:</strong> Programs, work, volunteering, or self-driven projects.</li>
          </ul>
        </article>

        <article id="grade-11" className="card">
          <h2>2 Years Out (Grade 11)</h2>
          <ul>
            <li><strong>Course Load:</strong> Take the most challenging courses you can do well in.</li>
            <li><strong>Testing:</strong> SAT/ACT in spring (and a fall retake if needed); AP/IB exams in May.</li>
            <li><strong>Activities:</strong> Leadership and impact; document outcomes (awards, code, recordings, press, recommendations).</li>
            <li><strong>College List:</strong> Build an initial reach/target/safety list; track testing policy and costs.</li>
            <li><strong>Summer before Grade 12:</strong> Draft personal statement; outline activity descriptions; research supplemental prompts.</li>
          </ul>
        </article>

        <article id="grade-12" className="card">
          <h2>1 Year Out (Grade 12)</h2>
          <ul>
            <li><strong>Applications:</strong> Finalize list, decide EA/ED/RD strategy; track deadlines.</li>
            <li><strong>Essays:</strong> Personal statement + supplements; tailor to academic fit and campus resources.</li>
            <li><strong>Recs:</strong> Ask teachers early; provide resume/activity log; waive FERPA where required.</li>
            <li><strong>Financial Aid:</strong> File FAFSA (and CSS Profile if required); organize scholarship apps.</li>
            <li><strong>Submit:</strong> Pay fees or use waivers; send test scores if needed; ensure transcripts are requested.</li>
          </ul>
          <h3 style={{ marginTop: 12 }}>Estimated Windows (typical)</h3>
          <ul>
            <li><strong>Early Decision I (ED I):</strong> deadline often Nov 1 (range mid‑Oct to Nov 15); decisions mid‑December; binding if admitted.</li>
            <li><strong>Early Action (EA):</strong> deadline often Nov 1 (range mid‑Oct to Nov 15); decisions mid‑Dec to Jan; non‑binding. Restrictive EA follows similar dates with limitations.</li>
            <li><strong>Early Decision II (ED II):</strong> deadline often Jan 1–15; decisions mid‑February; binding.</li>
            <li><strong>Regular Decision (RD):</strong> deadlines typically Jan 1–15 (some Dec 15–Jan 31); decisions March–April.</li>
            <li><strong>Response Deadline:</strong> most colleges require an enrollment decision by May 1 (check each college; occasionally later).</li>
          </ul>
        </article>

        <article id="platforms" className="card" style={{ background: "#ecfeff" }}>
          <h2>Platforms: Common App & Coalition</h2>
          <ul style={{ color: "#0f766e" }}>
            <li><strong>Accounts (Summer before Grade 12):</strong> Create accounts on <a href="https://www.commonapp.org/" target="_blank" rel="noreferrer">Common App</a> and <a href="https://www.coalitionforcollegeaccess.org/" target="_blank" rel="noreferrer">Coalition</a>; previous year data can roll over on Common App.</li>
            <li><strong>Profile & Family Info:</strong> Fill demographics, schooling history, coursework, activities, and honors once per platform.</li>
            <li><strong>College Lists:</strong> Add colleges on each platform; note some schools are platform‑specific or support both.</li>
            <li><strong>Recommenders & FERPA:</strong> Complete FERPA release; invite counselor and teachers within the platform; align with Naviance/Scoir if your school uses it.</li>
            <li><strong>Essays:</strong> Common App personal statement prompts are shared across colleges on that platform; Coalition uses its own essay set or college‑specific questions.</li>
            <li><strong>Supplements:</strong> Many colleges add extra questions/essays per platform (majors, short answers, portfolios).</li>
            <li><strong>Fee Waivers:</strong> Request via platform eligibility or counselor approval; some colleges provide codes.</li>
            <li><strong>Deadlines & Rounds:</strong> Track ED/EA/RD per college within each platform; requirements can differ slightly between platforms.</li>
            <li><strong>After Submit:</strong> Monitor portals for checklists; link test scores and financial aid forms.</li>
          </ul>
        </article>
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
