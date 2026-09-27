import type { Metadata } from "next";

// Drift is reachable by URL only while a few drivers test it: kept out of search until it launches.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function DriftLayout({ children }: { children: React.ReactNode }) {
  return children;
}
