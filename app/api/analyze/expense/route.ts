import { NextRequest, NextResponse } from "next/server";

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

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

function parseJson(text: string): ExpenseAnalysis {
  const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  return JSON.parse(cleaned) as ExpenseAnalysis;
}

export async function POST(request: NextRequest) {
  const { prompt = "" } = await request.json();
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ analysis: mockExpenseAnalysis(prompt), provider: "mock" });
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
                "Analyze this expense log for a personal expense tracker in India. Return only JSON with title, amount, currency, category, merchant, confidence, notes. Use INR unless the user explicitly names another currency or uses a currency symbol like $. Category must be one of: " +
                categories.join(", ") +
                ". If the category is unclear, use miscellaneous. If amount is unclear, use 0 and explain in notes. Expense text: " +
                prompt
            }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.1,
        responseSchema: {
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
        }
      }
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    return NextResponse.json(
      { error: "Gemini expense analysis failed", detail, analysis: mockExpenseAnalysis(prompt), provider: "mock-fallback" },
      { status: 200 }
    );
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    return NextResponse.json({ analysis: mockExpenseAnalysis(prompt), provider: "mock-fallback" });
  }

  const analysis = parseJson(text);
  if (!categories.includes(analysis.category)) analysis.category = "miscellaneous";
  const lowerPrompt = prompt.toLowerCase();
  if (!lowerPrompt.includes("$") && !lowerPrompt.includes("usd") && !lowerPrompt.includes("dollar")) {
    analysis.currency = analysis.currency && analysis.currency !== "USD" ? analysis.currency.toUpperCase() : "INR";
  }
  return NextResponse.json({ analysis, provider: "gemini" });
}
