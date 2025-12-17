import React, { useState } from "react";
import type { StudentProfile, University, Activity } from "../types";
import { COUNTRY_OPTIONS, DEMOGRAPHIC_OPTIONS, MAJOR_OPTIONS } from "../constants";

const mapClassRankPercentile = (value: string): string => {
  if (/Top 1%/i.test(value)) return "1";
  if (/Top 5%/i.test(value)) return "5";
  if (/Top 10%/i.test(value)) return "10";
  if (/Top 25%/i.test(value)) return "25";
  if (/Top 50%/i.test(value)) return "50";
  if (/Below 50%/i.test(value)) return "51";
  return "";
};

interface AdmissionFormProps {
  student: StudentProfile;
  setStudent: React.Dispatch<React.SetStateAction<StudentProfile>>;
  selectedUni: University | null;
  setSelectedUni: (uni: University) => void;
  onSubmit: () => void;
  isLoading: boolean;
  availableUniversities: University[];
  maxUniversities?: number;
}

export const AdmissionForm: React.FC<AdmissionFormProps> = ({
  student,
  setStudent,
  selectedUni,
  setSelectedUni,
  onSubmit,
  isLoading,
  availableUniversities,
  maxUniversities = 3,
}) => {
  const [step, setStep] = useState(1);
  const [targetSchools, setTargetSchools] = useState<University[]>(
    selectedUni ? [selectedUni] : []
  );
  const [showSat, setShowSat] = useState(!!student.satMath || !!student.satEBRW);
  const [showAct, setShowAct] = useState(!!student.actScore);
  const [uniQuery, setUniQuery] = useState("");

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value } = e.target;
    setStudent((prev) => ({ ...prev, [name]: value }));
  };

  const updateClassRank = (
    updates: Partial<Pick<StudentProfile, "classRankExact" | "classRankCategory" | "classRankPercentile" | "classSize">>
  ) => {
    setStudent((prev) => {
      const next = { ...prev, ...updates };
      const exact =
        next.classRankExact && next.classSize
          ? `${next.classRankExact} / ${next.classSize}`
          : next.classRankExact || "";
      const category = next.classRankCategory || "";
      const finalValue = exact || category || "N/A";
      return { ...next, classRank: finalValue };
    });
  };

  const addActivity = () => {
    if (student.activities.length < 5) {
      setStudent((prev) => ({
        ...prev,
        activities: [
          ...prev.activities,
          {
            id: Date.now().toString(),
            name: "",
            role: "Member",
            level: "School Level",
          },
        ],
      }));
    }
  };

  const updateActivity = (index: number, field: keyof Activity, value: string) => {
    const newActivities = [...student.activities];
    newActivities[index] = { ...newActivities[index], [field]: value } as Activity;
    setStudent((prev) => ({ ...prev, activities: newActivities }));
  };

  const removeActivity = (index: number) => {
    setStudent((prev) => ({
      ...prev,
      activities: prev.activities.filter((_, i) => i !== index),
    }));
  };

  const toggleDemographic = (demo: string) => {
    setStudent((prev) => {
      const exists = prev.demographics.includes(demo);
      return {
        ...prev,
        demographics: exists
          ? prev.demographics.filter((d) => d !== demo)
          : [...prev.demographics, demo],
      };
    });
  };

  const toggleTargetSchool = (uni: University) => {
    const exists = targetSchools.find((u) => u.unitid === uni.unitid);
    let newTargets: University[];
    if (exists) {
      newTargets = targetSchools.filter((u) => u.unitid !== uni.unitid);
    } else {
      if (targetSchools.length >= maxUniversities) return;
      newTargets = [...targetSchools, uni];
    }
    setTargetSchools(newTargets);
    if (newTargets.length > 0) {
      setSelectedUni(newTargets[0]);
    }
  };

  const handleNext = () => {
    if (step < 6) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleFinalSubmit = () => {
    const satTotal =
      (parseInt(student.satMath, 10) || 0) + (parseInt(student.satEBRW, 10) || 0);

    console.log(
      JSON.stringify(
        {
          studentProfile: {
            firstName: student.firstName,
            lastName: student.lastName,
            location: {
              city: student.city,
              country: student.country,
            },
            gpa: parseFloat(student.gpa),
            classRank: student.classRank,
            testScores: {
              sat: showSat
                ? {
                    math: parseInt(student.satMath, 10) || 0,
                    ebrw: parseInt(student.satEBRW, 10) || 0,
                    total: satTotal,
                  }
                : null,
              act: showAct ? parseInt(student.actScore, 10) || 0 : null,
            },
            demographics: student.demographics,
            intended_major: student.intendedMajor,
            ecs: student.activities.map((a) => ({
              name: a.name,
              role: a.role,
              level: a.level,
            })),
          },
          targetSchools: targetSchools.map((u) => u.name),
        },
        null,
        2
      )
    );

    onSubmit();
  };

  const renderProgressBar = () => (
    <div className="w-full bg-slate-100 rounded-full h-2.5 mb-8">
      <div
        className="bg-ivy-900 h-2.5 rounded-full transition-all duration-500 ease-out"
        style={{ width: `${(step / 6) * 100}%` }}
      ></div>
    </div>
  );

  return (
    <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6 md:p-10 min-h-[500px] flex flex-col">
      {renderProgressBar()}

      <div className="mb-6">
        <span className="text-ivy-800 font-bold tracking-wider text-xs uppercase">
          Step {step} of 6
        </span>
        <h2 className="text-2xl font-bold text-slate-900 mt-1">
          {step === 1 && "Your Name"}
          {step === 2 && "Where You Live"}
          {step === 3 && "Academic Performance (GPA)"}
          {step === 4 && "Tests (Optional)"}
          {step === 5 && "The 'Spike' Check (Activities)"}
          {step === 6 && "Target Universities"}
        </h2>
      </div>

      <div className="flex-grow space-y-6">
        {step === 1 && (
          <div className="space-y-6 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  First Name
                </label>
                <input
                  type="text"
                  name="firstName"
                  value={student.firstName}
                  onChange={handleChange}
                  placeholder="e.g. Jordan"
                  className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-ivy-800 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Last Name
                </label>
                <input
                  type="text"
                  name="lastName"
                  value={student.lastName}
                  onChange={handleChange}
                  placeholder="e.g. Lee"
                  className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-ivy-800 outline-none"
                />
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Country
                </label>
                <input
                  list="country-options"
                  name="country"
                  value={student.country}
                  onChange={handleChange}
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
                  name="city"
                  value={student.city}
                  onChange={handleChange}
                  placeholder="e.g. Boston"
                  className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-ivy-800 outline-none"
                />
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6 animate-fade-in">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Unweighted GPA (4.0 Scale)
              </label>
              <input
                type="number"
                name="gpa"
                step="0.01"
                min="0"
                max="4.0"
                value={student.gpa}
                onChange={handleChange}
                className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-ivy-800 outline-none"
                placeholder="e.g. 3.85"
              />
              {parseFloat(student.gpa) > 0 && parseFloat(student.gpa) < 3 && (
                <p className="text-sm text-amber-600 mt-2">
                  We will focus on your narrative strategy to overcome this metric.
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Class Rank (Exact or Category)
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Your Rank Number
                  </label>
                  <input
                    type="number"
                    min="1"
                    name="classRankExact"
                    value={student.classRankExact || ""}
                    onChange={(e) => updateClassRank({ classRankExact: e.target.value })}
                    placeholder="e.g. 12"
                    className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-ivy-800 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Class Size
                  </label>
                  <input
                    type="number"
                    min="1"
                    name="classSize"
                    value={student.classSize || ""}
                    onChange={(e) => updateClassRank({ classSize: e.target.value })}
                    placeholder="e.g. 420"
                    className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-ivy-800 outline-none"
                  />
                </div>
              </div>
              <div className="mt-3">
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Or select a category
                </label>
                <select
                  name="classRankCategory"
                  value={student.classRankCategory || ""}
                  onChange={(e) =>
                    updateClassRank({
                      classRankCategory: e.target.value,
                      classRankPercentile: mapClassRankPercentile(e.target.value),
                    })
                  }
                  className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-ivy-800 outline-none"
                >
                  <option value="">N/A (School doesn't rank)</option>
                  <option value="Top 1%">Top 1%</option>
                  <option value="Top 5%">Top 5%</option>
                  <option value="Top 10%">Top 10%</option>
                  <option value="Top 25%">Top 25%</option>
                  <option value="Top 50%">Top 50%</option>
                  <option value="Below 50%">Below 50%</option>
                </select>
                <p className="mt-1 text-xs text-slate-500">
                  If both exact and category are filled, we’ll prefer the exact rank but keep both saved.
                </p>
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-6 animate-fade-in">
            <div className="pt-2 border-t border-slate-100">
              <label className="block text-sm font-bold text-slate-900 mb-3">
                Standardized Test Scores (Optional)
              </label>

              <div className="flex gap-4 mb-4">
                <button
                  type="button"
                  onClick={() => setShowSat(!showSat)}
                  className={`px-4 py-2 rounded-full border text-sm font-semibold transition-all ${
                    showSat
                      ? "bg-ivy-900 text-white border-ivy-900"
                      : "bg-white text-slate-500 border-slate-300 hover:border-ivy-800"
                  }`}
                >
                  {showSat ? "✓ SAT" : "+ SAT"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAct(!showAct)}
                  className={`px-4 py-2 rounded-full border text-sm font-semibold transition-all ${
                    showAct
                      ? "bg-ivy-900 text-white border-ivy-900"
                      : "bg-white text-slate-500 border-slate-300 hover:border-ivy-800"
                  }`}
                >
                  {showAct ? "✓ ACT" : "+ ACT"}
                </button>
              </div>

              {showSat && (
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-4 animate-fade-in">
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
                        name="satMath"
                        min="200"
                        max="800"
                        value={student.satMath}
                        onChange={handleChange}
                        placeholder="e.g. 780"
                        className="w-full p-2 border border-slate-300 rounded focus:ring-1 focus:ring-ivy-800 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Reading & Writing (200-800)
                      </label>
                      <input
                        type="number"
                        name="satEBRW"
                        min="200"
                        max="800"
                        value={student.satEBRW}
                        onChange={handleChange}
                        placeholder="e.g. 720"
                        className="w-full p-2 border border-slate-300 rounded focus:ring-1 focus:ring-ivy-800 outline-none"
                      />
                    </div>
                  </div>
                  <div className="mt-3 text-right">
                    <span className="text-sm font-bold text-slate-700">
                      Total:{" "}
                      <span className="text-ivy-900">
                        {(parseInt(student.satMath, 10) || 0) +
                          (parseInt(student.satEBRW, 10) || 0)}
                      </span>
                    </span>
                  </div>
                </div>
              )}

              {showAct && (
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 animate-fade-in">
                  <h4 className="text-xs font-bold text-slate-500 uppercase mb-3">
                    ACT
                  </h4>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Composite Score (1-36)
                    </label>
                    <input
                      type="number"
                      name="actScore"
                      min="1"
                      max="36"
                      value={student.actScore}
                      onChange={handleChange}
                      placeholder="e.g. 34"
                      className="w-full p-2 border border-slate-300 rounded focus:ring-1 focus:ring-ivy-800 outline-none md:w-1/2"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-4 animate-fade-in">
            <p className="text-slate-600 text-sm mb-4">
              Add your top activities (Max 5). The AI looks for "National" reach +
              "Leadership" roles.
            </p>

            {student.activities.map((activity, index) => (
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
                      <option value="National/International">National/International</option>
                    </select>
                  </div>
                </div>
              </div>
            ))}

            {student.activities.length < 5 && (
              <button
                type="button"
                onClick={addActivity}
                className="w-full py-3 border-2 border-dashed border-slate-300 rounded-lg text-slate-500 font-semibold hover:border-ivy-800 hover:text-ivy-800 transition-colors flex justify-center items-center gap-2"
              >
                + Add Activity
              </button>
            )}
          </div>
        )}

        {step === 6 && (
          <div className="space-y-4 animate-fade-in">
            <p className="text-slate-600 mb-2">
              Select up to {maxUniversities} universities.
              <br />
              <span className="text-xs text-slate-500">
                (Start typing below to search by university name, city, or state.)
              </span>
            </p>

            <div className="mb-3">
              <input
                type="text"
                placeholder="Search universities..."
                className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-ivy-800 outline-none text-sm"
                value={uniQuery}
                onChange={(e) => setUniQuery(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 gap-3 max-h-[400px] overflow-y-auto pr-2">
              {availableUniversities
                .filter((uni) => {
                  const q = uniQuery.trim().toLowerCase();
                  if (!q) return true;
                  const haystack = `${uni.name ?? ""} ${uni.city ?? ""} ${
                    uni.state ?? ""
                  }`.toLowerCase();
                  return haystack.includes(q);
                })
                .slice(0, 50)
                .map((uni) => {
                const isSelected = targetSchools.some((u) => u.unitid === uni.unitid);
                return (
                  <button
                    type="button"
                    key={uni.unitid}
                    onClick={() => toggleTargetSchool(uni)}
                    className={`flex justify-between items-center p-4 rounded-xl border transition-all ${
                      isSelected
                        ? "bg-ivy-900 border-ivy-900 text-white shadow-md"
                        : "bg-white border-slate-200 text-slate-800 hover:border-ivy-800"
                    }`}
                  >
                    <div className="text-left">
                      <div className="font-bold">{uni.name}</div>
                      <div
                        className={`text-xs ${
                          isSelected ? "text-ivy-100" : "text-slate-500"
                        }`}
                      >
                        {uni.city}, {uni.state}
                      </div>
                    </div>
                    {isSelected && <span className="text-xl">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-between mt-8 pt-6 border-t border-slate-100">
        <button
          type="button"
          onClick={handleBack}
          disabled={step === 1}
          className={`px-6 py-2 rounded-lg font-semibold text-slate-600 hover:bg-slate-100 transition ${
            step === 1 ? "opacity-0 pointer-events-none" : ""
          }`}
        >
          Back
        </button>

        {step < 6 ? (
          <button
            type="button"
            onClick={handleNext}
            disabled={step === 1 && (!student.firstName || !student.lastName)}
            className="px-8 py-3 bg-ivy-900 text-white rounded-lg font-bold shadow-md hover:bg-ivy-800 transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next Step
          </button>
        ) : (
          <button
            type="button"
            onClick={handleFinalSubmit}
            disabled={isLoading || targetSchools.length === 0}
            className="px-8 py-3 bg-green-600 text-white rounded-lg font-bold shadow-md hover:bg-green-700 transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? "Analyzing..." : "Analyze Strategy"}
          </button>
        )}
      </div>
    </div>
  );
};
