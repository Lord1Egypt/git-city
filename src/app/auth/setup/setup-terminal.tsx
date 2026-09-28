"use client";

import { useEffect } from "react";
import { useLoginSetup } from "@/lib/use-login-setup";
import LoginSetupLines from "@/components/LoginSetupLines";
import {
  TERMINAL_KEYFRAMES,
  TERMINAL_LIME as LIME,
  TERMINAL_TEXT_CLASS,
  TERMINAL_TEXT_STYLE,
  TerminalBackdrop,
  TerminalCursor,
} from "@/components/Terminal";

const EXIT_HOLD_MS = 350;

/**
 * Login screen for sign-ins that land somewhere other than the city (?next=).
 * Logins that land on the city run the same steps inside its loading screen.
 */
export default function SetupTerminal({ next, refLogin }: { next: string | null; refLogin: string | null }) {
  const setup = useLoginSetup(true, next, refLogin);
  const { status, redirect } = setup;

  useEffect(() => {
    if (status !== "ready" || !redirect) return;
    const t = setTimeout(() => window.location.replace(redirect), EXIT_HOLD_MS);
    return () => clearTimeout(t);
  }, [status, redirect]);

  return (
    <div className="fixed inset-0 z-100 bg-bg">
      <style>{TERMINAL_KEYFRAMES}</style>

      <div className="flex h-full items-center justify-center p-6">
        <div className={TERMINAL_TEXT_CLASS} style={TERMINAL_TEXT_STYLE} aria-live="polite">
          <LoginSetupLines setup={setup} />

          {status === "ready" && (
            <>
              <div className="min-h-[1.9em]" />
              <div className="min-h-[1.9em]">
                <span style={{ color: LIME }}>$ </span>
                <span className="text-neutral-300">opening {redirect} </span>
                <TerminalCursor />
              </div>
            </>
          )}

          {(status === "running" || status === "idle") && (
            <div className="min-h-[1.9em]">
              <TerminalCursor />
            </div>
          )}
        </div>
      </div>

      <TerminalBackdrop />
    </div>
  );
}
