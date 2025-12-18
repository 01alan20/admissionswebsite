import json
import os
import smtplib
from email.message import EmailMessage
from typing import Any, Dict, List, Optional

import requests


def get_env(name: str, required: bool = True) -> str:
    value = os.getenv(name, "").strip()
    if required and not value:
        raise SystemExit(f"Missing required env var: {name}")
    return value


def fetch_new_requests(supabase_url: str, service_role_key: str) -> List[Dict[str, Any]]:
    url = f"{supabase_url.rstrip('/')}/rest/v1/contact_requests"
    params = {
        "select": "id,created_at,name,email,phone,grad_year,grade_level,message,source_page,user_id,status",
        "status": "eq.new",
        "order": "created_at.asc",
        "limit": "200",
    }
    headers = {
        "apikey": service_role_key,
        "Authorization": f"Bearer {service_role_key}",
        "Accept": "application/json",
    }
    r = requests.get(url, headers=headers, params=params, timeout=30)
    r.raise_for_status()
    data = r.json()
    if not isinstance(data, list):
        return []
    return data


def mark_emailed(supabase_url: str, service_role_key: str, ids: List[str]) -> None:
    if not ids:
        return
    url = f"{supabase_url.rstrip('/')}/rest/v1/contact_requests"
    headers = {
        "apikey": service_role_key,
        "Authorization": f"Bearer {service_role_key}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }
    # Patch all matching ids
    # Using `in.(...)` filter.
    filter_value = ",".join(ids)
    params = {"id": f"in.({filter_value})"}
    r = requests.patch(url, headers=headers, params=params, data=json.dumps({"status": "emailed"}), timeout=30)
    r.raise_for_status()


def build_email_body(rows: List[Dict[str, Any]]) -> str:
    lines: List[str] = []
    lines.append(f"New contact requests: {len(rows)}")
    lines.append("")
    for row in rows:
        lines.append("-" * 72)
        lines.append(f"ID: {row.get('id')}")
        lines.append(f"Created: {row.get('created_at')}")
        lines.append(f"Name: {row.get('name')}")
        lines.append(f"Email: {row.get('email')}")
        lines.append(f"Phone: {row.get('phone') or ''}")
        lines.append(f"Grad year: {row.get('grad_year') or ''}")
        lines.append(f"Grade level: {row.get('grade_level') or ''}")
        lines.append(f"Source: {row.get('source_page') or ''}")
        lines.append("")
        lines.append("Message:")
        lines.append(str(row.get("message") or "").strip())
        lines.append("")
    return "\n".join(lines).strip() + "\n"


def send_email(
    smtp_host: str,
    smtp_port: int,
    smtp_user: str,
    smtp_pass: str,
    mail_from: str,
    mail_to: str,
    subject: str,
    body: str,
) -> None:
    msg = EmailMessage()
    msg["From"] = mail_from
    msg["To"] = mail_to
    msg["Subject"] = subject
    msg.set_content(body)

    with smtplib.SMTP(smtp_host, smtp_port, timeout=30) as s:
        s.starttls()
        if smtp_user:
            s.login(smtp_user, smtp_pass)
        s.send_message(msg)


def main() -> None:
    supabase_url = get_env("SUPABASE_URL")
    service_role_key = get_env("SUPABASE_SERVICE_ROLE_KEY")
    smtp_host = get_env("SMTP_HOST")
    smtp_port = int(get_env("SMTP_PORT"))
    smtp_user = get_env("SMTP_USER", required=False)
    smtp_pass = get_env("SMTP_PASS", required=False)
    mail_to = get_env("CONTACT_TO_EMAIL")
    mail_from = get_env("CONTACT_FROM_EMAIL")

    rows = fetch_new_requests(supabase_url, service_role_key)
    if not rows:
        print("No new contact requests.")
        return

    body = build_email_body(rows)
    subject = f"[SeeThroughAdmissions] {len(rows)} new contact request(s)"
    send_email(
        smtp_host=smtp_host,
        smtp_port=smtp_port,
        smtp_user=smtp_user,
        smtp_pass=smtp_pass,
        mail_from=mail_from,
        mail_to=mail_to,
        subject=subject,
        body=body,
    )

    ids = [str(r.get("id")) for r in rows if r.get("id") is not None]
    mark_emailed(supabase_url, service_role_key, ids)
    print(f"Emailed and marked {len(ids)} request(s) as emailed.")


if __name__ == "__main__":
    main()

