import React, { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../services/supabaseClient";
import type { Activity } from "../types";

export type StudentProfileSummary = {
  firstName?: string;
  lastName?: string;
  country?: string;
  city?: string;
  gpa?: number | null;
  classRank?: string | null;
  satMath?: number | null;
  satEBRW?: number | null;
  actComposite?: number | null;
  recScore?: number | null; // 1-6, higher is stronger
  activities?: Activity[];
};

type OnboardingContextValue = {
  user: User | null;
  onboardingStep: number;
  loading: boolean;
  setOnboardingStepRemote: (
    step: number,
    override?: Partial<StudentProfileSummary>
  ) => Promise<void>;
  targetUnitIds: number[];
  setTargetUnitIds: (ids: number[]) => void;
  studentProfile: StudentProfileSummary;
  setStudentProfile: (update: Partial<StudentProfileSummary>) => void;
  logout: () => Promise<void>;
};

const OnboardingContext = createContext<OnboardingContextValue | undefined>(
  undefined
);

export const determineNextPath = (step: number | null | undefined): string => {
  const s = typeof step === "number" ? step : 0;
  if (s < 1) return "/profile/name";
  if (s < 2) return "/profile/location";
  if (s < 3) return "/profile/gpa";
  if (s < 4) return "/profile/tests";
  if (s < 5) return "/profile/activities";
  if (s < 6) return "/profile/recs";
  if (s < 7) return "/profile/targets";
  return "/profile/dashboard";
};

export const OnboardingProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [targetUnitIds, setTargetUnitIds] = useState<number[]>([]);
  const [studentProfile, setStudentProfileState] = useState<StudentProfileSummary>(
    {}
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Handle magic-link callback: if the URL fragment contains access / refresh
        // tokens, hydrate the Supabase session before we ask for the current user.
        try {
          const fullHash = window.location.hash || "";
          if (fullHash.includes("access_token=") && fullHash.includes("refresh_token=")) {
            const parts = fullHash.split("#");
            const lastFragment = parts[parts.length - 1] || "";
            const params = new URLSearchParams(lastFragment);
            const accessToken = params.get("access_token");
            const refreshToken = params.get("refresh_token");
            if (accessToken && refreshToken) {
              await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
              });
              // Preserve the router hash (first segment like #/profile/route) and
              // drop the token fragment so the URL looks clean.
              const routeFragment = parts.length > 2 ? `#${parts[1]}` : "#/profile/route";
              window.history.replaceState(
                window.history.state,
                document.title,
                `${window.location.pathname}${window.location.search}${routeFragment}`
              );
            }
          }
        } catch {
          // If token parsing fails, continue with best-effort getUser below.
        }

        const { data } = await supabase.auth.getUser();
        const currentUser = data?.user ?? null;
        if (!currentUser) {
          if (!cancelled) {
            setUser(null);
            setOnboardingStep(0);
            setLoading(false);
          }
          return;
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("onboarding_step, academic_stats, target_universities, extracurriculars")
          .eq("user_id", currentUser.id)
          .maybeSingle();

        if (!cancelled) {
          setUser(currentUser);
          setOnboardingStep(profile?.onboarding_step ?? 0);

          const academic = (profile?.academic_stats || {}) as any;
          const extras = (profile?.extracurriculars || []) as any;
          setStudentProfileState({
            firstName: academic.first_name ?? undefined,
            lastName: academic.last_name ?? undefined,
            country: academic.country ?? undefined,
            city: academic.city ?? undefined,
            gpa:
              typeof academic.gpa === "number"
                ? academic.gpa
                : academic.gpa != null
                ? Number(academic.gpa)
                : null,
            classRank: academic.class_rank ?? null,
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
            activities: Array.isArray(extras) ? (extras as Activity[]) : [],
          });

          const targets = (profile?.target_universities as any) || [];
          if (Array.isArray(targets)) {
            setTargetUnitIds(
              targets
                .map((v) => Number(v))
                .filter((v) => Number.isFinite(v)) as number[]
            );
          }

          setLoading(false);
        }
      } catch (_err) {
        if (!cancelled) {
          setUser(null);
          setOnboardingStep(0);
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setOnboardingStepRemote = async (
    step: number,
    override?: Partial<StudentProfileSummary>
  ) => {
    if (!user) return;
    const next = step > onboardingStep ? step : onboardingStep;

    // Merge any overrides into the current student profile (so updates from
    // an individual step are included in the Supabase write).
    const merged: StudentProfileSummary = { ...studentProfile, ...override };
    setStudentProfileState(merged);

    const academicStats = {
      first_name: merged.firstName ?? null,
      last_name: merged.lastName ?? null,
      country: merged.country ?? null,
      city: merged.city ?? null,
      gpa: merged.gpa ?? null,
      class_rank: merged.classRank ?? null,
      sat_math: merged.satMath ?? null,
      sat_ebrwr: merged.satEBRW ?? null,
      act_composite: merged.actComposite ?? null,
      rec_score: merged.recScore ?? null,
    };

    await supabase.from("profiles").upsert(
      {
        user_id: user.id,
        onboarding_step: next,
        academic_stats: academicStats,
        extracurriculars: merged.activities ?? null,
        target_universities: targetUnitIds.length ? targetUnitIds : null,
      },
      { onConflict: "user_id" }
    );
    setOnboardingStep(next);
  };

  const setStudentProfile = (update: Partial<StudentProfileSummary>) => {
    setStudentProfileState((prev) => ({ ...prev, ...update }));
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
