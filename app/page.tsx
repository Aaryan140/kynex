"use client";

import {
  Activity,
  BarChart3,
  Camera,
  Check,
  ChevronRight,
  Dumbbell,
  Footprints,
  Home,
  ImagePlus,
  Loader2,
  LogOut,
  Mic,
  Pencil,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  User,
  Utensils,
  Wallet,
  X
} from "lucide-react";
import { Session } from "@supabase/supabase-js";
import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "../lib/supabase/client";

type Tab = "home" | "food" | "workout" | "steps" | "expenses" | "history" | "profile";
type SourceMode = "photo" | "voice" | "text";

type MealLog = {
  id: string;
  kind: "food";
  title: string;
  time: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  score: number;
  confidence: string;
  notes?: string;
  imageUrl?: string;
  imagePath?: string;
  imageFile?: File;
  source: SourceMode;
  date: string;
};

type WorkoutLog = {
  id: string;
  kind: "workout";
  title: string;
  time: string;
  duration: number;
  calories: number;
  effort: string;
  score: number;
  movements: string[];
  notes?: string;
  imageUrl?: string;
  imagePath?: string;
  imageFile?: File;
  source: "voice" | "text";
  date: string;
};

type ExpenseLog = {
  id: string;
  kind: "expense";
  title: string;
  time: string;
  amount: number;
  currency: string;
  category: string;
  merchant: string;
  confidence: string;
  notes?: string;
  source: "voice" | "text";
  date: string;
};

type StepLog = {
  id: string;
  title: string;
  time: string;
  steps: number;
  distanceKm: number;
  calories: number;
  source: "motion" | "manual";
  date: string;
};

type LogEntry = MealLog | WorkoutLog | ExpenseLog;

type UserProfile = {
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
  completedAt?: string;
};

type SpeechRecognitionConstructor = new () => {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionEventLike = {
  results: ArrayLike<{
    0: { transcript: string };
  }>;
};

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

const today = new Date().toISOString().slice(0, 10);
const supabase = getSupabaseBrowserClient();

function defaultProfile(email?: string | null): UserProfile {
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
    fatTarget: base.fat
  };
}

function calculateTargets(profile: Pick<UserProfile, "age" | "sex" | "heightCm" | "weightKg" | "goal" | "activityLevel">) {
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

function withCalculatedTargets(profile: UserProfile): UserProfile {
  const targets = calculateTargets(profile);
  return {
    ...profile,
    dailyCalorieTarget: targets.calories,
    proteinTarget: targets.protein,
    carbsTarget: targets.carbs,
    fatTarget: targets.fat
  };
}

function isProfileComplete(profile: UserProfile) {
  return Boolean(profile.completedAt && profile.age && profile.sex && profile.heightCm && profile.weightKg && profile.goal && profile.activityLevel && profile.trainingLevel);
}

function labelFromValue(value: string) {
  return value.split("_").map((part) => part.slice(0, 1).toUpperCase() + part.slice(1)).join(" ");
}

const expenseCategoryOptions: Array<[string, string]> = [
  ["food", "Food"],
  ["groceries", "Groceries"],
  ["transport", "Transport"],
  ["shopping", "Shopping"],
  ["health", "Health"],
  ["fitness", "Fitness"],
  ["bills", "Bills"],
  ["entertainment", "Entertainment"],
  ["travel", "Travel"],
  ["education", "Education"],
  ["miscellaneous", "Miscellaneous"]
];

function yesterday() {
  const value = new Date();
  value.setDate(value.getDate() - 1);
  return value.toISOString().slice(0, 10);
}

function isWithinPeriod(date: string, period: "day" | "week" | "month") {
  const now = new Date();
  const value = new Date(`${date}T12:00:00`);
  if (period === "day") return date === today;
  if (period === "month") return value.getFullYear() === now.getFullYear() && value.getMonth() === now.getMonth();
  const start = new Date(now);
  start.setDate(now.getDate() - now.getDay());
  start.setHours(0, 0, 0, 0);
  return value >= start;
}

const starterLogs: LogEntry[] = [
  {
    id: "meal-1",
    kind: "food",
    title: "Smashed avocado & egg",
    time: "08:12 AM",
    calories: 412,
    protein: 18,
    carbs: 32,
    fat: 24,
    score: 8.8,
    confidence: "89%",
    imageUrl: "https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=320&q=80",
    source: "photo",
    date: today
  },
  {
    id: "workout-1",
    kind: "workout",
    title: "High-intensity power",
    time: "05:39 PM",
    duration: 45,
    calories: 540,
    effort: "Hard",
    score: 8.5,
    movements: ["Back squats", "Dumbbell rows", "Walking lunges"],
    source: "text",
    date: today
  },
  {
    id: "meal-2",
    kind: "food",
    title: "Oatmeal & whey",
    time: "11:26 AM",
    calories: 329,
    protein: 45,
    carbs: 42,
    fat: 4,
    score: 9.1,
    confidence: "92%",
    imageUrl: "https://images.unsplash.com/photo-1511690743698-d9d85f2fbf38?auto=format&fit=crop&w=320&q=80",
    source: "voice",
    date: today
  },
  {
    id: "expense-1",
    kind: "expense",
    title: "Post-workout coffee",
    time: "03:14 PM",
    amount: 180,
    currency: "INR",
    category: "food",
    merchant: "Cafe",
    confidence: "AI",
    source: "text",
    date: today
  },
  {
    id: "meal-3",
    kind: "food",
    title: "Grilled salmon bowl",
    time: "12:48 PM",
    calories: 498,
    protein: 52,
    carbs: 41,
    fat: 18,
    score: 8.7,
    confidence: "88%",
    imageUrl: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=320&q=80",
    source: "text",
    date: yesterday()
  }
];

function makeId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function toClock(value: string) {
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function estimateStepDistanceKm(steps: number, profile: UserProfile) {
  const heightMeters = Math.max(1.4, (Number(profile.heightCm) || 170) / 100);
  const strideMeters = heightMeters * 0.415;
  return Math.round((steps * strideMeters / 1000) * 100) / 100;
}

function estimateStepCalories(steps: number, profile: UserProfile) {
  const weight = Math.max(45, Number(profile.weightKg) || 75);
  return Math.round(steps * weight * 0.00053);
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function useSpeechInput(onTranscript: (value: string) => void) {
  const recognitionRef = useRef<InstanceType<SpeechRecognitionConstructor> | null>(null);
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);

  function toggle() {
    if (typeof window === "undefined") return;
    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition) {
      setSupported(false);
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const recognition = new Recognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      const latest = event.results[event.results.length - 1]?.[0]?.transcript;
      if (latest) onTranscript(latest);
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }

  return { listening, supported, toggle };
}

function useStepCounter() {
  const [tracking, setTracking] = useState(false);
  const [supported, setSupported] = useState(true);
  const [steps, setSteps] = useState(0);
  const [signal, setSignal] = useState(0);
  const [message, setMessage] = useState("Ready");
  const baselineRef = useRef(9.81);
  const armedRef = useRef(true);
  const lastStepAtRef = useRef(0);
  const listenerRef = useRef<((event: DeviceMotionEvent) => void) | null>(null);

  function stop() {
    if (typeof window !== "undefined" && listenerRef.current) {
      window.removeEventListener("devicemotion", listenerRef.current);
      listenerRef.current = null;
    }
    setTracking(false);
    setMessage("Session paused");
  }

  async function start() {
    if (typeof window === "undefined" || !("DeviceMotionEvent" in window)) {
      setSupported(false);
      setMessage("Motion sensor unavailable");
      return;
    }

    const MotionEventWithPermission = window.DeviceMotionEvent as typeof DeviceMotionEvent & {
      requestPermission?: () => Promise<"granted" | "denied">;
    };

    if (typeof MotionEventWithPermission.requestPermission === "function") {
      const permission = await MotionEventWithPermission.requestPermission();
      if (permission !== "granted") {
        setSupported(false);
        setMessage("Motion access denied");
        return;
      }
    }

    baselineRef.current = 9.81;
    armedRef.current = true;
    lastStepAtRef.current = 0;
    setSteps(0);
    setSignal(0);
    setSupported(true);

    const onMotion = (event: DeviceMotionEvent) => {
      const acceleration = event.accelerationIncludingGravity ?? event.acceleration;
      const x = acceleration?.x ?? 0;
      const y = acceleration?.y ?? 0;
      const z = acceleration?.z ?? 0;
      const magnitude = Math.sqrt(x * x + y * y + z * z);
      if (!Number.isFinite(magnitude) || magnitude === 0) return;

      baselineRef.current = baselineRef.current * 0.92 + magnitude * 0.08;
      const currentSignal = Math.abs(magnitude - baselineRef.current);
      setSignal(Math.round(currentSignal * 10) / 10);

      const now = Date.now();
      if (armedRef.current && currentSignal > 1.15 && now - lastStepAtRef.current > 320) {
        lastStepAtRef.current = now;
        armedRef.current = false;
        setSteps((current) => current + 1);
      }
      if (currentSignal < 0.35) armedRef.current = true;
    };

    listenerRef.current = onMotion;
    window.addEventListener("devicemotion", onMotion);
    setTracking(true);
    setMessage("Tracking foreground motion");
  }

  function reset() {
    setSteps(0);
    setSignal(0);
    baselineRef.current = 9.81;
    armedRef.current = true;
    lastStepAtRef.current = 0;
    setMessage(tracking ? "Tracking foreground motion" : "Ready");
  }

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && listenerRef.current) {
        window.removeEventListener("devicemotion", listenerRef.current);
      }
    };
  }, []);

  return { tracking, supported, steps, signal, message, start, stop, reset };
}

