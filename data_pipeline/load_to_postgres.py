import argparse
import csv
import json
import os
from pathlib import Path
from typing import Any, Dict, List, Optional

import psycopg2
from psycopg2.extras import execute_batch


ROOT = Path(__file__).resolve().parents[1]


def load_env_local() -> None:
  """
  Lightweight loader for .env.local so the script can see SUPABASE_DB_URL
  without requiring shell-level env configuration.
  """
  env_path = ROOT / ".env.local"
  if not env_path.exists():
    return
  try:
    text = env_path.read_text(encoding="utf-8")
  except Exception:
    return
  for raw_line in text.splitlines():
    line = raw_line.strip()
    if not line or line.startswith("#"):
      continue
    if "=" not in line:
      continue
    key, value = line.split("=", 1)
    key = key.strip()
    value = value.strip()
    if key and key not in os.environ:
      os.environ[key] = value


SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS public.institutions (
  unitid integer PRIMARY KEY,
  name text NOT NULL,
  city text,
  state text,
  control text,
  level text,
  carnegie_basic text,
  acceptance_rate numeric,
  yield numeric,
  tuition_2023_24 numeric,
  tuition_2023_24_in_state numeric,
  tuition_2023_24_out_of_state numeric,
  grad_rate_6yr numeric,
  intl_enrollment_pct numeric,
  full_time_retention_rate numeric,
  student_to_faculty_ratio numeric,
  total_enrollment numeric,
  website text,
  admissions_url text,
  financial_aid_url text,
  application_url text,
  test_policy text,
  major_families text[]
);

CREATE TABLE IF NOT EXISTS public.institution_locations (
  unitid integer PRIMARY KEY REFERENCES public.institutions(unitid) ON DELETE CASCADE,
  location_type text,
  location_size text,
  title_iv_indicator text
);

CREATE TABLE IF NOT EXISTS public.institution_metrics (
  unitid integer REFERENCES public.institutions(unitid) ON DELETE CASCADE,
  year integer,
  applicants_total numeric,
  admissions_total numeric,
  enrolled_total numeric,
  percent_admitted_total numeric,
  admissions_yield_total numeric,
  graduation_rate_bachelor_6yr numeric,
  full_time_retention_rate numeric,
  student_to_faculty_ratio numeric,
  total_enrollment numeric,
  sat_evidence_based_reading_and_writing_25th_percentile_score numeric,
  sat_evidence_based_reading_and_writing_50th_percentile_score numeric,
  sat_evidence_based_reading_and_writing_75th_percentile_score numeric,
  sat_math_25th_percentile_score numeric,
  sat_math_50th_percentile_score numeric,
  sat_math_75th_percentile_score numeric,
  act_composite_25th_percentile_score numeric,
  act_composite_50th_percentile_score numeric,
  act_composite_75th_percentile_score numeric,
  act_english_25th_percentile_score numeric,
  act_english_50th_percentile_score numeric,
  act_english_75th_percentile_score numeric,
  act_math_25th_percentile_score numeric,
  act_math_50th_percentile_score numeric,
  act_math_75th_percentile_score numeric,
  sat_submitters_count numeric,
  sat_submitters_percent numeric,
  act_submitters_count numeric,
  act_submitters_percent numeric,
  percent_of_total_enrollment_that_are_u_s_nonresident numeric,
  admitted_est numeric,
  enrolled_est numeric,
  PRIMARY KEY (unitid, year)
);

CREATE TABLE IF NOT EXISTS public.majors_meta (
  cip_code text PRIMARY KEY,
  cip_level text NOT NULL,
  title text NOT NULL
);

