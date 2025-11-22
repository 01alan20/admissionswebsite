# scripts/merge_official_urls.py
import argparse
import csv
import json
import os
import re
import sys
from urllib.parse import urlparse, urlunparse


def sniff_dialect(path: str):
  with open(path, "r", encoding="utf-8", errors="replace") as f:
    sample = f.read(4096)
  try:
    dialect = csv.Sniffer().sniff(sample, delimiters=[",", "\t", ";"])
  except csv.Error:
    # fallback if sniff fails
    dialect = csv.excel
  return dialect


def ensure_scheme(u: str) -> str:
  if not u:
    return ""
  u = u.strip()
  if not u:
    return ""
  # add scheme if missing
  if not re.match(r"^https?://", u, re.I):
    u = "https://" + u
  # normalize
  try:
    p = urlparse(u)
    # lower-case scheme + host
    netloc = (p.hostname or "").lower()
    if p.port:
      netloc = f"{netloc}:{p.port}"
    # collapse multiple slashes
    path = re.sub(r"/{2,}", "/", p.path or "/")
    # strip trailing spaces, keep query/fragment
    return urlunparse(
      (
        p.scheme.lower(),
        netloc,
        path.rstrip() or "/",
        p.params,
        p.query,
        p.fragment,
      )
    )
  except Exception:
    return u


def _norm_col_name(name: str) -> str:
  # case-insensitive, ignore leading dataset prefixes like "HD2024."
  s = name.strip().lower()
  s = re.sub(r"^[a-z0-9_]+?\.", "", s)
  return s


def main() -> int:
  ap = argparse.ArgumentParser()
  ap.add_argument(
    "--institutions", default=os.path.join("public", "data", "institutions.json")
  )
  ap.add_argument("--urls_csv", required=True)
  ap.add_argument(
    "--backup", action="store_true", help="write institutions.json.bak before saving"
  )
  ap.add_argument("--dry_run", action="store_true")
  args = ap.parse_args()

  # load institutions json
  with open(args.institutions, "r", encoding="utf-8") as f:
    institutions = json.load(f)

  # build map by unitid (int)
  by_id = {}
  for inst in institutions:
    try:
      uid = int(inst.get("unitid"))
    except Exception:
      continue
    by_id[uid] = inst

  # read CSV (sniff delimiter)
  dialect = sniff_dialect(args.urls_csv)
  updates = 0
  missing = 0

  with open(args.urls_csv, "r", encoding="utf-8", errors="replace", newline="") as f:
    reader = csv.DictReader(f, dialect=dialect)

    def col(d, name):
      target = _norm_col_name(name)
      for k, v in d.items():
        if _norm_col_name(k) == target:
          return (v or "").strip()
      return ""

    for row in reader:
      uid_raw = col(row, "UnitID") or col(row, "unitid")
      try:
        uid = int(uid_raw)
      except Exception:
        continue

      website = ensure_scheme(col(row, "Institution's internet website address"))
      admissions = ensure_scheme(col(row, "Admissions office web address"))
      application = ensure_scheme(col(row, "Online application web address"))
      financial_aid = ensure_scheme(col(row, "Financial aid office web address"))

      inst = by_id.get(uid)
      if not inst:
        missing += 1
        continue

      changed = False
      if website:
        if inst.get("website") != website:
          inst["website"] = website
          changed = True
      if admissions:
        if inst.get("admissions_url") != admissions:
          inst["admissions_url"] = admissions
          changed = True
      if financial_aid:
        if inst.get("financial_aid_url") != financial_aid:
          inst["financial_aid_url"] = financial_aid
          changed = True
      # keep application URL too (optional to render later)
      if application:
        if inst.get("application_url") != application:
          inst["application_url"] = application
          changed = True

      if changed:
        updates += 1

  print(f"Matched institutions: {len(by_id)}")
  print(f"Updated records:     {updates}")
  if missing:
    print(
      "CSV rows whose UnitID wasn't found in institutions.json: "
      f"{missing}"
    )

  if args.dry_run:
    print("Dry run: not writing file.")
    return 0

  if args.backup:
    bak = args.institutions + ".bak"
    with open(bak, "w", encoding="utf-8") as bf:
      json.dump(institutions, bf, indent=2, ensure_ascii=False)
    print(f"Wrote backup: {bak}")

  with open(args.institutions, "w", encoding="utf-8") as f:
    json.dump(institutions, f, indent=2, ensure_ascii=False)
  print(f"Wrote updated: {args.institutions}")
  return 0


if __name__ == "__main__":
  sys.exit(main())

