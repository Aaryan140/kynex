import { describe, it, expect } from "vitest";
import { mockFoodAnalysis, parseFoodJson } from "./food";

describe("mockFoodAnalysis", () => {
  it("returns default title for empty prompt", () => {
    const result = mockFoodAnalysis("");
    expect(result.title).toBe("Smashed avocado & egg");
  });

  it("uses prompt as title when provided", () => {
    const result = mockFoodAnalysis("Grilled chicken breast");
    expect(result.title).toBe("Grilled chicken breast");
  });

  it("trims whitespace from title", () => {
    const result = mockFoodAnalysis("  rice bowl  ");
    expect(result.title).toBe("rice bowl");
  });

  it("returns lower calories for salad", () => {
    const result = mockFoodAnalysis("Caesar salad");
    expect(result.calories).toBe(330);
  });

  it("returns higher calories for rice", () => {
    const result = mockFoodAnalysis("Chicken rice bowl");
    expect(result.calories).toBe(620);
  });

  it("returns default calories for generic food", () => {
    const result = mockFoodAnalysis("some food");
    expect(result.calories).toBe(412);
  });

  it("returns high protein for whey", () => {
    const result = mockFoodAnalysis("Whey protein shake");
    expect(result.protein).toBe(38);
  });

  it("returns high protein for chicken", () => {
    const result = mockFoodAnalysis("Grilled chicken");
    expect(result.protein).toBe(46);
  });

  it("returns default protein for generic food", () => {
    const result = mockFoodAnalysis("pasta");
    expect(result.protein).toBe(18);
  });

  it("returns higher carbs for rice", () => {
    const result = mockFoodAnalysis("rice and dal");
    expect(result.carbs).toBe(58);
  });

  it("returns default carbs otherwise", () => {
    const result = mockFoodAnalysis("oatmeal");
    expect(result.carbs).toBe(32);
  });

  it("returns higher fat for fried food", () => {
    const result = mockFoodAnalysis("fried chicken");
    expect(result.fat).toBe(30);
  });

  it("returns default fat for non-fried food", () => {
    const result = mockFoodAnalysis("grilled fish");
    expect(result.fat).toBe(24);
  });

  it("returns lower score for fried food", () => {
    const result = mockFoodAnalysis("deep fried samosa");
    expect(result.score).toBe(6.4);
  });

  it("returns higher score for non-fried food", () => {
    const result = mockFoodAnalysis("grilled salmon");
    expect(result.score).toBe(8.8);
  });

  it("always returns 0.82 confidence", () => {
    expect(mockFoodAnalysis("anything").confidence).toBe(0.82);
  });

  it("includes demo note", () => {
    expect(mockFoodAnalysis("test").notes).toContain("Demo estimate");
  });
});

describe("parseFoodJson", () => {
  it("parses plain JSON", () => {
    const json = JSON.stringify({ title: "Salad", calories: 300, protein: 20, carbs: 30, fat: 10, score: 8.5, confidence: 0.9, notes: "" });
    const result = parseFoodJson(json);
    expect(result.title).toBe("Salad");
    expect(result.calories).toBe(300);
  });

  it("strips markdown code fences", () => {
    const json = '```json\n{"title":"Bowl","calories":400,"protein":25,"carbs":40,"fat":15,"score":8.0,"confidence":0.85,"notes":"ok"}\n```';
    const result = parseFoodJson(json);
    expect(result.title).toBe("Bowl");
  });

  it("handles case-insensitive code fence", () => {
    const json = '```JSON\n{"title":"X","calories":0,"protein":0,"carbs":0,"fat":0,"score":0,"confidence":0,"notes":""}\n```';
    const result = parseFoodJson(json);
    expect(result.title).toBe("X");
  });

  it("throws on invalid JSON", () => {
    expect(() => parseFoodJson("{broken")).toThrow();
  });
});
