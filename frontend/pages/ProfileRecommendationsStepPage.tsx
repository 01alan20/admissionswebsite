import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useOnboardingGuard } from "../hooks/useOnboardingGuard";
import { useOnboardingContext } from "../context/OnboardingContext";

type RecOption = {
  id: number;
  label: string;
  description: string;
};

const REC_OPTIONS: RecOption[] = [
  {
    id: 6,
    label: "Strikingly Unusual / Superlative",
    description: "Teacher describes you as one of the best in their career.",
  },
  {
    id: 5,
    label: "Very Strong Praise",
    description: "“Best this year” or clearly top of class.",
  },
  {
    id: 4,
    label: "Above-Average Positive Support",
    description: "Positive and supportive, but not superlative.",
  },
  {
    id: 3,
    label: "Neutral or Slightly Negative",
    description: "Generic, faint praise or lukewarm tone.",
  },
  {
    id: 2,
    label: "Negative / Worrisome",
    description: "Teacher raises concerns or signals issues.",
  },
  {
    id: 1,
    label: "No Recommendation / Unread",
    description: "No usable teacher recommendation available.",
  },
];

const colorForRecScore = (score: number): string => {
  if (score >= 5) return "bg-green-500 text-white";
  if (score >= 3) return "bg-yellow-400 text-slate-900";
  return "bg-red-500 text-white";
};

const ProfileRecommendationsStepPage: React.FC = () => {
  const loading = useOnboardingGuard(6);
  const { setOnboardingStepRemote, studentProfile } =
    useOnboardingContext();
  const [selectedScore, setSelectedScore] = useState<number | null>(
    studentProfile.recScore ?? null
  );
  const [reflection, setReflection] = useState("");
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
    if (selectedScore == null) return;
    // Reverse mapping: higher internal score means better recs.
    await setOnboardingStepRemote(6, { recScore: selectedScore });
    navigate("/profile/targets");
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white p-6 md:p-8 rounded-lg shadow-xl">
        <h1 className="text-2xl font-bold text-slate-900 mb-4">
          Step 6 of 7: Teacher Recommendations
        </h1>
        <p className="text-sm text-slate-600 mb-4">
          Reflect honestly on how strong your teacher recommendations are likely to be.
          This uses an inverted 1–6 scale, but we show only color (red = weaker, green =
          stronger).
        </p>

        <form onSubmit={handleNext} className="space-y-6">
          <div className="space-y-3">
            {REC_OPTIONS.map((opt) => {
              const isSelected = selectedScore === opt.id;
              const baseColor = colorForRecScore(opt.id);
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSelectedScore(opt.id)}
                  className={`w-full text-left px-4 py-3 rounded-lg border transition-all ${
                    isSelected
                      ? `${baseColor} border-transparent shadow-md`
                      : "bg-white border-slate-200 hover:border-brand-secondary"
                  }`}
                >
                  <div className="text-sm font-semibold">
                    {opt.label}
                  </div>
                  <div
                    className={`text-xs mt-1 ${
                      isSelected ? "text-gray-100" : "text-slate-500"
                    }`}
                  >
                    {opt.description}
                  </div>
                </button>
              );
            })}
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Optional Reflection
            </label>
            <textarea
              value={reflection}
              onChange={(e) => setReflection(e.target.value)}
              placeholder="If you were your teacher, how would you describe your impact in one sentence?"
              rows={3}
              className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-ivy-800 outline-none text-sm"
            />
          </div>

          <div className="flex justify-between">
            <button
              type="button"
              onClick={() => navigate("/profile/activities")}
              className="px-6 py-2 rounded-lg font-semibold border border-brand-secondary text-brand-secondary bg-white hover:bg-brand-secondary hover:text-white transition"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={selectedScore == null}
              className="px-8 py-3 bg-brand-primary text-white rounded-lg font-bold shadow-md hover:bg-brand-dark transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue to Targets
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProfileRecommendationsStepPage;
