"use client";

import dynamic from "next/dynamic";
import { useEffect, useId, useRef, useState } from "react";
import type { Copy } from "./copy";
import type { CityFocus } from "./CityBrandPreview";

// "Type your brand": the name goes live on the game's own billboard, banner plane
// and blimp in a block of the city the visitor can orbit.
const CityBrandPreview = dynamic(() => import("./CityBrandPreview"), { ssr: false });

export default function BrandPreview({ t }: { t: Copy["formats"] }) {
  const [brand, setBrand] = useState("");
  const [running, setRunning] = useState(false);
  const [focus, setFocus] = useState<CityFocus>("all");
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
      <div className="flex flex-col gap-4">
        <p className="text-xs tracking-widest text-muted sm:text-sm">{t.kicker}</p>
        <h2 className="text-3xl leading-tight text-cream sm:text-4xl">{t.title}</h2>
      </div>

      <div
        ref={stageRef}
        role="region"
        aria-label={`${t.cityLabel}: ${shown}`}
        className="relative aspect-square w-full overflow-hidden border-[3px] border-border bg-bg sm:aspect-[21/9]"
      >
        {running && <CityBrandPreview brand={shown} focus={focus} />}

        <div
          className="absolute top-3 right-3 left-3 flex gap-2 overflow-x-auto [scrollbar-width:none]"
          role="group"
          aria-label={t.showLabel}
        >
          {[{ id: "all", title: t.showAll }, ...cityItems].map((item) => {
            const on = focus === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={on}
                onClick={() => setFocus(item.id as CityFocus)}
                className={`btn-press shrink-0 border-[3px] px-3 py-1.5 text-xs tracking-widest transition-colors outline-none focus-visible:border-cream ${
                  on
                    ? "border-lime bg-lime text-bg"
                    : "border-border bg-bg/80 text-cream hover:border-lime"
                }`}
              >
                {item.title}
              </button>
            );
          })}
        </div>

        <div className="absolute right-3 bottom-3 left-3 flex justify-center">
          <label htmlFor={inputId} className="sr-only">
            {t.inputLabel}
          </label>
          <input
            id={inputId}
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            maxLength={18}
            placeholder={t.inputLabel}
            autoComplete="off"
            spellCheck={false}
            data-bwignore="true"
            data-1p-ignore="true"
            data-lpignore="true"
            data-form-type="other"
            className="w-full max-w-md border-[3px] border-lime bg-bg px-5 py-3 text-center text-lg tracking-widest text-cream uppercase outline-none placeholder:text-muted focus-visible:ring-[3px] focus-visible:ring-lime/40 sm:text-xl"
          />
        </div>
      </div>

      <p className="font-sans text-sm text-muted normal-case tracking-normal">{t.note}</p>
    </div>
  );
}