export default function KynexApp() {
  const [tab, setTab] = useState<Tab>("home");
  const [logs, setLogs] = useState<LogEntry[]>(starterLogs);
  const [stepLogs, setStepLogs] = useState<StepLog[]>([]);
  const [editing, setEditing] = useState<LogEntry | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile>(() => defaultProfile());
  const [authReady, setAuthReady] = useState(!supabase);
  const [syncStatus, setSyncStatus] = useState(
    supabase ? "Connect Supabase to sync logs." : "Demo mode: add Supabase keys to enable cloud sync."
  );

  const user = session?.user ?? null;

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setAuthReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthReady(true);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!supabase || !user) {
      setLogs(starterLogs);
      setStepLogs([]);
      setProfile(defaultProfile());
      return;
    }
    void loadCloudLogs(user.id);
    void loadCloudProfile(user.id, user.email);
  }, [user?.id]);

  async function loadCloudProfile(userId: string, email?: string | null) {
    if (!supabase) return;
    const fallback = defaultProfile(email);
    const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (error) {
      setSyncStatus(error.message);
      setProfile(fallback);
      return;
    }
    const row = data ?? {};
    let avatarUrl: string | undefined;
    if (row.avatar_url) {
      const { data: signed } = await supabase.storage.from("avatars").createSignedUrl(row.avatar_url, 60 * 60);
      avatarUrl = signed?.signedUrl;
    }
    const nextProfile: UserProfile = {
      displayName: row.display_name || fallback.displayName,
      avatarUrl,
      avatarPath: row.avatar_url ?? undefined,
      age: Number(row.age ?? fallback.age),
      sex: row.sex || fallback.sex,
      heightCm: Number(row.height_cm ?? fallback.heightCm),
      weightKg: Number(row.weight_kg ?? fallback.weightKg),
      goal: row.goal || fallback.goal,
      trainingLevel: row.training_level || fallback.trainingLevel,
      activityLevel: row.activity_level || fallback.activityLevel,
      dailyCalorieTarget: Number(row.daily_calorie_target ?? fallback.dailyCalorieTarget),
      proteinTarget: Number(row.protein_target_g ?? fallback.proteinTarget),
      carbsTarget: Number(row.carbs_target_g ?? fallback.carbsTarget),
      fatTarget: Number(row.fat_target_g ?? fallback.fatTarget),
      completedAt: row.profile_completed_at ?? undefined
    };
    setProfile(nextProfile);
  }

  async function uploadAvatar(file: File) {
    if (!supabase || !user) return undefined;
    const extension = file.name.split(".").pop() || "jpg";
    const avatarPath = `${user.id}/${Date.now()}-${makeId("avatar")}.${extension}`;
    const { error } = await supabase.storage.from("avatars").upload(avatarPath, file, { upsert: false });
    if (error) throw error;
    return avatarPath;
  }

  async function saveProfile(nextProfile: UserProfile, avatarFile?: File, showStatus = true) {
    const calculatedProfile = withCalculatedTargets({ ...nextProfile, completedAt: nextProfile.completedAt ?? new Date().toISOString() });
    if (!supabase || !user) {
      setProfile(calculatedProfile);
      return;
    }
    if (showStatus) setSyncStatus("Saving profile...");
    let avatarPath = calculatedProfile.avatarPath;
    if (avatarFile) avatarPath = await uploadAvatar(avatarFile);
    const { error } = await supabase.from("profiles").upsert({
      id: user.id,
      display_name: calculatedProfile.displayName,
      avatar_url: avatarPath ?? null,
      age: calculatedProfile.age || null,
      sex: calculatedProfile.sex || null,
      height_cm: calculatedProfile.heightCm || null,
      weight_kg: calculatedProfile.weightKg || null,
      goal: calculatedProfile.goal,
      training_level: calculatedProfile.trainingLevel,
      activity_level: calculatedProfile.activityLevel,
      daily_calorie_target: calculatedProfile.dailyCalorieTarget || 2200,
      protein_target_g: calculatedProfile.proteinTarget || null,
      carbs_target_g: calculatedProfile.carbsTarget || null,
      fat_target_g: calculatedProfile.fatTarget || null,
      profile_completed_at: calculatedProfile.completedAt,
      updated_at: new Date().toISOString()
    });
    if (error) { setSyncStatus(error.message); return; }
    let avatarUrl = calculatedProfile.avatarUrl;
    if (avatarPath && supabase) {
      const { data } = await supabase.storage.from("avatars").createSignedUrl(avatarPath, 60 * 60);
      avatarUrl = data?.signedUrl ?? avatarUrl;
    }
    setProfile({ ...calculatedProfile, avatarPath, avatarUrl });
    if (showStatus) setSyncStatus("Profile saved.");
  }

  async function loadCloudLogs(userId: string) {
    if (!supabase) return;
    setSyncStatus("Loading your KYNEX logs...");
    const [{ data: foods, error: foodError }, { data: workouts, error: workoutError }, { data: expenses, error: expenseError }, { data: steps, error: stepError }] = await Promise.all([
      supabase.from("food_logs").select("*").eq("user_id", userId).order("logged_at", { ascending: false }).limit(100),
      supabase.from("workout_logs").select("*").eq("user_id", userId).order("logged_at", { ascending: false }).limit(100),
      supabase.from("expense_logs").select("*").eq("user_id", userId).order("logged_at", { ascending: false }).limit(200),
      supabase.from("step_logs").select("*").eq("user_id", userId).order("logged_at", { ascending: false }).limit(120)
    ]);
    if (foodError || workoutError || expenseError || stepError) {
      setSyncStatus("Supabase tables are not ready yet. Run supabase/schema.sql, then refresh.");
      setLogs(starterLogs);
      setStepLogs([]);
      return;
    }
    const foodLogs = await Promise.all(
      (foods ?? []).map(async (row) => {
        let imageUrl: string | undefined;
        if (row.image_path) {
          const { data } = await supabase.storage.from("food-images").createSignedUrl(row.image_path, 60 * 60);
          imageUrl = data?.signedUrl;
        }
        return {
          id: row.id,
          kind: "food" as const,
          title: row.title,
          time: toClock(row.logged_at),
          calories: row.calories,
          protein: Number(row.protein_g),
          carbs: Number(row.carbs_g),
          fat: Number(row.fat_g),
          score: Number(row.score),
          confidence: row.confidence ? `${Math.round(Number(row.confidence) * 100)}%` : "AI",
          notes: row.ai_raw?.notes,
          imageUrl,
          imagePath: row.image_path ?? undefined,
          source: row.source,
          date: row.logged_at.slice(0, 10)
        } satisfies MealLog;
      })
    );
    const workoutLogs = await Promise.all(
      (workouts ?? []).map(async (row) => {
        let imageUrl: string | undefined;
        if (row.image_path) {
          const { data } = await supabase.storage.from("workout-images").createSignedUrl(row.image_path, 60 * 60);
          imageUrl = data?.signedUrl;
        }
        return {
          id: row.id,
          kind: "workout" as const,
          title: row.title,
          time: toClock(row.logged_at),
          duration: row.duration_minutes,
          calories: row.calories_burned,
          effort: row.effort,
          score: Number(row.score),
          movements: row.movements ?? [],
          notes: row.ai_raw?.notes,
          imageUrl,
          imagePath: row.image_path ?? undefined,
          source: row.source,
          date: row.logged_at.slice(0, 10)
        } satisfies WorkoutLog;
      })
    );
    const expenseLogs = (expenses ?? []).map((row) => ({
      id: row.id,
      kind: "expense" as const,
      title: row.title,
      time: toClock(row.logged_at),
      amount: Number(row.amount),
      currency: row.currency,
      category: row.category,
      merchant: row.merchant ?? "",
      confidence: row.confidence ? `${Math.round(Number(row.confidence) * 100)}%` : "AI",
      notes: row.ai_raw?.notes,
      source: row.source,
      date: row.logged_at.slice(0, 10)
    } satisfies ExpenseLog));
    const cloudStepLogs = (steps ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      time: toClock(row.logged_at),
      steps: Number(row.steps),
      distanceKm: Number(row.distance_km),
      calories: Number(row.calories),
      source: row.source,
      date: row.logged_at.slice(0, 10)
    } satisfies StepLog));
    setLogs([...foodLogs, ...workoutLogs, ...expenseLogs].sort((a, b) => (a.date < b.date ? 1 : -1)));
    setStepLogs(cloudStepLogs);
    setSyncStatus("Cloud sync active.");
  }

  async function uploadFoodImage(entry: MealLog) {
    if (!supabase || !user || !entry.imageFile) return entry.imagePath;
    const extension = entry.imageFile.name.split(".").pop() || "jpg";
    const imagePath = `${user.id}/${Date.now()}-${makeId("meal")}.${extension}`;
    const { error } = await supabase.storage.from("food-images").upload(imagePath, entry.imageFile, { upsert: false });
    if (error) throw error;
    return imagePath;
  }

  async function uploadWorkoutImage(entry: WorkoutLog) {
    if (!supabase || !user || !entry.imageFile) return entry.imagePath;
    const extension = entry.imageFile.name.split(".").pop() || "jpg";
    const imagePath = `${user.id}/${Date.now()}-${makeId("workout")}.${extension}`;
    const { error } = await supabase.storage.from("workout-images").upload(imagePath, entry.imageFile, { upsert: false });
    if (error) throw error;
    return imagePath;
  }

  async function saveLog(entry: LogEntry) {
    if (!supabase || !user) {
      setLogs((current) => [{ ...entry, id: makeId(entry.kind) }, ...current]);
      setTab("home");
      return;
    }
    setSyncStatus("Saving log...");
    if (entry.kind === "food") {
      const imagePath = await uploadFoodImage(entry);
      const { data, error } = await supabase.from("food_logs").insert({
        user_id: user.id,
        title: entry.title,
        source: entry.source,
        image_path: imagePath,
        calories: entry.calories,
        protein_g: entry.protein,
        carbs_g: entry.carbs,
        fat_g: entry.fat,
        score: entry.score,
        confidence: Number.parseFloat(entry.confidence) / 100 || null,
        ai_raw: { notes: entry.notes }
      }).select().single();
      if (error) { setSyncStatus(error.message); return; }
      setLogs((current) => [{ ...entry, id: data.id, imagePath }, ...current]);
    } else if (entry.kind === "workout") {
      const imagePath = await uploadWorkoutImage(entry);
      const { data, error } = await supabase.from("workout_logs").insert({
        user_id: user.id,
        title: entry.title,
        source: entry.source,
        image_path: imagePath,
        duration_minutes: entry.duration,
        calories_burned: entry.calories,
        effort: entry.effort,
        movements: entry.movements,
        score: entry.score,
        ai_raw: { notes: entry.notes }
      }).select().single();
      if (error) { setSyncStatus(error.message); return; }
      setLogs((current) => [{ ...entry, id: data.id, imagePath }, ...current]);
    } else {
      const { data, error } = await supabase.from("expense_logs").insert({
        user_id: user.id,
        title: entry.title,
        amount: entry.amount,
        currency: entry.currency,
        category: entry.category || "miscellaneous",
        merchant: entry.merchant || null,
        source: entry.source,
        confidence: Number.parseFloat(entry.confidence) / 100 || null,
        ai_raw: { notes: entry.notes }
      }).select().single();
      if (error) { setSyncStatus(error.message); return; }
      setLogs((current) => [{ ...entry, id: data.id }, ...current]);
    }
    setSyncStatus("Saved to Supabase.");
    setTab("home");
  }

  async function updateLog(updated: LogEntry) {
    if (supabase && user) {
      setSyncStatus("Saving changes...");
      const table = updated.kind === "food" ? "food_logs" : updated.kind === "workout" ? "workout_logs" : "expense_logs";
      const payload = updated.kind === "food"
        ? { title: updated.title, calories: updated.calories, protein_g: updated.protein, carbs_g: updated.carbs, fat_g: updated.fat, score: updated.score, updated_at: new Date().toISOString() }
        : updated.kind === "workout"
          ? { title: updated.title, duration_minutes: updated.duration, calories_burned: updated.calories, effort: updated.effort, score: updated.score, updated_at: new Date().toISOString() }
          : { title: updated.title, amount: updated.amount, currency: updated.currency, category: updated.category || "miscellaneous", merchant: updated.merchant || null, updated_at: new Date().toISOString() };
      const { error } = await supabase.from(table).update(payload).eq("id", updated.id).eq("user_id", user.id);
      if (error) { setSyncStatus(error.message); return; }
      setSyncStatus("Changes saved.");
    }
    setLogs((current) => current.map((log) => (log.id === updated.id ? updated : log)));
    setEditing(null);
  }

  async function deleteLog(id: string) {
    const existing = logs.find((log) => log.id === id);
    if (supabase && user && existing) {
      setSyncStatus("Deleting log...");
      const table = existing.kind === "food" ? "food_logs" : existing.kind === "workout" ? "workout_logs" : "expense_logs";
      const { error } = await supabase.from(table).delete().eq("id", id).eq("user_id", user.id);
      if (error) { setSyncStatus(error.message); return; }
      setSyncStatus("Log deleted.");
    }
    setLogs((current) => current.filter((log) => log.id !== id));
    setEditing(null);
  }

  async function saveStepLog(entry: StepLog) {
    if (!supabase || !user) {
      setStepLogs((current) => [{ ...entry, id: makeId("steps") }, ...current]);
      return;
    }
    setSyncStatus("Saving steps...");
    const { data, error } = await supabase.from("step_logs").insert({
      user_id: user.id,
      title: entry.title,
      steps: entry.steps,
      distance_km: entry.distanceKm,
      calories: entry.calories,
      source: entry.source
    }).select().single();
    if (error) { setSyncStatus(error.message); return; }
    setStepLogs((current) => [{ ...entry, id: data.id, time: toClock(data.logged_at), date: data.logged_at.slice(0, 10) }, ...current]);
    setSyncStatus("Steps saved.");
  }

  async function deleteStepLog(id: string) {
    if (supabase && user) {
      setSyncStatus("Deleting steps...");
      const { error } = await supabase.from("step_logs").delete().eq("id", id).eq("user_id", user.id);
      if (error) { setSyncStatus(error.message); return; }
      setSyncStatus("Steps deleted.");
    }
    setStepLogs((current) => current.filter((log) => log.id !== id));
  }

  const todaysLogs = useMemo(() => logs.filter((log) => log.date === today), [logs]);
  const todaysSteps = useMemo(() => stepLogs.filter((log) => log.date === today), [stepLogs]);
  const meals = todaysLogs.filter((log): log is MealLog => log.kind === "food");
  const workouts = todaysLogs.filter((log): log is WorkoutLog => log.kind === "workout");
  const expenses = logs.filter((log): log is ExpenseLog => log.kind === "expense");
  const stepsToday = todaysSteps.reduce((total, log) => total + log.steps, 0);
  const caloriesIn = meals.reduce((total, meal) => total + meal.calories, 0);
  const caloriesOut = workouts.reduce((total, workout) => total + workout.calories, 0);
  const protein = meals.reduce((total, meal) => total + meal.protein, 0);
  const carbs = meals.reduce((total, meal) => total + meal.carbs, 0);
  const fat = meals.reduce((total, meal) => total + meal.fat, 0);
  const scoredLogs = [...meals, ...workouts];
  const score = scoredLogs.length ? scoredLogs.reduce((total, log) => total + log.score, 0) / scoredLogs.length : 0;

  if (!authReady) return <LoadingShell />;

  return (
    <main className="app-shell">
      <section className="phone-frame">
        <Header tab={tab} userEmail={user?.email ?? null} syncStatus={syncStatus} />
        <div className="screen-content">
          {supabase && !user ? <AuthScreen /> : user && !isProfileComplete(profile) ? <ProfileSetupScreen email={user.email} profile={profile} onSave={saveProfile} /> : <>
            {tab === "home" && <HomeScreen caloriesIn={caloriesIn} caloriesOut={caloriesOut} protein={protein} carbs={carbs} fat={fat} score={score} stepsToday={stepsToday} logs={todaysLogs} profile={profile} onEdit={setEditing} onTab={setTab} />}
            {tab === "food" && <FoodScreen profile={profile} onSave={saveLog} />}
            {tab === "workout" && <WorkoutScreen profile={profile} onSave={saveLog} />}
            {tab === "steps" && <StepsScreen stepLogs={stepLogs} profile={profile} onSave={saveStepLog} onDelete={deleteStepLog} />}
            {tab === "expenses" && <ExpenseScreen expenses={expenses} onSave={saveLog} onEdit={setEditing} />}
            {tab === "history" && <HistoryScreen logs={logs} onEdit={setEditing} />}
            {tab === "profile" && <ProfileScreen session={session} syncStatus={syncStatus} profile={profile} onSave={saveProfile} />}
          </>}
        </div>
        {(!supabase || (user && isProfileComplete(profile))) && <BottomNav active={tab} onChange={setTab} />}
      </section>
      <aside className="desktop-panel">
        <div><p className="eyebrow">KYNEX MVP</p><h1>AI-powered fuel and effort tracking.</h1><p>Real AI analysis now uses your profile for better calorie and effort estimates while Supabase keeps logs, steps, and avatar data private.</p></div>
        <div className="desktop-grid"><Metric label="Calories in" value={caloriesIn.toLocaleString()} tone="green" /><Metric label="Burned" value={caloriesOut.toLocaleString()} tone="gold" /><Metric label="Steps" value={stepsToday.toLocaleString()} tone="green" /><Metric label="Readiness" value={`${score.toFixed(1)}`} tone="gold" /></div>
      </aside>
      {editing && <EditSheet entry={editing} onClose={() => setEditing(null)} onSave={updateLog} onDelete={deleteLog} />}
    </main>
  );
}

