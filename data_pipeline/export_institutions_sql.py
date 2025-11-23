import json
from pathlib import Path
from typing import Any, List


ROOT = Path(__file__).resolve().parents[1]


def sql_literal(value: Any) -> str:
  if value is None:
    return "NULL"
  if isinstance(value, (int, float)) and not isinstance(value, bool):
    return str(value)
  if isinstance(value, list):
    inner = ", ".join(sql_literal(v) for v in value)
    return f"ARRAY[{inner}]"
  s = str(value).replace("'", "''")
  return f"'{s}'"


def main() -> None:
  data_path = ROOT / "public" / "data" / "institutions.json"
  out_path = ROOT / "data_pipeline" / "supabase_institutions.sql"

  with data_path.open("r", encoding="utf-8") as f:
    data = json.load(f)

  columns: List[str] = [
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
    "financial_aid_url",
    "application_url",
    "test_policy",
    "major_families",
  ]

  lines: List[str] = []
  lines.append("-- INSERTs for public.institutions, generated locally")
  for d in data:
    values = [
      d.get("unitid"),
      d.get("name"),
      d.get("city"),
      d.get("state"),
      d.get("control"),
      d.get("level"),
      d.get("carnegie_basic"),
      d.get("acceptance_rate"),
      d.get("yield"),
      d.get("tuition_2023_24"),
      d.get("tuition_2023_24_in_state"),
      d.get("tuition_2023_24_out_of_state"),
      d.get("grad_rate_6yr"),
      d.get("intl_enrollment_pct"),
      d.get("full_time_retention_rate"),
      d.get("student_to_faculty_ratio"),
      d.get("total_enrollment"),
      d.get("website"),
      d.get("admissions_url"),
      d.get("financial_aid_url"),
      d.get("application_url"),
      d.get("test_policy"),
      d.get("major_families") or [],
    ]
    values_sql = ", ".join(sql_literal(v) for v in values)
    cols_sql = ", ".join(columns)
    lines.append(f"INSERT INTO public.institutions ({cols_sql}) VALUES ({values_sql});")

  out_path.write_text("\n".join(lines), encoding="utf-8")
  print(f"Wrote {len(data)} INSERT statements to {out_path}")


if __name__ == "__main__":
  main()

