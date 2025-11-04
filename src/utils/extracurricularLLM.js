import * as webllm from '@mlc-ai/web-llm';

let enginePromise = null;
const MODEL_ID = 'Llama-3.2-3B-Instruct-q4f16_1-MLC';

async function getEngine() {
  if (!enginePromise) {
    enginePromise = webllm.CreateMLCEngine(MODEL_ID, {
      initProgressCallback: () => {}
    });
  }
  return enginePromise;
}

export async function summarizeExtracurriculars(rawText) {
  if (!rawText) return '';
  try {
    const engine = await getEngine();
    const prompt = `Summarize the following extracurricular for a college admissions profile. Provide a JSON object with keys headline (short achievement title) and narrative (2 sentence impact summary). Extracurricular: ${rawText}`;
    const output = await engine.chat.completions.create({
      messages: [
        { role: 'system', content: 'You are an admissions counselor writing concise accomplishment bullets.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 256
    });
    const content = output.choices?.[0]?.message?.content?.[0]?.text || '';
    try {
      return JSON.parse(content);
    } catch {
      return { headline: 'Activity highlight', narrative: content || rawText };
    }
  } catch (error) {
    console.warn('LLM summary failed, returning fallback', error);
    return { headline: 'Activity highlight', narrative: rawText };
  }
}
