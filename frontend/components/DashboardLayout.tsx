import React from "react";
import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { User, ListChecks, Search, NotebookPen, FileText, Map, CalendarDays, FlaskConical } from "lucide-react";
import { useOnboardingContext } from "../context/OnboardingContext";
import { isBetaUser } from "../utils/betaAccess";

type DashboardLayoutProps = {
  children: ReactNode;
};

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const { user } = useOnboardingContext();
  const betaEnabled = isBetaUser(user?.email);

  const navSections = [
    {
      label: "My Progress",
      items: [
        { label: "My Profile", to: "/profile/dashboard", icon: User },
        { label: "My College List", to: "/profile/college-list", icon: ListChecks },
      ],
    },
    {
      label: "Essentials",
      items: [
        { label: "Colleges", to: "/profile/colleges", icon: Search },
        { label: "Applications", to: "/profile/applications", icon: NotebookPen },
        { label: "Essays", to: "/profile/essays", icon: FileText },
      ],
    },
    ...(betaEnabled
      ? [
          {
            label: "Beta",
            items: [{ label: "Essay Lab", to: "/profile/beta", icon: FlaskConical }],
          },
        ]
      : []),
    {
      label: "Planning",
      items: [
        { label: "Pathways", to: "/profile/pathways", icon: Map },
        { label: "Timelines", to: "/profile/timelines", icon: CalendarDays },
      ],
    },
  ];

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
        <nav className="flex-1 px-2 py-4 space-y-4">
          {navSections.map((section) => (
            <div key={section.label}>
              <p className="px-3 text-[11px] uppercase tracking-wide text-slate-400 font-semibold mb-2">
                {section.label}
              </p>
              <div className="space-y-1">
                {section.items.map(({ label, to, icon: Icon }) => (
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
              </div>
            </div>
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
        <div className="px-4 py-6 sm:px-6 lg:px-8">{children}</div>
      </main>
    </div>
  );
};

export default DashboardLayout;