function LoadingShell() {
  return <main className="app-shell compact"><section className="phone-frame loading-phone"><Loader2 className="spin" size={28} /><p>Loading KYNEX...</p></section></main>;
}

function Header({ tab, userEmail, syncStatus }: { tab: Tab; userEmail: string | null; syncStatus: string }) {
  const titles: Record<Tab, string> = { home: "Home", food: "Log Food", workout: "Log Workout", steps: "Steps", expenses: "Expenses", history: "History", profile: "Profile" };
  return <header className="top-bar"><div className="brand-row"><span className="brand-mark">K</span><strong>KYNEX</strong></div><div className="top-actions"><button type="button" aria-label="Search"><Search size={16} /></button><button type="button" aria-label="Settings"><Settings size={16} /></button></div><h2>{titles[tab]}</h2><p className="sync-line">{userEmail ? `${userEmail} - ${syncStatus}` : syncStatus}</p></header>;
}

function AuthScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setMessage("");
    const result = mode === "signin" ? await supabase.auth.signInWithPassword({ email, password }) : await supabase.auth.signUp({ email, password });
    setBusy(false);
    if (result.error) { setMessage(result.error.message); return; }
    setMessage(mode === "signup" ? "Check your email to confirm signup." : "Signed in.");
  }

  async function googleSignIn() {
    if (!supabase) return;
    await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin } });
  }

  return (
    <form className="auth-card" onSubmit={submit}>
      <p className="eyebrow">Secure cloud mode</p>
      <h3>{mode === "signin" ? "Sign in to sync KYNEX" : "Create your KYNEX account"}</h3>
      <p>Use email/password now, and enable Google in Supabase when your OAuth client is ready.</p>
      <label className="field"><span>Email</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
      <label className="field"><span>Password</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={6} /></label>
      <button className="primary-button full" type="submit" disabled={busy}>{busy ? <Loader2 className="spin" size={17} /> : <ShieldCheck size={17} />}{mode === "signin" ? "Sign in" : "Create account"}</button>
      <button className="secondary-button full" type="button" onClick={googleSignIn}>Continue with Google</button>
      <button className="link-button" type="button" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>{mode === "signin" ? "Need an account? Sign up" : "Already have an account? Sign in"}</button>
      {message && <p className="support-note">{message}</p>}
    </form>
  );
}

