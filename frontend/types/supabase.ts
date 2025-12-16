export type AdmissionCategory = "Safety" | "Target" | "Reach";

export type TargetStatus = "saved" | "applying" | "accepted";

// Shape for profiles.academic_stats (jsonb)
export interface AcademicStats {
  gpa: number | null;
  gpaScale: string | null;
  sat?: number | null;
  act?: number | null;
  rank?: number | null;
}

// Shape for entries stored in profiles.target_universities (jsonb[])
export interface TargetUniversity {
  unitid: number;
  status: TargetStatus;
  admission_category: AdmissionCategory;
  notes: string;
}

// Basic demographics payload stored in profiles.demographics (jsonb)
export interface DemographicsJson {
  gender?: string | null;
  race?: string | null;
  country?: string | null;
  location_country?: string | null;
  location_state?: string | null;
  grad_year?: number | null;
}

// Lightweight extracurricular entry stored in profiles.extracurriculars (jsonb[])
export interface ExtracurricularActivityJson {
  id: string;
  name: string;
  description?: string;
  role?: string;
  hours_per_week?: number | null;
  weeks_per_year?: number | null;
}
