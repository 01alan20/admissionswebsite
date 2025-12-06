import React from "react";
import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { useOnboardingContext } from "../context/OnboardingContext";

type DashboardLayoutProps = {
  children: ReactNode;
};

const navItems = [
  { label: "Dashboard", to: "/profile/dashboard" },
  { label: "My Profile", to: "/profile/route" },
  { label: "My College List", to: "/profile/targets" },
  { label: "Search Colleges", to: "/explore" },
];

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const { user } = useOnboardingContext();

  return (
    <div className="min-h-[60vh] bg-slate-50 rounded-xl md:rounded-2xl shadow-sm flex flex-col md:flex-row overflow-hidden">
      <aside className="md:w-64 md:border-r border-slate-200 bg-white flex-shrink-0">
        <div className="px-5 py-4 border-b border-slate-200">
          <div className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
            SeeThrough Admissions
          </div>
          <div className="mt-1 text-sm font-semibold text-slate-900">
            Application Tools
          </div>
        </div>
        <nav className="px-2 py-3 flex flex-row md:flex-col gap-2 md:gap-1 overflow-x-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                [
                  "flex items-center px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors",
                  isActive
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-700 hover:bg-slate-100",
                ].join(" ")
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="hidden md:block border-t border-slate-200 px-5 py-4 text-xs text-slate-600">
          {user?.email ? (
            <>
              <div className="font-semibold text-slate-800 truncate">
                {user.email}
              </div>
              <p className="mt-1">
                Your saved profile powers college suggestions.
              </p>
            </>
          ) : (
            <p>Create a profile to unlock recommendations.</p>
          )}
        </div>
      </aside>
      <main className="flex-1 bg-slate-50">
        <div className="px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
          {children}
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;

