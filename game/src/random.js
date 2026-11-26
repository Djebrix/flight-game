// Seeded random numbers: the valley, the ring course and the weather are
// identical on every run, so the game is deterministic and replayable.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic value noise in [0, 1) from an integer coordinate. */
export function hash1(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** Smooth 1-D value noise over coordinate x with the given wavelength. */
export function smoothNoise(x, wavelength) {
  const i = Math.floor(x / wavelength);
  const f = x / wavelength - i;
  const a = hash1(i);
  const b = hash1(i + 1);
  const u = f * f * (3 - 2 * f);
  return a + (b - a) * u;
}

/** Pick a value from `values` by seeded index. */
export function pick(rng, values) {
  return values[Math.floor(rng() * values.length)];
}
