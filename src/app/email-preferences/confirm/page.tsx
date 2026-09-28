import type { Metadata } from "next";
import ConfirmKeepPosted from "./ConfirmKeepPosted";

export const metadata: Metadata = {
  title: "Keep me posted - Git City",
  robots: { index: false, follow: false },
};

// "Yes, keep me posted" from the permission email. The confirmation is a
// POST fired by script on load: link scanners open the URL but don't run
// scripts, so they can't give consent on the player's behalf.
export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ dev?: string; token?: string; campaign?: string }>;
}) {
  const { dev = "", token = "", campaign = "" } = await searchParams;
  return <ConfirmKeepPosted dev={dev} token={token} campaign={campaign} />;
}
