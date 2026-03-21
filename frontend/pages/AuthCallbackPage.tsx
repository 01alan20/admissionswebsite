import React, { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../services/supabaseClient";
import { logUserEvent } from "../services/userEvents";

const AuthCallbackPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const getSafeNextPath = (): string | null => {
    const next = new URLSearchParams(location.search).get("next");
    if (!next) return null;
    const trimmed = next.trim();
    if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return null;
    if (trimmed.includes("://") || trimmed.includes("\\")) return null;
    return trimmed;
  };

  const safeNextPath = getSafeNextPath();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const code = params.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else if (window.location.hash) {
          const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
          const accessToken = hashParams.get("access_token");
          const refreshToken = hashParams.get("refresh_token");
          if (accessToken && refreshToken) {
            const { error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (error) throw error;
          }
        }
        const { data: userData } = await supabase.auth.getUser();
        if (userData?.user) {
          void logUserEvent({
            userId: userData.user.id,
            eventType: "user_login",
            source: "auth_callback",
            metadata: {
              method: "oauth",
            },
          });
        }
      } catch {
        // Swallow errors and send the user back to login so they can retry.
      } finally {
        if (!cancelled) {
          navigate(safeNextPath ?? "/profile/route", { replace: true });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate, safeNextPath]);

  return (
    <div className="max-w-xl mx-auto text-center py-12">
      <p className="text-gray-600 text-sm">Finishing sign-in...</p>
    </div>
  );
};

export default AuthCallbackPage;
