import { createClient } from "@supabase/supabase-js";
import type { Database } from "../supabase.types";

// Prefer env vars, but fall back to the project's known Supabase URL + anon key
// so production always has a working client even if build-time env is missing.
const supabaseUrl =
  (import.meta as any).env?.VITE_SUPABASE_URL ||
  "https://ngvdluvechfpojchrrtx.supabase.co";
const supabaseAnonKey =
  (import.meta as any).env?.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ndmRsdXZlY2hmcG9qY2hycnR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyNzE1MTcsImV4cCI6MjA3Nzg0NzUxN30.W54eXStAxl55zpP_PXFDQxXH_9CGPb5sInfT73l-KqE";

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
  },
});

