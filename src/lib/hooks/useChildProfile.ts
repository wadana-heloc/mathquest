"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/lib/hooks/useUser";

export interface ChildProfile {
  displayName: string;
  coins: number;
  currentZone: number;
  streak: number;
  totalXp: number;
  grade: number;
}

export function useChildProfile() {
  const { user, loading: userLoading } = useUser();
  const [profile, setProfile] = useState<ChildProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (userLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }

    const supabase = createClient();

    async function fetchProfile() {
      try {
        const [childRes, userRes] = await Promise.all([
          supabase
            .from("children")
            .select("coins, current_zone, streak_current, total_xp, grade")
            .eq("user_id", user!.id)
            .single(),
          supabase
            .from("users")
            .select("display_name")
            .eq("id", user!.id)
            .single(),
        ]);

        if (childRes.error) throw childRes.error;
        if (userRes.error) throw userRes.error;

        setProfile({
          displayName: userRes.data.display_name,
          coins: childRes.data.coins,
          currentZone: childRes.data.current_zone,
          streak: childRes.data.streak_current,
          totalXp: childRes.data.total_xp,
          grade: childRes.data.grade,
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to load profile";
        setError(message);
      } finally {
        setLoading(false);
      }
    }

    fetchProfile();

    // Live coin/streak updates — fires whenever the backend writes to children
    const channel = supabase
      .channel(`child-profile-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "children",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          setProfile((prev) =>
            prev
              ? {
                  ...prev,
                  coins: row.coins as number,
                  streak: row.streak_current as number,
                }
              : prev
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, userLoading]);

  return { profile, loading: loading || userLoading, error };
}
