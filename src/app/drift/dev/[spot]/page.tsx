import { notFound } from "next/navigation";
import { offsetAt } from "@/lib/league-city/race/layout";
import { wallOffset } from "@/lib/league-city/race/track";
import { courseOf, getLiveSpot, SPOTS } from "@/lib/drift/spots";

// Throwaway: a drift spot's layout from above, to judge the shapes before
// any scenery. Dev only. Delete before merging.

export const dynamic = "force-dynamic";

const PX = 1.4;

export default async function DriftLayoutPage({ params }: { params: Promise<{ spot: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const { spot: id } = await params;
  const spot = getLiveSpot(id);
  if (!spot) notFound();
  const { track, clips } = courseOf(spot);
  const w = track.spec.width;
  const wall = wallOffset(track.spec);

  const band = (a: number, b: number, s0 = 0, s1 = track.length, step = 2) => {
    const left: string[] = [];
    const right: string[] = [];
    for (let s = s0; s <= s1 + 1e-6; s += step) {
      const p = offsetAt(track, Math.min(s, s1), a);
      const q = offsetAt(track, Math.min(s, s1), b);
      left.push(`${p.x},${p.z}`);
      right.unshift(`${q.x},${q.z}`);
    }
    return [...left, ...right].join(" ");
  };

  const xs = track.samples.map((p) => p.x);
  const zs = track.samples.map((p) => p.z);
  const pad = wall + 20;
  const minX = Math.min(...xs) - pad;
  const minZ = Math.min(...zs) - pad;
  const W = Math.max(...xs) + pad - minX;
  const H = Math.max(...zs) + pad - minZ;
  const start = offsetAt(track, 0, 0);
  const finish = offsetAt(track, track.length, 0);
  const secs = (v: number) => Math.round(track.length / v);

  return (
    <main style={{ background: "#11161d", color: "#e8edf3", minHeight: "100vh", padding: 16, fontFamily: "monospace" }}>
      <nav style={{ display: "flex", gap: 16, marginBottom: 8 }}>
        {SPOTS.filter((s) => s.status === "live").map((s) => (
          <a key={s.id} href={`/drift/dev/${s.id}`} style={{ color: s.id === spot.id ? "#ffcf33" : "#8fa3b8" }}>
            {s.name}
          </a>
        ))}
      </nav>
      <h1 style={{ fontSize: 18, margin: "4px 0" }}>
        {spot.name} · {track.closed ? "loop" : "point to point"} · {Math.round(track.length)} m · {secs(19)}–{secs(15)} s at 55–70 km/h ·{" "}
        {track.checkpoints.length} checkpoints · {spot.surface}
      </h1>
      <p style={{ fontSize: 12, color: "#8fa3b8", margin: "0 0 12px" }}>
        grey asphalt · red walls · yellow clipping zones · white ticks checkpoints (long ticks: splits) · green start · red finish
      </p>
      <svg viewBox={`${minX} ${minZ} ${W} ${H}`} width={W * PX} height={H * PX} style={{ background: "#1c2a1c", maxWidth: "100%", height: "auto" }}>
        <polygon points={band(wall + 0.5, -wall - 0.5)} fill="#b8323c" />
        <polygon points={band(wall - 0.5, -wall + 0.5)} fill="#2b3a2b" />
        <polygon points={band(w / 2, -w / 2)} fill="#454b57" />
        {clips.map((c, i) => {
          const edge = c.kind === "inner" ? w / 2 : wall - 0.5;
          return <polygon key={i} points={band(c.side * edge, c.side * (edge - c.depth), c.s, c.s + c.len, 1)} fill="#ffcf33" opacity={0.85} />;
        })}
        {track.checkpoints.map((s, i) => {
          const long = track.spec.splits.includes(i);
          const a = offsetAt(track, s, w / 2 + (long ? 3 : 0));
          const b = offsetAt(track, s, -w / 2 - (long ? 3 : 0));
          return <line key={s} x1={a.x} y1={a.z} x2={b.x} y2={b.z} stroke="#fff" strokeWidth={long ? 0.8 : 0.3} opacity={0.7} />;
        })}
        <circle cx={start.x} cy={start.z} r={3} fill="#3ddc6b" />
        {!track.closed && <circle cx={finish.x} cy={finish.z} r={3} fill="#e0323c" />}
        {track.grid.slice(0, 1).map((g, i) => (
          <circle key={i} cx={g.x} cy={g.z} r={1.5} fill="#fff" />
        ))}
      </svg>
    </main>
  );
}
