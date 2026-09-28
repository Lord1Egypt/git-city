# Trailer kit

Git City's trailers are played live in the game engine and recorded off the screen. There is no video editor involved: a film is data (a timeline of takes on the music's beat grid), a studio page plays it, and a screen recorder captures one clean pass. The Towns "coming soon" teaser is the worked example: open `/trailer/towns`.

This folder holds the pieces that aren't code in the app: the music and sound effect synthesizers, the capture window script, and this guide, which is also where the craft we learned making the Towns teaser is written down.

## Quick start

```bash
npm run trailer:audio   # synthesizes the music and sound effects into public/trailer/ (gitignored)
npm run dev             # then open http://localhost:3001/trailer/towns
```

The example plays in the two rivalry towns (`RIVALRY` in `src/lib/towns/rivalry.ts`). If your database doesn't have them, the page says so. Create them, or point `RIVALRY` at two towns you have. The engine itself needs no data: a film of your own can draw anything.

The studio: a 16:9 stage, the scenes on the right (a picked scene loops), play, scrub, slow motion. Keys:

| Key | Does |
|---|---|
| Space | Play / pause |
| ← → | One frame (Shift: one beat) |
| J L | One second |
| Home End | Scene start / end |
| 1–9, 0 | Pick a scene, the whole film |
| [ ] | Slower / faster (1×, 0.5×, 0.25×) |
| Shift R | Record: full window, no cursor, 1s of black, the whole film once |
| Esc | Stop recording |

## How a film is built

| File | What it is |
|---|---|
| `src/lib/trailer/clock.ts` | The clock every shot reads, in beats from the first frame. Never frame deltas: that's what keeps cuts on the beat. |
| `src/lib/trailer/film.ts` | The generic shape: takes, shots, moments, scenes, sounds, titles, flashes. |
| `src/components/trailer/Studio.tsx` | The editor. Plays any `Film`; the pictures come from its children. |
| `src/components/trailer/Titles.tsx` | Kinetic titles (a word on a slanted bar, plates over a split). |
| `src/lib/trailer/towns-teaser.ts` | The example film: its takes, their moments and sounds. |
| `src/components/trailer/towns/TownsRig.tsx` | The example's shots: one camera and car recipe per shot kind. |
| `src/components/trailer/towns/EndCard.tsx` | The example's end card. |
| `src/app/trailer/towns/` | The page: loads the two towns and mounts the studio. |

**A take** is `[name, stage, kind, beats, trim, freeze?]`.
- `stage` is which world it happens in; `"both"` is a split screen, with each half showing the middle of its own world.
- `kind` picks the shot recipe in the rig.
- `trim` opens the take that many beats into its own action. `freeze` holds the picture from a beat of the action on.
- A take's moments (the hit, the launch) are counted in beats from its **untrimmed** start. `momentOf(shot, beats)` puts them on the timeline, so trimming a take never moves a hit off its beat.

**A shot recipe** (in the rig) gets `t`, the seconds into its action, and poses a car and a camera as pure functions of `t`. It never integrates over frames, so scrubbing, looping and slow motion are free. Anything a take breaks (floors off a building) goes through state that the studio resets on every loop and seek (`onReset`).

**Stages stay mounted.** Each world is its own canvas that never remounts: a cut only changes which one is visible. A mounted-and-dropped WebGL canvas loses its context after a few loops, so anything with a canvas stays mounted the whole film and hides when it's off.

**Shot recipes in the example rig.** The teaser uses `revback`, `drift`, `missile`, `cornersmash` and `jump`. These also work and are ready for a next film: `rev`, `topdrift`, `boost`, `arrival`, `aerial` and `invasion`. `finale` (a tower imploding) has a known limit, noted in the code: the smash store lets the tower float up as its floors go.

**To add a take:**
1. Add a `kind` and its recipe in the rig.
2. Add a line to `TAKES`.
3. Add its sounds and title (if any) on its moments.
4. Pick it in the studio, step through it beat by beat at 0.25×, and fix what the frames show.

## The craft

What we learned making the Towns teaser, mostly from Derek Lieu's trailer writing ([derek-lieu.com](https://www.derek-lieu.com/blog)) and from getting it wrong first.

