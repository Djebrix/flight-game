// The scene: a pseudo-3D chase view over the Meridian valley, drawn on one
// canvas — sky, ridge, clouds, patchwork fields, river, road, runways, trees
// and houses, the twelve rings, the Kestrel in frame, and the full HUD with
// its instruments lit. Everything is drawn from the world state, so a
// screenshot is always a real frame of the game.
import { COURSE, PHASE, PLANE, SCREEN } from './config.js';
import { fieldColor, groundHeight, riverX, roadX } from './terrain.js';
import { isOnRunway } from './plane.js';

const FOCAL = 620;
const DRAW_DISTANCE = 2600;

/** Project a world point into screen space. Returns null behind the camera. */
export function project(plane, s, x, height, w, h) {
  const ds = s - plane.s;
  const dx = x - plane.x;
  const fwd = ds * Math.cos(plane.heading) - dx * Math.sin(plane.heading);
  if (fwd < 8) return null;
  const lat = dx * Math.cos(plane.heading) + ds * Math.sin(plane.heading);
  const horizonY = h * 0.42 - plane.pitch * FOCAL * 0.9;
  const sx = w / 2 + (lat * FOCAL) / fwd;
  // Camera sits ~2.2 m above the wheels, so the runway stays visible ahead
  // even while the plane is still rolling on the ground.
  const sy = horizonY + ((plane.alt + 2.2 - height) * FOCAL) / fwd;
  const scale = FOCAL / fwd;
  return { x: sx, y: sy, scale, fwd };
}

/** Draw the whole frame for the given world and wall-clock time. */
export function render(ctx, world, w, h, now) {
  const plane = world.plane;
  ctx.save();
  drawSky(ctx, world, w, h, now);
  drawGround(ctx, world, w, h);
  drawRings(ctx, world, w, h);
  if (world.screen !== SCREEN.title) drawAircraft(ctx, world, w, h, now);
  ctx.restore();
  drawHud(ctx, world, w, h);
  if (world.screen === SCREEN.title) drawTitle(ctx, world, w, h);
  if (world.screen === SCREEN.over) drawDebrief(ctx, world, w, h, false);
  if (world.screen === SCREEN.landed) drawDebrief(ctx, world, w, h, true);
  if (world.screen === SCREEN.paused) drawPaused(ctx, w, h);
}

