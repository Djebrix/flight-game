// The Meridian valley: a deterministic river valley the course flies over.
// Everything here is pure data derived from the fixed seed — fields, river,
// road, trees, houses, clouds and the distant ridge — so the world is the
// same on every run and the screenshots always show the same valley.
import { COURSE, WORLD } from './config.js';
import { hash1, mulberry32, pick, smoothNoise } from './random.js';

// Field palette: one valley, one style — late-afternoon greens and golds.
export const FIELD_COLORS = ['#6f9e4a', '#7fae54', '#c2a44f', '#8fae4e', '#5d8f43', '#b3923f'];
export const FIELD_DARK = ['#5c8440', '#6b9348', '#a3863f', '#76933f', '#4d7838', '#967d33'];
export const TREE_COLORS = ['#2f6b2a', '#3a7d33', '#276023'];
export const HOUSE_COLORS = ['#c96f4a', '#d9a05b', '#e8d9b0', '#b8574a', '#7d8aa0'];

/** Lateral centre of the river at course distance s (metres). */
export function riverX(s) {
  return 170 * smoothNoise(s, 2600) - 85 + 60 * Math.sin(s / 900);
}

/** Lateral centre of the valley road at course distance s (metres). */
export function roadX(s) {
  return -190 + 90 * smoothNoise(s + 4000, 3200);
}

/** Ground elevation (metres) at course distance s — gentle valley floor. */
export function groundHeight(s) {
  return 6 * smoothNoise(s, 1800) + 3 * smoothNoise(s + 900, 700);
}

/** Patchwork colour of the field at longitudinal row `row`, lateral lane `lane`. */
export function fieldColor(row, lane) {
  const index = Math.floor(hash1(row * 31 + lane * 17) * FIELD_COLORS.length);
  return (row + lane) % 2 === 0 ? FIELD_COLORS[index] : FIELD_DARK[index];
}

/** Build the whole valley once from the seed. */
export function buildValley() {
  const rng = mulberry32(WORLD.seed);
  const segments = Math.ceil(COURSE.length / COURSE.segment);
  const trees = [];
  for (let i = 0; i < WORLD.treeCount; i += 1) {
    const s = 700 + rng() * (COURSE.length - 1400);
    // Keep trees clear of the runways and the river.
    if (s < 700 || (s > 10200 && s < 11200)) continue;
    const x = (rng() < 0.5 ? -1 : 1) * (60 + rng() * 340);
    if (Math.abs(x - riverX(s)) < 26) continue;
    trees.push({ s, x, size: 5 + rng() * 9, color: pick(rng, TREE_COLORS) });
  }
  const houses = [];
  for (let i = 0; i < WORLD.houseCount; i += 1) {
    const s = 1500 + rng() * (COURSE.length - 3000);
    const nearRoad = rng() < 0.7;
    const x = nearRoad ? roadX(s) + (rng() < 0.5 ? -1 : 1) * (18 + rng() * 26) : (rng() < 0.5 ? -1 : 1) * (90 + rng() * 260);
    houses.push({ s, x, w: 8 + rng() * 8, h: 5 + rng() * 5, color: pick(rng, HOUSE_COLORS), roof: pick(rng, ['#8a4a3a', '#5a6b7d', '#6b4a2f']) });
  }
  const clouds = [];
  for (let i = 0; i < WORLD.cloudCount; i += 1) {
    clouds.push({
      x: rng() * 2 - 1,
      y: 0.06 + rng() * 0.22,
      scale: 0.5 + rng() * 1.1,
      speed: 0.004 + rng() * 0.008,
      puffs: [0.5 + rng() * 0.5, 0.4 + rng() * 0.5, 0.45 + rng() * 0.5, 0.35 + rng() * 0.4],
    });
  }
  // Distant ridge silhouette: fixed peaks, drawn behind the horizon.
  const ridge = [];
  for (let i = 0; i <= 24; i += 1) {
    ridge.push(0.10 + 0.16 * smoothNoise(i * 340, 900) + 0.05 * smoothNoise(i * 340 + 500, 300));
  }
  return { trees, houses, clouds, ridge, segments };
}

/** The ring course: twelve rings, each with a lateral offset and an altitude. */
export function buildRings() {
  const rng = mulberry32(WORLD.seed + 77);
  const rings = [];
  for (let i = 0; i < COURSE.ringCount; i += 1) {
    const t = i / (COURSE.ringCount - 1);
    const s = COURSE.ringStart + t * (COURSE.ringEnd - COURSE.ringStart);
    const x = (i % 2 === 0 ? 1 : -1) * (30 + rng() * 110) * (1 - t * 0.4);
    const alt = 55 + 55 * Math.sin(t * Math.PI) + rng() * 25;
    rings.push({ index: i, s, x, alt, radius: 18, passed: false, done: false, centre: false });
  }
  return rings;
}
