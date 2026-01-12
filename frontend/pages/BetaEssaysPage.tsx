import React from "react";
import { Navigate } from "react-router-dom";
import { useOnboardingContext } from "../context/OnboardingContext";
import { isBetaUser } from "../utils/betaAccess";
import EssaysPage from "./EssaysPage";

const BetaEssaysPage: React.FC = () => {
  const { user } = useOnboardingContext();

  const allowed = isBetaUser(user?.email);
  if (!user) return <Navigate to="/profile/login" replace />;
  if (!allowed) return <Navigate to="/profile/my-profile" replace />;

  return <EssaysPage />;
};

export default BetaEssaysPage;

