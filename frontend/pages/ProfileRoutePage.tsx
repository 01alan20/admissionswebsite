import React, { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useOnboardingContext } from "../context/OnboardingContext";

const ProfileRoutePage: React.FC = () => {
  const { user, onboardingStep, loading } = useOnboardingContext();
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
    if (loading) return;

    if (!user) {
      const target = safeNextPath
        ? `/profile/login?next=${encodeURIComponent(safeNextPath)}`
        : "/profile/login";
      navigate(target, { replace: true });
      return;
    }

    if (safeNextPath) {
      navigate(safeNextPath, { replace: true });
      return;
    }

    navigate("/profile/my-profile", { replace: true });
  }, [user, onboardingStep, loading, navigate, safeNextPath]);

  return (
    <div className="max-w-xl mx-auto text-center py-12">
      <p className="text-gray-600 text-sm">Checking your profile status…</p>
    </div>
  );
};

export default ProfileRoutePage;
