"use client";

import {
  Activity,
  BarChart3,
  Camera,
  Check,
  ChevronRight,
  Dumbbell,
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
  X
} from "lucide-react";
import { Session } from "@supabase/supabase-js";
import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "../lib/supabase/client";

type Tab = "home" | "food" | "workout" | "history" | "profile";
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
  source: "voice" | "text";
  date: string;
};

type LogEntry = MealLog | WorkoutLog;

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

function yesterday() {
  const value = new Date();
  value.setDate(value.getDate() - 1);
  return value.toISOString().slice(0, 10);
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

export default function KynexApp() {
  const [tab, setTab] = useState<Tab>("home");
  const [logs, setLogs] = useState<LogEntry[]>(starterLogs);
  const [editing, setEditing] = useState<LogEntry | null>(null);
  const [session, setSession] = useState<Session | null>(null);
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
      return;
    }
    void loadCloudLogs(user.id);
  }, [user?.id]);

  async function loadCloudLogs(userId: string) {
    if (!supabase) return;
    setSyncStatus("Loading your KYNEX logs...");
    const [{ data: foods, error: foodError }, { data: workouts, error: workoutError }] = await Promise.all([
      supabase.from("food_logs").select("*").eq("user_id", userId).order("logged_at", { ascending: false }).limit(100),
      supabase.from("workout_logs").select("*").eq("user_id", userId).order("logged_at", { ascending: false }).limit(100)
    ]);
    if (foodError || workoutError) {
      setSyncStatus("Supabase tables are not ready yet. Run supabase/schema.sql, then refresh.");
      setLogs(starterLogs);
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
    const workoutLogs = (workouts ?? []).map((row) => ({
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
      source: row.source,
      date: row.logged_at.slice(0, 10)
    } satisfies WorkoutLog));
    setLogs([...foodLogs, ...workoutLogs].sort((a, b) => (a.date < b.date ? 1 : -1)));
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
    } else {
      const { data, error } = await supabase.from("workout_logs").insert({
        user_id: user.id,
        title: entry.title,
        source: entry.source,
        duration_minutes: entry.duration,
        calories_burned: entry.calories,
        effort: entry.effort,
        movements: entry.movements,
        score: entry.score,
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
      const table = updated.kind === "food" ? "food_logs" : "workout_logs";
      const payload = updated.kind === "food"
        ? { title: updated.title, calories: updated.calories, protein_g: updated.protein, carbs_g: updated.carbs, fat_g: updated.fat, score: updated.score, updated_at: new Date().toISOString() }
        : { title: updated.title, duration_minutes: updated.duration, calories_burned: updated.calories, effort: updated.effort, score: updated.score, updated_at: new Date().toISOString() };
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
      const table = existing.kind === "food" ? "food_logs" : "workout_logs";
      const { error } = await supabase.from(table).delete().eq("id", id).eq("user_id", user.id);
      if (error) { setSyncStatus(error.message); return; }
      setSyncStatus("Log deleted.");
    }
    setLogs((current) => current.filter((log) => log.id !== id));
    setEditing(null);
  }

  const todaysLogs = useMemo(() => logs.filter((log) => log.date === today), [logs]);
  const meals = todaysLogs.filter((log): log is MealLog => log.kind === "food");
  const workouts = todaysLogs.filter((log): log is WorkoutLog => log.kind === "workout");
  const caloriesIn = meals.reduce((total, meal) => total + meal.calories, 0);
  const caloriesOut = workouts.reduce((total, workout) => total + workout.calories, 0);
  const protein = meals.reduce((total, meal) => total + meal.protein, 0);
  const score = todaysLogs.length ? todaysLogs.reduce((total, log) => total + log.score, 0) / todaysLogs.length : 0;

  if (!authReady) return <LoadingShell />;

  return (
    <main className="app-shell">
      <section className="phone-frame">
        <Header tab={tab} userEmail={user?.email ?? null} syncStatus={syncStatus} />
        <div className="screen-content">
          {supabase && !user ? <AuthScreen /> : <>
            {tab === "home" && <HomeScreen caloriesIn={caloriesIn} caloriesOut={caloriesOut} protein={protein} score={score} logs={todaysLogs} onEdit={setEditing} onTab={setTab} />}
            {tab === "food" && <FoodScreen onSave={saveLog} />}
            {tab === "workout" && <WorkoutScreen onSave={saveLog} />}
            {tab === "history" && <HistoryScreen logs={logs} onEdit={setEditing} />}
            {tab === "profile" && <ProfileScreen session={session} syncStatus={syncStatus} />}
          </>}
        </div>
        {(!supabase || user) && <BottomNav active={tab} onChange={setTab} />}
      </section>
      <aside className="desktop-panel">
        <div><p className="eyebrow">KYNEX MVP</p><h1>AI-powered fuel and effort tracking.</h1><p>Real AI analysis now runs through server routes, and Supabase sync turns on automatically once your project keys are in .env.local.</p></div>
        <div className="desktop-grid"><Metric label="Calories in" value={caloriesIn.toLocaleString()} tone="green" /><Metric label="Burned" value={caloriesOut.toLocaleString()} tone="gold" /><Metric label="Protein" value={`${protein}g`} tone="green" /><Metric label="Readiness" value={`${score.toFixed(1)}`} tone="gold" /></div>
      </aside>
      {editing && <EditSheet entry={editing} onClose={() => setEditing(null)} onSave={updateLog} onDelete={deleteLog} />}
    </main>
  );
}

function LoadingShell() {
  return <main className="app-shell compact"><section className="phone-frame loading-phone"><Loader2 className="spin" size={28} /><p>Loading KYNEX...</p></section></main>;
}

function Header({ tab, userEmail, syncStatus }: { tab: Tab; userEmail: string | null; syncStatus: string }) {
  const titles: Record<Tab, string> = { home: "Home", food: "Log Food", workout: "Log Workout", history: "History", profile: "Profile" };
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

function HomeScreen({ caloriesIn, caloriesOut, protein, score, logs, onEdit, onTab }: { caloriesIn: number; caloriesOut: number; protein: number; score: number; logs: LogEntry[]; onEdit: (entry: LogEntry) => void; onTab: (tab: Tab) => void }) {
  return (
    <div className="stack">
      <section className="hero-card"><p className="eyebrow">Remaining deficit target</p><div className="hero-stat"><span>{Math.max(0, 2200 - caloriesIn + caloriesOut).toLocaleString()}</span><small>kcal</small></div><div className="split-stats"><span><b>{caloriesIn.toLocaleString()}</b>eaten</span><span><b>{caloriesOut.toLocaleString()}</b>burned</span></div></section>
      <section><div className="section-title"><h3>Daily Macros</h3><Activity size={16} /></div><div className="macro-grid"><Ring label="Protein" value={protein} max={180} /><Ring label="Carbs" value={105} max={240} /><Ring label="Fat" value={46} max={80} /></div></section>
      <section className="score-card"><p className="eyebrow">Health Score</p><strong>{score.toFixed(1)}</strong><span>out of 10 based on today's meal and effort balance</span></section>
      <section><div className="section-title"><h3>Today's Logs</h3><button type="button" onClick={() => onTab("history")}>View all</button></div><div className="log-list">{logs.map((log) => <LogCard key={log.id} entry={log} onEdit={onEdit} />)}</div></section>
      <div className="quick-actions"><button type="button" className="primary-button" onClick={() => onTab("food")}><Plus size={17} /> Log meal</button><button type="button" className="secondary-button" onClick={() => onTab("workout")}><Dumbbell size={17} /> Workout</button></div>
    </div>
  );
}

function FoodScreen({ onSave }: { onSave: (entry: LogEntry) => void }) {
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
    const response = await fetch("/api/analyze/food", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: input, imageDataUrl }) });
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

