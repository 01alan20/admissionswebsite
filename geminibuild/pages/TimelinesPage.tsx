import React from 'react';

const timelineData = [
  {
    period: '18-24 Months Before Enrollment',
    tasks: [
      'Begin researching US universities and programs.',
      'Focus on extracurricular activities and leadership roles.',
      'Prepare for and take standardized tests (SAT/ACT) for the first time.',
      'Maintain a strong academic record (GPA).',
    ],
  },
  {
    period: '12-18 Months Before Enrollment',
    tasks: [
      'Narrow down your list of universities (reach, target, safety schools).',
      'Retake standardized tests if necessary to improve scores.',
      'Start drafting your personal statement/essays.',
      'Request recommendation letters from teachers.',
    ],
  },
  {
    period: '9-12 Months Before Enrollment',
    tasks: [
      'Finalize your university list.',
      'Complete and submit applications for Early Decision/Early Action (if applicable).',
      'Work on and refine your application essays.',
      'Send official test scores and transcripts to universities.',
    ],
  },
  {
    period: '6-9 Months Before Enrollment',
    tasks: [
      'Submit Regular Decision applications (typically due in January).',
      'Complete financial aid forms (CSS Profile, FAFSA if applicable).',
      'Search and apply for external scholarships.',
      'Follow up to ensure all application materials have been received.',
    ],
  },
  {
    period: '3-6 Months Before Enrollment',
    tasks: [
      'Receive admissions decisions (typically March-April).',
      'Compare financial aid offers from different universities.',
      'Visit campuses if possible or attend virtual admitted student events.',
      'Make your final decision and submit your deposit by the deadline (usually May 1).',
    ],
  },
  {
    period: '1-3 Months Before Enrollment',
    tasks: [
      'Apply for your I-20 form from your chosen university.',
      'Schedule your visa interview at the nearest US embassy or consulate.',
      'Arrange housing and make travel plans.',
      'Complete any pre-enrollment requirements (health forms, course registration).',
    ],
  },
];

const TimelinesPage: React.FC = () => {
  return (
    <div className="bg-white p-8 rounded-lg shadow-xl">
      <h1 className="text-3xl font-bold text-brand-dark mb-2">Application Timelines</h1>
      <p className="text-gray-600 mb-8">
        Navigating the US university application process requires careful planning. Here is a general timeline to help you stay organized and meet key deadlines.
      </p>

      <div className="space-y-8">
        {timelineData.map((item, index) => (
          <div key={index} className="flex flex-col md:flex-row gap-6 border-b pb-6 last:border-b-0">
            <div className="md:w-1/3">
              <h2 className="text-xl font-bold text-brand-primary sticky top-24">{item.period}</h2>
            </div>
            <div className="md:w-2/3">
              <ul className="list-disc list-inside space-y-3 text-gray-700 bg-brand-light p-4 rounded-md">
                {item.tasks.map((task, i) => (
                  <li key={i}>{task}</li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TimelinesPage;