"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import PlayVideo from "./PlayVideo";
import { PLAY_VIDEOS, type Copy } from "./copy";

// Gameplay cards in a scroll-snap row: each card is 2/5 of the row on desktop,
// so two and a half show and the cut card says there is more.
export default function PlayCarousel({ t }: { t: Copy["play"] }) {
  const rowRef = useRef<HTMLUListElement>(null);
  const [edge, setEdge] = useState({ start: true, end: false });

  const update = useCallback(() => {
    const el = rowRef.current;
    if (!el) return;
    setEdge({ start: el.scrollLeft < 8, end: el.scrollLeft + el.clientWidth > el.scrollWidth - 8 });
  }, []);

  useEffect(() => {
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [update]);

  const step = (dir: 1 | -1) => {
    const el = rowRef.current;
    const card = el?.querySelector("li");
    if (!el || !card) return;
    el.scrollBy({ left: dir * (card.clientWidth + 12), behavior: "smooth" });
  };

  return (
    <div className="flex flex-col gap-4">
      <ul
        ref={rowRef}
        onScroll={update}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [scrollbar-width:none]"
        aria-label={t.title}
      >
        {t.items.map((item) => (
          <li
            key={item.id}
            className="flex w-[85%] shrink-0 snap-start flex-col border-[3px] border-border bg-bg-raised sm:w-[60%] lg:w-[40%]"
          >
            <PlayVideo
              src={PLAY_VIDEOS[item.id]?.src}
              poster={PLAY_VIDEOS[item.id]?.poster}
              label={`${t.videoLabel} ${item.title}`}
            />
            <div className="flex flex-col gap-2 p-5">
              <h3 className="text-xl text-lime">{item.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted normal-case">{item.text}</p>
            </div>
          </li>
        ))}
      </ul>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => step(-1)}
          disabled={edge.start}
          aria-label={t.prev}
          className="btn-press border-[3px] border-border px-4 py-2 text-sm text-cream outline-none hover:border-lime focus-visible:border-cream disabled:opacity-30 disabled:hover:border-border"
        >
          &larr;
        </button>
        <button
          type="button"
          onClick={() => step(1)}
          disabled={edge.end}
          aria-label={t.next}
          className="btn-press border-[3px] border-border px-4 py-2 text-sm text-cream outline-none hover:border-lime focus-visible:border-cream disabled:opacity-30 disabled:hover:border-border"
        >
          &rarr;
        </button>
      </div>
    </div>
  );
}
