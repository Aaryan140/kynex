export type ExpenseAnalysis = {
  title: string;
  amount: number;
  currency: string;
  category: string;
  merchant: string;
  confidence: number;
  notes: string;
};

export const categories = ["food", "groceries", "transport", "shopping", "health", "fitness", "bills", "entertainment", "travel", "education", "miscellaneous"];

export function mockExpenseAnalysis(prompt: string): ExpenseAnalysis {
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

export function parseExpenseJson(text: string): ExpenseAnalysis {
  const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  return JSON.parse(cleaned) as ExpenseAnalysis;
}
