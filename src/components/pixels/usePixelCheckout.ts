"use client";

import { useCallback, useState } from "react";

export interface PixelPackage {
  id: string;
  name: string;
  pixels: number;
  bonus_pixels: number;
  price_usd_cents: number;
  price_brl_cents: number | null;
  sort_order: number;
}

/**
 * Pixel purchases with GITC (on-chain quote, then confirm). Used by the
 * /pixels store, the in-city Bank panel and the avatar editor. Holds the
 * transient error state; rendering is left to the caller.
 */
export function usePixelCheckout() {
  const [error, setError] = useState<string | null>(null);

  /**
   * Build the GitcPayButton callbacks for a package. `redirectUrl` is where the
   * button navigates after success — the /pixels store uses a success-banner
   * URL; the in-city panel passes its own `onConfirmed` and an `onDone` (no
   * redirect) so the player never leaves the city.
   */
  const buildGitcCallbacks = useCallback(
    (
      pkg: PixelPackage,
      opts: { redirectUrl: string; onConfirmed?: () => void },
    ) => ({
      onRequestQuote: async (wallet: `0x${string}`) => {
        const res = await fetch("/api/pixels/checkout/gitc-quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ package_id: pkg.id, wallet }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Could not get a quote");
        return {
          quoteId: data.quoteId,
          gitcAmountWei: data.gitcAmountWei,
          usdAmountCents: data.usdQuoteCents,
          redirectUrl: opts.redirectUrl,
        };
      },
      onConfirm: async ({ quoteId, txHash }: { quoteId: string; txHash: `0x${string}` }) => {
        const res = await fetch("/api/pixels/checkout/gitc-confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quoteId, txHash }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          setError(null);
          opts.onConfirmed?.();
        }
        return { ok: res.ok, error: data.error };
      },
    }),
    [],
  );

  return { error, setError, buildGitcCallbacks };
}
