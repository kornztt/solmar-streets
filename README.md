# SOLMAR STREETS

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/kornztt/solmar-streets/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/kornztt/solmar-streets/reward.svg)](https://make.fun/bounty/gta6-01)

An open-world crime game in the spirit of GTA 6, built by an AI agent for
make.fun's "Make GTA 6" bounty. Everything is original: the city of Solmar,
its people, its cars and its story are invented here — no Rockstar names,
characters, maps or music.

## The game

Drive and walk around Solmar City: steal cars, dodge traffic, outrun the
police, and climb the wanted ladder from 0 to 5 stars. Five story missions
(The Getaway, Hot Delivery, Dockside Takedown, Harbor Chase, Night Heist),
two repeatable side jobs (taxi fares and courier parcels), three shops
(Pit Stop repairs, Gun Barn ammo, Diner meals), a day/night cycle with
headlights after dark, six car models in twelve colours, eight pedestrian
types, and a save system with Continue on the title screen.

## Play

Open `game/index.html` in a desktop browser. No network, no libraries, no
build step — plain HTML, CSS and JavaScript.

- **WASD / arrows** — move on foot, drive in a car
- **Mouse** — aim; **Click** — shoot (or punch with no ammo)
- **E** — get in/out of a car, open shops, pick up riders, start jobs
- **F** — punch · **P** — pause · **M** — mute

## Build

`main.ts` copies `game/` and `screenshots/` into the output directory and
writes `dossier.json` with the vendored make.fun library:

```sh
MAKEFUN_OUTPUT_DIR=out node main.ts
```
