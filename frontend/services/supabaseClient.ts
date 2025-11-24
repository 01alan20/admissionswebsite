import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  (import.meta as any).env?.VITE_SUPABASE_URL ||
  (typeof process !== "undefined" ? process.env.VITE_SUPABASE_URL : undefined);
const supabaseAnonKey =
  (import.meta as any).env?.VITE_SUPABASE_ANON_KEY ||
  (typeof process !== "undefined" ? process.env.VITE_SUPABASE_ANON_KEY : undefined);

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Magic link onboarding will not work until these are set."
  );
}

export const supabase = createClient(supabaseUrl || "", supabaseAnonKey || "", {
  auth: {
    persistSession: true,
  },
});

