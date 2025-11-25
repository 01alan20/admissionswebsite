import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { determineNextPath, useOnboardingContext } from "../context/OnboardingContext";

export const useOnboardingGuard = (requiredStep: number) => {
  const { user, onboardingStep, loading } = useOnboardingContext();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      if (location.pathname !== "/profile/login") {
        navigate("/profile/login", { replace: true });
      }
      return;
    }

    if (onboardingStep + 1 < requiredStep) {
      const next = determineNextPath(onboardingStep);
      if (location.pathname !== next) {
        navigate(next, { replace: true });
      }
    }
  }, [user, onboardingStep, loading, requiredStep, navigate, location]);

  return loading;
};
