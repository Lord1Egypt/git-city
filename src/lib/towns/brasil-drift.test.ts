import { describe, expect, it } from "vitest";
import { LOT } from "../league-city/grid";
import { M_TO_UNIT } from "../league-city/drive/tuning";
import { wallOffset } from "../league-city/race/track";
import { courseOf, getLiveSpot } from "../drift/spots";
import { sceneryFor } from "../drift/scenery";
import { BrasilPlacer, STATES, layoutBrasil, type MapDev } from "./brasil-map";
import { brasilWorld, plainBuilding } from "./brasil-world";
import { pointAt } from "../league-city/race/track";
import { DRIFT_EXIT, DRIFT_SIGN_LOT, DRIFT_SITE, clearOfStart, crossedStart, inDriftSite } from "./brasil-drift";
import { coastDistance, onLand } from "./brasil-geo";

const spot = getLiveSpot("brasil-harbor")!;
const { track, clips } = courseOf(spot);
/** Meters to the lot under them. */
const lotOf = (x: number, z: number) => [Math.round((x * M_TO_UNIT) / LOT), Math.round((z * M_TO_UNIT) / LOT)] as const;

describe("the Brasil drift site", () => {
  it("is open land, clear of the coast", () => {
    for (let x = DRIFT_SITE.x0; x <= DRIFT_SITE.x1; x++)
      for (let z = DRIFT_SITE.z0; z <= DRIFT_SITE.z1; z++) {
        expect(onLand(x * LOT, z * LOT)).toBe(true);
        expect(coastDistance(x * LOT, z * LOT)).toBeGreaterThan(LOT);
      }
    for (const [x, z] of [DRIFT_SIGN_LOT, [DRIFT_EXIT.x, DRIFT_EXIT.z]]) {
      expect(onLand(x * LOT, z * LOT)).toBe(true);
      expect(inDriftSite(x, z)).toBe(false);
    }
  });

  it("puts the sign and the exit by the START gate", () => {
    const line = pointAt(track, 0);
    const [lx, lz] = lotOf(line.x, line.z);
    expect(Math.hypot(DRIFT_SIGN_LOT[0] - lx, DRIFT_SIGN_LOT[1] - lz)).toBeLessThan(5);
    expect(Math.hypot(DRIFT_EXIT.x - lx, DRIFT_EXIT.z - lz)).toBeLessThan(5);
  });

  it("holds the whole track, its walls and its scenery", () => {
    const w = wallOffset(track.spec) + track.spec.wallThickness;
    for (const p of track.samples) {
      for (const side of [1, -1]) {
        const [x, z] = lotOf(p.x + p.tz * side * w, p.z - p.tx * side * w);
        expect(inDriftSite(x, z)).toBe(true);
      }
    }
    for (const it of sceneryFor(spot.id, track, clips)) expect(inDriftSite(...lotOf(it.x, it.z))).toBe(true);
  });

  it("keeps cities, highways, avenues and trees off it, however full the states get", () => {
    let id = 0;
    const devs: MapDev[] = STATES.flatMap((s) => Array.from({ length: ["SP", "RJ", "MG"].includes(s.uf) ? 400 : 20 }, () => ({ id: ++id, login: `d${id}`, uf: s.uf })));
    const layout = layoutBrasil(devs);
    for (const c of [...layout.cities, layout.island]) {
      for (const d of c.devs) expect(inDriftSite(d.x, d.z)).toBe(false);
      for (const [x, z] of c.roads) expect(inDriftSite(x, z)).toBe(false);
    }
    for (const [x, z] of layout.highways) expect(inDriftSite(x, z)).toBe(false);
    const { objects } = brasilWorld(layout, (d) => plainBuilding(d.login));
    for (const o of objects) expect(inDriftSite(o.x, o.z)).toBe(false);
    // A placer started from those residents still never picks a lot there.
    expect(new BrasilPlacer().place({ id: -1, login: "x", uf: "SP" })).not.toBeNull();
  });
});

describe("the START gate", () => {
  const line = pointAt(track, 0);
  /** A point `along` m down the track from the line and `lat` m to its left, in units. */
  const at = (along: number, lat: number) => ({ x: (line.x + line.tx * along + line.tz * lat) * M_TO_UNIT, z: (line.z + line.tz * along - line.tx * lat) * M_TO_UNIT });

  it("takes a car driving across the line, either way", () => {
    expect(crossedStart(track, at(-2, 0), at(1.5, 0))).toBe(true);
    expect(crossedStart(track, at(2, 3), at(-1, 3))).toBe(true);
  });

  it("lets a car by when it passes beside the asphalt, stays on one side, or jumps there", () => {
    expect(crossedStart(track, at(-2, 12), at(2, 12))).toBe(false);
    expect(crossedStart(track, at(-6, 0), at(-3, 0))).toBe(false);
    expect(crossedStart(track, at(-80, 0), at(1, 0))).toBe(false);
  });

  it("takes the car again only once it has driven off the gate", () => {
    const [x, z] = [DRIFT_EXIT.x * LOT, DRIFT_EXIT.z * LOT];
    expect(clearOfStart(track, at(0, 0))).toBe(false);
    expect(clearOfStart(track, { x, z })).toBe(true);
  });
});
