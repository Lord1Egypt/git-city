"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ProvisionStep, SetupEvent } from "@/lib/auth-provision";
import { createBrowserSupabase } from "@/lib/supabase";
import {
  TERMINAL_KEYFRAMES,
  TERMINAL_LIME as LIME,
  TERMINAL_TEXT_CLASS,
  TERMINAL_TEXT_STYLE,
  TerminalBackdrop,
  TerminalCursor,
} from "@/components/Terminal";

type Line = {
  id: number;
  kind: "cmd" | "remote" | "error";
  text: string;
  status?: "pending" | "done" | "fail";
  step?: ProvisionStep;
  startedAt?: number;
  warned?: boolean;
};

const STEP_LABEL: Record<Exclude<ProvisionStep, "town">, string> = {
  github: "reading your GitHub",
  building: "raising your building",
  claim: "claiming your building",
  lot: "finding you a lot in the city",
};

// A step pending this long gets one "still working" line so the screen never
// looks frozen.
const SLOW_STEP_MS = 5000;
const EXIT_HOLD_MS = 350;

const fmt = (n: number) => n.toLocaleString("en-US");

/**
 * Dev only: scripts/new-user-login.mjs opens this page with a staging session
 * in the hash (#access_token=…&refresh_token=…) to test a first login without
 * GitHub OAuth. Stripped from production builds.
 */
async function adoptDevSession() {
  if (process.env.NODE_ENV === "production") return;
  const hash = new URLSearchParams(window.location.hash.slice(1));
  const access_token = hash.get("access_token");
  const refresh_token = hash.get("refresh_token");
  if (!access_token || !refresh_token) return;
  window.history.replaceState(null, "", window.location.pathname + window.location.search);
  await createBrowserSupabase().auth.setSession({ access_token, refresh_token });
}

/**
 * Login screen between the OAuth callback and the city: builds the player's
 * building through /api/auth/provision and prints each real step as it lands.
 */
export default function SetupTerminal({ next, refLogin }: { next: string | null; refLogin: string | null }) {
  const [lines, setLines] = useState<Line[]>([]);
  const [failed, setFailed] = useState(false);
  const [entering, setEntering] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const idRef = useRef(0);

  const add = useCallback((line: Omit<Line, "id">) => {
    setLines((prev) => [...prev, { ...line, id: ++idRef.current }]);
  }, []);

  const finishStep = useCallback((step: ProvisionStep, status: "done" | "fail", text?: string) => {
    setLines((prev) =>
      prev.map((l) =>
        l.step === step && l.status === "pending" ? { ...l, status, ...(text ? { text } : {}) } : l,
      ),
    );
  }, []);

  const handle = useCallback((event: SetupEvent) => {
    switch (event.type) {
      case "session":
        add({ kind: "remote", text: `signed in as ${event.login}`, status: "done" });
        return;
      case "start":
        if (event.step === "town") return; // only shown when a town was joined
        add({ kind: "remote", text: STEP_LABEL[event.step], status: "pending", step: event.step, startedAt: Date.now() });
        return;
      case "done":
        if (event.step === "town") {
          if (event.joined) add({ kind: "remote", text: "joining your company town", status: "done" });
          return;
        }
        finishStep(
          event.step,
          "done",
          event.step === "github" && event.repos != null && event.contributions != null
            ? `${STEP_LABEL.github}: ${fmt(event.repos)} repos, ${fmt(event.contributions)} contributions`
            : undefined,
        );
        return;
      case "fail":
        if (event.step !== "town") finishStep(event.step, "fail");
        return;
      case "ready":
        setEntering(true);
        setTimeout(() => window.location.replace(event.redirect), EXIT_HOLD_MS);
        return;
    }
  }, [add, finishStep]);

  // Run the setup stream. Reruns on retry; the API is idempotent.
  useEffect(() => {
    const controller = new AbortController();
    setLines([{ id: ++idRef.current, kind: "cmd", text: "gitcity login" }]);
    setFailed(false);
    setEntering(false);

    (async () => {
      await adoptDevSession();
      const res = await fetch("/api/auth/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ next, ref: refLogin }),
        signal: controller.signal,
      });
      if (res.status === 401) {
        window.location.replace("/?error=auth_failed");
        return;
      }
      if (!res.ok || !res.body) throw new Error(`setup failed (${res.status})`);

      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      let ready = false;
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        const parts = buffer.split("\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          if (!part.trim()) continue;
          const event = JSON.parse(part) as SetupEvent;
          if (event.type === "ready") ready = true;
          handle(event);
        }
      }
      if (!ready) throw new Error("connection closed early");
    })().catch((err: unknown) => {
      if (controller.signal.aborted) return;
      console.error("[auth:setup]", err);
      setFailed(true);
    });

    return () => controller.abort();
  }, [attempt, next, refLogin, handle]);

  // One reassurance line per step that runs long.
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      const slow = lines.find((l) => l.status === "pending" && !l.warned && l.startedAt && now - l.startedAt > SLOW_STEP_MS);
      if (!slow) return;
      setLines((prev) => {
        const marked = prev.map((l) => (l.id === slow.id ? { ...l, warned: true } : l));
        const text = slow.step === "github" ? "GitHub is slow, hang tight..." : "still working...";
        return [...marked, { id: ++idRef.current, kind: "remote", text }];
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [lines]);

  return (
    <div className="fixed inset-0 z-100 bg-bg">
      <style>{TERMINAL_KEYFRAMES}</style>

      <div className="flex h-full items-center justify-center p-6">
        <div className={TERMINAL_TEXT_CLASS} style={TERMINAL_TEXT_STYLE} aria-live="polite">
          {lines.map((l) => (
            <div key={l.id} className="min-h-[1.9em] whitespace-pre-wrap break-words">
              {l.kind === "cmd" && (
                <>
                  <span style={{ color: LIME }}>$ </span>
                  <span className="text-neutral-300">{l.text}</span>
                </>
              )}
              {l.kind === "remote" && (
                <span className="text-neutral-500">
                  remote: {l.text}
                  {l.status === "pending" && "..."}
                  {l.status === "done" && <span style={{ color: LIME }}> done</span>}
                  {l.status === "fail" && <span className="text-[#e05252]"> failed</span>}
                </span>
              )}
            </div>
          ))}

          {entering && (
            <>
              <div className="min-h-[1.9em]" />
              <div className="min-h-[1.9em]">
                <span style={{ color: LIME }}>$ </span>
                <span className="text-neutral-300">entering the city </span>
                <TerminalCursor />
              </div>
            </>
          )}

          {!entering && !failed && (
            <div className="min-h-[1.9em]">
              <TerminalCursor />
            </div>
          )}

          {failed && (
            <>
              <div className="min-h-[1.9em]" />
              <div className="min-h-[1.9em] text-[#e05252]">fatal: couldn&apos;t finish signing you in</div>
              <div className="min-h-[1.9em] text-[#e05252]">hint: check your connection and try again</div>
              <button
                onClick={() => setAttempt((a) => a + 1)}
                className="btn-press mt-4 px-6 py-2 font-pixel text-xs text-bg"
                style={{ backgroundColor: LIME }}
              >
                RETRY
              </button>
            </>
          )}
        </div>
      </div>

      <TerminalBackdrop />
    </div>
  );
}
