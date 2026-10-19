"use client";

import { useEffect } from "react";

// Last-resort boundary: replaces the root layout when it fails, so it brings
// its own <html> and inline styles (globals.css isn't loaded here).
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Global error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", background: "#0d0d0f", color: "#e8dcc8", fontFamily: "monospace", textAlign: "center", padding: 16 }}>
        <div>
          <h1 style={{ fontSize: 20, textTransform: "uppercase" }}>The city is busy</h1>
          <p style={{ fontSize: 13, opacity: 0.7 }}>Git City didn&apos;t load. Try again in a few seconds.</p>
          <button onClick={reset} style={{ marginTop: 16, padding: "12px 24px", background: "#c8e64a", color: "#0d0d0f", border: 0, boxShadow: "3px 3px 0 0 #5a7a00", fontFamily: "inherit", textTransform: "uppercase", cursor: "pointer" }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
