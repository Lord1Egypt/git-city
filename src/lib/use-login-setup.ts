"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ProvisionStep, SetupEvent } from "@/lib/auth-provision";
import { createBrowserSupabase } from "@/lib/supabase";

export type SetupLine = {
  id: number;
  text: string;
  status?: "pending" | "done" | "fail";
  step?: ProvisionStep;
  startedAt?: number;
  warned?: boolean;
};

export type LoginSetup = {
  lines: SetupLine[];
  status: "idle" | "running" | "ready" | "failed";
  /** Where the player should land (from the API). */
  redirect: string | null;
  retry: () => void;
};

const STEP_LABEL: Record<Exclude<ProvisionStep, "town">, string> = {
  github: "reading your GitHub",
  building: "raising your building",
  claim: "claiming your building",
  lot: "finding you a lot in the city",
};

// A step pending this long says so, so the screen never looks frozen.
const SLOW_STEP_MS = 5000;

const fmt = (n: number) => n.toLocaleString("en-US");

/**
 * Dev only: scripts/new-user-login.mjs opens /?setup=1 with a staging
 * session in the hash (#access_token=…&refresh_token=…) to test a first login
 * without GitHub OAuth. Stripped from production builds.
 */
let devSession: Promise<void> | null = null;
function adoptDevSession(): Promise<void> {
  // Memoized: React dev runs effects twice, and the second run must wait for
  // the session the first one is setting (the hash is gone by then).
  devSession ??= readDevSession();
  return devSession;
}

async function readDevSession() {
  if (process.env.NODE_ENV === "production") return;
  const hash = new URLSearchParams(window.location.hash.slice(1));
  const access_token = hash.get("access_token");
  const refresh_token = hash.get("refresh_token");
  if (!access_token || !refresh_token) return;
  window.history.replaceState(null, "", window.location.pathname + window.location.search);
  await createBrowserSupabase().auth.setSession({ access_token, refresh_token });
}

/**
 * Builds the signed-in player's building through /api/auth/provision and
 * turns each streamed step into a terminal line. Used by the city loading
 * screen (login landing on home) and by /auth/setup (login landing elsewhere).
 */
export function useLoginSetup(enabled: boolean, next: string | null, ref: string | null): LoginSetup {
  const [lines, setLines] = useState<SetupLine[]>([]);
  const [status, setStatus] = useState<LoginSetup["status"]>("idle");
  const [redirect, setRedirect] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const idRef = useRef(0);

  const add = useCallback((line: Omit<SetupLine, "id">) => {
    setLines((prev) => [...prev, { ...line, id: ++idRef.current }]);
  }, []);

  const finishStep = useCallback((step: ProvisionStep, lineStatus: "done" | "fail", text?: string) => {
    setLines((prev) =>
      prev.map((l) =>
        l.step === step && l.status === "pending" ? { ...l, status: lineStatus, ...(text ? { text } : {}) } : l,
      ),
    );
  }, []);

  const handle = useCallback((event: SetupEvent) => {
    switch (event.type) {
      case "session":
        add({ text: `signed in as ${event.login}`, status: "done" });
        return;
      case "start":
        if (event.step === "town") return; // only shown when a town was joined
        add({ text: STEP_LABEL[event.step], status: "pending", step: event.step, startedAt: Date.now() });
        return;
      case "done":
        if (event.step === "town") {
          if (event.joined) add({ text: "joining your company town", status: "done" });
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
        setRedirect(event.redirect);
        setStatus("ready");
        return;
    }
  }, [add, finishStep]);

  // Run the stream. Reruns on retry; the API is idempotent.
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    setLines([]);
    setRedirect(null);
    setStatus("running");

    (async () => {
      await adoptDevSession();
      const res = await fetch("/api/auth/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ next, ref }),
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
      setStatus("failed");
    });

    return () => controller.abort();
  }, [enabled, attempt, next, ref, handle]);

  // A step that runs long gets flagged (the line then says to hang tight).
  useEffect(() => {
    if (status !== "running") return;
    const timer = setInterval(() => {
      const now = Date.now();
      setLines((prev) => {
        if (!prev.some((l) => l.status === "pending" && !l.warned && l.startedAt && now - l.startedAt > SLOW_STEP_MS)) {
          return prev;
        }
        return prev.map((l) =>
          l.status === "pending" && l.startedAt && now - l.startedAt > SLOW_STEP_MS ? { ...l, warned: true } : l,
        );
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [status]);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);

  return { lines, status, redirect, retry };
}
