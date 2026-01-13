export type EssayFeedback = {
  overall_summary: string;
  rubric_scores?: {
    Hook: number;
    Specifics: number;
    Reflection: number;
    Voice: number;
    Polish: number;
    Fit: number;
  };
  strengths: string[];
  improvements: string[];
  concrete_rewrites: Array<{ before: string; after: string }>;
  score_1_to_10?: number | null;
  fit_notes?: string | null;
};

const getGeminiApiKey = (): string | null => {
  const key = (import.meta as any).env?.VITE_GEMINI_API_KEY as string | undefined;
  const trimmed = (key ?? "").trim();
  return trimmed ? trimmed : null;
};

const buildPrompt = (input: {
  essay: string;
  prompt?: string | null;
  context?: Record<string, any> | null;
  essayType?: "personal" | "supplement" | "piq" | null;
}): string => {
  const rubricRules = [
    "Use the 6-category rubric below and score each category 1-10 (integers).",
    "Be specific and actionable. Avoid generic praise; show what to change.",
    "Preserve the student's voice; do not rewrite the entire essay.",
    "Return ONLY valid JSON matching the schema.",
  ].join(" ");

  const rubricCategories = [
    "Hook: does the first ~1–3 sentences pull you in?",
    "Specifics: concrete images/details, not abstractions.",
    "Reflection: what it means; insight/change, not just events.",
    "Voice: distinct tone, phrasing, rhythm, personality.",
    "Polish: grammar/clarity/flow; no distracting mistakes.",
    "Fit: answers the prompt + clear direction; for PS = trajectory, for supplements/PIQs = school/major/prompt specificity.",
  ].join("\n");

  const schema = {
    overall_summary: "string (2-4 sentences)",
    rubric_scores: {
      Hook: "integer 1-10",
      Specifics: "integer 1-10",
      Reflection: "integer 1-10",
      Voice: "integer 1-10",
      Polish: "integer 1-10",
      Fit: "integer 1-10",
    },
    strengths: ["string"],
    improvements: ["string"],
    concrete_rewrites: [{ before: "string", after: "string" }],
    score_1_to_10: "number | null",
    fit_notes: "string | null (1-3 sentences)",
  };

  const essayType = input.essayType ?? null;
  const typeGuidance =
    essayType === "personal"
      ? "Essay type: Personal Statement (Fit focuses on trajectory / direction, not school-specific details)."
      : essayType === "supplement"
      ? "Essay type: Supplemental (Fit focuses on directly answering the prompt + specific, credible school/major alignment)."
      : essayType === "piq"
      ? "Essay type: UC PIQ (Fit focuses on directly answering the PIQ prompt with clear evidence)."
      : "Essay type: Unknown (infer best-fit expectations from the prompt text).";

  return `You are a college admissions essay coach.\n\nRUBRIC RULES: ${rubricRules}\n\nSCORING RUBRIC (1-10 each):\n${rubricCategories}\n\n${typeGuidance}\n\nSCHEMA:\n${JSON.stringify(
    schema,
    null,
    2
  )}\n\nPROMPT (optional): ${input.prompt ?? ""}\n\nCONTEXT (optional): ${JSON.stringify(
    input.context ?? {},
    null,
    2
  )}\n\nESSAY:\n${input.essay}\n\nReturn ONLY the JSON object.`;
};

export const requestEssayFeedback = async (input: {
  essay: string;
  prompt?: string | null;
  context?: Record<string, any> | null;
  essayType?: "personal" | "supplement" | "piq" | null;
}): Promise<EssayFeedback> => {
  const essay = String(input.essay ?? "").trim();
  if (!essay) throw new Error("Essay text is empty.");

  // Client-side Gemini call (WARNING: API key is exposed in the built JS bundle).
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error("Essay feedback is not configured (missing VITE_GEMINI_API_KEY).");
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: buildPrompt({ ...input, essay }) }] }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    }
  );
  if (!res.ok) {
    const details = await res.text();
    throw new Error(`Gemini request failed: ${res.status} ${details}`);
  }
  const data = await res.json();
  const text =
    data?.candidates?.[0]?.content?.parts?.[0]?.text ??
    data?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text).join("") ??
    "";
  if (!text) throw new Error("No response text from Gemini.");
  return JSON.parse(text) as EssayFeedback;
};
