// Shared geometry for the San Francisco civic plaza at downtown, which holds
// the Town of the week monument.
//
// Two places derive plaza positions from these numbers and MUST agree:
//   - CityCanvas.tsx — renders the 3D plaza group.
//   - home-client.tsx — computes camera focus targets on the plaza.
// Keep the single source of truth here so a tweak can't silently desync them.

/** The whole plaza is rendered inside a group scaled by this factor. */
export const SF_PLAZA_SCALE = 0.55;

/**
 * World position of the plaza centre (the town monument mount point).
 * With the SF map the plaza group sits at `downtown`; without it the plaza is
 * centred on the world origin. `localY` is a height in plaza-local units and
 * is scaled like the plaza group when the map is on.
 */
export function plazaCenterWorld(
  downtown: [number, number] | null | undefined,
  localY = 0,
): [number, number, number] {
  if (!downtown) return [0, localY, 0];
  return [downtown[0], localY * SF_PLAZA_SCALE, downtown[1]];
}
