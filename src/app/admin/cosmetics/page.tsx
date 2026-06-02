"use client";

import dynamic from "next/dynamic";

const CosmeticsGallery = dynamic(() => import("@/components/CosmeticsGallery"), {
  ssr: false,
});

export default function AdminCosmeticsPage() {
  return <CosmeticsGallery />;
}
