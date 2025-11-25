import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useOnboardingContext, determineNextPath } from "../context/OnboardingContext";

const ProfileRoutePage: React.FC = () => {
  const { user, onboardingStep, loading } = useOnboardingContext();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      navigate("/profile/login", { replace: true });
      return;
    }

    const next = determineNextPath(onboardingStep);
    navigate(next, { replace: true });
  }, [user, onboardingStep, loading, navigate]);

  return (
    <div className="max-w-xl mx-auto text-center py-12">
      <p className="text-gray-600 text-sm">Checking your profile status…</p>
    </div>
  );
};

export default ProfileRoutePage;
