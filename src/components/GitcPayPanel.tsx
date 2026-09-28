"use client";

import { Web3Provider } from "@/components/Web3Provider";
import { GitcPayButton } from "@/components/GitcPayButton";
import CurrencyIcon from "@/components/CurrencyIcon";
import { GITC_ADDRESS } from "@/lib/gitc";
import { type PixelPackage, type usePixelCheckout } from "@/components/pixels/usePixelCheckout";

interface Props {
  pkg: PixelPackage;
  buildGitcCallbacks: ReturnType<typeof usePixelCheckout>["buildGitcCallbacks"];
  onConfirmed: () => void;
  onError: (msg: string) => void;
  /** Jump to the Exchange screen to acquire GITC first. */
  onNeedGitc: () => void;
}

/**
 * "Pay with GITC" on the Add Pixels screen. Mounts its own (lazy-loaded)
 * Web3Provider so the wallet bundle only loads once a player picks a pack.
 */
export default function GitcPayPanel({ pkg, buildGitcCallbacks, onConfirmed, onError, onNeedGitc }: Props) {
  return (
    <Web3Provider>
      <GitcPayButton
        onError={onError}
        onDone={onConfirmed}
        {...buildGitcCallbacks(pkg, { redirectUrl: "/", onConfirmed })}
      />
      <div className="mt-2 flex items-center justify-between text-[9px] text-dim">
        <span className="flex items-center gap-1">
          <CurrencyIcon currency="gitc" size={10} /> GITC on Base · {GITC_ADDRESS.slice(0, 6)}…{GITC_ADDRESS.slice(-4)}
        </span>
        <button type="button" onClick={onNeedGitc} className="text-muted underline normal-case hover:text-cream cursor-pointer">
          Need GITC? Exchange →
        </button>
      </div>
    </Web3Provider>
  );
}
