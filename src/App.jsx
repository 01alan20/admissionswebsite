import { BrowserRouter, Routes, Route, NavLink, Link } from "react-router-dom";
import { Suspense, lazy } from "react";
import Home from "./pages/Home.jsx";
import Explore from "./pages/Explore.jsx";
import Compare from "./pages/Compare.jsx";
import HighSchoolPathways from "./pages/HighSchoolPathways.jsx";
import AdmissionsTimeline from "./pages/AdmissionsTimeline.jsx";
import Login from "./pages/Login.jsx";
import Onboarding from "./pages/Onboarding.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import { AuthProvider } from "./contexts/AuthContext.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import "./styles/modern.css";

const Detail = lazy(() => import("./pages/Detail.jsx"));
const ProfileReview = lazy(() => import("./pages/ProfileReview.jsx"));

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
      <header className="site-header">
        <div className="container navbar">
          <div className="brand">
            <span className="dot" />
            <span>See Through Uni Admissions</span>
          </div>

          <nav className="navlinks">
            <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : "")}>
              Home
            </NavLink>
            <NavLink to="/explore" className={({ isActive }) => (isActive ? "active" : "")}>
              Explore
            </NavLink>
            <NavLink to="/compare" className={({ isActive }) => (isActive ? "active" : "")}>
              Compare
            </NavLink>
            <NavLink to="/timeline" className={({ isActive }) => (isActive ? "active" : "")}>
              Timeline
            </NavLink>
            <NavLink to="/pathways" className={({ isActive }) => (isActive ? "active" : "")}>
              High School Pathways
            </NavLink>
            <NavLink to="/review" className={({ isActive }) => (isActive ? "active" : "")}>
              Profile Review
            </NavLink>
          </nav>

          <div className="nav-spacer" />
        </div>
      </header>

      <main className="container main-pad">
        <ErrorBoundary>
          <Suspense fallback={<div style={{ padding: 24 }}>Loading page...</div>}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/onboarding" element={<Onboarding />} />
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />

              <Route path="/explore" element={<ProtectedRoute><Explore /></ProtectedRoute>} />
              <Route path="/compare" element={<ProtectedRoute><Compare /></ProtectedRoute>} />
              <Route path="/timeline" element={<ProtectedRoute><AdmissionsTimeline /></ProtectedRoute>} />
              <Route path="/pathways" element={<ProtectedRoute><HighSchoolPathways /></ProtectedRoute>} />
              <Route path="/institution/:unitid" element={<ProtectedRoute><Detail /></ProtectedRoute>} />
              <Route path="/review" element={<ProtectedRoute><ProfileReview /></ProtectedRoute>} />
              <Route path="*" element={<div>Not found</div>} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </main>

      <footer className="container footer">
        <span>(c) {new Date().getFullYear()} Uni Admissions</span>
        <span style={{ float: "right" }}>
          Need a personalized assessment?{" "}
          <Link to="/review" style={{ color: "inherit", textDecoration: "underline" }}>
            Start a profile review
          </Link>
        </span>
      </footer>
      </AuthProvider>
    </BrowserRouter>
  );
}
