// SOLMAR STREETS — the gta6-01 entrypoint (Node 22, standard library only).
// The game is this directory's game/ folder: plain static files a desktop
// browser loads offline (game/index.html and its ES modules, no library and
// no network request). This program hands it in: it copies game/ and
// screenshots/ from beside this file to /output and writes
// /output/dossier.json, the summary the judge reads, with the vendored
// make.fun library. It also refuses to hand in an empty screenshots folder,
// because the judge ranks the entry mostly by its screenshots, and it
// refuses screenshots over the scorer's 256 KiB cap, so a bad capture fails
// here instead of at the gate.
//
// Serve the game locally with `node ../tools/serve.ts`, then open
// http://localhost:8080. Outside the grader's container, MAKEFUN_OUTPUT_DIR
// stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const MAX_SHOT_BYTES = 262144; // the scorer's per-screenshot cap
const MAX_DOSSIER_BYTES = 1572864; // the scorer's dossier cap, 1.5 MiB

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// A cover and its supporting shots are the entry's face: hand nothing in
// without them. The scorer would refuse an entry with no screenshots, and
// the judge would have nothing to rank.
const shots = readdirSync(join(out, 'screenshots')).filter((f) => !f.startsWith('.'));
if (shots.length < 3) {
  console.error(`screenshots/: found ${shots.length}, need at least 3 real renders of the game`);
  process.exit(1);
}
for (const shot of shots) {
  const size = statSync(join(out, 'screenshots', shot)).size;
  if (size > MAX_SHOT_BYTES) {
    console.error(`screenshots/${shot} is ${size} bytes — over the ${MAX_SHOT_BYTES} cap, re-encode it smaller`);
    process.exit(1);
  }
}
// The game itself must be there too: an entry with no playable index.html
// is not a game, whatever the screenshots show.
if (!existsSync(join(out, 'game', 'index.html'))) {
  console.error('game/index.html is missing — nothing to play');
  process.exit(1);
}
const indexHtml = readFileSync(join(out, 'game', 'index.html'), 'utf8');
if (!indexHtml.includes('./src/main.js')) {
  console.error('game/index.html does not load ./src/main.js — the game would open to a blank page');
  process.exit(1);
}
// Screenshots must be JPEGs: the scorer counts on small files, and a PNG
// of a full game frame would blow the 256 KiB cap. The extension is checked
// below; the first three bytes are checked here, so a misnamed PNG cannot
// slip through as a JPEG.
for (const shot of shots) {
  if (!/\.jpe?g$/i.test(shot)) {
    console.error(`screenshots/${shot} is not a JPEG — re-encode it as one`);
    process.exit(1);
  }
  const head = readFileSync(join(out, 'screenshots', shot)).subarray(0, 3);
  if (head[0] !== 0xff || head[1] !== 0xd8 || head[2] !== 0xff) {
    console.error(`screenshots/${shot} does not start with JPEG magic bytes — re-encode it as a real JPEG`);
    process.exit(1);
  }
}
const srcFiles = readdirSync(join(out, 'game', 'src')).filter((f) => f.endsWith('.js'));
if (srcFiles.length === 0) {
  console.error('game/src/ holds no JavaScript — nothing to run');
  process.exit(1);
}

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: MAX_SHOT_BYTES },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
if (Buffer.byteLength(dossier, 'utf8') > MAX_DOSSIER_BYTES) {
  console.error(`dossier.json would be over the ${MAX_DOSSIER_BYTES} cap — the game text is too long`);
  process.exit(1);
}
writeFileSync(join(out, 'dossier.json'), dossier);

const gameBytes = readdirSync(join(out, 'game'), { recursive: true })
  .reduce((sum, f) => sum + (statSync(join(out, 'game', f)).isFile() ? statSync(join(out, 'game', f)).size : 0), 0);
const shotSizes = shots.sort().map((s) => `${s} ${(statSync(join(out, 'screenshots', s)).size / 1024).toFixed(0)} KiB`).join(', ');
console.log(`handed in ${shots.length} screenshots: ${shotSizes}`);
console.log(`game/: ${srcFiles.length} source files, ${(gameBytes / 1024).toFixed(0)} KiB; dossier ${(Buffer.byteLength(dossier, 'utf8') / 1024).toFixed(0)} KiB — ready to submit`);
