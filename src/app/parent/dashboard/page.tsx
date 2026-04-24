// src/app/dashboard/page.tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 🚫 Not logged in → go back to login
  if (!user) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-primary text-white p-6 md:p-10">
      {/* Header */}
      <div className="flex justify-between items-center mb-10">
        <h1 className="text-2xl md:text-3xl font-display font-bold">
          Dashboard
        </h1>

        <form action="/signout" method="post">
          <button type="submit" className="btn-ghost px-4 py-2">
            Logout
          </button>
        </form>
      </div>

      {/* Welcome */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-6 mb-8">
        <h2 className="text-xl font-display mb-2">
          Welcome back {user.user_metadata.display_name}👋
        </h2>
        <p className="text-white/50 text-sm">
          {user.email}
        </p>
        {/* <p className="text-white/50 text-sm">
          {user.user_metadata.display_name}
        </p> */}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* Card 1 */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
          <h3 className="font-display text-lg mb-2">Your Progress</h3>
          <p className="text-white/40 text-sm">
            Start your journey through the Number Wilds.
          </p>
        </div>

        {/* Card 2 */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
          <h3 className="font-display text-lg mb-2">Zones</h3>
          <ul className="text-white/40 text-sm space-y-1">
            <li>• Pebble Shore</li>
            <li>• Echo Caves</li>
            <li>• Iron Summit</li>
          </ul>
        </div>

        {/* Card 3 */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
          <h3 className="font-display text-lg mb-2">Next Step</h3>
          <p className="text-white/40 text-sm">
            Add your child profile to begin.
          </p>
        </div>

      </div>
    </main>
  );
}