CREATE TABLE IF NOT EXISTS public.institution_majors (
  unitid integer REFERENCES public.institutions(unitid) ON DELETE CASCADE,
  cip_level text NOT NULL,
  cip_code text NOT NULL,
  PRIMARY KEY (unitid, cip_level, cip_code),
  FOREIGN KEY (cip_code) REFERENCES public.majors_meta(cip_code) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.institution_requirements (
  unitid integer PRIMARY KEY REFERENCES public.institutions(unitid) ON DELETE CASCADE,
  test_policy text,
  required text[],
  considered text[],
  not_considered text[]
);

CREATE TABLE IF NOT EXISTS public.institution_support_notes (
  unitid integer REFERENCES public.institutions(unitid) ON DELETE CASCADE,
  key text NOT NULL,
  note text NOT NULL,
  PRIMARY KEY (unitid, key)
);
"""


def get_db_conn():
  load_env_local()
  url = os.getenv("SUPABASE_DB_URL") or os.getenv("DATABASE_URL")
  if not url:
    raise SystemExit(
      "Missing SUPABASE_DB_URL or DATABASE_URL environment variable.\n"
      "Create a Postgres connection string in Supabase (Project settings → Database) "
      "and set SUPABASE_DB_URL in your .env.local."
    )
  return psycopg2.connect(url)


def create_tables(conn) -> None:
  with conn.cursor() as cur:
    cur.execute(SCHEMA_SQL)
  conn.commit()


def load_institutions(conn) -> None:
  path = ROOT / "public" / "data" / "institutions.json"
  with path.open("r", encoding="utf-8") as f:
    data = json.load(f)

  rows: List[Dict[str, Any]] = []
  for d in data:
    unitid = int(d["unitid"])
    rows.append(
      {
        "unitid": unitid,
        "name": d.get("name"),
        "city": d.get("city"),
        "state": d.get("state"),
        "control": d.get("control"),
        "level": d.get("level"),
        "carnegie_basic": d.get("carnegie_basic"),
        "acceptance_rate": d.get("acceptance_rate"),
        "yield": d.get("yield"),
        "tuition_2023_24": d.get("tuition_2023_24"),
        "tuition_2023_24_in_state": d.get("tuition_2023_24_in_state"),
        "tuition_2023_24_out_of_state": d.get("tuition_2023_24_out_of_state"),
        "grad_rate_6yr": d.get("grad_rate_6yr"),
        "intl_enrollment_pct": d.get("intl_enrollment_pct"),
        "full_time_retention_rate": d.get("full_time_retention_rate"),
        "student_to_faculty_ratio": d.get("student_to_faculty_ratio"),
        "total_enrollment": d.get("total_enrollment"),
        "website": d.get("website"),
        "admissions_url": d.get("admissions_url"),
        "financial_aid_url": d.get("financial_aid_url"),
        "application_url": d.get("application_url"),
        "test_policy": d.get("test_policy"),
        "major_families": d.get("major_families") or [],
      }
    )

  sql = """
    INSERT INTO public.institutions (
      unitid, name, city, state, control, level, carnegie_basic,
      acceptance_rate, yield, tuition_2023_24, tuition_2023_24_in_state,
      tuition_2023_24_out_of_state, grad_rate_6yr, intl_enrollment_pct,
      full_time_retention_rate, student_to_faculty_ratio, total_enrollment,
      website, admissions_url, financial_aid_url, application_url,
      test_policy, major_families
    )
    VALUES (
      %(unitid)s, %(name)s, %(city)s, %(state)s, %(control)s, %(level)s, %(carnegie_basic)s,
      %(acceptance_rate)s, %(yield)s, %(tuition_2023_24)s, %(tuition_2023_24_in_state)s,
      %(tuition_2023_24_out_of_state)s, %(grad_rate_6yr)s, %(intl_enrollment_pct)s,
      %(full_time_retention_rate)s, %(student_to_faculty_ratio)s, %(total_enrollment)s,
      %(website)s, %(admissions_url)s, %(financial_aid_url)s, %(application_url)s,
      %(test_policy)s, %(major_families)s
    )
    ON CONFLICT (unitid) DO UPDATE SET
      name = EXCLUDED.name,
      city = EXCLUDED.city,
      state = EXCLUDED.state,
      control = EXCLUDED.control,
      level = EXCLUDED.level,
      carnegie_basic = EXCLUDED.carnegie_basic,
      acceptance_rate = EXCLUDED.acceptance_rate,
      yield = EXCLUDED.yield,
      tuition_2023_24 = EXCLUDED.tuition_2023_24,
      tuition_2023_24_in_state = EXCLUDED.tuition_2023_24_in_state,
      tuition_2023_24_out_of_state = EXCLUDED.tuition_2023_24_out_of_state,
      grad_rate_6yr = EXCLUDED.grad_rate_6yr,
      intl_enrollment_pct = EXCLUDED.intl_enrollment_pct,
      full_time_retention_rate = EXCLUDED.full_time_retention_rate,
      student_to_faculty_ratio = EXCLUDED.student_to_faculty_ratio,
      total_enrollment = EXCLUDED.total_enrollment,
      website = EXCLUDED.website,
      admissions_url = EXCLUDED.admissions_url,
      financial_aid_url = EXCLUDED.financial_aid_url,
      application_url = EXCLUDED.application_url,
      test_policy = EXCLUDED.test_policy,
      major_families = EXCLUDED.major_families;
  """

  with conn.cursor() as cur:
    execute_batch(cur, sql, rows, page_size=1000)
  conn.commit()


def load_institution_locations(conn) -> None:
  path = ROOT / "public" / "data" / "uni_location_size.csv"
  if not path.exists():
    return

  rows: List[Dict[str, Any]] = []
  with path.open("r", encoding="utf-8", newline="") as f:
    reader = csv.DictReader(f)
    for raw in reader:
      if not raw.get("unitid"):
        continue
      try:
        unitid = int(raw["unitid"])
      except ValueError:
        continue
      rows.append(
        {
          "unitid": unitid,
          "location_type": (raw.get("UniLocation") or "").strip() or None,
          "location_size": (raw.get("LocationSize") or "").strip() or None,
          "title_iv_indicator": (
            raw.get("HD2024.Postsecondary and Title IV institution indicator") or ""
          ).strip()
          or None,
        }
      )

  if not rows:
    return

  sql = """
    INSERT INTO public.institution_locations (
      unitid, location_type, location_size, title_iv_indicator
    )
    VALUES (%(unitid)s, %(location_type)s, %(location_size)s, %(title_iv_indicator)s)
    ON CONFLICT (unitid) DO UPDATE SET
      location_type = EXCLUDED.location_type,
      location_size = EXCLUDED.location_size,
      title_iv_indicator = EXCLUDED.title_iv_indicator;
  """

  with conn.cursor() as cur:
    execute_batch(cur, sql, rows, page_size=1000)
  conn.commit()


def load_institution_metrics(conn) -> None:
  path = ROOT / "public" / "data" / "metrics_by_year.json"
  if not path.exists():
    return
  with path.open("r", encoding="utf-8") as f:
    data = json.load(f)

  rows: List[Dict[str, Any]] = []
  for d in data:
    try:
      unitid = int(d["unitid"])
      year = int(d["year"])
    except (KeyError, ValueError):
      continue
    rows.append(
      {
        "unitid": unitid,
        "year": year,
        "applicants_total": d.get("applicants_total"),
        "admissions_total": d.get("admissions_total"),
        "enrolled_total": d.get("enrolled_total"),
        "percent_admitted_total": d.get("percent_admitted_total"),
        "admissions_yield_total": d.get("admissions_yield_total"),
        "graduation_rate_bachelor_6yr": d.get("graduation_rate_bachelor_degree_within_6_years_total"),
        "full_time_retention_rate": d.get("full_time_retention_rate"),
        "student_to_faculty_ratio": d.get("student_to_faculty_ratio"),
        "total_enrollment": d.get("total_enrollment"),
        "sat_evidence_based_reading_and_writing_25th_percentile_score": d.get(
          "sat_evidence_based_reading_and_writing_25th_percentile_score"
        ),
        "sat_evidence_based_reading_and_writing_50th_percentile_score": d.get(
          "sat_evidence_based_reading_and_writing_50th_percentile_score"
        ),
        "sat_evidence_based_reading_and_writing_75th_percentile_score": d.get(
          "sat_evidence_based_reading_and_writing_75th_percentile_score"
        ),
        "sat_math_25th_percentile_score": d.get("sat_math_25th_percentile_score"),
        "sat_math_50th_percentile_score": d.get("sat_math_50th_percentile_score"),
        "sat_math_75th_percentile_score": d.get("sat_math_75th_percentile_score"),
        "act_composite_25th_percentile_score": d.get("act_composite_25th_percentile_score"),
        "act_composite_50th_percentile_score": d.get("act_composite_50th_percentile_score"),
        "act_composite_75th_percentile_score": d.get("act_composite_75th_percentile_score"),
        "act_english_25th_percentile_score": d.get("act_english_25th_percentile_score"),
        "act_english_50th_percentile_score": d.get("act_english_50th_percentile_score"),
        "act_english_75th_percentile_score": d.get("act_english_75th_percentile_score"),
        "act_math_25th_percentile_score": d.get("act_math_25th_percentile_score"),
        "act_math_50th_percentile_score": d.get("act_math_50th_percentile_score"),
        "act_math_75th_percentile_score": d.get("act_math_75th_percentile_score"),
        "sat_submitters_count": d.get(
          "number_of_first_time_degree_certificate_seeking_students_submitting_sat_scores"
        ),
        "sat_submitters_percent": d.get(
          "percent_of_first_time_degree_certificate_seeking_students_submitting_sat_scores"
        ),
        "act_submitters_count": d.get(
          "number_of_first_time_degree_certificate_seeking_students_submitting_act_scores"
        ),
        "act_submitters_percent": d.get(
          "percent_of_first_time_degree_certificate_seeking_students_submitting_act_scores"
        ),
        "percent_of_total_enrollment_that_are_u_s_nonresident": d.get(
          "percent_of_total_enrollment_that_are_u_s_nonresident"
        ),
        "admitted_est": d.get("admitted_est"),
        "enrolled_est": d.get("enrolled_est"),
      }
    )

  if not rows:
    return

  sql = """
    INSERT INTO public.institution_metrics (
      unitid,
      year,
      applicants_total,
      admissions_total,
      enrolled_total,
      percent_admitted_total,
      admissions_yield_total,
      graduation_rate_bachelor_6yr,
      full_time_retention_rate,
      student_to_faculty_ratio,
      total_enrollment,
      sat_evidence_based_reading_and_writing_25th_percentile_score,
      sat_evidence_based_reading_and_writing_50th_percentile_score,
      sat_evidence_based_reading_and_writing_75th_percentile_score,
      sat_math_25th_percentile_score,
      sat_math_50th_percentile_score,
      sat_math_75th_percentile_score,
      act_composite_25th_percentile_score,
      act_composite_50th_percentile_score,
      act_composite_75th_percentile_score,
      act_english_25th_percentile_score,
      act_english_50th_percentile_score,
      act_english_75th_percentile_score,
      act_math_25th_percentile_score,
      act_math_50th_percentile_score,
      act_math_75th_percentile_score,
      sat_submitters_count,
      sat_submitters_percent,
      act_submitters_count,
      act_submitters_percent,
      percent_of_total_enrollment_that_are_u_s_nonresident,
      admitted_est,
      enrolled_est
    )
    VALUES (
      %(unitid)s,
      %(year)s,
      %(applicants_total)s,
      %(admissions_total)s,
      %(enrolled_total)s,
      %(percent_admitted_total)s,
      %(admissions_yield_total)s,
      %(graduation_rate_bachelor_6yr)s,
      %(full_time_retention_rate)s,
      %(student_to_faculty_ratio)s,
      %(total_enrollment)s,
      %(sat_evidence_based_reading_and_writing_25th_percentile_score)s,
      %(sat_evidence_based_reading_and_writing_50th_percentile_score)s,
      %(sat_evidence_based_reading_and_writing_75th_percentile_score)s,
      %(sat_math_25th_percentile_score)s,
      %(sat_math_50th_percentile_score)s,
      %(sat_math_75th_percentile_score)s,
      %(act_composite_25th_percentile_score)s,
      %(act_composite_50th_percentile_score)s,
      %(act_composite_75th_percentile_score)s,
      %(act_english_25th_percentile_score)s,
      %(act_english_50th_percentile_score)s,
      %(act_english_75th_percentile_score)s,
      %(act_math_25th_percentile_score)s,
      %(act_math_50th_percentile_score)s,
      %(act_math_75th_percentile_score)s,
      %(sat_submitters_count)s,
      %(sat_submitters_percent)s,
      %(act_submitters_count)s,
      %(act_submitters_percent)s,
      %(percent_of_total_enrollment_that_are_u_s_nonresident)s,
      %(admitted_est)s,
      %(enrolled_est)s
    )
    ON CONFLICT (unitid, year) DO UPDATE SET
      applicants_total = EXCLUDED.applicants_total,
      admissions_total = EXCLUDED.admissions_total,
      enrolled_total = EXCLUDED.enrolled_total,
      percent_admitted_total = EXCLUDED.percent_admitted_total,
      admissions_yield_total = EXCLUDED.admissions_yield_total,
      graduation_rate_bachelor_6yr = EXCLUDED.graduation_rate_bachelor_6yr,
      full_time_retention_rate = EXCLUDED.full_time_retention_rate,
      student_to_faculty_ratio = EXCLUDED.student_to_faculty_ratio,
      total_enrollment = EXCLUDED.total_enrollment,
      sat_evidence_based_reading_and_writing_25th_percentile_score = EXCLUDED.sat_evidence_based_reading_and_writing_25th_percentile_score,
      sat_evidence_based_reading_and_writing_50th_percentile_score = EXCLUDED.sat_evidence_based_reading_and_writing_50th_percentile_score,
      sat_evidence_based_reading_and_writing_75th_percentile_score = EXCLUDED.sat_evidence_based_reading_and_writing_75th_percentile_score,
      sat_math_25th_percentile_score = EXCLUDED.sat_math_25th_percentile_score,
      sat_math_50th_percentile_score = EXCLUDED.sat_math_50th_percentile_score,
      sat_math_75th_percentile_score = EXCLUDED.sat_math_75th_percentile_score,
      act_composite_25th_percentile_score = EXCLUDED.act_composite_25th_percentile_score,
      act_composite_50th_percentile_score = EXCLUDED.act_composite_50th_percentile_score,
      act_composite_75th_percentile_score = EXCLUDED.act_composite_75th_percentile_score,
      act_english_25th_percentile_score = EXCLUDED.act_english_25th_percentile_score,
      act_english_50th_percentile_score = EXCLUDED.act_english_50th_percentile_score,
      act_english_75th_percentile_score = EXCLUDED.act_english_75th_percentile_score,
      act_math_25th_percentile_score = EXCLUDED.act_math_25th_percentile_score,
      act_math_50th_percentile_score = EXCLUDED.act_math_50th_percentile_score,
      act_math_75th_percentile_score = EXCLUDED.act_math_75th_percentile_score,
      sat_submitters_count = EXCLUDED.sat_submitters_count,
      sat_submitters_percent = EXCLUDED.sat_submitters_percent,
      act_submitters_count = EXCLUDED.act_submitters_count,
      act_submitters_percent = EXCLUDED.act_submitters_percent,
      percent_of_total_enrollment_that_are_u_s_nonresident = EXCLUDED.percent_of_total_enrollment_that_are_u_s_nonresident,
      admitted_est = EXCLUDED.admitted_est,
      enrolled_est = EXCLUDED.enrolled_est;
  """

  with conn.cursor() as cur:
    execute_batch(cur, sql, rows, page_size=1000)
  conn.commit()


def load_majors_meta(conn) -> None:
  path = ROOT / "public" / "data" / "majors_bachelor_meta.json"
  if not path.exists():
    return
  with path.open("r", encoding="utf-8") as f:
    data = json.load(f)

  rows: List[Dict[str, Any]] = []
  for level_key, level_label in [
    ("two_digit", "2-digit"),
    ("four_digit", "4-digit"),
    ("six_digit", "6-digit"),
  ]:
    mapping: Optional[Dict[str, Any]] = data.get(level_key)
    if not isinstance(mapping, dict):
      continue
    for code, title in mapping.items():
      if not code:
        continue
      t = (str(title) if title is not None else "").strip()
      if not t:
        continue
      rows.append(
        {
          "cip_code": str(code),
          "cip_level": level_label,
          "title": t,
        }
      )

  if not rows:
    return

  sql = """
    INSERT INTO public.majors_meta (cip_code, cip_level, title)
    VALUES (%(cip_code)s, %(cip_level)s, %(title)s)
    ON CONFLICT (cip_code) DO UPDATE SET
      cip_level = EXCLUDED.cip_level,
      title = EXCLUDED.title;
  """

  with conn.cursor() as cur:
    execute_batch(cur, sql, rows, page_size=1000)
  conn.commit()


def load_institution_majors(conn) -> None:
  path = ROOT / "public" / "data" / "majors_bachelor_by_institution.json"
  if not path.exists():
    return
  with path.open("r", encoding="utf-8") as f:
    data = json.load(f)

  rows: List[Dict[str, Any]] = []
  level_map = {
    "two_digit": "2-digit",
    "four_digit": "4-digit",
    "six_digit": "6-digit",
  }

  for unitid_str, payload in data.items():
    try:
      unitid = int(unitid_str)
    except ValueError:
      continue
    if not isinstance(payload, dict):
      continue
    for k, level_label in level_map.items():
      codes = payload.get(k) or []
      if not isinstance(codes, list):
        continue
      for code in codes:
        if not code:
          continue
        rows.append(
          {
            "unitid": unitid,
            "cip_level": level_label,
            "cip_code": str(code),
          }
        )

  if not rows:
    return

  sql = """
    INSERT INTO public.institution_majors (unitid, cip_level, cip_code)
    VALUES (%(unitid)s, %(cip_level)s, %(cip_code)s)
    ON CONFLICT (unitid, cip_level, cip_code) DO NOTHING;
  """

  with conn.cursor() as cur:
    execute_batch(cur, sql, rows, page_size=1000)
  conn.commit()


def load_institution_requirements_and_support(conn) -> None:
  base_dir = ROOT / "public" / "data" / "institutions"
  if not base_dir.exists():
    return

  req_rows: List[Dict[str, Any]] = []
  notes_rows: List[Dict[str, Any]] = []

  for path in base_dir.glob("*.json"):
    with path.open("r", encoding="utf-8") as f:
      data = json.load(f)
    profile = data.get("profile") or {}
    try:
      unitid = int(profile["unitid"])
    except Exception:
      continue

    # Requirements
    req = data.get("requirements") or {}
    req_rows.append(
      {
        "unitid": unitid,
        "test_policy": req.get("test_policy"),
        "required": req.get("required") or [],
        "considered": req.get("considered") or [],
        "not_considered": req.get("not_considered") or [],
      }
    )

    # Support notes (skip null/empty)
    support = data.get("support_notes") or {}
    if isinstance(support, dict):
      for key, value in support.items():
        text = ("" if value is None else str(value)).strip()
        if not text:
          continue
        notes_rows.append(
          {
            "unitid": unitid,
            "key": str(key),
            "note": text,
          }
        )

  if req_rows:
    sql_req = """
      INSERT INTO public.institution_requirements (
        unitid, test_policy, required, considered, not_considered
      )
      VALUES (%(unitid)s, %(test_policy)s, %(required)s, %(considered)s, %(not_considered)s)
      ON CONFLICT (unitid) DO UPDATE SET
        test_policy = EXCLUDED.test_policy,
        required = EXCLUDED.required,
        considered = EXCLUDED.considered,
        not_considered = EXCLUDED.not_considered;
    """
    with conn.cursor() as cur:
      execute_batch(cur, sql_req, req_rows, page_size=1000)
    conn.commit()

  if notes_rows:
    sql_notes = """
      INSERT INTO public.institution_support_notes (unitid, key, note)
      VALUES (%(unitid)s, %(key)s, %(note)s)
      ON CONFLICT (unitid, key) DO UPDATE SET
        note = EXCLUDED.note;
    """
    with conn.cursor() as cur:
      execute_batch(cur, sql_notes, notes_rows, page_size=1000)
    conn.commit()


def main() -> None:
  parser = argparse.ArgumentParser(description="Load IPEDS-derived data into Supabase/Postgres.")
  parser.add_argument(
    "--create-tables-only",
    action="store_true",
    help="Only create tables, do not load any data.",
  )
  args = parser.parse_args()

  conn = get_db_conn()
  try:
    create_tables(conn)
    if not args.create_tables_only:
      load_institutions(conn)
      load_institution_locations(conn)
      load_institution_metrics(conn)
      load_majors_meta(conn)
      load_institution_majors(conn)
      load_institution_requirements_and_support(conn)
  finally:
    conn.close()


if __name__ == "__main__":
  main()
