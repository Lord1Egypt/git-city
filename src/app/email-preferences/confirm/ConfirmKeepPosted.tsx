"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function ConfirmKeepPosted({ dev, token, campaign }: { dev: string; token: string; campaign: string }) {
  const [state, setState] = useState<"working" | "done" | "error">("working");

  useEffect(() => {
    fetch("/api/email-preferences/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dev, token, campaign }),
    })
      .then((r) => setState(r.ok ? "done" : "error"))
      .catch(() => setState("error"));
  }, [dev, token, campaign]);

  return (
    <main className="min-h-screen bg-bg font-pixel uppercase text-warm">
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        {state === "working" && <p className="text-sm text-muted normal-case">One second...</p>}
        {state === "done" && (
          <>
            <h1 className="text-2xl text-cream mb-4">You&apos;re in</h1>
            <p className="text-sm text-muted normal-case mb-8">We&apos;ll keep emailing you about big Git City launches. You can change this from any email.</p>
            <Link href="/towns?utm_source=email&utm_medium=email&utm_campaign=towns_launch" className="inline-block bg-lime px-6 py-3 text-xs text-bg">Pick your side</Link>
          </>
        )}
        {state === "error" && (
          <>
            <h1 className="text-2xl text-cream mb-4">Link expired</h1>
            <p className="text-sm text-muted normal-case mb-8">This link doesn&apos;t work anymore. You can still change your email settings after signing in.</p>
            <Link href="/settings" className="inline-block border-[3px] border-lime px-6 py-3 text-xs text-lime">Open settings</Link>
          </>
        )}
      </div>
    </main>
  );
}
