// src/middleware.ts (rename from "Middleware .ts" — remove the space)
// ─────────────────────────────────────────────────────────────────────────────
// AUTH MIDDLEWARE — role-aware route protection
//
// ROUTE RULES:
//   Not logged in  + /game or /dashboard  → /login
//   Logged in      + /login or /signup    → role-based destination
//   role=child     + /dashboard           → /game
//   role=parent    + /game                → /dashboard
// ─────────────────────────────────────────────────────────────────────────────

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Always use getUser() — refreshes the session token automatically
  const { data: { user } } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;

  // ── Not logged in ─────────────────────────────────────────────────────────
  const PUBLIC_PATHS = ["/", "/login", "/signup", "/terms"];

  if (!user) {
    const isPublic = PUBLIC_PATHS.some(
      (p) => pathname === p || (p !== "/" && pathname.startsWith(p + "/"))
    );
    if (!isPublic) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return supabaseResponse;
  }

  // ── Logged in ─────────────────────────────────────────────────────────────

  // Helper — fetch role once, only when needed
  // Cached per request (no extra calls for public pages)
  let _role: string | null = null;
  async function getRole(): Promise<string | null> {
    if (_role) return _role;
    const { data } = await supabase
      .from("users")
      .select("role")
      .eq("id", user!.id)
      .single();
    _role = data?.role ?? null;
    return _role;
  }

  // Redirect logged-in users away from auth pages
  if (pathname === "/login" || pathname === "/signup") {
    const role = await getRole();
    const dest = role === "child" ? "/game" : "/parent/dashboard";
    return NextResponse.redirect(new URL(dest, request.url));
  }

  // /game/* — children only
  if (pathname.startsWith("/game")) {
    const role = await getRole();
    if (role === "parent") {
      return NextResponse.redirect(new URL("/parent/dashboard", request.url));
    }
  }

  // /dashboard/* — parents only
  if (pathname.startsWith("/parent/dashboard")) {
    const role = await getRole();
    if (role === "child") {
      return NextResponse.redirect(new URL("/game", request.url));
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};