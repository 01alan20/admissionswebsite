import React, { useState } from 'react';
import { HashRouter, Route, Routes, NavLink, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackPageView } from './utils/analytics';
import HomePage from './pages/HomePage';
import DetailPage from './pages/DetailPage';
import ProfileRoutePage from './pages/ProfileRoutePage';
import ProfileLoginPage from './pages/ProfileLoginPage';
import ProfileDashboardPage from './pages/ProfileDashboardPage';
import MyCollegeListPage from './pages/MyCollegeListPage';
import ProfileCollegesPage from './pages/ProfileCollegesPage';
import ApplicationsPage from './pages/ApplicationsPage';
import EssaysPage from './pages/EssaysPage';
import ProfilePathwaysPage from './pages/ProfilePathwaysPage';
import ProfileTimelinesPage from './pages/ProfileTimelinesPage';
import ErrorBoundary from './components/ErrorBoundary';
import { OnboardingProvider, useOnboardingContext } from './context/OnboardingContext';

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

  const linkClass =
    "text-slate-700 hover:bg-slate-100 px-3 py-2 rounded-lg text-sm font-semibold transition-colors";
  const activeLinkClass =
    "bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-semibold shadow-sm";

  const navLinks = [{ label: 'Home', to: '/' }];

  const profileLink = !loading && user
    ? { label: 'Dashboard', to: '/profile/dashboard' }
    : null;

  const mobileLinks = !loading && !user
    ? [...navLinks, { label: 'Log In', to: '/profile/login' }]
    : [...navLinks, ...(profileLink ? [profileLink] : [])];

  const closeMobile = () => setMobileOpen(false);

  return (
    <header className="bg-white/90 backdrop-blur border-b border-slate-200 sticky top-0 z-50">
      <nav className="w-full px-4 sm:px-6 lg:px-10">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <NavLink to="/" className="text-slate-900 font-extrabold text-lg flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
              <span>SeeThroughAdmissions</span>
            </NavLink>
          </div>
          <div className="flex items-center md:hidden">
            <button
              type="button"
              aria-label="Toggle navigation"
              onClick={() => setMobileOpen((o) => !o)}
              className="inline-flex items-center justify-center rounded-lg p-2 text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600/30"
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
                  Log In
                </NavLink>
              )}
              {(!loading && user) && (
                <NavLink
                  to="/profile/dashboard"
                  className={({ isActive }) => isActive ? activeLinkClass : linkClass}
                >
                  Dashboard
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
              {mobileLinks.map(({ label, to, extra }) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={closeMobile}
                  className={({ isActive }) =>
                    `block px-3 py-2 rounded-lg text-base font-semibold ${
                      isActive ? 'bg-blue-600 text-white' : 'text-slate-700 hover:bg-slate-100'
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
  <footer className="bg-slate-50 border-t border-slate-200 mt-12">
    <div className="w-full py-8 px-4 sm:px-6 lg:px-10 text-center">
      <p className="text-sm font-semibold text-slate-800">
        &copy; {new Date().getFullYear()} SeeThroughAdmissions.
      </p>
      <p className="text-sm text-slate-500 mt-1">
        Build a profile, explore colleges, and learn from successful examples.
      </p>
    </div>
  </footer>
);

const AppRoutes: React.FC = () => {
  const location = useLocation();

  useEffect(() => {
    const path = `${location.pathname}${location.search}${location.hash}`;
    trackPageView(path);
  }, [location]);

  const mainClassName = "flex-grow bg-slate-50";

  return (
    <main className={mainClassName}>
      <ErrorBoundary key={location.key}>
        <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/institution/:unitid" element={<DetailPage />} />
        <Route path="/profile" element={<ProfileRoutePage />} />
        <Route path="/profile/route" element={<ProfileRoutePage />} />
        <Route path="/profile/login" element={<ProfileLoginPage />} />
        <Route path="/profile/college-list" element={<MyCollegeListPage />} />
        <Route path="/profile/colleges" element={<ProfileCollegesPage />} />
        <Route path="/profile/applications" element={<ApplicationsPage />} />
        <Route path="/profile/essays" element={<EssaysPage />} />
        <Route path="/profile/pathways" element={<ProfilePathwaysPage />} />
        <Route path="/profile/timelines" element={<ProfileTimelinesPage />} />
        <Route path="/profile/dashboard" element={<ProfileDashboardPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ErrorBoundary>
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
