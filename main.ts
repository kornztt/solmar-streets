// SOLMAR STREETS — hand-in program for the make.fun gta6-01 bounty.
// Node 22, standard library only. It copies game/ and screenshots/ from
// beside this file into the output directory and writes dossier.json with
// the vendored make.fun library, so the judge can read the entry.
//
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const gameDir = join(here, 'game');
const shotsDir = join(here, 'screenshots');

// A screenshot must be a whole JPEG (magic bytes FF D8 FF) or PNG, and the
// gate refuses anything over 256 KiB, so check before copying anything.
function checkShots(dir) {
  const names = readdirSync(dir)
    .filter((n) => !n.startsWith('.'))
    .sort();
  if (names.length < 3 || names.length > 4) {
    throw new Error(`screenshots/: want 3 or 4 images, found ${names.length}`);
  }
  for (const name of names) {
    const file = join(dir, name);
    const size = statSync(file).size;
    if (size > 262144) throw new Error(`screenshots/${name} is ${size} bytes, over the 256 KiB cap`);
    const head = readFileSync(file, { start: 0, end: 3 });
    const isJpeg = head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
    const isPng = head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e;
    if (!isJpeg && !isPng) throw new Error(`screenshots/${name} is neither JPEG nor PNG`);
    console.log(`shot ${name}: ${Math.round(size / 1024)} KiB`);
  }
  return names;
}

if (!existsSync(join(gameDir, 'index.html'))) {
  throw new Error('game/index.html is missing');
}
checkShots(shotsDir);

mkdirSync(out, { recursive: true });
cpSync(gameDir, join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
cpSync(shotsDir, join(out, 'screenshots'), { recursive: true });

// The caps the scorer enforces: the dossier text budget, at most 4 shots,
// and the game tree limits. The dossier is built twice by the grader and
// must match byte for byte, so nothing here may vary between runs.
const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(out, 'dossier.json'), dossier);

const gameFiles = readdirSync(join(out, 'game'), { recursive: true }).length;
console.log(`handed in ${gameFiles} game entries, dossier ${Math.round(dossier.length / 1024)} KiB — ready to submit`);
