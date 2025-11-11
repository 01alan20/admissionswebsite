
import React from 'react';

const pathwayData = [
  {
    title: 'American Pathway (High School Diploma)',
    description: 'Based on a four-year curriculum with a wide range of subjects. Students earn credits for each course passed, culminating in a High School Diploma.',
    keyFeatures: [
      'Flexible curriculum with core subjects and electives.',
      'Emphasis on GPA (Grade Point Average) over four years.',
      'Standardized tests (SAT/ACT) are often a key component.',
      'Extracurricular activities are highly valued in applications.'
    ]
  },
  {
    title: 'British Pathway (A-Levels)',
    description: 'A specialized two-year program where students typically focus on 3-4 subjects in-depth, leading to Advanced Level (A-Level) qualifications.',
    keyFeatures: [
      'Deep specialization in a few subjects.',
      'Final exams are the primary determinant of grades.',
      'Recognized globally for academic rigor in specific fields.',
      'Less emphasis on extracurriculars compared to the US system.'
    ]
  },
  {
    title: 'International Baccalaureate (IB) Diploma',
    description: 'A comprehensive two-year program that requires students to study across six subject groups, complete a research essay, and engage in service and activity projects.',
    keyFeatures: [
      'Broad, balanced education across sciences, arts, and humanities.',
      'Includes Theory of Knowledge (TOK) and the Extended Essay (EE).',
      'Requires Creativity, Activity, Service (CAS) projects.',
      'Highly regarded by universities worldwide for its holistic approach.'
    ]
  }
];

const HighSchoolPathwaysPage: React.FC = () => {
  return (
    <div className="bg-white p-8 rounded-lg shadow-xl">
      <h1 className="text-3xl font-bold text-brand-dark mb-2">High School Pathways</h1>
      <p className="text-gray-600 mb-8">Understanding different high school curricula is crucial for your US university application. Here's a brief overview of the most common pathways.</p>

      <div className="space-y-8">
        {pathwayData.map((pathway, index) => (
          <div key={index} className="bg-brand-light p-6 rounded-lg border border-gray-200">
            <h2 className="text-2xl font-bold text-brand-primary mb-3">{pathway.title}</h2>
            <p className="text-gray-700 mb-4">{pathway.description}</p>
            <h3 className="font-semibold text-gray-800 mb-2">Key Features:</h3>
            <ul className="list-disc list-inside space-y-1 text-gray-600">
              {pathway.keyFeatures.map((feature, i) => (
                <li key={i}>{feature}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
};

export default HighSchoolPathwaysPage;
