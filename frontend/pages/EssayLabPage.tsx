import React, { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import DashboardLayout from "../components/DashboardLayout";
import { useOnboardingContext } from "../context/OnboardingContext";
import { getInstitutionsSummariesByIds } from "../data/api";
import { generateEssayDraft } from "../services/essayGenerationService";
import { requestEssayFeedback, type EssayFeedback } from "../services/essayFeedbackService";
import { supabase } from "../services/supabaseClient";
import { countWords, getEssayLabRequirements } from "../utils/essayLabRequirements";

type EssayType = "personal" | "supplement" | "piq";

type Draft = {
  id: string;
  title: string;
  prompt: string;
  essay: string;
  essayType: EssayType;
  targetWordCount: number;
  updatedAt: string;
  feedback?: EssayFeedback | null;
};

type EssayDraftsPayload = {
  drafts: Draft[];
  updatedAt: string;
  feedbackRequests?: number;
};

const nowIso = () => new Date().toISOString();
const randomId = () => Math.random().toString(36).slice(2, 10);

const MAX_ESSAYS = 3;

const clampInt = (value: unknown, fallback: number): number => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.floor(n));
};

const clampWordCount = (value: unknown, fallback: number): number => {
  const n = clampInt(value, fallback);
  if (n < 100) return 100;
  if (n > 1500) return 1500;
  return n;
};

const normalizeEssayType = (value: unknown): EssayType => {
  if (value === "supplement" || value === "piq" || value === "personal") return value;
  return "personal";
};

