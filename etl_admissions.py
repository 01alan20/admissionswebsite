import argparse
import json
import re
from collections import defaultdict
from pathlib import Path
from typing import Dict, List, Optional

import pandas as pd

# ---------- constants ----------
CIP_FAMILY_MAP: Dict[str, str] = {
    "01": "Agriculture & Natural Resources",
    "03": "Natural Resources & Conservation",
    "04": "Architecture & Planning",
    "05": "Area, Ethnic & Cultural Studies",
    "09": "Communication & Journalism",
    "10": "Communications Technologies",
    "11": "Computer & Information Sciences",
    "12": "Personal & Culinary Services",
    "13": "Education",
    "14": "Engineering",
    "15": "Engineering Technologies",
    "16": "Foreign Languages & Linguistics",
    "19": "Family & Consumer Sciences",
    "22": "Legal Studies",
    "23": "English Language & Literature",
    "24": "Liberal Arts & Humanities",
    "25": "Library Science",
    "26": "Biological & Biomedical Sciences",
    "27": "Mathematics & Statistics",
    "29": "Military Technologies",
    "30": "Multidisciplinary Studies",
    "31": "Parks, Recreation & Fitness",
    "38": "Philosophy & Religious Studies",
    "39": "Theology & Religious Vocations",
    "40": "Physical Sciences",
    "41": "Science Technologies",
    "42": "Psychology",
    "43": "Homeland Security & Law Enforcement",
    "44": "Public Administration & Social Service",
    "45": "Social Sciences",
    "46": "Construction Trades",
    "47": "Mechanic & Repair Technologies",
    "48": "Precision Production",
    "49": "Transportation & Materials Moving",
    "50": "Visual & Performing Arts",
    "51": "Health Professions",
    "52": "Business, Management & Marketing",
    "54": "History"
}


# ---------- small helpers ----------
def snake(s: str) -> str:
    s = (s or "").replace("\ufeff", "").strip()
    s = re.sub(r"[^\w]+", "_", s)
    return re.sub(r"__+", "_", s).strip("_").lower()


def read_csv_safe(path: Path) -> pd.DataFrame:
    for enc in [None, "utf-8", "utf-8-sig", "latin1"]:
        try:
            df = pd.read_csv(path, encoding=enc)
            df.columns = [snake(c) for c in df.columns]
            return df
        except Exception:
            pass
    raise RuntimeError(f"Could not read {path}")


def prefer_base_cols(df: pd.DataFrame) -> pd.DataFrame:
    drop = [c for c in df.columns if c.endswith("_1") and c[:-2] in df.columns]
    return df.drop(columns=drop, errors="ignore")


def simplify_control(txt: Optional[str]) -> Optional[str]:
    if not isinstance(txt, str):
        return None
    t = txt.lower()
    if "public" in t:
        return "Public"
    if "private not-for-profit" in t or "private not for profit" in t:
        return "Private nonprofit"
    if "private for-profit" in t or "private for profit" in t:
        return "Private for-profit"
    return txt


def simplify_level(txt: Optional[str]) -> Optional[str]:
    if not isinstance(txt, str):
        return None
    t = txt.lower()
    if "four or more years" in t or "4-year" in t:
        return "4-year"
    if "2" in t and "year" in t:
        return "2-year"
    if "less than 2" in t or "<2" in t:
        return "<2-year"
    return txt


def pct_series(num, den):
    n = pd.to_numeric(num, errors="coerce")
    d = pd.to_numeric(den, errors="coerce")
    with pd.option_context("future.no_silent_downcasting", True):
        out = (n / d) * 100.0
    return out


def iround(x):
    try:
        if pd.isna(x):
            return None
        return int(round(float(x)))
    except Exception:
        return None


def cip_family(code: Optional[str]) -> Optional[str]:
    if not code or not isinstance(code, str):
        return None
    root = code.split(".")[0].zfill(2)
    return CIP_FAMILY_MAP.get(root)


def to_records(df: pd.DataFrame) -> List[dict]:
    if df is None or df.empty:
        return []
    clean = df.where(pd.notnull(df), None)
    return json.loads(clean.to_json(orient="records"))


