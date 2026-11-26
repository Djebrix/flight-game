// The sortie: one state machine for the whole flight — take-off, twelve
// rings over the valley, a landing at North Runway — plus scoring, fuel,
// damage and the messages the pilot sees. Deterministic: fixed step, fixed
// seed, no wall-clock input to the rules.
import { COURSE, PHASE, PLANE, SCORE, SCREEN } from './config.js';
import { buildRings, buildValley } from './terrain.js';
import { checkTouchdown, clamp, createPlane, isOnRunway, onFinalApproach, stepPlane } from './plane.js';

export const STEP = 1 / 60;

export function createWorld() {
  const valley = buildValley();
  const rings = buildRings();
  return {
    screen: SCREEN.title,
    phase: PHASE.takeoff,
    plane: createPlane(),
    valley,
    rings,
    score: 0,
    ringsPassed: 0,
    time: 0,
    message: '',
    messageUntil: 0,
    best: 0,
    crashReason: '',
    landingQuality: 0,
    elapsed: 0,
    // Autopilot only drives the screenshot scenes; the live game never uses it.
    autopilot: false,
  };
}

export function resetWorld(world) {
  const fresh = createWorld();
  fresh.best = world.best;
  Object.assign(world, fresh);
}

export function showMessage(world, text, seconds) {
  world.message = text;
  world.messageUntil = world.time + seconds;
}

/** The ring the pilot is flying toward next, or null once all are resolved. */
export function nextRing(world) {
  for (let i = 0; i < world.rings.length; i += 1) {
    if (!world.rings[i].done) return world.rings[i];
  }
  return null;
}

/** Distance to the next objective, in metres, for the HUD. */
export function distanceToObjective(world) {
  const ring = nextRing(world);
  if (ring) return Math.max(0, Math.round(ring.s - world.plane.s));
  return Math.max(0, Math.round(COURSE.runwayNorth.start - world.plane.s));
}

/** Start the sortie from the title screen. */
export function startSortie(world) {
  world.screen = SCREEN.play;
  world.phase = PHASE.takeoff;
  showMessage(world, 'SOUTH RUNWAY — THROTTLE UP, ROTATE AT 34 m/s', 5);
}

/**
 * One fixed rules step. `input` is { pitch, roll, throttle, brake }.
 * Returns an event string ('liftoff' | 'ring' | 'landed' | 'crash' | null).
 */
export function stepWorld(world, input, dt) {
  if (world.screen !== SCREEN.play) return null;
  world.time += dt;
  world.elapsed += dt;
  const p = world.plane;

  const event = stepPlane(p, input, dt);
  if (event === 'liftoff') {
    world.phase = PHASE.rings;
    showMessage(world, 'AIRBORNE — FLY THE 12 RINGS', 6);
    return 'liftoff';
  }

  // Ring capture: inside the ring's disc while crossing its plane.
  const ring = nextRing(world);
  if (ring && !p.onGround) {
    const prevS = p.s - p.speed * dt;
    if (prevS < ring.s && p.s >= ring.s) {
      const dx = p.x - ring.x;
      const dy = p.alt - ring.alt;
      const dist = Math.sqrt(dx * dx + dy * dy);
      ring.done = true;
      if (dist < ring.radius) {
        ring.passed = true;
        ring.centre = dist < ring.radius * 0.45;
        world.ringsPassed += 1;
        const gained = SCORE.ring + (ring.centre ? SCORE.ringCentreBonus : 0);
        world.score += gained;
        p.fuel = Math.min(PLANE.fuelCapacity, p.fuel + PLANE.ringFuelBonus);
        showMessage(world, ring.centre ? `RING ${world.ringsPassed}/12 — DEAD CENTRE! +${gained}  +FUEL` : `RING ${world.ringsPassed}/12  +${gained}  +FUEL`, 3);
        if (world.ringsPassed === COURSE.ringCount) {
          world.phase = PHASE.approach;
          showMessage(world, 'ALL RINGS — NORTH RUNWAY AHEAD, GEAR DOWN, SLOW TO 40', 6);
        }
        return 'ring';
      }
      showMessage(world, `MISSED RING ${ring.index + 1} — PRESS ON`, 3);
      if (world.rings.every((r) => r.done)) {
        world.phase = PHASE.approach;
        showMessage(world, 'COURSE DONE — NORTH RUNWAY AHEAD', 6);
      }
    }
  }

  // Touchdown: only when genuinely descending onto the ground — a plane
  // that has just lifted off sits at alt ~0 for a step or two and must not
  // count as landed. A runway landing ends the sortie, anything else ends it.
  if (!p.onGround && p.alt <= 0.5 && p.verticalSpeed < -0.5) {
    const result = checkTouchdown(p);
    if (result === 'landed') {
      const smooth = clamp(1 - Math.abs(p.verticalSpeed) / 7, 0, 1) * clamp(1 - Math.abs(p.roll), 0, 1);
      world.landingQuality = smooth;
      const landingScore = SCORE.landingBase + Math.round(SCORE.landingSmoothBonus * smooth);
      world.score += landingScore;
      const timeBonus = Math.max(0, Math.round((SCORE.parTimeSeconds - world.elapsed) * SCORE.timeBonusPerSecond));
      world.score += timeBonus;
      world.phase = PHASE.done;
      world.screen = SCREEN.landed;
      world.best = Math.max(world.best, world.score);
      showMessage(world, `LANDED — +${landingScore} LANDING, +${timeBonus} TIME BONUS`, 8);
      return 'landed';
    }
    if (result === 'crash') {
      return crashWorld(world, 'TOUCHED DOWN OFF THE RUNWAY');
    }
  }

  // Ground strike while flying low, fuel starvation, or flying past the valley.
  if (!p.onGround && p.alt <= 0 && !isOnRunway(p.s, p.x)) return crashWorld(world, 'TERRAIN STRIKE');
  if (p.fuel <= 0 && p.alt <= 0.5 && !p.onGround) return crashWorld(world, 'OUT OF FUEL');
  if (p.s > COURSE.length + 400) return crashWorld(world, 'FLEW PAST THE VALLEY');
  if (p.speed < PLANE.stallSpeed && !p.onGround && p.alt < 12) {
    showMessage(world, 'STALL WARNING — NOSE DOWN, THROTTLE UP', 1.5);
  }
  if (world.phase === PHASE.approach && onFinalApproach(p) && p.alt < 120) {
    world.phase = PHASE.landing;
  }
  return null;
}

