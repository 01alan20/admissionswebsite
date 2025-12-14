import {
  Institution,
  InstitutionDetail,
  InstitutionMetrics,
  InstitutionMajorsByInstitution,
  InstitutionDemographics,
  MajorsMeta,
} from "../types";

export interface InstitutionIndex {
  unitid: number;
  name: string;
  state: string | null;
  city: string | null;
}

const UNIVERSITY_DATA_BASE = "/data/University_data";

const buildDataPath = (base: string, relative: string): string => {
  const rel = relative.startsWith("/") ? relative.slice(1) : relative;
  return `${base.replace(/\/$/, "")}/${rel}`;
};

async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch ${path}: ${res.status}`);
  return res.json() as Promise<T>;
}

async function getText(path: string): Promise<string> {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch ${path}: ${res.status}`);
  return res.text();
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

type LocationEntry = {
  unitid: number;
  location: string | null;
  size?: string | null;
};

export type TestScoreType = "sat" | "act";

export interface InstitutionTestScores {
  sat_total_25?: number | null;
  sat_total_75?: number | null;
  act_composite_25?: number | null;
  act_composite_75?: number | null;
}

const TEST_POLICY_OVERRIDES: Record<number, string> = {
  130794: "Test flexible", // Yale University
};

const applyTestPolicyOverride = (
  unitid: number | null | undefined,
  policy: string | null | undefined
): string => {
  const id = Number(unitid);
  const override = Number.isFinite(id) ? TEST_POLICY_OVERRIDES[id] : undefined;
  const base = (policy ?? "").trim();
  return override ?? base;
};

const normalizeTestPolicy = (
  unitid: number | null | undefined,
  policy: string | null | undefined
): string => {
  const raw = applyTestPolicyOverride(unitid, policy);
  const lower = raw.toLowerCase();
  if (lower.includes("blind") || lower.includes("not considered")) return "Test blind";
  if (lower.includes("flexible") || lower.includes("recommended")) return "Test flexible";
  if (lower.includes("optional")) return "Test optional";
  if (lower.includes("required")) return "Required";
  return raw || "Required";
};

let institutionSitesPromise: Promise<Map<number, InstitutionSites>> | null = null;

