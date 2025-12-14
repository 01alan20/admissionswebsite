import React, { useMemo } from "react";
import { useOnboardingGuard } from "../hooks/useOnboardingGuard";
import DashboardLayout from "../components/DashboardLayout";
import ExplorePage from "./ExplorePage";
import { useOnboardingContext } from "../context/OnboardingContext";
import {
  extractMajorCode,
  getTwoDigitPrefix,
  normalizeMajorSelectionList,
} from "../utils/majors";

const ProfileCollegesPage: React.FC = () => {
  const loading = useOnboardingGuard(9);
  const { studentProfile } = useOnboardingContext();

  const { majorAreas, specificMajors } = useMemo(() => {
    const normalized = normalizeMajorSelectionList(studentProfile.majors) ?? [];
    const areaSet = new Set<string>();
    const specificSet = new Set<string>();
    for (const entry of normalized) {
      const code = extractMajorCode(entry);
      if (code) {
        if (code.includes(".")) {
          specificSet.add(code);
        } else {
          areaSet.add(code.slice(0, 2));
        }
      }
      const prefix = getTwoDigitPrefix(entry);
      if (prefix) areaSet.add(prefix);
    }
    return {
      majorAreas: Array.from(areaSet),
      specificMajors: Array.from(specificSet),
    };
  }, [studentProfile.majors]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="py-10 text-sm text-slate-600">Loading your college tools...</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <header className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <p className="text-xs uppercase tracking-wide text-brand-secondary font-semibold">Essentials</p>
          <h1 className="text-3xl font-bold text-slate-900 mt-1">Colleges</h1>
          <p className="mt-2 text-sm text-slate-600 max-w-3xl">
            Search universities, compare selectivity, and filter by majors, budget, testing policy, or campus type—all
            within your personalized workspace.
          </p>
        </header>
        <div className="-mx-4 sm:-mx-6 lg:-mx-8">
          <div className="px-4 sm:px-6 lg:px-8">
            <ExplorePage
              initialMajorAreas={majorAreas}
              initialSpecificMajors={specificMajors}
            />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ProfileCollegesPage;
