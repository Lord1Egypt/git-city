// Git City's own music: arcade racing synthwave at 150 BPM (detuned saw bass,
// pulse arp and lead, four on the floor, 8-bit hits on the end card). It is
// one project's sound, kept as an example of an arrangement. Write your
// project's own (README.md next to this file); don't reuse this one.
// Cuts:
//   full  16 bars for a ~25s launch trailer
//   soon  the Towns teaser: 1 bar intro, 3 bars of drop, silence on the
//         freeze, then the end card's hits (Git City: src/lib/trailer/towns/teaser)
//   demo  the kit's demo film, the same shape a bar shorter (Git City: src/lib/trailer/demo/film)
// Bar 1: the burnout (engine rev rising, a hit on beat 4 when the cars launch).
// Bars 2-9: the drop. 10-13: lead melody. 14-15: build. 16: final hit.

// A teaser cut: 1 bar intro, the drop until the freeze, silence on the
// freeze, then the end card's hits from the cut to black. In beats:
const CUTS = { soon: { freeze: 16, card: 18 }, demo: { freeze: 12, card: 14 } };

// Chords: Em, C, D, B (i, VI, VII, V).
const CHORDS = [
  { root: 40, notes: [64, 67, 71] },
  { root: 36, notes: [60, 64, 67] },
  { root: 38, notes: [62, 66, 69] },
  { root: 35, notes: [59, 63, 66] },
];