function HomeScreen({ caloriesIn, caloriesOut, protein, carbs, fat, score, stepsToday, logs, profile, onEdit, onTab }: { caloriesIn: number; caloriesOut: number; protein: number; carbs: number; fat: number; score: number; stepsToday: number; logs: LogEntry[]; profile: UserProfile; onEdit: (entry: LogEntry) => void; onTab: (tab: Tab) => void }) {
  return (
    <div className="stack">
      <section className="hero-card"><p className="eyebrow">Remaining {labelFromValue(profile.goal).toLowerCase()} target</p><div className="hero-stat"><span>{Math.max(0, profile.dailyCalorieTarget - caloriesIn + caloriesOut).toLocaleString()}</span><small>kcal</small></div><div className="split-stats"><span><b>{caloriesIn.toLocaleString()}</b>eaten</span><span><b>{caloriesOut.toLocaleString()}</b>burned</span></div></section>
      <section><div className="section-title"><h3>Daily Macros</h3><Activity size={16} /></div><div className="macro-grid"><Ring label="Protein" value={protein} max={profile.proteinTarget} /><Ring label="Carbs" value={carbs} max={profile.carbsTarget} /><Ring label="Fat" value={fat} max={profile.fatTarget} /></div></section>
      <section className="steps-mini-card"><div><p className="eyebrow">Today steps</p><strong>{stepsToday.toLocaleString()}</strong><span>goal {Math.min(100, Math.round((stepsToday / 8000) * 100))}%</span></div><button type="button" className="icon-chip" onClick={() => onTab("steps")} aria-label="Open steps"><Footprints size={17} /></button></section>
      <section className="score-card"><p className="eyebrow">Health Score</p><strong>{score.toFixed(1)}</strong><span>out of 10 based on today's meal and effort balance</span></section>
      <section><div className="section-title"><h3>Today's Logs</h3><button type="button" onClick={() => onTab("history")}>View all</button></div><div className="log-list">{logs.map((log) => <LogCard key={log.id} entry={log} onEdit={onEdit} />)}</div></section>
      <div className="quick-actions"><button type="button" className="primary-button" onClick={() => onTab("food")}><Plus size={17} /> Log meal</button><button type="button" className="secondary-button" onClick={() => onTab("steps")}><Footprints size={17} /> Steps</button></div>
    </div>
  );
}

