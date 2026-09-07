import { NextRequest, NextResponse } from "next/server";
import { hasAuthenticatedUser, needsAuthenticatedUser } from "../_shared";
import { callGeminiAnalysis, serializeProfile } from "../../../../lib/gemini";
import { WorkoutAnalysis, mockWorkoutAnalysis } from "../../../../lib/analyzers/workout";

const MAX_PROMPT_LENGTH = 2000;

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
