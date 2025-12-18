import {
  Institution,
  InstitutionDetail,
  InstitutionMetrics,
  InstitutionMajorsByInstitution,
  InstitutionDemographics,
  MajorsMeta,
  SuccessApplicationProfile,
  AnonymousEssayEntry,
} from "../types";
import { supabase } from "../services/supabaseClient";

export interface InstitutionIndex {
  unitid: number;
  name: string;
  state: string | null;
  city: string | null;
}

const VITE_BASE_URL: string = ((import.meta as any).env?.BASE_URL as string) || "/";
const IS_DEV = Boolean((import.meta as any).env?.DEV);
const joinBase = (base: string, relative: string): string =>
  `${base.replace(/\/$/, "")}/${relative.replace(/^\//, "")}`;

// These paths are only used as a fallback when Supabase data isn't available.
const UNIVERSITY_DATA_BASE = joinBase(VITE_BASE_URL, "data/University_data");
const APPLICANT_DATA_BASE = joinBase(VITE_BASE_URL, "data/Applicant_Data");

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

const normalizeExternalUrl = (value: string | null | undefined): string | null => {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("//")) return `https:${raw}`;
  return `https://${raw}`;
};

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
      try {
        const rows = await supabaseFetchAll<any>((from, to) =>
          supabase
            .from("institutions")
            .select("unitid, website, admissions_url, financial_aid_url")
            .range(from, to)
        );
        const map = new Map<number, InstitutionSites>();
        for (const d of rows) {
          const id = Number(d.unitid);
          if (!Number.isFinite(id)) continue;
          map.set(id, {
            website: d.website ?? null,
            admissions_url: d.admissions_url ?? null,
            financial_aid_url: d.financial_aid_url ?? null,
          });
        }
        if (map.size > 0) return map;
        if (!IS_DEV) {
          throw new Error(
            "Supabase returned 0 institutions for sites. Check RLS policies for `public.institutions` (anon select must be allowed)."
          );
        }
      } catch (e) {
        if (!IS_DEV) throw e;
        // Fall back to local JSON (dev only).
      }

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

const toNumberOrNullAny = (value: any): number | null => {
  if (value === null || value === undefined) return null;
  const parsed = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
};

async function supabaseFetchAll<T>(
  build: (from: number, to: number) => any,
  pageSize = 1000
): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1;
    const { data, error } = await build(from, to);
    if (error) throw error;
    const chunk = (data ?? []) as T[];
    all.push(...chunk);
    if (chunk.length < pageSize) break;
  }
  return all;
}

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
let applicantsMapPromise: Promise<Map<number, number>> | null = null;
let locationTypeMapPromise: Promise<Map<number, string>> | null = null;
let institutionTestScoreMapPromise: Promise<Map<number, InstitutionTestScores>> | null = null;
let allInstitutionsPromise: Promise<Institution[]> | null = null;
let institutionIndexPromise: Promise<InstitutionIndex[]> | null = null;
let topApplicantsPromise: Promise<number[]> | null = null;