function FoodScreen({ profile, onSave }: { profile: UserProfile; onSave: (entry: LogEntry) => void }) {
  const [input, setInput] = useState("");
  const [imageUrl, setImageUrl] = useState<string | undefined>();
  const [imageFile, setImageFile] = useState<File | undefined>();
  const [draft, setDraft] = useState<MealLog | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [provider, setProvider] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);
  const speech = useSpeechInput((value) => setInput((current) => `${current} ${value}`.trim()));

  function onImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImageUrl(URL.createObjectURL(file));
  }

  async function analyze() {
    setAnalyzing(true);
    let imageDataUrl = "";
    if (imageFile) imageDataUrl = await fileToDataUrl(imageFile);
    const response = await fetch("/api/analyze/food", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: input, imageDataUrl, profile }) });
    const data = await response.json();
    setProvider(data.provider ?? "ai");
    const analysis = data.analysis;
    setDraft({ id: makeId("meal"), kind: "food", title: analysis.title, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), calories: analysis.calories, protein: analysis.protein, carbs: analysis.carbs, fat: analysis.fat, score: analysis.score, confidence: `${Math.round((analysis.confidence ?? 0.82) * 100)}%`, notes: analysis.notes, imageUrl, imageFile, source: imageFile ? "photo" : input ? "text" : "voice", date: today });
    setAnalyzing(false);
  }

  return (
    <div className="stack">
      <section className="capture-card"><div className="capture-preview">{imageUrl ? <img src={imageUrl} alt="Selected meal" /> : <><Camera size={36} /><span>Scan meal</span></>}</div><div className="capture-actions"><input ref={fileRef} className="hidden-input" type="file" accept="image/*" capture="environment" onChange={onImage} /><button type="button" className="primary-button" onClick={() => fileRef.current?.click()}><ImagePlus size={17} /> Photo</button><button type="button" className={speech.listening ? "voice-button listening" : "voice-button"} onClick={speech.toggle}><Mic size={17} /> {speech.listening ? "Listening" : "Speak"}</button></div>{!speech.supported && <p className="support-note">Speech input is not available in this browser.</p>}</section>
      <section className="input-card"><label htmlFor="food-input">Describe meal</label><textarea id="food-input" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Example: sourdough toast, avocado, poached egg..." /><button type="button" className="primary-button full" onClick={analyze} disabled={analyzing}>{analyzing ? <Loader2 className="spin" size={17} /> : <Sparkles size={17} />}{analyzing ? "Analyzing" : "Analyze food"}</button></section>
      {draft && <ReviewMeal draft={draft} provider={provider} onChange={setDraft} onSave={() => { onSave(draft); setDraft(null); setInput(""); setImageUrl(undefined); setImageFile(undefined); }} />}
    </div>
  );
}

function WorkoutScreen({ profile, onSave }: { profile: UserProfile; onSave: (entry: LogEntry) => void }) {
  const [input, setInput] = useState("");
  const [draft, setDraft] = useState<WorkoutLog | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [provider, setProvider] = useState("");
  const [imageUrl, setImageUrl] = useState<string | undefined>();
  const [imageFile, setImageFile] = useState<File | undefined>();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const speech = useSpeechInput((value) => setInput((current) => `${current} ${value}`.trim()));

  function onImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImageUrl(URL.createObjectURL(file));
  }

  async function analyze() {
    setAnalyzing(true);
    const response = await fetch("/api/analyze/workout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: input, bodyWeightKg: profile.weightKg, profile }) });
    const data = await response.json();
    setProvider(data.provider ?? "ai");
    const analysis = data.analysis;
    setDraft({ id: makeId("workout"), kind: "workout", title: analysis.title, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), duration: analysis.duration, calories: analysis.calories, effort: analysis.effort, score: analysis.score, movements: analysis.movements ?? [], notes: analysis.notes, imageUrl, imageFile, source: input ? "text" : "voice", date: today });
    setAnalyzing(false);
  }

  return (
    <div className="stack">
      <section className="capture-card workout-capture">
        <div className="capture-preview">{imageUrl ? <img src={imageUrl} alt="Workout progress" /> : <><Camera size={34} /><span>Progress photo</span></>}</div>
        <div className="capture-actions">
          <input ref={fileRef} className="hidden-input" type="file" accept="image/*" capture="environment" onChange={onImage} />
          <button type="button" className="secondary-button" onClick={() => fileRef.current?.click()}><ImagePlus size={17} /> Add image</button>
          {imageUrl && <button type="button" className="voice-button" onClick={() => { setImageUrl(undefined); setImageFile(undefined); }}>Remove</button>}
        </div>
      </section>
      <section className="input-card"><div className="input-heading"><label htmlFor="workout-input">Quantify your output</label><button type="button" className={speech.listening ? "icon-chip active" : "icon-chip"} onClick={speech.toggle} aria-label="Use microphone"><Mic size={16} /></button></div><textarea id="workout-input" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Example: 45 min strength training, squats, rows, walking lunges..." /><button type="button" className="primary-button full" onClick={analyze} disabled={analyzing}>{analyzing ? <Loader2 className="spin" size={17} /> : <Sparkles size={17} />}{analyzing ? "Analyzing" : "Analyze workout"}</button></section>
      <div className="workout-preset-grid">{["Strength", "Run", "Walk", "Yoga"].map((preset) => <button type="button" key={preset} onClick={() => setInput(preset)}>{preset}</button>)}</div>
      {draft && <ReviewWorkout draft={draft} provider={provider} onChange={setDraft} onSave={() => { onSave(draft); setDraft(null); setInput(""); setImageUrl(undefined); setImageFile(undefined); }} />}
    </div>
  );
}

