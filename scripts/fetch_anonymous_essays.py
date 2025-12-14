#!/usr/bin/env python3
from __future__ import annotations

import json
import pathlib
import sys
from typing import Any

import requests

BASE_URL = "https://app.collegebase.org/data/essays/essay_{}.json"
START_INDEX = 1
TARGET_DIR = pathlib.Path("public/data/Applicant_Data")
OUTPUT_FILE = TARGET_DIR / "Anonymous_Essays.json"
LOG_FILE = TARGET_DIR / "Anonymous_Essays.log"


def log(message: str) -> None:
    TARGET_DIR.mkdir(parents=True, exist_ok=True)
    with LOG_FILE.open("a", encoding="utf-8") as fh:
        fh.write(message.rstrip() + "\n")


def fetch_all_essays() -> list[Any]:
    essays: list[Any] = []
    session = requests.Session()
    index = START_INDEX
    while True:
        url = BASE_URL.format(index)
        print(f"Fetching {url}...", end="", flush=True)
        try:
            response = session.get(url, timeout=15)
        except requests.RequestException as exc:
            log(f"Request failed for {url}: {exc}")
            print(" failed")
            break
        if response.status_code != 200:
            log(f"Stopped at {url} (status {response.status_code})")
            print(f" status {response.status_code}, stopping")
            break
        try:
            data = response.json()
        except ValueError:
            log(f"Invalid JSON at {url}, stopping.")
            print(" invalid JSON, stopping")
            break
        entries = data if isinstance(data, list) else [data]
        essays.extend(entries)
        OUTPUT_FILE.write_text(json.dumps(essays, ensure_ascii=False, indent=2), encoding="utf-8")
        log(f"Fetched essay {index} with {len(entries)} entr{'ies' if len(entries) != 1 else 'y'}. Total essays: {len(essays)}")
        print(f" done ({len(entries)} entries, total {len(essays)})")
        index += 1
    return essays


def main() -> None:
    TARGET_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_FILE.write_text("[]", encoding="utf-8")
    essays = fetch_all_essays()
    if not essays:
        print("No essays downloaded.")
        return
    OUTPUT_FILE.write_text(json.dumps(essays, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Saved {len(essays)} essays to {OUTPUT_FILE}")


if __name__ == "__main__":
    sys.exit(main())