export default function gitcity({ cut = "full" }) {
  const TEASER = CUTS[cut];
  return {
    bpm: 150,
    bars: TEASER ? Math.ceil((TEASER.card + 10) / 4) : 16,
    play(s) {
      const { at, BAR, BEAT, kick, snare, hat, crash, tone, lead, riser, engine, impact } = s;

      // Bar 0: burnouts. Engine revs beats 0-3, launch hit on beat 3 (the 4th beat).
      kick(at(0, 0), 0.8);
      engine(at(0, 0), at(0, 3), 0.24);
      riser(at(0, 1.5), at(0, 3), 0.18);
      impact(at(0, 3), 1.1);
      tone(at(0, 0), BAR, 28, {
        wave: "saw",
        gain: 0.12,
        cutoff: 220,
        env: [0.02, 0.2, 0.8, 0.1],
        sc: false,
      });

      function groove(bar, { hats = true, arp = true, pad = true, bassBusy = true, drop = false } = {}) {
        const c = CHORDS[bar % 4];
        for (let q = 0; q < 4; q++) {
          kick(at(bar, q), 1);
          if (q === 1 || q === 3) snare(at(bar, q), 0.9);
          if (hats) {
            for (let x = 0; x < 4; x++) hat(at(bar, q + x / 4), x === 2, x === 2 ? 0.8 : 0.55);
          }
        }
        // Bass: offbeat octave pumping eighths.
        for (let e = 0; e < 8; e++) {
          const m = c.root + (e % 2 ? 12 : 0);
          if (!bassBusy && e % 2 === 0) continue;
          tone(at(bar, e / 2), (BEAT / 2) * 0.9, m, {
            wave: "saw",
            gain: 0.22,
            cutoff: 900,
            env: [0.003, 0.08, 0.5, 0.03],
            detune: 8,
          });
        }
        if (pad)
          for (const n of c.notes)
            tone(at(bar), BAR, n - 12, {
              wave: "saw",
              gain: 0.05,
              cutoff: 1500,
              env: [0.05, 0.4, 0.7, 0.2],
              detune: 14,
              pan: n % 2 ? 0.4 : -0.4,
            });
        if (arp) {
          const seq = [c.notes[0], c.notes[1], c.notes[2], c.notes[0] + 12];
          for (let x = 0; x < 16; x++)
            tone(at(bar, x / 4), (BEAT / 4) * 0.8, seq[x % 4], {
              wave: "pulse",
              gain: 0.06,
              cutoff: 3500,
              env: [0.002, 0.05, 0.4, 0.03],
              pan: 0.35,
            });
        }
        if (drop) crash(at(bar), 0.9);
      }

      if (TEASER) {
        for (let b = 1; b * 4 < TEASER.freeze; b++) groove(b, { drop: b === 1 });
        // The end card (beats after the cut to black): an echo on the cut, an
        // 8-bit kick and crunch as the name stamps on (+1), a thud on the stamp
        // (+3), a chord stab on the line (+5) and a held note under the hold.
        const C = TEASER.card * BEAT;
        tone(C, 0.9, 28, {
          wave: "sine",
          gain: 0.25,
          cutoff: 300,
          env: [0.002, 0.8, 0.1, 0.6],
          sc: false,
          glideFrom: 36,
        });
        const stamp = C + BEAT;
        kick(stamp, 1.1);
        snare(stamp, 0.6);
        tone(stamp, 0.18, 40, {
          wave: "square",
          gain: 0.16,
          cutoff: 1800,
          env: [0.001, 0.12, 0.2, 0.05],
          sc: false,
        });
        // The stamp lands (card beat 3): a dry thud, like a rubber stamp.
        const thud = C + 3 * BEAT;
        kick(thud, 1.2);
        snare(thud, 0.45);
        tone(thud, 0.12, 33, {
          wave: "square",
          gain: 0.2,
          cutoff: 700,
          env: [0.001, 0.08, 0.1, 0.04],
          sc: false,
        });
        const stab = C + 5 * BEAT;
        kick(stab, 0.8);
        for (const n of [64, 67, 71, 76])
          tone(stab, 0.22, n, {
            wave: "saw",
            gain: 0.07,
            cutoff: 2600,
            env: [0.002, 0.15, 0.3, 0.12],
            detune: 12,
            sc: false,
          });
        tone(stab, 3 * BEAT, 52, {
          wave: "saw",
          gain: 0.045,
          cutoff: 900,
          env: [0.08, 0.5, 0.7, 0.4],
          detune: 10,
          sc: false,
        });
        // The teaser's freeze: hard silence from the freeze until the cut to black.
        s.silence(TEASER.freeze, TEASER.card);
        return;
      }

      for (let b = 1; b < 9; b++) groove(b, { drop: b === 1 || b === 5 });

      // Lead melody over bars 10-13 (eighths, 0 = rest).
      const MEL = [
        [71, 71, 76, 74, 71, 69, 67, 69],
        [67, 67, 72, 71, 67, 64, 67, 69],
        [69, 69, 74, 72, 69, 66, 69, 71],
        [71, 0, 75, 0, 78, 76, 75, 71],
      ];
      for (let i = 0; i < 4; i++) {
        const b = 9 + i;
        groove(b, { drop: i === 0 });
        MEL[i].forEach((m, e) => m && lead(at(b, e / 2), (BEAT / 2) * 0.9, m));
      }

      // Build: bars 14-15, snare roll and riser, bass on quarters.
      for (const b of [13, 14]) {
        const c = CHORDS[b % 4];
        for (let q = 0; q < 4; q++) {
          kick(at(b, q), 0.9);
          tone(at(b, q), BEAT * 0.9, c.root + 12, {
            wave: "saw",
            gain: 0.18,
            cutoff: 700 + (b - 13) * 900 + q * 250,
            env: [0.003, 0.1, 0.6, 0.05],
            detune: 8,
          });
        }
        const div = b === 13 ? 4 : 8;
        for (let x = 0; x < div * 4; x++)
          snare(at(b, x / div), 0.35 + (0.55 * ((b - 13) * 16 + x * (16 / div / 2))) / 32);
      }
      riser(at(13), at(15), 0.3);
      impact(at(15), 1.2);
      tone(at(15), BAR * 1.2, 40, {
        wave: "saw",
        gain: 0.12,
        cutoff: 600,
        env: [0.005, 1.2, 0.3, 1.0],
        detune: 12,
        sc: false,
      });
      for (const n of CHORDS[0].notes)
        tone(at(15), BAR * 1.2, n, {
          wave: "saw",
          gain: 0.05,
          cutoff: 1800,
          env: [0.005, 1.4, 0.3, 1.2],
          detune: 14,
          sc: false,
        });
    },
  };
}
