"use client";

import { useState } from "react";
import Link from "next/link";
import { Toggle, TopicToggles } from "@/components/email/TopicToggles";
import { SHOW_TOWNS } from "@/lib/towns/visibility";

type Status = "idle" | "saving" | "saved" | "error";

export default function EmailPreferencesForm({ devId, token, login, initial }: {
  devId: number;
  token: string;
  login: string | null;
  initial: Record<string, unknown>;
}) {
  const [values, setValues] = useState<Record<string, unknown>>(initial);
  const [status, setStatus] = useState<Status>("idle");
  const emailOff = values.email_enabled === false;

  async function save(update: Record<string, boolean>) {
    const previous = values;
    setValues({ ...values, ...update });
    setStatus("saving");
    const res = await fetch("/api/email-preferences", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dev: devId, token, update }),
    }).catch(() => null);
    if (res?.ok) {
      setStatus("saved");
    } else {
      setValues(previous);
      setStatus("error");
    }
  }

  return (
    <main className="min-h-screen bg-bg font-pixel uppercase text-warm">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
        <div className="flex items-center justify-between mb-8">
          <Link href="/" className="text-sm text-muted transition-colors hover:text-cream">&lt; Git City</Link>
          <span className="text-xs normal-case" aria-live="polite">
            {status === "saving" && <span className="text-muted animate-pulse">Saving...</span>}
            {status === "saved" && <span className="text-lime">Saved</span>}
            {status === "error" && <span className="text-red-400">Couldn&apos;t save. Try again.</span>}
          </span>
        </div>

        <h1 className="text-2xl text-cream mb-2">Email preferences</h1>
        <p className="text-sm text-muted normal-case mb-8">
          {login ? <>For <span className="text-cream">@{login}</span>. </> : null}Pick the emails you want. Receipts and sign-in emails always arrive.
        </p>

        <TopicToggles
          values={values}
          onChange={(key, value) => save({ [key]: value })}
          disabled={emailOff}
          hidden={SHOW_TOWNS ? [] : ["leagues"]}
        />

        <div className="border-[3px] border-border bg-bg-raised p-6 sm:p-8">
          <Toggle
            checked={!emailOff}
            onChange={(v) => save({ email_enabled: v })}
            label="All non-essential email"
            sublabel={emailOff ? "Off. You'll only get receipts and sign-in emails." : "Turn off to stop every email above at once"}
          />
        </div>
      </div>
    </main>
  );
}
