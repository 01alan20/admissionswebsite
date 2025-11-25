import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

import google.generativeai as genai
from dotenv import load_dotenv
from supabase import Client, create_client


ROOT = Path(__file__).resolve().parent


def _load_env() -> None:
  """
  Load environment variables from .env.local (if present) plus the
  standard .env chain, without overwriting existing vars.
  """
  env_local = ROOT / ".env.local"
  if env_local.exists():
    load_dotenv(dotenv_path=env_local, override=False)
  else:
    load_dotenv(override=False)


_load_env()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
  raise RuntimeError(
    "Missing SUPABASE_URL or SUPABASE_KEY in environment. "
    "Set them in your .env.local file at project root."
  )

if not GEMINI_API_KEY:
  raise RuntimeError(
    "Missing GEMINI_API_KEY in environment. "
    "Set it in your .env.local file at project root."
  )


supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
genai.configure(api_key=GEMINI_API_KEY)


def load_harvard_docs() -> str:
  """
  Loads the training manuals from `documents` folder and returns a
  concatenated string of text context.

  It will read:
    - .txt files as plain text
    - .pdf files via PyPDF2, if installed
  """
  docs_dir = ROOT / "documents"
  if not docs_dir.exists():
    return ""

  texts: List[str] = []

  # Lazy import so the script still works without PyPDF2 when only
  # text files are present.
  try:
    import PyPDF2  # type: ignore
  except Exception:
    PyPDF2 = None  # type: ignore

  for path in docs_dir.iterdir():
    if not path.is_file():
      continue

    suffix = path.suffix.lower()

    if suffix == ".txt":
      try:
        texts.append(path.read_text(encoding="utf-8", errors="ignore"))
      except Exception:
        continue

    elif suffix == ".pdf" and PyPDF2 is not None:
      try:
        with path.open("rb") as f:
          reader = PyPDF2.PdfReader(f)
          parts: List[str] = []
          for page in reader.pages:
            try:
              page_text = page.extract_text() or ""
            except Exception:
              page_text = ""
            if page_text:
              parts.append(page_text)
          if parts:
            texts.append("\n\n".join(parts))
      except Exception:
        continue

  return "\n\n".join(texts)


def _build_system_prompt(harvard_context: str) -> str:
  """
  Construct the system-style instructions for Gemini using the
  Harvard lawsuit rubrics and required JSON format.
  """
  return f"""
You are an Admissions Officer at Harvard College.
Use ONLY the following internal training materials and rubrics when you score applicants:

=== HARVARD READING PROCEDURES & RUBRICS (GROUND TRUTH) ===
{harvard_context}
=== END HARVARD MATERIALS ===

TASK OVERVIEW:
- You are acting as a "Mock Admissions Committee" (Mock AdCom) for US universities.
- You will review one student's profile and a list of target schools.
- You must assign ratings using the Harvard-style 1–6 scales and classify each school into one of five prediction tiers.

HARVARD RATING SCALES (1–6):
1. Academic Rating (1–6)
   - 1 = Summa potential / truly exceptional, top ~1% or stronger.
   - 2 = Magna-level / top ~1–5% in rigorous context.
   - 3 = Strong / mid-range but clearly capable.
   - 4–6 = Progressively weaker academic record relative to peers.

2. Extracurricular Rating (1–6)
   - 1 = National or international level impact, highly distinctive leadership or achievement.
   - 2 = State or regional leadership or recognition.
   - 3 = Strong school-level leadership or initiative.
   - 4–6 = More limited, routine or weak involvement.

3. Personal Rating (1–6)
   - 1 = Outstanding character, grit, insight, maturity, service; unusually compelling voice.
   - 2–3 = Clearly positive personal qualities.
   - 4 = Bland / generic, does not stand out.
   - 5–6 = Concerning, negative, or very weak.

CRITICAL ESSAY RULE:
- If the main essay feels generic (for example: a standard sports injury story, generic community service or service trip, or any overused topic without specific, vivid, unique insight into the student), you MUST assign:
  - Personal Rating = 4
  - personal_rating_flag = "4 - Bland / Generic essay"

LOPS (LIABILITIES / WEAKNESSES):
- Identify specific weaknesses that could lead to a deny or waitlist, e.g.:
  - "Academic: declining grades in junior/senior year"
  - "Extracurricular: no sustained commitments"
  - "Personal: generic essay, little reflection"

5-TIER PREDICTION LOGIC (PER SCHOOL):
For each target school, you will classify the school into exactly ONE of these tiers based on the student's stats and the school's selectivity. Use the data fields provided for each school (e.g. acceptance_rate, sat_25, sat_75, act_25, act_75, is_ivy, is_tippy_top, etc.).

Definitions:
- "Academic Safety":
  - Student's academic profile (GPA, rigor, tests) is clearly above the school's typical 75th percentile range.
  - The student should be very likely to be admitted absent major red flags.

- "Yield Target":
  - The student is clearly qualified and at or above the medians, BUT the school is known for protecting yield.
  - Flag this tier if acceptance_rate is moderate but the student might be "overqualified" (well above stats) and should demonstrate interest (visits, essays, etc.).

- "Target Match":
  - Student's stats fall roughly between the 25th and 75th percentile ranges of the school.
  - A solid but not guaranteed outcome.

- "Reach":
  - Student is academically qualified but below the median or lacks a major "hook" (legacy, recruited athlete, major award).
  - Use when the student is competitive but clearly weaker than typical admits.

- "Lottery":
  - Ultra-selective schools (Ivy League, Stanford, MIT, and any school with admissions rate < 10%).
  - Even strong candidates should be treated as lottery outcomes due to extreme selectivity.

When the data is ambiguous, make a best-faith judgment using the Harvard-style reasoning from the materials above. Do not be overly optimistic.

OUTPUT FORMAT (STRICT JSON):
You MUST respond with a single JSON object, no extra commentary, markdown or text. Use this exact structure and key names:

{{
  "academic_rating": int,              // 1-6
  "extracurricular_rating": int,       // 1-6
  "personal_rating": int,              // 1-6
  "personal_rating_flag": str,         // e.g. "4 - Bland / Generic essay" or "" if not applicable
  "lops": [str],                       // list of weaknesses / concerns
  "overall_summary": str,              // short paragraph summarizing the read
  "school_predictions": [
    {{
      "school_name": str,
      "tier": str,                     // One of: "Academic Safety", "Yield Target", "Target Match", "Reach", "Lottery"
      "rationale": str                 // Brief explanation grounded in stats & rubrics
    }}
  ]
}}

If any information is missing from the input, make a conservative assumption and explain it briefly in the rationale fields.
"""


