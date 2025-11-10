import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useNavigate, useLocation } from "react-router-dom";

export default function Login() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const location = useLocation();

  async function sendLink(e) {
    e.preventDefault();
    setError("");
    setSending(true);
    try {
      const redirectTo = window.location.origin + "/onboarding";
      const { error: err } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
      if (err) throw err;
      setSent(true);
    } catch (err) {
      setError(err.message || "Failed to send link");
    } finally {
      setSending(false);
    }
  }

  return (
    <section>
      <div className="page-intro"><h1 className="h1">Sign in</h1></div>
      <div className="card" style={{ maxWidth: 520 }}>
        <form onSubmit={sendLink} style={{ display: "grid", gap: 12 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontWeight: 600 }}>Email</span>
            <input required type="email" value={email} onChange={e => setEmail(e.target.value)} className="search" style={{ height: 44 }} />
          </label>
          <button className="btn-primary" disabled={sending}>
            {sending ? "Sending..." : "Send magic link"}
          </button>
          {sent && <div className="sub">Check your inbox for the sign‑in link.</div>}
          {error && <div style={{ color: "crimson" }}>{error}</div>}
        </form>
      </div>
    </section>
  );
}