# ---------- loaders ----------
def load_uni_info(info_path: Path, merged_path: Path) -> pd.DataFrame:
    df = prefer_base_cols(read_csv_safe(info_path))
    merged_df = prefer_base_cols(read_csv_safe(merged_path))

    merged_df = merged_df.rename(
        columns={
            "instnm": "inst_name",
            "city": "inst_city",
            "stabbr": "inst_state",
            "insturl": "inst_url",
            "admurl": "adm_url"
        }
    )

    out = pd.DataFrame(
        {
            "unitid": df.get("unitid"),
            "name": df.get("institution_name"),
            "state": merged_df.get("inst_state"),
            "control": df.get("control_of_institution"),
            "level": df.get("level_of_institution"),
            "carnegie_basic": df.get("carnegie_classification_2021_basic"),
            "city": merged_df.get("inst_city"),
            "website": merged_df.get("inst_url") if "inst_url" in merged_df.columns else df.get("institution_internet_website_address"),
            "admissions_url": merged_df.get("adm_url") if "adm_url" in merged_df.columns else df.get("admissions_office_web_address"),
        }
    )
    out["control"] = out["control"].map(simplify_control)
    out["level"] = out["level"].map(simplify_level)
    return out


def load_aeg(path: Path, year: int) -> pd.DataFrame:
    df = prefer_base_cols(read_csv_safe(path))

    need = [
        "unitid",
        "applicants_total",
        "admissions_total",
        "enrolled_total",
        "percent_admitted_total",
        "admissions_yield_total",
        "graduation_rate_bachelor_degree_within_6_years_total",
        "full_time_retention_rate",
        "student_to_faculty_ratio",
        "total_enrollment",
        "percent_of_total_enrollment_that_are_u_s_nonresident",
    ]
    have = [c for c in need if c in df.columns]
    out = df[have].copy()
    out["year"] = year

    if "percent_admitted_total" not in out.columns and {"admissions_total", "applicants_total"} <= set(out.columns):
        out["percent_admitted_total"] = pct_series(out["admissions_total"], out["applicants_total"])
    if "admissions_yield_total" not in out.columns and {"enrolled_total", "admissions_total"} <= set(out.columns):
        out["admissions_yield_total"] = pct_series(out["enrolled_total"], out["admissions_total"])

    # test score submission & percentiles
    extra_cols = [
        "number_of_first_time_degree_certificate_seeking_students_submitting_sat_scores",
        "percent_of_first_time_degree_certificate_seeking_students_submitting_sat_scores",
        "number_of_first_time_degree_certificate_seeking_students_submitting_act_scores",
        "percent_of_first_time_degree_certificate_seeking_students_submitting_act_scores",
        "sat_evidence_based_reading_and_writing_25th_percentile_score",
        "sat_evidence_based_reading_and_writing_50th_percentile_score",
        "sat_evidence_based_reading_and_writing_75th_percentile_score",
        "sat_math_25th_percentile_score",
        "sat_math_50th_percentile_score",
        "sat_math_75th_percentile_score",
        "act_composite_25th_percentile_score",
        "act_composite_50th_percentile_score",
        "act_composite_75th_percentile_score",
        "act_english_25th_percentile_score",
        "act_english_50th_percentile_score",
        "act_english_75th_percentile_score",
        "act_math_25th_percentile_score",
        "act_math_50th_percentile_score",
        "act_math_75th_percentile_score",
    ]
    for col in extra_cols:
        if col in df.columns:
            out[col] = df[col]

    for col in ["percent_admitted_total", "admissions_yield_total", "graduation_rate_bachelor_degree_within_6_years_total", "full_time_retention_rate"]:
        if col in out.columns:
            out[col] = out[col].apply(iround)

    return out


