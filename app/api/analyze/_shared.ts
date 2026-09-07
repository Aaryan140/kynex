import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Verifies a bearer token with Supabase before a route spends the server-side
 * Gemini API key. The publishable key is intentionally used here: getUser()
 * validates the supplied JWT with Supabase and grants no elevated database
 * access.
 */
export async function hasAuthenticatedUser(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const authorization = request.headers.get("authorization");
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];

  if (!url || !key || !token) return false;

  try {
    const supabase = createClient(url, key, { auth: { persistSession: false } });
    const { data, error } = await supabase.auth.getUser(token);
    return !error && Boolean(data.user);
  } catch {
    return false;
  }
}

export function needsAuthenticatedUser() {
  return Boolean(process.env.GEMINI_API_KEY);
}
