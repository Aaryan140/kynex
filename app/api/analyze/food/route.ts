import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { callGeminiAnalysis, serializeProfile } from "../../../../lib/gemini";
import { FoodAnalysis, mockFoodAnalysis } from "../../../../lib/analyzers/food";

const MAX_PROMPT_LENGTH = 2000;
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB base64 limit

function getSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
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
  // Auth check: verify the user is authenticated before allowing AI calls
  const supabase = getSupabaseServerClient();
  if (supabase) {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "") ?? request.cookies.get("sb-access-token")?.value;
    if (token) {
      const { data: { user } } = await supabase.auth.getUser(token);
      if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }
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