def analyze_profile(student_data: Dict[str, Any], target_schools: List[Dict[str, Any]]) -> str:
  """
  Sends data to Gemini 2.5-ish model with the Harvard Lawsuit System Prompt
  and returns the model's JSON string.

  Parameters
  ----------
  student_data: dict
    Arbitrary structured data about the student (GPA, rigor, tests, activities, essays, hooks).
  target_schools: list of dict
    Each dict should include at least a school name and basic stats, e.g.:
      {{
        "school_name": "Harvard University",
        "acceptance_rate": 0.04,
        "sat_25": 1480,
        "sat_75": 1580,
        "is_ivy": true,
        "is_tippy_top": true
      }}
  """
  harvard_context = load_harvard_docs()
  system_prompt = _build_system_prompt(harvard_context)

  model = genai.GenerativeModel("gemini-1.5-pro")

  # We send a single prompt that includes system-style instructions plus
  # a JSON payload with the student + school data.
  payload = {
    "student_profile": student_data,
    "target_schools": target_schools,
  }

  prompt = system_prompt + "\n\n" + "INPUT DATA (JSON):\n" + json.dumps(payload, ensure_ascii=False)

  response = model.generate_content(prompt)

  # `response.text` should be JSON per the instructions. We return it
  # as-is so callers can decide when/how to parse/validate.
  return response.text or ""


def save_to_supabase(
  user_id: str,
  student_data: Dict[str, Any],
  analysis_result: str,
  target_universities: Optional[List[Dict[str, Any]]] = None,
) -> Any:
  """
  Saves the inputs and the outputs to the `profiles` table.

  Assumes the table has jsonb columns that can accept these payloads.
  """
  try:
    analysis_json = json.loads(analysis_result)
  except json.JSONDecodeError:
    # If the model output is not valid JSON, store it as raw text instead.
    analysis_json = {"raw_text": analysis_result}

  # If the model followed our schema, pull out per-university predictions
  # into their own column.
  university_predictions = analysis_json.get("school_predictions")

  data = {
    "user_id": user_id,
    "academic_stats": student_data.get("academics"),
    "demographics": student_data.get("demographics"),
    "extracurriculars": student_data.get("ecs"),
    "essay_drafts": student_data.get("essays"),
    "target_universities": target_universities,
    "admissions_scorecard": analysis_json,
    "university_predictions": university_predictions,
    "last_analysis_timestamp": datetime.now(timezone.utc).isoformat(),
  }

  # Upsert on user_id so that each user has one current profile row.
  return (
    supabase.table("profiles")
    .upsert(data, on_conflict="user_id")
    .execute()
  )


def save_student_profile(
  user_id: str,
  student_data: Dict[str, Any],
  target_universities: List[Dict[str, Any]],
  analysis_result: str,
) -> Any:
  """
  Public wrapper that matches the spec language: takes user inputs,
  selected schools, and AI JSON output and upserts into Supabase.
  """
  return save_to_supabase(user_id, student_data, analysis_result, target_universities)


def init_empty_profile(user_id: str) -> Any:
  """
  Create (or ensure) a base profile row for a newly onboarded user.
  Call this right after a user logs in via magic link.
  """
  return (
    supabase.table("profiles")
    .upsert({"user_id": user_id}, on_conflict="user_id")
    .execute()
  )


if __name__ == "__main__":
  # Minimal CLI-style smoke test: this will not actually run Gemini unless
  # you uncomment the analysis call, but it demonstrates the wire-up.
  example_student = {
    "academics": {
      "gpa": 3.95,
      "curriculum_rigor": "Most demanding available",
      "test_scores": {"sat": 1550},
    },
    "ecs": [
      {"name": "Debate", "level": "national", "position": "captain"},
      {"name": "Local tutoring", "hours_per_week": 4},
    ],
    "essays": {
      "personal_statement": "Paste the student's main essay here.",
    },
    "hooks": {
      "legacy": False,
      "athlete": False,
    },
  }

  example_schools = [
    {
      "school_name": "Harvard University",
      "acceptance_rate": 0.04,
      "sat_25": 1480,
      "sat_75": 1580,
      "is_ivy": True,
      "is_tippy_top": True,
    }
  ]

  # Uncomment the lines below to execute a live analysis + save, once
  # you have valid API keys in .env.local.
  #
  # result_text = analyze_profile(example_student, example_schools)
  # print(result_text)
  # save_student_profile("demo-user-id", example_student, result_text)
  pass
