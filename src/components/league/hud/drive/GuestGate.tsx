"use client";

import { useEffect } from "react";
import posthog from "posthog-js";
import ArrivalChoice from "./ArrivalChoice";
import type { GateReason } from "@/lib/league-city/drive/guest-gate";

// A guest gets pulled over (lib drive/guest-gate): the car stops on the same
// choice as the town's arrival, sign in with GitHub or drive on as a guest.

const COPY: Record<GateReason, { eyebrow: (town: string) => string; title: string; driveLabel: string }> = {
  start: { eyebrow: (town) => `Welcome to ${town}`, title: "Drive as yourself", driveLabel: "Drive as guest" },
  time: { eyebrow: () => "Driving as a guest", title: "Sign in so it counts", driveLabel: "Keep driving as guest" },
  crown: { eyebrow: () => "You won the crown rush", title: "Sign in to keep the win", driveLabel: "Keep driving as guest" },
};

export default function GuestGate({
  reason,
  town,
  onSignIn,
  onContinue,
}: {
  reason: GateReason;
  /** The town's display name. */
  town: string;
  onSignIn: () => void;
  onContinue: () => void;
}) {
  const copy = COPY[reason];
  useEffect(() => {
    posthog.capture("guest_gate_shown", { reason, town });
  }, [reason, town]);
  return (
    <div className="pointer-events-none fixed inset-0 z-40 font-pixel uppercase">
      <ArrivalChoice
        eyebrow={copy.eyebrow(town)}
        title={copy.title}
        label="Sign in with GitHub"
        detail="Your name over your car, and every floor you smash counts for the weekly prize."
        busyLabel="Opening GitHub..."
        driveLabel={copy.driveLabel}
        driveDetail="Buildings won't fall and wins won't count."
        onJoin={() => {
          posthog.capture("signin_clicked", { where: `gate_${reason}`, town });
          onSignIn();
        }}
        onDrive={() => {
          posthog.capture("guest_gate_dismissed", { reason, town });
          onContinue();
        }}
      />
    </div>
  );
}
