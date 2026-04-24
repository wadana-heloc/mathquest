// src/lib/supabase/server.ts
// ─────────────────────────────────────────────────────────────────────────────
// SERVER SUPABASE CLIENT
// Use this in Server Components, Server Actions, and API Routes.
// Reads the session from cookies — never from localStorage.
// ─────────────────────────────────────────────────────────────────────────────

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  // In Next.js 14+, cookies() must be awaited
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // Read a cookie by name
        getAll() {
          return cookieStore.getAll();
        },
        // Write cookies (called after login/logout to store the session)
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll can fail in Server Components (read-only).
            // Safe to ignore — middleware will refresh the session.
          }
        },
      },
    }
  );
}