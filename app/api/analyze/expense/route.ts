import { NextRequest, NextResponse } from "next/server";
import { categories, mockExpenseAnalysis, parseExpenseJson } from "../../../../lib/analyzers/expense";

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

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

  const analysis = parseExpenseJson(text);
  if (!categories.includes(analysis.category)) analysis.category = "miscellaneous";
  const lowerPrompt = prompt.toLowerCase();
  if (!lowerPrompt.includes("$") && !lowerPrompt.includes("usd") && !lowerPrompt.includes("dollar")) {
    analysis.currency = analysis.currency && analysis.currency !== "USD" ? analysis.currency.toUpperCase() : "INR";
  }
  return NextResponse.json({ analysis, provider: "gemini" });
}
