import { createServerSupabase } from "@/lib/supabase-server";
import { provisionDeveloperOnLogin, type SetupEvent } from "@/lib/auth-provision";
import { githubLoginFromIdentity } from "@/lib/auth-identity";
import { postLoginPath } from "@/lib/post-login";

// GitHub API calls for a first login can take a while.
export const maxDuration = 60;

/**
 * Builds the signed-in player's building and streams each step as NDJSON, so
 * /auth/setup can show real progress instead of a frozen page. Idempotent: a
 * returning player (or a reload) only re-checks the lot.
 */
export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  const githubLogin = user ? githubLoginFromIdentity(user) : "";
  if (!user || !githubLogin) {
    return Response.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { next?: unknown; ref?: unknown };
  const next = typeof body.next === "string" ? body.next : null;
  const ref = typeof body.ref === "string" && body.ref ? body.ref : null;

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: SetupEvent) => controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      send({ type: "session", login: githubLogin });
      try {
        await provisionDeveloperOnLogin(githubLogin, user.id, ref, send);
      } catch (err) {
        console.error("[auth:provision] failed:", err);
      }
      send({ type: "ready", redirect: await postLoginPath(next, githubLogin) });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" },
  });
}
