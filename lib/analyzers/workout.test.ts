import { describe, it, expect } from "vitest";
import { mockWorkoutAnalysis, parseWorkoutJson } from "./workout";

describe("mockWorkoutAnalysis", () => {
  it("identifies running workouts", () => {
    const result = mockWorkoutAnalysis("Morning run 5k");
    expect(result.title).toBe("Tempo run");
    expect(result.calories).toBe(610);
    expect(result.movements).toEqual(["Warmup", "Tempo blocks", "Cooldown"]);
  });

  it("identifies walking workouts", () => {
    const result = mockWorkoutAnalysis("Easy walk in the park");
    expect(result.title).toBe("Zone 2 walk");
    expect(result.calories).toBe(190);
    expect(result.effort).toBe("Moderate");
  });

  it("defaults to high-intensity power for generic workouts", () => {
    const result = mockWorkoutAnalysis("Leg day at the gym");
    expect(result.title).toBe("High-intensity power");
    expect(result.calories).toBe(540);
    expect(result.movements).toEqual(["Back squats", "Dumbbell rows", "Walking lunges"]);
  });

  it("detects 20-minute duration", () => {
    const result = mockWorkoutAnalysis("Quick 20 min HIIT");
    expect(result.duration).toBe(20);
  });

  it("detects 60-minute duration", () => {
    const result = mockWorkoutAnalysis("60 minute yoga session");
    expect(result.duration).toBe(60);
  });

  it("defaults to 45-minute duration", () => {
    const result = mockWorkoutAnalysis("Push pull legs");
    expect(result.duration).toBe(45);
  });

  it("sets Moderate effort for easy workouts", () => {
    const result = mockWorkoutAnalysis("Easy stretching");
    expect(result.effort).toBe("Moderate");
  });

  it("sets Hard effort for intense workouts", () => {
    const result = mockWorkoutAnalysis("Heavy deadlifts");
    expect(result.effort).toBe("Hard");
  });

  it("gives lower score for easy workouts", () => {
    const result = mockWorkoutAnalysis("Easy recovery day");
    expect(result.score).toBe(7.4);
  });

  it("gives higher score for intense workouts", () => {
    const result = mockWorkoutAnalysis("Intense HIIT circuit");
    expect(result.score).toBe(8.5);
  });

  it("includes demo note", () => {
    expect(mockWorkoutAnalysis("test").notes).toContain("Demo estimate");
  });

  it("walk sets effort to Moderate even without easy keyword", () => {
    const result = mockWorkoutAnalysis("Walk to the store");
    expect(result.effort).toBe("Moderate");
  });
});

describe("parseWorkoutJson", () => {
  it("parses plain JSON", () => {
    const json = JSON.stringify({
      title: "HIIT", duration: 30, calories: 400, effort: "Hard",
      score: 8.0, movements: ["Burpees", "Push-ups"], notes: ""
    });
    const result = parseWorkoutJson(json);
    expect(result.title).toBe("HIIT");
    expect(result.duration).toBe(30);
    expect(result.movements).toEqual(["Burpees", "Push-ups"]);
  });

  it("strips markdown code fences", () => {
    const json = '```json\n{"title":"Run","duration":25,"calories":300,"effort":"Moderate","score":7.5,"movements":["Jog"],"notes":"ok"}\n```';
    const result = parseWorkoutJson(json);
    expect(result.title).toBe("Run");
  });

  it("throws on invalid JSON", () => {
    expect(() => parseWorkoutJson("nope")).toThrow();
  });

  it("handles extra whitespace", () => {
    const json = '   {"title":"Yoga","duration":60,"calories":200,"effort":"Easy","score":7.0,"movements":[],"notes":""}   ';
    const result = parseWorkoutJson(json);
    expect(result.title).toBe("Yoga");
    expect(result.duration).toBe(60);
  });
});
