"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import TrophyIcon from "./TrophyIcon";
import Link from "next/link";
import posthog from "posthog-js";
import { BATTLE_START_LABEL } from "@/lib/towns/rivalry";

/** What the plaza gate says when clicked before launch: the rivalry's sides are already open. */
export default function TownsTeaserCard({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    // Capture first, so Esc closes the card and not explore mode behind it.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 sm:items-center" onClick={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Git City Towns"
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm border-[3px] border-lime bg-bg/95 px-6 py-7 text-center font-pixel uppercase text-warm backdrop-blur-sm"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          autoFocus
          className="btn-press absolute right-2 top-2 flex h-9 w-9 items-center justify-center text-muted transition-colors hover:text-cream"
        >
          <X size={16} strokeWidth={2.5} />
        </button>
        <TrophyIcon size={36} className="mx-auto text-lime" />
        <h2 className="mt-4 text-xl leading-tight text-cream">Git City Towns</h2>
        <p className="mt-3 text-sm text-cream normal-case">Claude Code vs Codex. Which side codes more?</p>
        <p className="mt-4 inline-block border-2 border-border px-3 py-1.5 text-xs text-lime">Starts {BATTLE_START_LABEL}</p>
        <Link
          href="/towns"
          onClick={() => posthog.capture("rivalry_cta_clicked", { from: "plaza_gate" })}
          className="btn-press mt-5 flex h-11 items-center justify-center bg-lime text-xs tracking-widest text-bg"
        >
          Pick your side
        </Link>
      </section>
    </div>
  );
}
