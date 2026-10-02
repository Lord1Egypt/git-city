// A song from a brief: a JSON file of genre-level choices, so a film gets
// music in its own register without writing an arrangement by hand. Every
// field is optional. A brief (README.md next to this file has the full list):
//   {
//     "bpm": 96, "key": "D", "scale": "dorian", "chords": [1, 4, 6, 5],
//     "beats": 48, "intro": 8, "freeze": 36, "card": 40,
//     "drums": "half", "bass": "sub", "harmony": "keys", "arp": "eighths",
//     "timbre": "warm", "brightness": 0.5, "space": 0.6,
//     "lead": [[16, 5, 1], [17, 6, 0.5]],
//     "hits": [{ "beat": 41, "kind": "chime" }, { "beat": 44, "kind": "thud" }]
//   }
// The groove runs from 0 to the freeze (or to the end), drums and bass from
// the intro on; with a freeze, silence holds until the card, and only the
// hits play after it.

const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
};
const KEYS = { C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11 };
// What each timbre plays its parts with: [wave, base cutoff in Hz, detune in cents].
const TIMBRES = {
  warm: { chords: ["triangle", 1400, 6], bass: ["sine", 500, 0], arp: ["triangle", 2400, 0], lead: ["triangle", 3000, 0] },
  bright: { chords: ["saw", 2200, 14], bass: ["saw", 900, 8], arp: ["pulse", 3500, 0], lead: ["square", 3500, 0] },
  glass: { chords: ["sine", 3000, 4], bass: ["sine", 400, 0], arp: ["sine", 5000, 0], lead: ["sine", 5000, 0] },
  "8bit": { chords: ["square", 4000, 0], bass: ["pulse", 1600, 0], arp: ["pulse", 5000, 0], lead: ["square", 5000, 0] },
};

