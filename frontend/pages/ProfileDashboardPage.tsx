import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../components/DashboardLayout";
import { useOnboardingGuard } from "../hooks/useOnboardingGuard";
import { useOnboardingContext } from "../context/OnboardingContext";
import {
  getInstitutionIndex,
  getInstitutionsSummariesByIds,
  getMajorsMeta,
  type InstitutionIndex,
} from "../data/api";
import { COUNTRY_OPTIONS } from "../constants";
import type { Activity, MajorsMeta } from "../types";
import { supabase } from "../services/supabaseClient";
import { US_STATES, isUSCountry, normalizeUSStateToCode } from "../utils/usStates";
import {
  buildMajorAreaOptions,
  buildSpecificMajorOptions,
  extractMajorCode,
  extractMajorLabel,
  formatMajorSelection,
  normalizeMajorSelectionList,
} from "../utils/majors";
import type { AdmissionCategory } from "../types/supabase";

type DemographicsState = {
  gender: string;
  race: string;
  country: string;
  locationState: string;
  city: string;
  gradYear: string;
  majorCodes: string[];
};

type AcademicsState = {
  gpaBand: string;
  gpaValue: number | null;
  sat: number | null;
  act: number | null;
  customGpa: number | null;
  apCourses: string;
  ibCourses: string;
  ibScore: string;
};

type ActivityState = {
  id: string;
  name: string;
  role: string;
};

type CollegeRow = {
  id: string;
  unitid?: number;
  name: string;
  city: string | null;
  state: string | null;
  category: AdmissionCategory | null;
};

type MajorOption = {
  code: string;
  name: string;
  label: string;
};

type ModalProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
};

