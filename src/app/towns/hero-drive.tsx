"use client";

import Link from "next/link";
/** 🚗 Drive on the hero: straight into the town's car (touch controls on a phone). */
export default function HeroDrive({ slug }: { slug: string }) {
  return (
    <Link
      href={`/town/${slug}?drive=1`}
      className="btn-press border-[3px] border-lime bg-bg/70 px-6 py-2.5 text-sm tracking-widest text-lime"
    >
      🚗 Drive
    </Link>
  );
}