export default function brief({ brief: b = {} }) {
  const bpm = b.bpm ?? 120;
  const scale = SCALES[b.scale ?? "minor"] ?? SCALES.minor;
  const root = KEYS[b.key ?? "A"] ?? 9;
  const chords = b.chords ?? (b.scale === "major" ? [1, 5, 6, 4] : [1, 6, 3, 7]);
  const beats = b.beats ?? 64;
  const intro = b.intro ?? 4;
  const end = b.freeze ?? beats;
  const hits = b.hits ?? [];
  const last = Math.max(beats, b.card ?? 0, ...hits.map((h) => h.beat + 6));
  const T = TIMBRES[b.timbre ?? "bright"] ?? TIMBRES.bright;
  const bright = 0.5 + (b.brightness ?? 0.5); // 0.5x to 1.5x every cutoff
  const space = b.space ?? 0.4;

  /** A scale degree (1 = the root; 8 = an octave up) to a MIDI note, from a base octave's C. */
  const note = (deg, base) => {
    const i = deg - 1;
    const oct = Math.floor(i / 7);
    return base + root + scale[((i % 7) + 7) % 7] + 12 * oct;
  };
  const triad = (deg, base) => [note(deg, base), note(deg + 2, base), note(deg + 4, base)];

  return {
    bpm,
    bars: Math.ceil(last / 4),
    echo: { beats: 0.75, feedback: 0.3 + 0.3 * space, mix: 0.3 + 0.5 * space },
    play(s) {
      const { BEAT, kick, snare, hat, crash, tone, riser, impact } = s;
      const t = (beat) => beat * BEAT;
      const on = (beat) => beat < end;

      for (let bar = 0; bar * 4 < end; bar++) {
        const b0 = bar * 4;
        const deg = chords[bar % chords.length];
        const live = b0 >= intro;

        // Drums.
        if (live) {
          if (b0 === intro && b.drums !== "none") crash(t(b0), 0.7);
          const pattern = {
            four: { kick: [0, 1, 2, 3], snare: [1, 3], hats: 0.25 },
            half: { kick: [0, 2.5], snare: [2], hats: 0.5 },
            broken: { kick: [0, 1.75, 2.5], snare: [1, 3], hats: 0.5 },
          }[b.drums ?? "four"];
          if (pattern) {
            for (const x of pattern.kick) if (on(b0 + x)) kick(t(b0 + x), 1);
            for (const x of pattern.snare) if (on(b0 + x)) snare(t(b0 + x), 0.8);
            for (let x = 0; x < 4; x += pattern.hats)
              if (on(b0 + x)) hat(t(b0 + x), x % 1 === 0.5, x % 1 === 0.5 ? 0.7 : 0.5);
          }
        }

        // Bass.
        const [bw, bc, bd] = T.bass;
        const r = note(deg, 24);
        if (live && b.bass !== "none") {
          if ((b.bass ?? "pump") === "sub") {
            tone(t(b0), BEAT * 3.8, r, { wave: bw, gain: 0.3, cutoff: bc * bright, env: [0.01, 0.3, 0.8, 0.1], detune: bd });
          } else if (b.bass === "pluck") {
            for (let e = 0; e < 8; e++)
              if (on(b0 + e / 2))
                tone(t(b0 + e / 2), BEAT * 0.3, r + 12, { wave: bw, gain: 0.2, cutoff: bc * bright * 1.5, env: [0.002, 0.12, 0.1, 0.05], detune: bd });
          } else {
            for (let e = 0; e < 8; e++)
              if (on(b0 + e / 2))
                tone(t(b0 + e / 2), (BEAT / 2) * 0.9, r + (e % 2 ? 12 : 0), { wave: bw, gain: 0.22, cutoff: bc * bright, env: [0.003, 0.08, 0.5, 0.03], detune: bd });
          }
        }

        // Harmony (plays through the intro too).
        const [cw, cc, cd] = T.chords;
        const ch = triad(deg, 48);
        const harmony = b.harmony ?? "pad";
        if (harmony === "pad") {
          for (const n of ch)
            tone(t(b0), Math.min(4, end - b0) * BEAT, n, { wave: cw, gain: 0.05, cutoff: cc * bright, env: [0.3, 0.4, 0.7, 0.4], detune: cd, pan: n % 2 ? 0.4 : -0.4 });
        } else if (harmony === "keys") {
          for (const x of [0, 2])
            if (on(b0 + x))
              for (const n of ch)
                tone(t(b0 + x), BEAT * 1.6, n + 12, { wave: cw, gain: 0.05, cutoff: cc * bright, env: [0.005, 0.6, 0.3, 0.3], detune: cd, echo: space * 0.5 });
        } else if (harmony === "stabs") {
          for (const x of [1.5, 3.5])
            if (on(b0 + x))
              for (const n of ch)
                tone(t(b0 + x), BEAT * 0.25, n + 12, { wave: cw, gain: 0.06, cutoff: cc * bright, env: [0.002, 0.1, 0.3, 0.08], detune: cd, echo: space * 0.5 });
        }

        // Arpeggio.
        const step = { eighths: 0.5, sixteenths: 0.25 }[b.arp];
        if (live && step) {
          const [aw, ac, ad] = T.arp;
          const seq = [...triad(deg, 60), note(deg + 7, 60)];
          for (let i = 0; i * step < 4; i++)
            if (on(b0 + i * step))
              tone(t(b0 + i * step), BEAT * step * 0.8, seq[i % 4], { wave: aw, gain: 0.05, cutoff: ac * bright, env: [0.002, 0.05, 0.4, 0.03], detune: ad, pan: 0.35, echo: space * 0.6 });
        }
      }

      // Lead: [beat, scale degree, beats long], above the chords.
      const [lw, lc, ld] = T.lead;
      for (const [beat, deg, len] of b.lead ?? [])
        if (on(beat))
          tone(t(beat), len * BEAT * 0.9, note(deg, 72), { wave: lw, gain: 0.09, cutoff: lc * bright, env: [0.005, 0.1, 0.7, 0.08], detune: ld, vib: 0.004, pan: -0.1, echo: space });

      // A riser into the drop, when there's an intro to build in.
      if (intro >= 2 && b.drums !== "none") riser(t(intro - 2), t(intro), 0.15);

      // The hits: the film's big moments and the end card's beats.
      for (const { beat, kind = "impact", gain = 1 } of hits) {
        const x = t(beat);
        const ch = triad(chords[0], 60);
        if (kind === "impact") impact(x, gain);
        else if (kind === "thud") {
          kick(x, 1.1 * gain);
          tone(x, 0.15, note(1, 24), { wave: "sine", gain: 0.3 * gain, cutoff: 500, env: [0.001, 0.1, 0.1, 0.05], sc: false });
        } else if (kind === "chime")
          for (const n of [...ch, ch[0] + 12])
            tone(x, BEAT * 2, n + 12, { wave: "sine", gain: 0.06 * gain, cutoff: 6000, env: [0.002, 1.2, 0.2, 1], sc: false, echo: 0.5 });
        else if (kind === "stab")
          for (const n of ch)
            tone(x, 0.22, n, { wave: T.chords[0], gain: 0.08 * gain, cutoff: 2600 * bright, env: [0.002, 0.15, 0.3, 0.12], detune: T.chords[2], sc: false });
        else if (kind === "boom")
          tone(x, 1.2, note(1, 12), { wave: "sine", gain: 0.45 * gain, cutoff: 300, env: [0.002, 1, 0.2, 0.8], sc: false, glideFrom: note(1, 24) });
        else if (kind === "riser") riser(t(beat - 4), x, 0.25 * gain);
      }

      if (b.freeze !== undefined) s.silence(b.freeze, b.card ?? beats);
    },
  };
}