function StepsScreen({ stepLogs, profile, onSave, onDelete }: { stepLogs: StepLog[]; profile: UserProfile; onSave: (entry: StepLog) => Promise<void> | void; onDelete: (id: string) => Promise<void> | void }) {
  const [manualSteps, setManualSteps] = useState(0);
  const [saving, setSaving] = useState(false);
  const counter = useStepCounter();
  const todaysStepLogs = stepLogs.filter((log) => log.date === today);
  const weekStepLogs = stepLogs.filter((log) => isWithinPeriod(log.date, "week"));
  const todayTotal = todaysStepLogs.reduce((total, log) => total + log.steps, 0);
  const weekTotal = weekStepLogs.reduce((total, log) => total + log.steps, 0);
  const sessionDistance = estimateStepDistanceKm(counter.steps, profile);
  const sessionCalories = estimateStepCalories(counter.steps, profile);
  const manualDistance = estimateStepDistanceKm(manualSteps, profile);
  const manualCalories = estimateStepCalories(manualSteps, profile);

  async function saveSteps(source: "motion" | "manual") {
    const steps = source === "motion" ? counter.steps : manualSteps;
    if (!steps || steps < 1) return;
    setSaving(true);
    await onSave({
      id: makeId("steps"),
      title: source === "motion" ? "Motion step session" : "Manual step entry",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      steps,
      distanceKm: estimateStepDistanceKm(steps, profile),
      calories: estimateStepCalories(steps, profile),
      source,
      date: today
    });
    if (source === "motion") counter.reset();
    else setManualSteps(0);
    setSaving(false);
  }

  return (
    <div className="stack">
      <section className="steps-hero">
        <div><p className="eyebrow">Today steps</p><strong>{todayTotal.toLocaleString()}</strong><span>{Math.min(100, Math.round((todayTotal / 8000) * 100))}% of 8,000</span></div>
        <div className="step-progress"><span style={{ width: `${Math.min(100, Math.round((todayTotal / 8000) * 100))}%` }} /></div>
      </section>

      <section className="step-session-card">
        <div className="section-title"><h3>Motion Session</h3><span>{counter.tracking ? "Live" : "Paused"}</span></div>
        <div className="step-session-main"><Footprints size={34} /><strong>{counter.steps.toLocaleString()}</strong><span>steps</span></div>
        <div className="step-stat-grid"><span><b>{sessionDistance.toFixed(2)}</b>km</span><span><b>{sessionCalories}</b>kcal</span><span><b>{counter.signal.toFixed(1)}</b>signal</span></div>
        <div className="step-actions">
          <button type="button" className={counter.tracking ? "secondary-button" : "primary-button"} onClick={counter.tracking ? counter.stop : counter.start}>{counter.tracking ? "Pause" : "Start"}</button>
          <button type="button" className="secondary-button" onClick={counter.reset}>Reset</button>
        </div>
        <button type="button" className="primary-button full" onClick={() => saveSteps("motion")} disabled={saving || counter.steps < 1}>{saving ? <Loader2 className="spin" size={17} /> : <Check size={17} />}Save session</button>
        <p className={counter.supported ? "support-note quiet" : "support-note"}>{counter.message}</p>
      </section>

      <section className="input-card">
        <label htmlFor="manual-steps">Manual steps</label>
        <input id="manual-steps" className="standalone-input" type="number" inputMode="numeric" min={0} value={manualSteps || ""} onChange={(event) => setManualSteps(Math.max(0, Number(event.target.value) || 0))} placeholder="Example: 6500" />
        <div className="step-stat-grid compact"><span><b>{manualDistance.toFixed(2)}</b>km</span><span><b>{manualCalories}</b>kcal</span><span><b>{weekTotal.toLocaleString()}</b>week</span></div>
        <button type="button" className="primary-button full" onClick={() => saveSteps("manual")} disabled={saving || manualSteps < 1}>{saving ? <Loader2 className="spin" size={17} /> : <Check size={17} />}Save steps</button>
      </section>

      {stepLogs.length > 0 && <section><div className="section-title"><h3>Recent steps</h3><span>{stepLogs.length}</span></div><div className="log-list">{stepLogs.slice(0, 10).map((log) => <StepLogCard key={log.id} entry={log} onDelete={onDelete} />)}</div></section>}
    </div>
  );
}

function ExpenseScreen({ expenses, onSave, onEdit }: { expenses: ExpenseLog[]; onSave: (entry: LogEntry) => void; onEdit: (entry: LogEntry) => void }) {
  const [input, setInput] = useState("");
  const [period, setPeriod] = useState<"day" | "week" | "month">("day");
  const [draft, setDraft] = useState<ExpenseLog | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [provider, setProvider] = useState("");
  const speech = useSpeechInput((value) => setInput((current) => `${current} ${value}`.trim()));
  const visibleExpenses = expenses.filter((expense) => isWithinPeriod(expense.date, period));
  const total = visibleExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const categories = visibleExpenses.reduce<Record<string, number>>((result, expense) => {
    result[expense.category] = (result[expense.category] ?? 0) + expense.amount;
    return result;
  }, {});

  async function analyze() {
    setAnalyzing(true);
    const response = await fetch("/api/analyze/expense", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: input }) });
    const data = await response.json();
    setProvider(data.provider ?? "ai");
    const analysis = data.analysis;
    setDraft({ id: makeId("expense"), kind: "expense", title: analysis.title, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), amount: Number(analysis.amount ?? 0), currency: analysis.currency || "INR", category: analysis.category || "miscellaneous", merchant: analysis.merchant || "", confidence: `${Math.round((analysis.confidence ?? 0.65) * 100)}%`, notes: analysis.notes, source: input ? "text" : "voice", date: today });
    setAnalyzing(false);
  }

  return <div className="stack"><section className="expense-summary"><div><p className="eyebrow">{period} spending</p><strong>{visibleExpenses[0]?.currency ?? "INR"} {total.toLocaleString()}</strong><span>{visibleExpenses.length} expenses logged</span></div><div className="period-toggle">{(["day", "week", "month"] as const).map((item) => <button type="button" key={item} className={period === item ? "active" : ""} onClick={() => setPeriod(item)}>{item}</button>)}</div></section><section className="input-card"><div className="input-heading"><label htmlFor="expense-input">Add expense</label><button type="button" className={speech.listening ? "icon-chip active" : "icon-chip"} onClick={speech.toggle} aria-label="Use microphone"><Mic size={16} /></button></div><textarea id="expense-input" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Example: paid Rs 420 for groceries at Reliance..." /><button type="button" className="primary-button full" onClick={analyze} disabled={analyzing}>{analyzing ? <Loader2 className="spin" size={17} /> : <Sparkles size={17} />}{analyzing ? "Analyzing" : "Analyze expense"}</button></section>{Object.keys(categories).length > 0 && <section className="category-list"><div className="section-title"><h3>Categories</h3><span>{period}</span></div>{Object.entries(categories).map(([category, amount]) => <div className="category-row" key={category}><span>{labelFromValue(category)}</span><b>{visibleExpenses[0]?.currency ?? "INR"} {amount.toLocaleString()}</b></div>)}</section>}{visibleExpenses.length > 0 && <section><div className="section-title"><h3>Recent expenses</h3><span>{visibleExpenses.length}</span></div><div className="log-list">{visibleExpenses.slice(0, 8).map((expense) => <LogCard key={expense.id} entry={expense} onEdit={onEdit} />)}</div></section>}{draft && <ReviewExpense draft={draft} provider={provider} onChange={setDraft} onSave={() => { onSave(draft); setDraft(null); setInput(""); }} />}</div>;
}

function HistoryScreen({ logs, onEdit }: { logs: LogEntry[]; onEdit: (entry: LogEntry) => void }) {
  const grouped = logs.reduce<Record<string, LogEntry[]>>((result, log) => {
    result[log.date] = result[log.date] ? [...result[log.date], log] : [log];
    return result;
  }, {});
  return <div className="stack">{Object.entries(grouped).map(([date, entries]) => <section key={date} className="history-day"><div className="section-title"><h3>{date === today ? "Today" : date}</h3><span>{entries.length} logs</span></div><div className="log-list">{entries.map((log) => <LogCard key={log.id} entry={log} onEdit={onEdit} />)}</div></section>)}</div>;
}

function ProfileSetupScreen({ email, profile, onSave }: { email?: string | null; profile: UserProfile; onSave: (profile: UserProfile, avatarFile?: File) => Promise<void> | void }) {
  return <ProfileEditor mode="setup" email={email} syncStatus="Complete once to personalize KYNEX." profile={profile} onSave={onSave} />;
}

function ProfileScreen({ session, syncStatus, profile, onSave }: { session: Session | null; syncStatus: string; profile: UserProfile; onSave: (profile: UserProfile, avatarFile?: File) => Promise<void> | void }) {
  return <ProfileEditor mode="settings" email={session?.user.email} syncStatus={syncStatus} profile={profile} onSave={onSave} onSignOut={async () => { if (supabase) await supabase.auth.signOut(); }} />;
}

