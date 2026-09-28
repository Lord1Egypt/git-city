// Shared look of the full-screen terminals (city loading, login setup):
// lime phosphor text, CRT scanlines and vignette.

export const TERMINAL_LIME = "#c8e64a";

export const TERMINAL_KEYFRAMES = `
  @keyframes gc-cursor { 50% { opacity: 0; } }
  @keyframes gc-flicker { 0%, 97%, 99%, 100% { opacity: 1; } 98% { opacity: 0.92; } }
  @keyframes gc-flash { 0% { opacity: 0; } 15% { opacity: 0.9; } 100% { opacity: 0; } }
`;

export const TERMINAL_TEXT_CLASS =
  "w-full max-w-2xl overflow-hidden font-pixel text-[11px] leading-[1.9] tracking-wide sm:text-xs";

export const TERMINAL_TEXT_STYLE = {
  fontVariantNumeric: "tabular-nums",
  textShadow: `0 0 6px ${TERMINAL_LIME}40`,
  animation: "gc-flicker 4s infinite",
} as const;

export function TerminalCursor() {
  return (
    <span
      className="inline-block h-[1.1em] w-2 align-text-bottom"
      style={{ backgroundColor: TERMINAL_LIME, animation: "gc-cursor 1s steps(1) infinite" }}
    />
  );
}

/** CRT scanlines + vignette, laid over the whole screen. */
export function TerminalBackdrop() {
  return (
    <>
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "repeating-linear-gradient(to bottom, transparent 0px, transparent 2px, rgba(0,0,0,0.18) 3px, rgba(0,0,0,0.18) 4px)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.55) 100%)",
        }}
      />
    </>
  );
}
