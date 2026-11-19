# SOLMAR STREETS

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/kornztt/solmar-streets/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/kornztt/solmar-streets/reward.svg)](https://make.fun/bounty/gta6-01)

An open-world crime game in the spirit of GTA 6, built for the
[make.fun "Make GTA 6" bounty](https://make.fun/bounty/gta6-01).
Top-down 2D canvas, vanilla JavaScript, no libraries, no network — open
`game/index.html` in a desktop browser and play.

## What is in the city

- **On foot and by car** — steal any parked or traffic car (E to get in/out),
  6 car models in 12 colours.
- **5 story missions** — M1 The Getaway, M2 Hot Delivery, M3 Dockside
  Takedown (5 Breakers), M4 Harbor Chase (ram the courier, grab the ledger),
  M5 Night Heist (stop the bank van, grab 3 cash bags, $2,000).
- **Side jobs** — taxi fares and timed courier parcel drops.
- **Wanted level 0–5** with police pursuit and rams; crimes raise the heat,
  laying low cools it down.
- **Combat** — punch (Space) and pistol (click to shoot), ammo from the Gun Barn.
- **Shops** — Pit Stop repairs, Gun Barn ammo, Diner heals.
- **Day/night cycle** with headlight cones after dark, HUD with minimap,
  title / pause / WASTED screens, and automatic saving (localStorage).

## Controls

WASD / arrows — move & drive · E — enter/exit car, interact, open shops ·
Space — punch · Click — shoot · P — pause · M — mute

## Run it

```
# static files only — serve game/ over HTTP, e.g.:
python3 -m http.server 8123 --directory game
# then open http://127.0.0.1:8123/index.html
```

## Dossier

```
MAKEFUN_OUTPUT_DIR=out node main.ts   # writes out/dossier.json
```

## License

MIT — see LICENSE.
