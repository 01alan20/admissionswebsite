import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';

type FaqItem = { question: string; answer: string };
type FaqSection = { heading: string; items: FaqItem[] };

const faqSections: FaqSection[] = [
  {
    heading: 'About SeeThrough Admissions',
    items: [
      {
        question: 'What does a college admissions consultant do for international students?',
        answer:
          'A college admissions consultant for international students helps you understand US universities, plan courses and activities, build a realistic college list, and submit stronger applications with clear timelines and honest feedback.',
      },
      {
        question: 'How is SeeThrough Admissions different from a school counselor or online forums?',
        answer:
          'School counselors are often overloaded and forums can be noisy. You get one-to-one support from a former university leader who uses data, transparency, and ethical guidance instead of rumors or shortcuts.',
      },
      {
        question: 'Who do you work with?',
        answer:
          'International and expat students in IB, A Levels, AP, or local curricula across Asia, the Middle East, and worldwide, plus their families.',
      },
      {
        question: 'Do you only help with US colleges?',
        answer:
          'US admissions is the primary focus. If you also want to consider the UK, Canada, or other regions, we can talk through fit and refer you to specialists as needed.',
      },
    ],
  },
  {
    heading: 'When To Start and How The Process Works',
    items: [
      {
        question: 'When should we start working with a college admissions consultant?',
        answer:
          'Ideally at the end of Grade 9 or 10 to plan courses, testing, and activities. Grade 11 or early Grade 12 is still very helpful for list building, essays, and application strategy.',
      },
      {
        question: 'Is it too late to get help if we are already in Grade 12?',
        answer:
          'No. We focus on the highest-impact stepsΓÇöcollege list balance, essay strategy, timelines, and making sure recommendations and activities are presented clearly.',
      },
      {
        question: 'How does working with you actually work?',
        answer:
          'You complete a short intake, we reply with tailored email guidance within a week, then map your plan. Ongoing sessions include shared documents, structured checklists, and regular updates for students and parents.',
      },
      {
        question: 'Do you work with students in different time zones?',
        answer:
          'Yes. Sessions are scheduled across time zones, and parents receive concise summaries so everyone stays aligned.',
      },
    ],
  },
  {
    heading: 'Services, Pricing, and Ethics',
    items: [
      {
        question: 'What services do you offer?',
        answer:
          'US college planning, course and testing strategy, activity and summer planning, college list building, Common App help, essay brainstorming and review, interview prep, and ongoing parent updates.',
      },
      {
        question: 'How much does college admissions consulting cost?',
        answer:
          'Packages and hourly sessions are available after we review your intake so you only pay for what you need. Pricing is transparent and depends on scope and timeline.',
      },
      {
        question: 'Do you guarantee admission to a specific college?',
        answer:
          'No ethical independent college counselor can guarantee admission. We focus on fit, balanced lists, and stronger applications so you present your best case.',
      },
      {
        question: 'Do you write essays for students?',
        answer:
          'No. We brainstorm, guide, and provide detailed feedback, but the writing stays the studentΓÇÖs own voice. Essay ghostwriting is against ethical standards.',
      },
      {
        question: 'Can you work with our school counselor?',
        answer:
          'Yes. We are happy to coordinate so recommendations, school reports, and deadlines stay aligned with your application strategy.',
      },
    ],
  },
  {
    heading: 'Practical Questions',
    items: [
      {
        question: 'Where are you based and do you meet online?',
        answer:
          'I split time between Singapore and Atlanta and meet families globally over video. All resources are shared online for easy access.',
      },
      {
        question: 'What kinds of students do best with SeeThrough Admissions?',
        answer:
          'Students and families who want clarity, are willing to reflect, and follow through on an agreed plan. You do not need to be perfectΓÇöyou need to be engaged.',
      },
      {
        question: 'What results have your students achieved?',
        answer:
          'Students have gained clarity on balanced lists, stronger essays, and confident submissions. Outcomes include competitive US admits and better-aligned choices without unnecessary stress.',
      },
      {
        question: 'How do we get started?',
        answer:
          'Share a short intake, receive a tailored email reply, and we will outline your plan with next steps, timeline, and pricing so you can decide comfortably.',
      },
    ],
  },
];

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'What does a college admissions consultant do for international students?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: faqSections[0].items[0].answer,
      },
    },
    {
      '@type': 'Question',
      name: 'When should we start working with a college admissions consultant?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: faqSections[1].items[0].answer,
      },
    },
    {
      '@type': 'Question',
      name: 'Do you guarantee admission to a specific college?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: faqSections[2].items[2].answer,
      },
    },
    {
      '@type': 'Question',
      name: 'Do you write essays for students?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: faqSections[2].items[3].answer,
      },
    },
  ],
};

const FaqPage: React.FC = () => {
  useEffect(() => {
    const title = 'College Admissions Consultant FAQs for International Students and Families | SeeThrough Admissions';
    const description =
      'Common questions about working with a college admissions consultant for international students, including timing, services, ethics, and how to get started.';

    document.title = title;
    let meta = document.querySelector('meta[name=\"description\"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'description');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', description);
  }, []);

  return (
    <div className="space-y-8">
      <div className="bg-white rounded-lg shadow-md p-6 sm:p-8 space-y-4">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-brand-dark">
          College Admissions Consultant FAQs for International Students and Families
        </h1>
        <p className="text-gray-700 text-lg">
          Clear answers to the most common questions parents and students ask about independent college counseling,
          timing, and how US college admissions help works for international students.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            to="/contact"
            className="inline-flex items-center justify-center px-5 py-3 text-sm font-semibold text-white bg-brand-primary hover:bg-brand-dark rounded-md transition-colors"
          >
            Get personalized email guidance
          </Link>
          <Link
            to="/explore"
            className="inline-flex items-center justify-center px-5 py-3 text-sm font-semibold text-brand-primary bg-white border border-brand-primary/60 hover:border-brand-primary rounded-md transition-colors"
          >
            Explore US universities
          </Link>
        </div>
      </div>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />

      <div className="space-y-6">
        {faqSections.map((section) => (
          <div key={section.heading} className="bg-white rounded-lg shadow-sm border border-gray-100">
            <div className="border-b border-gray-100 px-6 py-4">
              <h2 className="text-xl font-bold text-brand-primary">{section.heading}</h2>
            </div>
            <div className="divide-y divide-gray-100">
              {section.items.map((item) => (
                <details key={item.question} className="group px-6 py-4">
                  <summary className="flex items-center justify-between cursor-pointer text-brand-dark font-semibold">
                    {item.question}
                    <span className="text-brand-secondary group-open:rotate-45 transition-transform">+</span>
                  </summary>
                  <p className="mt-3 text-gray-700 leading-relaxed">{item.answer}</p>
                </details>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-brand-primary text-white rounded-lg shadow-md p-7 sm:p-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-2xl font-bold">Need a quick answer that is not listed?</h3>
          <p className="text-white/90">Send your question and we will reply within a week with a tailored response.</p>
        </div>
        <Link
          to="/contact"
          className="inline-flex items-center justify-center px-5 py-3 text-sm font-semibold text-brand-primary bg-white rounded-md shadow-sm hover:bg-brand-light transition-colors"
        >
          Ask your question
        </Link>
      </div>
    </div>
  );
};

export default FaqPage;
