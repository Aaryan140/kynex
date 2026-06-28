export type WorkoutAnalysis = {
  title: string;
  duration: number;
  calories: number;
  effort: string;
  score: number;
  movements: string[];
  notes: string;
};

export function mockWorkoutAnalysis(prompt: string): WorkoutAnalysis {
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

export function parseWorkoutJson(text: string): WorkoutAnalysis {
  const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  return JSON.parse(cleaned) as WorkoutAnalysis;
}
