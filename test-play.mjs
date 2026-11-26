// Live play-test for Meridian Courier (my own script, written in this session).
// Drives the real game in headless Chrome via playwright-core with real
// keyboard/mouse input: title -> start -> throttle -> liftoff -> fly, plus
// determinism (the same ?shot= scene twice gives the same world state and
// the same screenshot bytes) and a probe of the take-off message banner.
// Exits 1 on any failure or console/page error.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const require = createRequire('/home/hatch/workspace/makefun/.shot/node_modules/playwright-core/package.json');
const { chromium } = require('playwright-core');

const here = fileURLToPath(new URL('.', import.meta.url));
const CHROME = '/home/hatch/workspace/makefun/chrome-extract/chrome-linux64/chrome';
const PORT = 8933;

const server = spawn(process.execPath, ['serve.ts', '--port', String(PORT)], { cwd: here, stdio: 'pipe' });
await new Promise((resolve) => setTimeout(resolve, 1200));

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console: ${m.text()}`);
});
const failures = [];
function check(name, cond, extra) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra !== undefined ? `  (${extra})` : ''}`);
  if (!cond) failures.push(name);
}
const state = () => page.evaluate(() => {
  const w = window.__meridian;
  if (!w) return null;
  const p = w.world.plane;
  return {
    screen: w.world.screen, phase: w.world.phase, score: w.world.score,
    rings: w.world.ringsPassed, s: Math.round(p.s), x: Math.round(p.x),
    alt: Math.round(p.alt * 10) / 10, speed: Math.round(p.speed * 10) / 10,
    throttle: Math.round(p.throttle * 100) / 100, fuel: Math.round(p.fuel),
    onGround: p.onGround, message: w.world.message,
    messageUntil: Math.round(w.world.messageUntil * 10) / 10, time: Math.round(w.world.time * 10) / 10,
  };
});

// 1. Title screen on load.
await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load' });
await page.waitForTimeout(500);
let s = await state();
check('title screen on load', s.screen === 'title', s.screen);

// 2. Click to start, hold Shift to spool the throttle, rotate and lift off.
await page.mouse.click(640, 400);
await page.waitForTimeout(300);
s = await state();
check('click starts the sortie', s.screen === 'play', s.screen);
await page.keyboard.down('ShiftLeft');
await page.waitForTimeout(2500);
s = await state();
check('throttle spools up', s.throttle > 0.5 && s.speed > 25, `thr=${s.throttle} spd=${s.speed}`);
await page.keyboard.down('ArrowUp');
await page.waitForTimeout(2500);
await page.keyboard.up('ArrowUp');
s = await state();
check('airborne after rotate', !s.onGround && s.alt > 5, `alt=${s.alt} onGround=${s.onGround}`);
check('climbing', s.alt > 10, `alt=${s.alt}`);
// Steer with the mouse: pointer right of centre banks right.
await page.mouse.move(900, 400);
await page.waitForTimeout(1200);
s = await state();
check('mouse steering moves the plane', s.x > 0, `x=${s.x}`);
await page.keyboard.up('ShiftLeft');

// 3. Pause and resume with P.
await page.keyboard.press('KeyP');
await page.waitForTimeout(200);
s = await state();
check('P pauses', s.screen === 'paused', s.screen);
await page.keyboard.press('KeyP');
await page.waitForTimeout(200);
s = await state();
check('P resumes', s.screen === 'play', s.screen);

// 4. Take-off scene message banner probe.
await page.goto(`http://localhost:${PORT}/?shot=takeoff&seed=1`, { waitUntil: 'load' });
await page.waitForTimeout(400);
s = await state();
console.log('takeoff probe:', JSON.stringify(s));
check('takeoff banner text set', s.message.length > 0, s.message);
check('takeoff banner still live at 4.5s', s.time < s.messageUntil, `t=${s.time} until=${s.messageUntil}`);

// 5. Determinism: the landed scene twice — same world state, same pixels.
async function landedShot() {
  await page.goto(`http://localhost:${PORT}/?shot=landed&seed=1`, { waitUntil: 'load' });
  await page.waitForTimeout(400);
  const st = await state();
  const shot = await page.screenshot({ type: 'jpeg', quality: 82 });
  return { st, hash: createHash('sha256').update(shot).digest('hex') };
}
const run1 = await landedShot();
const run2 = await landedShot();
check('determinism: same world state twice', JSON.stringify(run1.st) === JSON.stringify(run2.st), JSON.stringify(run1.st));
check('determinism: same screenshot bytes twice', run1.hash === run2.hash, `${run1.hash.slice(0, 12)} vs ${run2.hash.slice(0, 12)}`);
check('landed scene completes the sortie', run1.st.screen === 'landed' && run1.st.rings === 12, `screen=${run1.st.screen} rings=${run1.st.rings} score=${run1.st.score}`);

await browser.close();
server.kill();
if (errors.length > 0) {
  console.log(`page errors:\n${errors.join('\n')}`);
  failures.push('page errors');
}
if (failures.length > 0) {
  console.log(`FAILURES: ${failures.join(', ')}`);
  process.exit(1);
}
console.log('play-test passed: title, start, throttle, liftoff, mouse steer, pause, banner, determinism');
