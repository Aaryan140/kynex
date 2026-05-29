import { NextRequest, NextResponse } from "next/server";

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

function parseJson(text: string): WorkoutAnalysis {
  const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  return JSON.parse(cleaned) as WorkoutAnalysis;
}

export async function POST(request: NextRequest) {
  const { prompt = "", bodyWeightKg = 78, profile = {} } = await request.json();
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ analysis: mockWorkoutAnalysis(prompt), provider: "mock" });
  }

  const response = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
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
                  heightCm: profile.heightCm,
                  weightKg: profile.weightKg,
                  goal: profile.goal,
                  trainingLevel: profile.trainingLevel,
                  dailyCalorieTarget: profile.dailyCalorieTarget
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

  if (!response.ok) {
    const detail = await response.text();
    return NextResponse.json(
      { error: "Gemini workout analysis failed", detail, analysis: mockWorkoutAnalysis(prompt), provider: "mock-fallback" },
      { status: 200 }
    );
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    return NextResponse.json({ analysis: mockWorkoutAnalysis(prompt), provider: "mock-fallback" });
  }

  return NextResponse.json({ analysis: parseJson(text), provider: "gemini" });
}
