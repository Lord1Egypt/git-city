import { PostHog } from "posthog-node";

export function getPostHogClient(): PostHog {
  return new PostHog(process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN!, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    flushAt: 1,
    flushInterval: 0,
  });
}

/** One server-side event. Never throws: analytics must not break the request. */
export async function captureServer(
  distinctId: string,
  event: string,
  properties: Record<string, unknown>,
): Promise<void> {
  try {
    const ph = getPostHogClient();
    ph.capture({ distinctId, event, properties });
    await ph.shutdown();
  } catch (err) {
    console.error("[posthog] capture failed", event, err);
  }
}
