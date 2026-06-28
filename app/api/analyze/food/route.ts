import { NextRequest, NextResponse } from "next/server";
import { callGeminiAnalysis, serializeProfile } from "../../../../lib/gemini";

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

const RESPONSE_SCHEMA = {
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
};

export async function POST(request: NextRequest) {
  const { prompt = "", imageDataUrl = "", profile = {} } = await request.json();

  const parts: Array<Record<string, unknown>> = [
    {
      text:
        "Analyze this food log. Return only JSON with title, calories, protein, carbs, fat, score, confidence, notes. Score is 0-10 for overall nutrition quality. confidence is 0-1. Be conservative and mention uncertainty in notes. User text: " +
        prompt +
        ". User profile context for personalization: " +
        serializeProfile(profile)
    }
  ];

  if (imageDataUrl && typeof imageDataUrl === "string" && imageDataUrl.includes(",")) {
    const [header, data] = imageDataUrl.split(",");
    const mimeType = header.match(/data:(.*);base64/)?.[1] || "image/jpeg";
    parts.push({ inline_data: { mime_type: mimeType, data } });
  }

  const result = await callGeminiAnalysis<FoodAnalysis>({
    parts,
    responseSchema: RESPONSE_SCHEMA,
    mockFn: () => mockFoodAnalysis(prompt),
    errorLabel: "Gemini food analysis"
  });

  return NextResponse.json(result);
}
