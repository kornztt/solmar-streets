# SOLMAR STREETS

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/kornztt/solmar-streets/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/kornztt/solmar-streets/reward.svg)](https://make.fun/bounty/gta6-01)

An open-world crime game in the spirit of GTA 6, built for the
[make.fun "Make GTA 6" bounty](https://make.fun/bounty/gta6-01).
100% original: its city, characters, vehicles, story, art, sound and music
are all its own — nothing from Rockstar Games or any other commercial game.

## The game

Solmar is a sun-soaked coastal city. You start on foot at the hideout, broke
and unknown. Mara, the fixer who runs the south side, has work for you:

- **The Getaway** — steal the getaway car and reach the north hideout while
  the cops chase you, on the clock.
- **Hot Delivery** — pick up a package on 6th Street and deliver it across
  town, fast.
- **Dockside Takedown** — the Viper crew is waiting at Pier 9. Put all five
  of them down with the pistol, then report back to Mara.
- **Taxi fares** — pick up passengers and get paid, with a tip for a fast
  drop-off. Repeatable, whenever you need cash.

Around the story: steal any car on the street, traffic and pedestrians,
a wanted level from 0 to 5 stars with police cruisers that chase and ram
you (and officers on foot who will bust you at 3 stars and up), punch and
pistol combat, Pit Stop repairs, Gun Barn ammo, a HUD with a minimap, a
save that keeps your money and finished missions, and a synth soundtrack.

## Play it

Open `game/index.html` in a desktop browser (or serve `game/` with any
static server). No network, no build step, no assets to download.

| Key | Action |
| --- | --- |
| WASD / arrows | Walk / drive |
| Shift | Sprint |
| E | Enter a car, talk to Mara, repair, buy ammo |
| F | Punch |
| Mouse | Aim, click to shoot |
| R | Reload |
| P / Esc | Pause |
| M | Mute |

## Layout

- `main.ts` — the hand-in program: copies `game/` and `screenshots/` out
  and writes `dossier.json` with the vendored make.fun library.
- `game/index.html` — the page; `game/src/` holds the game, one job per
  file: `config`, `random`, `audio`, `city`, `entities`, `world`,
  `missions`, `render`, `input`, `save`, `shots`, `main`.
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged.
- `screenshots/` — four real renders of the game, taken in a browser.

## Build the dossier

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## License

MIT — see [LICENSE](LICENSE).
