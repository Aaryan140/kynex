import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ auth: {}, from: vi.fn() }))
}));

describe("getSupabaseBrowserClient", () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  });

  it("returns null when URL is missing", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-key";
    const { getSupabaseBrowserClient } = await import("./client");
    expect(getSupabaseBrowserClient()).toBeNull();
  });

  it("returns null when key is missing", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    const { getSupabaseBrowserClient } = await import("./client");
    expect(getSupabaseBrowserClient()).toBeNull();
  });

  it("returns null when both are missing", async () => {
    const { getSupabaseBrowserClient } = await import("./client");
    expect(getSupabaseBrowserClient()).toBeNull();
  });

  it("returns a client when both URL and key are set", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-key";
    const { getSupabaseBrowserClient } = await import("./client");
    const client = getSupabaseBrowserClient();
    expect(client).not.toBeNull();
  });

  it("returns the same client instance on multiple calls (singleton)", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-key";
    const { getSupabaseBrowserClient } = await import("./client");
    const first = getSupabaseBrowserClient();
    const second = getSupabaseBrowserClient();
    expect(first).toBe(second);
  });
});
