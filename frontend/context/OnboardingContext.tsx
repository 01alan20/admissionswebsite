import React, { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../services/supabaseClient";
import type { Activity } from "../types";
import { normalizeMajorSelectionList } from "../utils/majors";

export type StudentProfileSummary = {
  firstName?: string;
  lastName?: string;
  country?: string;
  city?: string;
  gpa?: number | null;
  classRank?: string | null;
  satTotal?: number | null;
  classRankExact?: string | null;
  classRankCategory?: string | null;
  classRankPercentile?: number | null;
  classSize?: number | null;
  satMath?: number | null;
  satEBRW?: number | null;
  actComposite?: number | null;
  recScore?: number | null; // 1-6, higher is stronger
   majors?: string[];
  activities?: Activity[];
};

type OnboardingContextValue = {
  user: User | null;
  onboardingStep: number;
  loading: boolean;
  setOnboardingStepRemote: (
    step: number,
    override?: Partial<StudentProfileSummary>,
    overrideTargetIds?: number[]
  ) => Promise<void>;
  targetUnitIds: number[];
  setTargetUnitIds: (ids: number[]) => void;
  studentProfile: StudentProfileSummary;
  setStudentProfile: (update: Partial<StudentProfileSummary>) => void;
  logout: () => Promise<void>;
  setUserDirect: (user: User | null) => void;
};

const OnboardingContext = createContext<OnboardingContextValue | undefined>(
  undefined
);

export const determineNextPath = (step: number | null | undefined): string => {
  return "/profile/my-profile";
};

const TARGETS_STORAGE_KEY_PREFIX = "sta_targets_";
const PROFILE_STORAGE_KEY_PREFIX = "sta_profile_";

const loadTargetsFromStorage = (userId: string | null): number[] => {
  if (typeof window === "undefined" || !userId) return [];
  try {
    const raw = window.localStorage.getItem(
      `${TARGETS_STORAGE_KEY_PREFIX}${userId}`
    );
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((v: any) => Number(v))
      .filter((v: number) => Number.isFinite(v));
  } catch {
    return [];
  }
};

const saveTargetsToStorage = (userId: string | null, ids: number[]) => {
  if (typeof window === "undefined" || !userId) return;
  try {
    window.localStorage.setItem(
      `${TARGETS_STORAGE_KEY_PREFIX}${userId}`,
      JSON.stringify(ids)
    );
  } catch {
    // ignore
  }
};

const loadProfileFromStorage = (
  userId: string | null
): Partial<StudentProfileSummary> | null => {
  if (typeof window === "undefined" || !userId) return null;
  try {
    const raw = window.localStorage.getItem(
      `${PROFILE_STORAGE_KEY_PREFIX}${userId}`
    );
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as Partial<StudentProfileSummary>;
  } catch {
    return null;
  }
};

const saveProfileToStorage = (
  userId: string | null,
  profile: StudentProfileSummary
) => {
  if (typeof window === "undefined" || !userId) return;
  try {
    window.localStorage.setItem(
      `${PROFILE_STORAGE_KEY_PREFIX}${userId}`,
      JSON.stringify(profile)
    );
  } catch {
    // ignore
  }
};

const deriveNameFromUser = (currentUser: User): { firstName?: string; lastName?: string } => {
  const full = (currentUser.user_metadata?.full_name as string) || "";
  const email = currentUser.email || "";
  if (full.trim()) {
    const parts = full.trim().split(/\s+/);
    const firstName = parts[0];
    const lastName = parts.slice(1).join(" ") || undefined;
    return { firstName, lastName };
  }
  if (email) {
    const handle = email.split("@")[0] || "";
    const cleaned = handle.replace(/[._-]+/g, " ");
    const firstName = cleaned ? cleaned.split(/\s+/)[0] : undefined;
    return { firstName, lastName: undefined };
  }
  return {};
};

export const OnboardingProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [targetUnitIds, setTargetUnitIdsState] = useState<number[]>([]);
  const [studentProfile, setStudentProfileState] = useState<StudentProfileSummary>(
    {}
  );

  const setUserDirect = (u: User | null) => {
    setLoading(true);
    setUser(u);
  };

const loadProfileForUser = async (currentUser: User, cancelledRef: { value: boolean }) => {
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_step, academic_stats, target_universities, extracurriculars")
      .eq("user_id", currentUser.id)
      .maybeSingle();

    if (cancelledRef.value) return;

    setOnboardingStep(profile?.onboarding_step ?? 0);

    const academic = (profile?.academic_stats || {}) as any;
    const extras = (profile?.extracurriculars || []) as any;

    const normalizedActivities: Activity[] = Array.isArray(extras)
      ? (extras as any[])
          .map((raw) => {
            if (!raw || typeof raw !== "object") return null;
            const id = typeof (raw as any).id === "string" ? (raw as any).id : null;
            const name = String((raw as any).name ?? "").trim();
            if (!name) return null;
            const roleRaw = String((raw as any).role ?? "").trim();
            const role =
              roleRaw === "Founder" || roleRaw === "Leader/Captain" || roleRaw === "Member"
                ? (roleRaw as Activity["role"])
                : "Member";
            const levelRaw = String((raw as any).level ?? "").trim();
            const level =
              levelRaw === "School Level" ||
              levelRaw === "Regional/State" ||
              levelRaw === "National/International"
                ? (levelRaw as Activity["level"])
                : "School Level";
            return { id: id ?? `${Date.now()}_${Math.random()}`, name, role, level } as Activity;
          })
          .filter(Boolean)
      : [];

    const derived = deriveNameFromUser(currentUser);
    const firstNameResolved = academic.first_name ?? derived.firstName ?? undefined;
    const lastNameResolved = academic.last_name ?? derived.lastName ?? undefined;

    const fromDb: StudentProfileSummary = {
      firstName: firstNameResolved,
      lastName: lastNameResolved,
      country: academic.country ?? undefined,
      city: academic.city ?? undefined,
      gpa:
        typeof academic.gpa === "number"
          ? academic.gpa
          : academic.gpa != null
          ? Number(academic.gpa)
          : null,
      classRank: academic.class_rank ?? null,
      satTotal:
        typeof academic.sat_total === "number"
          ? academic.sat_total
          : academic.sat_total != null
          ? Number(academic.sat_total)
          : null,
      classRankExact: academic.class_rank_exact ?? null,
      classRankCategory: academic.class_rank_category ?? null,
      classRankPercentile:
        academic.class_rank_percentile != null
          ? Number(academic.class_rank_percentile)
          : null,
      classSize:
        academic.class_size != null ? Number(academic.class_size) : null,
      satMath:
        typeof academic.sat_math === "number"
          ? academic.sat_math
          : academic.sat_math != null
          ? Number(academic.sat_math)
          : null,
      satEBRW:
        typeof academic.sat_ebrwr === "number"
          ? academic.sat_ebrwr
          : academic.sat_ebrwr != null
          ? Number(academic.sat_ebrwr)
          : null,
      actComposite:
        typeof academic.act_composite === "number"
          ? academic.act_composite
          : academic.act_composite != null
          ? Number(academic.act_composite)
          : null,
      recScore:
        typeof academic.rec_score === "number"
          ? academic.rec_score
          : academic.rec_score != null
          ? Number(academic.rec_score)
          : null,
      majors: normalizeMajorSelectionList(academic.majors) ?? undefined,
      activities: normalizedActivities,
    };

    if ((!academic.first_name || !academic.last_name) && (derived.firstName || derived.lastName)) {
      const nextAcademic = {
        ...academic,
        first_name: firstNameResolved,
        last_name: lastNameResolved,
      };
      await supabase.from("profiles").upsert(
        {
          user_id: currentUser.id,
          academic_stats: nextAcademic,
        },
        { onConflict: "user_id" }
      );
    }

    const storedProfile = loadProfileFromStorage(currentUser.id);
    const mergedProfile: StudentProfileSummary = {
      ...(storedProfile || {}),
      ...fromDb,
    };
    if (mergedProfile.majors) {
      mergedProfile.majors =
        normalizeMajorSelectionList(mergedProfile.majors) ??
        mergedProfile.majors;
    }

    setStudentProfileState(mergedProfile);
    saveProfileToStorage(currentUser.id, mergedProfile);

    const targetsFromDb = (profile?.target_universities as any) || [];
    let ids: number[] = [];
    if (Array.isArray(targetsFromDb)) {
      ids = targetsFromDb
        .map((v) => Number(v))
        .filter((v) => Number.isFinite(v)) as number[];
    }
    const storedTargets = loadTargetsFromStorage(currentUser.id);
    const finalIds = ids.length ? ids : storedTargets;
    setTargetUnitIdsState(finalIds);
    if (ids.length) saveTargetsToStorage(currentUser.id, ids);
  };

  useEffect(() => {
    const cancelled = { value: false };
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const currentUser = data?.user ?? null;
        if (!currentUser) {
          if (!cancelled.value) {
            setUser(null);
            setOnboardingStep(0);
            setLoading(false);
          }
          return;
        }

        if (!cancelled.value) {
          setUser(currentUser);
          await loadProfileForUser(currentUser, cancelled);
          setLoading(false);
        }
      } catch (_err) {
        if (!cancelled.value) {
          setUser(null);
          setOnboardingStep(0);
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled.value = true;
    };
  }, []);

  // When a user is set directly (e.g., after password login), refresh their profile
  // from Supabase so onboarding picks up existing data.
  useEffect(() => {
    const cancelled = { value: false };
    (async () => {
      if (!user) return;
      setLoading(true);
      try {
        await loadProfileForUser(user, cancelled);
      } catch {
        // ignore; initial load effect will have handled first render case
      } finally {
        if (!cancelled.value) setLoading(false);
      }
    })();
    return () => {
      cancelled.value = true;
    };
  }, [user?.id]);

  const setOnboardingStepRemote = async (
    step: number,
    override?: Partial<StudentProfileSummary>,
    overrideTargetIds?: number[]
  ) => {
    if (!user) return;
    const next = step > onboardingStep ? step : onboardingStep;

    // Merge any overrides into the current student profile (so updates from
    // an individual step are included in the Supabase write).
    const merged: StudentProfileSummary = { ...studentProfile, ...override };
    if (merged.majors) {
      merged.majors =
        normalizeMajorSelectionList(merged.majors) ?? merged.majors;
    }
    setStudentProfileState(merged);
    saveProfileToStorage(user.id, merged);
    const mergedTargets = overrideTargetIds ?? targetUnitIds;
    if (overrideTargetIds) {
      setTargetUnitIdsState(overrideTargetIds);
      saveTargetsToStorage(user.id, overrideTargetIds);
    }

    const majorsClean = normalizeMajorSelectionList(merged.majors);

    const classRankValue =
      merged.classRankExact ||
      merged.classRank ||
      merged.classRankCategory ||
      null;

    const satTotalValue =
      merged.satTotal != null
        ? merged.satTotal
        : merged.satMath != null && merged.satEBRW != null
        ? Number(merged.satMath) + Number(merged.satEBRW)
        : null;

    const academicStats = {
      first_name: merged.firstName ?? null,
      last_name: merged.lastName ?? null,
      country: merged.country ?? null,
      city: merged.city ?? null,
      gpa: merged.gpa ?? null,
      class_rank: classRankValue,
      class_rank_exact: merged.classRankExact ?? null,
      class_rank_category: merged.classRankCategory ?? null,
      class_rank_percentile: merged.classRankPercentile ?? null,
      class_size: merged.classSize ?? null,
      sat_total: satTotalValue,
      act_composite: merged.actComposite ?? null,
      rec_score: merged.recScore ?? null,
      majors: majorsClean && majorsClean.length ? majorsClean : null,
    };

    await supabase.from("profiles").upsert(
      {
        user_id: user.id,
        onboarding_step: next,
        academic_stats: academicStats,
        extracurriculars: merged.activities ?? null,
        target_universities: mergedTargets && mergedTargets.length ? mergedTargets : null,
      },
      { onConflict: "user_id" }
    );
    setOnboardingStep(next);
  };

  const setStudentProfile = (update: Partial<StudentProfileSummary>) => {
    setStudentProfileState((prev) => {
    const merged: StudentProfileSummary = { ...prev, ...update };
    if (merged.majors) {
      merged.majors =
        normalizeMajorSelectionList(merged.majors) ?? merged.majors;
    }
      saveProfileToStorage(user?.id ?? null, merged);
      return merged;
    });
  };

  const setTargetUnitIds = (ids: number[]) => {
    setTargetUnitIdsState(ids);
    saveTargetsToStorage(user?.id ?? null, ids);
    if (user) {
      void supabase.from("profiles").upsert(
        {
          user_id: user.id,
          target_universities: ids.length ? ids : null,
        },
        { onConflict: "user_id" }
      );
    }
  };

  const logout = async () => {
    try {
      if (supabase) {
        await supabase.auth.signOut();
      }
    } catch {
      // ignore sign-out errors; we'll still clear local state
    } finally {
      setUser(null);
      setOnboardingStep(0);
      setTargetUnitIds([]);
      setStudentProfileState({});
    }
  };

  const value: OnboardingContextValue = {
    user,
    onboardingStep,
    loading,
    setOnboardingStepRemote,
    targetUnitIds,
    setTargetUnitIds,
    studentProfile,
    setStudentProfile,
    logout,
    setUserDirect,
  };

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
};

export const useOnboardingContext = (): OnboardingContextValue => {
  const ctx = useContext(OnboardingContext);
  if (!ctx) {
    throw new Error("useOnboardingContext must be used within OnboardingProvider");
  }
  return ctx;
};
