import React, { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import DashboardLayout from "../components/DashboardLayout";
import { useOnboardingContext } from "../context/OnboardingContext";
import { supabase } from "../services/supabaseClient";
import { requestEssayFeedback, type EssayFeedback } from "../services/essayFeedbackService";

type EssayType = "personal" | "supplement" | "piq";

type Draft = {
  id: string;
  title: string;
  prompt: string;
  essay: string;
  essayType: EssayType;
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

const normalizeEssayType = (value: unknown): EssayType => {
  if (value === "supplement" || value === "piq" || value === "personal") return value;
  return "personal";
};

const EssaysPage: React.FC = () => {
  const { user, studentProfile } = useOnboardingContext();
  const location = useLocation();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackRequests, setFeedbackRequests] = useState(0);

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
          .select("essay_drafts")
          .eq("user_id", user.id)
          .maybeSingle();
        if (profileErr) throw profileErr;

        const raw = (profileRow as any)?.essay_drafts as EssayDraftsPayload | null | undefined;
        const loadedDrafts: Draft[] = Array.isArray(raw?.drafts) ? raw!.drafts : [];
        const safeDrafts = loadedDrafts
          .filter((d) => d && typeof d === "object")
          .map((d: any) => ({
            id: String(d.id ?? randomId()),
            title: String(d.title ?? "Untitled"),
            prompt: String(d.prompt ?? ""),
            essay: String(d.essay ?? ""),
            essayType: normalizeEssayType(d.essayType),
            updatedAt: String(d.updatedAt ?? nowIso()),
            feedback: d.feedback ?? null,
          }));

        const requests = clampInt(raw?.feedbackRequests, 0);

        if (!cancelled) {
          setDrafts(safeDrafts);
          setSelectedDraftId(safeDrafts[0]?.id ?? null);
          setFeedbackRequests(requests);
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

  const createDraft = async () => {
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

  const deleteDraft = async (id: string) => {
    const next = drafts.filter((d) => d.id !== id);
    setDrafts(next);
    setSelectedDraftId(next[0]?.id ?? null);
    queuePersist(next, feedbackRequests);
  };

  const runFeedback = async () => {
    if (!selectedDraft || !user) return;
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
      });

      const nextRequests = feedbackRequests + 1;
      setFeedbackRequests(nextRequests);
      updateDraft(selectedDraft.id, { feedback });
      queuePersist(
        drafts.map((d) =>
          d.id === selectedDraft.id ? { ...d, feedback, updatedAt: nowIso() } : d
        ),
        nextRequests
      );
    } catch (e: any) {
      setError(e?.message || "Failed to generate feedback.");
    } finally {
      setFeedbackLoading(false);
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
            Review
          </p>
          <h1 className="text-3xl font-bold text-slate-900 mt-1">Essays</h1>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-600">
            <span>Draft up to {MAX_ESSAYS} essays and generate feedback.</span>
            <span className="text-slate-400">•</span>
            <span>
              Feedback requests: <span className="font-semibold">{feedbackRequests}</span>
            </span>
            {saving && (
              <>
                <span className="text-slate-400">•</span>
                <span>Saving…</span>
              </>
            )}
          </div>
        </header>

        {loading ? (
          <div className="py-10 text-sm text-slate-600">Loading your essays…</div>
        ) : error ? (
          <div className="bg-white rounded-2xl border border-red-200 p-4 text-sm text-red-600">
            {error}
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Essay List */}
            <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-slate-900">Your Essays</h2>
                <button
                  type="button"
                  onClick={() => void createDraft()}
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
                  <div className="text-sm text-slate-500">No essays yet. Click “New”.</div>
                )}
              </div>
            </section>

            {/* Editor */}
            <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-slate-900">Draft</h2>
                {selectedDraft && (
                  <button
                    type="button"
                    onClick={() => void deleteDraft(selectedDraft.id)}
                    className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-600"
                  >
                    Delete
                  </button>
                )}
              </div>

              {!selectedDraft ? (
                <div className="text-sm text-slate-500">Select an essay or click “New”.</div>
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
                      <option value="personal">Personal</option>
                      <option value="supplement">Supplement</option>
                      <option value="piq">PIQ</option>
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
                      placeholder="Paste the prompt here…"
                    />
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
                      placeholder="Start typing…"
                    />
                  </div>

                  <button
                    type="button"
                    disabled={feedbackLoading || !selectedDraft.essay.trim()}
                    onClick={() => void runFeedback()}
                    className="w-full px-4 py-2 rounded-xl bg-blue-600 text-white font-semibold disabled:opacity-60"
                  >
                    {feedbackLoading ? "Generating feedback…" : "Get Feedback"}
                  </button>
                </div>
              )}
            </section>

            {/* Feedback */}
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
                <div className="text-sm text-slate-500">
                  No feedback yet. Click “Get Feedback”.
                </div>
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

export default EssaysPage;

