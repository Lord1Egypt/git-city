"use client";

import { useState } from "react";
import Image from "next/image";
import { SOCIAL_SLIDES, type Copy } from "./copy";

// Viral posts about Git City: GitHub first, then creators. No autoplay.
export default function GithubCarousel({ t }: { t: Copy["social"] }) {
  const [index, setIndex] = useState(0);
  const count = SOCIAL_SLIDES.length;
  const slide = SOCIAL_SLIDES[index];
  const text: { source: string; big: string; quote: string; detail?: string; cta?: string; imageAlt: string } =
    t.slides[index];
  const go = (next: number) => setIndex((next + count) % count);

  return (
    <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
      <div className="flex min-w-0 flex-col" aria-live="polite">
        <p className="text-xs tracking-widest text-muted sm:text-sm">{text.source}</p>
        <p className="mt-5 text-4xl leading-tight text-lime tabular-nums sm:text-5xl">{text.big}</p>
        <blockquote className="mt-6 max-w-md font-sans text-2xl leading-snug text-cream normal-case tracking-normal sm:text-3xl">
          &ldquo;{text.quote}&rdquo;
        </blockquote>
        {text.detail && (
          <p className="mt-4 font-sans text-base text-muted normal-case tracking-normal">{text.detail}</p>
        )}
        <div className="mt-8 flex flex-wrap gap-2">
          {slide.links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-press border-[3px] border-border px-4 py-2 text-xs tracking-widest text-cream transition-colors outline-none hover:border-lime hover:text-lime focus-visible:border-lime sm:text-sm"
            >
              {slide.links.length === 1 && text.cta ? text.cta : link.name} &#8599;
            </a>
          ))}
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-4" role="region" aria-roledescription="carousel" aria-label={t.carouselLabel}>
        <a
          href={slide.imageHref}
          target="_blank"
          rel="noopener noreferrer"
          className="relative block border-[3px] border-border bg-black transition-colors outline-none hover:border-lime focus-visible:border-lime"
          aria-label={text.imageAlt}
        >
          <div className="relative aspect-[5/4] w-full">
            <Image
              key={slide.image}
              src={slide.image}
              alt={text.imageAlt}
              fill
              sizes="(min-width: 1024px) 560px, 100vw"
              className="animate-[fade-in_0.3s_ease-out] object-contain"
              priority={index === 0}
            />
          </div>
        </a>
        <div className="flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => go(index - 1)}
            aria-label={t.prev}
            className="btn-press border-[3px] border-border px-4 py-2 text-sm text-muted outline-none hover:text-cream focus-visible:border-cream"
          >
            &larr;
          </button>
          <div className="flex items-center gap-2" role="group" aria-label={t.pick}>
            {SOCIAL_SLIDES.map((s, i) => (
              <button
                key={s.image}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`${i + 1} / ${count}`}
                aria-current={i === index ? "true" : undefined}
                className={`h-3 w-3 outline-none focus-visible:ring-2 focus-visible:ring-cream ${
                  i === index ? "bg-lime" : "bg-border hover:bg-border-light"
                }`}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => go(index + 1)}
            aria-label={t.next}
            className="btn-press border-[3px] border-border px-4 py-2 text-sm text-muted outline-none hover:text-cream focus-visible:border-cream"
          >
            &rarr;
          </button>
        </div>
      </div>
    </div>
  );
}
