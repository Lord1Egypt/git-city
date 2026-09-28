import { getSupabaseAdmin } from "@/lib/supabase";

/**
 * Where a player lands after login. `next` is the page they started from;
 * only relative paths are allowed.
 */
export async function postLoginPath(next: string | null, githubLogin: string): Promise<string> {
  const home = `/?user=${encodeURIComponent(githubLogin)}`;
  if (!next || !githubLogin) return home;

  // Special case: /shop redirects to /shop/{username}
  if (next === "/shop") {
    const { data: dev } = await getSupabaseAdmin()
      .from("developers")
      .select("github_login")
      .eq("github_login", githubLogin)
      .maybeSingle();
    return dev ? `/shop/${encodeURIComponent(githubLogin)}` : home;
  }

  // Reject protocol-relative ("//evil.com") and backslash ("/\evil.com")
  // forms, which browsers treat as off-site open redirects.
  if (next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\")) {
    return next;
  }
  return home;
}