def load_tuition(tuition_path: Path, merged_path: Optional[Path] = None) -> pd.DataFrame:
    df = prefer_base_cols(read_csv_safe(tuition_path))
    ren = {c: c.replace("drvic2023_tuition_and_fees_", "").replace("-", "_") for c in df.columns if c.startswith("drvic2023_tuition_and_fees_")}
    df = df.rename(columns=ren)
    keep_years = [c for c in df.columns if c in ("2020_21", "2021_22", "2022_23", "2023_24")]
    long_df = df[["unitid"] + keep_years].melt(id_vars=["unitid"], var_name="tuition_year", value_name="tuition_and_fees")
    long_df["tuition_and_fees"] = pd.to_numeric(long_df["tuition_and_fees"], errors="coerce")

    if merged_path and merged_path.exists():
        merged_df = prefer_base_cols(read_csv_safe(merged_path))
        cols = [c for c in ("tuitionfee_in", "tuitionfee_out") if c in merged_df.columns]
        if cols:
            extra = merged_df[["unitid"] + cols].copy()
            for c in cols:
                extra[c] = pd.to_numeric(extra[c], errors="coerce")
            extra["tuition_year"] = "2023_24"
            extra = extra.rename(
                columns={
                    "tuitionfee_in": "tuition_in_state",
                    "tuitionfee_out": "tuition_out_of_state",
                }
            )
            long_df = long_df.merge(extra, on=["unitid", "tuition_year"], how="left")

    return long_df


def derive_requirements_2023(df23: pd.DataFrame) -> pd.DataFrame:
    def bucket(val: str) -> Optional[str]:
        if not isinstance(val, str):
            return None
        t = val.lower()
        if "not considered" in t:
            return "not_considered"
        if "required to be considered" in t:
            return "required"
        if "not required" in t and "considered" in t:
            return "considered"
        if "required" in t:
            return "required"
        if "considered" in t:
            return "considered"
        return "not_considered"

    fields = [
        "secondary_school_gpa",
        "secondary_school_rank",
        "secondary_school_record",
        "completion_of_college_preparatory_program",
        "recommendations",
        "formal_demonstration_of_competencies",
        "work_experience",
        "personal_statement_or_essay",
        "legacy_status",
        "admission_test_scores",
        "english_proficiency_test",
        "other_test_wonderlic_wisc_iii_etc",
    ]
    present = [f for f in fields if f in df23.columns]
    rows = []
    for _, record in df23[["unitid"] + present].iterrows():
        buckets = {"required": [], "considered": [], "not_considered": []}
        for field in present:
            b = bucket(record[field])
            if not b:
                continue
            label = field.replace("_", " ").title()
            buckets[b].append(label)

        tests_label = "Admission Test Scores"
        if tests_label in buckets["required"]:
            policy = "Required"
        elif tests_label in buckets["considered"]:
            policy = "Test flexible"
        else:
            policy = "Test optional"

        rows.append(
            {
                "unitid": int(record["unitid"]),
                "required": sorted(buckets["required"]),
                "considered": sorted(buckets["considered"]),
                "not_considered": sorted(buckets["not_considered"]),
                "test_policy": policy,
            }
        )
    return pd.DataFrame(rows)


def derive_major_families(path: Path) -> Dict[int, List[str]]:
    df = prefer_base_cols(read_csv_safe(path))
    if "unitid" not in df.columns or "cipcode" not in df.columns:
        return {}

    df["cipcode"] = df["cipcode"].astype(str).str.strip()
    df["family"] = df["cipcode"].apply(cip_family)

    count_col = None
    for candidate in ["ctotalt", "ctotalb", "ctotalm"]:
        if candidate in df.columns:
            count_col = candidate
            break

    if count_col:
        df[count_col] = pd.to_numeric(df[count_col], errors="coerce").fillna(0)

    agg = defaultdict(dict)
    for _, row in df.iterrows():
        if not row.get("family"):
            continue
        unit = int(row["unitid"])
        weight = float(row[count_col]) if count_col else 1.0
        agg[unit][row["family"]] = agg[unit].get(row["family"], 0.0) + weight

    major_map: Dict[int, List[str]] = {}
    for unitid, fams in agg.items():
        sorted_fams = sorted(fams.items(), key=lambda x: x[1], reverse=True)
        major_map[unitid] = [name for name, _ in sorted_fams[:4]]
    return major_map


