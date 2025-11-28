import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useOnboardingGuard } from "../hooks/useOnboardingGuard";
import { useOnboardingContext } from "../context/OnboardingContext";

const ProfileTestsStepPage: React.FC = () => {
  const loading = useOnboardingGuard(4);
  const { setOnboardingStepRemote, studentProfile } =
    useOnboardingContext();
  const [showSat, setShowSat] = useState(
    studentProfile.satMath != null || studentProfile.satEBRW != null
  );
  const [showAct, setShowAct] = useState(studentProfile.actComposite != null);
  const [satMath, setSatMath] = useState(
    studentProfile.satMath != null ? String(studentProfile.satMath) : ""
  );
  const [satEBRW, setSatEBRW] = useState(
    studentProfile.satEBRW != null ? String(studentProfile.satEBRW) : ""
  );
  const [actScore, setActScore] = useState(
    studentProfile.actComposite != null ? String(studentProfile.actComposite) : ""
  );
  const [error, setError] = useState<string | null>(null);
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
    setError(null);

    let satMathNum: number | null = null;
    let satEBRWNum: number | null = null;
    let actNum: number | null = null;

    if (showSat) {
      if (!satMath || !satEBRW) {
        setError("Please enter both SAT section scores or turn SAT off.");
        return;
      }
      const m = Number(satMath);
      const r = Number(satEBRW);
      if (
        !Number.isInteger(m) ||
        !Number.isInteger(r) ||
        m < 200 ||
        m > 800 ||
        r < 200 ||
        r > 800
      ) {
        setError("SAT scores must be whole numbers between 200 and 800.");
        return;
      }
      satMathNum = m;
      satEBRWNum = r;
    }

    if (showAct) {
      if (!actScore) {
        setError("Please enter your ACT composite score or turn ACT off.");
        return;
      }
      const a = Number(actScore);
      if (!Number.isInteger(a) || a < 1 || a > 36) {
        setError("ACT score must be a whole number between 1 and 36.");
        return;
      }
      actNum = a;
    }

    await setOnboardingStepRemote(4, {
      satMath: satMathNum,
      satEBRW: satEBRWNum,
      actComposite: actNum,
    });
    navigate("/profile/activities");
  };

  const satTotal =
    (parseInt(satMath || "0", 10) || 0) + (parseInt(satEBRW || "0", 10) || 0);

  return (
    <div className="max-w-xl mx-auto">
      <div className="bg-white p-6 md:p-8 rounded-lg shadow-xl">
        <h1 className="text-2xl font-bold text-slate-900 mb-4">
          Step 4 of 8: Tests (Optional)
        </h1>
        <form onSubmit={handleNext} className="space-y-6">
          <p className="text-sm text-slate-600">
            You can skip this step if you are applying test-optional or have not taken
            standardized tests yet.
          </p>

            <div className="pt-2 border-t border-slate-100">
              <label className="block text-sm font-bold text-slate-900 mb-3">
                Standardized Test Scores
              </label>

            <div className="flex gap-4 mb-4">
              <button
                type="button"
                onClick={() => {
                  setShowSat((v) => !v);
                  setError(null);
                }}
                className={`px-4 py-2 rounded-full border text-sm font-semibold transition-all ${
                  showSat
                    ? "bg-brand-primary text-white border-brand-primary"
                    : "bg-white text-slate-500 border-slate-300 hover:border-ivy-800"
                }`}
              >
                {showSat ? "✓ SAT" : "+ SAT"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAct((v) => !v);
                  setError(null);
                }}
                className={`px-4 py-2 rounded-full border text-sm font-semibold transition-all ${
                  showAct
                    ? "bg-brand-primary text-white border-brand-primary"
                    : "bg-white text-slate-500 border-slate-300 hover:border-ivy-800"
                }`}
              >
                {showAct ? "✓ ACT" : "+ ACT"}
              </button>
            </div>

            {showSat && (
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-4">
                <h4 className="text-xs font-bold text-slate-500 uppercase mb-3">
                  SAT Breakdown
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Math (200-800)
                    </label>
                    <input
                      type="number"
                      min="200"
                      max="800"
                      value={satMath}
                      onChange={(e) => setSatMath(e.target.value)}
                      placeholder="e.g. 780"
                      className="w-full p-2 border border-slate-300 rounded focus:ring-1 focus:ring-ivy-800 outline-none text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Reading & Writing (200-800)
                    </label>
                    <input
                      type="number"
                      min="200"
                      max="800"
                      value={satEBRW}
                      onChange={(e) => setSatEBRW(e.target.value)}
                      placeholder="e.g. 720"
                      className="w-full p-2 border border-slate-300 rounded focus:ring-1 focus:ring-ivy-800 outline-none text-sm"
                    />
                  </div>
                </div>
                <div className="mt-3 text-right">
                  <span className="text-sm font-bold text-slate-700">
                    Total: <span className="text-ivy-900">{satTotal}</span>
                  </span>
                </div>
              </div>
            )}

            {showAct && (
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <h4 className="text-xs font-bold text-slate-500 uppercase mb-3">
                  ACT
                </h4>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Composite Score (1-36)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="36"
                    value={actScore}
                    onChange={(e) => setActScore(e.target.value)}
                    placeholder="e.g. 34"
                    className="w-full p-2 border border-slate-300 rounded focus:ring-1 focus:ring-ivy-800 outline-none text-sm md:w-1/2"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-between">
            <button
              type="button"
              onClick={() => navigate("/profile/gpa")}
              className="px-6 py-2 rounded-lg font-semibold border border-brand-secondary text-brand-secondary bg-white hover:bg-brand-secondary hover:text-white transition"
            >
              Back
            </button>
            <button
              type="submit"
              className="px-8 py-3 bg-brand-primary text-white rounded-lg font-bold shadow-md hover:bg-brand-dark transition-transform active:scale-95"
            >
              Continue
            </button>
          </div>

          {error && (
            <p className="text-sm text-red-600 mt-2">
              {error}
            </p>
          )}
        </form>
      </div>
    </div>
  );
};

export default ProfileTestsStepPage;
