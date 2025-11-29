import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useOnboardingGuard } from "../hooks/useOnboardingGuard";
import { useOnboardingContext } from "../context/OnboardingContext";
import { COUNTRY_OPTIONS } from "../constants";

const ProfileLocationStepPage: React.FC = () => {
  const loading = useOnboardingGuard(2);
  const { setOnboardingStepRemote, studentProfile } = useOnboardingContext();
  const [country, setCountry] = useState(studentProfile.country ?? "");
  const [city, setCity] = useState(studentProfile.city ?? "");
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
    if (!country || !city) return;
    await setOnboardingStepRemote(2, { country, city });
    navigate("/profile/gpa");
  };

  return (
    <div className="max-w-xl mx-auto">
      <div className="bg-white p-6 md:p-8 rounded-lg shadow-xl">
        <h1 className="text-2xl font-bold text-slate-900 mb-4">
          Step 2 of 8: Where You Live
        </h1>
        <form onSubmit={handleNext} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Country
              </label>
              <input
                list="country-options"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="Start typing to search..."
                className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-ivy-800 outline-none"
              />
              <datalist id="country-options">
                {COUNTRY_OPTIONS.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                City
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Boston"
                className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-ivy-800 outline-none"
              />
            </div>
          </div>

          <div className="flex justify-between">
            <button
              type="button"
              onClick={() => navigate("/profile/name")}
              className="px-6 py-2 rounded-lg font-semibold border border-brand-secondary text-brand-secondary bg-white hover:bg-brand-secondary hover:text-white transition"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={!country || !city}
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

export default ProfileLocationStepPage;
