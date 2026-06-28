import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { callGeminiAnalysis } from "../../../../lib/gemini";
import { ExpenseAnalysis, categories, mockExpenseAnalysis } from "../../../../lib/analyzers/expense";

const MAX_PROMPT_LENGTH = 2000;

function getSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
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
  // Auth check: verify the user is authenticated before allowing AI calls
  const supabase = getSupabaseServerClient();
  if (supabase) {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "") ?? request.cookies.get("sb-access-token")?.value;
    if (token) {
      const { data: { user } } = await supabase.auth.getUser(token);
      if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }
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
