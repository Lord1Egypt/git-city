"use client";

import type { LoginSetup } from "@/lib/use-login-setup";
import { TERMINAL_LIME as LIME } from "@/components/Terminal";

/**
 * The `$ gitcity login` block of the terminal: one line per real setup step,
 * then an error + RETRY if the stream broke. Sits inside a terminal's text box.
 */
export default function LoginSetupLines({ setup }: { setup: LoginSetup }) {
  return (
    <>
      <div className="min-h-[1.9em]">
        <span style={{ color: LIME }}>$ </span>
        <span className="text-neutral-300">gitcity login</span>
      </div>
      {setup.lines.map((l) => (
        <div key={l.id} className="min-h-[1.9em] whitespace-pre-wrap break-words text-neutral-500">
          remote: {l.text}
          {l.status === "pending" && "..."}
          {l.status === "pending" && l.warned && (l.step === "github" ? " GitHub is slow, hang tight" : " still working")}
          {l.status === "done" && <span style={{ color: LIME }}> done</span>}
          {l.status === "fail" && <span className="text-[#e05252]"> failed</span>}
        </div>
      ))}
      {setup.status === "failed" && (
        <>
          <div className="min-h-[1.9em]" />
          <div className="min-h-[1.9em] text-[#e05252]">fatal: couldn&apos;t finish signing you in</div>
          <div className="min-h-[1.9em] text-[#e05252]">hint: check your connection and try again</div>
          <button
            onClick={setup.retry}
            className="btn-press mt-4 px-6 py-2 font-pixel text-xs text-bg"
            style={{ backgroundColor: LIME }}
          >
            RETRY
          </button>
        </>
      )}
    </>
  );
}
