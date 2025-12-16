import { createClient } from "@supabase/supabase-js";
import type { Database } from "../supabase.types";

// Prefer env vars, but fall back to the project's known Supabase URL + anon key
// so production always has a working client even if build-time env is missing.
const supabaseUrl =
  (import.meta as any).env?.VITE_SUPABASE_URL ||
  "https://bwwgssljkdvqojcaxrqf.supabase.co";
const supabaseAnonKey =
  (import.meta as any).env?.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3d2dzc2xqa2R2cW9qY2F4cnFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3NzI0NzEsImV4cCI6MjA4MTM0ODQ3MX0.8vR5CS88EHnrAOg_Z7N-QFEXFuPI2mxhCMHNDDDBrfo";

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
  },
});
