"use client";

import dynamic from "next/dynamic";

// The preview and the town scene in one client bundle (see brasil-preview.tsx).
const BrasilPreview = dynamic(() => import("./brasil-preview"), { ssr: false, loading: () => null });

export default function BrasilPreviewLoader() {
  return <BrasilPreview />;
}
