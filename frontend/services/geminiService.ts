import type { StudentProfile, University, AIAnalysisResponse } from "../types";
import { SYSTEM_INSTRUCTION } from "../constants";

const getApiKey = (): string => {
  const key =
    (import.meta as any).env?.VITE_GEMINI_API_KEY ||
    (typeof process !== "undefined" ? process.env.VITE_GEMINI_API_KEY : undefined);
  if (!key) {
    throw new Error("Gemini API key not found. Set VITE_GEMINI_API_KEY in your env.");
  }
  return key;
};

export const analyzeAdmissionProfile = async (
  student: StudentProfile,
  university: University
): Promise<AIAnalysisResponse> => {
  const apiKey = getApiKey();

  // Format Activities
  const activitiesString =
    student.activities.length > 0
      ? student.activities
          .map((a) => `- ${a.name} (${a.role}, ${a.level})`)
          .join("\n")
      : "None listed";

  // Format Demographics
  const demographicsString =
    student.demographics.length > 0 ? student.demographics.join(", ") : "Not specified";

  const satTotal =
    (parseInt(student.satMath, 10) || 0) + (parseInt(student.satEBRW, 10) || 0);
  const satDisplay =
    satTotal > 0
      ? `${satTotal} (Math: ${student.satMath || "N/A"}, EBRW: ${
          student.satEBRW || "N/A"
        })`
      : "N/A";
  const actDisplay = student.actScore || "N/A";

  const payload = {
    student_profile: {
      name: `${student.firstName} ${student.lastName}`.trim(),
      location: {
        city: student.city,
        country: student.country,
      },
      academics: {
        gpa: student.gpa,
        class_rank: student.classRank,
        test_scores: {
          sat_total: satTotal || null,
          sat_math: student.satMath || null,
          sat_ebrw: student.satEBRW || null,
          act_composite: student.actScore || null,
        },
        intended_major: student.intendedMajor || "Undecided",
      },
      demographics: student.demographics,
      activities: student.activities.map((a) => ({
        name: a.name,
        role: a.role,
        level: a.level,
      })),
      essay_draft: student.essayDraft || "",
    },
    target_university: {
      name: university.name,
      acceptance_rate: (university as any).acceptance_rate ?? null,
      admissions_stats: {},
      type: null,
    },
    // Keep a human-readable block as additional context.
    human_readable_summary: {
      sat_display: satDisplay,
      act_display: actDisplay,
      activities: activitiesString,
      demographics: demographicsString,
    },
  };

  const prompt = `Here is the data for the analysis:\n\n${JSON.stringify(
    payload,
    null,
    2
  )}\n\nReturn ONLY the JSON object described in the system instruction.`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
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
  if (!text) throw new Error("No response text from Gemini");

  return JSON.parse(text) as AIAnalysisResponse;
};