# ---------- builders ----------
def build_institutions(
    base: pd.DataFrame,
    latest_metrics: pd.DataFrame,
    tuition_long: pd.DataFrame,
    requirements: pd.DataFrame,
    major_map: Dict[int, List[str]],
) -> pd.DataFrame:
    stats_cols = [
        "unitid",
        "percent_admitted_total",
        "admissions_yield_total",
        "graduation_rate_bachelor_degree_within_6_years_total",
        "total_enrollment",
        "full_time_retention_rate",
        "student_to_faculty_ratio",
        "percent_of_total_enrollment_that_are_u_s_nonresident",
    ]
    stats = latest_metrics[latest_metrics["year"] == latest_metrics["year"].max()].copy()
    stats = stats[stats_cols].drop_duplicates("unitid", keep="last")
    stats = stats.rename(
        columns={
            "percent_admitted_total": "acceptance_rate",
            "admissions_yield_total": "yield",
            "graduation_rate_bachelor_degree_within_6_years_total": "grad_rate_6yr",
            "percent_of_total_enrollment_that_are_u_s_nonresident": "intl_enrollment_pct",
        }
    )

    base_cols = ["unitid", "tuition_and_fees"]
    if "tuition_in_state" in tuition_long.columns:
        base_cols.append("tuition_in_state")
    if "tuition_out_of_state" in tuition_long.columns:
        base_cols.append("tuition_out_of_state")

    tuition_latest = (
        tuition_long[tuition_long["tuition_year"] == "2023_24"][base_cols]
        .rename(
            columns={
                "tuition_and_fees": "tuition_2023_24",
                "tuition_in_state": "tuition_2023_24_in_state",
                "tuition_out_of_state": "tuition_2023_24_out_of_state",
            }
        )
        .drop_duplicates("unitid", keep="last")
    )

    req_policy = requirements[["unitid", "test_policy"]]

    merged = (
        base.merge(stats, on="unitid", how="left")
        .merge(tuition_latest, on="unitid", how="left")
        .merge(req_policy, on="unitid", how="left")
    )

    for col in ["acceptance_rate", "yield", "grad_rate_6yr", "full_time_retention_rate", "student_to_faculty_ratio", "intl_enrollment_pct"]:
        if col in merged.columns:
            merged[col] = merged[col].apply(iround)

    if "intl_enrollment_pct" in merged.columns:
        merged["intl_enrollment_pct"] = merged["intl_enrollment_pct"].apply(lambda v: int(v) if v is not None and not pd.isna(v) else None)

    merged["test_policy"] = merged["test_policy"].fillna("Test optional")
    def family_lookup(uid):
        if pd.isna(uid):
            return []
        return major_map.get(int(uid), [])

    merged["major_families"] = merged["unitid"].apply(family_lookup)

    cols_out = [
        "unitid",
        "name",
        "city",
        "state",
        "control",
        "level",
        "carnegie_basic",
        "acceptance_rate",
        "yield",
        "tuition_2023_24",
        "tuition_2023_24_in_state",
        "tuition_2023_24_out_of_state",
        "grad_rate_6yr",
        "intl_enrollment_pct",
        "full_time_retention_rate",
        "student_to_faculty_ratio",
        "total_enrollment",
        "website",
        "admissions_url",
        "test_policy",
        "major_families",
    ]
    out = merged[[c for c in cols_out if c in merged.columns]].copy()
    out = out[out["unitid"].notna()].copy()
    out["unitid"] = out["unitid"].astype(int)
    int_cols = [
        "acceptance_rate",
        "yield",
        "grad_rate_6yr",
        "intl_enrollment_pct",
        "full_time_retention_rate",
        "student_to_faculty_ratio",
        "total_enrollment",
    ]
    for col in int_cols:
        if col in out.columns:
            out[col] = pd.to_numeric(out[col], errors="coerce").astype("Int64")

    return out[out["name"].notna()]


def build_institutions_index(base: pd.DataFrame) -> pd.DataFrame:
    cols = ["unitid", "name", "state", "city"]
    out = base[[c for c in cols if c in base.columns]].dropna(subset=["name"]).copy()
    if "unitid" in out.columns:
        out = out[out["unitid"].notna()].copy()
        out["unitid"] = out["unitid"].astype(int)
    return out


