"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase";

const ANSWERED_KEY = "gc-email-notice-answered";
const HIDDEN_ON = ["/email-preferences", "/unsubscribe", "/settings", "/admin", "/auth", "/trailer/"];

/**
 * One-time card telling signed-in players we email product news, with a
 * one-tap opt-out. The server remembers the answer; localStorage only saves
 * the request on later visits.
 */
export default function EmailNotice() {
  const pathname = usePathname();
  const [show, setShow] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const hidden = HIDDEN_ON.some((p) => pathname.startsWith(p)) || new URLSearchParams(window.location.search).has("capture");
    let answered = false;
    try {
      answered = localStorage.getItem(ANSWERED_KEY) === "1";
    } catch {}
    if (hidden || answered) return;

    // Only ask the server when there's a session (no network call for visitors)
    createBrowserSupabase()
      .auth.getSession()
      .then(({ data }: { data: { session: unknown } }) => (data.session ? fetch("/api/email-notice").then((r) => r.json()) : { show: false }))
      .then((res: { show?: boolean }) => {
        if (!cancelled && res.show) setShow(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  const answer = (choice: "keep" | "no") => {
    setShow(false);
    try {
      localStorage.setItem(ANSWERED_KEY, "1");
    } catch {}
    fetch("/api/email-notice", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ choice }) }).catch(() => {});
  };

  if (!show) return null;

  return (
    <div role="dialog" aria-label="Email from Git City" className="pointer-events-auto fixed inset-x-3 bottom-20 z-50 mx-auto max-w-md border-[3px] border-border bg-bg-raised p-4 font-pixel uppercase sm:bottom-6">
      <p className="text-xs text-cream">Email from Git City</p>
      <p className="mt-2 text-xs text-muted normal-case leading-relaxed">
        Besides your game alerts, we&apos;ll email you when something big launches. Change this anytime in{" "}
        <Link href="/settings" className="text-cream underline">settings</Link> or from any email.
      </p>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={() => answer("keep")} className="btn-press bg-lime px-4 py-2 text-xs text-bg cursor-pointer">
          Sounds good
        </button>
        <button type="button" onClick={() => answer("no")} className="border-[3px] border-border px-4 py-2 text-xs text-muted hover:text-cream cursor-pointer">
          No launch emails
        </button>
      </div>
    </div>
  );
}
