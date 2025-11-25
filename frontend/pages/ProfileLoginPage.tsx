import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../services/supabaseClient";
import { useOnboardingContext } from "../context/OnboardingContext";

type AuthMode = "login" | "signup";

const ProfileLoginPage: React.FC = () => {
  const [mode, setMode] = useState<AuthMode>("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
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
    if (!email || !password || sending) return;
    setSending(true);
    setError(null);
    setMessage(null);
    try {
      if (mode === "signup") {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });
        if (signUpError) throw signUpError;
        setMessage(
          "Account created. If email confirmation is required, check your inbox, then log in with your password."
        );
        setMode("login");
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
        // After a successful login, send the user through the profile router so
        // onboarding state is re-evaluated and they land on the right step or
        // the dashboard.
        window.location.href = `${window.location.origin}/#/profile/route`;
      }
    } catch (err: any) {
      setError(err.message ?? "Authentication failed. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!email || sending) return;
    setSending(true);
    setError(null);
    setMessage(null);
    try {
      const redirectTo = `${window.location.origin}/#/profile/login`;
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });
      if (resetError) throw resetError;
      setMessage("Password reset email sent. Check your inbox for further instructions.");
    } catch (err: any) {
      setError(err.message ?? "Failed to send password reset email.");
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

        <h2 className="text-xl font-semibold text-gray-800 mb-3">
          Sign up or log in with email and password
        </h2>

        <div className="flex mb-4 border border-slate-200 rounded-lg overflow-hidden text-sm font-semibold">
          <button
            type="button"
            onClick={() => setMode("signup")}
            className={`flex-1 px-3 py-2 text-center ${
              mode === "signup"
                ? "bg-brand-primary text-white"
                : "bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            Create Account
          </button>
          <button
            type="button"
            onClick={() => setMode("login")}
            className={`flex-1 px-3 py-2 text-center border-l border-slate-200 ${
              mode === "login"
                ? "bg-brand-primary text-white"
                : "bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            Log In
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-secondary focus:border-brand-secondary text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Choose a secure password"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-secondary focus:border-brand-secondary text-sm"
            />
          </div>

          <div className="flex items-center justify-between mt-2">
            <button
              type="submit"
              disabled={sending}
              className="px-5 py-2 bg-brand-primary text-white text-sm font-semibold rounded-md shadow hover:bg-brand-dark disabled:opacity-60"
            >
              {sending
                ? mode === "signup"
                  ? "Creating..."
                  : "Logging in..."
                : mode === "signup"
                ? "Create Account"
                : "Log In"}
            </button>
            <button
              type="button"
              onClick={handlePasswordReset}
              disabled={sending || !email}
              className="text-xs text-brand-secondary hover:underline disabled:text-slate-400"
            >
              Forgot password?
            </button>
          </div>
        </form>

        {message && (
          <p className="text-sm text-green-700 mt-3">
            {message}
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

