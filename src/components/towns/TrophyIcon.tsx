// The Town of the week symbol: a solid pixel trophy on a 12×12 grid, so 12px
// is one pixel per cell. Takes the text color.
const CELLS = [
  "XXXXXXXXXXXX",
  "XXXXXXXXXXXX",
  "X.XXXXXXXX.X",
  "X.XXXXXXXX.X",
  ".XXXXXXXXXX.",
  "..XXXXXXXX..",
  "....XXXX....",
  ".....XX.....",
  ".....XX.....",
  "...XXXXXX...",
  "..XXXXXXXX..",
  "..XXXXXXXX..",
];

/** Horizontal runs per row, so the SVG has a handful of rects instead of 100. */
const RUNS = CELLS.flatMap((row, y) => {
  const out: { x: number; y: number; w: number }[] = [];
  for (let x = 0; x < row.length; ) {
    if (row[x] !== "X") {
      x++;
      continue;
    }
    let w = 0;
    while (row[x + w] === "X") w++;
    out.push({ x, y, w });
    x += w;
  }
  return out;
});

export default function TrophyIcon({ size = 12, className = "", label }: { size?: number; className?: string; label?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 12 12"
      shapeRendering="crispEdges"
      className={`shrink-0 ${className}`}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {RUNS.map((r) => (
        <rect key={`${r.x}-${r.y}`} x={r.x} y={r.y} width={r.w} height={1} fill="currentColor" />
      ))}
    </svg>
  );
}
