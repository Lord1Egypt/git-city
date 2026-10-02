// Trailer music, synthesized from scratch (no samples, no dependencies).
// This file is the synthesizer: drums, a tone voice (saw, square, pulse,
// triangle, sine; filter, envelope, detune, glide), a lead, risers, impacts,
// an echo bus and a master. What it plays comes from an arrangement:
//   - an arrangement module you write for the film (see arrangements/README.md),
//   - or a brief: a JSON file of genre-level choices (tempo, key, drums, bass,
//     harmony, timbre, hits), played by arrangements/brief.mjs.
// arrangements/gitcity.mjs is Git City's own synthwave, an example of one
// project's sound. Write your project's; don't reuse it.
// Everything is a function of beats, so the film's timeline must use the
// arrangement's BPM.
// Usage:
//   node music.mjs <out.wav> <brief.json>
//   node music.mjs <out.wav> <arrangement.mjs | name in arrangements/> [cut]
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SR = 44100;
const [outPath = "song.wav", source, cut] = process.argv.slice(2);
if (!source) {
  console.error("Usage: node music.mjs <out.wav> <brief.json | arrangement.mjs | name> [cut]");
  process.exit(1);
}
const here = dirname(fileURLToPath(import.meta.url));
let brief = null;
let modulePath;
if (source.endsWith(".json")) {
  brief = JSON.parse(readFileSync(source, "utf8"));
  modulePath = resolve(here, "arrangements/brief.mjs");
} else if (source.endsWith(".mjs") || source.endsWith(".js")) {
  modulePath = resolve(source);
} else {
  modulePath = resolve(here, `arrangements/${source}.mjs`);
}
const { default: arrange } = await import(pathToFileURL(modulePath).href);
// An arrangement: ({ cut, brief }) => { bpm, bars, echo?, play(s) }.
const song = arrange({ cut, brief });

const BPM = song.bpm;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;
const LEN = Math.ceil((song.bars * BAR + 2.5) * SR);
const L = new Float32Array(LEN);
const R = new Float32Array(LEN);
const duck = new Float32Array(LEN).fill(1); // sidechain from the kick
const echoL = new Float32Array(LEN);
const echoR = new Float32Array(LEN);
const gates = [];

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const at = (bar, beat = 0) => (bar * 4 + beat) * BEAT; // 0-indexed bar
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;

function add(buf, i, v) {
  if (i >= 0 && i < LEN) buf[i] += v;
}
function both(i, v, pan = 0) {
  add(L, i, v * (1 - pan));
  add(R, i, v * (1 + pan));
}

// ─── Drums ───
function kick(t, gain = 1) {
  const s = Math.floor(t * SR);
  let ph = 0;
  for (let i = 0; i < 0.42 * SR; i++) {
    const x = i / SR;
    const f = 45 + 110 * Math.exp(-x * 28);
    ph += (2 * Math.PI * f) / SR;
    const env = Math.exp(-x * 7.5);
    const click = i < 60 ? rnd() * 0.4 * (1 - i / 60) : 0;
    both(s + i, (Math.sin(ph) * env * 0.95 + click) * gain);
  }
  for (let i = 0; i < 0.3 * SR; i++) {
    const k = s + i;
    if (k < LEN) duck[k] = Math.min(duck[k], 0.35 + 0.65 * Math.min(1, i / (0.3 * SR)));
  }
}
function snare(t, gain = 1) {
  const s = Math.floor(t * SR);
  let lp = 0;
  for (let i = 0; i < 0.22 * SR; i++) {
    const x = i / SR;
    const n = rnd();
    lp += 0.5 * (n - lp);
    const hp = n - lp; // brighter noise
    const tone = Math.sin(2 * Math.PI * 185 * x) * Math.exp(-x * 30) * 0.5;
    const env = Math.exp(-x * 16);
    both(s + i, (hp * 0.55 * env + tone) * gain, 0.05);
  }
}
function hat(t, open = false, gain = 1) {
  const s = Math.floor(t * SR);
  let prev = 0;
  const dur = open ? 0.18 : 0.045;
  for (let i = 0; i < dur * SR; i++) {
    const x = i / SR;
    const n = rnd();
    const hp = n - prev;
    prev = n;
    both(s + i, hp * 0.16 * Math.exp(-x * (open ? 14 : 70)) * gain, 0.25);
  }
}
function crash(t, gain = 1) {
  const s = Math.floor(t * SR);
  let prev = 0;
  for (let i = 0; i < 2.2 * SR; i++) {
    const x = i / SR;
    const n = rnd();
    const hp = n - prev;
    prev = n;
    both(s + i, hp * 0.22 * Math.exp(-x * 1.6) * gain, i % 2 ? 0.3 : -0.3);
  }
}

