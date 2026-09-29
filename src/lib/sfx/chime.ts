import { Howler } from "howler";

// A short rising two-note chime, synthesized like the horn (no sound file).
// Through Howler's master gain when it's up, so the drive volume covers it.
let ctx: AudioContext | null = null;

export function chime() {
  try {
    const shared = Howler.ctx && Howler.masterGain ? { c: Howler.ctx, out: Howler.masterGain as AudioNode } : null;
    const c = shared?.c ?? (ctx ??= new AudioContext());
    const out = shared?.out ?? c.destination;
    const t0 = c.currentTime;
    [880, 1318.5].forEach((f, i) => {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = "square";
      o.frequency.value = f;
      const t = t0 + i * 0.07;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.12, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + 0.18);
    });
  } catch {
    // no audio
  }
}