function ProfileEditor({ mode, email, syncStatus, profile, onSave, onSignOut }: { mode: "setup" | "settings"; email?: string | null; syncStatus: string; profile: UserProfile; onSave: (profile: UserProfile, avatarFile?: File) => Promise<void> | void; onSignOut?: () => Promise<void> | void }) {
  const [draft, setDraft] = useState(profile);
  const [avatarFile, setAvatarFile] = useState<File | undefined>();
  const [avatarPreview, setAvatarPreview] = useState<string | undefined>(profile.avatarUrl);
  const [saving, setSaving] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const calculated = withCalculatedTargets(draft);
  const completionScore = Math.min(10, Math.round(((draft.age ? 2 : 0) + (draft.sex ? 2 : 0) + (draft.heightCm ? 2 : 0) + (draft.weightKg ? 2 : 0) + (draft.goal && draft.activityLevel ? 2 : 0)) * 10) / 10);

  useEffect(() => {
    setDraft(profile);
    setAvatarPreview(profile.avatarUrl);
    setAvatarFile(undefined);
  }, [profile]);

  function onAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    await onSave({ ...calculated, avatarUrl: avatarPreview, avatarPath: profile.avatarPath }, avatarFile);
    setSaving(false);
  }

  const initials = (draft.displayName || email || "A").slice(0, 1).toUpperCase();

  return <form className="stack" onSubmit={submit}><section className="profile-card editable-profile"><button type="button" className="avatar avatar-button" onClick={() => avatarInputRef.current?.click()} aria-label="Upload profile picture">{avatarPreview ? <img src={avatarPreview} alt="Profile" /> : initials}<span><ImagePlus size={14} /> Edit</span></button><input ref={avatarInputRef} className="hidden-input" type="file" accept="image/*" onChange={onAvatar} /><div><p className="eyebrow">{mode === "setup" ? "Profile setup" : "KYNEX profile"}</p><h3>{mode === "setup" ? "Personalize your targets" : draft.displayName || email || "Demo athlete"}</h3><p>{email ?? syncStatus}</p><span className="status-chip">{mode === "setup" ? "Required once" : "Cloud linked"}</span></div></section><section className="score-card profile-score"><p className="eyebrow">Personalization score</p><strong>{completionScore.toFixed(1)}</strong><span>{mode === "setup" ? "Finish these fields once; you can edit them anytime." : "out of 10 based on complete body and goal data"}</span></section><section className="profile-form"><div className="section-title"><h3>Body details</h3><User size={16} /></div><EditableText label="Display name" value={draft.displayName} onChange={(displayName) => setDraft({ ...draft, displayName })} /><div className="nutrition-grid"><NumberField label="Age" value={draft.age} onChange={(age) => setDraft({ ...draft, age })} /><SelectField label="Sex" value={draft.sex} options={[["", "Choose"], ["male", "Male"], ["female", "Female"], ["other", "Other"]]} onChange={(sex) => setDraft({ ...draft, sex })} /><NumberField label="Height cm" value={draft.heightCm} onChange={(heightCm) => setDraft({ ...draft, heightCm })} /><NumberField label="Weight kg" value={draft.weightKg} step={0.1} onChange={(weightKg) => setDraft({ ...draft, weightKg })} /></div></section><section className="profile-form"><div className="section-title"><h3>Goal and activity</h3><Activity size={16} /></div><SelectField label="Goal" value={draft.goal} options={[["fat_loss", "Fat loss"], ["recomposition", "Recomposition"], ["maintain", "Maintain"], ["muscle_gain", "Muscle gain"], ["performance", "Performance"]]} onChange={(goal) => setDraft({ ...draft, goal })} /><SelectField label="Daily activity" value={draft.activityLevel} options={[["sedentary", "Mostly sitting"], ["light", "Lightly active"], ["moderate", "Moderately active"], ["high", "Very active"], ["athlete", "Athlete level"]]} onChange={(activityLevel) => setDraft({ ...draft, activityLevel })} /><SelectField label="Training level" value={draft.trainingLevel} options={[["beginner", "Beginner"], ["intermediate", "Intermediate"], ["active", "Active"], ["advanced", "Advanced"], ["elite", "Elite"]]} onChange={(trainingLevel) => setDraft({ ...draft, trainingLevel })} /></section><section className="target-card"><p className="eyebrow">Auto-calculated daily targets</p><div className="target-main"><strong>{calculated.dailyCalorieTarget.toLocaleString()}</strong><span>kcal/day</span></div><div className="target-grid"><span><b>{calculated.proteinTarget}g</b>Protein</span><span><b>{calculated.carbsTarget}g</b>Carbs</span><span><b>{calculated.fatTarget}g</b>Fat</span></div><p className="support-note">Calculated from your body stats, goal, and activity level. KYNEX uses this for Home targets and AI analysis.</p></section>{mode === "settings" && <section className="profile-list"><ProfileRow icon={<ShieldCheck size={16} />} label="Security" value="Email/password and Google auth managed by Supabase" /></section>}<button type="submit" className="primary-button full" disabled={saving || completionScore < 10}>{saving ? <Loader2 className="spin" size={17} /> : <Check size={17} />}{saving ? "Saving profile" : mode === "setup" ? "Start tracking" : "Save profile"}</button>{mode === "settings" && onSignOut && <button type="button" className="secondary-button full" onClick={onSignOut}><LogOut size={17} /> Sign out</button>}</form>;
}

function ReviewMeal({ draft, provider, onChange, onSave }: { draft: MealLog; provider: string; onChange: (value: MealLog) => void; onSave: () => void }) {
  return <section className="review-card"><div className="section-title"><h3>AI nutrition draft</h3><span>{provider || draft.confidence}</span></div><EditableText label="Meal" value={draft.title} onChange={(title) => onChange({ ...draft, title })} /><div className="nutrition-grid"><NumberField label="Calories" value={draft.calories} onChange={(calories) => onChange({ ...draft, calories })} /><NumberField label="Protein" value={draft.protein} onChange={(protein) => onChange({ ...draft, protein })} /><NumberField label="Carbs" value={draft.carbs} onChange={(carbs) => onChange({ ...draft, carbs })} /><NumberField label="Fat" value={draft.fat} onChange={(fat) => onChange({ ...draft, fat })} /></div><NumberField label="Score out of 10" value={draft.score} step={0.1} onChange={(score) => onChange({ ...draft, score })} />{draft.notes && <p className="support-note">{draft.notes}</p>}<button type="button" className="primary-button full" onClick={onSave}><Check size={17} /> Save meal</button></section>;
}

function ReviewWorkout({ draft, provider, onChange, onSave }: { draft: WorkoutLog; provider: string; onChange: (value: WorkoutLog) => void; onSave: () => void }) {
  return <section className="review-card"><div className="section-title"><h3>AI effort draft</h3><span>{provider || draft.score.toFixed(1)}</span></div>{draft.imageUrl && <img className="review-photo" src={draft.imageUrl} alt="Workout progress draft" />}<EditableText label="Workout" value={draft.title} onChange={(title) => onChange({ ...draft, title })} /><div className="nutrition-grid"><NumberField label="Duration" value={draft.duration} onChange={(duration) => onChange({ ...draft, duration })} /><NumberField label="Burn" value={draft.calories} onChange={(calories) => onChange({ ...draft, calories })} /></div><EditableText label="Effort" value={draft.effort} onChange={(effort) => onChange({ ...draft, effort })} />{draft.notes && <p className="support-note">{draft.notes}</p>}<button type="button" className="primary-button full" onClick={onSave}><Check size={17} /> Confirm workout</button></section>;
}

