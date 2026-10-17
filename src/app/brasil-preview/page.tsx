import type { Metadata } from "next";
import { notFound } from "next/navigation";
import BrasilPreviewLoader from "./loader";

export const metadata: Metadata = { title: "Brasil town preview - Git City", robots: { index: false, follow: false } };

// The Brasil town's map with made-up devs, to try the board before it holds real ones. Local only.
export default function BrasilPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <BrasilPreviewLoader />;
}
