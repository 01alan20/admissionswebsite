"""
Fetch undergraduate majors (CIP 4-digit titles) per institution from the
US Department of Education College Scorecard API and write a compact JSON
file used by the app.

Usage:
  set SCORECARD_API_KEY=your_key_here  # Windows PowerShell: $env:SCORECARD_API_KEY="..."
  python scripts/fetch_scorecard_majors.py

Input:
  public/data/institutions.json  (reads unitids to query)

Output:
  public/data/majors_by_institution.json  (e.g., {"100654":["Biology, General.", ...]})

Notes:
  - Uses field: latest.programs.cip_4_digit.{code,title}
  - De-duplicates titles per institution and sorts them.
  - Respects API rate limiting with a small delay.
"""

from __future__ import annotations

import json
import os
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INSTITUTIONS_PATH = ROOT / "public" / "data" / "institutions.json"
OUTPUT_PATH = ROOT / "public" / "data" / "majors_by_institution.json"

API_KEY = os.getenv("SCORECARD_API_KEY", os.getenv("SCORECARD_KEY"))
BASE = "https://api.data.gov/ed/collegescorecard/v1/schools"


def fetch_programs(unitid: int) -> list[dict]:
    params = {
        "id": str(unitid),
        "fields": "id,latest.programs.cip_4_digit.code,latest.programs.cip_4_digit.title",
        "api_key": API_KEY or "DEMO_KEY",
    }
    url = f"{BASE}?{urllib.parse.urlencode(params)}"
    with urllib.request.urlopen(url, timeout=30) as resp:
        data = json.load(resp)
    results = data.get("results", [])
    if not results:
        return []
    entry = results[0]
    programs = entry.get("latest.programs.cip_4_digit", []) or []
    # Keep only undergrad credentials: associate (3) and bachelor's (5)
    filtered = [p for p in programs if isinstance(p, dict) and p.get("credential", {}).get("level") in (3, 5)]
    return filtered


def main() -> None:
    if not INSTITUTIONS_PATH.exists():
        raise SystemExit(f"Missing input file: {INSTITUTIONS_PATH}")

    with INSTITUTIONS_PATH.open("r", encoding="utf-8") as f:
        institutions = json.load(f)

    unitids = [int(x["unitid"]) for x in institutions if "unitid" in x]
    out: dict[str, list[str]] = {}

    for i, unitid in enumerate(unitids, 1):
        try:
            programs = fetch_programs(unitid)
            titles = sorted({p.get("title") for p in programs if p.get("title")})
            if titles:
                out[str(unitid)] = titles
            status = f"{i}/{len(unitids)} {unitid}: {len(titles)} majors"
        except Exception as e:
            status = f"{i}/{len(unitids)} {unitid}: error {e}"
        print(status)
        # Be nice to the API (adjust if you have a key and quota)
        time.sleep(0.2)

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT_PATH.open("w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False)
    print(f"Wrote {OUTPUT_PATH} with {len(out)} institutions")


if __name__ == "__main__":
    main()