// ─── Synths ───
// `echo` sends that much of the voice to the echo bus.
function tone(
  t,
  dur,
  midi,
  {
    wave = "saw",
    gain = 0.2,
    cutoff = 2000,
    env = [0.005, 0.1, 0.6, 0.08],
    pan = 0,
    vib = 0,
    detune = 0,
    sc = true,
    glideFrom = null,
    echo = 0,
  } = {},
) {
  const s = Math.floor(t * SR);
  const [a, d, sus, r] = env;
  const n = Math.floor((dur + r) * SR);
  const f0 = mtof(midi);
  const voices = detune ? [-detune, 0, detune] : [0];
  const phs = voices.map(() => Math.random());
  let lp = 0;
  const k = 1 - Math.exp((-2 * Math.PI * cutoff) / SR);
  for (let i = 0; i < n; i++) {
    const x = i / SR;
    let e = x < a ? x / a : x < a + d ? 1 - (1 - sus) * ((x - a) / d) : sus;
    if (x > dur) e *= Math.max(0, 1 - (x - dur) / r);
    let f = f0;
    if (glideFrom !== null)
      f = mtof(glideFrom) + (f0 - mtof(glideFrom)) * Math.min(1, x / Math.max(0.001, dur));
    if (vib) f *= 1 + vib * Math.sin(2 * Math.PI * 5.5 * x) * Math.min(1, x * 4);
    let v = 0;
    voices.forEach((dv, j) => {
      phs[j] = (phs[j] + (f * Math.pow(2, dv / 1200)) / SR) % 1;
      const p = phs[j];
      v +=
        wave === "saw"
          ? 2 * p - 1
          : wave === "square"
            ? p < 0.5
              ? 1
              : -1
            : wave === "pulse"
              ? p < 0.25
                ? 1
                : -1
              : wave === "triangle"
                ? 1 - 4 * Math.abs(p - 0.5)
                : Math.sin(2 * Math.PI * p);
    });
    v /= voices.length;
    lp += k * (v - lp);
    const idx = s + i;
    const g = sc && idx < LEN ? duck[idx] : 1;
    const out = lp * e * gain * g;
    both(idx, out, pan);
    if (echo) {
      add(echoL, idx, out * echo);
      add(echoR, idx, out * echo);
    }
  }
}

// A thin pulse lead with vibrato, sent to the echo.
function lead(t, dur, midi, gain = 0.13) {
  const s = Math.floor(t * SR);
  const n = Math.floor((dur + 0.05) * SR);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const x = i / SR;
    const f = mtof(midi) * (1 + 0.006 * Math.sin(2 * Math.PI * 6 * x) * Math.min(1, x * 3));
    ph = (ph + f / SR) % 1;
    let e =
      Math.min(1, x / 0.004) *
      (x > dur ? Math.max(0, 1 - (x - dur) / 0.05) : 1) *
      (0.8 + 0.2 * Math.exp(-x * 8));
    const v = (ph < 0.25 ? 1 : -1) * e * gain;
    both(s + i, v, -0.1);
    add(echoL, s + i, v * 0.5);
    add(echoR, s + i, v * 0.5);
  }
}

