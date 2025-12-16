// Supabase Edge Function: essay-feedback
// Stores the Gemini API key server-side. Requires an authenticated user.
//
// Setup (Supabase Dashboard):
// - Deploy this function as `essay-feedback`
// - Set secrets:
//   - GEMINI_API_KEY = <your Gemini key>
//   - BETA_EMAIL_ALLOWLIST = comma-separated emails (optional)
//
// Client calls: `supabase.functions.invoke("essay-feedback", { body: { essay, prompt, context } })`

import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type RequestBody = {
  essay: string;
  prompt?: string | null;
  context?: Record<string, unknown> | null;
};

const allowlisted = (email: string | null): boolean => {
  const list = (Deno.env.get("BETA_EMAIL_ALLOWLIST") ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (!list.length) return true;
  const normalized = (email ?? "").trim().toLowerCase();
  if (!normalized) return false;
  return list.includes(normalized);
};

const buildPrompt = (body: RequestBody): string => {
  const rubric = [
    "Be specific and actionable.",
    "Focus on voice, clarity, structure, and evidence.",
    "Avoid generic praise; show what to change.",
    "Return ONLY valid JSON matching the schema.",
  ].join(" ");

  const schema = {
    overall_summary: "string (2-4 sentences)",
    strengths: ["string"],
    improvements: ["string"],
    concrete_rewrites: [{ before: "string", after: "string" }],
    score_1_to_10: "number | null",
  };

  return `You are a college admissions essay coach.\n\nRUBRIC: ${rubric}\n\nSCHEMA:\n${JSON.stringify(
    schema,
    null,
    2,
  )}\n\nPROMPT (optional): ${body.prompt ?? ""}\n\nCONTEXT (optional): ${JSON.stringify(
    body.context ?? {},
    null,
    2,
  )}\n\nESSAY:\n${body.essay}\n\nReturn ONLY the JSON object.`;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const authHeader = req.headers.get("Authorization") ?? "";

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const email = userData.user.email ?? null;
    if (!allowlisted(email)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("GEMINI_API_KEY") ?? "";
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Missing GEMINI_API_KEY" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as RequestBody;
    const essay = String(body.essay ?? "").trim();
    if (!essay) {
      return new Response(JSON.stringify({ error: "Essay text is empty" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: buildPrompt({ ...body, essay }) }] }],
          generationConfig: { responseMimeType: "application/json" },
        }),
      },
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      return new Response(JSON.stringify({ error: "Gemini error", details: errText }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = await geminiRes.json();
    const text =
      payload?.candidates?.[0]?.content?.parts?.[0]?.text ??
      payload?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text).join("") ??
      "";

    const parsed = JSON.parse(text);
    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: "Unexpected error", details: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

