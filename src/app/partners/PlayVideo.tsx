"use client";

import { useEffect, useRef } from "react";

// A muted 16:9 loop that plays only while on screen and never for reduced motion.
// With no `src` yet it keeps the frame, so the grid is ready for the videos.
export default function PlayVideo({ src, poster, label }: { src?: string; poster?: string; label: string }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video || !src) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) video.play().catch(() => {});
        else video.pause();
      },
      { threshold: 0.4 },
    );
    io.observe(video);
    return () => io.disconnect();
  }, [src]);

  return (
    <div className="relative aspect-video w-full overflow-hidden border-b-[3px] border-border bg-bg">
      {src ? (
        <video
          ref={ref}
          src={src}
          poster={poster}
          muted
          loop
          playsInline
          preload="metadata"
          aria-label={label}
          className="h-full w-full object-cover"
        />
      ) : (
        <div aria-hidden="true" className="h-full w-full bg-bg" />
      )}
    </div>
  );
}
