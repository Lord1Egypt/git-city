import { getSupabaseAdmin } from "../supabase";
import { recordConsent, type ConsentSource } from "../consent";
import { TOPIC_KEYS } from "./topics";

// On/off switches a player may change. "transactional" is not here: receipts
// and account mail always send.
const SWITCHES = ["email_enabled", "push_enabled", ...TOPIC_KEYS];
const DIGEST_FREQUENCIES = ["realtime", "hourly", "daily", "weekly"];

export interface PreferencesRow {
  developer_id: number;
  email_enabled: boolean;
  [key: string]: unknown;
}

/** The player's saved preferences, or null when they never changed any (defaults apply). */
export async function readPreferences(developerId: number): Promise<PreferencesRow | null> {
  const { data } = await getSupabaseAdmin()
    .from("notification_preferences")
    .select("*")
    .eq("developer_id", developerId)
    .maybeSingle();
  return (data as PreferencesRow | null) ?? null;
}

/**
 * Validates and saves a preference change from any surface (settings, the
 * no-login preference page), and logs each switch that changed to
 * consent_events. Unknown fields are ignored.
 */
export async function updatePreferences(
  developerId: number,
  input: Record<string, unknown>,
  source: ConsentSource,
): Promise<{ row?: PreferencesRow; error?: string }> {
  const update: Record<string, unknown> = {};
  for (const key of SWITCHES) {
    if (typeof input[key] === "boolean") update[key] = input[key];
  }
  if (input.digest_frequency !== undefined) {
    if (!DIGEST_FREQUENCIES.includes(input.digest_frequency as string)) return { error: "Invalid digest_frequency" };
    update.digest_frequency = input.digest_frequency;
  }
  if (Object.keys(update).length === 0) return { error: "No valid fields to update" };

  const before = await readPreferences(developerId);
  const { data, error } = await getSupabaseAdmin()
    .from("notification_preferences")
    .upsert({ developer_id: developerId, ...update, updated_at: new Date().toISOString() }, { onConflict: "developer_id" })
    .select()
    .single();
  if (error) return { error: error.message };

  for (const key of Object.keys(update)) {
    if (key === "digest_frequency" || key === "push_enabled") continue;
    if (before && before[key] === update[key]) continue;
    await recordConsent({
      developerId,
      topic: key === "email_enabled" ? "all" : key,
      action: update[key] ? "subscribed" : "unsubscribed",
      source,
    });
  }

  return { row: data as PreferencesRow };
}
