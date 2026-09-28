"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { GitcPayButton } from "@/components/GitcPayButton";
import { usePixelCheckout, type PixelPackage } from "@/components/pixels/usePixelCheckout";
import { isGitcEnabled } from "@/lib/gitc";

interface Props {
  packages: PixelPackage[];
  balance: number;
  isAuthenticated: boolean;
  githubLogin: string;
}

const BADGES: Record<string, { label: string; color: string }> = {
  popular: { label: "Most Popular", color: "#c8e64a" },
  mega: { label: "Best Value", color: "#f7931a" },
};

// ─── Main Store Client ───────────────────────────────────────
export default function PixelsStoreClient({
  packages,
  balance,
  isAuthenticated,
}: Props) {
  const [successPkg, setSuccessPkg] = useState<string | null>(null);
  const [, setCurrentBalance] = useState(balance);
  const [checkoutPkgId, setCheckoutPkgId] = useState<string | null>(null);
  const router = useRouter();

  /** Refresh the server-rendered balance + re-fetch any in-flight purchase state. */
  const refreshBalance = useCallback(() => {
    fetch("/api/pixels/balance")
      .then((r) => r.json())
      .then((d) => setCurrentBalance(d.balance ?? 0))
      .catch(() => {});
    router.refresh();
  }, [router]);

  const { error, setError, buildGitcCallbacks } = usePixelCheckout();

  // Check for the success redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const purchased = params.get("pixels_purchased");
    if (purchased) {
      setSuccessPkg(purchased);
      window.history.replaceState({}, "", "/pixels");
      fetch("/api/pixels/balance")
        .then((r) => r.json())
        .then((d) => setCurrentBalance(d.balance ?? 0))
        .catch(() => {});
    }
  }, []);

  const gitcEnabled = isGitcEnabled();
  const highlightId = "popular";
  const checkoutPkg = checkoutPkgId ? packages.find((p) => p.id === checkoutPkgId) : null;

  if (!gitcEnabled && !successPkg) return null;

  return (
    <div>
      {/* Success banner (post-GITC redirect) */}
      {successPkg && (
        <div className="mb-6 border-[3px] border-lime/40 bg-lime/10 p-4 text-center">
          <p className="text-base text-lime font-bold mb-1">Purchase confirmed!</p>
          <p className="text-sm text-muted normal-case">
            Your Pixels have been added to your balance.
          </p>
        </div>
      )}

      {error && (
        <div className="mb-4 border-2 border-red-500/40 bg-red-500/10 p-3 text-center">
          <p className="text-sm text-red-400 normal-case">{error}</p>
        </div>
      )}

      {/* Package grid — 1 col mobile, 2 col desktop */}
      <h2 className="text-xl text-cream mb-2 text-center">Trade GITC for Pixels</h2>
      <p className="text-sm text-muted normal-case text-center mb-6">
        Optional, for players who hold the GITC token. The GITC you pay is burned.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {packages.map((pkg) => {
          const total = pkg.pixels + pkg.bonus_pixels;
          const isHighlight = pkg.id === highlightId;
          const badge = BADGES[pkg.id];
          const bonusPercent =
            pkg.bonus_pixels > 0
              ? Math.round((pkg.bonus_pixels / pkg.pixels) * 100)
              : 0;

          return (
            <div
              key={pkg.id}
              className={[
                "relative border-[3px] p-6 sm:p-8 transition-all",
                isHighlight
                  ? "border-lime bg-lime/5"
                  : "border-border bg-bg-raised hover:border-border-light",
              ].join(" ")}
            >
              {/* Badge */}
              {badge && (
                <div
                  className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 text-xs font-bold text-bg whitespace-nowrap"
                  style={{ backgroundColor: badge.color }}
                >
                  {badge.label}
                </div>
              )}

              {/* Top row: name + price */}
              <div className="flex items-center justify-between mb-6 mt-1">
                <p className="text-base text-muted">{pkg.name}</p>
                <p className="text-base text-cream font-bold">
                  ${(pkg.price_usd_cents / 100).toFixed(2)}
                  <span className="text-xs text-muted font-normal"> in GITC</span>
                </p>
              </div>

              {/* Center: big PX number */}
              <div className="text-center mb-6">
                <p className="text-5xl sm:text-6xl text-cream font-bold leading-none">
                  {total.toLocaleString()}
                </p>
                <p className="text-lg text-lime/60 mt-2">PX</p>
              </div>

              {/* Bonus (or empty space to keep alignment) */}
              <div className="text-center mb-6 min-h-[30px] flex items-center justify-center">
                {pkg.bonus_pixels > 0 && (
                  <span
                    className="inline-block px-4 py-1.5 text-sm font-bold text-bg"
                    style={{ backgroundColor: "#39d353" }}
                  >
                    +{pkg.bonus_pixels} BONUS ({bonusPercent}%)
                  </span>
                )}
              </div>

              {/* Buy button — opens checkout modal */}
              <button
                onClick={() => {
                  setError(null);
                  setCheckoutPkgId(pkg.id);
                }}
                disabled={!isAuthenticated}
                className="btn-press w-full py-3.5 text-sm font-bold text-bg disabled:opacity-40 transition-all cursor-pointer"
                style={{
                  backgroundColor: "#c8e64a",
                  boxShadow: "2px 2px 0 0 #5a7a00",
                }}
              >
                Buy with GITC
              </button>
            </div>
          );
        })}
      </div>

      {/* ── Checkout Modal ── */}
      {checkoutPkg && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setCheckoutPkgId(null);
              // Defensive: if the user closes the modal mid-verification,
              // refresh in case the backend completed the credit anyway.
              refreshBalance();
            }
          }}
        >
          <div className="w-full max-w-sm border-[3px] border-border bg-bg p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-base text-cream sm:text-lg">
                {checkoutPkg.name}{" "}
                <span className="text-sm text-muted">
                  · {(checkoutPkg.pixels + checkoutPkg.bonus_pixels).toLocaleString()} PX
                </span>
              </h3>
              <button
                onClick={() => {
                  setCheckoutPkgId(null);
                  refreshBalance();
                }}
                className="text-sm text-muted transition-colors hover:text-cream cursor-pointer"
              >
                &times;
              </button>
            </div>

            <p className="mt-2 text-[10px] text-dim normal-case">
              ${(checkoutPkg.price_usd_cents / 100).toFixed(2)} in GITC, sent on Base
            </p>

            {error && (
              <div className="mt-3 border-2 border-red-500/40 bg-red-500/10 p-2 text-center">
                <p className="text-[10px] text-red-400 normal-case">{error}</p>
              </div>
            )}

            <div className="mt-4">
              <GitcPayButton
                onError={(msg) => setError(msg)}
                {...buildGitcCallbacks(checkoutPkg, {
                  redirectUrl: `/pixels?pixels_purchased=${encodeURIComponent(checkoutPkg.id)}`,
                  onConfirmed: () => {
                    setSuccessPkg(checkoutPkg.id);
                    setCheckoutPkgId(null);
                    refreshBalance();
                  },
                })}
              />
            </div>

            <p className="mt-3 text-center text-[9px] text-muted normal-case">
              The GITC you pay is burned. Burns can&apos;t be refunded.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
