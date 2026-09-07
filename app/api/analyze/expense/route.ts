import { NextRequest, NextResponse } from "next/server";
import { hasAuthenticatedUser, needsAuthenticatedUser } from "../_shared";
import { callGeminiAnalysis } from "../../../../lib/gemini";
import { ExpenseAnalysis, categories, mockExpenseAnalysis } from "../../../../lib/analyzers/expense";

const MAX_PROMPT_LENGTH = 2000;

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
