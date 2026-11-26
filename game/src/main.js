// Meridian Courier — entry point. Boots the canvas, runs the fixed-step
// rules loop, wires keyboard/mouse input and synthesized sound, and exposes
// the live world on window.__meridian for play-testing and screenshots.
import { KEYS, SCREEN } from './config.js';
import { attachInput, clearPressed, createInput, readControls, wasPressed } from './input.js';
import { render } from './render.js';
import { createWorld, resetWorld, startSortie, stepWorld, STEP } from './world.js';
import { crashSound, createAudio, ensureAudio, ringChime, thud, updateEngineSound } from './audio.js';
import { shotFromUrl, stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const world = createWorld();
const input = createInput();
const audio = createAudio();

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

let lastStatus = '';
function announce(text) {
  if (text === lastStatus) return;
  lastStatus = text;
  statusEl.textContent = text;
}

function onCanvasClick() {
  ensureAudio(audio);
  if (world.screen === SCREEN.title) startSortie(world);
  else if (world.screen === SCREEN.over || world.screen === SCREEN.landed) resetWorld(world);
}
attachInput(input, canvas, onCanvasClick);

let accumulator = 0;
let lastTime = performance.now();

function frame(now) {
  const dt = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;

  // Menu keys.
  if (wasPressed(input, KEYS.start) && world.screen === SCREEN.title) {
    ensureAudio(audio);
    startSortie(world);
  }
  if (wasPressed(input, KEYS.restart) && (world.screen === SCREEN.over || world.screen === SCREEN.landed)) {
    resetWorld(world);
  }
  if (wasPressed(input, KEYS.pause) && world.screen === SCREEN.play) world.screen = SCREEN.paused;
  else if (wasPressed(input, KEYS.pause) && world.screen === SCREEN.paused) world.screen = SCREEN.play;
  if (wasPressed(input, ['KeyG']) && world.screen === SCREEN.play) {
    world.plane.gearDown = !world.plane.gearDown;
  }
  if (wasPressed(input, ['KeyF']) && world.screen === SCREEN.play) {
    world.plane.flaps = !world.plane.flaps;
  }
  clearPressed(input);

  // Fixed-step rules, decoupled from the display refresh rate.
  if (world.screen === SCREEN.play) {
    accumulator += dt;
    while (accumulator >= STEP) {
      accumulator -= STEP;
      const event = stepWorld(world, readControls(input, world.plane), STEP);
      if (event === 'ring') ringChime(audio);
      if (event === 'landed') thud(audio);
      if (event === 'crash') crashSound(audio);
    }
  } else {
    accumulator = 0;
  }
  updateEngineSound(audio, world.plane);

  render(ctx, world, canvas.width, canvas.height, now / 1000);

  const ring = world.rings.find((r) => !r.done);
  announce(
    world.screen === SCREEN.title ? 'Meridian Courier. Press Enter or click to fly.'
    : world.screen === SCREEN.over ? `Aircraft lost: ${world.crashReason}. Score ${world.score}. Press R to fly again.`
    : world.screen === SCREEN.landed ? `Sortie complete. Score ${world.score}. Press R to fly again.`
    : `Flying. Altitude ${Math.round(world.plane.alt * 3.28)} feet, speed ${Math.round(world.plane.speed * 1.94)} knots, ` +
      `rings ${world.ringsPassed} of 12, fuel ${Math.round((world.plane.fuel / 110) * 100)} percent` +
      (ring ? `, next ring ${Math.round(ring.s - world.plane.s)} metres ahead.` : '.'),
  );
  requestAnimationFrame(frame);
}

// Screenshot mode: stage a deterministic scene from the query string and
// draw one frame; the scene is fully set before the first paint, so the
// screenshot is stable and repeatable.
const shot = shotFromUrl();
if (shot) {
  stageShot(shot, world);
  render(ctx, world, canvas.width, canvas.height, 12.5);
  window.__meridian = { world, staged: shot };
} else {
  window.__meridian = { world, input };
  requestAnimationFrame(frame);
}