const EssayLabPage: React.FC = () => {
  const { user, studentProfile, targetUnitIds } = useOnboardingContext();
  const location = useLocation();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [generationLoading, setGenerationLoading] = useState(false);
  const [feedbackRequests, setFeedbackRequests] = useState(0);
  const [demographics, setDemographics] = useState<Record<string, any> | null>(null);

  const saveTimerRef = useRef<number | null>(null);

  const selectedDraft = useMemo(
    () => drafts.find((d) => d.id === selectedDraftId) ?? null,
    [drafts, selectedDraftId]
  );

  const persistDrafts = async (nextDrafts: Draft[], nextFeedbackRequests: number) => {
    if (!user) return;
    setSaving(true);
    try {
      const payload: EssayDraftsPayload = {
        drafts: nextDrafts,
        updatedAt: nowIso(),
        feedbackRequests: nextFeedbackRequests,
      };
      await supabase.from("profiles").upsert(
        {
          user_id: user.id,
          essay_drafts: payload,
        },
        { onConflict: "user_id" }
      );
    } finally {
      setSaving(false);
    }
  };

  const queuePersist = (nextDrafts: Draft[], nextFeedbackRequests: number) => {
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      void persistDrafts(nextDrafts, nextFeedbackRequests);
    }, 650);
  };

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);

        const { data: profileRow, error: profileErr } = await supabase
          .from("profiles")
          .select("essay_drafts, demographics")
          .eq("user_id", user.id)
          .maybeSingle();
        if (profileErr) throw profileErr;

        const raw = (profileRow as any)?.essay_drafts as EssayDraftsPayload | null | undefined;
        const demographicsRow = ((profileRow as any)?.demographics ?? null) as
          | Record<string, any>
          | null;

        const loadedDrafts: Draft[] = Array.isArray(raw?.drafts) ? raw!.drafts : [];
        const safeDrafts = loadedDrafts
          .filter((d) => d && typeof d === "object")
          .map((d: any) => ({
            id: String(d.id ?? randomId()),
            title: String(d.title ?? "Untitled"),
            prompt: String(d.prompt ?? ""),
            essay: String(d.essay ?? ""),
            essayType: normalizeEssayType(d.essayType),
            targetWordCount: clampWordCount(d.targetWordCount, 500),
            updatedAt: String(d.updatedAt ?? nowIso()),
            feedback: d.feedback ?? null,
          }));

        const requests = clampInt(raw?.feedbackRequests, 0);

        if (!cancelled) {
          setDrafts(safeDrafts);
          setSelectedDraftId(safeDrafts[0]?.id ?? null);
          setFeedbackRequests(requests);
          setDemographics(demographicsRow);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load your essays.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const createDraft = () => {
    if (drafts.length >= MAX_ESSAYS) {
      setError(`You can store up to ${MAX_ESSAYS} essays right now. Delete one to add another.`);
      return;
    }
    const draft: Draft = {
      id: randomId(),
      title: "New Essay",
      prompt: "",
      essay: "",
      essayType: "personal",
      targetWordCount: 500,
      updatedAt: nowIso(),
      feedback: null,
    };
    const next = [draft, ...drafts];
    setDrafts(next);
    setSelectedDraftId(draft.id);
    setError(null);
    queuePersist(next, feedbackRequests);
  };

  const updateDraft = (id: string, patch: Partial<Draft>) => {
    const next = drafts.map((d) =>
      d.id === id ? { ...d, ...patch, updatedAt: nowIso() } : d
    );
    setDrafts(next);
    queuePersist(next, feedbackRequests);
  };

  const deleteDraft = (id: string) => {
    const next = drafts.filter((d) => d.id !== id);
    setDrafts(next);
    setSelectedDraftId(next[0]?.id ?? null);
    queuePersist(next, feedbackRequests);
  };

  const ensureProfileComplete = (purpose: "feedback" | "generation"): boolean => {
    const req = getEssayLabRequirements({ demographics, targetUnitIds, studentProfile });
    if (!req.missing.length) return true;
    const verb = purpose === "generation" ? "generate an essay" : "use essay feedback";
    setError(
      `Complete your profile to ${verb}: ${req.missing.join(
        ", "
      )}. Update /profile/my-profile and pick target schools in /profile/colleges.`
    );
    return false;
  };

  const runFeedback = async () => {
    if (!selectedDraft || !user) return;
    if (!ensureProfileComplete("feedback")) return;
    try {
      setFeedbackLoading(true);
      setError(null);

      const context = {
        majors: studentProfile.majors ?? [],
        country: studentProfile.country ?? null,
        city: studentProfile.city ?? null,
        gpa: studentProfile.gpa ?? null,
        satMath: studentProfile.satMath ?? null,
        satEBRW: studentProfile.satEBRW ?? null,
        satTotal: studentProfile.satTotal ?? null,
        actComposite: studentProfile.actComposite ?? null,
      };

      const feedback = await requestEssayFeedback({
        essay: selectedDraft.essay,
        prompt: selectedDraft.prompt,
        context,
        essayType: selectedDraft.essayType,
        targetWordCount: selectedDraft.targetWordCount,
      });

      const nextRequests = feedbackRequests + 1;
      const nextDrafts = drafts.map((d) =>
        d.id === selectedDraft.id ? { ...d, feedback, updatedAt: nowIso() } : d
      );

      setFeedbackRequests(nextRequests);
      setDrafts(nextDrafts);
      await persistDrafts(nextDrafts, nextRequests);
    } catch (e: any) {
      setError(e?.message || "Failed to generate feedback.");
    } finally {
      setFeedbackLoading(false);
    }
  };

  const runGeneration = async () => {
    if (!selectedDraft || !user) return;
    if (!ensureProfileComplete("generation")) return;
    if (
      (selectedDraft.essayType === "supplement" || selectedDraft.essayType === "piq") &&
      !selectedDraft.prompt.trim()
    ) {
      setError("Add the essay prompt first (required for supplements and PIQs).");
      return;
    }
    try {
      setGenerationLoading(true);
      setError(null);

      const schoolIds = (targetUnitIds ?? []).slice(0, 10);
      let targetSchools: Array<{ unitid: number; name?: string | null }> = schoolIds.map(
        (id) => ({ unitid: Number(id) })
      );
      try {
        const summaries = await getInstitutionsSummariesByIds(schoolIds);
        targetSchools = summaries.map((s) => ({
          unitid: Number((s as any).unitid),
          name: (s as any).name ?? null,
        }));
      } catch {
        // fallback to IDs only
      }

      const ctx = {
        name: `${studentProfile.firstName ?? ""} ${studentProfile.lastName ?? ""}`.trim() || null,
        location: {
          country: demographics?.country ?? studentProfile.country ?? null,
          city: demographics?.city ?? studentProfile.city ?? null,
        },
        demographics: {
          gender: demographics?.gender ?? null,
          race: demographics?.race ?? null,
          gradYear: demographics?.grad_year ?? null,
        },
        academics: {
          gpa: studentProfile.gpa ?? null,
          majors: studentProfile.majors ?? [],
          satTotal: studentProfile.satTotal ?? null,
          actComposite: studentProfile.actComposite ?? null,
        },
        activities: studentProfile.activities ?? [],
      };

      const generated = await generateEssayDraft({
        essayType: selectedDraft.essayType,
        prompt: selectedDraft.prompt,
        targetWordCount: selectedDraft.targetWordCount,
        context: ctx,
        targetSchools,
      });

      const nextDrafts = drafts.map((d) =>
        d.id === selectedDraft.id ? { ...d, essay: generated, feedback: null, updatedAt: nowIso() } : d
      );
      setDrafts(nextDrafts);
      await persistDrafts(nextDrafts, feedbackRequests);
    } catch (e: any) {
      setError(e?.message || "Failed to generate an essay draft.");
    } finally {
      setGenerationLoading(false);
    }
  };

  if (!user) {
    const next = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={`/profile/login?next=${encodeURIComponent(next)}`} replace />;
  }

  const rubric = selectedDraft?.feedback?.rubric_scores ?? null;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <header className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <p className="text-xs uppercase tracking-wide text-brand-secondary font-semibold">
            Essay Lab
          </p>
          <h1 className="text-3xl font-bold text-slate-900 mt-1">Essay Lab</h1>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-600">
            <span>Draft up to {MAX_ESSAYS} essays, generate drafts, and get feedback.</span>
            <span className="text-slate-400">•</span>
            <span>
              Feedback requests: <span className="font-semibold">{feedbackRequests}</span>
            </span>
            {saving && (
              <>
                <span className="text-slate-400">•</span>
                <span>Saving...</span>
              </>
            )}
          </div>
        </header>

        {loading ? (
          <div className="py-10 text-sm text-slate-600">Loading your essays...</div>
        ) : error ? (
          <div className="bg-white rounded-2xl border border-red-200 p-4 text-sm text-red-600">
            {error}
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">
            <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-slate-900">Your Essays</h2>
                <button
                  type="button"
                  onClick={createDraft}
                  className="px-3 py-1.5 rounded-full bg-blue-600 text-white text-xs font-semibold"
                >
                  New
                </button>
              </div>
              <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
                {drafts.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setSelectedDraftId(d.id)}
                    className={`w-full text-left p-3 rounded-xl border transition ${
                      d.id === selectedDraftId
                        ? "border-brand-secondary bg-indigo-50"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-semibold text-slate-900 truncate">
                        {d.title}
                      </div>
                      <span className="text-[10px] uppercase tracking-wide text-slate-500">
                        {d.essayType}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {new Date(d.updatedAt).toLocaleString()}
                    </div>
                  </button>
                ))}
                {drafts.length === 0 && (
                  <div className="text-sm text-slate-500">No essays yet. Click â€œNewâ€.</div>
                )}
              </div>
            </section>

            <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-slate-900">Draft</h2>
                {selectedDraft && (
                  <button
                    type="button"
                    onClick={() => deleteDraft(selectedDraft.id)}
                    className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-600"
                  >
                    Delete
                  </button>
                )}
              </div>

              {!selectedDraft ? (
                <div className="text-sm text-slate-500">Select an essay or click â€œNewâ€.</div>
              ) : (
                <div className="space-y-3">
                  <div className="grid gap-2">
                    <label className="text-xs font-semibold text-slate-600" htmlFor="draft-title">
                      Title
                    </label>
                    <input
                      id="draft-title"
                      name="draft-title"
                      value={selectedDraft.title}
                      onChange={(e) => updateDraft(selectedDraft.id, { title: e.target.value })}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      placeholder="Essay title"
                    />
                  </div>

                  <div className="grid gap-2">
                    <label className="text-xs font-semibold text-slate-600" htmlFor="draft-type">
                      Type
                    </label>
                    <select
                      id="draft-type"
                      name="draft-type"
                      value={selectedDraft.essayType}
                      onChange={(e) =>
                        updateDraft(selectedDraft.id, {
                          essayType: normalizeEssayType(e.target.value),
                        })
                      }
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white"
                    >
                      <option value="personal">Personal statement</option>
                      <option value="supplement">Supplement</option>
                      <option value="piq">UC PIQ</option>
                    </select>
                  </div>

                  <div className="grid gap-2">
                    <label className="text-xs font-semibold text-slate-600" htmlFor="draft-prompt">
                      Prompt (optional)
                    </label>
                    <textarea
                      id="draft-prompt"
                      name="draft-prompt"
                      value={selectedDraft.prompt}
                      onChange={(e) => updateDraft(selectedDraft.id, { prompt: e.target.value })}
                      className="w-full min-h-20 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      placeholder="Paste the prompt here..."
                    />
                  </div>

                  <div className="grid gap-2">
                    <label className="text-xs font-semibold text-slate-600" htmlFor="draft-words">
                      Target words
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        id="draft-words"
                        name="draft-words"
                        type="number"
                        min={100}
                        max={1500}
                        value={selectedDraft.targetWordCount}
                        onChange={(e) =>
                          updateDraft(selectedDraft.id, {
                            targetWordCount: clampWordCount(e.target.value, 500),
                          })
                        }
                        className="w-32 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      />
                      <span className="text-xs text-slate-500">
                        Current: {countWords(selectedDraft.essay)} words
                      </span>
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <label className="text-xs font-semibold text-slate-600" htmlFor="draft-essay">
                      Essay
                    </label>
                    <textarea
                      id="draft-essay"
                      name="draft-essay"
                      value={selectedDraft.essay}
                      onChange={(e) => updateDraft(selectedDraft.id, { essay: e.target.value })}
                      className="w-full min-h-[340px] rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      placeholder="Start typing..."
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      disabled={generationLoading}
                      onClick={() => void runGeneration()}
                      className="w-full px-4 py-2 rounded-xl border border-slate-200 text-slate-800 font-semibold disabled:opacity-60"
                    >
                      {generationLoading ? "Generating..." : "Magic Generate"}
                    </button>
                    <button
                      type="button"
                      disabled={feedbackLoading || !selectedDraft.essay.trim()}
                      onClick={() => void runFeedback()}
                      className="w-full px-4 py-2 rounded-xl bg-blue-600 text-white font-semibold disabled:opacity-60"
                    >
                      {feedbackLoading ? "Generating feedback..." : "Get Feedback"}
                    </button>
                  </div>
                </div>
              )}
            </section>

            <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-slate-900">Feedback</h2>
                {selectedDraft?.feedback?.score_1_to_10 != null && (
                  <span className="text-xs font-semibold text-slate-600">
                    Score {selectedDraft.feedback.score_1_to_10}/10
                  </span>
                )}
              </div>

              {!selectedDraft ? (
                <div className="text-sm text-slate-500">Select an essay to view feedback.</div>
              ) : !selectedDraft.feedback ? (
                <div className="text-sm text-slate-500">No feedback yet. Click â€œGet Feedbackâ€.</div>
              ) : (
                <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
                  {rubric && (
                    <div>
                      <p className="text-xs uppercase font-semibold text-slate-500 mb-2">
                        Rubric
                      </p>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        {(
                          [
                            ["Hook", rubric.Hook],
                            ["Specifics", rubric.Specifics],
                            ["Reflection", rubric.Reflection],
                            ["Voice", rubric.Voice],
                            ["Polish", rubric.Polish],
                            ["Fit", rubric.Fit],
                          ] as Array<[string, number]>
                        ).map(([label, score]) => (
                          <div
                            key={label}
                            className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2"
                          >
                            <span className="text-slate-700 font-semibold">{label}</span>
                            <span className="text-slate-600">{score}/10</span>
                          </div>
                        ))}
                      </div>
                      {selectedDraft.feedback.fit_notes && (
                        <p className="mt-2 text-sm text-slate-700">
                          <span className="font-semibold">Fit:</span>{" "}
                          {selectedDraft.feedback.fit_notes}
                        </p>
                      )}
                    </div>
                  )}

                  <div>
                    <p className="text-xs uppercase font-semibold text-slate-500">Summary</p>
                    <p className="mt-1 text-sm text-slate-700 whitespace-pre-wrap">
                      {selectedDraft.feedback.overall_summary}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs uppercase font-semibold text-slate-500">Strengths</p>
                    <ul className="mt-2 space-y-2 text-sm text-slate-700 list-disc pl-5">
                      {selectedDraft.feedback.strengths.map((s, idx) => (
                        <li key={idx}>{s}</li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <p className="text-xs uppercase font-semibold text-slate-500">Improvements</p>
                    <ul className="mt-2 space-y-2 text-sm text-slate-700 list-disc pl-5">
                      {selectedDraft.feedback.improvements.map((s, idx) => (
                        <li key={idx}>{s}</li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <p className="text-xs uppercase font-semibold text-slate-500">
                      Concrete rewrites
                    </p>
                    <div className="mt-2 space-y-3">
                      {selectedDraft.feedback.concrete_rewrites.map((r, idx) => (
                        <div key={idx} className="rounded-xl border border-slate-200 p-3">
                          <p className="text-xs font-semibold text-slate-500">Before</p>
                          <p className="mt-1 text-sm text-slate-700 whitespace-pre-wrap">
                            {r.before}
                          </p>
                          <p className="mt-3 text-xs font-semibold text-slate-500">After</p>
                          <p className="mt-1 text-sm text-slate-700 whitespace-pre-wrap">
                            {r.after}
                          </p>
                        </div>
                      ))}
                      {selectedDraft.feedback.concrete_rewrites.length === 0 && (
                        <div className="text-sm text-slate-500">
                          No rewrite suggestions provided.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default EssayLabPage;

