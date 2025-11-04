import SearchBox from "../components/SearchBox.jsx";

export default function Home() {
  return (
    <>
      <section
        className="hero"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "32px"
        }}
      >
        <div className="page-intro">
          <div className="kicker">Undergraduate admissions - United States</div>
          <h1 className="h1">
            <span className="gradient-text">Find your US fit, understand costs, plan your visa.</span>
          </h1>
          <p className="sub">
            Search every accredited US university, compare affordability and outcomes, and map the deadlines that keep
            your application on track. Build a confident plan from your first shortlist to your final visa interview.
          </p>
        </div>

        <div style={{ maxWidth: "min(1040px, 100%)" }}>
          <SearchBox />
        </div>
      </section>

      <div className="divider" />

      <section
        className="section"
        style={{
          display: "grid",
          gap: "20px",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))"
        }}
      >
        <article className="card">
          <h3>Cost clarity</h3>
          <p>
            Track tuition history, estimate total cost of attendance, and flag scholarships to discuss with financial aid
            teams.
          </p>
        </article>

        <article className="card">
          <h3>Admissions strategy</h3>
          <p>
            Sort schools by acceptance band, test policy, and academic pathways so your reach, target, and safety list
            stays balanced.
          </p>
        </article>

        <article className="card">
          <h3>Personal support</h3>
          <p>
            Submit your profile for expert review or use the AI advisor for instant answers on visas, testing, and essays.
          </p>
        </article>
      </section>
    </>
  );
}
