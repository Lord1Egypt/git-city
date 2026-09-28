---
name: game-trailer
description: Make a web game's trailer or teaser played live in the game's own engine and screen-recorded, from story to end card, with the trailer kit bundled in this skill (a beat-grid film format, a studio page, titles, an end card, synthesized music and effects). Use when someone asks for a trailer, teaser, launch video, "coming soon" clip, gameplay montage, end card or logo reveal for a React web game (React Three Fiber, canvas or DOM), or wants to add or fix a take in a trailer studio.
---

# Game trailer

The film is data played by the studio in the real engine, then recorded in one clean pass. The kit ships with this skill in `kit/` (MIT): its API and the craft notes are in `kit/README.md`, read it first. This skill is the order of work, and the rules that each cost a round of rework when they were skipped.

## 0. Set up the kit (a project that doesn't have it yet)

If the project has no `Studio` from this kit yet:
- Copy `kit/src/` into the app (for example `src/trailer-kit/`) and `kit/tools/` next to its scripts. Keep `kit/LICENSE` with the copy.
- Mount `kit/src/examples/MinimalFilm.tsx` on a route (in Next.js, a `page.tsx` under `app/trailer/`), start the dev server, and check that the studio plays.
- Match the studio to the game with the `--tk-*` variables (`kit/README.md`, "Styling").
- New films start as a copy of the minimal film, with the game's own scene as the stages.

Git City already has it (`@trailer-kit/*`, examples at `/trailer/minimal`, `/trailer/demo`, `/trailer/towns`).

## 1. The idea is the owner's

Before writing any script, ask what the viewer should feel at the end ("I want to jump in and play", "pick a side", …) and whether it's a teaser or a launch trailer. Don't infer it from the footage or the code.

**Why:** the first cut failed on this. It was a feature montage with no point of view.

## 2. Research, then propose two or three scripts

Research the craft for this kind of video before proposing (Derek Lieu's blog; the relevant games' trailers). Then offer 2–3 scripts as tables: time, picture, title card, sound. Recommend one and say why.
- **A teaser is one idea and withholds.** A split-screen hook, a few flashes cut at their peak, a freeze with the music dropping to silence, then the name.
- **A trailer carries a story:** protagonist, escalation, climax, logo, and a button.
- **Titles carry stakes, not verbs.** "DRIFT / FIRE" cards are feature cards. Use 3–4 cards at most, or none in a teaser.

Save the scripts that aren't used for the next launch.

## 3. Build scene by scene, with the owner watching

Keep a dev server running and build one take at a time in the studio (a new film starts as a copy of the minimal film). Before handing any take over, step through it beat by beat at 0.25× (Home, Shift+→) and look at every screenshot. Fix what they show, and say what you fixed.

**Why:** the owner can't see anything until it's on screen. Several "done" takes were broken (a lost branch, an empty street, a car hidden behind a wall) and only the frames showed it.

## 4. Cutting rules the owner corrected

- **Open in the action**, with `trim`. Put the hit on a beat of the music.
- **Keep screen direction across a cut.** If the cars leave going away from the camera, the next take doesn't come toward it.
- **"Make it longer" means rethink how the take opens.** Never just let it run on at the end.
- **When a camera change is rejected, go back** to the version that worked. Don't invent a third one.
- **Nothing between the camera and the subject.** Check the line of sight against the map before calling a shot done.

## 5. The end card is a film ending, not a web page

- Hard cut to black on the last hit.
- The game's name alone, big, centred.
- The feature name lands after it, small, like a stamp (the way a sequel's "2" arrives).
- One small spaced line ("coming soon").
- A short button gag: the game's own car hitting a letter, which stays up and gets a honk.
- Stepped pixel motion, every move on a beat with its own sound.
- No footer, chips, frames or URL.

A reference the owner shows (a social card, a profile) is for colors and type only. **Don't copy its layout.**

## 6. Sound

Generate music and effects with `kit/tools/music.mjs` and `sfx.mjs` (in Git City: `npm run trailer:audio`), with the BPM matching the film's.
- Give every visual hit a sound: skid on drifts, whoosh and explosion on the missile, a thud on the stamp.
- Put silence right before the name.
- Rebuild a sound the owner calls bad from scratch; don't just re-pitch it.

## 7. Recording

Walk the owner through `capture.sh`, OBS (window capture, no cursor, the crop from the README, 60 fps), then Shift R in the studio.

## Engine pitfalls (so they don't recur)

- **Anything with a canvas stays mounted the whole film.** Remounting drops the WebGL context within a few loops.
- **Shot recipes are pure functions of `t`**, and particles only emit while the clock moves, so a paused frame stays clean.
- **Declare timeline constants before use.** Lists built at module load (sounds, flashes) fail at runtime, not at build.
- **Reset what a take breaks** through `onReset` (the studio calls it on pick, loop, seek back and record).
- **Record at 1×.** Sound only plays at 1×, and a few effects run on real time.