/** End the sortie as a crash with a reason the debrief can show. */
export function crashWorld(world, reason) {
  world.screen = SCREEN.over;
  world.crashReason = reason;
  world.best = Math.max(world.best, world.score);
  return 'crash';
}

/**
 * Autopilot for the screenshot scenes: a PD controller that steers toward
 * the next ring or the runway centreline, holds speed, and flares before
 * touchdown. Pure function of the world — deterministic, no randomness.
 */
export function autopilotInput(world) {
  const p = world.plane;
  const input = { pitch: 0, roll: 0, throttle: null, brake: false };
  const ring = nextRing(world);
  let targetX = COURSE.runwayNorth.x;
  let targetAlt = 90;
  let targetSpeed = 66;
  if (world.phase === PHASE.takeoff || p.onGround) {
    targetX = COURSE.runwaySouth.x;
    targetAlt = 0;
    targetSpeed = 66;
    input.throttle = 1;
    if (p.speed >= 40) input.pitch = 0.5;
    return input;
  }
  if (ring) {
    targetX = ring.x;
    targetAlt = ring.alt;
    targetSpeed = 66;
  } else {
    // Final approach: line up on a steady ~5-degree glide slope to the
    // runway surface; the flare below only arrests a hard sink, it never
    // holds the plane up.
    const dist = COURSE.runwayNorth.start - p.s;
    targetX = COURSE.runwayNorth.x;
    if (dist > 600) { targetAlt = 80; targetSpeed = 52; }
    else { targetAlt = dist * 0.09; targetSpeed = 40; }
  }
  // Lateral: pick the heading that closes the gap, then bank to hold it.
  // The lateral speed must close up to ~150 m of offset inside one leg
  // (~13 s between rings), so the gain is deliberately strong.
  const dx = targetX - p.x;
  const vxDesired = clamp(dx * 0.35, -28, 28);
  const headingDesired = clamp(-vxDesired / Math.max(20, p.speed), -0.45, 0.45);
  input.roll = clamp((p.heading - headingDesired) * 2.2 - p.roll * 0.25, -1, 1);
  // Vertical: pick the climb rate that closes the altitude gap, then pitch
  // to it. The flight model scales the pitch input by 0.42, so the input is
  // the desired pitch divided by that factor. The final approach uses a
  // stronger gain so the glide slope is actually held.
  const dAlt = targetAlt - p.alt;
  const vsDesired = clamp(dAlt * (ring ? 0.3 : 0.5), -12, 12);
  const pitchDesired = clamp(Math.asin(clamp(vsDesired / Math.max(20, p.speed), -1, 1)), -0.6, 0.6);
  input.pitch = clamp(pitchDesired / 0.42, -0.9, 0.9);
  if (p.alt < 2.5 && !ring && p.verticalSpeed < -2.5) input.pitch = Math.max(input.pitch, 0.2);
  // Throttle holds the target speed.
  input.throttle = clamp(0.5 + (targetSpeed - p.speed) * 0.025, 0, 1);
  if (p.onGround && p.speed > 45) input.brake = true;
  return input;
}
