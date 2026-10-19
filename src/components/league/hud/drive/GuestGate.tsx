"use client";

import { useEffect } from "react";
import posthog from "posthog-js";
import ArrivalChoice from "./ArrivalChoice";
import type { GateReason } from "@/lib/league-city/drive/guest-gate";

// A guest gets pulled over (lib drive/guest-gate): the car stops on the same
// choice as the town's arrival, sign in with GitHub or drive on as a guest.
// Also right after the guest's free building fell (taste).

const DETAIL = "Your name over your car, and every floor you smash counts for the weekly prize.";
const DRIVE_DETAIL = "Buildings won't fall and wins won't count.";

const COPY: Record<GateReason, { eyebrow: (town: string, login: string) => string; title: string; detail: string; driveLabel: string; driveDetail: string }> = {
  start: { eyebrow: (town) => `Welcome to ${town}`, title: "Drive as yourself", detail: DETAIL, driveLabel: "Drive as guest", driveDetail: DRIVE_DETAIL },
  time: { eyebrow: () => "Driving as a guest", title: "Sign in so it counts", detail: DETAIL, driveLabel: "Keep driving as guest", driveDetail: DRIVE_DETAIL },
  crown: { eyebrow: () => "You won the crown rush", title: "Sign in to keep the win", detail: DETAIL, driveLabel: "Keep driving as guest", driveDetail: DRIVE_DETAIL },
  // The free building fell on your screen only: sign in and knock it down for real.
  taste: {
    eyebrow: (_town, login) => `@${login}'s building is down`,
    title: "Plant your flag here",
    detail: "Sign in and knock it down for real. Your flag goes on the rubble and the floors count.",
    driveLabel: "Later",
    driveDetail: "Only you saw it fall. The rest stay standing.",
  },
};

export default function GuestGate({
  reason,
  town,
  login = "",
  onSignIn,
  onContinue,
}: {
  reason: GateReason;
  /** The town's display name. */
  town: string;
  /** taste: whose building fell. */
  login?: string;
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
        eyebrow={copy.eyebrow(town, login)}
        title={copy.title}
        label="Sign in with GitHub"
        detail={copy.detail}
        busyLabel="Opening GitHub..."
        driveLabel={copy.driveLabel}
        driveDetail={copy.driveDetail}
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
