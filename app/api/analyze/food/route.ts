import { NextRequest, NextResponse } from "next/server";
import { mockFoodAnalysis, parseFoodJson } from "../../../../lib/analyzers/food";

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

export async function POST(request: NextRequest) {
  const { prompt = "", imageDataUrl = "", profile = {} } = await request.json();
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ analysis: mockFoodAnalysis(prompt), provider: "mock" });
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

  if (imageDataUrl && typeof imageDataUrl === "string" && imageDataUrl.includes(",")) {
    const [header, data] = imageDataUrl.split(",");
    const mimeType = header.match(/data:(.*);base64/)?.[1] || "image/jpeg";
    parts.push({ inline_data: { mime_type: mimeType, data } });
  }

  const response = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
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

  if (!response.ok) {
    const detail = await response.text();
    return NextResponse.json(
      { error: "Gemini food analysis failed", detail, analysis: mockFoodAnalysis(prompt), provider: "mock-fallback" },
      { status: 200 }
    );
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    return NextResponse.json({ analysis: mockFoodAnalysis(prompt), provider: "mock-fallback" });
  }

  return NextResponse.json({ analysis: parseFoodJson(text), provider: "gemini" });
}
