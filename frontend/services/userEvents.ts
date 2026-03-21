import { supabase } from "./supabaseClient";

export type UserEventInput = {
  userId: string;
  eventType: string;
  source?: string | null;
  metadata?: Record<string, unknown> | null;
};

export async function logUserEvent(input: UserEventInput): Promise<void> {
  const payload = {
    user_id: input.userId,
    event_type: input.eventType.trim(),
    source: input.source?.trim() || null,
    metadata: input.metadata ?? {},
  };

  const { error } = await supabase.from("user_events").insert(payload);
  if (error) {
    console.warn("Failed to log user event", {
      eventType: payload.event_type,
      source: payload.source,
      code: error.code,
      message: error.message,
    });
  }
}
