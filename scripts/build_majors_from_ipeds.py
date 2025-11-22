import argparse
import csv
import json
import os
import re
import sys
from collections import defaultdict
from typing import Dict, Set, Tuple


def sniff_dialect(path: str):
  with open(path, "r", encoding="utf-8", errors="replace") as f:
    sample = f.read(4096)
  try:
    dialect = csv.Sniffer().sniff(sample, delimiters=[",", "\t", ";"])
  except csv.Error:
    dialect = csv.excel
  return dialect


def _norm_col_name(name: str) -> str:
  s = name.strip().lower()
  s = re.sub(r"^[a-z0-9_]+?\.", "", s)
  return s


def col(row: Dict[str, str], name: str) -> str:
  target = _norm_col_name(name)
  for k, v in row.items():
    if _norm_col_name(k) == target:
      return (v or "").strip()
  return ""


def parse_cip(code_raw: str) -> Tuple[str, str, str]:
  """
  Return (two_digit, four_digit, six_digit) codes (string or "") for a CIP code.
  Examples:
    "14"       -> ("14", "", "")
    "14.08"    -> ("14", "14.08", "")
    "14.0801"  -> ("14", "14.08", "14.0801")
  """
  code = (code_raw or "").strip().strip("'\"")
  if not code:
    return "", "", ""
  if "." not in code:
    two = code.zfill(2)
    return two, "", ""
  head, tail = code.split(".", 1)
  head = head.zfill(2)
  tail = tail.strip()
  if len(tail) <= 2:
    four = f"{head}.{tail.zfill(2)}"
    return head, four, ""
  # treat 4+ digits as six-digit (xx.xxxx)
  four = f"{head}.{tail[:2]}"
  six = f"{head}.{tail[:4]}"
  return head, four, six


def main() -> int:
  ap = argparse.ArgumentParser()
  ap.add_argument(
    "--degrees_csv",
    default=os.path.join("public", "data", "institutions_degrees_bachelor.csv"),
  )
  ap.add_argument(
    "--out_meta",
    default=os.path.join("public", "data", "majors_bachelor_meta.json"),
  )
  ap.add_argument(
    "--out_by_inst",
    default=os.path.join("public", "data", "majors_bachelor_by_institution.json"),
  )
  args = ap.parse_args()

  dialect = sniff_dialect(args.degrees_csv)

  # Global CIP title maps
  two_titles: Dict[str, str] = {}
  four_titles: Dict[str, str] = {}
  six_titles: Dict[str, str] = {}

  # Per-institution membership
  per_inst_two: Dict[int, Set[str]] = defaultdict(set)
  per_inst_four: Dict[int, Set[str]] = defaultdict(set)
  per_inst_six: Dict[int, Set[str]] = defaultdict(set)

  rows = 0
  with open(args.degrees_csv, "r", encoding="utf-8", errors="replace", newline="") as f:
    reader = csv.DictReader(f, dialect=dialect)
    for row in reader:
      rows += 1
      uid_raw = col(row, "unitid") or col(row, "UnitID")
      try:
        unitid = int(uid_raw)
      except Exception:
        continue

      cip_code = col(row, "CIP Code -  2020 Classification") or col(
        row, "C2024_A.CIP Code -  2020 Classification"
      )
      if not cip_code:
        continue
      title = col(row, "CipTitle")

      two, four, six = parse_cip(cip_code)
      if not (two or four or six):
        continue

      # Fill global maps (first title wins; later duplicates ignored)
      if two and two not in two_titles and title:
        two_titles[two] = title
      if four and four not in four_titles and title:
        four_titles[four] = title
      if six and six not in six_titles and title:
        six_titles[six] = title

      if two:
        per_inst_two[unitid].add(two)
      if four:
        per_inst_four[unitid].add(four)
      if six:
        per_inst_six[unitid].add(six)

  print(f"Processed rows: {rows}")
  print(f"Unique 2-digit CIP: {len(two_titles)}")
  print(f"Unique 4-digit CIP: {len(four_titles)}")
  print(f"Unique 6-digit CIP: {len(six_titles)}")

  # Write meta
  meta = {
    "two_digit": dict(sorted(two_titles.items(), key=lambda kv: kv[0])),
    "four_digit": dict(sorted(four_titles.items(), key=lambda kv: kv[0])),
    "six_digit": dict(sorted(six_titles.items(), key=lambda kv: kv[0])),
  }
  os.makedirs(os.path.dirname(args.out_meta), exist_ok=True)
  with open(args.out_meta, "w", encoding="utf-8") as f:
    json.dump(meta, f, indent=2, ensure_ascii=False)
  print(f"Wrote meta: {args.out_meta}")

  # Write per-institution map
  by_inst_out = {}
  all_unitids = sorted(
    set(per_inst_two.keys()) | set(per_inst_four.keys()) | set(per_inst_six.keys())
  )
  for uid in all_unitids:
    by_inst_out[str(uid)] = {
      "two_digit": sorted(per_inst_two.get(uid, set())),
      "four_digit": sorted(per_inst_four.get(uid, set())),
      "six_digit": sorted(per_inst_six.get(uid, set())),
    }

  os.makedirs(os.path.dirname(args.out_by_inst), exist_ok=True)
  with open(args.out_by_inst, "w", encoding="utf-8") as f:
    json.dump(by_inst_out, f, indent=2, ensure_ascii=False)
  print(f"Wrote per-institution majors: {args.out_by_inst}")

  return 0


if __name__ == "__main__":
  sys.exit(main())

