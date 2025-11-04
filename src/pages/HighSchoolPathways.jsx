export default function HighSchoolPathways() {
  return (
    <section>
      <div className="page-intro">
        <h1 className="h1">High School Pathways</h1>
        <p className="sub">
          Understanding how major secondary school curricula structure coursework, assessment, and student choice helps admissions teams interpret transcripts fairly.
          Below is a quick guide to three pathways our applicants report most often, followed by deeper structural notes for each system.
        </p>
      </div>

      <div
        className="section"
        style={{
          display: "grid",
          gap: "20px",
          marginTop: 24,
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
        }}
      >
        <article className="card" style={{ background: "#eef2ff" }}>
          <h2 style={{ marginTop: 0 }}>British Approach</h2>
          <p style={{ color: "#312e81" }}>
            Early specialization. Students narrow to subject clusters by age 16, then focus intensely on 3-4 A Levels. Depth and mastery in chosen disciplines matter more than breadth.
          </p>
          <ul style={{ color: "#4338ca" }}>
            <li>Coursework scaffolds toward national exams run by awarding bodies.</li>
            <li>Extracurriculars exist, but academic performance and predicted grades are primary offer drivers.</li>
          </ul>
        </article>

        <article className="card" style={{ background: "#ecfeff" }}>
          <h2 style={{ marginTop: 0 }}>American Approach</h2>
          <p style={{ color: "#0f766e" }}>
            Broad and cumulative. Students sample many disciplines through a credit-based transcript, layering rigor with honors, AP, and dual enrollment as available.
          </p>
          <ul style={{ color: "#0f766e" }}>
            <li>Course choices sit alongside GPA trends, testing, and activities in holistic review.</li>
            <li>Flexibility allows late pivots toward different majors without penalizing specialization.</li>
          </ul>
        </article>

        <article className="card" style={{ background: "#fef9c3" }}>
          <h2 style={{ marginTop: 0 }}>IB Approach</h2>
          <p style={{ color: "#854d0e" }}>
            Balanced and self-directed. The International Baccalaureate emphasizes inquiry, reflection, and global citizenship through a mix of higher-level depth and required breadth.
          </p>
          <ul style={{ color: "#a16207" }}>
            <li>Independent research (Extended Essay) and Theory of Knowledge demand sustained self-management.</li>
            <li>Creativity, Activity, Service (CAS) ties co-curricular engagement directly to diploma requirements.</li>
          </ul>
        </article>
      </div>

      <div
        className="section"
        style={{
          display: "grid",
          gap: "24px",
          marginTop: 32,
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          alignItems: "start",
        }}
      >
        <article className="card">
          <h2>British Curriculum</h2>
          <p>
            Students typically follow Key Stage 4 (Years 10-11) culminating in General Certificate exams, then progress to advanced study in Years 12-13.
          </p>
          <h3 style={{ marginTop: 12 }}>Curriculum Philosophy</h3>
          <ul>
            <li>Students pair a compulsory core (English, mathematics, sciences) with early specialist choices such as economics, design technology, or triple science.</li>
            <li>Instruction and revision are geared toward externally marked exams, so subject mastery and exam technique weigh heavily in final grades.</li>
            <li>Depth allows students to present clear academic narratives&mdash;for example, physics, mathematics, and further mathematics for engineering applicants.</li>
          </ul>
          <h3 style={{ marginTop: 12 }}>IGCSE vs O Levels</h3>
          <ul>
            <li>IGCSE (International GCSE) is widely offered globally, assessed through written exams, and graded 9-1 or A*-G depending on the board.</li>
            <li>O Levels (Ordinary Levels) follow a similar curriculum but retain the traditional A*-E grading and are more common in select countries.</li>
            <li>Both provide subject foundations; selective universities expect strong results across core subjects (English, math, sciences).</li>
          </ul>
          <h3 style={{ marginTop: 12 }}>A Levels</h3>
          <ul>
            <li>Two-year specialization in three to four subjects, with AS results after Year 12 and final A Level exams in Year 13.</li>
            <li>Grades range from A* to E; predicted grades and external exam scores carry significant weight in offers.</li>
            <li>Students may add A Level Further Mathematics or Extended Project Qualification (EPQ) to showcase rigor.</li>
          </ul>
        </article>

        <article className="card">
          <h2>American Curriculum</h2>
          <p>
            U.S.-style high schools rely on credit accumulation, GPAs, and school-specific course levels that track from grade 9 through 12.
          </p>
          <h3 style={{ marginTop: 12 }}>Curriculum Philosophy</h3>
          <ul>
            <li>General education requirements ensure exposure to English, mathematics, laboratory science, social science, world language, and arts.</li>
            <li>Students can layer electives (computer science, journalism, engineering) while maintaining the ability to pivot interests through junior year.</li>
            <li>Extracurricular leadership, service, and employment often complement academic performance in holistic review.</li>
          </ul>
          <h3 style={{ marginTop: 12 }}>Course Levels</h3>
          <ul>
            <li>Standard, honors, and dual-enrollment classes vary in pace and weighting; honors and dual enrollment signal advanced content.</li>
            <li>Transcripts often list semester grades; counselors may supply school profiles explaining weighting schemes.</li>
          </ul>
          <h3 style={{ marginTop: 12 }}>Advanced Placement (AP)</h3>
          <ul>
            <li>College Board AP courses end with external exams scored 1-5; many colleges award credit for scores of 3 or higher.</li>
            <li>AP availability differs by school; admissions readers consider both number of APs offered and the student&apos;s choices.</li>
            <li>AP Capstone (Seminar and Research) emphasizes college-level inquiry and can strengthen writing credentials.</li>
          </ul>
        </article>

        <article className="card">
          <h2>International Baccalaureate (IB)</h2>
          <p>
            The IB Diploma Programme is a two-year curriculum featuring six subject groups plus three core requirements focused on holistic learning.
          </p>
          <h3 style={{ marginTop: 12 }}>Curriculum Philosophy</h3>
          <ul>
            <li>Balanced breadth: students must cover language and literature, language acquisition, individuals and societies, sciences, mathematics, and the arts (or a substitute elective).</li>
            <li>Self-directed inquiry: the Extended Essay and Theory of Knowledge culminate in research, reflection, and oral presentations.</li>
            <li>Global mindedness: CAS experiences ask students to connect service and creativity to community needs, reinforcing IB learner profile attributes.</li>
          </ul>
          <h3 style={{ marginTop: 12 }}>Structure</h3>
          <ul>
            <li>Students take three Higher Level (HL) and three Standard Level (SL) courses, each assessed through exams and internal assessments.</li>
            <li>Core elements include Theory of Knowledge (TOK), the Extended Essay, and Creativity, Activity, Service (CAS) projects.</li>
            <li>Diploma scores combine subject grades (1-7) with up to three bonus points from TOK and Extended Essay.</li>
          </ul>
          <h3 style={{ marginTop: 12 }}>Admissions Signals</h3>
          <ul>
            <li>Strong HL performance, especially in subjects aligned with intended majors, demonstrates readiness for specialized study.</li>
            <li>Students may earn an IB Course Certificate instead of the full diploma if they do not complete every core component.</li>
            <li>Universities may grant advanced standing for HL scores (commonly 5+) similar to AP or A Level credit.</li>
          </ul>
        </article>
      </div>
    </section>
  );
}
