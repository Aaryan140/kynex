---
name: testing-kynex
description: Test the kynex Next.js app end-to-end. Use when verifying UI, API routes, or refactoring changes.
---

# Testing Kynex App

## Local Dev Setup

```bash
cd /home/ubuntu/repos/kynex
npm install
npx next dev --port 3000
```

The app runs at `http://localhost:3000`.

## Demo Mode

Without Supabase or Gemini API keys, the app runs in **demo mode**:
- Header shows "Demo mode: add Supabase keys to enable cloud sync."
- Starter logs are pre-populated (food, workout, expense entries)
- API analysis routes return mock data via `callGeminiAnalysis` with `provider: "mock"`
- File uploads (Supabase Storage) are non-functional but the UI still renders

Demo mode is sufficient for testing UI rendering, navigation, and the mock analysis flow.

## Key Test Flows

### 1. Food Analysis
- Navigate to **Food** tab (bottom nav)
- Type a meal description in the textarea (e.g. "chicken salad with rice")
- Click **Analyze food**
- Expect: "AI nutrition draft" review card with MOCK badge, editable fields (Meal, Calories, Protein, Carbs, Fat, Score), and "Save meal" button
- Mock returns fixed values based on input keywords

### 2. Workout Analysis
- Navigate to **Workout** tab
- Type a workout description (e.g. "30 min easy walk")
- Click **Analyze workout**
- Expect: "AI effort draft" review card with MOCK badge, fields (Workout, Duration, Burn, Effort), and "Confirm workout" button
- Preset buttons (Strength, Run, Walk, Yoga) populate the textarea

### 3. Expense Analysis
- Navigate to **Spend** tab
- Type an expense description (e.g. "uber cab Rs 250")
- Click **Analyze expense**
- Expect: "AI expense draft" review card with MOCK badge, fields (Expense, Amount, Currency, Category dropdown, Merchant), and "Save expense" button

### 4. Home Screen (Regression)
- Navigate to **Home** tab
- Verify: Hero calorie card, Daily Macros rings (Protein/Carbs/Fat), Today Steps, Health Score, Today's Logs section with starter entries, 7-tab bottom nav

### 5. Image Picker UI
- **Food** tab: Camera icon + "Scan meal" placeholder + Photo/Speak buttons
- **Workout** tab: Camera icon + "Progress photo" placeholder + Add image button
- Cannot test actual file selection in automated testing without file dialog interaction

## Architecture Notes

- Single-page app in `app/page.tsx` (~1400 lines) with all screens as components
- API routes at `app/api/analyze/{food,workout,expense}/route.ts` use shared `lib/gemini.ts`
- `callGeminiAnalysis<T>()` handles both real Gemini API calls and mock fallbacks
- `useImagePicker()` hook provides shared image state for FoodScreen and WorkoutScreen
- Bottom nav has 7 tabs: Home, Food, Workout, Steps, Spend, History, Profile

## Vercel Preview

PR previews deploy to Vercel but may require Vercel authentication. If the preview redirects to a Vercel login page, test locally instead using `npx next dev`.

## Devin Secrets Needed

- `GEMINI_API_KEY` (optional) - For testing real Gemini AI analysis instead of mock
- `NEXT_PUBLIC_SUPABASE_URL` (optional) - For testing Supabase cloud sync
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (optional) - For testing Supabase cloud sync

None are required for basic demo-mode testing.
