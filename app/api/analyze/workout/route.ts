import { NextRequest, NextResponse } from "next/server";
import { mockWorkoutAnalysis, parseWorkoutJson } from "../../../../lib/analyzers/workout";

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

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

  return NextResponse.json({ analysis: parseWorkoutJson(text), provider: "gemini" });
}
