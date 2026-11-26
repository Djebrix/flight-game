// Input: keyboard and mouse, one control state the rules read each step.
// Arrow keys / WASD pitch and bank, Shift/Ctrl throttle, F flaps, G gear,
// B brake, P pause, R restart, Enter/Space/click to start. Mouse position
// steers the plane toward the pointer; the wheel trims the throttle.
import { KEYS } from './config.js';

export function createInput() {
  return {
    keys: new Set(),
    mouseX: null,
    mouseY: null,
    mouseDown: false,
    wheelDelta: 0,
    pressed: new Set(),
  };
}

function has(input, codes) {
  return codes.some((c) => input.keys.has(c));
}

/** Read the current control state as a flight input for one rules step. */
export function readControls(input, plane) {
  const pitch = (has(input, KEYS.pitchUp) ? 1 : 0) - (has(input, KEYS.pitchDown) ? 1 : 0);
  let roll = (has(input, KEYS.bankRight) ? 1 : 0) - (has(input, KEYS.bankLeft) ? 1 : 0);
  // Mouse steering: bank toward the pointer's offset from screen centre.
  if (input.mouseX !== null && !input.mouseDown) {
    const steer = (input.mouseX - 0.5) * 2;
    if (Math.abs(steer) > 0.08) roll = Math.max(-1, Math.min(1, steer * 1.4));
  }
  let throttle = null;
  if (has(input, KEYS.throttleUp)) throttle = Math.min(1, plane.throttle + 0.02);
  if (has(input, KEYS.throttleDown)) throttle = Math.max(0, plane.throttle - 0.02);
  if (input.wheelDelta !== 0) {
    throttle = Math.max(0, Math.min(1, plane.throttle - input.wheelDelta * 0.001));
    input.wheelDelta = 0;
  }
  return { pitch, roll, throttle, brake: has(input, KEYS.brake) };
}

/** True once for a key pressed since the last poll (menu keys). */
export function wasPressed(input, codes) {
  return codes.some((c) => input.pressed.has(c));
}

export function clearPressed(input) {
  input.pressed.clear();
}

/** Wire keyboard and mouse listeners onto the window and canvas. */
export function attachInput(input, canvas, onClick) {
  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    input.keys.add(event.code);
    input.pressed.add(event.code);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    input.keys.delete(event.code);
  });
  window.addEventListener('blur', () => {
    input.keys.clear();
  });
  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    input.mouseX = (event.clientX - rect.left) / rect.width;
    input.mouseY = (event.clientY - rect.top) / rect.height;
  });
  canvas.addEventListener('mousedown', (event) => {
    input.mouseDown = true;
    if (onClick) onClick(event);
  });
  window.addEventListener('mouseup', () => {
    input.mouseDown = false;
  });
  canvas.addEventListener('wheel', (event) => {
    input.wheelDelta += event.deltaY;
    event.preventDefault();
  }, { passive: false });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
}