async function getInstitutionSitesMap(): Promise<Map<number, InstitutionSites>> {
  if (!institutionSitesPromise) {
    institutionSitesPromise = (async () => {
    const data = await getJSON<any[]>(
      buildDataPath(UNIVERSITY_DATA_BASE, "institutions.json")
    );
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

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

const toNumberOrNull = (value: string | null | undefined): number | null => {
  if (value === null || value === undefined) return null;
  const parsed = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
};

type DemographicColumn = {
  key: InstitutionDemographics["breakdown"][number]["key"];
  header: string;
  label: string;
};

const DEMOGRAPHIC_COLUMNS: DemographicColumn[] = [
  {
    key: "american_indian_or_alaska_native",
    header: "EFFY2024.American Indian or Alaska Native total",
    label: "American Indian or Alaska Native",
  },
  { key: "asian", header: "EFFY2024.Asian total", label: "Asian" },
  {
    key: "black_or_african_american",
    header: "EFFY2024.Black or African American total",
    label: "Black or African American",
  },
  {
    key: "hispanic_or_latino",
    header: "EFFY2024.Hispanic or Latino total",
    label: "Hispanic or Latino",
  },
  {
    key: "native_hawaiian_or_pacific_islander",
    header: "EFFY2024.Native Hawaiian or Other Pacific Islander total",
    label: "Native Hawaiian or Pacific Islander",
  },
  { key: "white", header: "EFFY2024.White total", label: "White" },
  {
    key: "two_or_more_races",
    header: "EFFY2024.Two or more races total",
    label: "Two or more races",
  },
  {
    key: "unknown",
    header: "EFFY2024.Race/ethnicity unknown total",
    label: "Race/ethnicity unknown",
  },
  {
    key: "nonresident",
    header: "EFFY2024.U.S. Nonresident total",
    label: "Nonresident",
  },
];

let undergradDemographicsMapPromise: Promise<Map<number, InstitutionDemographics>> | null = null;

export async function getUndergradDemographicsMap(): Promise<Map<number, InstitutionDemographics>> {
  if (!undergradDemographicsMapPromise) {
    undergradDemographicsMapPromise = (async () => {
      const map = new Map<number, InstitutionDemographics>();
      const paths = [
        buildDataPath(UNIVERSITY_DATA_BASE, "uni_demographics.csv"),
        "/uni_demographics.csv",
      ];
      let csvText: string | null = null;

      for (const path of paths) {
        try {
          csvText = await getText(path);
          break;
        } catch {
          // try next path
        }
      }

      if (!csvText) return map;
      const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length <= 1) return map;

  const headerCols = parseCsvLine(lines[0]);
  const headerLookup = new Map<string, number>();
  headerCols.forEach((h, idx) => headerLookup.set(h.trim().toLowerCase(), idx));
  const getIdx = (name: string) => headerLookup.get(name.toLowerCase()) ?? -1;

  const unitidIdx = getIdx("unitid");
  const yearIdx = getIdx("year");
  const levelIdx = getIdx("effy2024.level and degree/certificate-seeking status of student");
  const ugGradIdx = getIdx("effy2024.undergraduate or graduate level of student");
  const totalIdx = getIdx("effy2024.grand total");
  const menIdx = getIdx("effy2024.grand total men");
  const womenIdx = getIdx("effy2024.grand total women");

      if (unitidIdx === -1 || totalIdx === -1) return map;

      const columnIndexByKey = DEMOGRAPHIC_COLUMNS.reduce<Record<string, number>>((acc, col) => {
        acc[col.key] = getIdx(col.header);
        return acc;
      }, {});

      for (let i = 1; i < lines.length; i++) {
        const row = lines[i];
        if (!row.trim()) continue;
        const cols = parseCsvLine(row);
        if (cols.length <= Math.max(unitidIdx, totalIdx)) continue;

        const levelRaw = levelIdx !== -1 ? cols[levelIdx]?.trim().toLowerCase() : "";
        const levelType = ugGradIdx !== -1 ? cols[ugGradIdx]?.trim().toLowerCase() : "";
        const isUndergradRow =
          levelRaw.includes("all students, undergraduate total") ||
          (levelType === "undergraduate" && levelRaw.includes("undergraduate"));

        if (!isUndergradRow) continue;

        const unitid = Number(cols[unitidIdx]);
        if (!Number.isFinite(unitid)) continue;

        const total = toNumberOrNull(cols[totalIdx]);
        if (total == null || total <= 0) continue;

        const yearVal = yearIdx !== -1 ? Number(cols[yearIdx]) : NaN;
        const currentYear = Number.isFinite(yearVal) ? yearVal : null;

        const breakdown = DEMOGRAPHIC_COLUMNS.map((col) => {
          const idx = columnIndexByKey[col.key];
          const count = idx != null && idx >= 0 ? toNumberOrNull(cols[idx]) : null;
          const percent =
            total > 0 && count != null
              ? (count / total) * 100
              : count === 0
              ? 0
              : null;
          return { key: col.key, label: col.label, percent, count };
        });

        const totalMen = menIdx !== -1 ? toNumberOrNull(cols[menIdx]) : null;
        const totalWomen = womenIdx !== -1 ? toNumberOrNull(cols[womenIdx]) : null;

        const entry: InstitutionDemographics = {
          unitid,
          year: currentYear,
          total_undergrad: total,
          total_undergrad_men: totalMen,
          total_undergrad_women: totalWomen,
          breakdown,
        };

        const existing = map.get(unitid);
        if (!existing || (entry.year ?? -Infinity) > (existing.year ?? -Infinity)) {
          map.set(unitid, entry);
        }
      }

      return map;
    })();
  }
  return undergradDemographicsMapPromise;
}

export async function getInstitutionDemographics(
  unitid: number | string
): Promise<InstitutionDemographics | null> {
  const id = Number(unitid);
  if (!Number.isFinite(id)) return null;
  const map = await getUndergradDemographicsMap();
  return map.get(id) ?? null;
}

let locationTypeMapPromise: Promise<Map<number, string>> | null = null;
let institutionTestScoreMapPromise: Promise<Map<number, InstitutionTestScores>> | null = null;

export async function getLocationTypeMap(): Promise<Map<number, string>> {
  if (!locationTypeMapPromise) {
    locationTypeMapPromise = (async () => {
      const map = new Map<number, string>();
      const normalizeEntry = (entry: LocationEntry) => {
        const id = Number(entry.unitid);
        if (!Number.isFinite(id)) return;
        const loc = (entry.location ?? "").trim();
        if (!loc) return;
        map.set(id, loc);
      };

        const jsonPaths = [
          buildDataPath(UNIVERSITY_DATA_BASE, "uni_location_size.json"),
          "/uni_location_size.json",
        ];
      for (const path of jsonPaths) {
        try {
          const data = await getJSON<LocationEntry[]>(path);
          if (Array.isArray(data) && data.length > 0) {
            data.forEach(normalizeEntry);
          }
          if (map.size > 0) return map;
        } catch {
          // try next path
        }
      }

      // Fallback to CSV parsing for older deployments
        const csvPaths = [
          buildDataPath(UNIVERSITY_DATA_BASE, "uni_location_size.csv"),
          "/uni_location_size.csv",
        ];
      for (const path of csvPaths) {
        try {
          const text = await getText(path);
          const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
          if (lines.length <= 1) continue;

          const headerCols = parseCsvLine(lines[0]);
          const unitidIdx = headerCols.findIndex((h) => h.trim().toLowerCase() === "unitid");
          const locationIdx = headerCols.findIndex((h) => h.trim().toLowerCase() === "unilocation");
          if (unitidIdx === -1 || locationIdx === -1) continue;

          for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            if (!line.trim()) continue;
            const cols = parseCsvLine(line);
            if (cols.length <= Math.max(unitidIdx, locationIdx)) continue;
            const id = Number(cols[unitidIdx]);
            if (!Number.isFinite(id)) continue;
            const locRaw = cols[locationIdx].trim();
            if (!locRaw) continue;
            map.set(id, locRaw);
          }

          if (map.size > 0) break;
        } catch {
          // try next path
        }
      }

      return map;
    })();
  }
  return locationTypeMapPromise;
}

export async function getInstitutionTestScoreMap(): Promise<Map<number, InstitutionTestScores>> {
  if (!institutionTestScoreMapPromise) {
    institutionTestScoreMapPromise = (async () => {
        const rows = await getJSON<any[]>(
          buildDataPath(UNIVERSITY_DATA_BASE, "metrics_by_year.json")
        );
      const latestByUnit = new Map<number, any>();

      for (const r of rows) {
        const unitid = Number(r.unitid);
        const year = Number(r.year);
        if (!Number.isFinite(unitid) || !Number.isFinite(year)) continue;
        const existing = latestByUnit.get(unitid);
        if (!existing || year > existing.year) {
          latestByUnit.set(unitid, r);
        }
      }

      const map = new Map<number, InstitutionTestScores>();
      for (const [unitid, r] of latestByUnit.entries()) {
        const satEbrw25 = r.sat_evidence_based_reading_and_writing_25th_percentile_score;
        const satMath25 = r.sat_math_25th_percentile_score;
        const satEbrw75 = r.sat_evidence_based_reading_and_writing_75th_percentile_score;
        const satMath75 = r.sat_math_75th_percentile_score;

        const sat_total_25 =
          satEbrw25 != null && satMath25 != null
            ? Number(satEbrw25) + Number(satMath25)
            : null;
        const sat_total_75 =
          satEbrw75 != null && satMath75 != null
            ? Number(satEbrw75) + Number(satMath75)
            : null;

        const act_composite_25 =
          r.act_composite_25th_percentile_score != null
            ? Number(r.act_composite_25th_percentile_score)
            : null;
        const act_composite_75 =
          r.act_composite_75th_percentile_score != null
            ? Number(r.act_composite_75th_percentile_score)
            : null;

        if (
          sat_total_25 != null ||
          sat_total_75 != null ||
          act_composite_25 != null ||
          act_composite_75 != null
        ) {
          map.set(unitid, {
            sat_total_25,
            sat_total_75,
            act_composite_25,
            act_composite_75,
          });
        }
      }

      return map;
    })();
  }
  return institutionTestScoreMapPromise;
}

export async function getAllInstitutions(): Promise<Institution[]> {
  const data = await getJSON<any[]>(
    buildDataPath(UNIVERSITY_DATA_BASE, "institutions.json")
  );
  return data.map((d) => {
    const unitid = Number(d.unitid);
    return {
      unitid,
      name: d.name,
      city: d.city,
      state: d.state,
      control: d.control,
      level: d.level,
      acceptance_rate: pctToDecimal(d.acceptance_rate),
      yield: pctToDecimal(d.yield),
      test_policy: normalizeTestPolicy(unitid, d.test_policy),
      major_families: Array.isArray(d.major_families) ? d.major_families : [],
      majors_cip_two_digit: Array.isArray(d.majors_cip_two_digit) ? d.majors_cip_two_digit : undefined,
      majors_cip_four_digit: Array.isArray(d.majors_cip_four_digit) ? d.majors_cip_four_digit : undefined,
      majors_cip_six_digit: Array.isArray(d.majors_cip_six_digit) ? d.majors_cip_six_digit : undefined,
      tuition_2023_24_in_state: d.tuition_2023_24_in_state ?? undefined,
      tuition_2023_24_out_of_state: d.tuition_2023_24_out_of_state ?? undefined,
      tuition_2023_24: d.tuition_2023_24 ?? undefined,
      intl_enrollment_pct: pctToDecimal(d.intl_enrollment_pct),
    };
  });
}

export async function getInstitutionDetail(
  unitid: string | number
): Promise<InstitutionDetail> {
  const detail = await getJSON<any>(
    buildDataPath(UNIVERSITY_DATA_BASE, `institutions/${unitid}.json`)
  );
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
  const unitIdNum = Number(profile.unitid);
  const testPolicy = normalizeTestPolicy(unitIdNum, profile.test_policy);

  try {
    const sitesMap = await getInstitutionSitesMap();
    const sites = sitesMap.get(unitIdNum);
    if (sites) {
      if (!website && sites.website) website = sites.website;
      if (!admissions_url && sites.admissions_url) admissions_url = sites.admissions_url;
      if (!financial_aid_url && sites.financial_aid_url) financial_aid_url = sites.financial_aid_url;
    }
  } catch {
    // fall back to detail file values only
  }

  const requirementsRaw = detail.requirements ?? {
    required: [],
    considered: [],
    not_considered: [],
    test_policy: testPolicy ?? "",
  };
  const requirements = {
    ...requirementsRaw,
    test_policy: normalizeTestPolicy(unitIdNum, requirementsRaw.test_policy || testPolicy),
  };

  return {
    profile: {
      unitid: unitIdNum,
      name: profile.name,
      city: profile.city,
      state: profile.state,
      control: profile.control,
      level: profile.level,
      carnegie_basic: profile.carnegie_basic,
      website: website ?? "",
      admissions_url: admissions_url ?? null,
      financial_aid_url: financial_aid_url ?? null,
      test_policy: testPolicy,
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
    requirements,
    support_notes,
  } as InstitutionDetail;
}

export async function getInstitutionMetrics(
  unitid: string | number
): Promise<InstitutionMetrics> {
  const data = await getJSON<any>(
    buildDataPath(UNIVERSITY_DATA_BASE, `metrics/${unitid}.json`)
  );
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
  return getJSON<MajorsMeta>(
    buildDataPath(UNIVERSITY_DATA_BASE, "majors_bachelor_meta.json")
  );
}

export async function getMajorsByInstitution(): Promise<InstitutionMajorsByInstitution> {
  return getJSON<InstitutionMajorsByInstitution>(
    buildDataPath(UNIVERSITY_DATA_BASE, "majors_bachelor_by_institution.json")
  );
}

export async function getInstitutionIndex(): Promise<InstitutionIndex[]> {
  try {
    const data = await getJSON<InstitutionIndex[]>(
      buildDataPath(UNIVERSITY_DATA_BASE, "institutions_index.json")
    );
    if (Array.isArray(data) && data.length > 0) {
      return data;
    }
  } catch {
    // Fall through to synthesize from full institutions.
  }

  // Fallback: build a minimal index from the full institutions list so that
  // search and onboarding still work even if the compact index file is missing
  // or fails to load in production.
  const all = await getAllInstitutions();
  return all.map((d) => ({
    unitid: d.unitid,
    name: d.name,
    city: d.city,
    state: d.state,
  }));
}

export async function getTopUnitIdsByApplicants(limit = 10): Promise<number[]> {
  const rows = await getJSON<any[]>(
    buildDataPath(UNIVERSITY_DATA_BASE, "metrics_by_year.json")
  );
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