function WorkoutScreen({ onSave }: { onSave: (entry: LogEntry) => void }) {
  const [input, setInput] = useState("");
  const [draft, setDraft] = useState<WorkoutLog | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [provider, setProvider] = useState("");
  const speech = useSpeechInput((value) => setInput((current) => `${current} ${value}`.trim()));

  async function analyze() {
    setAnalyzing(true);
    const response = await fetch("/api/analyze/workout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: input, bodyWeightKg: 78 }) });
    const data = await response.json();
    setProvider(data.provider ?? "ai");
    const analysis = data.analysis;
    setDraft({ id: makeId("workout"), kind: "workout", title: analysis.title, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), duration: analysis.duration, calories: analysis.calories, effort: analysis.effort, score: analysis.score, movements: analysis.movements ?? [], notes: analysis.notes, source: input ? "text" : "voice", date: today });
    setAnalyzing(false);
  }

  return <div className="stack"><section className="input-card"><div className="input-heading"><label htmlFor="workout-input">Quantify your output</label><button type="button" className={speech.listening ? "icon-chip active" : "icon-chip"} onClick={speech.toggle} aria-label="Use microphone"><Mic size={16} /></button></div><textarea id="workout-input" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Example: 45 min strength training, squats, rows, walking lunges..." /><button type="button" className="primary-button full" onClick={analyze} disabled={analyzing}>{analyzing ? <Loader2 className="spin" size={17} /> : <Sparkles size={17} />}{analyzing ? "Analyzing" : "Analyze workout"}</button></section><div className="workout-preset-grid">{["Strength", "Run", "Walk", "Yoga"].map((preset) => <button type="button" key={preset} onClick={() => setInput(preset)}>{preset}</button>)}</div>{draft && <ReviewWorkout draft={draft} provider={provider} onChange={setDraft} onSave={() => { onSave(draft); setDraft(null); setInput(""); }} />}</div>;
}

