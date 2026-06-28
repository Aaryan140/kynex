const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

export function parseGeminiJson<T>(text: string): T {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  return JSON.parse(cleaned) as T;
}

export function serializeProfile(profile: Record<string, unknown>): string {
  return JSON.stringify({
    age: profile.age,
    sex: profile.sex,
    heightCm: profile.heightCm,
    weightKg: profile.weightKg,
    goal: profile.goal,
    trainingLevel: profile.trainingLevel,
    activityLevel: profile.activityLevel,
    dailyCalorieTarget: profile.dailyCalorieTarget,
    proteinTarget: profile.proteinTarget,
    carbsTarget: profile.carbsTarget,
    fatTarget: profile.fatTarget
  });
}

type GeminiAnalysisOptions<T> = {
  parts: Array<Record<string, unknown>>;
  responseSchema: Record<string, unknown>;
  temperature?: number;
  mockFn: () => T;
  errorLabel: string;
};

type GeminiAnalysisResult<T> = {
  analysis: T;
  provider: string;
  error?: string;
};

export async function callGeminiAnalysis<T>(
  options: GeminiAnalysisOptions<T>
): Promise<GeminiAnalysisResult<T>> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return { analysis: options.mockFn(), provider: "mock" };
  }

  let response: Response;
  try {
    response = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: options.parts }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: options.temperature ?? 0.2,
          responseSchema: options.responseSchema
        }
      })
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Network request failed";
    console.error("Failed to reach Gemini API:", message);
    return {
      analysis: options.mockFn(),
      provider: "mock-fallback",
      error: "Failed to reach Gemini API"
    };
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "Unable to read error response");
    console.error(`${options.errorLabel} failed:`, response.status, detail);
    return {
      analysis: options.mockFn(),
      provider: "mock-fallback",
      error: "AI analysis temporarily unavailable"
    };
  }

  let data: Record<string, unknown>;
  try {
    data = await response.json();
  } catch {
    return {
      analysis: options.mockFn(),
      provider: "mock-fallback",
      error: "Gemini returned invalid JSON"
    };
  }

  const candidates = data.candidates as
    | Array<{ content?: { parts?: Array<{ text?: string }> } }>
    | undefined;
  const text = candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    return { analysis: options.mockFn(), provider: "mock-fallback" };
  }

  try {
    return { analysis: parseGeminiJson<T>(text), provider: "gemini" };
  } catch {
    return { analysis: options.mockFn(), provider: "mock-fallback" };
  }
}
