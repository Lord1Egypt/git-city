import { NextResponse, after } from "next/server";
import { cookies } from "next/headers";
import { createServerSupabase } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { githubLoginFromIdentity } from "@/lib/auth-identity";
import { fetchUserOrgs, syncOrgVerifications } from "@/lib/leagues/verification";

// Extend timeout for the org lookup that runs after the redirect
export const maxDuration = 60;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const { searchParams } = url;
  // Atrás do proxy dev do portless, request.url é o localhost:PORT interno, então
  // os redirects cairiam em https://localhost:PORT (SSL error). PORTLESS_URL é a
  // URL pública https desta worktree; em produção não existe → usa o origin real.
  const origin = (process.env.PORTLESS_URL ?? url.origin).replace(/\/$/, "");
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/?error=no_code`);
  }

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/?error=auth_failed`);
  }

  // From the GitHub identity GoTrue wrote, never user_metadata (user-editable).
  const githubLogin = githubLoginFromIdentity(data.user);

  // The building is built after the redirect, streaming each step so the
  // player sees progress instead of a frozen page. ?ref= from the login URL,
  // else the gc_ref cookie set by the proxy on any page.
  const cookieStore = await cookies();
  const ref = searchParams.get("ref") ?? cookieStore.get("gc_ref")?.value ?? null;
  cookieStore.delete("gc_ref");

  // Company leagues: provider_token only exists right now. When it carries
  // read:org (the "Verify company" flow, and every later login since GitHub
  // keeps granted scopes), list the orgs and renew. Joining and creating
  // happen only from the Company tab's button. Never stored, and a failure
  // here never breaks login.
  // Runs after the redirect so the GitHub API calls never hold the login. On a
  // very first login the building doesn't exist yet (/auth/setup builds it),
  // so this skips; the next login syncs.
  const providerToken = data.session?.provider_token;
  if (providerToken && githubLogin) after(async () => {
    try {
      const orgs = await fetchUserOrgs(providerToken);
      if (orgs) {
        const { data: dev } = await getSupabaseAdmin()
          .from("developers")
          .select("id")
          .eq("github_login", githubLogin)
          .eq("claimed_by", data.user.id)
          .maybeSingle();
        if (dev) {
          await syncOrgVerifications(dev.id, orgs);
        }
      }
    } catch (err) {
      console.error("[auth:callback] org verification failed:", err);
    }
  });

  // Landing on the city: its loading screen runs the setup steps. Anywhere
  // else (?next=): the standalone /auth/setup terminal, then that page.
  const setup = new URLSearchParams();
  const next = searchParams.get("next");
  if (ref) setup.set("ref", ref);
  if (!next) {
    setup.set("setup", "1");
    return NextResponse.redirect(`${origin}/?${setup.toString()}`);
  }
  setup.set("next", next);
  return NextResponse.redirect(`${origin}/auth/setup?${setup.toString()}`);
}
