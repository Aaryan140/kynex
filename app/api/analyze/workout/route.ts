import { NextRequest, NextResponse } from "next/server";
import { callGeminiAnalysis, serializeProfile } from "../../../../lib/gemini";

type WorkoutAnalysis = {
  title: string;
  duration: number;
  calories: number;
  effort: string;
  score: number;
  movements: string[];
  notes: string;
};

function mockWorkoutAnalysis(prompt: string): WorkoutAnalysis {
  const lower = prompt.toLowerCase();
  return {
    title: lower.includes("run") ? "Tempo run" : lower.includes("walk") ? "Zone 2 walk" : "High-intensity power",
    duration: lower.includes("20") ? 20 : lower.includes("60") ? 60 : 45,
    calories: lower.includes("walk") ? 190 : lower.includes("run") ? 610 : 540,
    effort: lower.includes("easy") || lower.includes("walk") ? "Moderate" : "Hard",
    score: lower.includes("easy") ? 7.4 : 8.5,
    movements: lower.includes("run") ? ["Warmup", "Tempo blocks", "Cooldown"] : ["Back squats", "Dumbbell rows", "Walking lunges"],
    notes: "Demo estimate. Add a Gemini API key for live AI analysis."
  };
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
