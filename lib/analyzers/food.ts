export type FoodAnalysis = {
  title: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  score: number;
  confidence: number;
  notes: string;
};

export function mockFoodAnalysis(prompt: string): FoodAnalysis {
  const lower = prompt.toLowerCase();
  return {
    title: prompt.trim() || "Smashed avocado & egg",
    calories: lower.includes("salad") ? 330 : lower.includes("rice") ? 620 : 412,
    protein: lower.includes("whey") ? 38 : lower.includes("chicken") ? 46 : 18,
    carbs: lower.includes("rice") ? 58 : 32,
    fat: lower.includes("fried") ? 30 : 24,
    score: lower.includes("fried") ? 6.4 : 8.8,
    confidence: 0.82,
    notes: "Demo estimate. Add a Gemini API key for live AI analysis."
  };
}

export function parseFoodJson(text: string): FoodAnalysis {
  const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  return JSON.parse(cleaned) as FoodAnalysis;
}
