import { NextRequest, NextResponse } from "next/server";
import { callGeminiAnalysis, serializeProfile } from "../../../../lib/gemini";
import { WorkoutAnalysis, mockWorkoutAnalysis } from "../../../../lib/analyzers/workout";

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
  const { prompt = "", bodyWeightKg = 78, profile = {} } = await request.json();

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
