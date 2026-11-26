// Screenshot scenes: each one plays the real rules forward from a fresh
// world for a fixed number of steps, steered by the autopilot, so the frame
// is what a real flight looks like and the same seed always gives the same
// frame. ?shot=takeoff | rings | approach | landed (anything else: takeoff).
import { SCREEN } from './config.js';
import { autopilotInput, createWorld, resetWorld, startSortie, stepWorld, STEP } from './world.js';

const TAKEOFF_STEPS = 60 * 4.5;
const RINGS_STEPS = 60 * 100;
const APPROACH_STEPS = 60 * 175;
const LANDED_STEPS = 60 * 205;

/**
 * Stage the named scene on `world` and return the screen to draw.
 * The world is reset first, so scenes are independent and deterministic.
 */
export function stageShot(name, world) {
  resetWorld(world);
  startSortie(world);
  const steps = name === 'rings' ? RINGS_STEPS
    : name === 'approach' ? APPROACH_STEPS
    : name === 'landed' ? LANDED_STEPS
    : TAKEOFF_STEPS;
  for (let i = 0; i < steps; i += 1) {
    const event = stepWorld(world, autopilotInput(world), STEP);
    if (event === 'landed' || event === 'crash') break;
    if (world.screen === SCREEN.over || world.screen === SCREEN.landed) break;
  }
  // The approach scene wants the runway dead ahead, low and lined up.
  if (name === 'approach' && world.screen === SCREEN.play) {
    world.plane.s = 10100;
    world.plane.x = -40;
    world.plane.alt = 28;
    world.plane.speed = 42;
    world.plane.throttle = 0.5;
    world.plane.gearDown = true;
    world.plane.pitch = -0.03;
    world.plane.roll = 0;
  }
  return world.screen;
}

/** Parse the ?shot= query parameter from the page URL. */
export function shotFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('shot');
}
