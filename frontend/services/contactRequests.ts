import { supabase } from "./supabaseClient";
import type { StudentProfileSummary } from "../context/OnboardingContext";

export type ContactRequestInput = {
  name: string;
  email: string;
  phone?: string;
  gradYear?: string;
  gradeLevel?: string;
  interests?: string;
  budgetRange?: string;
  locationPreferences?: string;
  message: string;
  sourcePage?: string;
  userId?: string | null;
  profileSnapshot?: StudentProfileSummary | null;
};

export async function submitContactRequest(input: ContactRequestInput): Promise<void> {
  const payload = {
    name: input.name.trim(),
    email: input.email.trim(),
    phone: input.phone?.trim() || null,
    grad_year: input.gradYear?.trim() || null,
    grade_level: input.gradeLevel?.trim() || null,
    interests: input.interests?.trim() || null,
    budget_range: input.budgetRange?.trim() || null,
    location_preferences: input.locationPreferences?.trim() || null,
    message: input.message.trim(),
    source_page: input.sourcePage || null,
    user_id: input.userId || null,
    profile_snapshot: input.profileSnapshot ?? null,
    status: "new",
  };

  const { error } = await supabase.from("contact_requests").insert(payload);
  if (error) {
    throw error;
  }
}

