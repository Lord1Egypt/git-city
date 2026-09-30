"use client";

import { useEffect } from "react";
import posthog from "posthog-js";
import type { Session } from "@supabase/supabase-js";
import { createBrowserSupabase } from "@/lib/supabase";

function loginOf(s: Session | null): string {
  const meta = s?.user?.user_metadata;
  return (meta?.user_name ?? meta?.preferred_username ?? "").toLowerCase();
}

/**
 * Ties PostHog events on every page to the signed-in GitHub login, so a visit
 * to /towns and a pick on /town/[slug] land on the same person.
 */
export default function PostHogIdentify() {
  useEffect(() => {
    const supabase = createBrowserSupabase();
    const identify = (s: Session | null) => {
      const login = loginOf(s);
      if (login) posthog.identify(login, { github_login: login });
    };
    supabase.auth.getSession().then(({ data: { session } }: { data: { session: Session | null } }) => identify(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: string, s: Session | null) => {
      if (event === "SIGNED_OUT") posthog.reset();
      else if (s && event !== "TOKEN_REFRESHED") identify(s);
    });
    return () => subscription.unsubscribe();
  }, []);

  return null;
}
