import React from 'react';
import { HashRouter, Route, Routes, NavLink } from 'react-router-dom';
import HomePage from './pages/HomePage';
import ExplorePage from './pages/ExplorePage';
import ComparePage from './pages/ComparePage';
import DetailPage from './pages/DetailPage';
import HighSchoolPathwaysPage from './pages/HighSchoolPathwaysPage';
import ProfileReviewPage from './pages/ProfileReviewPage';
import TimelinesPage from './pages/TimelinesPage';

const Header: React.FC = () => {
  const linkClass = "text-white hover:bg-brand-secondary px-3 py-2 rounded-md text-sm font-medium transition-colors";
  const activeLinkClass = "bg-brand-secondary text-white px-3 py-2 rounded-md text-sm font-medium";

  return (
    <header className="bg-brand-primary shadow-lg sticky top-0 z-50">
      <nav className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <NavLink to="/" className="text-white font-bold text-xl flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
              <span>SeeThroughAdmissions</span>
            </NavLink>
          </div>
          <div className="hidden md:block">
            <div className="ml-10 flex items-baseline space-x-4">
              <NavLink to="/" className={({ isActive }) => isActive ? activeLinkClass : linkClass}>Home</NavLink>
              <NavLink to="/explore" className={({ isActive }) => isActive ? activeLinkClass : linkClass}>Explore</NavLink>
              <NavLink to="/compare" className={({ isActive }) => isActive ? activeLinkClass : linkClass}>Compare</NavLink>
              <NavLink to="/pathways" className={({ isActive }) => isActive ? activeLinkClass : linkClass}>Pathways</NavLink>
              <NavLink to="/timelines" className={({ isActive }) => isActive ? activeLinkClass : linkClass}>Timelines</NavLink>
              <NavLink to="/review" className={({ isActive }) => isActive ? activeLinkClass : linkClass}>Profile Review</NavLink>
            </div>
          </div>
        </div>
      </nav>
    </header>
  );
};

const Footer: React.FC = () => (
  <footer className="bg-brand-dark text-white mt-12">
    <div className="container mx-auto py-6 px-4 sm:px-6 lg:px-8 text-center">
      <p>&copy; {new Date().getFullYear()} SeeThroughAdmissions. All rights reserved.</p>
      <p className="text-sm text-gray-400 mt-1">Helping international students find their path to US universities.</p>
    </div>
  </footer>
);

const App: React.FC = () => {
  return (
    <HashRouter>
      <div className="flex flex-col min-h-screen font-sans text-gray-800">
        <Header />
        <main className="flex-grow container mx-auto p-4 sm:p-6 lg:p-8">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/explore" element={<ExplorePage />} />
            <Route path="/compare" element={<ComparePage />} />
            <Route path="/institution/:unitid" element={<DetailPage />} />
            <Route path="/pathways" element={<HighSchoolPathwaysPage />} />
            <Route path="/timelines" element={<TimelinesPage />} />
            <Route path="/review" element={<ProfileReviewPage />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </HashRouter>
  );
};

export default App;