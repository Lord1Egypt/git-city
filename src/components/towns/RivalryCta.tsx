"use client";

import Link from "next/link";
import posthog from "posthog-js";
import { RIVALRY, BATTLE_START_LABEL } from "@/lib/towns/rivalry";

const [CLAUDE, CODEX] = RIVALRY;

/** The one way from the city into the rivalry before launch: sides are open, the week starts on BATTLE_START. */
export default function RivalryCta({ from }: { from: string }) {
  return (
    <Link
      href="/towns"
      onClick={() => posthog.capture("rivalry_cta_clicked", { from })}
      className="btn-press flex w-full max-w-md items-stretch whitespace-nowrap border-[3px] border-border bg-bg/85 text-[10px] backdrop-blur-sm transition-colors hover:border-border-light sm:text-xs"
    >
      <span className="flex flex-1 items-center justify-center px-2 py-2.5 text-bg" style={{ backgroundColor: CLAUDE.color }}>
        {CLAUDE.name}
      </span>
      <span className="flex items-center px-2 text-[9px] text-cream">vs</span>
      <span className="flex flex-1 items-center justify-center px-2 py-2.5 text-bg" style={{ backgroundColor: CODEX.color }}>
        {CODEX.name}
      </span>
      <span className="flex flex-col items-center justify-center px-3 text-cream">
        Pick a side &#8594;
        <span className="mt-0.5 text-[7px] normal-case text-muted">Starts {BATTLE_START_LABEL}</span>
      </span>
    </Link>
  );
}
