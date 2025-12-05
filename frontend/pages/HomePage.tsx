
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

// A simplified SearchBox for the homepage.
const SearchBox: React.FC = () => {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/explore?q=${encodeURIComponent(query.trim())}`);
    }
  };

  return (
    <form onSubmit={handleSearch} className="w-full max-w-2xl">
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for a university by name, city, or state..."
          className="w-full sm:flex-1 min-w-0 p-3 sm:p-4 text-base sm:text-lg text-gray-900 border border-gray-300 rounded-lg bg-gray-50 focus:ring-brand-secondary focus:border-brand-secondary"
        />
        <button
          type="submit"
          className="w-full sm:w-auto text-white bg-brand-primary hover:bg-brand-dark focus:ring-4 focus:outline-none focus:ring-blue-300 font-semibold rounded-lg text-sm px-5 py-3 sm:py-2"
        >
          Search
        </button>
      </div>
    </form>
  );
};

const HomePage: React.FC = () => {
  useEffect(() => {
    const title = 'US College Admissions Guidance for Students & Families | SeeThrough Admissions';
    const description =
      'Former university dean guiding US and international students and parents to build realistic college lists, plan courses and activities, and submit stronger applications with less stress.';

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
    <div className="space-y-10 sm:space-y-12">
      <section className="bg-white rounded-lg shadow-xl p-6 sm:p-10 md:p-14 lg:p-16 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-brand-light/40 via-white to-brand-accent/10" />
        <div className="relative max-w-4xl text-left space-y-6">
          <p className="text-sm font-semibold text-brand-secondary uppercase tracking-wide">
            College admissions guidance for US and international students
          </p>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-brand-dark leading-tight">
            Realistic US College Admissions Plans for Students and Families
          </h1>
          <p className="text-base sm:text-lg text-gray-700">
            I am a former university dean and student services leader who now coaches students in the US and abroad to build
            a balanced college list, map courses, testing, and activities, and submit stronger applications with less stress.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              to="/contact"
              className="inline-flex items-center justify-center px-6 py-3 text-base font-semibold text-white bg-brand-primary hover:bg-brand-dark rounded-md shadow-sm transition-colors"
            >
              Get personalized email guidance
            </Link>
            <Link
              to="/timelines"
              className="inline-flex items-center justify-center px-6 py-3 text-base font-semibold text-brand-primary bg-white border border-brand-primary/60 hover:border-brand-primary rounded-md shadow-sm transition-colors"
            >
              Check the "Are We On Track?" timelines
            </Link>
            <Link
              to="/explore"
              className="inline-flex items-center justify-center px-6 py-3 text-base font-semibold text-white bg-brand-secondary hover:bg-brand-primary rounded-md shadow-sm transition-colors"
            >
              Explore universities now
            </Link>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
        <div className="bg-white p-6 sm:p-8 rounded-lg shadow-md space-y-4">
          <h2 className="text-2xl font-bold text-brand-primary">Who We Help</h2>
          <ul className="list-disc list-inside text-gray-700 space-y-2">
            <li>US students in public, private, or homeschool settings who want a clear, realistic US college plan.</li>
            <li>International students in IB, A Levels, AP, or local curricula planning a US college path.</li>
            <li>Parents and guardians worldwide who want honest feedback on competitiveness, budget, and fit.</li>
          </ul>
        </div>
        <div className="bg-white p-6 sm:p-8 rounded-lg shadow-md space-y-4">
          <h2 className="text-2xl font-bold text-brand-primary">What We Do</h2>
          <div className="space-y-3">
            <div>
              <h3 className="text-lg font-semibold text-brand-dark">1. US College Planning and Strategy</h3>
              <p className="text-gray-700">
                Four year planning for courses, testing, activities, and timelines for US college applications.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-brand-dark">2. College List, Essays, and Application Support</h3>
              <p className="text-gray-700">
                Common App help, realistic college list building for US and international students, essay brainstorming and review.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-brand-dark">3. Support for Parents and Families</h3>
              <p className="text-gray-700">
                Clarity on admissions chances, scholarship considerations, and regular updates so everyone stays aligned.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
        <div className="bg-white p-6 sm:p-7 rounded-lg shadow-md space-y-3">
          <h2 className="text-2xl font-bold text-brand-primary">Why Work With an Independent College Counselor</h2>
          <p className="text-gray-700">
            School counselors are often overloaded and online forums can be noisy. You get university leadership experience,
            transparent advice, and ethical support with a focus on your best fit.
          </p>
        </div>
        <div className="bg-white p-6 sm:p-7 rounded-lg shadow-md space-y-3">
          <h2 className="text-2xl font-bold text-brand-primary">Experience You Can Trust</h2>
          <ul className="list-disc list-inside text-gray-700 space-y-2">
            <li>Former university leader with 15+ years in higher education.</li>
            <li>Worked with students across Asia, the Middle East, and the US.</li>
            <li>Led student success and admissions operations serving thousands of learners.</li>
          </ul>
        </div>
        <div className="bg-white p-6 sm:p-7 rounded-lg shadow-md space-y-3">
          <h2 className="text-2xl font-bold text-brand-primary">How It Works</h2>
          <ol className="list-decimal list-inside text-gray-700 space-y-2">
            <li>Fill out a short intake form.</li>
            <li>Receive a tailored email reply with next steps and options.</li>
            <li>Choose a package or one-off session with clear timelines.</li>
          </ol>
          <Link to="/contact" className="text-brand-secondary font-semibold hover:text-brand-primary">
            Get personalized help
          </Link>
        </div>
      </section>

      <section className="bg-white p-6 sm:p-8 rounded-lg shadow-md space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-brand-primary">Research US Universities With Our Tools</h2>
            <p className="text-gray-700">
              Explore data, compare schools, and see AI-powered insights built for students and families in the US and abroad.
            </p>
          </div>
          <Link
            to="/explore"
            className="inline-flex items-center justify-center px-5 py-2 text-sm font-semibold text-white bg-brand-secondary hover:bg-brand-primary rounded-md transition-colors"
          >
            Start exploring
          </Link>
        </div>
        <div className="flex justify-center">
          <SearchBox />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { title: 'Explore Schools', body: 'Filter by budget, selectivity, majors, and more to find a strong-fit list.' },
            { title: 'Compare Side-by-Side', body: 'See tuition, acceptance rates, and outcomes in one clean view.' },
            { title: 'AI-Powered Insights', body: 'Get quick summaries tailored to US and international students on every university.' },
          ].map((item) => (
            <div key={item.title} className="border border-gray-200 rounded-md p-4 bg-gray-50">
              <h3 className="text-lg font-semibold text-brand-dark mb-1">{item.title}</h3>
              <p className="text-gray-700">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white p-6 sm:p-8 rounded-lg shadow-md space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-brand-primary">Common Questions</h2>
            <p className="text-gray-700">
              Answers for US and international students and parents considering US college counseling.
            </p>
          </div>
          <Link
            to="/faq"
            className="inline-flex items-center justify-center px-5 py-2 text-sm font-semibold text-white bg-brand-secondary hover:bg-brand-primary rounded-md transition-colors"
          >
            View the full FAQ
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            {
              q: 'What does a college admissions consultant do for students?',
              a: 'Clarifies options, builds a realistic college list, guides essays, and keeps you on track from anywhere.',
            },
            {
              q: 'When should we start working together?',
              a: 'Ideally end of Grade 9 or 10; Grade 11-12 is still impactful for list, essays, and strategy.',
            },
            {
              q: 'Do you guarantee admission to a specific college?',
              a: 'No ethical counselor can guarantee admission; we focus on fit and stronger applications.',
            },
            {
              q: 'Do you work with US and international families across time zones?',
              a: 'Yes. We schedule across US and overseas time zones and keep parents updated at every step.',
            },
          ].map((item) => (
            <details key={item.q} className="group border border-gray-200 rounded-md p-4 bg-gray-50">
              <summary className="flex justify-between items-center cursor-pointer text-brand-dark font-semibold">
                {item.q}
                <span className="text-brand-secondary group-open:rotate-45 transition-transform">+</span>
              </summary>
              <p className="mt-3 text-gray-700">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="bg-brand-primary text-white rounded-lg shadow-lg p-8 sm:p-10 text-center space-y-4">
        <h2 className="text-3xl font-bold">Ready To Get Clear On US Admissions?</h2>
        <p className="text-lg text-white/90 max-w-3xl mx-auto">
          Get honest, research-based guidance from an independent college counselor for students and families in the US and worldwide.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/contact"
            className="inline-flex items-center justify-center px-6 py-3 text-base font-semibold text-brand-primary bg-white rounded-md shadow-sm hover:bg-brand-light transition-colors"
          >
            Get personalized help
          </Link>
          <Link
            to="/faq"
            className="inline-flex items-center justify-center px-6 py-3 text-base font-semibold text-white border border-white/70 rounded-md hover:bg-white/10 transition-colors"
          >
            See common questions
          </Link>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
