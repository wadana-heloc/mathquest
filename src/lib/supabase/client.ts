// src/lib/supabase/client.ts
// ─────────────────────────────────────────────────────────────────────────────
// BROWSER SUPABASE CLIENT
// Use this in Client Components ("use client") and event handlers.
// Creates one instance per browser tab (singleton pattern).
// ─────────────────────────────────────────────────────────────────────────────

import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}