
export interface Institution {
  unitid: number;
  name: string;
  city: string;
  state: string;
  control: string; // "Public", "Private nonprofit", etc.
  level: string; // "4-year", "2-year", etc.
  acceptance_rate: number | null;
  yield: number | null;
  test_policy: string;
  major_families: string[];
  // Optional CIP-based majors (built from IPEDS degrees data)
  majors_cip_two_digit?: string[];
  majors_cip_four_digit?: string[];
  majors_cip_six_digit?: string[];
  tuition_2023_24_in_state?: number;
  tuition_2023_24_out_of_state?: number;
  tuition_2023_24?: number;
  intl_enrollment_pct?: number | null;
}

export interface InstitutionProfile {
  unitid: number;
  name: string;
  city: string;
  state: string;
  control: string;
  level: string;
  carnegie_basic: string;
  website: string;
  admissions_url: string | null;
  financial_aid_url?: string | null;
  test_policy: string;
  major_families: string[];
  intl_enrollment_pct: number | null;
  tuition_summary: {
    sticker: number | null;
    in_state: number | null;
    out_of_state: number | null;
  };
  outcomes: {
    acceptance_rate: number | null;
    yield: number | null;
    grad_rate_6yr: number | null;
    retention_full_time: number | null;
    student_faculty_ratio: number | null;
    total_enrollment: number | null;
  };
}

export interface InstitutionRequirements {
  required: string[];
  considered: string[];
  not_considered: string[];
  test_policy: string;
}

export interface InstitutionDetail {
  profile: InstitutionProfile;
  requirements: InstitutionRequirements;
  support_notes: string[];
}

export interface Metric {
  year: number;
  applicants_total: number;
  admissions_total?: number;
  admitted_est?: number;
  enrolled_total?: number;
  enrolled_est?: number;
  percent_admitted_total: number;
  admissions_yield_total: number;
  sat_evidence_based_reading_and_writing_25th_percentile_score: number | null;
  sat_evidence_based_reading_and_writing_50th_percentile_score: number | null;
  sat_evidence_based_reading_and_writing_75th_percentile_score: number | null;
  sat_math_25th_percentile_score: number | null;
  sat_math_50th_percentile_score: number | null;
  sat_math_75th_percentile_score: number | null;
  act_composite_25th_percentile_score: number | null;
  act_composite_50th_percentile_score: number | null;
  act_composite_75th_percentile_score: number | null;
  percent_of_first_time_degree_certificate_seeking_students_submitting_sat_scores: number | null;
  number_of_first_time_degree_certificate_seeking_students_submitting_sat_scores: number | null;
  percent_of_first_time_degree_certificate_seeking_students_submitting_act_scores: number | null;
  number_of_first_time_degree_certificate_seeking_students_submitting_act_scores: number | null;
}

export interface Tuition {
  tuition_year: string;
  tuition_out_of_state?: number;
  tuition_and_fees?: number;
}

export interface InstitutionMetrics {
  metrics: Metric[];
  tuition: Tuition[];
}

// Majors (from IPEDS bachelor degrees CSV)
export interface InstitutionMajors {
  two_digit: string[];
  four_digit: string[];
  six_digit: string[];
}

export interface InstitutionMajorsByInstitution {
  [unitid: string]: InstitutionMajors;
}

export interface MajorsMeta {
  two_digit: Record<string, string>;
  four_digit: Record<string, string>;
  six_digit: Record<string, string>;
}
