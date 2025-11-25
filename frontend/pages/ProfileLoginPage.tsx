import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../services/supabaseClient";
import { useOnboardingContext } from "../context/OnboardingContext";

const ProfileLoginPage: React.FC = () => {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user, onboardingStep, loading } = useOnboardingContext();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (user) {
      if (onboardingStep >= 6) {
        navigate("/profile/dashboard", { replace: true });
      } else {
        navigate("/profile/name", { replace: true });
      }
    }
  }, [user, onboardingStep, loading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || sending) return;
    if (!supabase) {
      setError(
        "Magic link login is temporarily unavailable (Supabase is not configured)."
      );
      return;
    }
    setSending(true);
    setError(null);
    try {
      const redirectTo = `${window.location.origin}/#/profile/route`;
      const { error: authError } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo },
      });
      if (authError) throw authError;
      setSent(true);
    } catch (err: any) {
      setError(err.message ?? "Failed to send magic link");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto">
      <div className="bg-white p-6 md:p-8 rounded-lg shadow-xl">
        <h1 className="text-3xl font-bold text-brand-dark mb-2">Make Your Profile</h1>
        <p className="text-gray-600 mb-6">
          Create a profile to track your progress and gain insights into your chosen
          universities.
        </p>

        <h2 className="text-xl font-semibold text-gray-800 mb-2">
          Step 0: Secure your profile with a magic link
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          Enter your email to get a one-time magic link. Use the same email any time to
          come back and update your profile.
        </p>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col md:flex-row gap-3 items-start md:items-center"
        >
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-secondary focus:border-brand-secondary text-sm"
          />
          <button
            type="submit"
            disabled={sending}
            className="px-5 py-2 bg-brand-primary text-white text-sm font-semibold rounded-md shadow hover:bg-brand-dark disabled:opacity-60"
          >
            {sending ? "Sending..." : "Send Magic Link"}
          </button>
        </form>

        {sent && (
          <p className="text-sm text-green-700 mt-3">
            Magic link sent. Check your email and click the link to continue.
          </p>
        )}
        {error && (
          <p className="text-sm text-red-600 mt-3">
            {error}
          </p>
        )}
      </div>
    </div>
  );
};

export default ProfileLoginPage;

