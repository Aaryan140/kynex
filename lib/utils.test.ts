import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  calculateTargets,
  defaultProfile,
  defaultExpenseBudget,
  withCalculatedTargets,
  isProfileComplete,
  labelFromValue,
  yesterday,
  isWithinPeriod,
  makeId,
  estimateStepDistanceKm,
  estimateStepCalories
} from "./utils";
import type { UserProfile } from "./utils";

function baseProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    displayName: "Test",
    age: 25,
    sex: "male",
    heightCm: 180,
    weightKg: 80,
    goal: "recomposition",
    trainingLevel: "intermediate",
    activityLevel: "moderate",
    dailyCalorieTarget: 2200,
    proteinTarget: 150,
    carbsTarget: 250,
    fatTarget: 60,
    expenseBudget: { enabled: false, monthlyLimit: 0, dismissedWarnings: [] },
    ...overrides
  };
}

describe("calculateTargets", () => {
  it("returns reasonable defaults when profile fields are zero", () => {
    const result = calculateTargets({ age: 0, sex: "", heightCm: 0, weightKg: 0, goal: "recomposition", activityLevel: "moderate" });
    expect(result.calories).toBeGreaterThanOrEqual(1200);
    expect(result.protein).toBeGreaterThanOrEqual(60);
    expect(result.carbs).toBeGreaterThanOrEqual(80);
    expect(result.fat).toBeGreaterThanOrEqual(40);
  });

  it("calculates higher calories for muscle_gain vs fat_loss", () => {
    const shared = { age: 25, sex: "male" as const, heightCm: 180, weightKg: 80, activityLevel: "moderate" };
    const gain = calculateTargets({ ...shared, goal: "muscle_gain" });
    const loss = calculateTargets({ ...shared, goal: "fat_loss" });
    expect(gain.calories).toBeGreaterThan(loss.calories);
  });

  it("uses female offset for females", () => {
    const male = calculateTargets({ age: 25, sex: "male", heightCm: 170, weightKg: 70, goal: "maintain", activityLevel: "moderate" });
    const female = calculateTargets({ age: 25, sex: "female", heightCm: 170, weightKg: 70, goal: "maintain", activityLevel: "moderate" });
    expect(male.calories).toBeGreaterThan(female.calories);
  });

  it("uses neutral offset for unspecified sex", () => {
    const neutral = calculateTargets({ age: 25, sex: "", heightCm: 170, weightKg: 70, goal: "maintain", activityLevel: "moderate" });
    const male = calculateTargets({ age: 25, sex: "male", heightCm: 170, weightKg: 70, goal: "maintain", activityLevel: "moderate" });
    const female = calculateTargets({ age: 25, sex: "female", heightCm: 170, weightKg: 70, goal: "maintain", activityLevel: "moderate" });
    expect(neutral.calories).toBeGreaterThan(female.calories);
    expect(neutral.calories).toBeLessThan(male.calories);
  });

  it("scales with activity level", () => {
    const shared = { age: 30, sex: "male", heightCm: 175, weightKg: 75, goal: "maintain" };
    const sedentary = calculateTargets({ ...shared, activityLevel: "sedentary" });
    const athlete = calculateTargets({ ...shared, activityLevel: "athlete" });
    expect(athlete.calories).toBeGreaterThan(sedentary.calories);
  });

  it("never returns calories below 1200", () => {
    const result = calculateTargets({ age: 80, sex: "female", heightCm: 140, weightKg: 40, goal: "fat_loss", activityLevel: "sedentary" });
    expect(result.calories).toBeGreaterThanOrEqual(1200);
  });

  it("rounds calories to multiples of 25", () => {
    const result = calculateTargets({ age: 25, sex: "male", heightCm: 180, weightKg: 80, goal: "maintain", activityLevel: "moderate" });
    expect(result.calories % 25).toBe(0);
  });

  it("sets higher protein for fat_loss (2g/kg)", () => {
    const result = calculateTargets({ age: 25, sex: "male", heightCm: 180, weightKg: 80, goal: "fat_loss", activityLevel: "moderate" });
    expect(result.protein).toBe(Math.max(60, Math.round(80 * 2)));
  });

  it("sets higher protein for recomposition (1.9g/kg)", () => {
    const result = calculateTargets({ age: 25, sex: "male", heightCm: 180, weightKg: 80, goal: "recomposition", activityLevel: "moderate" });
    expect(result.protein).toBe(Math.max(60, Math.round(80 * 1.9)));
  });

  it("sets standard protein for maintain (1.6g/kg)", () => {
    const result = calculateTargets({ age: 25, sex: "male", heightCm: 180, weightKg: 80, goal: "maintain", activityLevel: "moderate" });
    expect(result.protein).toBe(Math.max(60, Math.round(80 * 1.6)));
  });

  it("handles NaN weight/height gracefully", () => {
    const result = calculateTargets({ age: 25, sex: "male", heightCm: NaN, weightKg: NaN, goal: "maintain", activityLevel: "moderate" });
    expect(result.calories).toBeGreaterThanOrEqual(1200);
    expect(result.protein).toBeGreaterThanOrEqual(60);
  });
});

