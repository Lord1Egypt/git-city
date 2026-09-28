import { getSupabaseAdmin } from "./supabase";

export type ConsentAction = "subscribed" | "unsubscribed" | "notice_shown" | "confirmed";
export type ConsentSource =
  | "one_click"
  | "preference_page"
  | "settings"
  | "notice"
  | "signup"
  | "complaint"
  | "bounce"
  | "sunset"
  | "admin";

/**
 * Appends to consent_events, the record of why someone does or doesn't get an
 * email (GDPR/LGPD proof and support answers). Never throws: a failed log
 * must not undo the preference change the caller already made.
 */
export async function recordConsent(event: {
  developerId: number;
  topic: string;
  action: ConsentAction;
  source: ConsentSource;
  campaignId?: number | null;
}): Promise<void> {
  const { error } = await getSupabaseAdmin().from("consent_events").insert({
    developer_id: event.developerId,
    topic: event.topic,
    action: event.action,
    source: event.source,
    campaign_id: event.campaignId ?? null,
  });
  if (error) console.error("[consent] failed to record", event, error);
}