function drawSky(ctx, world, w, h, now) {
  const plane = world.plane;
  const horizonY = h * 0.42 - plane.pitch * FOCAL * 0.9;
  const sky = ctx.createLinearGradient(0, 0, 0, horizonY + 40);
  sky.addColorStop(0, '#2f6db3');
  sky.addColorStop(0.55, '#7fb2dd');
  sky.addColorStop(1, '#f6cf8a');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, Math.max(0, horizonY + 40));
  // Sun, low in the west, warm.
  const sunX = w * 0.72 - plane.heading * 300;
  const sunY = horizonY - h * 0.18;
  const glow = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 130);
  glow.addColorStop(0, 'rgba(255, 236, 170, 0.95)');
  glow.addColorStop(0.25, 'rgba(255, 214, 120, 0.55)');
  glow.addColorStop(1, 'rgba(255, 214, 120, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(sunX - 140, sunY - 140, 280, 280);
  ctx.fillStyle = '#ffedb0';
  ctx.beginPath();
  ctx.arc(sunX, sunY, 26, 0, Math.PI * 2);
  ctx.fill();
  // Clouds drift with heading and time.
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  for (const c of world.valley.clouds) {
    const cx = ((c.x - plane.heading * 0.6 + now * c.speed * 0.02) % 2 + 2) % 2 - 1;
    const px = w / 2 + cx * w * 0.62;
    const py = h * c.y - plane.pitch * 200;
    const s = c.scale * w * 0.055;
    ctx.beginPath();
    ctx.ellipse(px, py, s, s * 0.32 * c.puffs[0], 0, 0, Math.PI * 2);
    ctx.ellipse(px + s * 0.7, py + s * 0.06, s * 0.7, s * 0.26 * c.puffs[1], 0, 0, Math.PI * 2);
    ctx.ellipse(px - s * 0.7, py + s * 0.08, s * 0.65, s * 0.24 * c.puffs[2], 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Distant ridge, following the horizon.
  ctx.fillStyle = '#5d7fa8';
  ctx.beginPath();
  ctx.moveTo(0, horizonY + 2);
  const ridge = world.valley.ridge;
  for (let i = 0; i < ridge.length; i += 1) {
    const x = (i / (ridge.length - 1)) * w;
    ctx.lineTo(x, horizonY + 2 - ridge[i] * h);
  }
  ctx.lineTo(w, horizonY + 2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#7d9cbd';
  ctx.beginPath();
  ctx.moveTo(0, horizonY + 2);
  for (let i = 0; i < ridge.length; i += 1) {
    const x = (i / (ridge.length - 1)) * w;
    ctx.lineTo(x, horizonY + 2 - ridge[i] * h * 0.55);
  }
  ctx.lineTo(w, horizonY + 2);
  ctx.closePath();
  ctx.fill();
}

/** The ground: patchwork fields in lateral lanes, river, road and runways, far to near. */
function drawGround(ctx, world, w, h) {
  const plane = world.plane;
  const horizonY = h * 0.42 - plane.pitch * FOCAL * 0.9;
  // Base ground: everything below the horizon is valley floor, so the world
  // never shows the page background beyond the valley's edges.
  ctx.fillStyle = '#5d8f43';
  ctx.fillRect(0, horizonY, w, h - horizonY);
  const seg = COURSE.segment;
  const far = Math.min(COURSE.length + 200, plane.s + DRAW_DISTANCE);
  const startSeg = Math.max(0, Math.floor(plane.s / seg));
  const endSeg = Math.floor(far / seg);
  // The visible valley floor is wider than the flyable corridor: 12 lanes of
  // 200 m, each a patchwork field, so the ground reaches the screen edges.
  const lanes = 12;
  const laneWidth = 200;
  const half = (lanes * laneWidth) / 2;
  for (let i = endSeg; i >= startSeg; i -= 1) {
    const sNear = i * seg;
    const sFar = sNear + seg;
    const row = Math.floor(sNear / 600);
    for (let lane = 0; lane < lanes; lane += 1) {
      const x0 = -half + lane * laneWidth;
      const x1 = x0 + laneWidth;
      const a = project(plane, sNear, x0, groundHeight(sNear), w, h);
      const b = project(plane, sNear, x1, groundHeight(sNear), w, h);
      const c = project(plane, sFar, x1, groundHeight(sFar), w, h);
      const d = project(plane, sFar, x0, groundHeight(sFar), w, h);
      if (!a || !b || !c || !d) continue;
      ctx.fillStyle = fieldColor(row, lane);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(c.x, c.y);
      ctx.lineTo(d.x, d.y);
      ctx.closePath();
      ctx.fill();
    }
    drawBand(ctx, plane, w, h, sNear, sFar, riverX, 13, '#4a90c2');
    drawBand(ctx, plane, w, h, sNear, sFar, roadX, 4, '#8d8578');
    drawRunwayStrip(ctx, plane, w, h, sNear, sFar, COURSE.runwaySouth);
    drawRunwayStrip(ctx, plane, w, h, sNear, sFar, COURSE.runwayNorth);
  }
  drawFeatures(ctx, world, w, h);
}

/** A lateral band (river, road) across one ground segment, hugging the terrain. */
function drawBand(ctx, plane, w, h, sNear, sFar, centreAt, halfWidth, color) {
  const cN = centreAt(sNear);
  const cF = centreAt(sFar);
  const gN = groundHeight(sNear) + 0.1;
  const gF = groundHeight(sFar) + 0.1;
  const a = project(plane, sNear, cN - halfWidth, gN, w, h);
  const b = project(plane, sNear, cN + halfWidth, gN, w, h);
  const c = project(plane, sFar, cF + halfWidth, gF, w, h);
  const d = project(plane, sFar, cF - halfWidth, gF, w, h);
  if (!a || !b || !c || !d) return;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.lineTo(c.x, c.y);
  ctx.lineTo(d.x, d.y);
  ctx.closePath();
  ctx.fill();
}

/** One runway's asphalt strip, with centreline dashes and threshold bars, hugging the terrain. */
function drawRunwayStrip(ctx, plane, w, h, sNear, sFar, runway) {
  if (sFar < runway.start || sNear > runway.end) return;
  const halfW = 15;
  const gN = groundHeight(sNear) + 0.05;
  const gF = groundHeight(sFar) + 0.05;
  const a = project(plane, sNear, runway.x - halfW, gN, w, h);
  const b = project(plane, sNear, runway.x + halfW, gN, w, h);
  const c = project(plane, sFar, runway.x + halfW, gF, w, h);
  const d = project(plane, sFar, runway.x - halfW, gF, w, h);
  if (!a || !b || !c || !d) return;
  ctx.fillStyle = '#3c3f45';
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.lineTo(c.x, c.y);
  ctx.lineTo(d.x, d.y);
  ctx.closePath();
  ctx.fill();
  // Centreline dashes every 40 m, drawn as quads on the strip.
  ctx.fillStyle = '#f2f2e8';
  for (let s = Math.max(sNear, runway.start); s < Math.min(sFar, runway.end); s += 40) {
    const s2 = Math.min(s + 18, runway.end);
    const g1 = groundHeight(s) + 0.1;
    const g2 = groundHeight(s2) + 0.1;
    const p1 = project(plane, s, runway.x - 0.7, g1, w, h);
    const p2 = project(plane, s, runway.x + 0.7, g1, w, h);
    const p3 = project(plane, s2, runway.x + 0.7, g2, w, h);
    const p4 = project(plane, s2, runway.x - 0.7, g2, w, h);
    if (!p1 || !p2 || !p3 || !p4) continue;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.lineTo(p3.x, p3.y);
    ctx.lineTo(p4.x, p4.y);
    ctx.closePath();
    ctx.fill();
  }
  // Threshold bars at both ends.
  for (const end of [runway.start + 8, runway.end - 8]) {
    if (end < sNear || end > sFar) continue;
    const p = project(plane, end, runway.x, groundHeight(end) + 0.1, w, h);
    if (!p) continue;
    const ww = 26 * p.scale;
    ctx.fillStyle = '#f2f2e8';
    ctx.fillRect(p.x - ww / 2, p.y - 2, ww, 3);
  }
}

/** Trees and houses, far to near so near ones overlap far ones. */
function drawFeatures(ctx, world, w, h) {
  const plane = world.plane;
  const items = [];
  for (const t of world.valley.trees) {
    if (t.s > plane.s + 8 && t.s < plane.s + DRAW_DISTANCE) items.push({ s: t.s, x: t.x, kind: 'tree', ...t });
  }
  for (const hs of world.valley.houses) {
    if (hs.s > plane.s + 8 && hs.s < plane.s + DRAW_DISTANCE) items.push({ s: hs.s, x: hs.x, kind: 'house', ...hs });
  }
  items.sort((a, b) => b.s - a.s);
  for (const it of items) {
    const p = project(plane, it.s, it.x, groundHeight(it.s), w, h);
    if (!p || p.y > h + 40) continue;
    const s = p.scale * it.size;
    if (s < 1.5) continue;
    if (it.kind === 'tree') {
      ctx.fillStyle = '#5a4632';
      ctx.fillRect(p.x - s * 0.06, p.y - s * 0.35, s * 0.12, s * 0.35);
      ctx.fillStyle = it.color;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - s * 1.35);
      ctx.lineTo(p.x - s * 0.5, p.y - s * 0.3);
      ctx.lineTo(p.x + s * 0.5, p.y - s * 0.3);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillStyle = it.color;
      ctx.fillRect(p.x - s * 0.5, p.y - s * 0.55, s, s * 0.55);
      ctx.fillStyle = it.roof;
      ctx.beginPath();
      ctx.moveTo(p.x - s * 0.58, p.y - s * 0.55);
      ctx.lineTo(p.x, p.y - s * 0.95);
      ctx.lineTo(p.x + s * 0.58, p.y - s * 0.55);
      ctx.closePath();
      ctx.fill();
    }
  }
}

/** The rings: gold for the next one, faint white for later, green for passed. */
function drawRings(ctx, world, w, h) {
  const plane = world.plane;
  for (const ring of world.rings) {
    if (ring.s < plane.s - 30 || ring.s > plane.s + DRAW_DISTANCE) continue;
    const p = project(plane, ring.s, ring.x, ring.alt, w, h);
    if (!p) continue;
    const r = ring.radius * p.scale;
    if (r < 2) continue;
    const isNext = world.rings.find((x) => !x.done) === ring;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(plane.roll * 0.35);
    ctx.lineWidth = Math.max(2, r * 0.14);
    ctx.strokeStyle = ring.passed ? 'rgba(80, 200, 90, 0.9)' : isNext ? '#ffc93c' : 'rgba(255,255,255,0.55)';
    if (isNext) {
      ctx.shadowColor = '#ffc93c';
      ctx.shadowBlur = 18;
    }
    ctx.beginPath();
    ctx.ellipse(0, 0, r, r * 0.94, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    if (isNext) {
      ctx.fillStyle = '#ffc93c';
      ctx.font = `bold ${Math.max(11, Math.min(16, r * 0.35))}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(`RING ${ring.index + 1}`, p.x, p.y - r - 10);
    }
  }
}

/** The Kestrel, drawn from behind in chase view, banking with the stick. */
function drawAircraft(ctx, world, w, h, now) {
  const plane = world.plane;
  const cx = w / 2;
  const cy = h * 0.62 + plane.pitch * 60;
  const size = Math.min(w, h) * 0.16;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(plane.roll * 0.9);
  // Shadow on the ground far below, when low.
  if (plane.alt < 120 && !plane.onGround) {
    const sh = project(plane, plane.s + 30, plane.x, 0, w, h);
    if (sh) {
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.beginPath();
      ctx.ellipse(sh.x, sh.y, size * 0.7, size * 0.12, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Tailplane and wings.
  ctx.fillStyle = '#b8433a';
  ctx.beginPath();
  ctx.moveTo(-size * 1.55, size * 0.08);
  ctx.lineTo(size * 1.55, size * 0.08);
  ctx.lineTo(size * 1.15, size * 0.3);
  ctx.lineTo(-size * 1.15, size * 0.3);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#d94f43';
  ctx.beginPath();
  ctx.moveTo(-size * 0.55, -size * 0.28);
  ctx.lineTo(size * 0.55, -size * 0.28);
  ctx.lineTo(size * 0.34, size * 0.05);
  ctx.lineTo(-size * 0.34, size * 0.05);
  ctx.closePath();
  ctx.fill();
  // Fuselage.
  ctx.fillStyle = '#e8e2d4';
  ctx.beginPath();
  ctx.ellipse(0, 0, size * 0.34, size * 0.62, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#c94f43';
  ctx.beginPath();
  ctx.ellipse(0, size * 0.1, size * 0.34, size * 0.42, 0, 0, Math.PI);
  ctx.fill();
  // Cockpit glass.
  ctx.fillStyle = '#2a4a6b';
  ctx.beginPath();
  ctx.ellipse(0, -size * 0.18, size * 0.24, size * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.ellipse(-size * 0.07, -size * 0.28, size * 0.08, size * 0.12, -0.4, 0, Math.PI * 2);
  ctx.fill();
  // Spinning prop: a faint blurred disc whose blades sweep with time.
  const prop = (now / 90) % (Math.PI * 2);
  ctx.strokeStyle = 'rgba(40,40,40,0.32)';
  ctx.lineWidth = size * 0.04;
  ctx.beginPath();
  ctx.ellipse(0, -size * 0.62, size * 0.42, size * 0.42, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(30,30,30,0.55)';
  ctx.lineWidth = size * 0.045;
  for (const a of [prop, prop + Math.PI]) {
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * size * 0.12, -size * 0.62 + Math.sin(a) * size * 0.12);
    ctx.lineTo(Math.cos(a) * size * 0.4, -size * 0.62 + Math.sin(a) * size * 0.4);
    ctx.stroke();
  }
  // Tail fin and registration.
  ctx.fillStyle = '#b8433a';
  ctx.beginPath();
  ctx.moveTo(0, -size * 0.5);
  ctx.lineTo(-size * 0.16, -size * 0.05);
  ctx.lineTo(size * 0.16, -size * 0.05);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#22303c';
  ctx.font = `bold ${Math.max(9, size * 0.11)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('PK-MRC', 0, size * 0.42);
  // Navigation lights, lit.
  ctx.fillStyle = '#ff3b30';
  ctx.beginPath();
  ctx.arc(-size * 1.5, size * 0.16, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#34c759';
  ctx.beginPath();
  ctx.arc(size * 1.5, size * 0.16, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(0, size * 0.62, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Format helpers for the instruments. */
function fmt(n, digits = 0) {
  return n.toFixed(digits);
}
function knots(ms) {
  return ms * 1.94384;
}
function feet(m) {
  return m * 3.28084;
}
function headingDeg(heading) {
  return ((heading * 180) / Math.PI % 360 + 360) % 360;
}
function compassLabel(deg) {
  const names = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return names[Math.round(deg / 45) % 8];
}

function panel(ctx, x, y, w, h, alpha = 0.72) {
  ctx.fillStyle = `rgba(10, 16, 24, ${alpha})`;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

/** The HUD: altitude, speed, heading, fuel, throttle, horizon, VSI, rings. */
function drawHud(ctx, world, w, h) {
  const plane = world.plane;
  const playing = world.screen === SCREEN.play || world.screen === SCREEN.paused;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  // Compass tape across the top centre.
  const hdg = headingDeg(plane.heading);
  panel(ctx, w / 2 - 190, 10, 380, 46);
  ctx.save();
  ctx.beginPath();
  ctx.rect(w / 2 - 190, 10, 380, 46);
  ctx.clip();
  ctx.fillStyle = '#cfe3f5';
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'center';
  for (let d = -90; d <= 90; d += 15) {
    const deg = Math.round((hdg + d) / 15) * 15;
    const norm = ((deg % 360) + 360) % 360;
    const x = w / 2 + (d * 380) / 180;
    const major = norm % 45 === 0;
    ctx.fillStyle = major ? '#ffffff' : '#9db8cc';
    ctx.fillRect(x - 1, 16, 2, major ? 12 : 7);
    if (major) ctx.fillText(compassLabel(norm), x, 44);
  }
  ctx.restore();
  ctx.fillStyle = '#ffc93c';
  ctx.font = 'bold 17px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${String(Math.round(hdg)).padStart(3, '0')}°`, w / 2, 30);
  ctx.fillStyle = '#ffc93c';
  ctx.beginPath();
  ctx.moveTo(w / 2 - 6, 10);
  ctx.lineTo(w / 2 + 6, 10);
  ctx.lineTo(w / 2, 18);
  ctx.closePath();
  ctx.fill();

  // Altitude (left) and speed (right) tapes.
  panel(ctx, 12, 10, 132, 64);
  ctx.fillStyle = '#8fb8d8';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('ALTITUDE', 22, 26);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 24px monospace';
  ctx.fillText(`${fmt(feet(plane.alt))} ft`, 22, 54);
  panel(ctx, w - 144, 10, 132, 64);
  ctx.fillStyle = '#8fb8d8';
  ctx.font = '11px sans-serif';
  ctx.fillText('AIRSPEED', w - 134, 26);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 24px monospace';
  ctx.fillText(`${fmt(knots(plane.speed))} kt`, w - 134, 54);
  const stall = plane.speed < PLANE.stallSpeed && !plane.onGround;
  if (stall) {
    ctx.fillStyle = '#ff5a4a';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText('STALL', w - 134, 70);
  }

  // Score and ring progress, top centre under the compass.
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText(`SCORE ${world.score}`, w / 2, 84);
  for (let i = 0; i < COURSE.ringCount; i += 1) {
    const x = w / 2 - 110 + i * 20;
    ctx.fillStyle = world.rings[i].passed ? '#34c759' : '#ffc93c';
    ctx.beginPath();
    ctx.arc(x, 100, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.stroke();
  }
  ctx.fillStyle = '#dfe9f2';
  ctx.font = '12px sans-serif';
  const phaseText = world.phase === PHASE.takeoff ? 'TAKE-OFF — SOUTH RUNWAY'
    : world.phase === PHASE.rings ? `RINGS ${world.ringsPassed}/${COURSE.ringCount}`
    : world.phase === PHASE.approach ? 'APPROACH — NORTH RUNWAY'
    : world.phase === PHASE.landing ? 'FINAL — FLARE AND TOUCH DOWN'
    : 'SORTIE COMPLETE';
  ctx.fillText(phaseText, w / 2, 122);

  // Bottom-left: throttle and fuel.
  panel(ctx, 12, h - 118, 190, 106);
  ctx.fillStyle = '#8fb8d8';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('THROTTLE', 22, h - 100);
  ctx.fillStyle = '#22303c';
  ctx.fillRect(22, h - 92, 170, 10);
  ctx.fillStyle = '#4da3ff';
  ctx.fillRect(22, h - 92, 170 * plane.throttle, 10);
  ctx.fillStyle = '#8fb8d8';
  ctx.fillText('FUEL', 22, h - 66);
  ctx.fillStyle = '#22303c';
  ctx.fillRect(22, h - 58, 170, 10);
  ctx.fillStyle = plane.fuel < 25 ? '#ff5a4a' : '#34c759';
  ctx.fillRect(22, h - 58, 170 * (plane.fuel / PLANE.fuelCapacity), 10);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText(`${fmt((plane.fuel / PLANE.fuelCapacity) * 100)}%`, 22, h - 26);
  ctx.fillStyle = plane.gearDown ? '#34c759' : '#ffc93c';
  ctx.fillText(plane.gearDown ? 'GEAR DOWN' : 'GEAR UP', 96, h - 26);

  // Bottom-right: artificial horizon + vertical speed, kept clear of the edge.
  const hx = w - 118;
  const hy = h - 92;
  const hr = 38;
  ctx.save();
  ctx.beginPath();
  ctx.arc(hx, hy, hr, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(hx, hy);
  ctx.rotate(-plane.roll);
  ctx.translate(0, plane.pitch * 120);
  ctx.fillStyle = '#4a90c2';
  ctx.fillRect(-hr, -hr * 2, hr * 2, hr * 2);
  ctx.fillStyle = '#7a5a34';
  ctx.fillRect(-hr, 0, hr * 2, hr * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-hr, -1.5, hr * 2, 3);
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(hx, hy, hr, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#ffc93c';
  ctx.beginPath();
  ctx.moveTo(hx - 16, hy);
  ctx.lineTo(hx - 4, hy);
  ctx.lineTo(hx, hy + 5);
  ctx.lineTo(hx + 4, hy);
  ctx.lineTo(hx + 16, hy);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#8fb8d8';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('ATTITUDE', hx, hy + hr + 14);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px monospace';
  const vs = plane.verticalSpeed * 196.85;
  ctx.fillText(`VSI ${vs >= 0 ? '+' : ''}${fmt(vs)} fpm`, hx, hy + hr + 30);

  // Objective distance, bottom centre.
  if (playing) {
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(10,16,24,0.72)';
    ctx.beginPath();
    ctx.roundRect(w / 2 - 120, h - 40, 240, 28, 8);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px sans-serif';
    const ring = world.rings.find((r) => !r.done);
    const label = ring ? `NEXT RING ${ring.index + 1} — ${Math.max(0, Math.round(ring.s - plane.s))} m`
      : `NORTH RUNWAY — ${Math.max(0, Math.round(COURSE.runwayNorth.start - plane.s))} m`;
    ctx.fillText(label, w / 2, h - 21);
  }

  // Message line, only while flying (the debrief has its own panel).
  if (world.screen === SCREEN.play && world.message && world.time < world.messageUntil) {
    ctx.textAlign = 'center';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillStyle = 'rgba(10,16,24,0.75)';
    const tw = ctx.measureText(world.message).width + 28;
    ctx.beginPath();
    ctx.roundRect(w / 2 - tw / 2, h * 0.30, tw, 34, 8);
    ctx.fill();
    ctx.fillStyle = '#ffe9a8';
    ctx.fillText(world.message, w / 2, h * 0.30 + 23);
  }
  // Ground-proximity warning.
  if (playing && !plane.onGround && plane.alt < 25 && plane.verticalSpeed < -2) {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff5a4a';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('⚠ PULL UP — TERRAIN', w / 2, h * 0.22);
  }
  // Off-runway warning while rolling.
  if (playing && plane.onGround && !isOnRunway(plane.s, plane.x) && plane.s < 700) {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff5a4a';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('OFF THE RUNWAY', w / 2, h * 0.22);
  }
}

function drawTitle(ctx, world, w, h) {
  ctx.fillStyle = 'rgba(8, 14, 22, 0.45)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 64px sans-serif';
  ctx.fillText('MERIDIAN COURIER', w / 2, h * 0.26);
  ctx.fillStyle = '#ffc93c';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('A bush-plane sortie over the river valley', w / 2, h * 0.26 + 36);
  ctx.fillStyle = '#dfe9f2';
  ctx.font = '17px sans-serif';
  const lines = [
    'Take off from South Runway, thread all 12 rings, and put her down on North Runway.',
    'Rings refund fuel — fly clean and the tank lasts. Land smooth for the bonus.',
    '',
    '↑ ↓ pitch      ← → bank      SHIFT throttle up      CTRL throttle down',
    'F flaps      G gear      B brake      P pause      Mouse steers too',
  ];
  lines.forEach((line, i) => ctx.fillText(line, w / 2, h * 0.40 + i * 28));
  ctx.fillStyle = '#ffc93c';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText('CLICK OR PRESS ENTER TO FLY', w / 2, h * 0.40 + lines.length * 28 + 26);
  ctx.fillStyle = '#9db8cc';
  ctx.font = '13px sans-serif';
  ctx.fillText('12 rings  •  2 runways  •  260 trees  •  46 houses  •  1 river valley  •  deterministic', w / 2, h - 24);
}

function drawDebrief(ctx, world, w, h, landed) {
  ctx.fillStyle = 'rgba(8, 14, 22, 0.55)';
  ctx.fillRect(0, 0, w, h);
  const pw = 460;
  const ph = landed ? 330 : 300;
  const px = w / 2 - pw / 2;
  const py = h / 2 - ph / 2;
  panel(ctx, px, py, pw, ph, 0.92);
  ctx.textAlign = 'center';
  ctx.fillStyle = landed ? '#34c759' : '#ff5a4a';
  ctx.font = 'bold 34px sans-serif';
  ctx.fillText(landed ? 'SORTIE COMPLETE' : 'AIRCRAFT LOST', w / 2, py + 52);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px sans-serif';
  if (landed) {
    ctx.fillText(`Landed at North Runway — quality ${Math.round(world.landingQuality * 100)}%`, w / 2, py + 90);
  } else {
    ctx.fillText(world.crashReason, w / 2, py + 90);
  }
  ctx.font = '17px sans-serif';
  ctx.fillStyle = '#dfe9f2';
  const rows = [
    `Rings flown: ${world.ringsPassed} / ${COURSE.ringCount}`,
    `Flight time: ${fmt(world.elapsed)} s`,
    `Fuel left: ${fmt((world.plane.fuel / PLANE.fuelCapacity) * 100)}%`,
    `Score: ${world.score}`,
    `Best: ${world.best}`,
  ];
  rows.forEach((row, i) => ctx.fillText(row, w / 2, py + 128 + i * 26));
  ctx.fillStyle = '#ffc93c';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText('PRESS R OR CLICK TO FLY AGAIN', w / 2, py + ph - 24);
}

function drawPaused(ctx, w, h) {
  ctx.fillStyle = 'rgba(8, 14, 22, 0.5)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 40px sans-serif';
  ctx.fillText('PAUSED', w / 2, h / 2);
  ctx.fillStyle = '#9db8cc';
  ctx.font = '17px sans-serif';
  ctx.fillText('Press P to resume', w / 2, h / 2 + 34);
}
