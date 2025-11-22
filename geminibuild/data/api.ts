import {
  Institution,
  InstitutionDetail,
  InstitutionMetrics,
  InstitutionMajorsByInstitution,
  MajorsMeta,
} from "../types";

export interface InstitutionIndex {
  unitid: number;
  name: string;
  state: string | null;
  city: string | null;
}

async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch ${path}: ${res.status}`);
  return res.json() as Promise<T>;
}

// Map acceptance/yield ints (0-100) to decimals (0-1)
function pctToDecimal(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  return value > 1 ? value / 100 : value;
}

type InstitutionSites = {
  website?: string | null;
  admissions_url?: string | null;
  financial_aid_url?: string | null;
};

let institutionSitesPromise: Promise<Map<number, InstitutionSites>> | null = null;

async function getInstitutionSitesMap(): Promise<Map<number, InstitutionSites>> {
  if (!institutionSitesPromise) {
    institutionSitesPromise = (async () => {
      const data = await getJSON<any[]>("/data/institutions.json");
      const map = new Map<number, InstitutionSites>();
      for (const d of data) {
        const id = Number(d.unitid);
        if (!Number.isFinite(id)) continue;
        map.set(id, {
          website: d.website ?? null,
          admissions_url: d.admissions_url ?? null,
          financial_aid_url: d.financial_aid_url ?? null,
        });
      }
      return map;
    })();
  }
  return institutionSitesPromise;
}

export async function getAllInstitutions(): Promise<Institution[]> {
  const data = await getJSON<any[]>("/data/institutions.json");
  return data.map((d) => ({
    unitid: d.unitid,
    name: d.name,
    city: d.city,
    state: d.state,
    control: d.control,
    level: d.level,
    acceptance_rate: pctToDecimal(d.acceptance_rate),
    yield: pctToDecimal(d.yield),
    test_policy: d.test_policy,
    major_families: Array.isArray(d.major_families) ? d.major_families : [],
    majors_cip_two_digit: Array.isArray(d.majors_cip_two_digit) ? d.majors_cip_two_digit : undefined,
    majors_cip_four_digit: Array.isArray(d.majors_cip_four_digit) ? d.majors_cip_four_digit : undefined,
    majors_cip_six_digit: Array.isArray(d.majors_cip_six_digit) ? d.majors_cip_six_digit : undefined,
    tuition_2023_24_in_state: d.tuition_2023_24_in_state ?? undefined,
    tuition_2023_24_out_of_state: d.tuition_2023_24_out_of_state ?? undefined,
    tuition_2023_24: d.tuition_2023_24 ?? undefined,
    intl_enrollment_pct: pctToDecimal(d.intl_enrollment_pct),
  }));
}

export async function getInstitutionDetail(unitid: string | number): Promise<InstitutionDetail> {
  const detail = await getJSON<any>(`/data/institutions/${unitid}.json`);
  const profile = detail.profile ?? {};
  const outcomes = profile.outcomes ?? {};
  // Flatten support_notes object to string[] for display compatibility
  const supportNotesObj = detail.support_notes ?? {};
  const support_notes: string[] = Object.entries(supportNotesObj)
    .filter(([, v]) => v != null && String(v).trim() !== "")
    .map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`);

  let website: string | null | undefined = profile.website;
  let admissions_url: string | null | undefined = profile.admissions_url;
  let financial_aid_url: string | null | undefined = profile.financial_aid_url;

  try {
    const sitesMap = await getInstitutionSitesMap();
    const sites = sitesMap.get(Number(profile.unitid));
    if (sites) {
      if (!website && sites.website) website = sites.website;
      if (!admissions_url && sites.admissions_url) admissions_url = sites.admissions_url;
      if (!financial_aid_url && sites.financial_aid_url) financial_aid_url = sites.financial_aid_url;
    }
  } catch {
    // fall back to detail file values only
  }

  return {
    profile: {
      unitid: profile.unitid,
      name: profile.name,
      city: profile.city,
      state: profile.state,
      control: profile.control,
      level: profile.level,
      carnegie_basic: profile.carnegie_basic,
      website: website ?? "",
      admissions_url: admissions_url ?? null,
      financial_aid_url: financial_aid_url ?? null,
      test_policy: profile.test_policy,
      major_families: Array.isArray(profile.major_families) ? profile.major_families : [],
      intl_enrollment_pct: pctToDecimal(profile.intl_enrollment_pct),
      tuition_summary: {
        sticker: profile.tuition_summary?.sticker ?? null,
        in_state: profile.tuition_summary?.in_state ?? null,
        out_of_state: profile.tuition_summary?.out_of_state ?? null,
      },
      outcomes: {
        acceptance_rate: pctToDecimal(outcomes.acceptance_rate),
        yield: pctToDecimal(outcomes.yield),
        grad_rate_6yr: pctToDecimal(outcomes.grad_rate_6yr),
        retention_full_time: pctToDecimal(outcomes.retention_full_time),
        student_faculty_ratio: outcomes.student_faculty_ratio ?? null,
        total_enrollment: outcomes.total_enrollment ?? null,
      },
    },
    requirements: detail.requirements ?? {
      required: [],
      considered: [],
      not_considered: [],
      test_policy: profile.test_policy ?? "",
    },
    support_notes,
  } as InstitutionDetail;
}

