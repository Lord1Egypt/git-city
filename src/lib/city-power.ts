// The city's power grid, for the home intro: buildings farther than `radius`
// from (x, z) have their windows off. The building shader reads it every
// frame; Infinity (the default) means everything is on.
export const cityPower = { x: 0, z: 0, radius: Infinity };
