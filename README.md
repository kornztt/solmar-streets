# SOLMAR STREETS

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/kornztt/solmar-streets/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/kornztt/solmar-streets/reward.svg)](https://make.fun/bounty/gta6-01)

An open-world crime game in the spirit of GTA 6, playable in a desktop browser
from static files — no network requests, no build step. Built for the
[make.fun gta6-01 bounty](https://make.fun/bounty/gta6-01).

## The city

Solmar is a 9×9-block city with nine distinct districts: Downtown towers with
lit windows at night, the Harbor bay and docks, Parkside with its lake,
brick Old Town, suburban Northgate, and the Rooftop Plaza landmark with its
helipad. A full day/night cycle changes the light — at night, headlight cones
cut through the dark and street lamps glow.

## What you can do

- **On foot and by car** — walk the streets or steal any of 6 car models in
  12 colours (stealing raises your wanted level).
- **Traffic and pedestrians** — cars cruise the roads, 8 kinds of pedestrians
  stroll the sidewalks and flee when trouble starts.
- **Wanted 0–5** — police cars hunt you down; the heat cools off if you lay low.
- **5 story missions** — M1 The Getaway, M2 Hot Delivery, M3 Dockside
  Takedown, M4 Harbor Chase, M5 Night Heist (stop the bank van after dark,
  grab 3 cash bags, reach the stash while wanted 3).
- **2 side jobs** — taxi fares and courier deliveries, repeatable for cash.
- **Combat** — punch with SPACE, shoot with the mouse (buy the pistol and ammo
  at the Gun Barn).
- **3 shops** — Pit Stop (repairs, armour), Gun Barn (pistol, ammo),
  Diner (meals, cool your wanted level).
- **HUD + minimap**, title / pause / WASTED screens, localStorage save/load,
  WebAudio synth SFX and a music loop.

## Controls

| Key | Action |
| --- | --- |
| WASD / Arrows | Walk & drive |
| E | Enter/exit car, open shop |
| SPACE | Punch |
| Mouse click | Shoot (with pistol) |
| 1–5 | Start mission M1–M5 |
| T | Taxi job |
| C | Courier job |
| P / ESC | Pause |
| M | Mute |

## Play it

Serve `game/` over HTTP (for example `python3 -m http.server` inside it) and
open `index.html` in a desktop browser. Everything is original work: the city,
characters, vehicles, story, art and sound are all made for this entry.

## License

MIT — see [LICENSE](LICENSE).
