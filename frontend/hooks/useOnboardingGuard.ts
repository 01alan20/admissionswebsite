import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useOnboardingContext } from "../context/OnboardingContext";

export const useOnboardingGuard = (requiredStep: number) => {
  const { user, onboardingStep, loading } = useOnboardingContext();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      if (location.pathname !== "/") {
        navigate("/", { replace: true });
      }
      return;
    }
  }, [user, onboardingStep, loading, requiredStep, navigate, location]);

  return loading;
};