function HistoryScreen({ logs, onEdit }: { logs: LogEntry[]; onEdit: (entry: LogEntry) => void }) {
  const grouped = logs.reduce<Record<string, LogEntry[]>>((result, log) => {
    result[log.date] = result[log.date] ? [...result[log.date], log] : [log];
    return result;
  }, {});
  return <div className="stack">{Object.entries(grouped).map(([date, entries]) => <section key={date} className="history-day"><div className="section-title"><h3>{date === today ? "Today" : date}</h3><span>{entries.length} logs</span></div><div className="log-list">{entries.map((log) => <LogCard key={log.id} entry={log} onEdit={onEdit} />)}</div></section>)}</div>;
}

function ProfileScreen({ session, syncStatus }: { session: Session | null; syncStatus: string }) {
  async function signOut() {
    if (supabase) await supabase.auth.signOut();
  }
  return <div className="stack"><section className="profile-card"><div className="avatar">{session?.user.email?.slice(0, 1).toUpperCase() ?? "A"}</div><div><h3>{session?.user.email ?? "Demo athlete"}</h3><p>{syncStatus}</p><span className="status-chip">{session ? "Cloud linked" : "Demo mode"}</span></div></section><section className="score-card profile-score"><p className="eyebrow">Strength score</p><strong>94.2</strong><span>top 3% of daily users this week</span></section><section className="profile-list"><ProfileRow icon={<User size={16} />} label="Personal information" value="Age, height, weight, goal" /><ProfileRow icon={<Activity size={16} />} label="Training intensity" value="Current level: elite" /><ProfileRow icon={<ShieldCheck size={16} />} label="Security" value="Email/password and Google auth" /></section>{session && <button type="button" className="secondary-button full" onClick={signOut}><LogOut size={17} /> Sign out</button>}</div>;
}

function ReviewMeal({ draft, provider, onChange, onSave }: { draft: MealLog; provider: string; onChange: (value: MealLog) => void; onSave: () => void }) {
  return <section className="review-card"><div className="section-title"><h3>AI nutrition draft</h3><span>{provider || draft.confidence}</span></div><EditableText label="Meal" value={draft.title} onChange={(title) => onChange({ ...draft, title })} /><div className="nutrition-grid"><NumberField label="Calories" value={draft.calories} onChange={(calories) => onChange({ ...draft, calories })} /><NumberField label="Protein" value={draft.protein} onChange={(protein) => onChange({ ...draft, protein })} /><NumberField label="Carbs" value={draft.carbs} onChange={(carbs) => onChange({ ...draft, carbs })} /><NumberField label="Fat" value={draft.fat} onChange={(fat) => onChange({ ...draft, fat })} /></div><NumberField label="Score out of 10" value={draft.score} step={0.1} onChange={(score) => onChange({ ...draft, score })} />{draft.notes && <p className="support-note">{draft.notes}</p>}<button type="button" className="primary-button full" onClick={onSave}><Check size={17} /> Save meal</button></section>;
}

