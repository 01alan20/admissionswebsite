import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useOnboardingGuard } from "../hooks/useOnboardingGuard";
import { useOnboardingContext } from "../context/OnboardingContext";

const ProfileGpaStepPage: React.FC = () => {
  const loading = useOnboardingGuard(3);
  const { setOnboardingStepRemote, studentProfile } = useOnboardingContext();
  const [gpa, setGpa] = useState(
    studentProfile.gpa != null ? String(studentProfile.gpa) : ""
  );
  const [classRank, setClassRank] = useState(studentProfile.classRank ?? "N/A");
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="max-w-xl mx-auto text-center py-12">
        <p className="text-gray-600 text-sm">Loading…</p>
      </div>
    );
  }

  const handleNext = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = parseFloat(gpa);
    if (Number.isNaN(value) || value < 0 || value > 4) return;
    await setOnboardingStepRemote(3, { gpa: value, classRank });
    navigate("/profile/tests");
  };

  return (
    <div className="max-w-xl mx-auto">
      <div className="bg-white p-6 md:p-8 rounded-lg shadow-xl">
        <h1 className="text-2xl font-bold text-slate-900 mb-4">
          Step 3 of 7: Academic Performance (GPA)
        </h1>
        <form onSubmit={handleNext} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Unweighted GPA (4.0 scale)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="4.0"
              value={gpa}
              onChange={(e) => setGpa(e.target.value)}
              placeholder="e.g. 3.85"
              className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-ivy-800 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Class Rank
            </label>
            <select
              value={classRank}
              onChange={(e) => setClassRank(e.target.value)}
              className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-ivy-800 outline-none"
            >
              <option value="N/A">N/A (School doesn't rank)</option>
              <option value="Top 1%">Top 1%</option>
              <option value="Top 5%">Top 5%</option>
              <option value="Top 10%">Top 10%</option>
              <option value="Top 25%">Top 25%</option>
              <option value="Top 50%">Top 50%</option>
              <option value="Below 50%">Below 50%</option>
            </select>
          </div>

          <div className="flex justify-between">
            <button
              type="button"
              onClick={() => navigate("/profile/location")}
              className="px-6 py-2 rounded-lg font-semibold border border-brand-secondary text-brand-secondary bg-white hover:bg-brand-secondary hover:text-white transition"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={gpa === "" || Number.isNaN(parseFloat(gpa))}
              className="px-8 py-3 bg-brand-primary text-white rounded-lg font-bold shadow-md hover:bg-brand-dark transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProfileGpaStepPage;
