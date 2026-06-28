import { describe, it, expect } from "vitest";
import { mockExpenseAnalysis, parseExpenseJson, categories } from "./expense";

describe("categories", () => {
  it("contains expected expense categories", () => {
    expect(categories).toContain("food");
    expect(categories).toContain("transport");
    expect(categories).toContain("fitness");
    expect(categories).toContain("miscellaneous");
  });

  it("has 11 categories", () => {
    expect(categories).toHaveLength(11);
  });
});

describe("mockExpenseAnalysis", () => {
  it("extracts amount from prompt with Rs prefix", () => {
    const result = mockExpenseAnalysis("Lunch Rs 250");
    expect(result.amount).toBe(250);
  });

  it("extracts amount from prompt with $ prefix", () => {
    const result = mockExpenseAnalysis("Coffee $5");
    expect(result.amount).toBe(5);
    expect(result.currency).toBe("USD");
  });

  it("defaults to INR when no dollar sign", () => {
    const result = mockExpenseAnalysis("Metro pass 100");
    expect(result.currency).toBe("INR");
  });

  it("categorizes uber as transport", () => {
    const result = mockExpenseAnalysis("Uber ride 300");
    expect(result.category).toBe("transport");
  });

  it("categorizes metro as transport", () => {
    const result = mockExpenseAnalysis("Metro pass 50");
    expect(result.category).toBe("transport");
  });

  it("categorizes cab as transport", () => {
    const result = mockExpenseAnalysis("Cab to airport 800");
    expect(result.category).toBe("transport");
  });

  it("categorizes coffee as food", () => {
    const result = mockExpenseAnalysis("Morning coffee 180");
    expect(result.category).toBe("food");
  });

  it("categorizes lunch as food", () => {
    const result = mockExpenseAnalysis("Office lunch 250");
    expect(result.category).toBe("food");
  });

  it("categorizes dinner as food", () => {
    const result = mockExpenseAnalysis("Dinner with friends 1200");
    expect(result.category).toBe("food");
  });

  it("categorizes gym as fitness", () => {
    const result = mockExpenseAnalysis("Gym membership 2000");
    expect(result.category).toBe("fitness");
  });

  it("defaults to miscellaneous for unknown categories", () => {
    const result = mockExpenseAnalysis("Random purchase 500");
    expect(result.category).toBe("miscellaneous");
  });

  it("returns amount 0 when no number in prompt", () => {
    const result = mockExpenseAnalysis("bought something");
    expect(result.amount).toBe(0);
  });

  it("sets higher confidence when amount is found", () => {
    const withAmount = mockExpenseAnalysis("Coffee 200");
    const withoutAmount = mockExpenseAnalysis("bought something");
    expect(withAmount.confidence).toBeGreaterThan(withoutAmount.confidence);
  });

  it("uses prompt as title", () => {
    const result = mockExpenseAnalysis("Office lunch 250");
    expect(result.title).toBe("Office lunch 250");
  });

  it("defaults title to 'New expense' for empty prompt", () => {
    const result = mockExpenseAnalysis("");
    expect(result.title).toBe("New expense");
  });

  it("trims whitespace from title", () => {
    const result = mockExpenseAnalysis("  spaced  ");
    expect(result.title).toBe("spaced");
  });

  it("always sets merchant to empty string", () => {
    const result = mockExpenseAnalysis("Starbucks coffee 300");
    expect(result.merchant).toBe("");
  });

  it("includes fallback note", () => {
    const result = mockExpenseAnalysis("test");
    expect(result.notes).toContain("Fallback");
  });

  it("handles decimal amounts", () => {
    const result = mockExpenseAnalysis("Coffee $4.50");
    expect(result.amount).toBe(4.50);
  });
});

describe("parseExpenseJson", () => {
  it("parses plain JSON", () => {
    const json = JSON.stringify({ title: "Test", amount: 100, currency: "INR", category: "food", merchant: "", confidence: 0.9, notes: "" });
    const result = parseExpenseJson(json);
    expect(result.title).toBe("Test");
    expect(result.amount).toBe(100);
  });

  it("strips markdown code fences", () => {
    const json = '```json\n{"title":"Test","amount":50,"currency":"INR","category":"food","merchant":"","confidence":0.8,"notes":""}\n```';
    const result = parseExpenseJson(json);
    expect(result.title).toBe("Test");
    expect(result.amount).toBe(50);
  });

  it("handles whitespace around JSON", () => {
    const json = '  \n{"title":"T","amount":0,"currency":"INR","category":"miscellaneous","merchant":"","confidence":0.5,"notes":"n"}\n  ';
    const result = parseExpenseJson(json);
    expect(result.title).toBe("T");
  });

  it("throws on invalid JSON", () => {
    expect(() => parseExpenseJson("not json")).toThrow();
  });
});
