import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

const MAX_PROMPT_CHARS = 4000;
const MAX_IMAGE_DATA_URL_CHARS = 6_000_000;

export async function readJsonBody(request: NextRequest) {
  try {
    const body = await request.json();
    return body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

export function textValue(value: unknown, maxLength = MAX_PROMPT_CHARS) {
  return typeof value === "string" ? value.slice(0, maxLength).trim() : "";
}

export function objectValue(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function numberValue(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function parseJsonOrFallback<T>(text: string, fallback: T): T {
  try {
    const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return fallback;
  }
}

export function imageDataUrlParts(value: unknown) {
  if (typeof value !== "string" || value.length > MAX_IMAGE_DATA_URL_CHARS) return null;
  const match = value.match(/^data:(image\/(?:jpeg|jpg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return null;
  return { mimeType: match[1] === "image/jpg" ? "image/jpeg" : match[1], data: match[2] };
}

export async function hasAuthenticatedUser(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!url || !key || !token) return false;

  const client = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  const { data, error } = await client.auth.getUser(token);
  return !error && Boolean(data.user);
}
