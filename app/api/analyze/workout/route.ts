import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { callGeminiAnalysis, serializeProfile } from "../../../../lib/gemini";
import { WorkoutAnalysis, mockWorkoutAnalysis } from "../../../../lib/analyzers/workout";

const MAX_PROMPT_LENGTH = 2000;

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
    duration: { type: "INTEGER" },
    calories: { type: "INTEGER" },
    effort: { type: "STRING" },
    score: { type: "NUMBER" },
    movements: { type: "ARRAY", items: { type: "STRING" } },
    notes: { type: "STRING" }
  },
  required: ["title", "duration", "calories", "effort", "score", "movements", "notes"]
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
  const bodyWeightKg = Math.max(20, Math.min(300, Number(body.bodyWeightKg) || 78));
  const profile = (typeof body.profile === "object" && body.profile !== null) ? body.profile as Record<string, unknown> : {};

  const result = await callGeminiAnalysis<WorkoutAnalysis>({
    parts: [
      {
        text:
          "Analyze this workout log for a fitness tracker. Return only JSON with title, duration, calories, effort, score, movements, notes. Score is 0-10 for workout quality and recovery impact. Use body weight kg for calorie estimate when useful: " +
          bodyWeightKg +
          ". User profile context for personalization: " +
          serializeProfile(profile) +
          ". Workout text: " +
          prompt
      }
    ],
    responseSchema: RESPONSE_SCHEMA,
    mockFn: () => mockWorkoutAnalysis(prompt),
    errorLabel: "Gemini workout analysis"
  });

  return NextResponse.json(result);
}
