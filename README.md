[![make.fun](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/Djebrix/flight-game/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/Djebrix/flight-game/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)

# Meridian Courier — a bush-plane flight game: 12 rings, 2 runways, 260 trees, 46 houses, 1 river valley

[Play the bounty entry](https://make.fun/bounty/best-flight-game-20261126-0057) · built for the **best-flight-game-20261126-0057** competition.

Take off from South Runway in the Kestrel, a single-engine bush plane, thread all **12 rings** over the Meridian river valley, and put her down on North Runway. Rings refund fuel, so clean flying pays; a smooth landing pays more.

## The sortie

1. **Take-off** — spool the throttle, rotate at 34 m/s, lift off South Runway.
2. **12 rings** — each ring is +100 points (+50 dead centre) and +7 fuel. Miss one and you press on; there is no going back.
3. **Landing** — line up on North Runway on a 5-degree glide slope, flare, and touch down under 62 m/s with a gentle sink rate. Landing quality (up to +500) and a time bonus decide the final score.

Fuel is a budget: full throttle burns it fast, rings top it up. Stall below 24 m/s and the wing stops flying. Touch down off a runway, or sink too hard, and the sortie ends in the field.

## Controls

| Input | Action |
| --- | --- |
| ↑ / ↓ (W / S) | Pitch down / up |
| ← / → (A / D) | Bank left / right |
| Shift / Ctrl (E / Q) | Throttle up / down |
| Mouse move | Steer toward the pointer |
| Mouse wheel | Trim throttle |
| F | Flaps · G | Gear · B | Brake |
| P | Pause · R | Fly again · Enter / click | Start |

## Instruments

Compass tape with heading, altitude (ft) and airspeed (kt) readouts, artificial horizon with vertical-speed indicator, throttle and fuel gauges, gear state, ring progress (12 dots), phase banner, and next-objective distance. Engine hum, ring chimes, touchdown thud and crash noise are synthesized with WebAudio — no audio files.

## The valley

A deterministic 12,000 m river valley, the same every run: patchwork fields in 12 lanes, a meandering river, a valley road, 260 trees, 46 houses, 14 clouds, and a two-layer ridge under a late-afternoon sun. The ring course, the weather and the terrain all come from one fixed seed, so every flight is replayable and every screenshot is a real frame of the same world.

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no network request: `game/` is plain static files and `game/index.html` opens in desktop Chrome and plays offline.

## Layout

- `game/index.html` — the page, one canvas
- `game/src/main.js` — boot, fixed-step loop, menu keys
- `game/src/world.js` — the sortie: phases, scoring, autopilot
- `game/src/plane.js` — the Kestrel's flight model
- `game/src/render.js` — pseudo-3D chase view, aircraft, HUD
- `game/src/terrain.js` — the valley, the ring course
- `game/src/input.js` — keyboard + mouse
- `game/src/audio.js` — synthesized sound
- `game/src/config.js` — every tunable number
- `game/src/random.js` — seeded random numbers
- `game/src/shots.js` — deterministic screenshot scenes
- `main.ts` — hands the game in (copies `game/` + `screenshots/`, writes `dossier.json`)
- `screenshots/` — 4 real renders of the game's own code

## License

MIT — see `LICENSE`.
