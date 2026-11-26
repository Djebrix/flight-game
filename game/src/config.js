// Meridian Courier — a bush-plane courier flight game.
// Config: every tunable number for the flight model, the course and the world.
// The course is a river valley 12,000 m long: South Runway (take-off) at s=0,
// twelve rings over the valley, North Runway (landing) at s=10,400.
export const COURSE = {
  length: 12000,
  segment: 20,
  groundHalfWidth: 420,
  runwaySouth: { start: 0, end: 620, x: 0 },
  runwayNorth: { start: 10400, end: 11020, x: -40 },
  ringCount: 12,
  ringStart: 900,
  ringEnd: 9800,
};

export const PLANE = {
  // Speeds in m/s. Rotate at 34, cruise 55, never-exceed 95, stall 24.
  rotateSpeed: 34,
  stallSpeed: 24,
  maxSpeed: 95,
  climbRate: 9,
  sinkRate: 12,
  turnRate: 0.55,
  pitchRate: 0.5,
  accelPerThrottle: 14,
  drag: 0.045,
  fuelCapacity: 110,
  // Fuel burn per second at full throttle; rings refund fuel.
  fuelBurnFull: 1.0,
  ringFuelBonus: 7,
  gearDownSpeed: 40,
};

export const SCORE = {
  ring: 100,
  ringCentreBonus: 50,
  landingBase: 300,
  landingSmoothBonus: 200,
  timeBonusPerSecond: 2,
  parTimeSeconds: 240,
};

export const WORLD = {
  // Fixed seed: the same valley, rings and weather every run.
  seed: 20261126,
  sunAzimuth: 0.6,
  cloudCount: 14,
  treeCount: 260,
  houseCount: 46,
};

export const SCREEN = {
  title: 'title',
  play: 'play',
  paused: 'paused',
  over: 'over',
  landed: 'landed',
};

export const PHASE = {
  takeoff: 'TAKEOFF',
  rings: 'RINGS',
  approach: 'APPROACH',
  landing: 'LANDING',
  done: 'DONE',
};

// Key bindings (KeyboardEvent.code values).
export const KEYS = {
  pitchUp: ['ArrowUp', 'KeyW'],
  pitchDown: ['ArrowDown', 'KeyS'],
  bankLeft: ['ArrowLeft', 'KeyA'],
  bankRight: ['ArrowRight', 'KeyD'],
  throttleUp: ['ShiftLeft', 'ShiftRight', 'KeyE'],
  throttleDown: ['ControlLeft', 'ControlRight', 'KeyQ'],
  brake: ['KeyB'],
  flaps: ['KeyF'],
  gear: ['KeyG'],
  pause: ['KeyP', 'Escape'],
  restart: ['KeyR'],
  start: ['Enter', 'Space'],
};