def build_metrics_by_year(a22: pd.DataFrame, a23: pd.DataFrame) -> pd.DataFrame:
    cols = [
        "unitid",
        "year",
        "applicants_total",
        "admissions_total",
        "enrolled_total",
        "percent_admitted_total",
        "admissions_yield_total",
        "graduation_rate_bachelor_degree_within_6_years_total",
        "full_time_retention_rate",
        "student_to_faculty_ratio",
        "total_enrollment",
        "number_of_first_time_degree_certificate_seeking_students_submitting_sat_scores",
        "percent_of_first_time_degree_certificate_seeking_students_submitting_sat_scores",
        "number_of_first_time_degree_certificate_seeking_students_submitting_act_scores",
        "percent_of_first_time_degree_certificate_seeking_students_submitting_act_scores",
        "sat_evidence_based_reading_and_writing_25th_percentile_score",
        "sat_evidence_based_reading_and_writing_50th_percentile_score",
        "sat_evidence_based_reading_and_writing_75th_percentile_score",
        "sat_math_25th_percentile_score",
        "sat_math_50th_percentile_score",
        "sat_math_75th_percentile_score",
        "act_composite_25th_percentile_score",
        "act_composite_50th_percentile_score",
        "act_composite_75th_percentile_score",
        "act_english_25th_percentile_score",
        "act_english_50th_percentile_score",
        "act_english_75th_percentile_score",
        "act_math_25th_percentile_score",
        "act_math_50th_percentile_score",
        "act_math_75th_percentile_score",
        "percent_of_total_enrollment_that_are_u_s_nonresident",
    ]

    def keep(df: pd.DataFrame) -> pd.DataFrame:
        return df[[c for c in cols if c in df.columns]].copy()

    m = pd.concat([keep(a22), keep(a23)], ignore_index=True)

    for col in [
        "percent_admitted_total",
        "admissions_yield_total",
        "graduation_rate_bachelor_degree_within_6_years_total",
        "full_time_retention_rate",
        "percent_of_first_time_degree_certificate_seeking_students_submitting_sat_scores",
        "percent_of_first_time_degree_certificate_seeking_students_submitting_act_scores",
        "percent_of_total_enrollment_that_are_u_s_nonresident",
    ]:
        if col in m.columns:
            m[col] = m[col].apply(iround)

    if {"applicants_total", "percent_admitted_total"} <= set(m.columns):
        m["admitted_est"] = (
            pd.to_numeric(m["applicants_total"], errors="coerce")
            * (pd.to_numeric(m["percent_admitted_total"], errors="coerce") / 100.0)
        ).round()
    if {"admissions_total", "admissions_yield_total"} <= set(m.columns):
        m["enrolled_est"] = (
            pd.to_numeric(m["admissions_total"], errors="coerce")
            * (pd.to_numeric(m["admissions_yield_total"], errors="coerce") / 100.0)
        ).round()
    return m


def write_index_slices(index_df: pd.DataFrame, out_dir: Path):
    out_dir.mkdir(parents=True, exist_ok=True)
    records = index_df.copy()
    records["letter"] = (
        records["name"].astype(str).str.strip().str[0].fillna("").str.lower().str.replace("[^a-z]", "", regex=True)
    )
    records["letter"] = records["letter"].replace("", "misc")

    manifest = []
    for letter, group in records.groupby("letter"):
        manifest.append(letter)
        target = out_dir / f"{letter}.json"
        group[["unitid", "name", "state", "city"]].to_json(target, orient="records", indent=2)

    manifest_path = out_dir / "manifest.json"
    manifest_path.write_text(json.dumps(sorted(manifest), indent=2), encoding="utf-8")