function ReviewExpense({ draft, provider, onChange, onSave }: { draft: ExpenseLog; provider: string; onChange: (value: ExpenseLog) => void; onSave: () => void }) {
  return <section className="review-card"><div className="section-title"><h3>AI expense draft</h3><span>{provider || draft.confidence}</span></div><EditableText label="Expense" value={draft.title} onChange={(title) => onChange({ ...draft, title })} /><div className="nutrition-grid"><NumberField label="Amount" value={draft.amount} step={0.01} onChange={(amount) => onChange({ ...draft, amount })} /><EditableText label="Currency" value={draft.currency} onChange={(currency) => onChange({ ...draft, currency })} /></div><SelectField label="Category" value={draft.category} options={expenseCategoryOptions} onChange={(category) => onChange({ ...draft, category })} /><EditableText label="Merchant" value={draft.merchant} onChange={(merchant) => onChange({ ...draft, merchant })} />{draft.notes && <p className="support-note">{draft.notes}</p>}<button type="button" className="primary-button full" onClick={onSave}><Check size={17} /> Save expense</button></section>;
}

function EditSheet({ entry, onClose, onSave, onDelete }: { entry: LogEntry; onClose: () => void; onSave: (entry: LogEntry) => void; onDelete: (id: string) => void }) {
  const [draft, setDraft] = useState(entry);
  return <div className="modal-backdrop"><form className="edit-sheet" onSubmit={(event: FormEvent) => { event.preventDefault(); onSave(draft); }}><div className="sheet-header"><h3>Edit log</h3><button type="button" onClick={onClose} aria-label="Close"><X size={18} /></button></div><EditableText label="Title" value={draft.title} onChange={(title) => setDraft({ ...draft, title } as LogEntry)} />{draft.kind === "food" && <><div className="nutrition-grid"><NumberField label="Calories" value={draft.calories} onChange={(calories) => setDraft({ ...draft, calories })} /><NumberField label="Protein" value={draft.protein} onChange={(protein) => setDraft({ ...draft, protein })} /><NumberField label="Carbs" value={draft.carbs} onChange={(carbs) => setDraft({ ...draft, carbs })} /><NumberField label="Fat" value={draft.fat} onChange={(fat) => setDraft({ ...draft, fat })} /></div><NumberField label="Score" value={draft.score} step={0.1} onChange={(score) => setDraft({ ...draft, score })} /></>}{draft.kind === "workout" && <><div className="nutrition-grid"><NumberField label="Duration" value={draft.duration} onChange={(duration) => setDraft({ ...draft, duration })} /><NumberField label="Burn" value={draft.calories} onChange={(calories) => setDraft({ ...draft, calories })} /></div><EditableText label="Effort" value={draft.effort} onChange={(effort) => setDraft({ ...draft, effort })} /><NumberField label="Score" value={draft.score} step={0.1} onChange={(score) => setDraft({ ...draft, score })} /></>}{draft.kind === "expense" && <><div className="nutrition-grid"><NumberField label="Amount" value={draft.amount} step={0.01} onChange={(amount) => setDraft({ ...draft, amount })} /><EditableText label="Currency" value={draft.currency} onChange={(currency) => setDraft({ ...draft, currency })} /></div><SelectField label="Category" value={draft.category} options={expenseCategoryOptions} onChange={(category) => setDraft({ ...draft, category })} /><EditableText label="Merchant" value={draft.merchant} onChange={(merchant) => setDraft({ ...draft, merchant })} /></>}<div className="sheet-actions"><button type="button" className="danger-button" onClick={() => onDelete(entry.id)}>Delete</button><button type="submit" className="primary-button">Save changes</button></div></form></div>;
}

function LogCard({ entry, onEdit }: { entry: LogEntry; onEdit: (entry: LogEntry) => void }) {
  const isFood = entry.kind === "food";
  const isExpense = entry.kind === "expense";
  const hasPhoto = !isExpense && Boolean(entry.imageUrl);
  const iconClass = isFood ? "food" : isExpense ? "expense" : "workout";
  const meta = isFood ? "Food" : isExpense ? labelFromValue(entry.category) : entry.effort;
  const detail = isFood ? `${entry.calories} kcal - ${entry.protein}g protein` : isExpense ? `${entry.currency} ${entry.amount.toLocaleString()}${entry.merchant ? ` - ${entry.merchant}` : ""}` : `${entry.calories} kcal - ${entry.duration} min`;
  return <article className={hasPhoto ? "log-card with-photo" : "log-card"}>{hasPhoto ? <img className="meal-thumb" src={entry.imageUrl} alt={`${entry.title} ${entry.kind}`} /> : <div className={`log-icon ${iconClass}`}>{isFood ? <Utensils size={16} /> : isExpense ? <Wallet size={16} /> : <Dumbbell size={16} />}</div>}<div className="log-copy"><div className="log-topline"><span>{entry.time}</span><span>{meta}</span></div><h4>{entry.title}</h4><p>{detail}</p></div><button type="button" className="edit-button" onClick={() => onEdit(entry)} aria-label={`Edit ${entry.title}`}><Pencil size={15} /></button></article>;
}

function StepLogCard({ entry, onDelete }: { entry: StepLog; onDelete: (id: string) => Promise<void> | void }) {
  return <article className="log-card"><div className="log-icon steps"><Footprints size={16} /></div><div className="log-copy"><div className="log-topline"><span>{entry.time}</span><span>{entry.source}</span></div><h4>{entry.title}</h4><p>{entry.steps.toLocaleString()} steps - {entry.distanceKm.toFixed(2)} km - {entry.calories} kcal</p></div><button type="button" className="edit-button" onClick={() => onDelete(entry.id)} aria-label={`Delete ${entry.title}`}><X size={15} /></button></article>;
}

function BottomNav({ active, onChange }: { active: Tab; onChange: (tab: Tab) => void }) {
  const items: Array<{ key: Tab; label: string; icon: React.ReactNode }> = [{ key: "home", label: "Home", icon: <Home size={16} /> }, { key: "food", label: "Food", icon: <Utensils size={16} /> }, { key: "workout", label: "Workout", icon: <Dumbbell size={16} /> }, { key: "steps", label: "Steps", icon: <Footprints size={16} /> }, { key: "expenses", label: "Spend", icon: <Wallet size={16} /> }, { key: "history", label: "History", icon: <BarChart3 size={16} /> }, { key: "profile", label: "Profile", icon: <User size={16} /> }];
  return <nav className="bottom-nav">{items.map((item) => <button type="button" key={item.key} className={active === item.key ? "active" : ""} onClick={() => onChange(item.key)}>{item.icon}<span>{item.label}</span></button>)}</nav>;
}

function Metric({ label, value, tone }: { label: string; value: string | number; tone: "green" | "gold" }) {
  return <div className={`metric ${tone}`}><strong>{value}</strong><span>{label}</span></div>;
}

function Ring({ label, value, max }: { label: string; value: number; max: number }) {
  const percent = Math.min(100, Math.round((value / max) * 100));
  return <div className="ring-card"><div className="ring" style={{ background: `conic-gradient(#c6ff00 ${percent}%, #242424 ${percent}% 100%)` }}><span>{percent}%</span></div><b>{label}</b><small>{value}g</small></div>;
}

function NumberField({ label, value, onChange, step = 1 }: { label: string; value: number; onChange: (value: number) => void; step?: number }) {
  return <label className="field"><span>{label}</span><input type="number" value={value} step={step} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}

function EditableText({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="field"><span>{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: Array<[string, string]>; onChange: (value: string) => void }) {
  return <label className="field"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}>{options.map(([optionValue, labelText]) => <option key={optionValue} value={optionValue}>{labelText}</option>)}</select></label>;
}

function ProfileRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="profile-row"><span>{icon}</span><div><b>{label}</b><small>{value}</small></div><ChevronRight size={17} /></div>;
}
