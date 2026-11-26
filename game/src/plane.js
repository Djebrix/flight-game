// The aircraft: a single-engine bush plane ("Kestrel") and its flight model.
// Arcade physics with real trade-offs: throttle feeds speed, speed feeds lift,
// banking turns the nose, stalling sinks the plane, and fuel is a budget.
import { COURSE, PLANE } from './config.js';

export function createPlane() {
  return {
    // Course position: s along the valley, x lateral, alt above ground.
    s: 60,
    x: COURSE.runwaySouth.x,
    alt: 0,
    heading: 0, // radians, 0 = straight down the valley
    pitch: 0, // radians, positive = nose up
    roll: 0, // radians, positive = right wing down
    speed: 0,
    throttle: 0,
    fuel: PLANE.fuelCapacity,
    gearDown: true,
    flaps: false,
    onGround: true,
    verticalSpeed: 0,
    damage: 0,
  };
}

/** Clamp helper shared by the flight model. */
export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * Advance the plane one fixed step (dt seconds) under the given control
 * input: { pitch: -1..1, roll: -1..1, throttle: 0..1 (or null to hold),
 * brake: bool }. Returns an event string or null.
 */
export function stepPlane(plane, input, dt) {
  const p = plane;
  if (input.throttle !== null && input.throttle !== undefined) p.throttle = clamp(input.throttle, 0, 1);

  // Thrust vs drag: speed chases the throttle's target speed.
  const targetSpeed = p.throttle * PLANE.maxSpeed;
  const accel = (targetSpeed - p.speed) * PLANE.accelPerThrottle * dt * 0.12 - p.speed * PLANE.drag * dt;
  p.speed = Math.max(0, p.speed + accel);
  if (input.brake) p.speed = Math.max(0, p.speed - 22 * dt);

  // Banking turns the nose; the turn tightens with speed.
  const targetRoll = input.roll * 0.9;
  p.roll += (targetRoll - p.roll) * Math.min(1, dt * 3.2);
  p.heading += -p.roll * PLANE.turnRate * dt * (0.35 + 0.65 * Math.min(1, p.speed / 60));

  // Pitch follows the stick, damped; a stalled wing will not hold the nose up.
  const stalled = p.speed < PLANE.stallSpeed && !p.onGround;
  const targetPitch = input.pitch * 0.42 * (p.flaps ? 1.15 : 1);
  p.pitch += (targetPitch - p.pitch) * Math.min(1, dt * 2.6);
  const climb = stalled ? -PLANE.sinkRate : p.speed * Math.sin(p.pitch);

  // Ground run: the plane rolls on the runway until rotate speed.
  if (p.onGround) {
    p.alt = 0;
    p.verticalSpeed = 0;
    if (p.speed >= PLANE.rotateSpeed && p.pitch > 0.06) {
      p.onGround = false;
      return 'liftoff';
    }
  } else {
    p.verticalSpeed = climb;
    p.alt += climb * dt;
    // Gentle ground effect and the runway's own lift keep the model forgiving.
    if (p.alt < 0) p.alt = 0;
  }

  // Move down the valley; the heading drifts the lateral position.
  p.s += p.speed * Math.cos(p.heading) * dt;
  p.x += p.speed * Math.sin(p.heading) * dt * -1;
  // Banking also slides the plane sideways a little, as a real turn does.
  p.x += p.roll * p.speed * 0.35 * dt;

  // Fuel: throttle is the budget; a dead tank is a glider.
  p.fuel = Math.max(0, p.fuel - PLANE.fuelBurnFull * p.throttle * dt);
  if (p.fuel <= 0 && p.throttle > 0) p.throttle = 0.25;

  // Out of the valley's sides: the ridge pushes back with a warning, not a wall.
  if (Math.abs(p.x) > COURSE.groundHalfWidth) p.x = Math.sign(p.x) * COURSE.groundHalfWidth;
  return null;
}

/** Touchdown check when the plane meets the ground: 'landed', 'crash' or null. */
export function checkTouchdown(plane) {
  const p = plane;
  if (p.onGround || p.alt > 0.5) return null;
  const vs = Math.abs(p.verticalSpeed);
  const onRunway = isOnRunway(p.s, p.x);
  if (!onRunway) return 'crash';
  if (vs > 7 || p.speed > 62) return 'crash';
  if (Math.abs(p.roll) > 0.5) return 'crash';
  p.onGround = true;
  p.alt = 0;
  p.verticalSpeed = 0;
  return 'landed';
}

/** True when (s, x) lies on either runway strip. */
export function isOnRunway(s, x) {
  const r1 = COURSE.runwaySouth;
  const r2 = COURSE.runwayNorth;
  const inStrip = (r) => s >= r.start - 20 && s <= r.end + 60 && Math.abs(x - r.x) < 16;
  return inStrip(r1) || inStrip(r2);
}

/** True when the plane is lined up for the North Runway approach. */
export function onFinalApproach(plane) {
  return plane.s > COURSE.runwayNorth.start - 1400 && plane.s < COURSE.runwayNorth.start;
}
