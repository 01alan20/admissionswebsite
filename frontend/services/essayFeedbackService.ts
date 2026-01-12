export type EssayFeedback = {
  overall_summary: string;
  strengths: string[];
  improvements: string[];
  concrete_rewrites: Array<{ before: string; after: string }>;
  score_1_to_10?: number | null;
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
}): string => {
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
