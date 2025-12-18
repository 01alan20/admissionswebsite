// Supabase Edge Function: contact-request
// Stores a contact request in `public.contact_requests` and (optionally) emails it.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Payload = {
  name: string;
  email: string;
  phone?: string | null;
  grad_year?: string | null;
  grade_level?: string | null;
  interests?: string | null;
  budget_range?: string | null;
  location_preferences?: string | null;
  message: string;
  source_page?: string | null;
  user_id?: string | null;
  profile_snapshot?: Record<string, unknown> | null;
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json(405, { ok: false, error: "Method not allowed" });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return json(500, { ok: false, error: "Missing Supabase env vars" });
    }

    const payload = (await req.json()) as Payload;
    const name = String(payload?.name ?? "").trim();
    const email = String(payload?.email ?? "").trim();
    const message = String(payload?.message ?? "").trim();
    if (name.length < 2) return json(400, { ok: false, error: "Name required" });
    if (!/^\S+@\S+\.\S+$/.test(email)) return json(400, { ok: false, error: "Valid email required" });
    if (message.length < 10) return json(400, { ok: false, error: "Message required" });

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const insertRow = {
      name,
      email,
      phone: payload.phone ?? null,
      grad_year: payload.grad_year ?? null,
      grade_level: payload.grade_level ?? null,
      interests: payload.interests ?? null,
      budget_range: payload.budget_range ?? null,
      location_preferences: payload.location_preferences ?? null,
      message,
      source_page: payload.source_page ?? null,
      user_id: payload.user_id ?? null,
      profile_snapshot: payload.profile_snapshot ?? null,
      status: "new",
    };

    const { data: created, error: insertErr } = await supabase
      .from("contact_requests")
      .insert(insertRow)
      .select("id, created_at")
      .maybeSingle();

    if (insertErr) {
      return json(500, { ok: false, error: `Insert failed: ${insertErr.message}` });
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
    const CONTACT_TO_EMAIL = Deno.env.get("CONTACT_TO_EMAIL") ?? "";
    const CONTACT_FROM_EMAIL = Deno.env.get("CONTACT_FROM_EMAIL") ?? "";

    let emailed = false;
    if (RESEND_API_KEY && CONTACT_TO_EMAIL && CONTACT_FROM_EMAIL) {
      try {
        const resend = new Resend(RESEND_API_KEY);
        const subject = `New contact request: ${name}`;
        const html = `
          <h2>New contact request</h2>
          <p><strong>Name:</strong> ${escapeHtml(name)}</p>
          <p><strong>Email:</strong> ${escapeHtml(email)}</p>
          <p><strong>Phone:</strong> ${escapeHtml(String(payload.phone ?? ""))}</p>
          <p><strong>Grad year:</strong> ${escapeHtml(String(payload.grad_year ?? ""))}</p>
          <p><strong>Grade level:</strong> ${escapeHtml(String(payload.grade_level ?? ""))}</p>
          <p><strong>Source page:</strong> ${escapeHtml(String(payload.source_page ?? ""))}</p>
          <hr />
          <pre style="white-space:pre-wrap;font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;">${escapeHtml(message)}</pre>
          <hr />
          <p><strong>Supabase row id:</strong> ${escapeHtml(String(created?.id ?? ""))}</p>
        `;
        await resend.emails.send({
          from: CONTACT_FROM_EMAIL,
          to: CONTACT_TO_EMAIL,
          reply_to: email,
          subject,
          html,
        });
        emailed = true;
      } catch {
        emailed = false;
      }
    }

    return json(200, { ok: true, id: created?.id ?? null, emailed });
  } catch (e) {
    return json(500, { ok: false, error: (e as Error)?.message ?? "Unknown error" });
  }
});

function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

