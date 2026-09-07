import { NextRequest, NextResponse } from "next/server";
import { hasAuthenticatedUser, needsAuthenticatedUser } from "../_shared";
import { callGeminiAnalysis, serializeProfile } from "../../../../lib/gemini";
import { FoodAnalysis, mockFoodAnalysis } from "../../../../lib/analyzers/food";

const MAX_PROMPT_LENGTH = 2000;
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB base64 limit

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
  if (needsAuthenticatedUser() && !(await hasAuthenticatedUser(request))) {
    return NextResponse.json({ error: "Sign in is required for AI analysis." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const prompt = typeof body.prompt === "string" ? body.prompt.slice(0, MAX_PROMPT_LENGTH) : "";
  const rawImageDataUrl = typeof body.imageDataUrl === "string" ? body.imageDataUrl : "";
  const imageDataUrl = rawImageDataUrl.length <= MAX_IMAGE_SIZE_BYTES ? rawImageDataUrl : "";
  const profile = (typeof body.profile === "object" && body.profile !== null) ? body.profile as Record<string, unknown> : {};

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
