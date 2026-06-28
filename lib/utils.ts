export type ExpenseBudgetSettings = {
  enabled: boolean;
  monthlyLimit: number;
  dismissedWarnings: string[];
};

export const defaultExpenseBudget: ExpenseBudgetSettings = {
  enabled: false,
  monthlyLimit: 0,
  dismissedWarnings: []
};

export type UserProfile = {
  displayName: string;
  avatarUrl?: string;
  avatarPath?: string;
  age: number;
  sex: string;
  heightCm: number;
  weightKg: number;
  goal: string;
  trainingLevel: string;
  activityLevel: string;
  dailyCalorieTarget: number;
  proteinTarget: number;
  carbsTarget: number;
  fatTarget: number;
  expenseBudget: ExpenseBudgetSettings;
  completedAt?: string;
};

export function calculateTargets(profile: Pick<UserProfile, "age" | "sex" | "heightCm" | "weightKg" | "goal" | "activityLevel">) {
  const weight = Math.max(0, Number(profile.weightKg) || 0);
  const height = Math.max(0, Number(profile.heightCm) || 0);
  const age = Math.max(0, Number(profile.age) || 0);
  const sexOffset = profile.sex === "female" ? -161 : profile.sex === "male" ? 5 : -78;
  const bmr = weight && height && age ? 10 * weight + 6.25 * height - 5 * age + sexOffset : 2200 / 1.45;
  const activityMultipliers: Record<string, number> = { sedentary: 1.2, light: 1.375, moderate: 1.55, high: 1.725, athlete: 1.9 };
  const goalAdjustments: Record<string, number> = { fat_loss: -450, recomposition: -150, maintain: 0, muscle_gain: 300, performance: 200 };
  const calories = Math.max(1200, Math.round(((bmr * (activityMultipliers[profile.activityLevel] ?? 1.55)) + (goalAdjustments[profile.goal] ?? 0)) / 25) * 25);
  const proteinPerKg = profile.goal === "muscle_gain" || profile.goal === "recomposition" ? 1.9 : profile.goal === "fat_loss" ? 2 : 1.6;
  const protein = Math.max(60, Math.round((weight || 78) * proteinPerKg));
  const fat = Math.max(40, Math.round(((calories * 0.27) / 9)));
  const carbs = Math.max(80, Math.round((calories - protein * 4 - fat * 9) / 4));
  return { calories, protein, carbs, fat };
}

export function defaultProfile(email?: string | null): UserProfile {
  const base = calculateTargets({
    age: 0,
    sex: "",
    heightCm: 0,
    weightKg: 0,
    goal: "recomposition",
    activityLevel: "moderate"
  });
  return {
    displayName: email?.split("@")[0] || "KYNEX athlete",
    age: 0,
    sex: "",
    heightCm: 0,
    weightKg: 0,
    goal: "recomposition",
    trainingLevel: "intermediate",
    activityLevel: "moderate",
    dailyCalorieTarget: base.calories,
    proteinTarget: base.protein,
    carbsTarget: base.carbs,
    fatTarget: base.fat,
    expenseBudget: { ...defaultExpenseBudget }
  };
}

export function withCalculatedTargets(profile: UserProfile): UserProfile {
  const targets = calculateTargets(profile);
  return {
    ...profile,
    dailyCalorieTarget: targets.calories,
    proteinTarget: targets.protein,
    carbsTarget: targets.carbs,
    fatTarget: targets.fat
  };
}

export function isProfileComplete(profile: UserProfile) {
  return Boolean(profile.completedAt && profile.age && profile.sex && profile.heightCm && profile.weightKg && profile.goal && profile.activityLevel && profile.trainingLevel);
}

export function labelFromValue(value: string) {
  return value.split("_").map((part) => part.slice(0, 1).toUpperCase() + part.slice(1)).join(" ");
}

export function yesterday() {
  const value = new Date();
  value.setDate(value.getDate() - 1);
  return value.toISOString().slice(0, 10);
}

export function isWithinPeriod(date: string, period: "day" | "week" | "month") {
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date();
  const value = new Date(`${date}T12:00:00`);
  if (period === "day") return date === today;
  if (period === "month") return value.getFullYear() === now.getFullYear() && value.getMonth() === now.getMonth();
  const start = new Date(now);
  start.setDate(now.getDate() - now.getDay());
  start.setHours(0, 0, 0, 0);
  return value >= start;
}

export function makeId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

export function estimateStepDistanceKm(steps: number, profile: UserProfile) {
  const heightMeters = Math.max(1.4, (Number(profile.heightCm) || 170) / 100);
  const strideMeters = heightMeters * 0.415;
  return Math.round((steps * strideMeters / 1000) * 100) / 100;
}

export function estimateStepCalories(steps: number, profile: UserProfile) {
  const weight = Math.max(45, Number(profile.weightKg) || 75);
  return Math.round(steps * weight * 0.00053);
}
