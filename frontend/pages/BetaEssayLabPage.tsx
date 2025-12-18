import React, { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import DashboardLayout from "../components/DashboardLayout";
import { useOnboardingContext } from "../context/OnboardingContext";
import { isBetaUser } from "../utils/betaAccess";
import { supabase } from "../services/supabaseClient";
import { getAnonymousEssays } from "../data/api";
import type { AnonymousEssayEntry } from "../types";
import { requestEssayFeedback, type EssayFeedback } from "../services/essayFeedbackService";

type Draft = {
  id: string;
  title: string;
  prompt: string;
  essay: string;
  updatedAt: string;
  feedback?: EssayFeedback | null;
};

const nowIso = () => new Date().toISOString();
const randomId = () => Math.random().toString(36).slice(2, 10);

const BetaEssayLabPage: React.FC = () => {
  const { user, studentProfile } = useOnboardingContext();

  const allowed = isBetaUser(user?.email);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [essayLibrary, setEssayLibrary] = useState<AnonymousEssayEntry[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);

  const selectedDraft = useMemo(
    () => drafts.find((d) => d.id === selectedDraftId) ?? null,
    [drafts, selectedDraftId]
  );

  useEffect(() => {
    if (!user || !allowed) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);

        const [{ data: profileRow, error: profileErr }, library] = await Promise.all([
          supabase.from("profiles").select("essay_drafts").eq("user_id", user.id).maybeSingle(),
          getAnonymousEssays(),
        ]);
        if (profileErr) throw profileErr;

        const raw = (profileRow as any)?.essay_drafts;
        const loadedDrafts: Draft[] = Array.isArray(raw?.drafts) ? raw.drafts : [];
        const safeDrafts = loadedDrafts
          .filter((d) => d && typeof d === "object")
          .map((d: any) => ({
            id: String(d.id ?? randomId()),
            title: String(d.title ?? "Untitled"),
            prompt: String(d.prompt ?? ""),
            essay: String(d.essay ?? ""),
            updatedAt: String(d.updatedAt ?? nowIso()),
            feedback: d.feedback ?? null,
          }));

        if (!cancelled) {
          setDrafts(safeDrafts);
          setSelectedDraftId(safeDrafts[0]?.id ?? null);
          setEssayLibrary(Array.isArray(library) ? library.slice(0, 10) : []);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load Essay Lab.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, allowed]);

  const persistDrafts = async (nextDrafts: Draft[]) => {
    if (!user) return;
    const payload = {
      drafts: nextDrafts,
      updatedAt: nowIso(),
    };
    await supabase.from("profiles").upsert(
      {
        user_id: user.id,
        essay_drafts: payload,
      },
      { onConflict: "user_id" }
    );
  };

  const createDraft = async () => {
    const draft: Draft = {
      id: randomId(),
      title: "New Draft",
      prompt: "",
      essay: "",
      updatedAt: nowIso(),
      feedback: null,
    };
    const next = [draft, ...drafts];
    setDrafts(next);
    setSelectedDraftId(draft.id);
    await persistDrafts(next);
  };

  const updateDraft = async (id: string, patch: Partial<Draft>) => {
    const next = drafts.map((d) =>
      d.id === id ? { ...d, ...patch, updatedAt: nowIso() } : d
    );
    setDrafts(next);
    await persistDrafts(next);
  };

  const deleteDraft = async (id: string) => {
    const next = drafts.filter((d) => d.id !== id);
    setDrafts(next);
    setSelectedDraftId(next[0]?.id ?? null);
    await persistDrafts(next);
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
      });
      await updateDraft(selectedDraft.id, { feedback });
    } catch (e: any) {
      setError(e?.message || "Failed to generate feedback.");
    } finally {
      setFeedbackLoading(false);
    }
  };

  if (!user) return <Navigate to="/profile/login" replace />;
  if (!allowed) return <Navigate to="/profile/my-profile" replace />;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <header className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <p className="text-xs uppercase tracking-wide text-brand-secondary font-semibold">Beta</p>
          <h1 className="text-3xl font-bold text-slate-900 mt-1">Essay Lab</h1>
          <p className="mt-2 text-sm text-slate-600 max-w-3xl">
            Draft essays, track versions, and get feedback (private beta).
          </p>
        </header>

        {loading ? (
          <div className="py-10 text-sm text-slate-600">Loading Essay Lab...</div>
        ) : error ? (
          <div className="bg-white rounded-2xl border border-red-200 p-4 text-sm text-red-600">
            {error}
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Essay List */}
            <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-slate-900">Essay List</h2>
                <span className="text-xs text-slate-500">Top 10</span>
              </div>
              <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
                {essayLibrary.map((e) => (
                  <button
                    key={e.essay_id}
                    type="button"
                    className="w-full text-left p-3 rounded-xl border border-slate-200 hover:border-slate-300"
                    onClick={() => {
                      if (!selectedDraft) return;
                      void updateDraft(selectedDraft.id, {
                        title: selectedDraft.title || `${e.school ?? "Essay"}`,
                        prompt: e.question ?? selectedDraft.prompt,
                      });
                    }}
                  >
                    <div className="text-xs text-slate-500">
                      {(e.school ?? "Unknown")} • {e.year ?? "—"} • {e.type ?? "Essay"}
                    </div>
                    <div className="mt-1 text-sm font-semibold text-slate-900 line-clamp-2">
                      {e.category ?? "General"}
                    </div>
                    <div className="mt-1 text-xs text-slate-600 line-clamp-2">
                      {e.question ?? ""}
                    </div>
                  </button>
                ))}
                {essayLibrary.length === 0 && (
                  <div className="text-sm text-slate-500">No essays loaded yet.</div>
                )}
              </div>
            </section>

            {/* Drafts */}
            <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-slate-900">Essay Drafts</h2>
                <button
                  type="button"
                  onClick={() => void createDraft()}
                  className="px-3 py-1.5 rounded-full bg-blue-600 text-white text-xs font-semibold"
                >
                  New
                </button>
              </div>
              <div className="grid gap-3">
                <div className="flex gap-2 max-h-48 overflow-y-auto pr-1">
                  <div className="w-full space-y-2">
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
                        <div className="text-sm font-semibold text-slate-900 truncate">
                          {d.title}
                        </div>
                        <div className="text-xs text-slate-500">
                          {new Date(d.updatedAt).toLocaleString()}
                        </div>
                      </button>
                    ))}
                    {drafts.length === 0 && (
                      <div className="text-sm text-slate-500">No drafts yet.</div>
                    )}
                  </div>
                </div>

                {selectedDraft && (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <input
                        id="draft-title"
                        name="draft-title"
                        value={selectedDraft.title}
                        onChange={(e) =>
                          void updateDraft(selectedDraft.id, { title: e.target.value })
                        }
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        placeholder="Draft title"
                      />
                      <button
                        type="button"
                        onClick={() => void deleteDraft(selectedDraft.id)}
                        className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-600"
                      >
                        Delete
                      </button>
                    </div>
                    <textarea
                      id="draft-prompt"
                      name="draft-prompt"
                      value={selectedDraft.prompt}
                      onChange={(e) => void updateDraft(selectedDraft.id, { prompt: e.target.value })}
                      className="w-full min-h-24 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      placeholder="Essay prompt (optional)"
                    />
                    <textarea
                      id="draft-essay"
                      name="draft-essay"
                      value={selectedDraft.essay}
                      onChange={(e) => void updateDraft(selectedDraft.id, { essay: e.target.value })}
                      className="w-full min-h-[320px] rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      placeholder="Paste your essay draft here..."
                    />
                    <button
                      type="button"
                      disabled={feedbackLoading || !selectedDraft.essay.trim()}
                      onClick={() => void runFeedback()}
                      className="w-full px-4 py-2 rounded-xl bg-blue-600 text-white font-semibold disabled:opacity-60"
                    >
                      {feedbackLoading ? "Generating feedback..." : "Get Feedback"}
                    </button>
                  </>
                )}
              </div>
            </section>

            {/* Feedback */}
            <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-slate-900">Essay Feedback</h2>
                {selectedDraft?.feedback?.score_1_to_10 != null && (
                  <span className="text-xs font-semibold text-slate-600">
                    Score {selectedDraft.feedback.score_1_to_10}/10
                  </span>
                )}
              </div>
              {!selectedDraft ? (
                <div className="text-sm text-slate-500">Select a draft to view feedback.</div>
              ) : !selectedDraft.feedback ? (
                <div className="text-sm text-slate-500">
                  No feedback yet. Click “Get Feedback” on a draft.
                </div>
              ) : (
                <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
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
                    <p className="text-xs uppercase font-semibold text-slate-500">Concrete rewrites</p>
                    <div className="mt-2 space-y-3">
                      {selectedDraft.feedback.concrete_rewrites.map((r, idx) => (
                        <div key={idx} className="rounded-xl border border-slate-200 p-3">
                          <p className="text-xs font-semibold text-slate-500">Before</p>
                          <p className="mt-1 text-sm text-slate-700 whitespace-pre-wrap">{r.before}</p>
                          <p className="mt-3 text-xs font-semibold text-slate-500">After</p>
                          <p className="mt-1 text-sm text-slate-700 whitespace-pre-wrap">{r.after}</p>
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

export default BetaEssayLabPage;