describe("defaultProfile", () => {
  it("uses email prefix as display name", () => {
    const result = defaultProfile("aryan@example.com");
    expect(result.displayName).toBe("aryan");
  });

  it("falls back to KYNEX athlete when no email", () => {
    const result = defaultProfile();
    expect(result.displayName).toBe("KYNEX athlete");
  });

  it("falls back to KYNEX athlete for null email", () => {
    const result = defaultProfile(null);
    expect(result.displayName).toBe("KYNEX athlete");
  });

  it("sets default goal to recomposition", () => {
    expect(defaultProfile().goal).toBe("recomposition");
  });

  it("sets default training level to intermediate", () => {
    expect(defaultProfile().trainingLevel).toBe("intermediate");
  });

  it("has valid calorie targets from calculateTargets", () => {
    const profile = defaultProfile();
    expect(profile.dailyCalorieTarget).toBeGreaterThanOrEqual(1200);
    expect(profile.dailyCalorieTarget % 25).toBe(0);
  });

  it("includes default expense budget", () => {
    const profile = defaultProfile();
    expect(profile.expenseBudget).toEqual(defaultExpenseBudget);
    expect(profile.expenseBudget.enabled).toBe(false);
    expect(profile.expenseBudget.monthlyLimit).toBe(0);
    expect(profile.expenseBudget.dismissedWarnings).toEqual([]);
  });
});

describe("withCalculatedTargets", () => {
  it("overwrites target fields based on profile data", () => {
    const profile = baseProfile({ dailyCalorieTarget: 0, proteinTarget: 0, carbsTarget: 0, fatTarget: 0 });
    const result = withCalculatedTargets(profile);
    expect(result.dailyCalorieTarget).toBeGreaterThan(0);
    expect(result.proteinTarget).toBeGreaterThan(0);
    expect(result.carbsTarget).toBeGreaterThan(0);
    expect(result.fatTarget).toBeGreaterThan(0);
  });

  it("preserves non-target fields", () => {
    const profile = baseProfile({ displayName: "CustomName", age: 30 });
    const result = withCalculatedTargets(profile);
    expect(result.displayName).toBe("CustomName");
    expect(result.age).toBe(30);
  });
});

describe("isProfileComplete", () => {
  it("returns true when all required fields are present", () => {
    const profile = baseProfile({ completedAt: "2025-01-01" });
    expect(isProfileComplete(profile)).toBe(true);
  });

  it("returns false when completedAt is missing", () => {
    const profile = baseProfile({ completedAt: undefined });
    expect(isProfileComplete(profile)).toBe(false);
  });

  it("returns false when age is 0", () => {
    const profile = baseProfile({ completedAt: "2025-01-01", age: 0 });
    expect(isProfileComplete(profile)).toBe(false);
  });

  it("returns false when sex is empty", () => {
    const profile = baseProfile({ completedAt: "2025-01-01", sex: "" });
    expect(isProfileComplete(profile)).toBe(false);
  });

  it("returns false when heightCm is 0", () => {
    const profile = baseProfile({ completedAt: "2025-01-01", heightCm: 0 });
    expect(isProfileComplete(profile)).toBe(false);
  });

  it("returns false when weightKg is 0", () => {
    const profile = baseProfile({ completedAt: "2025-01-01", weightKg: 0 });
    expect(isProfileComplete(profile)).toBe(false);
  });

  it("returns false when goal is empty", () => {
    const profile = baseProfile({ completedAt: "2025-01-01", goal: "" });
    expect(isProfileComplete(profile)).toBe(false);
  });

  it("returns false when activityLevel is empty", () => {
    const profile = baseProfile({ completedAt: "2025-01-01", activityLevel: "" });
    expect(isProfileComplete(profile)).toBe(false);
  });

  it("returns false when trainingLevel is empty", () => {
    const profile = baseProfile({ completedAt: "2025-01-01", trainingLevel: "" });
    expect(isProfileComplete(profile)).toBe(false);
  });
});

