import { NextRequest, NextResponse } from "next/server";
import { hasAuthenticatedUser, numberValue, objectValue, parseJsonOrFallback, readJsonBody, textValue } from "../_shared";

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

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

export async function POST(request: NextRequest) {
  const body = await readJsonBody(request);
  const prompt = textValue(body.prompt);
  const bodyWeightKg = numberValue(body.bodyWeightKg, 78);
  const profile = objectValue(body.profile);
  const apiKey = process.env.GEMINI_API_KEY;
  const fallback = mockWorkoutAnalysis(prompt);

  if (!apiKey) {
    return NextResponse.json({ analysis: fallback, provider: "mock" });
  }

  if (!(await hasAuthenticatedUser(request))) {
    return NextResponse.json({ error: "Authentication is required for AI analysis." }, { status: 401 });
  }

  let response: Response;
  try {
    response = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text:
                  "Analyze this workout log for a fitness tracker. Return only JSON with title, duration, calories, effort, score, movements, notes. Score is 0-10 for workout quality and recovery impact. Use body weight kg for calorie estimate when useful: " +
                  bodyWeightKg +
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
                  }) +
                  ". Workout text: " +
                  prompt
              }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.2,
          responseSchema: {
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
          }
        }
      })
    });
  } catch {
    return NextResponse.json({ error: "Gemini workout analysis unavailable", analysis: fallback, provider: "mock-fallback" });
  }

  if (!response.ok) {
    return NextResponse.json(
      { error: "Gemini workout analysis failed", analysis: fallback, provider: "mock-fallback" },
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
