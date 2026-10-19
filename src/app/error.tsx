"use client";

import Link from "next/link";
import { useEffect } from "react";

const ACCENT = "#c8e64a";

// App-wide error boundary: a page whose data fails (the db busy or down)
// shows a screen to retry instead of a white page. Routes with their own
// error.tsx (the shop) keep theirs.
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("App error:", error);
  }, [error]);

  return (
    <main className="min-h-screen bg-bg font-pixel uppercase text-warm">
      <div className="mx-auto max-w-lg px-3 py-16 text-center">
        <div className="border-[3px] border-border bg-bg-raised p-8">
          <h1 className="text-lg text-cream">The city is busy</h1>
          <p className="mt-3 text-[10px] text-muted normal-case">This page didn&apos;t load. Try again in a few seconds.</p>
          <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <button onClick={reset} className="btn-press px-6 py-3 text-xs text-bg" style={{ backgroundColor: ACCENT, boxShadow: "3px 3px 0 0 #5a7a00" }}>
              Try again
            </button>
            <Link href="/" className="text-xs text-muted normal-case transition-colors hover:text-cream">Back to City &rarr;</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
