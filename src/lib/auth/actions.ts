"use server";
// src/lib/auth/actions.ts
// ─────────────────────────────────────────────────────────────────────────────
// AUTH SERVER ACTIONS — with role-based redirect after login
//
// After login succeeds:
//   role = 'child'  → redirect to /game
//   role = 'parent' → redirect to /dashboard
//
// IMPORTANT: We query the public.users table (not auth.users) for the role.
// The backend created this table — we just read from it.
// ─────────────────────────────────────────────────────────────────────────────

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LoginResult {
  error?: string;
}

export interface SignupResult {
  error?: string;
}

// ── Login ─────────────────────────────────────────────────────────────────────

export async function login(
  email: string,
  password: string
): Promise<LoginResult> {
  const supabase = await createClient();

  // Step 1 — authenticate the user
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    if (error.message.includes("Invalid login credentials")) {
      return { error: "Wrong email or password. Please try again." };
    }
    if (error.message.includes("Email not confirmed")) {
      return { error: "Please confirm your email before logging in." };
    }
    return { error: "Something went wrong. Please try again." };
  }

  // Step 2 — fetch the role from the users table
  // We query public.users using the auth user's ID.
  // NOTE: if your column is named differently (e.g. "user_role"),
  //       change "role" below to match your actual column name.
  const { data: userData, error: userError } = await supabase
    .from("users")                    // ← your public.users table
    .select("role")                   // ← the role column
    .eq("id", data.user.id)           // ← match by Supabase auth user id
    .single();

  if (userError || !userData) {
    // User authenticated but no record in users table.
    // This means the DB trigger didn't run — backend issue.
    // Sign them out and report it clearly.
    await supabase.auth.signOut();
    return {
      error: "Account setup incomplete. Please contact support.",
    };
  }

  revalidatePath("/", "layout");

  // Step 3 — redirect based on role
  if (userData.role === "child") {
    redirect("/game");          // → Child game hub
  } else {
    redirect("/parent/dashboard");     // → Parent dashboard
  }
}

// ── Signup ────────────────────────────────────────────────────────────────────

export async function signup(
  name: string,
  email: string,
  password: string
): Promise<SignupResult> {
  const supabase = await createClient();

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        // These go into auth.users.raw_user_meta_data
        // Your backend DB trigger reads these to populate public.users
        display_name: name,
        role: "parent",         // All self-registered users are parents
      },
    },
  });

  if (error) {
    if (error.message.includes("User already registered")) {
      return { error: "An account with this email already exists. Try logging in." };
    }
    if (error.message.includes("Password should be at least")) {
      return { error: "Password must be at least 6 characters." };
    }
    return { error: "Couldn't create your account. Please try again." };
  }

  revalidatePath("/", "layout");
  redirect("/login?message=check-your-email");
}

// ── Logout ────────────────────────────────────────────────────────────────────

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

// ── Get current user ──────────────────────────────────────────────────────────

export async function getCurrentUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// ── Get user with role ────────────────────────────────────────────────────────
// Use this in Server Components when you need both the auth user and their role.

export async function getUserWithRole() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: userData } = await supabase
    .from("users")
    .select("id, email, role, parent_id, created_at")
    .eq("id", user.id)
    .single();

  return userData ?? null;
}