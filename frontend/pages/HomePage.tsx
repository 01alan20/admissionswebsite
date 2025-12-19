import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../services/supabaseClient";
import { useOnboardingContext } from "../context/OnboardingContext";
import { CalendarCheck2, GraduationCap, ScrollText, Sparkles } from "lucide-react";

type InstitutionRow = {
  unitid: number;
  name: string;
  city: string | null;
  state: string | null;
  control: string | null;
  level: string | null;
  acceptance_rate: number | null;
  tuition_2023_24: number | null;
  test_policy: string | null;
};

type EssayRow = {
  id: number;
  school: string | null;
  year: number | null;
  type: string | null;
  category: string | null;
  prompt: string | null;
  essay: string;
};

type FeatureHighlight = {
  label: string;
  icon: React.ReactNode;
};

const countWords = (value: string | null | undefined): number => {
  if (!value) return 0;
  return value.trim().split(/\s+/).filter(Boolean).length;
};

const moneyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const HomePage: React.FC = () => {
  const { user } = useOnboardingContext();
  const showcaseUnitIds = useMemo(
    () => [166027, 166683, 243744, 123961, 193900],
    []
  );
  const minEssayWords = 100;
  const [institutions, setInstitutions] = useState<InstitutionRow[]>([]);
  const [essays, setEssays] = useState<EssayRow[]>([]);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    document.title = "SeeThrough Admissions | College planning workspace";
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }
    meta.setAttribute(
      "content",
      "Build your profile, explore colleges, and learn from successful applications and essays."
    );
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [{ data: instData }, { data: essayData }] = await Promise.all([
          supabase
            .from("institutions")
            .select(
              "unitid,name,city,state,control,level,acceptance_rate,tuition_2023_24,test_policy"
            )
            .in("unitid", showcaseUnitIds),
          supabase
            .from("anonymous_essays")
            .select("id,school,year,type,category,prompt,essay")
            .order("id", { ascending: false })
            .limit(10),
        ]);

        if (cancelled) return;

        const instSorted = (instData as InstitutionRow[] | null) ?? [];
        instSorted.sort(
          (a, b) =>
            showcaseUnitIds.indexOf(a.unitid) - showcaseUnitIds.indexOf(b.unitid)
        );
        setInstitutions(instSorted);

        setEssays((essayData as EssayRow[] | null) ?? []);
      } catch {
        // Silent: landing page still renders without live data.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showcaseUnitIds]);

  const handleQuickSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmail || !authPassword || authLoading) return;
    setAuthLoading(true);
    setAuthError(null);
    setAuthMessage(null);
    try {
      const { error } = await supabase.auth.signUp({
        email: authEmail,
        password: authPassword,
      });
      if (error) throw error;
      setAuthMessage("Account created. Check your inbox to verify, then log in.");
    } catch (err: any) {
      setAuthError(err?.message ?? "Failed to create account.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    if (authLoading) return;
    setAuthLoading(true);
    setAuthError(null);
    setAuthMessage(null);
    try {
      const redirectTo = `${window.location.origin}/auth/callback`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      });
      if (error) throw error;
    } catch (err: any) {
      setAuthError(err?.message ?? "Google sign-in failed. Please try again.");
    } finally {
      setAuthLoading(false);
    }
  };

  const fallbackInstitutions = useMemo<InstitutionRow[]>(
    () => [
      {
        unitid: 166027,
        name: "Harvard University",
        city: "Cambridge",
        state: "MA",
        control: "Private nonprofit",
        level: "4-year",
        acceptance_rate: 0.04,
        tuition_2023_24: 59076,
        test_policy: "Test optional",
      },
      {
        unitid: 166683,
        name: "Massachusetts Institute of Technology",
        city: "Cambridge",
        state: "MA",
        control: "Private nonprofit",
        level: "4-year",
        acceptance_rate: 0.04,
        tuition_2023_24: 57986,
        test_policy: "Test optional",
      },
      {
        unitid: 243744,
        name: "Stanford University",
        city: "Stanford",
        state: "CA",
        control: "Private nonprofit",
        level: "4-year",
        acceptance_rate: 0.04,
        tuition_2023_24: 62484,
        test_policy: "Test optional",
      },
      {
        unitid: 123961,
        name: "University of Southern California",
        city: "Los Angeles",
        state: "CA",
        control: "Private nonprofit",
        level: "4-year",
        acceptance_rate: null,
        tuition_2023_24: 69798,
        test_policy: "Test optional",
      },
      {
        unitid: 193900,
        name: "New York University",
        city: "New York",
        state: "NY",
        control: "Private nonprofit",
        level: "4-year",
        acceptance_rate: null,
        tuition_2023_24: 62000,
        test_policy: "Test optional",
      },
    ],
    []
  );

  const displayInstitutions = useMemo(() => {
    const chosen: InstitutionRow[] = [];
    const seen = new Set<number>();
    for (const inst of institutions) {
      if (seen.has(inst.unitid)) continue;
      seen.add(inst.unitid);
      chosen.push(inst);
      if (chosen.length >= 5) return chosen.slice(0, 5);
    }
    for (const inst of fallbackInstitutions) {
      if (seen.has(inst.unitid)) continue;
      seen.add(inst.unitid);
      chosen.push(inst);
      if (chosen.length >= 5) break;
    }
    return chosen.slice(0, 5);
  }, [institutions, fallbackInstitutions]);

  const fallbackEssays = useMemo<EssayRow[]>(
    () => [
      {
        id: 1,
        school: "Example",
        year: 2023,
        type: "Common App Essay",
        category: "Personal Growth",
        prompt: "Tell us about a time you challenged yourself.",
        essay:
          "I used to avoid speaking up, even when I had an answer. In group projects I became the “quiet finisher,” the person who cleaned up slides and fixed formatting while everyone else argued about ideas. That worked until my biology lab partnered with a local clinic to analyze water samples from a neighborhood with frequent boil notices. The data didn’t match the story we expected, and the easy explanation was to blame our technique. I re-ran the test after school, documented every step, and realized our sampling locations were wrong.\n\nI brought it up anyway. My voice shook, but I laid out the evidence and suggested a revised plan. The room went silent—then our team lead asked me to run the next collection route. That weekend, we mapped the neighborhood, spoke with residents, and produced a report the clinic used in a grant application for updated filtration. I didn’t just learn how to challenge myself; I learned that clarity and care can be louder than confidence.",
      },
      {
        id: 2,
        school: "Example",
        year: 2022,
        type: "Supplemental Essay",
        category: "Why This College",
        prompt: "Why are you applying to this university?",
        essay:
          "What drew me in wasn’t the name—it was the way students build projects with real impact. I’ve learned best when I’m solving a real problem with other people: tutoring a ninth grader who thought math “wasn’t for him,” building a small budgeting tool for my family, and organizing a campus clean‑up that turned into a long-term recycling partnership with our city.\n\nI’m applying because I want an environment where curiosity is translated into action. Your emphasis on interdisciplinary work—where computer science can sit next to psychology, where research groups welcome undergraduates, and where student organizations collaborate with local communities—matches how I learn. I can already picture myself in the lab meeting where ideas are tested, not just praised, and in the seminar where we argue thoughtfully and leave with a plan.\n\nMost importantly, I want to contribute to a campus culture that treats ambition as responsibility. I’m not looking for a place to collect achievements; I’m looking for a place to build things that last.",
      },
    ],
    []
  );

  const displayEssays = useMemo(() => {
    const candidates = essays.filter((e) => countWords(e.essay) >= minEssayWords);
    const picked = candidates.slice(0, 2);
    if (picked.length >= 2) return picked.slice(0, 2);
    return [...picked, ...fallbackEssays].slice(0, 2);
  }, [essays, fallbackEssays]);

  return (
    <div className="w-full px-4 py-6 sm:px-6 lg:px-10 space-y-10 sm:space-y-12">
      <section className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-slate-50/70 px-6 py-10 sm:px-10 sm:py-14">
          <div className="grid gap-10 lg:grid-cols-[1.25fr,0.75fr] items-start">
            <div>
              <h1 className="mt-2 text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight">
                Your college admissions, simplified
              </h1>
              <p className="mt-4 text-base sm:text-lg text-slate-600 max-w-2xl">
                Unlock testing, colleges & tracking to get into your dream school.
              </p>

              <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { label: "College Explorer", icon: <GraduationCap className="h-4 w-4 text-blue-700" /> },
                  { label: "Smart Tracking", icon: <Sparkles className="h-4 w-4 text-blue-700" /> },
                  { label: "Admissions Timeline", icon: <CalendarCheck2 className="h-4 w-4 text-blue-700" /> },
                  { label: "Real Essays", icon: <ScrollText className="h-4 w-4 text-blue-700" /> },
                ].map((f: FeatureHighlight) => (
                  <div
                    key={f.label}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm flex items-center gap-3"
                  >
                    <div className="h-8 w-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center">
                      {f.icon}
                    </div>
                    <div className="text-sm font-semibold text-slate-900">{f.label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6">
              {!user ? (
                <>
                  <h2 className="text-lg font-semibold text-slate-900">
                    Create your free account
                  </h2>
                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={handleGoogleSignup}
                      disabled={authLoading}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-60"
                    >
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white">
                        <svg viewBox="0 0 48 48" className="h-5 w-5">
                          <path
                            fill="#EA4335"
                            d="M24 9.5c3.54 0 6 1.54 7.38 2.83l5.4-5.27C33.94 3.64 29.6 1.5 24 1.5 14.96 1.5 7.18 7.44 4.2 15.64l6.68 5.18C12.4 13.6 17.74 9.5 24 9.5z"
                          />
                          <path
                            fill="#34A853"
                            d="M46.5 24.5c0-1.53-.14-2.99-.41-4.41H24v8.35h12.7c-.55 2.83-2.21 5.22-4.7 6.84l7.17 5.56c4.19-3.87 7-9.54 7-16.34z"
                          />
                          <path
                            fill="#4A90E2"
                            d="M10.88 29.82a14.5 14.5 0 0 1-.77-4.32c0-1.5.27-2.95.75-4.32l-6.68-5.18C2.64 18.45 1.5 21.1 1.5 24c0 2.9 1.14 5.55 2.68 7.99l6.7-2.17z"
                          />
                          <path
                            fill="#FBBC05"
                            d="M24 46.5c6.6 0 12.12-2.17 16.16-5.92l-7.17-5.56c-2 1.34-4.58 2.13-8.99 2.13-6.26 0-11.6-4.1-13.12-9.64l-6.7 2.17C7.18 40.56 14.96 46.5 24 46.5z"
                          />
                        </svg>
                      </span>
                      Continue with Google
                    </button>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <div className="flex-1 h-px bg-slate-200" />
                      <span>or use email</span>
                      <div className="flex-1 h-px bg-slate-200" />
                    </div>
                  </div>

                  <form onSubmit={handleQuickSignup} className="mt-2 space-y-3">
                    <div>
                      <label
                        htmlFor="landing-email"
                        className="block text-sm font-medium text-slate-700 mb-1"
                      >
                        Email
                      </label>
                      <input
                        id="landing-email"
                        name="email"
                        type="email"
                        required
                        value={authEmail}
                        onChange={(e) => setAuthEmail(e.target.value)}
                        autoComplete="email"
                        placeholder="email"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 text-sm"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="landing-password"
                        className="block text-sm font-medium text-slate-700 mb-1"
                      >
                        Password
                      </label>
                      <input
                        id="landing-password"
                        name="password"
                        type="password"
                        required
                        value={authPassword}
                        onChange={(e) => setAuthPassword(e.target.value)}
                        autoComplete="new-password"
                        placeholder="Create a password"
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 text-sm"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={authLoading}
                      className="w-full inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-white font-semibold hover:bg-blue-700 disabled:opacity-60"
                    >
                      {authLoading ? "Creating..." : "Get Started Now"}
                    </button>

                    {authMessage && (
                      <p className="text-sm text-emerald-700">{authMessage}</p>
                    )}
                    {authError && (
                      <p className="text-sm text-red-600">{authError}</p>
                    )}

                    <p className="text-xs text-slate-500">
                      Already have an account?{" "}
                      <Link
                        to="/profile/login"
                        className="text-blue-700 hover:underline font-semibold"
                      >
                        Log in
                      </Link>
                    </p>
                  </form>
                </>
              ) : (
                <>
                  <h2 className="text-lg font-semibold text-slate-900">
                    You&apos;re logged in
                  </h2>
                  <p className="mt-1 text-sm text-slate-600 truncate">{user.email}</p>
                  <Link
                        to="/profile/my-profile"
                    className="mt-4 w-full inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-white font-semibold hover:bg-blue-700"
                  >
                    Go to dashboard
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center">
              <span className="text-base">🎓</span>
            </div>
            <div>
              <h2 className="text-2xl font-extrabold text-slate-900">College Explorer</h2>
            </div>
          </div>
        </div>

        <div className="flex gap-4 overflow-x-auto pb-2">
          {displayInstitutions.map((inst) => (
            <div
              key={inst.unitid}
              className="min-w-[280px] max-w-[320px] flex-1 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">{inst.name}</h3>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-semibold">
                <span className="inline-flex items-center rounded-full bg-slate-100 text-slate-700 border border-slate-200 px-2 py-1">
                  {inst.control?.toLowerCase().includes("public") ? "Public" : "Private"}
                </span>
                <span className="inline-flex items-center rounded-full bg-blue-50 text-blue-700 border border-blue-200 px-2 py-1">
                  {inst.acceptance_rate != null
                    ? `${Math.round(
                        inst.acceptance_rate > 1
                          ? Math.min(inst.acceptance_rate, 100)
                          : inst.acceptance_rate * 100
                      )}% Acceptance`
                    : "Acceptance N/A"}
                </span>
                <span className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-1">
                  {inst.tuition_2023_24 != null
                    ? `${moneyFormatter.format(inst.tuition_2023_24)}/yr`
                    : "Tuition N/A"}
                </span>
              </div>

              <div className="mt-4 flex items-center gap-3">
                <Link
                  to={`/institution/${inst.unitid}`}
                  className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-white text-sm font-semibold hover:bg-blue-700"
                >
                  View Details
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">
              Real Essays That Got In
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {displayEssays.map((e) => (
              <div
                key={e.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-wrap gap-2 text-xs font-semibold">
                  <span className="inline-flex items-center rounded-full bg-blue-50 text-blue-700 border border-blue-200 px-2 py-1">
                    {e.school ?? "School"}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-1">
                    {e.type ?? "Essay"}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-amber-50 text-amber-700 border border-amber-200 px-2 py-1">
                    {e.category ?? "Category"}
                  </span>
                </div>
                <div className="mt-3">
                  <p className="text-sm font-semibold text-slate-900">
                    {e.prompt ?? "Prompt"}
                  </p>
                  <p className="mt-3 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                    {e.essay}
                  </p>
                </div>
              </div>
            ))}
        </div>
      </section>

      <section className="rounded-2xl bg-blue-600 text-white shadow-sm px-6 py-12 text-center">
        <h2 className="text-4xl font-extrabold">Stop Guessing. Start Planning</h2>
        <div className="mt-6 flex justify-center">
          <Link
            to={user ? "/profile/my-profile" : "/profile/login"}
            className="inline-flex items-center justify-center rounded-lg bg-white px-6 py-3 font-semibold text-blue-700 hover:bg-slate-50"
          >
            Get Started Now
          </Link>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