export async function getInstitutionMetrics(unitid: string | number): Promise<InstitutionMetrics> {
  const data = await getJSON<any>(`/data/metrics/${unitid}.json`);
  const metrics = Array.isArray(data.metrics) ? data.metrics : [];
  const tuition = Array.isArray(data.tuition) ? data.tuition : [];
  return {
    metrics: metrics.map((m: any) => ({
      year: m.year,
      applicants_total: m.applicants_total,
      admissions_total: m.admissions_total ?? undefined,
      admitted_est: m.admitted_est ?? undefined,
      enrolled_total: m.enrolled_total ?? undefined,
      enrolled_est: m.enrolled_est ?? undefined,
      percent_admitted_total: m.percent_admitted_total,
      admissions_yield_total: m.admissions_yield_total,
      sat_evidence_based_reading_and_writing_25th_percentile_score: m.sat_evidence_based_reading_and_writing_25th_percentile_score,
      sat_evidence_based_reading_and_writing_50th_percentile_score: m.sat_evidence_based_reading_and_writing_50th_percentile_score,
      sat_evidence_based_reading_and_writing_75th_percentile_score: m.sat_evidence_based_reading_and_writing_75th_percentile_score,
      sat_math_25th_percentile_score: m.sat_math_25th_percentile_score,
      sat_math_50th_percentile_score: m.sat_math_50th_percentile_score,
      sat_math_75th_percentile_score: m.sat_math_75th_percentile_score,
      act_composite_25th_percentile_score: m.act_composite_25th_percentile_score,
      act_composite_50th_percentile_score: m.act_composite_50th_percentile_score,
      act_composite_75th_percentile_score: m.act_composite_75th_percentile_score,
      percent_of_first_time_degree_certificate_seeking_students_submitting_sat_scores: m.percent_of_first_time_degree_certificate_seeking_students_submitting_sat_scores,
      number_of_first_time_degree_certificate_seeking_students_submitting_sat_scores: m.number_of_first_time_degree_certificate_seeking_students_submitting_sat_scores,
      percent_of_first_time_degree_certificate_seeking_students_submitting_act_scores: m.percent_of_first_time_degree_certificate_seeking_students_submitting_act_scores,
      number_of_first_time_degree_certificate_seeking_students_submitting_act_scores: m.number_of_first_time_degree_certificate_seeking_students_submitting_act_scores,
    })),
    tuition: tuition.map((t: any) => ({
      tuition_year: t.tuition_year,
      tuition_out_of_state: t.tuition_out_of_state ?? undefined,
      tuition_and_fees: t.tuition_and_fees ?? undefined,
    })),
  } as InstitutionMetrics;
}

export async function getMajorsMeta(): Promise<MajorsMeta> {
  return getJSON<MajorsMeta>("/data/majors_bachelor_meta.json");
}

export async function getMajorsByInstitution(): Promise<InstitutionMajorsByInstitution> {
  return getJSON<InstitutionMajorsByInstitution>("/data/majors_bachelor_by_institution.json");
}

export async function getInstitutionIndex(): Promise<InstitutionIndex[]> {
  return getJSON<InstitutionIndex[]>("/data/institutions_index.json");
}

export async function getTopUnitIdsByApplicants(limit = 10): Promise<number[]> {
  const rows = await getJSON<any[]>("/data/metrics_by_year.json");
  const latestByUnit = new Map<number, { year: number; applicants: number }>();
  for (const r of rows) {
    if (r.applicants_total == null) continue;
    const u = Number(r.unitid);
    const y = Number(r.year);
    const existing = latestByUnit.get(u);
    if (!existing || y > existing.year) {
      latestByUnit.set(u, { year: y, applicants: Number(r.applicants_total) });
    }
  }
  const sorted = [...latestByUnit.entries()].sort((a, b) => b[1].applicants - a[1].applicants);
  return sorted.slice(0, limit).map(([unitid]) => unitid);
}

export async function getInstitutionSummary(unitid: number | string): Promise<Institution> {
  const d = await getInstitutionDetail(unitid);
  const p = d.profile;
  return {
    unitid: p.unitid,
    name: p.name,
    city: p.city,
    state: p.state,
    control: p.control,
    level: p.level,
    acceptance_rate: p.outcomes.acceptance_rate,
    yield: p.outcomes.yield,
    test_policy: p.test_policy,
    major_families: p.major_families,
    tuition_2023_24_in_state: p.tuition_summary.in_state ?? undefined,
    tuition_2023_24_out_of_state: p.tuition_summary.out_of_state ?? undefined,
    tuition_2023_24: p.tuition_summary.sticker ?? undefined,
    intl_enrollment_pct: p.intl_enrollment_pct,
  } as Institution;
}

export async function getInstitutionsSummariesByIds(ids: Array<number | string>): Promise<Institution[]> {
  const promises = ids.map((id) => getInstitutionSummary(id));
  return Promise.all(promises);
}
