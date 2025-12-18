import React, { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useOnboardingContext } from "../context/OnboardingContext";
import { submitContactRequest } from "../services/contactRequests";

type SubmitState = "idle" | "submitting" | "success" | "error";

const ContactPage: React.FC = () => {
  const { user, profileSummary } = useOnboardingContext();
  const location = useLocation();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const sourcePage = useMemo(() => location.pathname || "/contact", [location.pathname]);

  const canSubmit = name.trim().length > 0 && email.trim().length > 0 && message.trim().length > 0;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSubmit || submitState === "submitting") return;

    setSubmitState("submitting");
    setErrorMessage(null);

    try {
      await submitContactRequest({
        name,
        email,
        phone: phone.trim() || undefined,
        message,
        sourcePage,
        userId: user?.id ?? null,
        profileSnapshot: user ? profileSummary : null,
      });
      setSubmitState("success");
    } catch (err) {
      setSubmitState("error");
      setErrorMessage(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    }
  }

  return (
    <div className="w-full px-4 sm:px-6 lg:px-10 py-10">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-brand-dark">Contact</h1>
          <p className="text-slate-600 mt-2">
            Send a question and we will reply by email as soon as we can.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
          {submitState === "success" ? (
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-emerald-700">Submitted</h2>
              <p className="text-slate-600">Thanks — we received your message.</p>

              <button
                type="button"
                className="mt-4 inline-flex items-center justify-center px-4 py-2 rounded-lg bg-slate-900 text-white font-semibold hover:bg-slate-800 transition-colors"
                onClick={() => {
                  setName("");
                  setEmail("");
                  setPhone("");
                  setMessage("");
                  setSubmitState("idle");
                }}
              >
                Send another message
              </button>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-sm font-semibold text-slate-800">Name</span>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                    className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600"
                    placeholder="Your name"
                    required
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-semibold text-slate-800">Email</span>
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    type="email"
                    autoComplete="email"
                    className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600"
                    placeholder="you@example.com"
                    required
                  />
                </label>
              </div>

              <label className="block">
                <span className="text-sm font-semibold text-slate-800">Phone (optional)</span>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoComplete="tel"
                  className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600"
                  placeholder="+1 (555) 555-5555"
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-slate-800">Message</span>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="mt-2 w-full min-h-[140px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600"
                  placeholder="Tell us what you need help with…"
                  required
                />
              </label>

              {submitState === "error" && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-rose-800 text-sm">
                  {errorMessage || "Something went wrong. Please try again."}
                </div>
              )}

              <div className="flex items-center justify-between gap-4">
                <p className="text-xs text-slate-500">
                  Please double-check your email address so we can reply.
                </p>
                <button
                  type="submit"
                  disabled={!canSubmit || submitState === "submitting"}
                  className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {submitState === "submitting" ? "Submitting…" : "Submit"}
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="text-xs text-slate-500 max-w-3xl mx-auto">
          If you do not receive a reply, check your spam folder or send a follow-up.
        </div>
      </div>
    </div>
  );
};

export default ContactPage;
