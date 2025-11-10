"""
Build majors_by_institution.json from the College Scorecard bulk Field of Study file.

Why: API access is rate-limited and sometimes gated (403/429). The bulk file
can be downloaded once and parsed locally.

Steps:
1) Download "Most Recent Cohorts - Field of Study (CSV)" from
   https://collegescorecard.ed.gov/data/ and save it anywhere locally.
   The download is a ZIP containing a CSV.
2) Run this script, pointing to the downloaded file:

   python scripts/build_majors_from_fos_bulk.py --input "C:/path/to/Most Recent Cohorts - Field of Study (CSV).zip"

3) Output will be written to:
   public/data/majors_by_institution.json

This script is tolerant of header name variants and only keeps
undergraduate credentials (Associate=3 and Bachelor=5).
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import sys
import zipfile
from pathlib import Path
from typing import Iterable

ROOT = Path(__file__).resolve().parents[1]
OUTPUT_PATH = ROOT / "public" / "data" / "majors_by_institution.json"


def open_rows_from_zip(zip_path: Path) -> Iterable[dict]:
    with zipfile.ZipFile(zip_path, "r") as zf:
        # Prefer the largest CSV if multiple
        csv_names = [n for n in zf.namelist() if n.lower().endswith(".csv")]
        if not csv_names:
            raise FileNotFoundError("No CSV found inside ZIP")
        # Pick the largest file by uncompressed size
        csv_name = max(csv_names, key=lambda n: zf.getinfo(n).file_size)
        with zf.open(csv_name, "r") as f:
            text = io.TextIOWrapper(f, encoding="utf-8-sig", newline="")
            reader = csv.DictReader(text)
            for row in reader:
                yield row


def open_rows_from_csv(csv_path: Path) -> Iterable[dict]:
    with csv_path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            yield row


def normalize_headers(row: dict) -> dict:
    # Map assorted header variants to normalized keys
    out = {}
    for k, v in row.items():
        lk = (k or "").strip().lower()
        out[lk] = v
    # Candidate keys
    unitid = out.get("unitid") or out.get("unit_id") or out.get("unit id") or out.get("unit-id")
    cip = out.get("cipcode") or out.get("cip") or out.get("cip code") or out.get("cip4")
    title = out.get("cipdesc") or out.get("cip desc") or out.get("cip_title") or out.get("program name")
    cred = (
        out.get("credential.level")
        or out.get("credential_level")
        or out.get("credlevel")
        or out.get("credlev")
        or out.get("cred level")
        or out.get("credentiallevel")
        or out.get("level")
    )
    return {"unitid": unitid, "cip": cip, "title": title, "credlevel": cred}


def is_undergrad_level(cred: str | int | None) -> bool:
    try:
        iv = int(str(cred).strip())
    except Exception:
        return False
    # Bulk FOS file codes: 2=Associate, 3=Bachelor
    # (API uses 3=Associate, 5=Bachelor). Accept both where present.
    return iv in (2, 3, 5)


def build(input_path: Path) -> int:
    # Choose reader based on extension
    if input_path.suffix.lower() == ".zip":
        rows = open_rows_from_zip(input_path)
    elif input_path.suffix.lower() == ".csv":
        rows = open_rows_from_csv(input_path)
    else:
        raise SystemExit("--input must be a .zip or .csv")

    out: dict[str, set[str]] = {}
    total = 0
    kept = 0
    for raw in rows:
        total += 1
        n = normalize_headers(raw)
        unitid, title, cred = n["unitid"], n["title"], n["credlevel"]
        if not unitid or not title or not is_undergrad_level(cred):
            continue
        try:
            uid = str(int(str(unitid).strip()))
        except Exception:
            continue
        s = out.setdefault(uid, set())
        s.add(title.strip())
        kept += 1

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    compact = {k: sorted(list(v)) for k, v in out.items()}
    with OUTPUT_PATH.open("w", encoding="utf-8") as f:
        json.dump(compact, f, ensure_ascii=False)
    print(f"Wrote {OUTPUT_PATH} with {len(compact)} institutions and {kept} rows kept (from {total} total)")
    return len(compact)


def main() -> None:
    p = argparse.ArgumentParser(description="Build majors_by_institution.json from bulk Field of Study file")
    p.add_argument("--input", required=True, help="Path to ZIP or CSV from College Scorecard bulk downloads")
    args = p.parse_args()
    input_path = Path(args.input)
    if not input_path.exists():
        raise SystemExit(f"Input not found: {input_path}")
    build(input_path)


if __name__ == "__main__":
    main()
