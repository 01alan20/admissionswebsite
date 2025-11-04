import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import "./beta.css";

export default function BetaLogin() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState({ loading: false, message: "" });

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email) return;
    setStatus({ loading: true, message: "" });
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin + "/beta/onboarding" }
    });
    if (error) {
      setStatus({ loading: false, message: error.message });
    } else {
      setStatus({
        loading: false,
        message: "Magic link sent! Please check your inbox."
      });
    }
  }

  return (
    <div className="beta-shell">
      <header className="beta-shell__hero">
        <div className="hero-pill">Beta access</div>
        <h1>See Through Onboarding</h1>
        <p>
          We&apos;re building a personal admissions co-pilot. Sign in with your
          email to start your profile.
        </p>
      </header>

      <form className="beta-card" onSubmit={handleSubmit}>
        <label htmlFor="email">Email address</label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
        <button type="submit" disabled={status.loading}>
          {status.loading ? "Sending magic link..." : "Send magic link"}
        </button>
        {status.message && <p className="beta-card__note">{status.message}</p>}
      </form>

      <footer className="beta-footer">
        <span>✨ Private preview. Expect rapid changes.</span>
      </footer>
    </div>
  );
}

