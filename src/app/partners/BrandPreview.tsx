"use client";

import dynamic from "next/dynamic";
import { useEffect, useId, useRef, useState } from "react";
import type { Copy } from "./copy";

// "Type your brand": the name goes live on the game's own billboard, banner plane
// and blimp in a block of the city the visitor can orbit.
const CityBrandPreview = dynamic(() => import("./CityBrandPreview"), { ssr: false });

export default function BrandPreview({ t }: { t: Copy["formats"] }) {
  const [brand, setBrand] = useState("");
  const [running, setRunning] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const inputId = useId();
  const shown = (brand.trim() || t.placeholder).toUpperCase();
  const cityItems = t.items.filter((i) => i.id !== "prize");

  // Mount the 3D scene only while it is on screen.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setRunning(entry.isIntersecting), {
      threshold: 0.1,
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex max-w-xl flex-col gap-3">
        <label htmlFor={inputId} className="text-xs tracking-widest text-warm">
          {t.inputLabel}
        </label>
        <input
          id={inputId}
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          maxLength={18}
          placeholder={t.placeholder}
          autoComplete="off"
          spellCheck={false}
          data-bwignore="true"
          data-1p-ignore="true"
          data-lpignore="true"
          data-form-type="other"
          className="w-full border-[3px] border-border bg-bg-raised px-4 py-3 text-lg tracking-widest text-cream uppercase outline-none transition-colors placeholder:text-dim focus-visible:border-lime sm:text-xl"
        />
      </div>

      <div
        ref={stageRef}
        role="img"
        aria-label={`${t.cityLabel}: ${shown}`}
        className="relative aspect-video w-full overflow-hidden border-[3px] border-border bg-bg"
      >
        {running && <CityBrandPreview brand={shown} />}
        <span className="pointer-events-none absolute top-3 left-3 bg-bg/80 px-3 py-1.5 text-xs tracking-widest text-cream">
          {t.cityLabel}
        </span>
        <span className="pointer-events-none absolute right-3 bottom-3 bg-bg/80 px-3 py-1.5 font-sans text-xs text-muted normal-case tracking-normal">
          {t.hint}
        </span>
      </div>

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cityItems.map((item) => (
          <li key={item.id} className="flex flex-col gap-2 border-t-[3px] border-lime pt-4">
            <h3 className="text-base text-lime sm:text-lg">{item.title}</h3>
            <p className="font-sans text-base text-warm normal-case tracking-normal">{item.text}</p>
          </li>
        ))}
      </ul>
      <p className="font-sans text-sm text-muted normal-case tracking-normal">{t.note}</p>
    </div>
  );
}