function ReviewWorkout({ draft, provider, onChange, onSave }: { draft: WorkoutLog; provider: string; onChange: (value: WorkoutLog) => void; onSave: () => void }) {
  return <section className="review-card"><div className="section-title"><h3>AI effort draft</h3><span>{provider || draft.score.toFixed(1)}</span></div><EditableText label="Workout" value={draft.title} onChange={(title) => onChange({ ...draft, title })} /><div className="nutrition-grid"><NumberField label="Duration" value={draft.duration} onChange={(duration) => onChange({ ...draft, duration })} /><NumberField label="Burn" value={draft.calories} onChange={(calories) => onChange({ ...draft, calories })} /></div><EditableText label="Effort" value={draft.effort} onChange={(effort) => onChange({ ...draft, effort })} />{draft.notes && <p className="support-note">{draft.notes}</p>}<button type="button" className="primary-button full" onClick={onSave}><Check size={17} /> Confirm workout</button></section>;
}

function EditSheet({ entry, onClose, onSave, onDelete }: { entry: LogEntry; onClose: () => void; onSave: (entry: LogEntry) => void; onDelete: (id: string) => void }) {
  const [draft, setDraft] = useState(entry);
  return <div className="modal-backdrop"><form className="edit-sheet" onSubmit={(event: FormEvent) => { event.preventDefault(); onSave(draft); }}><div className="sheet-header"><h3>Edit log</h3><button type="button" onClick={onClose} aria-label="Close"><X size={18} /></button></div><EditableText label="Title" value={draft.title} onChange={(title) => setDraft({ ...draft, title } as LogEntry)} />{draft.kind === "food" ? <div className="nutrition-grid"><NumberField label="Calories" value={draft.calories} onChange={(calories) => setDraft({ ...draft, calories })} /><NumberField label="Protein" value={draft.protein} onChange={(protein) => setDraft({ ...draft, protein })} /><NumberField label="Carbs" value={draft.carbs} onChange={(carbs) => setDraft({ ...draft, carbs })} /><NumberField label="Fat" value={draft.fat} onChange={(fat) => setDraft({ ...draft, fat })} /></div> : <div className="nutrition-grid"><NumberField label="Duration" value={draft.duration} onChange={(duration) => setDraft({ ...draft, duration })} /><NumberField label="Burn" value={draft.calories} onChange={(calories) => setDraft({ ...draft, calories })} /></div>}<NumberField label="Score" value={draft.score} step={0.1} onChange={(score) => setDraft({ ...draft, score } as LogEntry)} /><div className="sheet-actions"><button type="button" className="danger-button" onClick={() => onDelete(entry.id)}>Delete</button><button type="submit" className="primary-button">Save changes</button></div></form></div>;
}

function LogCard({ entry, onEdit }: { entry: LogEntry; onEdit: (entry: LogEntry) => void }) {
  const isFood = entry.kind === "food";
  return <article className={isFood && entry.imageUrl ? "log-card with-photo" : "log-card"}>{isFood && entry.imageUrl ? <img className="meal-thumb" src={entry.imageUrl} alt={`${entry.title} meal`} /> : <div className={isFood ? "log-icon food" : "log-icon workout"}>{isFood ? <Utensils size={16} /> : <Dumbbell size={16} />}</div>}<div className="log-copy"><div className="log-topline"><span>{entry.time}</span><span>{isFood ? "Food" : entry.effort}</span></div><h4>{entry.title}</h4><p>{isFood ? `${entry.calories} kcal - ${entry.protein}g protein` : `${entry.calories} kcal - ${entry.duration} min`}</p></div><button type="button" className="edit-button" onClick={() => onEdit(entry)} aria-label={`Edit ${entry.title}`}><Pencil size={15} /></button></article>;
}

function BottomNav({ active, onChange }: { active: Tab; onChange: (tab: Tab) => void }) {
  const items: Array<{ key: Tab; label: string; icon: React.ReactNode }> = [{ key: "home", label: "Home", icon: <Home size={18} /> }, { key: "food", label: "Food", icon: <Utensils size={18} /> }, { key: "workout", label: "Workout", icon: <Dumbbell size={18} /> }, { key: "history", label: "History", icon: <BarChart3 size={18} /> }, { key: "profile", label: "Profile", icon: <User size={18} /> }];
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

function ProfileRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="profile-row"><span>{icon}</span><div><b>{label}</b><small>{value}</small></div><ChevronRight size={17} /></div>;
}