**Story before takes.**
- A montage of features reads as a list. Sell the feeling, not the feature ([GDC: More Feelings, Fewer Features](https://www.gdcvault.com/play/1025673/More-Feelings-Fewer-Features-Showcasing)).
- Give the takes cause and effect and someone to root for.
- Decide first what the viewer should feel at the end. For Towns it was "I want to jump in and play."
- Structure: hook, then escalation, then climax, then logo, then a button (a short gag after the logo).

**Teaser vs trailer.**
- A teaser is one idea and withholds. Ours: a split-screen hook, three flashes of play cut at their peak, the car freezing mid-air as the music drops to silence, then the name and "coming soon".
- A trailer carries a story. Three skeletons that fit a game with two rival sides:
  - **Invasion:** one protagonist crosses into the rival world, which is the act break. Escalating chaos, an escape, the logo, and a button where the rival shows up in your world.
  - **Grudge match:** call and response. One side acts, the other answers, the exchanges get shorter, and it ends on a freeze.
  - **Scoreboard:** a running score replaces the title cards and ticks once more after the logo.

**Text.**
- One-word cards per take (DRIFT, FIRE…) are feature cards in disguise.
- Use 3–4 cards that carry the stakes, 2–4 words each, one bar on screen each.
- A teaser can go with none at all.

**Cutting.**
- Each take is 1–2.4s and opens in the action (`trim`). The action lands on a beat of the music.
- Keep screen direction across a cut: if the cars leave going away from the camera, the next take shouldn't come at it.
- When a take is too short, rethink how it opens. Don't just let it run longer at the end.
- Show a mechanic twice, three times at most.

**The end card.**
- Cut hard to black on the last hit.
- Then the name alone in the middle, with nothing around it.
- The sub-title arrives after it, small, like a stamp (the way a sequel's "2" lands on its logo).
- One small spaced line ("coming soon").
- A button: here the game's car bumps into the Y, which wobbles and stays up, and it honks.
- No footers, chips, frames or URLs: the post carries the link. A social card is not a film ending; use it for its colors and type, not its layout.
- Motion is stepped (pixel art has no easing), and every move lands on a beat and a sound.

**Cameras that worked** (see the rig):

| Shot | Camera |
|---|---|
| Burnout | Low and close behind each car, split screen, then the launch |
| Drift | Chase camera whose heading lags a quarter second, so the car slides across the lens and shows its flank |
| Missile | Low behind and to the side of the shooter, moving with both cars |
| Smash | Chase camera through a building's corner, with the chunks scaled down so they don't fill the frame |
| Jump | Low and wide beside the ramp's lip, the car crossing the sky |
| Top-down | High and a little behind, turning with the car |

Before calling a shot done, check that nothing sits between the camera and the subject.

**Pitfalls that cost us time**
- Particles and destruction must only advance while the clock moves, or a paused frame fills up with smoke.
- Screenshot a shot beat by beat before showing it, and look at every frame: the missile take once silently lost its code, and the capture showed an empty street.
- Remotion's `Freeze` clamps to the composition's length (we started with Remotion and dropped it for live recording).
- In a timeline file, a constant used before it's declared breaks the page at runtime, not at build time.
- A raw `<script>` in the root layout trips React 19 in dev.

## Recording

Any screen recorder works: the studio's Record plays the film full window with no cursor. The rest of this section is the macOS setup we used.

To record the game itself outside the studio, add `?capture=1` to any page. It hides everything but the 3D scene, and a town replays its arrival intro on every load. `?capture=hud` hides only the cursor.

1. `BROWSER="Brave Browser" tools/trailer/capture.sh http://localhost:3001/trailer/towns` opens a clean window: its own profile, no address bar, a 1280×720 page. The default browser is Chrome.
2. In OBS:
   - **Source:** macOS Screen Capture → Window → that window, with "Show cursor" off. Crop 16 px left and right, 74 px top and 10 px bottom, which gives 2560×1440 at 2×.
   - **Video:** 2560×1440 (or 1920×1080), 60 FPS.
   - **Output:** MOV, Apple VT HEVC hardware, 60–80 Mbps, keyframe every 1s.
   - **Sound:** add an application audio capture of the browser if you want the music and effects in the file.
3. Start recording in OBS, press Shift R in the studio, and stop when the card goes black.

## Music and sound effects

- `music.mjs` is a tiny synthesizer: kick, snare, hats, a detuned saw bass, pad, arpeggio and lead, with sidechain ducking and an echo.
- Arrangements are functions of beats, so a new BPM retimes everything. The film's timeline has to use the same BPM (`BPM` in the film file).
- The `soon` cut shows how to shape a track around a film: a hard gate to silence on the freeze, and the end card's hits (stamp, thud, stab) on its beats.
- `sfx.mjs` makes the effects the game doesn't ship. The game's own skid and impact live in `public/sounds/drive`.
- Nothing here needs samples or a license. The generated files are gitignored; `npm run trailer:audio` rebuilds them.

## Licenses

The kit is part of Git City and under its AGPL-3.0 license. The music and effects are synthesized by the scripts here, with no samples, so they carry no third-party rights. The game sounds the example uses (skid, impact) and the car model are Kenney's, CC0 (see the repo's CLAUDE.md, "Third-party Assets"). Footage you record of your own game is yours.