// ─── FX ───
function riser(t0, t1, gain = 0.25) {
  const s = Math.floor(t0 * SR),
    n = Math.floor((t1 - t0) * SR);
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const u = i / n;
    const fc = 300 + 7000 * u * u;
    const k = 1 - Math.exp((-2 * Math.PI * fc) / SR);
    lp += k * (rnd() - lp);
    both(s + i, lp * gain * u, Math.sin(u * 20) * 0.3);
  }
}
// An engine: a detuned saw growl gliding up, wobbling like revs.
function engine(t0, t1, gain = 0.22) {
  const s = Math.floor(t0 * SR),
    n = Math.floor((t1 - t0) * SR);
  let p1 = 0,
    p2 = 0,
    lp = 0;
  for (let i = 0; i < n; i++) {
    const u = i / n;
    const x = i / SR;
    const f = (38 + 70 * u * u) * (1 + 0.08 * Math.sin(2 * Math.PI * (9 + 18 * u) * x));
    p1 = (p1 + f / SR) % 1;
    p2 = (p2 + (f * 1.503) / SR) % 1;
    const v = (2 * p1 - 1) * 0.7 + (2 * p2 - 1) * 0.4;
    const fc = 180 + 1800 * u;
    lp += (1 - Math.exp((-2 * Math.PI * fc) / SR)) * (v - lp);
    const e = Math.min(1, x / 0.05) * (u > 0.97 ? (1 - u) / 0.03 : 1);
    both(s + i, Math.tanh(lp * 2.2) * gain * e * (0.5 + 0.5 * u));
  }
}
function impact(t, gain = 1) {
  kick(t, 1.1 * gain);
  crash(t, 0.8 * gain);
  const s = Math.floor(t * SR);
  let lp = 0;
  for (let i = 0; i < 0.5 * SR; i++) {
    const x = i / SR;
    lp += 0.15 * (rnd() - lp);
    both(s + i, lp * 0.9 * Math.exp(-x * 9) * gain);
  }
  tone(t, 0.35, 28, {
    wave: "sine",
    gain: 0.5 * gain,
    cutoff: 400,
    env: [0.002, 0.3, 0.2, 0.3],
    sc: false,
    glideFrom: 40,
  });
}
/** Hard silence from one beat to another (a freeze before the name), applied after the echo. */
function silence(fromBeat, toBeat) {
  gates.push([fromBeat * BEAT, toBeat * BEAT]);
}

song.play({ BPM, BEAT, BAR, at, rnd, kick, snare, hat, crash, tone, lead, riser, engine, impact, silence });

// Echo bus (default: dotted eighth, three repeats).
const { beats: echoBeats = 0.75, feedback = 0.45, mix = 0.6 } = song.echo ?? {};
const dly = Math.floor(BEAT * echoBeats * SR);
for (let i = dly; i < LEN; i++) {
  echoL[i] += echoR[i - dly] * feedback;
  echoR[i] += echoL[i - dly] * feedback;
}
for (let i = dly; i < LEN; i++) {
  L[i] += echoL[i - dly] * mix;
  R[i] += echoR[i - dly] * mix;
}

for (const [t0, t1] of gates) {
  const s0 = Math.floor(t0 * SR),
    s1 = Math.floor(t1 * SR) - 40;
  for (let i = s0; i < s1 && i < LEN; i++) {
    const k = i < s0 + 220 ? 1 - (i - s0) / 220 : 0;
    L[i] *= k;
    R[i] *= k;
  }
}

// Master: gentle saturation and normalize.
let peak = 0;
for (let i = 0; i < LEN; i++) {
  L[i] = Math.tanh(L[i] * 1.25);
  R[i] = Math.tanh(R[i] * 1.25);
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
}
const norm = 0.92 / peak;

const out = Buffer.alloc(44 + LEN * 4);
out.write("RIFF", 0);
out.writeUInt32LE(36 + LEN * 4, 4);
out.write("WAVE", 8);
out.write("fmt ", 12);
out.writeUInt32LE(16, 16);
out.writeUInt16LE(1, 20);
out.writeUInt16LE(2, 22);
out.writeUInt32LE(SR, 24);
out.writeUInt32LE(SR * 4, 28);
out.writeUInt16LE(4, 32);
out.writeUInt16LE(16, 34);
out.write("data", 36);
out.writeUInt32LE(LEN * 4, 40);
for (let i = 0; i < LEN; i++) {
  out.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i] * norm)) * 32767), 44 + i * 4);
  out.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i] * norm)) * 32767), 46 + i * 4);
}
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, out);
console.log(`${(LEN / SR).toFixed(1)}s at ${BPM} BPM`);