const Modal: React.FC<ModalProps> = ({
  open,
  title,
  onClose,
  children,
  footer,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div className="relative z-50 w-full max-w-xl rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-900">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <span className="text-lg">&times;</span>
          </button>
        </div>
        <div className="px-4 py-4 max-h-[70vh] overflow-y-auto">
          {children}
        </div>
        {footer && (
          <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

const gpaBands = [
  { id: "a_plus_a", label: "A+, A", range: "4.0", value: 4.0 },
  { id: "a_a_minus", label: "A, A-", range: "4.0–3.8", value: 3.9 },
  { id: "a_minus_b_plus", label: "A-, B+", range: "3.8–3.5", value: 3.65 },
  { id: "b_plus_b", label: "B+, B", range: "3.5–3.3", value: 3.4 },
  { id: "b_b_minus", label: "B, B-", range: "3.3–3.0", value: 3.15 },
  { id: "b_minus_c_plus", label: "B-, C+", range: "3.0–2.7", value: 2.85 },
  { id: "c_plus_c", label: "C+, C", range: "2.7–2.3", value: 2.5 },
  { id: "c_c_minus", label: "C, C-", range: "2.3–2.0", value: 2.15 },
  { id: "c_minus_d", label: "C-, D", range: "2.0–1.6", value: 1.8 },
  { id: "d_d_minus", label: "D, D-", range: "1.6–1.0", value: 1.3 },
];

const newId = () =>
  `id_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;

const ProfileDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const loadingGuard = useOnboardingGuard(9);
  const {
    user,
    studentProfile,
    targetUnitIds,
    setTargetUnitIds,
    setStudentProfile,
    logout,
  } = useOnboardingContext();

  const initialMajorSelections =
    normalizeMajorSelectionList(studentProfile.majors) ?? [];
  const initialMajorCodes = initialMajorSelections
    .map((entry) => extractMajorCode(entry) ?? extractMajorLabel(entry))
    .filter((val): val is string => Boolean(val))
    .slice(0, 3);

  const [majorOptions, setMajorOptions] = useState<MajorOption[]>([]);
  const [majorSearch, setMajorSearch] = useState("");

  const [demographics, setDemographics] = useState<DemographicsState>(
    () => ({
      gender: "",
      race: "",
      country: studentProfile.country || "",
      locationState: "",
      city: studentProfile.city || "",
      gradYear: "",
      majorCodes: initialMajorCodes.length ? initialMajorCodes : [],
    })
  );

  const [academics, setAcademics] = useState<AcademicsState>(() => {
    const gpa =
      typeof studentProfile.gpa === "number"
        ? studentProfile.gpa
        : studentProfile.gpa != null
        ? Number(studentProfile.gpa)
        : null;
    const satTotal =
      studentProfile.satMath != null &&
      studentProfile.satEBRW != null
        ? Number(studentProfile.satMath) +
          Number(studentProfile.satEBRW)
        : null;
    const act =
      typeof studentProfile.actComposite === "number"
        ? studentProfile.actComposite
        : studentProfile.actComposite != null
        ? Number(studentProfile.actComposite)
        : null;
    return {
      gpaBand: "",
      gpaValue: gpa,
      sat: satTotal,
      act,
      customGpa: null,
      apCourses: "",
      ibCourses: "",
      ibScore: "",
    };
  });

  const [activities, setActivities] = useState<ActivityState[]>(() => {
    const base: Activity[] = studentProfile.activities || [];
    if (!base.length) {
      return Array.from({ length: 3 }).map(() => ({
        id: newId(),
        name: "",
        role: "",
      }));
    }
    return base.map((a) => ({
      id: a.id ?? newId(),
      name: a.name ?? "",
      role: a.role ?? "",
    }));
  });

  const [colleges, setColleges] = useState<CollegeRow[]>([]);
  const [academicSnapshot, setAcademicSnapshot] = useState<Record<string, any> | null>(null);
  const [gpaMode, setGpaMode] = useState<"band" | "custom">(
    typeof studentProfile.gpa === "number" ? "custom" : "band"
  );
  const [savingDemo, setSavingDemo] = useState(false);
  const [savingAcad, setSavingAcad] = useState(false);

  const [showDemoModal, setShowDemoModal] = useState(false);
  const [showAcadModal, setShowAcadModal] = useState(false);
  const [showActModal, setShowActModal] = useState(false);
  const [showAddSchoolModal, setShowAddSchoolModal] = useState(false);

  const [institutionIndex, setInstitutionIndex] = useState<
    InstitutionIndex[]
  >([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchState, setSearchState] = useState("");

  const [customSchoolName, setCustomSchoolName] = useState("");
  const [customSchoolCity, setCustomSchoolCity] = useState("");
  const [customSchoolState, setCustomSchoolState] = useState("");

  const syncTargetUnitIds = useCallback(
    (nextColleges: CollegeRow[]) => {
      const ids = Array.from(
        new Set(
          nextColleges
            .map((c) => c.unitid)
            .filter((v): v is number => typeof v === "number")
        )
      );
      setTargetUnitIds(ids);
    },
    [setTargetUnitIds]
  );

  useEffect(() => {
    (async () => {
      try {
        const meta: MajorsMeta = await getMajorsMeta();
        const combined = [
          ...buildSpecificMajorOptions(meta),
          ...buildMajorAreaOptions(meta),
        ];
        const seen = new Set<string>();
        const options: MajorOption[] = [];
        for (const entry of combined) {
          if (!entry.code || !entry.label) continue;
          if (seen.has(entry.code)) continue;
          seen.add(entry.code);
          options.push({
            code: entry.code,
            name: entry.label,
            label: entry.label,
          });
        }
        options.sort((a, b) => a.name.localeCompare(b.name));
        setMajorOptions(options);
      } catch {
        setMajorOptions([]);
      }
    })();
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("demographics, academic_stats")
          .eq("user_id", user.id)
          .maybeSingle();
        if (cancelled || error || !data) return;
        const demo = (data.demographics || {}) as Record<string, any>;
        setDemographics((prev) => ({
          ...prev,
          gender: demo.gender ?? prev.gender,
          race: demo.race ?? prev.race,
          country: demo.country ?? prev.country,
          city: demo.city ?? prev.city,
          locationState: (() => {
            const countryValue = demo.country ?? prev.country;
            if (!isUSCountry(countryValue)) return "";
            const normalized = normalizeUSStateToCode(demo.location_state);
            return normalized ?? prev.locationState;
          })(),
          gradYear:
            demo.grad_year != null ? String(demo.grad_year) : prev.gradYear,
        }));
        const stats = (data.academic_stats || {}) as Record<string, any>;
        setAcademicSnapshot(stats);
        setAcademics((prev) => ({
          ...prev,
          gpaValue:
            typeof stats.gpa === "number" ? stats.gpa : prev.gpaValue,
          customGpa:
            typeof stats.gpa === "number" ? stats.gpa : prev.customGpa,
          sat:
            typeof stats.sat_total === "number"
              ? stats.sat_total
              : prev.sat,
          act:
            typeof stats.act_composite === "number"
              ? stats.act_composite
              : prev.act,
          apCourses:
            typeof stats.ap_courses === "string"
              ? stats.ap_courses
              : prev.apCourses,
          ibCourses:
            typeof stats.ib_courses === "string"
              ? stats.ib_courses
              : prev.ibCourses,
          ibScore:
            typeof stats.ib_score === "string"
              ? stats.ib_score
              : prev.ibScore,
        }));
        if (typeof stats.gpa === "number") {
          setGpaMode("custom");
        }
      } catch {
        // ignore best-effort load
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!showDemoModal) return;
    setMajorSearch("");
  }, [showDemoModal]);

  useEffect(() => {
    (async () => {
      try {
        const idx = await getInstitutionIndex();
        setInstitutionIndex(idx);
      } catch {
        setInstitutionIndex([]);
      }
    })();
  }, []);

  useEffect(() => {
    const ids = targetUnitIds || [];
    if (!ids.length) return;
    let cancelled = false;
    (async () => {
      try {
        const uniqueIds = Array.from(new Set(ids)).slice(0, 25);
        const summaries = await getInstitutionsSummariesByIds(
          uniqueIds
        );
        if (cancelled) return;
        const rows: CollegeRow[] = summaries.map((inst) => ({
          id: String(inst.unitid),
          unitid: inst.unitid,
          name: inst.name,
          city: inst.city ?? null,
          state: inst.state ?? null,
          category: null,
        }));
        setColleges(rows);
      } catch {
        // best-effort only
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetUnitIds]);

  const existingUnitIds = useMemo(
    () =>
      new Set(
        colleges
          .map((c) => c.unitid)
          .filter((v): v is number => typeof v === "number")
      ),
    [colleges]
  );

  const stateOptions = useMemo(() => {
    const states = new Set<string>();
    for (const row of institutionIndex) {
      if (row.state) states.add(row.state);
    }
    return Array.from(states).sort((a, b) => a.localeCompare(b));
  }, [institutionIndex]);

  const filteredIndex = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return institutionIndex
      .filter((row) => !existingUnitIds.has(row.unitid))
      .filter((row) =>
        searchState
          ? (row.state ?? "")
              .toUpperCase()
              .startsWith(searchState.toUpperCase())
          : true
      )
      .filter((row) => {
        if (!q) return true;
        const haystack = `${row.name ?? ""} ${row.city ?? ""} ${
          row.state ?? ""
        }`.toLowerCase();
        return haystack.includes(q);
      })
      .slice(0, 25);
  }, [institutionIndex, existingUnitIds, searchQuery, searchState]);

  const gpaDisplay =
    gpaMode === "custom"
      ? academics.customGpa ?? studentProfile.gpa ?? null
      : academics.gpaValue != null
      ? academics.gpaValue
      : typeof studentProfile.gpa === "number"
      ? studentProfile.gpa
      : studentProfile.gpa != null
      ? Number(studentProfile.gpa)
      : null;
  const satDisplay =
    academics.sat != null
      ? academics.sat
      : studentProfile.satMath != null &&
        studentProfile.satEBRW != null
      ? Number(studentProfile.satMath) +
        Number(studentProfile.satEBRW)
      : null;
  const actDisplay =
    academics.act != null
      ? academics.act
      : studentProfile.actComposite ?? null;

  const confirmedActivities = useMemo(
    () =>
      activities
        .map((a) => ({
          ...a,
          name: a.name.trim(),
          role: a.role.trim(),
        }))
        .filter((a) => a.name),
    [activities]
  );

  const majorDisplay = useMemo(() => {
    const codes = demographics.majorCodes;
    if (codes.length && majorOptions.length) {
      const names = codes.map((codeOrName) => {
        const byCode = majorOptions.find((opt) => opt.code === codeOrName);
        if (byCode) return byCode.name;
        const lower = String(codeOrName).toLowerCase();
        const byName = majorOptions.find(
          (opt) => opt.name.toLowerCase() === lower
        );
        return byName ? byName.name : codeOrName;
      });
      return names.join(", ");
    }
    if (studentProfile.majors && studentProfile.majors.length) {
      return studentProfile.majors
        .slice(0, 3)
        .map((value) => extractMajorLabel(value) || value)
        .join(", ");
    }
    return "Undeclared";
  }, [demographics.majorCodes, majorOptions, studentProfile.majors]);

  const hasDemographics =
    Boolean(
      demographics.gender ||
        demographics.race ||
        demographics.country ||
        demographics.city ||
        demographics.locationState ||
        demographics.gradYear ||
        demographics.majorCodes.length
    ) ||
    Boolean(studentProfile.country || studentProfile.city);

  const hasAcademics =
    gpaDisplay != null || satDisplay != null || actDisplay != null;

  const hasActivitiesConfirmed = confirmedActivities.length >= 3;

  const completionCount =
    (hasDemographics ? 1 : 0) +
    (hasAcademics ? 1 : 0) +
    (hasActivitiesConfirmed ? 1 : 0);
  const completionPercent = (completionCount / 3) * 100;

  const firstName = studentProfile.firstName || "there";

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const handleAddFromIndex = (item: InstitutionIndex) => {
    setColleges((prev) => {
      if (prev.some((c) => c.unitid === item.unitid)) return prev;
      const next: CollegeRow[] = [
        ...prev,
        {
          id: String(item.unitid),
          unitid: item.unitid,
          name: item.name,
          city: item.city ?? null,
          state: item.state ?? null,
          category: null,
        },
      ];
      void syncTargetUnitIds(next);
      return next;
    });
  };

  const handleAddCustomSchool = (e: React.FormEvent) => {
    e.preventDefault();
    const name = customSchoolName.trim();
    if (!name) return;
    setColleges((prev) => {
      const next: CollegeRow[] = [
        ...prev,
        {
          id: newId(),
          name,
          city: customSchoolCity.trim() || null,
          state: customSchoolState.trim() || null,
          category: null,
        },
      ];
      void syncTargetUnitIds(next);
      return next;
    });
    setCustomSchoolName("");
    setCustomSchoolCity("");
    setCustomSchoolState("");
    setShowAddSchoolModal(false);
  };

  const handleRemoveCollege = (id: string) => {
    setColleges((prev) => {
      const next = prev.filter((c) => c.id !== id);
      void syncTargetUnitIds(next);
      return next;
    });
  };

  const renderCategoryBadge = (value: AdmissionCategory | null) => {
    if (!value) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-slate-50 text-slate-600 border border-slate-200 text-[11px]">
          Unknown
        </span>
      );
    }
    let classes =
      "inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium border ";
    if (value === "Reach") {
      classes += "bg-red-50 text-red-700 border-red-200";
    } else if (value === "Target") {
      classes += "bg-amber-50 text-amber-700 border-amber-200";
    } else {
      classes += "bg-emerald-50 text-emerald-700 border-emerald-200";
    }
    return <span className={classes}>{value}</span>;
  };

  const hasColleges = colleges.length > 0;
  const isUS = isUSCountry(demographics.country);

  const updateProfileData = useCallback(
    async (updates: {
      demographics?: Record<string, any>;
      academic?: Record<string, any>;
    }) => {
      if (!user) return;
      const payload: Record<string, any> = {};
      if (updates.demographics) {
        payload.demographics = updates.demographics;
      }
      if (updates.academic) {
        const merged = { ...(academicSnapshot || {}), ...updates.academic };
        payload.academic_stats = merged;
        setAcademicSnapshot(merged);
      }
      if (!Object.keys(payload).length) return;
      await supabase.from("profiles").upsert(
        {
          user_id: user.id,
          ...payload,
        },
        { onConflict: "user_id" }
      );
    },
    [user?.id, academicSnapshot]
  );

  if (loadingGuard) {
    return (
      <DashboardLayout>
        <div className="max-w-5xl mx-auto py-8 text-sm text-slate-600">
          Loading your dashboard...
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto py-6 space-y-6">
        {/* Hero */}
        <section className="bg-gradient-to-r from-blue-600 via-indigo-500 to-sky-500 rounded-2xl px-6 py-5 text-white shadow-sm flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-blue-100">
              SeeThrough Admissions
            </p>
            <h1 className="mt-1 text-3xl font-bold">
              Keep pushing, {firstName}
            </h1>
            <p className="mt-1 text-sm text-blue-100 max-w-xl">
              Build your profile, track colleges, and understand your chances.
            </p>
          </div>
          <div className="flex flex-col gap-3 items-stretch md:items-end">
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center justify-center rounded-full bg-transparent px-5 py-2.5 text-sm font-semibold text-blue-50 border border-white/30 hover:bg-white/10"
            >
              Log out
            </button>
          </div>
        </section>

        {/* Main grid */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] items-start">
          {/* Left column */}
          <div className="space-y-4">
            {/* Demographics */}
            <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <header className="flex items-center justify-between px-4 py-2 bg-blue-900 text-white">
                <h2 className="text-sm font-semibold">Demographics</h2>
                <button
                  type="button"
                  onClick={() => setShowDemoModal(true)}
                  className="text-xs inline-flex items-center gap-1 rounded-full border border-white/40 px-3 py-1 hover:bg-white/10"
                >
                  Edit
                </button>
              </header>
              <dl className="divide-y divide-slate-100">
                <div className="flex items-center justify-between px-4 py-2">
                  <dt className="text-sm text-slate-600">Gender</dt>
                  <dd className="text-sm font-medium text-slate-900">
                    {demographics.gender || "Not specified"}
                  </dd>
                </div>
                <div className="flex items-center justify-between px-4 py-2">
                  <dt className="text-sm text-slate-600">
                    Race / Ethnicity
                  </dt>
                  <dd className="text-sm font-medium text-slate-900">
                    {demographics.race || "Not specified"}
                  </dd>
                </div>
                <div className="flex items-center justify-between px-4 py-2">
                  <dt className="text-sm text-slate-600">
                    Intended Major
                  </dt>
                  <dd className="text-sm font-medium text-slate-900">
                    {majorDisplay}
                  </dd>
                </div>
                <div className="flex items-center justify-between px-4 py-2">
                  <dt className="text-sm text-slate-600">
                    Graduation Year
                  </dt>
                  <dd className="text-sm font-medium text-slate-900">
                    {demographics.gradYear || "Not specified"}
                  </dd>
                </div>
                <div className="flex items-center justify-between px-4 py-2">
                  <dt className="text-sm text-slate-600">Location</dt>
                  <dd className="text-sm font-medium text-slate-900">
                    {(() => {
                      const parts: string[] = [];
                      if (demographics.city) parts.push(demographics.city);
                      if (isUS && demographics.locationState)
                        parts.push(demographics.locationState);
                      if (demographics.country) parts.push(demographics.country);
                      return parts.length
                        ? parts.join(", ")
                        : "Not specified";
                    })()}
                  </dd>
                </div>
              </dl>
            </section>

            {/* Academics */}
            <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <header className="flex items-center justify-between px-4 py-2 bg-emerald-800 text-white">
                <h2 className="text-sm font-semibold">Academics</h2>
                <button
                  type="button"
                  onClick={() => setShowAcadModal(true)}
                  className="text-xs inline-flex items-center gap-1 rounded-full border border-white/40 px-3 py-1 hover:bg-white/10"
                >
                  Edit
                </button>
              </header>
              <dl className="divide-y divide-slate-100">
                <div className="flex items-center justify-between px-4 py-2">
                  <dt className="text-sm text-slate-600">
                    Unweighted GPA
                  </dt>
                  <dd className="text-sm font-medium text-slate-900">
                    {gpaDisplay != null
                      ? gpaDisplay.toFixed(2)
                      : "N/A"}
                  </dd>
                </div>
                <div className="flex items-center justify-between px-4 py-2">
                  <dt className="text-sm text-slate-600">SAT Total</dt>
                  <dd className="text-sm font-medium text-slate-900">
                    {satDisplay != null ? satDisplay : "N/A"}
                  </dd>
                </div>
                <div className="flex items-center justify-between px-4 py-2">
                  <dt className="text-sm text-slate-600">
                    ACT Composite
                  </dt>
                  <dd className="text-sm font-medium text-slate-900">
                    {actDisplay != null ? actDisplay : "N/A"}
                  </dd>
                </div>
                <div className="flex items-center justify-between px-4 py-2">
                  <dt className="text-sm text-slate-600">
                    AP Courses
                  </dt>
                  <dd className="text-sm font-medium text-slate-900">
                    {academics.apCourses || "Not specified"}
                  </dd>
                </div>
                <div className="flex items-center justify-between px-4 py-2">
                  <dt className="text-sm text-slate-600">
                    IB Courses
                  </dt>
                  <dd className="text-sm font-medium text-slate-900">
                    {academics.ibCourses || "Not specified"}
                  </dd>
                </div>
                <div className="flex items-center justify-between px-4 py-2">
                  <dt className="text-sm text-slate-600">
                    Estimated IB Score
                  </dt>
                  <dd className="text-sm font-medium text-slate-900">
                    {academics.ibScore || "N/A"}
                  </dd>
                </div>
              </dl>
            </section>

            {/* Activities */}
            <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <header className="flex items-center justify-between px-4 py-2 bg-purple-800 text-white">
                <h2 className="text-sm font-semibold">
                  Extracurricular Activities
                </h2>
                <button
                  type="button"
                  onClick={() => setShowActModal(true)}
                  className="text-xs inline-flex items-center gap-1 rounded-full border border-white/40 px-3 py-1 hover:bg-white/10"
                >
                  Edit
                </button>
              </header>
              <div className="px-4 py-3">
                {confirmedActivities.length === 0 ? (
                  <p className="text-sm text-slate-600">
                    No extracurricular activities yet. Add at least{" "}
                    <span className="font-semibold">three</span> to
                    unlock stronger recommendations.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {confirmedActivities.slice(0, 4).map((act) => (
                      <li
                        key={act.id}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="font-medium text-slate-900">
                          {act.name}
                        </span>
                        {act.role && (
                          <span className="text-xs text-slate-600">
                            {act.role}
                          </span>
                        )}
                      </li>
                    ))}
                    {confirmedActivities.length > 4 && (
                      <li className="text-xs text-slate-500">
                        + {confirmedActivities.length - 4} more
                        activities
                      </li>
                    )}
                  </ul>
                )}
              </div>
            </section>

            {/* Target schools */}
            <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <header className="flex flex-col gap-1 px-4 py-3 border-b border-slate-200 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">
                    My Target Schools
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    A working list of schools you&apos;re actively targeting.
                  </p>
                </div>
                <div className="mt-2 flex items-center gap-2 sm:mt-0">
                  <button
                    type="button"
                    onClick={() => setShowAddSchoolModal(true)}
                    className="inline-flex items-center rounded-full bg-blue-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-blue-700"
                  >
                    + Add School to List
                  </button>
                </div>
              </header>
              {!hasColleges ? (
                <div className="px-4 py-6 text-sm text-slate-600">
                  You haven&apos;t added any colleges yet. Use “Add School to
                  List” to start your list.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-xs">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-2 text-left font-semibold text-slate-600">
                          School Name
                        </th>
                        <th className="px-4 py-2 text-center font-semibold text-slate-600">
                          Category
                        </th>
                        <th className="px-4 py-2 text-left font-semibold text-slate-600">
                          Location
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {colleges.map((row) => (
                        <tr key={row.id} className="hover:bg-slate-50">
                          <td className="px-4 py-2 whitespace-nowrap text-slate-900">
                            <div className="flex items-center justify-between gap-3">
                              <span className="truncate">{row.name}</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveCollege(row.id)}
                                className="text-[11px] text-slate-400 hover:text-red-500"
                              >
                                Remove
                              </button>
                            </div>
                          </td>
                          <td className="px-4 py-2 whitespace-nowrap text-center">
                            {renderCategoryBadge(row.category)}
                          </td>
                          <td className="px-4 py-2 whitespace-nowrap text-slate-600">
                            {[row.city, row.state]
                              .filter(Boolean)
                              .join(", ") || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>

          {/* Right column */}
          <div className="space-y-4">
            <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <h2 className="text-sm font-semibold text-slate-900">
                Welcome to SeeThrough Admissions
              </h2>
              <p className="mt-1 text-xs text-slate-600">
                Complete these three pieces to unlock the strongest
                recommendations.
              </p>
              <div className="mt-4">
                <div className="flex items-center justify-between text-xs text-slate-600 mb-1">
                  <span>Profile completion</span>
                  <span className="font-medium text-slate-900">
                    {completionCount}/3
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all"
                    style={{ width: `${completionPercent}%` }}
                  />
                </div>
              </div>
              <ul className="mt-4 space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <span
                    className={`inline-flex h-4 w-4 items-center justify-center rounded-full border ${
                      hasDemographics
                        ? "bg-emerald-500 border-emerald-500 text-white"
                        : "border-slate-300 text-slate-400"
                    }`}
                  >
                    ✓
                  </span>
                  <span>Fill in Demographics</span>
                </li>
                <li className="flex items-center gap-2">
                  <span
                    className={`inline-flex h-4 w-4 items-center justify-center rounded-full border ${
                      hasAcademics
                        ? "bg-emerald-500 border-emerald-500 text-white"
                        : "border-slate-300 text-slate-400"
                    }`}
                  >
                    ✓
                  </span>
                  <span>Fill in Academics</span>
                </li>
                <li className="flex items-center gap-2">
                  <span
                    className={`inline-flex h-4 w-4 items-center justify-center rounded-full border ${
                      hasActivitiesConfirmed
                        ? "bg-emerald-500 border-emerald-500 text-white"
                        : "border-slate-300 text-slate-400"
                    }`}
                  >
                    ✓
                  </span>
                  <span>Add at least 3 Extracurriculars</span>
                </li>
              </ul>
            </section>

            <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-3">
              <h2 className="text-sm font-semibold text-slate-900">
                We use your profile for:
              </h2>
              <div className="rounded-lg border border-slate-200 px-3 py-2 text-xs">
                <div className="font-semibold text-slate-900">
                  Applicants Like You
                </div>
                <p className="mt-0.5 text-slate-600">
                  Find students with similar stats and see where they
                  were admitted.
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 px-3 py-2 text-xs">
                <div className="font-semibold text-slate-900">
                  Essays Like Yours
                </div>
                <p className="mt-0.5 text-slate-600">
                  Learn how other applicants told their stories for
                  the same schools.
                </p>
              </div>
            </section>
          </div>
        </section>
      </div>

      {/* Demographics modal */}
      <Modal
        open={showDemoModal}
        title="Edit demographics"
        onClose={() => setShowDemoModal(false)}
        footer={
          <>
            <button
              type="button"
              onClick={() => setShowDemoModal(false)}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="demo-form"
              disabled={savingDemo}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {savingDemo ? "Saving..." : "Save"}
            </button>
          </>
        }
      >
        <form
          id="demo-form"
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const cleanedCountry = demographics.country.trim();
            const cleanedIsUS = isUSCountry(cleanedCountry);
            const normalizedState = cleanedIsUS
              ? normalizeUSStateToCode(demographics.locationState) ??
                demographics.locationState.trim().toUpperCase()
              : "";
            const cleaned: DemographicsState = {
              ...demographics,
              country: cleanedCountry,
              city: demographics.city.trim(),
              locationState: normalizedState,
              gradYear: demographics.gradYear.trim(),
            };
            if (!cleaned.majorCodes.length && majorSearch.trim()) {
              cleaned.majorCodes = [majorSearch.trim()];
            }
            setDemographics(cleaned);
            const normalizedMajors = cleaned.majorCodes
              .map((code) => {
                const opt = majorOptions.find((m) => m.code === code);
                return opt ? formatMajorSelection(opt.code, opt.label) : code;
              })
              .slice(0, 3);
            setSavingDemo(true);
            try {
              await updateProfileData({
                demographics: {
                  gender: cleaned.gender || null,
                  race: cleaned.race || null,
                  country: cleaned.country || null,
                  city: cleaned.city || null,
                  location_state: cleaned.locationState || null,
                  grad_year: cleaned.gradYear ? Number(cleaned.gradYear) : null,
                },
                academic: {
                  country: cleaned.country || null,
                  city: cleaned.city || null,
                  majors: normalizedMajors.length ? normalizedMajors : null,
                },
              });
              setStudentProfile({
                country: cleaned.country || "",
                city: cleaned.city || "",
                majors: normalizedMajors,
              });
            } catch (err) {
              console.error("Failed to save demographics", err);
            } finally {
              setSavingDemo(false);
              setShowDemoModal(false);
            }
          }}
        >
          {/* Intended major */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Intended Major
            </label>
            <input
              type="text"
              value={majorSearch}
              onChange={(e) => setMajorSearch(e.target.value)}
              placeholder="Start typing a major or code..."
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            {majorOptions.length > 0 && (
              <>
                <div className="mt-2 flex flex-wrap gap-1">
                  {demographics.majorCodes.map((code) => {
                    const opt =
                      majorOptions.find((m) => m.code === code) ?? null;
                    const label = opt ? opt.name : code;
                    return (
                      <button
                        key={code}
                        type="button"
                        onClick={() =>
                          setDemographics((prev) => ({
                            ...prev,
                            majorCodes: prev.majorCodes.filter(
                              (c) => c !== code
                            ),
                          }))
                        }
                        className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-[11px] text-blue-700 border border-blue-200"
                      >
                        <span>{label}</span>
                        <span className="text-xs">×</span>
                      </button>
                    );
                  })}
                  {demographics.majorCodes.length === 0 && (
                    <span className="text-[11px] text-slate-500">
                      Select up to three majors you&apos;re interested in.
                    </span>
                  )}
                </div>
                <div className="mt-2 max-h-40 overflow-y-auto rounded-md border border-slate-200 bg-white text-xs">
                  {majorOptions
                    .filter((opt) => {
                      const q = majorSearch.trim().toLowerCase();
                      if (!q) return true;
                      return (
                        opt.code.toLowerCase().startsWith(q) ||
                        opt.name.toLowerCase().includes(q)
                      );
                    })
                    .slice(0, 20)
                    .map((opt) => {
                      const selected = demographics.majorCodes.includes(
                        opt.code
                      );
                      const disabled =
                        !selected && demographics.majorCodes.length >= 3;
                      return (
                        <button
                          key={opt.code}
                          type="button"
                          onClick={() => {
                            setDemographics((prev) => {
                              const already = prev.majorCodes.includes(
                                opt.code
                              );
                              if (already) {
                                return {
                                  ...prev,
                                  majorCodes: prev.majorCodes.filter(
                                    (c) => c !== opt.code
                                  ),
                                };
                              }
                              if (prev.majorCodes.length >= 3) {
                                return prev;
                              }
                              return {
                                ...prev,
                                majorCodes: [...prev.majorCodes, opt.code],
                              };
                            });
                          }}
                          disabled={disabled}
                          className={`flex w-full items-center justify-between px-3 py-1.5 text-left hover:bg-slate-50 ${
                            selected ? "bg-slate-50" : ""
                          } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
                        >
                          <span className="text-slate-900">{opt.name}</span>
                        </button>
                      );
                    })}
                </div>
                {demographics.majorCodes.length >= 3 && (
                  <p className="mt-1 text-[11px] text-slate-500">
                    You&apos;ve selected three majors. Remove one to add a different option.
                  </p>
                )}
              </>
            )}
            {majorOptions.length === 0 && (
              <p className="mt-2 text-[11px] text-slate-500">
                Major list is still loading. You can still type your major name above.
              </p>
            )}
          </div>

          {/* Gender */}
          <fieldset>
            <legend className="block text-xs font-medium text-slate-700 mb-2">
              Gender
            </legend>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {["Male", "Female", "Non-binary", "Prefer not to say"].map(
                (label) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() =>
                      setDemographics((prev) => ({
                        ...prev,
                        gender: label,
                      }))
                    }
                    className={`rounded-md border px-3 py-1.5 text-left ${
                      demographics.gender === label
                        ? "border-blue-600 bg-blue-50 text-blue-700"
                        : "border-slate-300 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {label}
                  </button>
                )
              )}
            </div>
          </fieldset>

          {/* Race */}
          <fieldset>
            <legend className="block text-xs font-medium text-slate-700 mb-2">
              Race or Ethnicity
            </legend>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                "American Indian or Alaska Native",
                "Asian",
                "Black or African American",
                "Hispanic or Latino",
                "Native Hawaiian or Other Pacific Islander",
                "White",
                "Other / Multiracial",
                "Prefer not to say",
              ].map((label) => (
                <button
                  key={label}
                  type="button"
                  onClick={() =>
                    setDemographics((prev) => ({
                      ...prev,
                      race: label,
                    }))
                  }
                  className={`rounded-md border px-3 py-1.5 text-left ${
                    demographics.race === label
                      ? "border-blue-600 bg-blue-50 text-blue-700"
                      : "border-slate-300 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>

          {/* Grad year + country */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Graduation Year
              </label>
              <input
                type="number"
                min={2024}
                max={2035}
                value={demographics.gradYear}
                onChange={(e) =>
                  setDemographics((prev) => ({
                    ...prev,
                    gradYear: e.target.value,
                  }))
                }
                placeholder="2027"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Country
              </label>
              <select
                value={demographics.country}
                onChange={(e) =>
                  setDemographics((prev) => {
                    const nextCountry = e.target.value;
                    return {
                      ...prev,
                      country: nextCountry,
                      locationState: isUSCountry(nextCountry) ? prev.locationState : "",
                    };
                  })
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select country</option>
                {COUNTRY_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* City + (optional) state */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                City
              </label>
              <input
                type="text"
                value={demographics.city}
                onChange={(e) =>
                  setDemographics((prev) => ({
                    ...prev,
                    city: e.target.value,
                  }))
                }
                placeholder="Your city"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            {isUS && (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Home State (US)
                </label>
                <select
                  value={demographics.locationState}
                  onChange={(e) =>
                    setDemographics((prev) => ({
                      ...prev,
                      locationState: e.target.value,
                    }))
                  }
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select state</option>
                  {US_STATES.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </form>
      </Modal>

      {/* Activities modal */}
      <Modal
        open={showActModal}
        title="Edit extracurricular activities"
        onClose={() => setShowActModal(false)}
        footer={
          <>
            <button
              type="button"
              onClick={() => setShowActModal(false)}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="activities-form"
              className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
            >
              Save
            </button>
          </>
        }
      >
        <form
          id="activities-form"
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const cleaned = activities
              .map((a) => ({
                ...a,
                name: a.name.trim(),
                role: a.role.trim(),
              }))
              .filter((a) => a.name || a.role)
              .slice(0, 10);
            setActivities(cleaned);
            setStudentProfile({ activities: cleaned as any });
            setShowActModal(false);
          }}
        >
          <p className="text-xs text-slate-600">
            Add a few activities that matter most. Aim for at least{" "}
            <span className="font-semibold">three</span> solid entries.
          </p>
          {activities.map((act, idx) => (
            <div
              key={act.id}
              className="rounded-lg border border-slate-200 p-3 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-700">
                  Activity {idx + 1}
                </span>
                {activities.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      setActivities((prev) =>
                        prev.filter((a) => a.id !== act.id)
                      )
                    }
                    className="text-[11px] text-slate-500 hover:text-red-500"
                  >
                    Remove
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div>
                  <label className="block text-[11px] font-medium text-slate-700 mb-1">
                    Activity name
                  </label>
                  <input
                    type="text"
                    value={act.name}
                    onChange={(e) =>
                      setActivities((prev) =>
                        prev.map((a) =>
                          a.id === act.id
                            ? { ...a, name: e.target.value }
                            : a
                        )
                      )
                    }
                    placeholder="e.g. Varsity Soccer"
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-700 mb-1">
                    Your role
                  </label>
                  <input
                    type="text"
                    value={act.role}
                    onChange={(e) =>
                      setActivities((prev) =>
                        prev.map((a) =>
                          a.id === act.id
                            ? { ...a, role: e.target.value }
                            : a
                        )
                      )
                    }
                    placeholder="e.g. Captain, Member"
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              setActivities((prev) => [
                ...prev,
                { id: newId(), name: "", role: "" },
              ])
            }
            className="inline-flex items-center rounded-full border border-dashed border-slate-300 px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:border-slate-400 hover:bg-slate-50"
          >
            + Add another activity
          </button>
        </form>
      </Modal>

      {/* Add school modal */}
      <Modal
        open={showAddSchoolModal}
        title="Add school to your list"
        onClose={() => setShowAddSchoolModal(false)}
        footer={
          <button
            type="button"
            onClick={() => setShowAddSchoolModal(false)}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Close
          </button>
        }
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-700">
              Search our colleges
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, city, or state..."
                className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <select
                value={searchState}
                onChange={(e) => setSearchState(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:w-32"
              >
                <option value="">All states</option>
                {stateOptions.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-2 max-h-56 overflow-y-auto rounded-md border border-slate-200 bg-slate-50/60">
              {filteredIndex.length === 0 ? (
                <div className="px-3 py-2 text-xs text-slate-600">
                  No colleges match that search yet. Try a different
                  name or add a custom school below.
                </div>
              ) : (
                <ul className="divide-y divide-slate-200 text-xs">
                  {filteredIndex.map((inst) => (
                    <li
                      key={inst.unitid}
                      className="flex items-center justify-between px-3 py-2 hover:bg-white"
                    >
                      <div>
                        <div className="font-medium text-slate-900">
                          {inst.name}
                        </div>
                        <div className="text-[11px] text-slate-600">
                          {[inst.city, inst.state]
                            .filter(Boolean)
                            .join(", ") || "Location N/A"}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAddFromIndex(inst)}
                        className="ml-2 inline-flex items-center rounded-full bg-blue-600 px-3 py-1 text-[11px] font-semibold text-white hover:bg-blue-700"
                      >
                        Add
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="border-t border-slate-200 pt-4">
            <p className="text-xs font-medium text-slate-700 mb-2">
              Can&apos;t find a school? Add it manually.
            </p>
            <form
              className="space-y-3"
              onSubmit={handleAddCustomSchool}
            >
              <div>
                <label className="block text-[11px] font-medium text-slate-700 mb-1">
                  School name
                </label>
                <input
                  type="text"
                  value={customSchoolName}
                  onChange={(e) => setCustomSchoolName(e.target.value)}
                  required
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g. Local Community College"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-[11px] font-medium text-slate-700 mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    value={customSchoolCity}
                    onChange={(e) =>
                      setCustomSchoolCity(e.target.value)
                    }
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-700 mb-1">
                    State
                  </label>
                  <input
                    type="text"
                    value={customSchoolState}
                    onChange={(e) =>
                      setCustomSchoolState(e.target.value)
                    }
                    maxLength={2}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm uppercase focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="inline-flex items-center rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
              >
                Add School
              </button>
            </form>
          </div>
        </div>
      </Modal>
      {/* Academics modal */}
      <Modal
        open={showAcadModal}
        title="Edit academics"
        onClose={() => setShowAcadModal(false)}
        footer={
          <>
            <button
              type="button"
              onClick={() => setShowAcadModal(false)}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="acad-form"
              disabled={savingAcad}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {savingAcad ? "Saving..." : "Save"}
            </button>
          </>
        }
      >
        <form
          id="acad-form"
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const sat =
              academics.sat != null
                ? Math.min(Math.max(academics.sat, 0), 1600)
                : null;
            const act =
              academics.act != null
                ? Math.min(Math.max(academics.act, 0), 36)
                : null;
            const customGpa =
              academics.customGpa != null
                ? Math.min(Math.max(academics.customGpa, 0), 4)
                : null;
            const nextState = {
              ...academics,
              sat,
              act,
              customGpa,
            };
            setAcademics(nextState);
            const finalGpa =
              gpaMode === "custom"
                ? customGpa
                : nextState.gpaValue ?? customGpa ?? null;
            const satMath =
              sat != null ? Math.round(sat / 2) : academicSnapshot?.sat_math ?? null;
            const satEbrw =
              sat != null
                ? sat - (satMath ?? 0)
                : academicSnapshot?.sat_ebrwr ?? null;
            setSavingAcad(true);
            try {
              await updateProfileData({
                academic: {
                  gpa: finalGpa ?? null,
                  sat_total: sat,
                  sat_math: satMath,
                  sat_ebrwr: satEbrw,
                  act_composite: act ?? null,
                  ap_courses: nextState.apCourses || null,
                  ib_courses: nextState.ibCourses || null,
                  ib_score: nextState.ibScore || null,
                },
              });
              setStudentProfile({
                gpa: finalGpa ?? null,
                satMath: satMath ?? null,
                satEBRW: satEbrw ?? null,
                actComposite: act ?? null,
              });
            } catch (err) {
              console.error("Failed to save academics", err);
            } finally {
              setSavingAcad(false);
              setShowAcadModal(false);
            }
          }}
        >
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-2">
                How should we estimate your GPA?
              </label>
              <div className="flex gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => {
                    setGpaMode("band");
                    setAcademics((prev) => ({ ...prev, customGpa: null }));
                  }}
                  className={`rounded-full border px-3 py-1.5 text-xs ${
                    gpaMode === "band"
                      ? "border-blue-600 bg-blue-50 text-blue-700"
                      : "border-slate-300 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  Grade ranges
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setGpaMode("custom");
                    setAcademics((prev) => ({ ...prev, gpaBand: "", gpaValue: null }));
                  }}
                  className={`rounded-full border px-3 py-1.5 text-xs ${
                    gpaMode === "custom"
                      ? "border-blue-600 bg-blue-50 text-blue-700"
                      : "border-slate-300 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  Enter exact GPA
                </button>
              </div>
              {gpaMode === "band" && (
                <>
                  <div className="flex flex-wrap gap-2">
                    {gpaBands.map((band) => (
                      <button
                        key={band.id}
                        type="button"
                        onClick={() =>
                          setAcademics((prev) => ({
                            ...prev,
                            gpaBand: band.id,
                            gpaValue: band.value,
                          }))
                        }
                        className={`rounded-full border px-3 py-1.5 text-xs ${
                          academics.gpaBand === band.id
                            ? "border-blue-600 bg-blue-50 text-blue-700"
                            : "border-slate-300 text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <span className="font-medium">{band.label}</span>
                        <span className="ml-1 text-[11px] text-slate-500">
                          {band.range}
                        </span>
                      </button>
                    ))}
                  </div>
                  {gpaDisplay != null && (
                    <p className="mt-2 text-xs text-slate-600">
                      Your estimated unweighted GPA:{" "}
                      <span className="font-semibold">
                        {gpaDisplay.toFixed(2)}
                      </span>
                    </p>
                  )}
                </>
              )}
              {gpaMode === "custom" && (
                <div className="mt-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Type your unweighted GPA
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={4}
                    step={0.01}
                    value={academics.customGpa ?? ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      setAcademics((prev) => ({
                        ...prev,
                        customGpa:
                          val === ""
                            ? null
                            : Math.min(Math.max(Number(val), 0), 4),
                      }));
                    }}
                    placeholder="e.g. 3.72"
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              )}
            </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                SAT Total (0–1600)
              </label>
              <input
                type="number"
                min={0}
                max={1600}
                value={academics.sat ?? ""}
                onChange={(e) =>
                  setAcademics((prev) => ({
                    ...prev,
                    sat: e.target.value
                      ? Number(e.target.value)
                      : null,
                  }))
                }
                placeholder="Leave blank if none"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                ACT Composite (0–36)
              </label>
              <input
                type="number"
                min={0}
                max={36}
                value={academics.act ?? ""}
                onChange={(e) =>
                  setAcademics((prev) => ({
                    ...prev,
                    act: e.target.value
                      ? Number(e.target.value)
                      : null,
                  }))
                }
                placeholder="Leave blank if none"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                AP Courses
              </label>
              <input
                type="text"
                value={academics.apCourses}
                onChange={(e) =>
                  setAcademics((prev) => ({
                    ...prev,
                    apCourses: e.target.value,
                  }))
                }
                placeholder="How many and which subjects?"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                IB Courses
              </label>
              <input
                type="text"
                value={academics.ibCourses}
                onChange={(e) =>
                  setAcademics((prev) => ({
                    ...prev,
                    ibCourses: e.target.value,
                  }))
                }
                placeholder="If you take IB, list courses here"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Estimated IB score (if any)
              </label>
              <input
                type="text"
                value={academics.ibScore}
                onChange={(e) =>
                  setAcademics((prev) => ({
                    ...prev,
                    ibScore: e.target.value,
                  }))
                }
                placeholder="For example: 38/45"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  );
};

export default ProfileDashboardPage;
