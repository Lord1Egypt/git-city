"use client";

import dynamic from "next/dynamic";
import { useEffect, useId, useRef, useState } from "react";
import type { Copy } from "./copy";
import type { CityFocus } from "./CityBrandPreview";
import TownBrandPreview, { type PreviewTown } from "./TownBrandPreview";

// "Type your brand": the name goes live on the game's own billboard, banner plane
// and blimp in a block of the city the visitor can orbit.
const CityBrandPreview = dynamic(() => import("./CityBrandPreview"), { ssr: false });

export default function BrandPreview({
  t,
  town,
}: {
  t: Copy["formats"];
  town: PreviewTown | null;
}) {
  const [brand, setBrand] = useState("");
  const [running, setRunning] = useState(false);
  const [focus, setFocus] = useState<CityFocus>("all");
  const stageRef = useRef<HTMLDivElement>(null);
  const inputId = useId();
  const shown = (brand.trim() || t.placeholder).toUpperCase();
  const cityItems = t.items.filter((i) => i.id !== "prize");
  const options = [{ id: "all", title: t.showAll }, ...cityItems];
  const stepFocus = (dir: 1 | -1) => {
    const i = options.findIndex((o) => o.id === focus);
    setFocus(options[(i + dir + options.length) % options.length].id as CityFocus);
  };

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

      {/* Both previews stacked, the brand field sitting on the seam between them. */}
      <div className="flex flex-col">
        <div
          ref={stageRef}
          role="region"
          aria-label={`${t.cityLabel}: ${shown}`}
          className="relative aspect-[3/4] w-full overflow-hidden border-[3px] border-border bg-bg sm:aspect-[21/9]"
        >
          {running && <CityBrandPreview brand={shown} focus={focus} />}

          <div
            className="absolute top-3 left-3 hidden flex-wrap gap-2 pr-3 sm:flex"
            role="group"
            aria-label={t.showLabel}
          >
            {options.map((item) => {
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

          <div className="absolute top-3 right-3 left-3 flex items-stretch justify-center sm:hidden">
            <button
              type="button"
              onClick={() => stepFocus(-1)}
              aria-label={t.prevPlacement}
              className="border-[3px] border-border bg-bg/90 px-3 text-sm text-cream outline-none focus-visible:border-cream"
            >
              &larr;
            </button>
            <span
              aria-live="polite"
              className="flex min-w-0 flex-1 items-center justify-center border-y-[3px] border-lime bg-lime px-3 py-2 text-xs tracking-widest text-bg"
            >
              {options.find((o) => o.id === focus)?.title}
            </span>
            <button
              type="button"
              onClick={() => stepFocus(1)}
              aria-label={t.nextPlacement}
              className="border-[3px] border-border bg-bg/90 px-3 text-sm text-cream outline-none focus-visible:border-cream"
            >
              &rarr;
            </button>
          </div>
        </div>

        <div className="relative z-10 -my-[29px] flex justify-center px-4">
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
        {town && <TownBrandPreview town={town} brand={shown} t={t} />}
      </div>

      <div className="flex flex-col gap-4 border-[3px] border-border bg-bg-raised p-5 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
        <div className="flex flex-col gap-2">
          <p className="text-xs tracking-widest text-muted">{t.inboxLabel}</p>
          <p className="max-w-xl text-sm leading-relaxed text-warm normal-case">{t.inboxText}</p>
        </div>
        <p className="shrink-0 border-t-[3px] border-lime pt-3 text-sm tracking-widest text-cream sm:border-t-0 sm:border-l-[3px] sm:pt-0 sm:pl-5">
          {t.poweredBy} <span className="text-lime">{shown}</span>
        </p>
      </div>

      <p className="text-sm text-muted normal-case">{t.note}</p>
    </div>
  );
}
