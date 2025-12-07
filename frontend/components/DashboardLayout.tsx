import React from "react";
import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { User, ListChecks, Search } from "lucide-react";
import { useOnboardingContext } from "../context/OnboardingContext";

type DashboardLayoutProps = {
  children: ReactNode;
};

const navItems = [
  { label: "My Profile", to: "/profile/dashboard", icon: User },
  { label: "My College List", to: "/profile/college-list", icon: ListChecks },
  { label: "College Search", to: "/explore", icon: Search },
];

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const { user } = useOnboardingContext();

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="hidden md:flex md:flex-col md:w-64 bg-white border-r border-slate-200">
        <div className="px-6 py-4 border-b border-slate-200">
          <div className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
            SeeThrough Admissions
          </div>
          <div className="mt-1 text-sm font-semibold text-slate-900">
            Application Tools
          </div>
        </div>
        <nav className="flex-1 px-2 py-4 space-y-1">
          {navItems.map(({ label, to, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                [
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  isActive
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-700 hover:bg-slate-100",
                ].join(" ")
              }
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="px-6 py-4 border-t border-slate-200 text-xs text-slate-600">
          {user?.email ? (
            <>
              <div className="font-semibold text-slate-800 truncate">
                {user.email}
              </div>
              <p className="mt-1">
                Your saved profile powers better college suggestions.
              </p>
            </>
          ) : (
            <p>Create a profile to unlock personalized tools.</p>
          )}
        </div>
      </aside>
      <main className="flex-1 bg-slate-50">
        <div className="max-w-6xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;
