"""
Poll new contact requests from Supabase and forward them to email.

Run this script manually when you want to process any "new" requests, or
schedule it (e.g. Windows Task Scheduler) to run periodically.

Required environment variables (never commit these to git):

- SUPABASE_URL               e.g. https://xxxx.supabase.co
- SUPABASE_SERVICE_ROLE_KEY  service role key from Supabase (bypasses RLS)
- CONTACT_EMAIL_TO           destination address, e.g. seethroughuniadmissions@gmail.com
- CONTACT_EMAIL_FROM         from address, e.g. same as the Gmail account
- GMAIL_USERNAME             Gmail address used to send mail
- GMAIL_APP_PASSWORD         Gmail app password (not your main password)
"""

from __future__ import annotations

import os
import smtplib
from email.message import EmailMessage
from typing import Any, Dict, List

from supabase import Client, create_client


STATUS_NEW = "new"
STATUS_EMAILED = "emailed"


def load_local_env(path: str = ".env.local") -> None:
    """
    Best-effort loader for a simple KEY=VALUE env file.
    Only sets variables that are not already present in os.environ.
    """
    if not os.path.exists(path):
        return
    try:
        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" not in line:
                    continue
                key, value = line.split("=", 1)
                key = key.strip()
                value = value.strip()
                if key and key not in os.environ:
                    os.environ[key] = value
    except OSError:
        # If we can't read the file, just fall back to existing environment
        pass


def get_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def get_supabase_client() -> Client:
    url = get_env("SUPABASE_URL")
    service_key = get_env("SUPABASE_SERVICE_ROLE_KEY")
    return create_client(url, service_key)


def fetch_new_requests(client: Client) -> List[Dict[str, Any]]:
    """Fetch contact_requests rows whose status is 'new'."""
    resp = (
        client.table("contact_requests")
        .select("*")
        .eq("status", STATUS_NEW)
        .order("created_at", desc=True)
        .execute()
    )
    return resp.data or []


def build_email_body(row: Dict[str, Any]) -> str:
    lines = [
        f"Name: {row.get('name')}",
        f"Email: {row.get('email')}",
    ]

    optional_fields = [
        ("phone", "Phone"),
        ("grad_year", "Grad year"),
        ("grade_level", "Grade level"),
        ("interests", "Interests"),
        ("budget_range", "Budget"),
        ("location_preferences", "Location preferences"),
        ("source_page", "Source page"),
    ]
    for key, label in optional_fields:
        value = row.get(key)
        if value:
            lines.append(f"{label}: {value}")

    lines.append("")
    lines.append("Message:")
    lines.append(row.get("message") or "")

    return "\n".join(lines)


def send_email(row: Dict[str, Any]) -> None:
    gmail_user = get_env("GMAIL_USERNAME")
    gmail_pass = get_env("GMAIL_APP_PASSWORD")
    to_addr = get_env("CONTACT_EMAIL_TO")
    from_addr = os.environ.get("CONTACT_EMAIL_FROM") or gmail_user

    body = build_email_body(row)

    msg = EmailMessage()
    msg["Subject"] = "New SeeThroughAdmissions contact request"
    msg["From"] = from_addr
    msg["To"] = to_addr
    msg.set_content(body)

    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as smtp:
        smtp.login(gmail_user, gmail_pass)
        smtp.send_message(msg)


def mark_as_emailed(client: Client, row_id: Any) -> None:
    client.table("contact_requests").update({"status": STATUS_EMAILED}).eq("id", row_id).execute()


def main() -> None:
    # Load .env.local (if present) so SUPABASE_*, GMAIL_* values are available.
    load_local_env()

    client = get_supabase_client()
    rows = fetch_new_requests(client)
    if not rows:
        print("No new contact requests.")
        return

    print(f"Found {len(rows)} new contact request(s).")
    for row in rows:
        print(f"- Processing request from {row.get('name')} <{row.get('email')}>")
        send_email(row)
        mark_as_emailed(client, row.get("id"))
    print("Done.")


if __name__ == "__main__":
    main()
