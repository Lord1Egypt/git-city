# Trailer kit

Make your web game's trailer inside the game itself, or your library's or app's launch film inside the real product. A film is data (takes on the music's beat grid), a studio page plays it live in your engine, and the export renders it frame by frame to an mp4, music included. No video editor, no screen recorder.

It came out of making the [Git City](https://thegitcity.com) Towns teaser, and it ships inside the `gg` Claude skill ("You made a game. gg."), so Claude can set it up in your project and build the film with you. MIT licensed (see `LICENSE`).

## Install

```bash
npx skills add srizzon/git-city --skill gg
```

Then tell Claude "let's /gg this". The skill studies your project and films like it, picks a visual direction for yours, copies this kit in and builds the film in that direction.

To set it up by hand, copy `src/` (without `examples/gitcity/`) into your app (for example `src/trailer-kit/`), copy `tools/` anywhere, and mount `src/examples/MinimalFilm.tsx` on a page. The studio needs React 18+ and nothing else: no Tailwind, no three.js (your pictures can use them). The export needs Playwright and ffmpeg (see "Export"). In Next.js App Router the components are client components already.

## What's here

| File | What it is |
|---|---|
| `src/clock.ts` | The clock every shot reads, in beats from the first frame. Never frame deltas: that's what keeps cuts on the beat. |
| `src/film.ts` | The film as data: takes, shots, moments, scenes, sounds, titles, flashes. Pure, no React. |
| `src/film.test.ts` | Its tests (vitest). |
| `src/Studio.tsx` | The editor. Plays any `Film`; the pictures come from its children, the title cards from its `titles` slot. |
| `src/examples/MinimalFilm.tsx` | The smallest film, in plain HTML, with no look on purpose. The template for your own. |
| `src/examples/gitcity/` | Git City's titles (a word on a slanted bar) and end card (the name stamped on, a stamp after it). One project's treatment, to read as an example, not to reuse. |
| `tools/music.mjs` | A tiny synthesizer that writes the film's music at its BPM, from a brief or an arrangement. |
| `tools/arrangements/` | `brief.mjs` (a song from a JSON brief), `gitcity.mjs` (Git City's synthwave, an example), and how to write your own. |
| `tools/sfx.mjs` | Synthesized effects: explosion, whoosh, crumble, key click, horn. |
| `tools/export.mjs` | Renders a film from the studio to an mp4, frame by frame, with its sound mixed in. |
| `tools/capture.sh` | macOS: opens a clean browser window, for recording by hand. |

**Styling.** The studio carries its own CSS. To match your project, give it a `className` that sets the variables: `--tk-font`, `--tk-bg`, `--tk-panel`, `--tk-line`, `--tk-line-hi`, `--tk-text`, `--tk-muted`, `--tk-accent`, `--tk-rec`, and `--tk-flash` (the color of `film.flashes`). That CSS styles the editor only: the stage inherits nothing from it but the font, so your components and buttons on it keep their own styles.

**Titles.** `film.titles` says when each card is on and where (`place`); how it looks is yours. Pass a renderer: `<Studio titles={(cues) => <MyTitles cues={cues} />}>`, drawn over the stage in container units (`cqw`) so it scales. Without one, titles don't show.

## The studio

A 16:9 stage, play and scene-to-scene buttons, a ruler to scrub (its marks are the cuts), the scenes on the right (a picked scene loops), slow motion, volume, and Export mp4 at the top, which copies the export command for this page. Keys:

| Key | Does |
|---|---|
| Space | Play / pause |
| ← → | One frame (Shift: one beat) |
| J L | One second |
| Home End | Scene start / end |
| 1–9, 0 | Pick a scene, the whole film |
| [ ] | Slower / faster (1×, 0.5×, 0.25×) |
| - + | Volume down / up (the studio's only: the export mixes at full level) |
| M | Mute |
| Shift R | Record by hand: full window, no cursor, 1s of black, the whole film once |
| Esc | Stop recording |

## How a film is built

**A take** is `[name, stage, kind, beats, trim, freeze?]`.
- `stage` is which world it happens in; `"both"` is a split screen, with each half showing the middle of its own world.
- `kind` picks the shot recipe that draws it.
- `trim` opens the take that many beats into its own action. `freeze` holds the picture from a beat of the action on.
- A take's moments (the hit, the launch) are counted in beats from its **untrimmed** start. `momentOf(shot, beats)` puts them on the timeline, so trimming a take never moves a hit off its beat.

**A shot recipe** gets `t`, the seconds into its action, and places things as functions of `t`. That's what makes scrubbing, looping and slow motion show the same picture. Anything with memory (particles, destruction) only advances while the clock moves, or a paused frame fills up with smoke. Events that fire when a beat is crossed fire while playing forward, not when you scrub past them.

Anything a take breaks lives in state the studio resets through `onReset`: when a take is picked, when it loops, when you seek backwards, and when a recording or an export starts.

**Sound only plays at 1×.** At 0.5× and 0.25× the studio is silent: music and effects are synced to real time. (The export doesn't care: it mixes the sound from the film's cues.)

**Stages stay mounted.** Each world is its own element (or canvas) that never remounts: a cut only changes which one is visible. A WebGL canvas that's mounted and dropped loses its context after a few loops. The end card's `button` slot follows the same rule.

### A film of your own

Copy `src/examples/MinimalFilm.tsx` and change five things:
1. **The BPM and the takes.** Pick the BPM your music will use, then write the takes on that beat grid.
2. **The stages.** One per world or scene; a `"both"` take shows them side by side.
3. **The pictures.** Replace `DemoStage` with your own: DOM, a canvas, your game's scene. Each frame it reads `shotFor(SHOTS, stage, beatOf(clock), BEAT)` and draws the shot at time `t`.
4. **The film object.** Its scenes, sounds, titles, flashes, and `song` if you have music (a file in `public/`).
5. **The look.** Replace `PlainTitles` with titles designed for your project, and add an end card of your own. The film's direction (type, palette, motion, sound) comes from your project and launch films like it, not from this template or from Git City's.

**To add a take:**
1. Add its `kind`, and write its recipe.
2. Add a line to `TAKES`.
3. Put its sounds and title on its moments, with `momentOf`.
4. Pick it in the studio, step through it beat by beat at 0.25×, and fix what the frames show.

### Examples in Git City

The kit lives in Git City's repo, and Git City plays three films with it (all under `src/app/trailer/`):
- `/trailer/minimal`: `src/examples/MinimalFilm.tsx`, straight from this kit.
- Both films below use Git City's own direction (`src/examples/gitcity/` and `tools/arrangements/gitcity.mjs`): pixel type, stepped motion, a stamp, 8-bit hits and synthwave, because that's Git City's language. Yours gets its own.
- `/trailer/demo`: a 3D street made in code (day and night), the game's car, a burnout on a split screen, a drift, a jump that freezes mid-air, and the end card with the car as its button. Runs on any fork, no data.
- `/trailer/towns`: the Towns "coming soon" teaser, in the game's real towns.

## The craft

What we learned making the Towns teaser, mostly from Derek Lieu's trailer writing ([derek-lieu.com](https://www.derek-lieu.com/blog)) and from getting it wrong first. These are principles; how each looks in your film comes from your project's direction.

**Direction before story.**
- Study the project first: brand, logo, palette, type, how its UI moves, its copy. Then watch launch films of products like it (a UI library: Linear, Vercel, shadcn/ui, Raycast, Framer; a game: trailers in its genre).
- Derive the direction from those: type and its motion, palette, how titles appear, how the end card lands, the hits, the music. Write it down before the takes.
- Not a game? The engine is the real product UI: the actual components and screens, driven by code as functions of `t`.

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
- Before calling a shot done, check that nothing sits between the camera and the subject.

**The end card.**
- Cut hard to the card on the last hit, after a moment of silence.
- Then the name alone, with nothing around it.
- At most one short line ("coming soon", "v2 is out") and an optional button (a short gag after the logo).
- No footers, chips, frames or URLs: the post carries the link. A social card is not a film ending; use it for its colors and type, not its layout.
- Every move lands on a beat and a sound. Its motion is the project's: eased for a UI that eases, stepped for pixel art.
- Git City's, as one example: black, the name stamped on letter by letter in pixel type, the sub-title stamped on its corner like a sequel's "2", a spaced line, then the game's car bumps the Y, which wobbles, and honks.

**Cameras that worked** (Git City's `TownsRig` and `DemoRig`):

| Shot | Camera |
|---|---|
| Burnout | Low and close behind each car, split screen, then the launch |
| Drift | Chase camera whose heading lags a quarter second, so the car slides across the lens and shows its flank |
| Missile | Low behind and to the side of the shooter, moving with both cars |
| Smash | Chase camera through a building's corner, with the chunks scaled down so they don't fill the frame |
| Jump | Low beside the ramp's lip, the car crossing the frame, the lens closing in as it leaves the ramp |
| Top-down | High and a little behind, turning with the car |

**Pitfalls that cost us time.**
- Screenshot a shot beat by beat before showing it, and look at every frame: a take once silently lost its code, and only the capture showed the empty street.
- A custom shader that fails can draw nothing with no error. Check that the thing is on screen, not just that the page loads.
- In a timeline file, a constant used before it's declared breaks the page at runtime, not at build time.
- A raw `<script>` in a Next.js root layout trips React 19 in dev.
- Remotion's `Freeze` clamps to the composition's length (we started with Remotion and dropped it for live recording).

## Export

```bash
npm i -D playwright && npx playwright install chromium   # once
brew install ffmpeg                                      # or npm i -D ffmpeg-static
node tools/export.mjs http://localhost:3000/your-film --poster 9.2
```

Add it to your scripts as `"trailer:export": "node <path>/tools/export.mjs"`: that's the command the studio's Export button copies.

- It opens the studio with `?export` in a headless browser. The studio waits (`window.__gg`), and the export swaps the page's clocks for a virtual one: `performance.now`, `Date.now`, `requestAnimationFrame`, timers and CSS animations. Each frame is drawn at its exact time and screenshotted, so a slow machine still gets every frame, and three.js, particles and titles all come out as they play in the studio.
- The sound isn't recorded: it's mixed from the film's `song` and `sounds`, so it lands on the same beats as the picture. Sounds your game plays by itself aren't in the file, so cue them in the film.
- `--poster <s>` picks the thumbnail: a settled frame (the name on the end card, a freeze). It's written as `trailer.jpg` and baked in as frame 0, which is what X, Slack and Discord show before the video plays.
- Options: `--out gg-output/trailer.mp4` (default), `--fps 30` (60 for fast motion), `--size 1920x1080`.
- A `<video>` inside the stage plays on real time, not the virtual clock, and randomness that isn't seeded changes between runs.

## Recording by hand

The export is the way to go. If you'd rather use a screen recorder, the studio's Record plays the film full window with no cursor. The rest is the macOS setup we used.

1. `BROWSER="Brave Browser" tools/capture.sh http://localhost:3000/your-film` opens a clean window: its own profile, no address bar, a 1280×720 page. The default browser is Chrome.
   - It sizes the window through System Events, so your terminal needs macOS Accessibility permission.
   - It moves every window of that browser whose title doesn't end the way your everyday windows do (" - Google Chrome", " - Brave"). Close other app-mode windows of that browser first.
2. In OBS:
   - **Source:** macOS Screen Capture → Window → that window, with "Show cursor" off. Crop 16 px left and right, 74 px top and 10 px bottom, which gives 2560×1440 at 2×.
   - **Video:** 2560×1440 (or 1920×1080), 60 FPS.
   - **Output:** MOV, Apple VT HEVC hardware, 60–80 Mbps, keyframe every 1s.
   - **Sound:** add an application audio capture of the browser if you want the music and effects in the file.
3. Start recording in OBS, press Shift R in the studio, and stop when the card goes black.

## Music and sound effects

- `node tools/music.mjs public/trailer/song.wav song.json`: a song from a brief (tempo, key, drums, bass, harmony, timbre, the hits on the end card's beats). The fields are in `tools/arrangements/README.md`, with starting points per direction.
- `node tools/music.mjs public/trailer/song.wav ./song.mjs [cut]`: an arrangement module of your own, for what a brief can't say. The synth: kick, snare, hats, crash, a tone voice (saw, square, pulse, triangle, sine), a lead, risers and impacts, with sidechain ducking and an echo.
- Arrangements are functions of beats, so a new BPM retimes everything. The film has to use the same BPM.
- `tools/arrangements/gitcity.mjs` is Git City's arcade synthwave (`full`, and the teaser cuts `soon` and `demo`). It's an example of one project's sound; write yours.
- `node tools/sfx.mjs public/trailer/sfx` writes the effects. Use your game's own sounds for the rest.
- Nothing here needs samples or a license: the output is yours.

## License

MIT, for everything in this folder (the rest of Git City is AGPL-3.0). Git City's films use the game's own assets, which aren't part of the kit: Kenney's car and sounds (CC0).
