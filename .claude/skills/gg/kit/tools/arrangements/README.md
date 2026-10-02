# Arrangements

`music.mjs` is a synthesizer. An arrangement decides what it plays. Each film gets its own, written for its project's sound. `gitcity.mjs` is Git City's arcade synthwave, kept as an example: read it, don't reuse it.

Two ways to get a song:

## 1. A brief (fastest)

Write the music direction from the plan as JSON, then run `node music.mjs public/trailer/song.wav song.json`. Every field is optional.

| Field | Values | Default |
|---|---|---|
| `bpm` | the film's BPM | 120 |
| `key`, `scale` | `C`…`B`; `major`, `minor`, `dorian`, `mixolydian`, `lydian`, `phrygian` | `A`, `minor` |
| `chords` | scale degrees, one per bar, looped | `[1,6,3,7]` (`[1,5,6,4]` in major) |
| `beats` | length in beats | 64 |
| `intro` | beats before drums and bass come in (pads only, a riser into the drop) | 4 |
| `freeze`, `card` | silence from `freeze` to `card`, then only the hits | none |
| `drums` | `four` (four on the floor), `half` (half-time), `broken`, `none` | `four` |
| `bass` | `pump` (offbeat octaves), `sub` (one long note a bar), `pluck`, `none` | `pump` |
| `harmony` | `pad`, `keys` (two chords a bar), `stabs` (offbeats), `none` | `pad` |
| `arp` | `eighths`, `sixteenths`, none | none |
| `timbre` | `warm` (triangle, sine), `bright` (saw, pulse), `glass` (sine, airy), `8bit` (square) | `bright` |
| `brightness`, `space` | 0–1: filter opening; echo amount | 0.5, 0.4 |
| `lead` | `[[beat, degree, beats], …]`, degree 1 = the root, 8 = an octave up | none |
| `hits` | `[{ beat, kind, gain? }]`, kind: `impact`, `thud`, `chime`, `stab`, `boom`, `riser` (the 4 beats before) | none |

Translate the direction into fields, don't stop at the defaults. Some starting points, each a sketch to push from:

| Direction | Brief |
|---|---|
| Calm product film (dev tools, a UI library) | 90–110 BPM, `major` or `lydian`, `half` or `none`, `sub`, `keys`, `glass` or `warm`, `space` 0.6, `chime` hits |
| Tense, dark | 80–100 BPM, `phrygian` or `minor`, `broken`, `sub`, `pad`, `warm`, low `brightness`, `boom` hits |
| Arcade, retro game | 140–160 BPM, `minor`, `four`, `pump`, `sixteenths`, `8bit`, `impact` hits |
| Big launch | 120–128 BPM, `four`, `pump`, `pad`, `bright`, a `riser` into an `impact` on the climax |

## 2. An arrangement module (when the brief can't say it)

A file that exports one function. `music.mjs` calls it with the `cut` from the command line and gives `play` the synth:

```js
// song.mjs: node music.mjs public/trailer/song.wav ./song.mjs [cut]
export default function song({ cut }) {
  return {
    bpm: 100,
    bars: 12,                       // length; the file gets 2.5s more for tails
    echo: { beats: 0.75, feedback: 0.45, mix: 0.6 }, // optional
    play(s) {
      const { at, BEAT, kick, snare, hat, crash, tone, lead, riser, engine, impact, silence } = s;
      for (let bar = 1; bar < 8; bar++) kick(at(bar, 0));
      tone(at(0), 4 * BEAT, 57, { wave: "triangle", cutoff: 1200, env: [0.2, 0.5, 0.7, 0.4] });
      silence(28, 32);              // beats: a hard gate before the name
    },
  };
}
```

- `at(bar, beat)` is seconds; every voice takes seconds.
- `tone(t, dur, midi, opts)`: `wave` (`saw`, `square`, `pulse`, `triangle`, `sine`), `gain`, `cutoff`, `env` `[attack, decay, sustain, release]`, `detune` (cents, three voices), `glideFrom`, `vib`, `pan`, `sc` (ducked by the kick, default on), `echo` (send amount).
- Drums: `kick`, `snare`, `hat(t, open)`, `crash`. Effects: `riser(t0, t1)`, `impact(t)`, `engine(t0, t1)` (a revving growl).
- The synth has no samples. For a sound it can't make (a real piano, a choir), use a licensed or CC0 file as the film's `song` instead, and say where it's from in the plan.
