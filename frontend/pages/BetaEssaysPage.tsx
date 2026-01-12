import React from "react";
import { Navigate } from "react-router-dom";
import { useOnboardingContext } from "../context/OnboardingContext";
import EssaysPage from "./EssaysPage";

const BetaEssaysPage: React.FC = () => {
  const { user } = useOnboardingContext();

  if (!user) return <Navigate to="/profile/login" replace />;

  return <EssaysPage />;
};

export default BetaEssaysPage;
