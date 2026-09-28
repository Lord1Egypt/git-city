import type { Metadata } from "next";
import SetupTerminal from "./setup-terminal";

export const metadata: Metadata = {
  title: "Signing in · Git City",
  robots: { index: false },
};

export default async function AuthSetupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; ref?: string }>;
}) {
  const { next, ref } = await searchParams;
  return <SetupTerminal next={next ?? null} refLogin={ref ?? null} />;
}
