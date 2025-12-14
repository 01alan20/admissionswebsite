import React, { useState } from 'react';
import { HashRouter, Route, Routes, NavLink } from 'react-router-dom';
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackPageView } from './utils/analytics';
import HomePage from './pages/HomePage';
import ExplorePage from './pages/ExplorePage';
import ComparePage from './pages/ComparePage';
import DetailPage from './pages/DetailPage';
import HighSchoolPathwaysPage from './pages/HighSchoolPathwaysPage';
import ProfileReviewPage from './pages/ProfileReviewPage';
import TimelinesPage from './pages/TimelinesPage';
import ProfileRoutePage from './pages/ProfileRoutePage';
import ProfileLoginPage from './pages/ProfileLoginPage';
import ProfileNameStepPage from './pages/ProfileNameStepPage';
import ProfileLocationStepPage from './pages/ProfileLocationStepPage';
import ProfileGpaStepPage from './pages/ProfileGpaStepPage';
import ProfileTestsStepPage from './pages/ProfileTestsStepPage';
import ProfileActivitiesStepPage from './pages/ProfileActivitiesStepPage';
import ProfileRecommendationsStepPage from './pages/ProfileRecommendationsStepPage';
import ProfileTargetsStepPage from './pages/ProfileTargetsStepPage';
import ProfileDashboardPage from './pages/ProfileDashboardPage';
import MyCollegeListPage from './pages/MyCollegeListPage';
import ProfileCollegesPage from './pages/ProfileCollegesPage';
import ApplicationsPage from './pages/ApplicationsPage';
import EssaysPage from './pages/EssaysPage';
import { OnboardingProvider, useOnboardingContext } from './context/OnboardingContext';
import ContactHelpPage from './pages/ContactHelpPage';
import FaqPage from './pages/FaqPage';
import ProfileMajorsStepPage from './pages/ProfileMajorsStepPage';

const Header: React.FC = () => {
  const { user, loading } = useOnboardingContext();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  // For the new CollegeBase-style experience, hide the
  // marketing header on profile/dashboard routes so the
  // sidebar layout can take over the full canvas.
  if (location.pathname.startsWith("/profile")) {
    return null;
  }

  const linkClass = "text-white hover:bg-brand-secondary px-3 py-2 rounded-md text-sm font-medium transition-colors";
  const activeLinkClass = "bg-brand-secondary text-white px-3 py-2 rounded-md text-sm font-medium";

  const navLinks = [
    { label: 'Home', to: '/' },
    { label: 'Explore', to: '/explore' },
    { label: 'Compare', to: '/compare' },
    { label: 'Pathways', to: '/pathways' },
    { label: 'Timelines', to: '/timelines' },
    { label: 'FAQ', to: '/faq' },
    { label: 'Need Personalized Help?', to: '/contact', extra: 'border border-white/70' },
  ];

  const profileLink = !loading && user
    ? { label: 'Profile Review', to: '/profile/dashboard' }
    : { label: 'Make Your Profile', to: '/profile/login' };

  const closeMobile = () => setMobileOpen(false);

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
          <div className="flex items-center md:hidden">
            <button
              type="button"
              aria-label="Toggle navigation"
              onClick={() => setMobileOpen((o) => !o)}
              className="inline-flex items-center justify-center rounded-md p-2 text-white hover:bg-brand-secondary focus:outline-none focus:ring-2 focus:ring-white"
            >
              <svg
                className="h-6 w-6"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                {mobileOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
          <div className="hidden md:block">
            <div className="ml-10 flex items-baseline space-x-4">
              {navLinks.map(({ label, to, extra }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    isActive
                      ? activeLinkClass
                      : `${linkClass} ${extra ?? ''}`
                  }
                >
                  {label}
                </NavLink>
              ))}
              {(!loading && !user) && (
                <NavLink
                  to="/profile/login"
                  className={({ isActive }) => isActive ? activeLinkClass : linkClass}
                >
                  Make Your Profile
                </NavLink>
              )}
              {(!loading && user) && (
                <NavLink
                  to="/profile/dashboard"
                  className={({ isActive }) => isActive ? activeLinkClass : linkClass}
                >
                  Profile Review
                </NavLink>
              )}
            </div>
          </div>
        </div>
      </nav>
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={closeMobile}></div>
          <div className="absolute inset-y-0 right-0 w-full max-w-xs bg-white shadow-2xl p-6 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <span className="font-semibold text-brand-dark">Menu</span>
              <button
                type="button"
                aria-label="Close navigation"
                onClick={closeMobile}
                className="p-2 rounded-md text-brand-dark hover:bg-brand-light"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {[...navLinks, profileLink].map(({ label, to, extra }) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={closeMobile}
                  className={({ isActive }) =>
                    `block px-3 py-2 rounded-md text-base font-medium ${
                      isActive ? 'bg-brand-secondary text-white' : 'text-brand-dark hover:bg-brand-light'
                    } ${extra ?? ''}`
                  }
                >
                  {label}
                </NavLink>
              ))}
            </div>
          </div>
        </div>
      )}
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

const AppRoutes: React.FC = () => {
  const location = useLocation();

  useEffect(() => {
    const path = `${location.pathname}${location.search}${location.hash}`;
    trackPageView(path);
  }, [location]);

  const isProfileRoute = location.pathname.startsWith("/profile");
  const mainClassName = isProfileRoute
    ? "flex-grow bg-slate-50"
    : "flex-grow container mx-auto px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8";

  return (
    <main className={mainClassName}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/explore" element={<ExplorePage />} />
        <Route path="/compare" element={<ComparePage />} />
        <Route path="/institution/:unitid" element={<DetailPage />} />
        <Route path="/pathways" element={<HighSchoolPathwaysPage />} />
        <Route path="/timelines" element={<TimelinesPage />} />
        <Route path="/faq" element={<FaqPage />} />
        <Route path="/review" element={<ProfileReviewPage />} />
        <Route path="/profile" element={<ProfileRoutePage />} />
        <Route path="/profile/route" element={<ProfileRoutePage />} />
        <Route path="/contact" element={<ContactHelpPage />} />
        <Route path="/profile/login" element={<ProfileLoginPage />} />
        <Route path="/profile/name" element={<ProfileNameStepPage />} />
        <Route path="/profile/location" element={<ProfileLocationStepPage />} />
        <Route path="/profile/gpa" element={<ProfileGpaStepPage />} />
        <Route path="/profile/tests" element={<ProfileTestsStepPage />} />
        <Route path="/profile/activities" element={<ProfileActivitiesStepPage />} />
        <Route path="/profile/recs" element={<ProfileRecommendationsStepPage />} />
        <Route path="/profile/majors" element={<ProfileMajorsStepPage />} />
        <Route path="/profile/targets" element={<ProfileTargetsStepPage />} />
        <Route path="/profile/college-list" element={<MyCollegeListPage />} />
        <Route path="/profile/colleges" element={<ProfileCollegesPage />} />
        <Route path="/profile/applications" element={<ApplicationsPage />} />
        <Route path="/profile/essays" element={<EssaysPage />} />
        <Route path="/profile/dashboard" element={<ProfileDashboardPage />} />
      </Routes>
    </main>
  );
};

const App: React.FC = () => {
  return (
    <HashRouter>
      <OnboardingProvider>
        <div className="flex flex-col min-h-screen font-sans text-gray-800">
          <Header />
          <AppRoutes />
          <Footer />
        </div>
      </OnboardingProvider>
    </HashRouter>
  );
};

export default App;