def write_institution_details(
    out_dir: Path,
    institutions: pd.DataFrame,
    metrics: pd.DataFrame,
    tuition_long: pd.DataFrame,
    requirements: pd.DataFrame,
):
    out_dir.mkdir(parents=True, exist_ok=True)
    metrics_dir = out_dir.parent / "metrics"
    metrics_dir.mkdir(parents=True, exist_ok=True)

    metrics_group = {k: g.sort_values("year") for k, g in metrics.groupby("unitid")}
    tuition_group = {k: g.sort_values("tuition_year") for k, g in tuition_long.groupby("unitid")}
    req_map = {row["unitid"]: row for row in requirements.to_dict(orient="records")}

    for inst in institutions.to_dict(orient="records"):
        unitid = int(inst["unitid"])
        profile = {
            "unitid": unitid,
            "name": inst.get("name"),
            "city": inst.get("city"),
            "state": inst.get("state"),
            "control": inst.get("control"),
            "level": inst.get("level"),
            "carnegie_basic": inst.get("carnegie_basic"),
            "website": inst.get("website"),
            "admissions_url": inst.get("admissions_url"),
            "test_policy": inst.get("test_policy"),
            "major_families": inst.get("major_families", []),
            "intl_enrollment_pct": inst.get("intl_enrollment_pct"),
            "tuition_summary": {
                "sticker": inst.get("tuition_2023_24"),
                "in_state": inst.get("tuition_2023_24_in_state"),
                "out_of_state": inst.get("tuition_2023_24_out_of_state"),
            },
            "outcomes": {
                "acceptance_rate": inst.get("acceptance_rate"),
                "yield": inst.get("yield"),
                "grad_rate_6yr": inst.get("grad_rate_6yr"),
                "retention_full_time": inst.get("full_time_retention_rate"),
                "student_faculty_ratio": inst.get("student_to_faculty_ratio"),
                "total_enrollment": inst.get("total_enrollment"),
            },
        }

        req = req_map.get(unitid, {"required": [], "considered": [], "not_considered": [], "test_policy": "Test optional"})
        detail_path = out_dir / f"{unitid}.json"
        detail_payload = {
            "profile": profile,
            "requirements": {
                "required": req.get("required", []),
                "considered": req.get("considered", []),
                "not_considered": req.get("not_considered", []),
                "test_policy": req.get("test_policy", "Test optional"),
            },
            "support_notes": {
                "international_cost": None,
                "scholarships": None,
                "support_services": None,
                "deadlines": None,
            },
        }
        detail_path.write_text(json.dumps(detail_payload, indent=2), encoding="utf-8")

        metric_rows = metrics_group.get(unitid, pd.DataFrame())
        tuition_rows = tuition_group.get(unitid, pd.DataFrame())
        metrics_payload = {
            "unitid": unitid,
            "metrics": to_records(metric_rows),
            "tuition": to_records(tuition_rows),
        }
        (metrics_dir / f"{unitid}.json").write_text(json.dumps(metrics_payload, indent=2), encoding="utf-8")


# ---------- main ----------
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--src", required=True, help="Folder with CSVs")
    parser.add_argument("--out", required=True, help="Output folder (e.g., public/data)")
    args = parser.parse_args()

    src = Path(args.src)
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    base = load_uni_info(src / "2023_uni_information.csv", src / "MERGED2022_23_PP.csv")
    a22 = load_aeg(src / "2022_Admissions_Enrollment_Graduation.csv", 2022)
    a23 = load_aeg(src / "2023_Admissions_Enrollment_Graduation.csv", 2023)
    metrics_by_year = build_metrics_by_year(a22, a23)
    tuition_long = load_tuition(src / "2023_tuition.csv", src / "MERGED2022_23_PP.csv")
    requirements = derive_requirements_2023(prefer_base_cols(read_csv_safe(src / "2023_Admissions_Enrollment_Graduation.csv")))
    major_map = derive_major_families(src / "2023 - degree offerings coded.csv")

    institutions = build_institutions(base, metrics_by_year, tuition_long, requirements, major_map)
    institutions_index = build_institutions_index(base)
    tuition_ts = tuition_long.sort_values(["unitid", "tuition_year"])

    institutions.to_json(out / "institutions.json", orient="records", indent=2)
    institutions_index.to_json(out / "institutions_index.json", orient="records", indent=2)
    metrics_by_year.to_json(out / "metrics_by_year.json", orient="records", indent=2)
    requirements.to_json(out / "requirements_2023.json", orient="records", indent=2)
    tuition_ts.to_json(out / "tuition_timeseries.json", orient="records", indent=2)

    write_index_slices(institutions_index, out / "indexes")
    write_institution_details(out / "institutions", institutions, metrics_by_year, tuition_long, requirements)

    print(
        "Wrote institutions.json, institutions_index.json, metrics_by_year.json, requirements_2023.json, tuition_timeseries.json,"
        " sliced search indexes, and per-institution detail files."
    )


if __name__ == "__main__":
    main()
