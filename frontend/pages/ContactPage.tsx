import React, { useMemo, useState } from "react";
import DashboardLayout from "../components/DashboardLayout";
import { useOnboardingContext } from "../context/OnboardingContext";
import { supabase } from "../services/supabaseClient";

type FormState = {
  name: string;
  email: string;
  phone: string;
  gradYear: string;
  gradeLevel: string;
  message: string;
};

const ContactPage: React.FC = () => {
  const { user, studentProfile, targetUnitIds } = useOnboardingContext();
  const [state, setState] = useState<FormState>({
    name: "",
    email: user?.email ?? "",
    phone: "",
    gradYear: "",
    gradeLevel: "",
    message: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const canSubmit = useMemo(() => {
    const nameOk = state.name.trim().length >= 2;
    const emailOk = /\S+@\S+\.\S+/.test(state.email.trim());
    const msgOk = state.message.trim().length >= 10;
    return nameOk && emailOk && msgOk && !submitting;
  }, [state.name, state.email, state.message, submitting]);

  const onChange = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = e.target.value;
    setState((prev) => ({ ...prev, [key]: value }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    setSuccess(false);
    try {
      const payload = {
        name: state.name.trim(),
        email: state.email.trim(),
        phone: state.phone.trim() || null,
        grad_year: state.gradYear.trim() || null,
        grade_level: state.gradeLevel.trim() || null,
        message: state.message.trim(),
        source_page: typeof window !== "undefined" ? window.location.href : null,
        user_id: user?.id ?? null,
        profile_snapshot: {
          studentProfile,
          targetUnitIds,
        },
      };

      const { data, error: fnError } = await supabase.functions.invoke("contact-request", {
        body: payload,
      });
      if (fnError) throw fnError;
      if (!data?.ok) {
        throw new Error(data?.error || "Unable to send request right now.");
      }

      setSuccess(true);
      setState((prev) => ({ ...prev, message: "" }));
    } catch (err: any) {
      setError(
        err?.message ||
          "Unable to send your request right now. Please try again in a minute."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <header className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <p className="text-xs uppercase tracking-wide text-brand-secondary font-semibold">Support</p>
          <h1 className="text-3xl font-bold text-slate-900 mt-1">Contact Me</h1>
          <p className="mt-2 text-sm text-slate-600 max-w-3xl">
            Send a question for personalized help. Your message is stored securely and emailed to us automatically.
          </p>
        </header>

        <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
          {success && (
            <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              Received. We’ll reply to <span className="font-semibold">{state.email.trim()}</span> soon.
            </div>
          )}
          {error && (
            <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              {error}
              <div className="mt-1 text-[11px] text-rose-700">
                If this keeps happening, the Supabase function `contact-request` may not be deployed yet.
              </div>
            </div>
          )}

          <form className="space-y-4" onSubmit={submit}>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Name</label>
                <input
                  type="text"
                  value={state.name}
                  onChange={onChange("name")}
                  placeholder="Your name"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  value={state.email}
                  onChange={onChange("email")}
                  placeholder="you@example.com"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Phone (optional)</label>
                <input
                  type="tel"
                  value={state.phone}
                  onChange={onChange("phone")}
                  placeholder="(555) 555-5555"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Grad year (optional)</label>
                <input
                  type="text"
                  value={state.gradYear}
                  onChange={onChange("gradYear")}
                  placeholder="2027"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Grade level (optional)</label>
                <input
                  type="text"
                  value={state.gradeLevel}
                  onChange={onChange("gradeLevel")}
                  placeholder="11th grade"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Your question</label>
              <textarea
                value={state.message}
                onChange={onChange("message")}
                placeholder="What do you want help with?"
                className="w-full min-h-[140px] rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
              <p className="mt-1 text-xs text-slate-500">
                Include any context you want us to use (schools, deadlines, constraints).
              </p>
            </div>

            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-slate-500">
                We store this request and email it automatically — you don’t need to send an email yourself.
              </p>
              <button
                type="submit"
                disabled={!canSubmit}
                className="inline-flex items-center rounded-full bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? "Sending..." : "Send"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </DashboardLayout>
  );
};

export default ContactPage;