export async function getUndergradDemographicsMap(): Promise<Map<number, InstitutionDemographics>> {
  if (!undergradDemographicsMapPromise) {
    undergradDemographicsMapPromise = (async () => {
      const map = new Map<number, InstitutionDemographics>();

      try {
        const rows = await supabaseFetchAll<any>((from, to) =>
          supabase
            .from("institution_demographics")
            .select(
              "unitid, year, total_undergrad, total_undergrad_men, total_undergrad_women, group_key, count, percent"
            )
            .range(from, to)
        );

        for (const r of rows) {
          const unitid = Number(r.unitid);
          if (!Number.isFinite(unitid)) continue;

          const key = String(r.group_key ?? "").trim();
          if (!key) continue;

          const existing =
            map.get(unitid) ??
            ({
              unitid,
              year: toNumberOrNullAny(r.year),
              total_undergrad: toNumberOrNullAny(r.total_undergrad),
              total_undergrad_men: toNumberOrNullAny(r.total_undergrad_men) ?? undefined,
              total_undergrad_women: toNumberOrNullAny(r.total_undergrad_women) ?? undefined,
              breakdown: [],
            } as InstitutionDemographics);

          const label = DEMOGRAPHIC_COLUMNS.find((c) => c.key === (key as any))?.label ?? key;

          existing.breakdown.push({
            key: key as any,
            label,
            percent: toNumberOrNullAny(r.percent),
            count: toNumberOrNullAny(r.count),
          });

          map.set(unitid, existing);
        }

        if (map.size > 0) return map;
        if (!IS_DEV) return map;
      } catch (e) {
        if (!IS_DEV) return map;
        // fall through to CSV parsing (dev only)
      }

      if (!IS_DEV) return map;

      const paths = [
        buildDataPath(UNIVERSITY_DATA_BASE, "uni_demographics.csv"),
        joinBase(VITE_BASE_URL, "uni_demographics.csv"),
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

export async function getLatestApplicantsMap(): Promise<Map<number, number>> {
  if (!applicantsMapPromise) {
    applicantsMapPromise = (async () => {
      try {
        const rows = await supabaseFetchAll<any>((from, to) =>
          supabase
            .from("top_applicants_latest")
            .select("unitid, applicants_total")
            .order("applicants_total", { ascending: false })
            .range(from, to)
        );
        const map = new Map<number, number>();
        for (const r of rows) {
          const unitid = Number(r.unitid);
          const applicants = toNumberOrNullAny(r.applicants_total);
          if (!Number.isFinite(unitid) || applicants == null) continue;
          map.set(unitid, applicants);
        }
        if (map.size > 0) return map;
      } catch (e) {
        if (IS_DEV) {
          // fall through to JSON parsing (dev only)
        } else {
          // If the matview isn't exposed (missing grants/schema cache), fall back to a
          // lightweight proxy ordering using institutions.total_enrollment.
          try {
            const rows = await supabaseFetchAll<any>((from, to) =>
              supabase.from("institutions").select("unitid, total_enrollment").range(from, to)
            );
            const map = new Map<number, number>();
            for (const r of rows) {
              const unitid = Number(r.unitid);
              const applicants = toNumberOrNullAny(r.total_enrollment);
              if (!Number.isFinite(unitid) || applicants == null) continue;
              map.set(unitid, applicants);
            }
            return map;
          } catch {
            return new Map<number, number>();
          }
        }
      }

      if (!IS_DEV) {
        // Matview returned 0 rows; keep the app working using a proxy value.
        try {
          const rows = await supabaseFetchAll<any>((from, to) =>
            supabase.from("institutions").select("unitid, total_enrollment").range(from, to)
          );
          const map = new Map<number, number>();
          for (const r of rows) {
            const unitid = Number(r.unitid);
            const applicants = toNumberOrNullAny(r.total_enrollment);
            if (!Number.isFinite(unitid) || applicants == null) continue;
            map.set(unitid, applicants);
          }
          return map;
        } catch {
          return new Map<number, number>();
        }
      }

      const rows = await getJSON<any[]>(
        buildDataPath(UNIVERSITY_DATA_BASE, "metrics_by_year.json")
      );
      const latestByUnit = new Map<number, { year: number; applicants: number }>();
      for (const r of rows) {
        if (r.applicants_total == null) continue;
        const u = Number(r.unitid);
        const y = Number(r.year);
        const a = Number(r.applicants_total);
        if (!Number.isFinite(u) || !Number.isFinite(y) || !Number.isFinite(a)) continue;
        const existing = latestByUnit.get(u);
        if (!existing || y > existing.year) {
          latestByUnit.set(u, { year: y, applicants: a });
        }
      }
      const map = new Map<number, number>();
      for (const [unitid, { applicants }] of latestByUnit.entries()) {
        map.set(unitid, applicants);
      }
      return map;
    })();
  }
  return applicantsMapPromise;
}

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

      try {
        const rows = await supabaseFetchAll<any>((from, to) =>
          supabase
            .from("institution_locations")
            .select("unitid, location_type")
            .range(from, to)
        );
        for (const r of rows) {
          const id = Number(r.unitid);
          if (!Number.isFinite(id)) continue;
          const loc = (r.location_type ?? "").toString().trim();
          if (!loc) continue;
          map.set(id, loc);
        }
        if (map.size > 0) return map;
      } catch (e) {
        if (!IS_DEV) return map;
        // fall through to JSON/CSV parsing (dev only)
      }

      if (!IS_DEV) return map;

      const jsonPaths = [
        buildDataPath(UNIVERSITY_DATA_BASE, "uni_location_size.json"),
        joinBase(VITE_BASE_URL, "uni_location_size.json"),
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
        joinBase(VITE_BASE_URL, "uni_location_size.csv"),
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
      let rows: any[] = [];
      try {
        rows = await supabaseFetchAll<any>((from, to) =>
          supabase
            .from("institution_metrics")
            .select(
              "unitid, year, sat_evidence_based_reading_and_writing_25th_percentile_score, sat_evidence_based_reading_and_writing_75th_percentile_score, sat_math_25th_percentile_score, sat_math_75th_percentile_score, act_composite_25th_percentile_score, act_composite_75th_percentile_score"
            )
            .range(from, to)
        );
      } catch (e) {
        if (!IS_DEV) return new Map<number, InstitutionTestScores>();
        rows = await getJSON<any[]>(buildDataPath(UNIVERSITY_DATA_BASE, "metrics_by_year.json"));
      }
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
  if (!allInstitutionsPromise) {
    allInstitutionsPromise = (async () => {
      try {
        const rows = await supabaseFetchAll<any>((from, to) =>
          supabase
            .from("institutions")
            .select(
              "unitid, name, city, state, control, level, acceptance_rate, yield, test_policy, major_families, tuition_2023_24_in_state, tuition_2023_24_out_of_state, tuition_2023_24, intl_enrollment_pct"
            )
            .range(from, to)
        );
        if (Array.isArray(rows) && rows.length > 0) {
          return rows.map((d) => {
            const unitid = Number(d.unitid);
            return {
              unitid,
              name: d.name,
              city: d.city,
              state: d.state,
              control: d.control,
              level: d.level,
              acceptance_rate: pctToDecimal(toNumberOrNullAny(d.acceptance_rate)),
              yield: pctToDecimal(toNumberOrNullAny(d.yield)),
              test_policy: normalizeTestPolicy(unitid, d.test_policy),
              major_families: Array.isArray(d.major_families) ? d.major_families : [],
              tuition_2023_24_in_state: toNumberOrNullAny(d.tuition_2023_24_in_state) ?? undefined,
              tuition_2023_24_out_of_state: toNumberOrNullAny(d.tuition_2023_24_out_of_state) ?? undefined,
              tuition_2023_24: toNumberOrNullAny(d.tuition_2023_24) ?? undefined,
              intl_enrollment_pct: pctToDecimal(toNumberOrNullAny(d.intl_enrollment_pct)),
            } as Institution;
          });
        }
        if (Array.isArray(rows) && rows.length === 0 && !IS_DEV) {
          throw new Error(
            "Supabase returned 0 institutions. Check RLS policies for `public.institutions` (anon select must be allowed)."
          );
        }
      } catch (e) {
        if (!IS_DEV) throw e;
      }

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
        } as Institution;
      });
    })();
  }
  return allInstitutionsPromise;
}

export async function getInstitutionDetail(
  unitid: string | number
): Promise<InstitutionDetail> {
  const requestedId = Number(unitid);

  try {
    const { data: inst, error: instErr } = await supabase
      .from("institutions")
      .select(
        "unitid, name, city, state, control, level, carnegie_basic, website, admissions_url, financial_aid_url, test_policy, major_families, intl_enrollment_pct, tuition_2023_24, tuition_2023_24_in_state, tuition_2023_24_out_of_state, acceptance_rate, yield, grad_rate_6yr, full_time_retention_rate, student_to_faculty_ratio, total_enrollment"
      )
      .eq("unitid", requestedId)
      .maybeSingle();
    if (instErr) throw instErr;
    if (!inst) {
      throw new Error(
        "University data not found (or access denied). Check that the row exists and that RLS allows anon/authenticated selects on `public.institutions`."
      );
    }

    const unitIdNum = Number(inst.unitid);
    const testPolicy = normalizeTestPolicy(unitIdNum, inst.test_policy);

    const { data: req } = await supabase
      .from("institution_requirements")
      .select("required, considered, not_considered, test_policy")
      .eq("unitid", unitIdNum)
      .maybeSingle();

    const { data: notes } = await supabase
      .from("institution_support_notes")
      .select("key, note")
      .eq("unitid", unitIdNum);

    const support_notes: string[] = Array.isArray(notes)
      ? notes
          .filter((n: any) => n?.note != null && String(n.note).trim() !== "")
          .map((n: any) => {
            const k = String(n.key ?? "").replace(/_/g, " ").trim();
            const v = String(n.note ?? "").trim();
            return k ? `${k}: ${v}` : v;
          })
      : [];

    const requirements = {
      required: Array.isArray((req as any)?.required) ? (req as any).required : [],
      considered: Array.isArray((req as any)?.considered) ? (req as any).considered : [],
      not_considered: Array.isArray((req as any)?.not_considered) ? (req as any).not_considered : [],
      test_policy: normalizeTestPolicy(
        unitIdNum,
        ((req as any)?.test_policy as string | null | undefined) || testPolicy
      ),
    };

    return {
      profile: {
        unitid: unitIdNum,
        name: inst.name,
        city: inst.city,
        state: inst.state,
        control: inst.control,
        level: inst.level,
        carnegie_basic: inst.carnegie_basic ?? "",
        website: normalizeExternalUrl(inst.website) ?? "",
        admissions_url: normalizeExternalUrl(inst.admissions_url),
        financial_aid_url: normalizeExternalUrl(inst.financial_aid_url),
        test_policy: testPolicy,
        major_families: Array.isArray(inst.major_families) ? inst.major_families : [],
        intl_enrollment_pct: pctToDecimal(toNumberOrNullAny(inst.intl_enrollment_pct)),
        tuition_summary: {
          sticker: toNumberOrNullAny(inst.tuition_2023_24),
          in_state: toNumberOrNullAny(inst.tuition_2023_24_in_state),
          out_of_state: toNumberOrNullAny(inst.tuition_2023_24_out_of_state),
        },
        outcomes: {
          acceptance_rate: pctToDecimal(toNumberOrNullAny(inst.acceptance_rate)),
          yield: pctToDecimal(toNumberOrNullAny(inst.yield)),
          grad_rate_6yr: pctToDecimal(toNumberOrNullAny(inst.grad_rate_6yr)),
          retention_full_time: pctToDecimal(toNumberOrNullAny(inst.full_time_retention_rate)),
          student_faculty_ratio: toNumberOrNullAny(inst.student_to_faculty_ratio),
          total_enrollment: toNumberOrNullAny(inst.total_enrollment),
        },
      },
      requirements,
      support_notes,
    } as InstitutionDetail;
  } catch (e) {
    if (!IS_DEV) throw e;
    // Fallback to legacy JSON detail file (dev only).
    const detail = await getJSON<any>(
      buildDataPath(UNIVERSITY_DATA_BASE, `institutions/${unitid}.json`)
    );
    const profile = detail.profile ?? {};
    const outcomes = profile.outcomes ?? {};
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
      // ignore
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
        website: normalizeExternalUrl(website) ?? "",
        admissions_url: normalizeExternalUrl(admissions_url),
        financial_aid_url: normalizeExternalUrl(financial_aid_url),
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
}

export async function getInstitutionMetrics(
  unitid: string | number
): Promise<InstitutionMetrics> {
  const id = Number(unitid);
  try {
    const { data: metricRows, error: metricErr } = await supabase
      .from("institution_metrics")
      .select(
        "year, applicants_total, admissions_total, admitted_est, enrolled_total, enrolled_est, percent_admitted_total, admissions_yield_total, sat_evidence_based_reading_and_writing_25th_percentile_score, sat_evidence_based_reading_and_writing_50th_percentile_score, sat_evidence_based_reading_and_writing_75th_percentile_score, sat_math_25th_percentile_score, sat_math_50th_percentile_score, sat_math_75th_percentile_score, act_composite_25th_percentile_score, act_composite_50th_percentile_score, act_composite_75th_percentile_score, sat_submitters_percent, sat_submitters_count, act_submitters_percent, act_submitters_count"
      )
      .eq("unitid", id)
      .order("year", { ascending: false });
    if (metricErr) throw metricErr;

    const { data: inst } = await supabase
      .from("institutions")
      .select("tuition_2023_24, tuition_2023_24_out_of_state")
      .eq("unitid", id)
      .maybeSingle();

    const tuition =
      inst && (inst.tuition_2023_24 != null || inst.tuition_2023_24_out_of_state != null)
        ? [
            {
              tuition_year: "2023-24",
              tuition_out_of_state: toNumberOrNullAny(inst.tuition_2023_24_out_of_state) ?? undefined,
              tuition_and_fees: toNumberOrNullAny(inst.tuition_2023_24) ?? undefined,
            },
          ]
        : [];

    const metrics = (metricRows ?? []).map((m: any) => ({
      year: toNumberOrNullAny(m.year) ?? 0,
      applicants_total: toNumberOrNullAny(m.applicants_total) ?? 0,
      admissions_total: toNumberOrNullAny(m.admissions_total) ?? undefined,
      admitted_est: toNumberOrNullAny(m.admitted_est) ?? undefined,
      enrolled_total: toNumberOrNullAny(m.enrolled_total) ?? undefined,
      enrolled_est: toNumberOrNullAny(m.enrolled_est) ?? undefined,
      percent_admitted_total: pctToDecimal(toNumberOrNullAny(m.percent_admitted_total)) ?? 0,
      admissions_yield_total: pctToDecimal(toNumberOrNullAny(m.admissions_yield_total)) ?? 0,
      sat_evidence_based_reading_and_writing_25th_percentile_score:
        toNumberOrNullAny(m.sat_evidence_based_reading_and_writing_25th_percentile_score),
      sat_evidence_based_reading_and_writing_50th_percentile_score:
        toNumberOrNullAny(m.sat_evidence_based_reading_and_writing_50th_percentile_score),
      sat_evidence_based_reading_and_writing_75th_percentile_score:
        toNumberOrNullAny(m.sat_evidence_based_reading_and_writing_75th_percentile_score),
      sat_math_25th_percentile_score: toNumberOrNullAny(m.sat_math_25th_percentile_score),
      sat_math_50th_percentile_score: toNumberOrNullAny(m.sat_math_50th_percentile_score),
      sat_math_75th_percentile_score: toNumberOrNullAny(m.sat_math_75th_percentile_score),
      act_composite_25th_percentile_score: toNumberOrNullAny(m.act_composite_25th_percentile_score),
      act_composite_50th_percentile_score: toNumberOrNullAny(m.act_composite_50th_percentile_score),
      act_composite_75th_percentile_score: toNumberOrNullAny(m.act_composite_75th_percentile_score),
      percent_of_first_time_degree_certificate_seeking_students_submitting_sat_scores:
        toNumberOrNullAny(m.sat_submitters_percent),
      number_of_first_time_degree_certificate_seeking_students_submitting_sat_scores:
        toNumberOrNullAny(m.sat_submitters_count),
      percent_of_first_time_degree_certificate_seeking_students_submitting_act_scores:
        toNumberOrNullAny(m.act_submitters_percent),
      number_of_first_time_degree_certificate_seeking_students_submitting_act_scores:
        toNumberOrNullAny(m.act_submitters_count),
    }));

    return { metrics, tuition } as InstitutionMetrics;
  } catch (e) {
    if (!IS_DEV) throw e;
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
}

export async function getMajorsMeta(): Promise<MajorsMeta> {
  try {
    const rows = await supabaseFetchAll<any>((from, to) =>
      supabase.from("majors_meta").select("cip_code, cip_level, title").range(from, to)
    );
    const meta: MajorsMeta = { two_digit: {}, four_digit: {}, six_digit: {} };
    for (const r of rows) {
      const code = String(r.cip_code ?? "").trim();
      const level = String(r.cip_level ?? "").trim().toLowerCase();
      const title = String(r.title ?? "").trim();
      if (!code || !title) continue;
      if (level.includes("2")) meta.two_digit[code] = title;
      else if (level.includes("4")) meta.four_digit[code] = title;
      else if (level.includes("6")) meta.six_digit[code] = title;
    }
    if (
      Object.keys(meta.two_digit).length ||
      Object.keys(meta.four_digit).length ||
      Object.keys(meta.six_digit).length
    ) {
      return meta;
    }

    if (!IS_DEV) {
      throw new Error(
        "Supabase returned 0 majors. Check RLS policies for `public.majors_meta` (anon select must be allowed)."
      );
    }
  } catch (e) {
    if (!IS_DEV) throw e;
  }

  return getJSON<MajorsMeta>(
    buildDataPath(UNIVERSITY_DATA_BASE, "majors_bachelor_meta.json")
  );
}

export async function getMajorsByInstitution(): Promise<InstitutionMajorsByInstitution> {
  try {
    const rows = await supabaseFetchAll<any>((from, to) =>
      supabase.from("institution_majors").select("unitid, cip_level, cip_code").range(from, to)
    );
    const result: InstitutionMajorsByInstitution = {};
    for (const r of rows) {
      const unitid = Number(r.unitid);
      if (!Number.isFinite(unitid)) continue;
      const level = String(r.cip_level ?? "").toLowerCase();
      const code = String(r.cip_code ?? "").trim();
      if (!code) continue;
      if (!result[String(unitid)]) {
        result[String(unitid)] = { two_digit: [], four_digit: [], six_digit: [] };
      }
      if (level.includes("2")) result[String(unitid)].two_digit.push(code);
      else if (level.includes("4")) result[String(unitid)].four_digit.push(code);
      else if (level.includes("6")) result[String(unitid)].six_digit.push(code);
    }
    if (Object.keys(result).length) return result;

    if (!IS_DEV) {
      throw new Error(
        "Supabase returned 0 institution majors. Check RLS policies for `public.institution_majors` (anon select must be allowed)."
      );
    }
  } catch (e) {
    if (!IS_DEV) throw e;
  }

  return getJSON<InstitutionMajorsByInstitution>(
    buildDataPath(UNIVERSITY_DATA_BASE, "majors_bachelor_by_institution.json")
  );
}

export async function getInstitutionIndex(): Promise<InstitutionIndex[]> {
  if (!institutionIndexPromise) {
    institutionIndexPromise = (async () => {
      try {
        const rows = await supabaseFetchAll<any>((from, to) =>
          supabase.from("institutions_index").select("unitid, name, city, state").range(from, to)
        );
        if (Array.isArray(rows) && rows.length > 0) {
          return rows
            .map((r) => ({
              unitid: Number(r.unitid),
              name: String(r.name ?? ""),
              city: r.city ?? null,
              state: r.state ?? null,
            }))
            .filter((r) => Number.isFinite(r.unitid) && r.name);
        }
      } catch (e) {
        // If the index table isn't available, synthesize from institutions (prod),
        // otherwise fall through to JSON / synthesis (dev).
        if (!IS_DEV) {
          const all = await getAllInstitutions();
          return all.map((d) => ({
            unitid: d.unitid,
            name: d.name,
            city: d.city,
            state: d.state,
          }));
        }
      }

      if (!IS_DEV) {
        const all = await getAllInstitutions();
        return all.map((d) => ({
          unitid: d.unitid,
          name: d.name,
          city: d.city,
          state: d.state,
        }));
      }

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

      const all = await getAllInstitutions();
      return all.map((d) => ({
        unitid: d.unitid,
        name: d.name,
        city: d.city,
        state: d.state,
      }));
    })();
  }
  return institutionIndexPromise;
}

export async function getTopUnitIdsByApplicants(limit = 10): Promise<number[]> {
  if (!topApplicantsPromise) {
    topApplicantsPromise = (async () => {
      try {
        const { data, error } = await supabase
          .from("top_applicants_latest")
          .select("unitid")
          .order("applicants_total", { ascending: false })
          .limit(1000);
        if (error) throw error;
        if (Array.isArray(data) && data.length > 0) {
          return data.map((r: any) => Number(r.unitid)).filter(Number.isFinite);
        }
      } catch (e) {
        if (!IS_DEV) {
          // Fall back to a reasonable proxy ordering that is always available.
          try {
            const rows = await supabaseFetchAll<any>((from, to) =>
              supabase.from("institutions").select("unitid, total_enrollment").range(from, to)
            );
            return rows
              .map((r) => ({ unitid: Number(r.unitid), total: toNumberOrNullAny(r.total_enrollment) ?? 0 }))
              .filter((r) => Number.isFinite(r.unitid))
              .sort((a, b) => (b.total ?? 0) - (a.total ?? 0))
              .map((r) => r.unitid);
          } catch {
            return [];
          }
        }
      }

      if (!IS_DEV) {
        // Matview returned 0 rows; keep the app working using a proxy value.
        try {
          const rows = await supabaseFetchAll<any>((from, to) =>
            supabase.from("institutions").select("unitid, total_enrollment").range(from, to)
          );
          return rows
            .map((r) => ({ unitid: Number(r.unitid), total: toNumberOrNullAny(r.total_enrollment) ?? 0 }))
            .filter((r) => Number.isFinite(r.unitid))
            .sort((a, b) => (b.total ?? 0) - (a.total ?? 0))
            .map((r) => r.unitid);
        } catch {
          return [];
        }
      }

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
      return sorted.map(([unitid]) => unitid);
    })();
  }
  const all = await topApplicantsPromise;
  return all.slice(0, limit);
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

export async function getSuccessProfiles(): Promise<SuccessApplicationProfile[]> {
  try {
    const rows = await supabaseFetchAll<any>((from, to) =>
      supabase
        .from("success_app_profiles")
        .select(
          "id, createdat, year, flair, assigned_category, tags, demographics, academics, extracurricular_activities, awards, decisions, rating"
        )
        .order("id", { ascending: false })
        .range(from, to)
    );

    const mapped: SuccessApplicationProfile[] = (rows ?? []).map((r: any) => ({
      id: Number(r.id) || 0,
      createdat: r.createdat ?? new Date().toISOString(),
      year: Number(r.year) || 0,
      flair: Array.isArray(r.flair) ? r.flair : [],
      assigned_category: (r.assigned_category ?? null) as any,
      tags: Array.isArray(r.tags) ? r.tags : null,
      demographics: (r.demographics ?? {}) as any,
      academics: (r.academics ?? {}) as any,
      extracurricular_activities: Array.isArray(r.extracurricular_activities)
        ? r.extracurricular_activities
        : [],
      awards: Array.isArray(r.awards) ? r.awards : null,
      letters_of_recommendation: null,
      interviews: null,
      decisions: (r.decisions ?? { acceptances: [], waitlists: [], rejections: [] }) as any,
      rating: (r.rating ?? null) as any,
    }));

    if (mapped.length > 0) return mapped;
    return [];
  } catch (e) {
    if (!IS_DEV) return [];
  }

  return getJSON<SuccessApplicationProfile[]>(
    buildDataPath(APPLICANT_DATA_BASE, "history_success_profiles.json")
  );
}

export async function getAnonymousEssays(): Promise<AnonymousEssayEntry[]> {
  try {
    const rows = await supabaseFetchAll<any>((from, to) =>
      supabase
        .from("anonymous_essays")
        .select("id, school, year, type, category, prompt, essay, demographics")
        .order("id", { ascending: false })
        .range(from, to)
    );

    const mapped: AnonymousEssayEntry[] = (rows ?? [])
      .map((r: any) => {
        const essayText = String(r.essay ?? "").trim();
        if (!essayText) return null;
        const sourceEssayId = toNumberOrNullAny(r?.demographics?.source_essay_id);
        return {
          essay_id: sourceEssayId ?? Number(r.id) ?? 0,
          school: r.school ?? "Unknown",
          year: Number.isFinite(Number(r.year)) ? Number(r.year) : 0,
          type: r.type ?? "Essay",
          question: r.prompt ?? null,
          essay: essayText,
          category: r.category ?? "General",
        } as AnonymousEssayEntry;
      })
      .filter(Boolean) as AnonymousEssayEntry[];

    if (mapped.length > 0) return mapped;
    return [];
  } catch (e) {
    if (!IS_DEV) return [];
  }

  return getJSON<AnonymousEssayEntry[]>(
    buildDataPath(APPLICANT_DATA_BASE, "Anonymous_Essays.json")
  );
}
