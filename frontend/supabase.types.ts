export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type AdmissionsCategory = "reach" | "target" | "safety";

export type CollegeStatus = "saved" | "applying" | "accepted";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          created_at: string;
          user_id: string;
          onboarding_step: number | null;
          academic_stats: Json | null;
          extracurriculars: Json | null;
          target_universities: number[] | null;
          // Structured academic fields for quicker querying / modeling
          unweighted_gpa: number | null;
          sat_score: number | null;
          act_score: number | null;
          location_state: string | null;
          grad_year: number | null;
          // 4-digit major code (e.g., CIP-style)
          major_code: string | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          user_id: string;
          onboarding_step?: number | null;
          academic_stats?: Json | null;
          extracurriculars?: Json | null;
          target_universities?: number[] | null;
          unweighted_gpa?: number | null;
          sat_score?: number | null;
          act_score?: number | null;
          location_state?: string | null;
          grad_year?: number | null;
          major_code?: string | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          user_id?: string;
          onboarding_step?: number | null;
          academic_stats?: Json | null;
          extracurriculars?: Json | null;
          target_universities?: number[] | null;
          unweighted_gpa?: number | null;
          sat_score?: number | null;
          act_score?: number | null;
          location_state?: string | null;
          grad_year?: number | null;
          major_code?: string | null;
        };
        Relationships: [];
      };
      contact_requests: {
        Row: {
          id: string;
          created_at: string;
          name: string | null;
          email: string | null;
          phone: string | null;
          grad_year: string | null;
          grade_level: string | null;
          interests: string | null;
          budget_range: string | null;
          location_preferences: string | null;
          message: string | null;
          source_page: string | null;
          user_id: string | null;
          profile_snapshot: Json | null;
          status: string | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          name?: string | null;
          email?: string | null;
          phone?: string | null;
          grad_year?: string | null;
          grade_level?: string | null;
          interests?: string | null;
          budget_range?: string | null;
          location_preferences?: string | null;
          message?: string | null;
          source_page?: string | null;
          user_id?: string | null;
          profile_snapshot?: Json | null;
          status?: string | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          name?: string | null;
          email?: string | null;
          phone?: string | null;
          grad_year?: string | null;
          grade_level?: string | null;
          interests?: string | null;
          budget_range?: string | null;
          location_preferences?: string | null;
          message?: string | null;
          source_page?: string | null;
          user_id?: string | null;
          profile_snapshot?: Json | null;
          status?: string | null;
        };
        Relationships: [];
      };
      colleges: {
        Row: {
          id: number;
          created_at: string;
          // Local PK, separate from IPEDS / Supabase institutions
          unitid: number | null;
          name: string;
          city: string | null;
          state: string | null;
          acceptance_rate: number | null;
          avg_sat: number | null;
          avg_act: number | null;
          tuition: number | null;
          early_deadline: string | null;
          regular_deadline: string | null;
        };
        Insert: {
          id?: number;
          created_at?: string;
          unitid?: number | null;
          name: string;
          city?: string | null;
          state?: string | null;
          acceptance_rate?: number | null;
          avg_sat?: number | null;
          avg_act?: number | null;
          tuition?: number | null;
          early_deadline?: string | null;
          regular_deadline?: string | null;
        };
        Update: {
          id?: number;
          created_at?: string;
          unitid?: number | null;
          name?: string;
          city?: string | null;
          state?: string | null;
          acceptance_rate?: number | null;
          avg_sat?: number | null;
          avg_act?: number | null;
          tuition?: number | null;
          early_deadline?: string | null;
          regular_deadline?: string | null;
        };
        Relationships: [];
      };
      user_colleges: {
        Row: {
          id: number;
          created_at: string;
          profile_id: string;
          college_id: number;
          status: CollegeStatus;
          calculated_chance: AdmissionsCategory | null;
        };
        Insert: {
          id?: number;
          created_at?: string;
          profile_id: string;
          college_id: number;
          status?: CollegeStatus;
          calculated_chance?: AdmissionsCategory | null;
        };
        Update: {
          id?: number;
          created_at?: string;
          profile_id?: string;
          college_id?: number;
          status?: CollegeStatus;
          calculated_chance?: AdmissionsCategory | null;
        };
        Relationships: [];
      };
      majors: {
        Row: {
          code: string;
          name: string;
        };
        Insert: {
          code: string;
          name: string;
        };
        Update: {
          code?: string;
          name?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
