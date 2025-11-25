import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useOnboardingGuard } from "../hooks/useOnboardingGuard";
import { useOnboardingContext } from "../context/OnboardingContext";
import type { Activity } from "../types";

const ProfileActivitiesStepPage: React.FC = () => {
  const loading = useOnboardingGuard(5);
  const { setOnboardingStepRemote, studentProfile, setStudentProfile } =
    useOnboardingContext();
  const [activities, setActivities] = useState<Activity[]>(
    (studentProfile.activities as Activity[] | undefined) ?? []
  );
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
    setStudentProfile({ activities });
    await setOnboardingStepRemote(5, { activities });
    navigate("/profile/recs");
  };

  const addActivity = () => {
    if (activities.length >= 5) return;
    setActivities((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        name: "",
        role: "Member",
        level: "School Level",
      },
    ]);
  };

  const updateActivity = (index: number, field: keyof Activity, value: string) => {
    setActivities((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value } as Activity;
      return next;
    });
  };

  const removeActivity = (index: number) => {
    setActivities((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="max-w-xl mx-auto">
      <div className="bg-white p-6 md:p-8 rounded-lg shadow-xl">
        <h1 className="text-2xl font-bold text-slate-900 mb-4">
          Step 5 of 7: Activities
        </h1>
        <p className="text-sm text-slate-600 mb-6">
          Add your top activities (max 5). The AI looks for leadership and national or
          international impact.
        </p>

        <form onSubmit={handleNext} className="space-y-6">
          <div className="space-y-4">
            {activities.map((activity, index) => (
              <div
                key={activity.id}
                className="bg-slate-50 p-4 rounded-lg border border-slate-200 relative"
              >
                <button
                  type="button"
                  onClick={() => removeActivity(index)}
                  className="absolute top-2 right-2 text-slate-400 hover:text-red-500 p-1"
                >
                  ×
                </button>
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                  <div className="md:col-span-4">
                    <label className="block text-xs font-bold text-slate-500 mb-1">
                      Activity Name
                    </label>
                    <input
                      type="text"
                      value={activity.name}
                      onChange={(e) => updateActivity(index, "name", e.target.value)}
                      placeholder="e.g. Debate, Robotics"
                      className="w-full p-2 border border-slate-300 rounded focus:ring-1 focus:ring-ivy-800 outline-none text-sm"
                    />
                  </div>
                  <div className="md:col-span-4">
                    <label className="block text-xs font-bold text-slate-500 mb-1">
                      Role
                    </label>
                    <select
                      value={activity.role}
                      onChange={(e) =>
                        updateActivity(index, "role", e.target.value as Activity["role"])
                      }
                      className="w-full p-2 border border-slate-300 rounded focus:ring-1 focus:ring-ivy-800 outline-none text-sm"
                    >
                      <option value="Member">Member</option>
                      <option value="Leader/Captain">Leader/Captain</option>
                      <option value="Founder">Founder</option>
                    </select>
                  </div>
                  <div className="md:col-span-4">
                    <label className="block text-xs font-bold text-slate-500 mb-1">
                      Highest Level
                    </label>
                    <select
                      value={activity.level}
                      onChange={(e) =>
                        updateActivity(index, "level", e.target.value as Activity["level"])
                      }
                      className="w-full p-2 border border-slate-300 rounded focus:ring-1 focus:ring-ivy-800 outline-none text-sm"
                    >
                      <option value="School Level">School Level</option>
                      <option value="Regional/State">Regional/State</option>
                      <option value="National/International">
                        National/International
                      </option>
                    </select>
                  </div>
                </div>
              </div>
            ))}

            {activities.length < 5 && (
              <button
                type="button"
                onClick={addActivity}
                className="w-full py-3 border-2 border-dashed border-slate-300 rounded-lg text-slate-500 font-semibold hover:border-ivy-800 hover:text-ivy-800 transition-colors flex justify-center items-center gap-2"
              >
                + Add Activity
              </button>
            )}
          </div>

          <div className="flex justify-between mt-6">
            <button
              type="button"
              onClick={() => navigate("/profile/tests")}
              className="px-6 py-2 rounded-lg font-semibold border border-brand-secondary text-brand-secondary bg-white hover:bg-brand-secondary hover:text-white transition"
            >
              Back
            </button>
            <button
              type="submit"
              className="px-8 py-3 bg-brand-primary text-white rounded-lg font-bold shadow-md hover:bg-brand-dark transition-transform active:scale-95"
            >
              Continue to Targets
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProfileActivitiesStepPage;
