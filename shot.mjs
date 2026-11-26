// Screenshot Meridian Courier's four staged scenes with Playwright's Chromium.
// Serves game/ on localhost, loads each ?shot= scene, screenshots at 1280x800
// as JPEG (gate: long side <= 1280, short side >= 480, each <= 256 KiB).
// Usage: node shot.mjs
import { createRequire } from 'node:module';
const require = createRequire('/home/hatch/workspace/makefun/.shot/node_modules/playwright-core/package.json');
const { chromium } = require('playwright-core');
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const gameDir = join(here, 'game');
const outDir = join(here, 'screenshots');
mkdirSync(outDir, { recursive: true });

const CHROME = '/home/hatch/workspace/makefun/chrome-extract/chrome-linux64/chrome';
const PORT = 8931;

const server = spawn(process.execPath, ['serve.ts', '--port', String(PORT)], { cwd: here, stdio: 'pipe' });
await new Promise((resolve) => setTimeout(resolve, 1200));

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console: ${m.text()}`);
});

const shots = [
  ['1-takeoff.jpg', '?shot=takeoff&seed=1'],
  ['2-rings.jpg', '?shot=rings&seed=1'],
  ['3-approach.jpg', '?shot=approach&seed=1'],
  ['4-landed.jpg', '?shot=landed&seed=1'],
];
for (const [name, query] of shots) {
  await page.goto(`http://localhost:${PORT}/${query}`, { waitUntil: 'load' });
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(outDir, name), type: 'jpeg', quality: 82 });
  const state = await page.evaluate(() => {
    const w = window.__meridian;
    if (!w) return null;
    const p = w.world.plane;
    return {
      screen: w.world.screen,
      phase: w.world.phase,
      score: w.world.score,
      rings: w.world.ringsPassed,
      s: Math.round(p.s),
      alt: Math.round(p.alt),
      speed: Math.round(p.speed),
      fuel: Math.round(p.fuel),
    };
  });
  console.log(`shot ${name}`, JSON.stringify(state));
}

await browser.close();
server.kill();
if (errors.length > 0) {
  process.stderr.write(`page errors:\n${errors.join('\n')}\n`);
  process.exit(1);
}
console.log('all four screenshots taken, no page errors');