describe("labelFromValue", () => {
  it("converts snake_case to Title Case", () => {
    expect(labelFromValue("fat_loss")).toBe("Fat Loss");
  });

  it("handles single word", () => {
    expect(labelFromValue("maintain")).toBe("Maintain");
  });

  it("handles multi-segment values", () => {
    expect(labelFromValue("muscle_gain")).toBe("Muscle Gain");
  });

  it("handles empty string", () => {
    expect(labelFromValue("")).toBe("");
  });
});

describe("yesterday", () => {
  it("returns a date string in YYYY-MM-DD format", () => {
    const result = yesterday();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("returns a date before today", () => {
    const result = yesterday();
    const today = new Date().toISOString().slice(0, 10);
    expect(result).not.toBe(today);
    expect(new Date(result).getTime()).toBeLessThan(new Date(today).getTime());
  });
});

describe("isWithinPeriod", () => {
  it("returns true for today when period is day", () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(isWithinPeriod(today, "day")).toBe(true);
  });

  it("returns false for yesterday when period is day", () => {
    const y = yesterday();
    expect(isWithinPeriod(y, "day")).toBe(false);
  });

  it("returns true for today when period is month", () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(isWithinPeriod(today, "month")).toBe(true);
  });

  it("returns false for a date in a different month", () => {
    expect(isWithinPeriod("2020-01-15", "month")).toBe(false);
  });

  it("returns true for today when period is week", () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(isWithinPeriod(today, "week")).toBe(true);
  });

  it("returns false for a date far in the past when period is week", () => {
    expect(isWithinPeriod("2020-01-01", "week")).toBe(false);
  });
});

describe("makeId", () => {
  it("starts with the given prefix", () => {
    expect(makeId("meal").startsWith("meal-")).toBe(true);
  });

  it("produces unique IDs", () => {
    const ids = new Set(Array.from({ length: 100 }, () => makeId("test")));
    expect(ids.size).toBe(100);
  });

  it("has a suffix after the prefix", () => {
    const id = makeId("workout");
    const suffix = id.slice("workout-".length);
    expect(suffix.length).toBeGreaterThan(0);
  });
});

describe("estimateStepDistanceKm", () => {
  it("returns 0 for 0 steps", () => {
    expect(estimateStepDistanceKm(0, baseProfile())).toBe(0);
  });

  it("scales linearly with steps", () => {
    const d1000 = estimateStepDistanceKm(1000, baseProfile());
    const d2000 = estimateStepDistanceKm(2000, baseProfile());
    expect(d2000).toBeCloseTo(d1000 * 2, 1);
  });

  it("uses profile height for stride calculation", () => {
    const tall = estimateStepDistanceKm(5000, baseProfile({ heightCm: 190 }));
    const short = estimateStepDistanceKm(5000, baseProfile({ heightCm: 160 }));
    expect(tall).toBeGreaterThan(short);
  });

  it("clamps height to minimum 1.4m when missing", () => {
    const result = estimateStepDistanceKm(1000, baseProfile({ heightCm: 0 }));
    expect(result).toBeGreaterThan(0);
  });

  it("falls back to 170cm when heightCm is falsy", () => {
    const withDefault = estimateStepDistanceKm(1000, baseProfile({ heightCm: 0 }));
    const explicit = estimateStepDistanceKm(1000, baseProfile({ heightCm: 170 }));
    expect(withDefault).toBe(explicit);
  });
});

describe("estimateStepCalories", () => {
  it("returns 0 for 0 steps", () => {
    expect(estimateStepCalories(0, baseProfile())).toBe(0);
  });

  it("scales with body weight", () => {
    const heavy = estimateStepCalories(5000, baseProfile({ weightKg: 100 }));
    const light = estimateStepCalories(5000, baseProfile({ weightKg: 60 }));
    expect(heavy).toBeGreaterThan(light);
  });

  it("clamps weight to minimum 45kg when missing", () => {
    const result = estimateStepCalories(5000, baseProfile({ weightKg: 0 }));
    const explicit = estimateStepCalories(5000, baseProfile({ weightKg: 75 }));
    expect(result).toBe(explicit);
  });

  it("returns an integer", () => {
    const result = estimateStepCalories(3456, baseProfile());
    expect(Number.isInteger(result)).toBe(true);
  });
});
