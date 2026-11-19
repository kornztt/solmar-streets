# SOLMAR STREETS

[![make.fun](https://make.fun/badge.svg)](https://make.fun/bounty/gta6-01)
[![gta6-01](https://make.fun/bounty/gta6-01/badge.svg)](https://make.fun/bounty/gta6-01)

An open-world crime game in the spirit of GTA 6, built from scratch for the
[make.fun gta6-01 bounty](https://make.fun/bounty/gta6-01). 100% original:
its own city, characters, vehicles, story, art and music. Nothing from any
commercial game.

## The city

Solmar is a sun-soaked coastal city of 64 blocks: Old Town, Marina,
Downtown, the Market and the Harbor. Drive it or walk it — traffic flows,
pedestrians wander the sidewalks, the day turns to dusk and then to night,
and the streetlights come on.

## What you can do

- **Steal and drive** — six car models (sedan, sports, truck, hatch, van,
  taxi) in a dozen colours. Parked cars are yours for the taking.
- **Wanted 0–5** — steal a car, hit a pedestrian or fire a shot and the
  police come. Lose them, wait it out, and the heat fades.
- **Four story missions from Vera**, your fixer at the hideout:
  - **M1 The Getaway** — pick up a runner, get home before the heat closes in.
  - **M2 Hot Delivery** — a sealed case to the marina, 90 seconds.
  - **M3 Dockside Takedown** — five Breakers holding the pier.
  - **M4 Harbor Chase** — run down a fleeing courier, take the ledger home.
- **Taxi fares** — pick up a fare at the stand, drop them off, get paid + tip.
- **Combat** — fists and a pistol, aimed with the mouse.
- **Shops** — the Pit Stop repairs your car, the Gun Barn sells ammo.
- **Save** — the game autosaves; Continue from the title screen drops you
  back where you left off.

## Controls

| Key | Action |
| --- | --- |
| WASD / Arrows | Move & drive |
| E | Steal / exit car |
| Space | Punch (on foot) / handbrake (in car) |
| Click | Shoot pistol (aim with mouse) |
| M | Jobs menu |
| T | Start a taxi fare |
| F | Pit Stop (in car, nearby) |
| B | Gun Barn (on foot, nearby) |
| N | Toggle music |
| P / Esc | Pause |
| Shift | Run |

## Play it

Serve `game/` with any static server and open `index.html`:

```sh
cd game && python3 -m http.server 8123
```

No build step, no network requests, no assets to download — everything is
drawn and synthesized in the browser.

## Layout

- `game/src/config.js` — tuning, palette, vehicles, districts
- `game/src/random.js` — seeded RNG (the city is reproducible per seed)
- `game/src/city.js` — city generation, collision, road queries
- `game/src/entities.js` — player, cars, traffic AI, police, pedestrians
- `game/src/missions.js` — M1–M4 and the taxi job
- `game/src/combat.js` — fists, pistol, wanted consequences
- `game/src/audio.js` — WebAudio synth SFX + music loop
- `game/src/render.js` — world renderer, day/night, minimap
- `game/src/hud.js` — HUD, menus, toasts
- `game/src/save.js` — localStorage save / load
- `game/src/shots.js` — screenshot staging (`?shot=cover|chase|mission|streets`)
- `game/src/main.js` — boot and game loop
