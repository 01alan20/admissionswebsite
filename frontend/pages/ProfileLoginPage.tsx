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
  const { user, onboardingStep, loading, setUserDirect } = useOnboardingContext();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (user) {
      navigate("/profile/my-profile", { replace: true });
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
          "Account created. Check your inbox for a verification email from Supabase (our authentication provider), then log in here with your password after confirming."
        );
        setMode("login");
      } else {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
        // Hydrate context immediately so guards see the logged-in user without
        // waiting for a full app reload.
        if (data?.user) {
          setUserDirect(data.user);
        }
        navigate("/profile/route", { replace: true });
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
      const redirectTo = `${window.location.origin}/auth/callback`;
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
          Sign up or log in
        </h2>

        <div className="space-y-3 mb-6">
          <button
            type="button"
            onClick={async () => {
              setSending(true);
              setError(null);
              setMessage(null);
              try {
                const redirectTo = `${window.location.origin}/auth/callback`;
                const { error: oauthError } = await supabase.auth.signInWithOAuth({
                  provider: "google",
                  options: { redirectTo },
                });
                if (oauthError) throw oauthError;
              } catch (err: any) {
                setError(err.message ?? "Google sign-in failed. Please try again.");
              } finally {
                setSending(false);
              }
            }}
            className="w-full inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
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
            <label htmlFor="auth-email" className="block text-sm font-medium text-slate-700 mb-1">
              Username (email)
            </label>
            <input
              id="auth-email"
              name="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-secondary focus:border-brand-secondary text-sm"
            />
          </div>

          <div>
            <label htmlFor="auth-password" className="block text-sm font-medium text-slate-700 mb-1">
              Password
            </label>
            <input
              id="auth-password"
              name="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Choose a secure password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
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
          <p className="text-green-700 mt-3 text-sm leading-snug">
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
