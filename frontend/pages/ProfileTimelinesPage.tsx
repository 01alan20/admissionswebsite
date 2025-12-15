import React from "react";
import DashboardLayout from "../components/DashboardLayout";
import { useOnboardingGuard } from "../hooks/useOnboardingGuard";

const timelineData = [
  {
    period: "18–24 months before enrollment",
    tasks: [
      "Begin researching US universities and programs.",
      "Focus on extracurricular activities and leadership roles.",
      "Prepare for and take standardized tests (SAT/ACT) for the first time.",
      "Maintain a strong academic record (GPA).",
    ],
  },
  {
    period: "12–18 months before enrollment",
    tasks: [
      "Narrow down your list of universities (reach, target, safety).",
      "Retake standardized tests if you want to improve scores.",
      "Start drafting your personal statement and essays.",
      "Request recommendation letters from teachers.",
    ],
  },
  {
    period: "9–12 months before enrollment",
    tasks: [
      "Finalize your university list.",
      "Submit Early Decision/Early Action applications (if applicable).",
      "Refine your essays and activity list.",
      "Send official test scores and transcripts to universities.",
    ],
  },
  {
    period: "6–9 months before enrollment",
    tasks: [
      "Submit Regular Decision applications (often due in January).",
      "Complete financial aid forms (CSS Profile, FAFSA if applicable).",
      "Search and apply for external scholarships.",
      "Confirm all application materials have been received.",
    ],
  },
  {
    period: "3–6 months before enrollment",
    tasks: [
      "Receive admissions decisions (typically March–April).",
      "Compare financial aid offers from different universities.",
      "Attend admitted-student events (virtual or in-person).",
      "Choose and submit your enrollment deposit (often May 1).",
    ],
  },
  {
    period: "1–3 months before enrollment",
    tasks: [
      "Request your I-20 from your chosen university.",
      "Schedule your visa interview at a US embassy/consulate.",
      "Arrange housing and travel plans.",
      "Complete pre-enrollment requirements (health forms, registration).",
    ],
  },
];

const ProfileTimelinesPage: React.FC = () => {
  const loadingGuard = useOnboardingGuard(0);

  if (loadingGuard) {
    return (
      <DashboardLayout>
        <div className="py-10 text-sm text-slate-600">Loading your workspace...</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <header className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <p className="text-xs uppercase tracking-wide text-brand-secondary font-semibold">
            Planning
          </p>
          <h1 className="text-3xl font-bold text-slate-900 mt-1">Timelines</h1>
          <p className="mt-2 text-sm text-slate-600 max-w-3xl">
            A simple, high-level checklist to keep you on track as you apply to US universities.
          </p>
        </header>

        <div className="space-y-4">
          {timelineData.map((item) => (
            <div
              key={item.period}
              className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <h2 className="text-lg font-semibold text-slate-900">{item.period}</h2>
              </div>
              <ul className="mt-4 space-y-2 text-sm text-slate-700 list-disc list-inside">
                {item.tasks.map((task) => (
                  <li key={task}>{task}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ProfileTimelinesPage;

