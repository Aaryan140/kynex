import { NextRequest, NextResponse } from "next/server";
import { callGeminiAnalysis } from "../../../../lib/gemini";

type ExpenseAnalysis = {
  title: string;
  amount: number;
  currency: string;
  category: string;
  merchant: string;
  confidence: number;
  notes: string;
};

const categories = ["food", "groceries", "transport", "shopping", "health", "fitness", "bills", "entertainment", "travel", "education", "miscellaneous"];

function mockExpenseAnalysis(prompt: string): ExpenseAnalysis {
  const lower = prompt.toLowerCase();
  const amount = Number(lower.match(/(?:rs|inr|\$)?\s*(\d+(?:\.\d+)?)/)?.[1] ?? 0);
  const category = lower.includes("uber") || lower.includes("metro") || lower.includes("cab") ? "transport" : lower.includes("coffee") || lower.includes("lunch") || lower.includes("dinner") ? "food" : lower.includes("gym") ? "fitness" : "miscellaneous";
  return {
    title: prompt.trim() || "New expense",
    amount,
    currency: lower.includes("$") ? "USD" : "INR",
    category,
    merchant: "",
    confidence: amount ? 0.72 : 0.45,
    notes: "Fallback estimate. Edit amount/category before saving."
  };
}

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING" },
    amount: { type: "NUMBER" },
    currency: { type: "STRING" },
    category: { type: "STRING" },
    merchant: { type: "STRING" },
    confidence: { type: "NUMBER" },
    notes: { type: "STRING" }
  },
  required: ["title", "amount", "currency", "category", "merchant", "confidence", "notes"]
};

export async function POST(request: NextRequest) {
  const { prompt = "" } = await request.json();

  const result = await callGeminiAnalysis<ExpenseAnalysis>({
    parts: [
      {
        text:
          "Analyze this expense log for a personal expense tracker in India. Return only JSON with title, amount, currency, category, merchant, confidence, notes. Use INR unless the user explicitly names another currency or uses a currency symbol like $. Category must be one of: " +
          categories.join(", ") +
          ". If the category is unclear, use miscellaneous. If amount is unclear, use 0 and explain in notes. Expense text: " +
          prompt
      }
    ],
    responseSchema: RESPONSE_SCHEMA,
    temperature: 0.1,
    mockFn: () => mockExpenseAnalysis(prompt),
    errorLabel: "Gemini expense analysis"
  });

  if (result.provider === "gemini") {
    if (!categories.includes(result.analysis.category)) result.analysis.category = "miscellaneous";
    const lowerPrompt = prompt.toLowerCase();
    if (!lowerPrompt.includes("$") && !lowerPrompt.includes("usd") && !lowerPrompt.includes("dollar")) {
      result.analysis.currency = result.analysis.currency && result.analysis.currency !== "USD" ? result.analysis.currency.toUpperCase() : "INR";
    }
  }

  return NextResponse.json(result);
}
