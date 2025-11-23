
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

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
      <div className="relative">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for a university by name, city, or state..."
          className="w-full p-4 pr-16 text-lg text-gray-900 border border-gray-300 rounded-lg bg-gray-50 focus:ring-brand-secondary focus:border-brand-secondary"
        />
        <button
          type="submit"
          className="text-white absolute right-2.5 bottom-2.5 bg-brand-primary hover:bg-brand-dark focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-4 py-2"
        >
          Search
        </button>
      </div>
    </form>
  );
};

const HomePage: React.FC = () => {
  return (
    <div className="text-center">
      <section className="bg-white rounded-lg shadow-xl p-8 md:p-16 my-8 md:my-16">
        <h1 className="text-4xl md:text-6xl font-extrabold text-brand-dark mb-4">
          Find Your Future US University
        </h1>
        <p className="text-lg md:text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
          Explore thousands of universities, compare your options, and get personalized insights to start your journey in the United States.
        </p>
        <div className="flex justify-center">
          <SearchBox />
        </div>
      </section>

      <section className="grid md:grid-cols-3 gap-8 text-left">
        <div className="bg-white p-6 rounded-lg shadow-md hover:shadow-xl transition-shadow">
          <h3 className="text-2xl font-bold text-brand-primary mb-2">Explore Schools</h3>
          <p className="text-gray-600">Use our powerful filters to narrow down schools by budget, selectivity, majors, and more to discover the perfect fit for you.</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md hover:shadow-xl transition-shadow">
          <h3 className="text-2xl font-bold text-brand-primary mb-2">Compare Side-by-Side</h3>
          <p className="text-gray-600">Select up to three universities and compare key metrics like tuition, acceptance rates, and test scores in an easy-to-read format.</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md hover:shadow-xl transition-shadow">
          <h3 className="text-2xl font-bold text-brand-primary mb-2">Get AI-Powered Insights</h3>
          <p className="text-gray-600">Leverage our AI-powered profile summaries on each university page to get a quick, tailored overview for international students.</p>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
