const getGeminiApiKey = (): string | null => {
  const key = (import.meta as any).env?.VITE_GEMINI_API_KEY as string | undefined;
  const trimmed = (key ?? "").trim();
  return trimmed ? trimmed : null;
};

const clampWordCount = (value: unknown, fallback: number): number => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const int = Math.floor(n);
  if (int < 100) return 100;
  if (int > 1500) return 1500;
  return int;
};

const countWords = (text: string): number => {
  const cleaned = String(text ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return 0;
  return cleaned.split(" ").length;
};

const enforceWordCap = (text: string, cap: number): string => {
  const cleaned = String(text ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "";
  const words = cleaned.split(" ").filter(Boolean);
  if (words.length <= cap) return cleaned;

  // Prefer ending on a sentence boundary near the cap.
  const sentenceEnd = /[.!?][\"')\]]*$/;
  const start = Math.max(0, cap - 60);
  for (let i = cap - 1; i >= start; i--) {
    if (sentenceEnd.test(words[i])) {
      return words.slice(0, i + 1).join(" ");
    }
  }
  return words.slice(0, cap).join(" ");
};

const buildPrompt = (input: {
  essayType: "personal" | "supplement" | "piq";
  prompt?: string | null;
  targetWordCount: number;
  context: Record<string, any>;
  targetSchools: Array<{ unitid: number; name?: string | null }>;
}): string => {
  const target = clampWordCount(input.targetWordCount, 500);
  const typeGuidance =
    input.essayType === "personal"
      ? [
          "Write a Personal Statement style essay.",
          "Do NOT mention specific school names (unless the user prompt explicitly requires it).",
          "Focus on a clear arc: hook → specifics → reflection → trajectory.",
        ].join(" ")
      : input.essayType === "supplement"
      ? [
          "Write a Supplemental essay that directly answers the prompt.",
          "Use specific, credible alignment with the student's interests and target schools (without inventing facts).",
          "If school-specific details are needed, keep them realistic and general unless the user provided specifics.",
        ].join(" ")
      : [
          "Write a UC PIQ response that directly answers the PIQ prompt.",
          "Prioritize concrete evidence and reflection.",
        ].join(" ");

  const rules = [
    `Hard cap: ${target} words. Do NOT exceed ${target} words.`,
    `Aim for ${Math.max(100, Math.floor(target * 0.95))}-${target} words unless the user prompt explicitly requests otherwise.`,
    "Use ONLY the provided profile context and activities; do not invent awards, jobs, leadership roles, or schools attended.",
    "Sound like a real student with a distinct voice; avoid buzzwords and generic motivational clichés.",
    "Use concrete details (scenes, objects, dialogue snippets) where appropriate.",
    "Return ONLY valid JSON: {\"essay\":\"...\"}.",
  ].join(" ");

  const targets =
    input.targetSchools?.length > 0
      ? input.targetSchools
          .slice(0, 12)
          .map((t) => (t?.name ? `${t.name} (${t.unitid})` : String(t.unitid)))
          .join(", ")
      : "None provided";

  return `You are a college admissions essay writer helping a student draft an essay.\n\nRULES: ${rules}\n\n${typeGuidance}\n\nUSER PROMPT (if any): ${input.prompt ?? ""}\n\nTARGET SCHOOLS: ${targets}\n\nSTUDENT CONTEXT (JSON):\n${JSON.stringify(
    input.context ?? {},
    null,
    2
  )}\n\nReturn ONLY the JSON object.`;
};

export const generateEssayDraft = async (input: {
  essayType: "personal" | "supplement" | "piq";
  prompt?: string | null;
  targetWordCount: number;
  context: Record<string, any>;
  targetSchools: Array<{ unitid: number; name?: string | null }>;
}): Promise<string> => {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error("Essay generation is not configured (missing VITE_GEMINI_API_KEY).");
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: buildPrompt(input) }] }],
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

  const parsed = JSON.parse(text) as { essay?: unknown };
  const target = clampWordCount(input.targetWordCount, 500);
  const essayRaw = String(parsed?.essay ?? "").trim();
  const essay = enforceWordCap(essayRaw, target);
  if (!essay) throw new Error("Gemini returned an empty essay.");
  if (countWords(essay) > target) {
    // Shouldn't happen, but keep a hard cap anyway.
    return enforceWordCap(essay, target);
  }
  return essay;
};
