import type { Metadata } from "next";
import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/supabase";
import { PREFERENCES_TOKEN_SCOPE, verifyHmacToken } from "@/lib/notifications";
import { readPreferences } from "@/lib/email/preferences";
import EmailPreferencesForm from "./EmailPreferencesForm";

export const metadata: Metadata = {
  title: "Email preferences - Git City",
  robots: { index: false, follow: false },
};

// Opened from the footer of every Git City email. The signed link is the
// proof, so it works without logging in.
export default async function EmailPreferencesPage({
  searchParams,
}: {
  searchParams: Promise<{ dev?: string; token?: string }>;
}) {
  const { dev, token } = await searchParams;
  const devId = Number(dev);
  const valid = Number.isInteger(devId) && devId > 0 && !!token && verifyHmacToken(devId, PREFERENCES_TOKEN_SCOPE, token);

  if (!valid) {
    return (
      <main className="min-h-screen bg-bg font-pixel uppercase text-warm">
        <div className="mx-auto max-w-2xl px-4 py-16 text-center">
          <h1 className="text-2xl text-cream mb-4">Link expired</h1>
          <p className="text-sm text-muted normal-case mb-8">This link doesn&apos;t work anymore. Use the link at the bottom of a recent Git City email, or sign in to change your settings.</p>
          <Link href="/settings" className="inline-block border-[3px] border-lime px-6 py-3 text-xs text-lime hover:bg-lime/10">Open settings</Link>
        </div>
      </main>
    );
  }

  const [prefs, { data: developer }] = await Promise.all([
    readPreferences(devId),
    getSupabaseAdmin().from("developers").select("github_login").eq("id", devId).maybeSingle(),
  ]);

  return <EmailPreferencesForm devId={devId} token={token!} login={developer?.github_login ?? null} initial={prefs ?? {}} />;
}
