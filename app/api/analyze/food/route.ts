import { NextRequest, NextResponse } from "next/server";
import { hasAuthenticatedUser, imageDataUrlParts, objectValue, parseJsonOrFallback, readJsonBody, textValue } from "../_shared";

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

type FoodAnalysis = {
  title: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  score: number;
  confidence: number;
  notes: string;
};

function mockFoodAnalysis(prompt: string): FoodAnalysis {
  const lower = prompt.toLowerCase();
  return {
    title: prompt.trim() || "Smashed avocado & egg",
    calories: lower.includes("salad") ? 330 : lower.includes("rice") ? 620 : 412,
    protein: lower.includes("whey") ? 38 : lower.includes("chicken") ? 46 : 18,
    carbs: lower.includes("rice") ? 58 : 32,
    fat: lower.includes("fried") ? 30 : 24,
    score: lower.includes("fried") ? 6.4 : 8.8,
    confidence: 0.82,
    notes: "Demo estimate. Add a Gemini API key for live AI analysis."
  };
}

export async function POST(request: NextRequest) {
  const body = await readJsonBody(request);
  const prompt = textValue(body.prompt);
  const profile = objectValue(body.profile);
  const apiKey = process.env.GEMINI_API_KEY;
  const fallback = mockFoodAnalysis(prompt);

  if (!apiKey) {
    return NextResponse.json({ analysis: fallback, provider: "mock" });
  }

  if (!(await hasAuthenticatedUser(request))) {
    return NextResponse.json({ error: "Authentication is required for AI analysis." }, { status: 401 });
  }

  const parts: Array<Record<string, unknown>> = [
    {
      text:
        "Analyze this food log. Return only JSON with title, calories, protein, carbs, fat, score, confidence, notes. Score is 0-10 for overall nutrition quality. confidence is 0-1. Be conservative and mention uncertainty in notes. User text: " +
        prompt +
        ". User profile context for personalization: " +
        JSON.stringify({
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
        })
    }
  ];

  const image = imageDataUrlParts(body.imageDataUrl);
  if (image) {
    parts.push({ inline_data: { mime_type: image.mimeType, data: image.data } });
  }

  let response: Response;
  try {
    response = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.2,
          responseSchema: {
            type: "OBJECT",
            properties: {
              title: { type: "STRING" },
              calories: { type: "INTEGER" },
              protein: { type: "NUMBER" },
              carbs: { type: "NUMBER" },
              fat: { type: "NUMBER" },
              score: { type: "NUMBER" },
              confidence: { type: "NUMBER" },
              notes: { type: "STRING" }
            },
            required: ["title", "calories", "protein", "carbs", "fat", "score", "confidence", "notes"]
          }
        }
      })
    });
  } catch {
    return NextResponse.json({ error: "Gemini food analysis unavailable", analysis: fallback, provider: "mock-fallback" });
  }

  if (!response.ok) {
    return NextResponse.json(
      { error: "Gemini food analysis failed", analysis: fallback, provider: "mock-fallback" },
      { status: 200 }
    );
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    return NextResponse.json({ analysis: fallback, provider: "mock-fallback" });
  }

  return NextResponse.json({ analysis: parseJsonOrFallback(text, fallback), provider: "gemini" });
}
