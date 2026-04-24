import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function POST() {
  const supabase = await createClient();

  // 🔐 destroy session
  await supabase.auth.signOut();

  // 🔁 redirect to login
  redirect("/login");
}