import React from "react";
import DashboardLayout from "../components/DashboardLayout";
import { useOnboardingGuard } from "../hooks/useOnboardingGuard";

const pathwayData = [
  {
    title: "American Pathway (High School Diploma)",
    description:
      "A four-year curriculum with a wide range of subjects. Students earn credits for each course passed, culminating in a High School Diploma.",
    keyFeatures: [
      "Flexible curriculum with core subjects and electives.",
      "Emphasis on GPA over four years.",
      "Standardized tests (SAT/ACT) are often a key component.",
      "Extracurricular activities are highly valued in applications.",
    ],
  },
  {
    title: "British Pathway (A-Levels)",
    description:
      "A specialized two-year program where students typically focus on 3–4 subjects in-depth, leading to A-Level qualifications.",
    keyFeatures: [
      "Deep specialization in a few subjects.",
      "Final exams are the primary determinant of grades.",
      "Recognized globally for academic rigor in specific fields.",
      "Less emphasis on extracurriculars compared to the US system.",
    ],
  },
  {
    title: "International Baccalaureate (IB) Diploma",
    description:
      "A comprehensive two-year program that requires students to study across six subject groups, complete a research essay, and engage in service and activity projects.",
    keyFeatures: [
      "Broad, balanced education across sciences, arts, and humanities.",
      "Includes Theory of Knowledge (TOK) and the Extended Essay (EE).",
      "Requires Creativity, Activity, Service (CAS) projects.",
      "Highly regarded by universities worldwide for its holistic approach.",
    ],
  },
];

const ProfilePathwaysPage: React.FC = () => {
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
          <h1 className="text-3xl font-bold text-slate-900 mt-1">Pathways</h1>
          <p className="mt-2 text-sm text-slate-600 max-w-3xl">
            A quick guide to common high school curricula and what US universities typically expect.
          </p>
        </header>

        <div className="grid gap-5 lg:grid-cols-3">
          {pathwayData.map((pathway) => (
            <div
              key={pathway.title}
              className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6"
            >
              <h2 className="text-lg font-semibold text-slate-900">
                {pathway.title}
              </h2>
              <p className="mt-2 text-sm text-slate-600">{pathway.description}</p>
              <div className="mt-4">
                <p className="text-xs uppercase tracking-wide font-semibold text-slate-500">
                  Key Features
                </p>
                <ul className="mt-2 space-y-2 text-sm text-slate-700 list-disc list-inside">
                  {pathway.keyFeatures.map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ProfilePathwaysPage;

