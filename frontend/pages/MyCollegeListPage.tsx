import React from "react";
import { useOnboardingGuard } from "../hooks/useOnboardingGuard";
import DashboardLayout from "../components/DashboardLayout";
import CollegeList from "../components/colleges/CollegeList";

const MyCollegeListPage: React.FC = () => {
  const loading = useOnboardingGuard(9);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="max-w-5xl mx-auto py-8 text-sm text-slate-600">
          Loading your college list...
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              My College List
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              A dynamic list of colleges based on your profile and the schools you choose to track.
            </p>
          </div>
        </div>
        <CollegeList />
      </div>
    </DashboardLayout>
  );
};

export default MyCollegeListPage;
