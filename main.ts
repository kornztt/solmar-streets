// SOLMAR STREETS — dossier builder (Node 22, standard library only).
//
// This program hands the entry in: it copies the playable game and the
// screenshots beside this file into the output directory, then asks the
// vendored make.fun library to write the dossier summary the judge reads.
//
// Where things live is worked out from this file's own location, never from
// the process working directory: the grader may launch the program from
// anywhere, and a relative path would point at the wrong place. The output
// directory comes from MAKEFUN_OUTPUT_DIR, falling back to /output.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// The directory holding this file, resolved from its own URL.
const entryDir = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outputDir, { recursive: true });
cpSync(join(entryDir, 'game'), join(outputDir, 'game'), { recursive: true });
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
if (existsSync(join(entryDir, 'screenshots'))) {
  cpSync(join(entryDir, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });
}

// The scorer's caps: at most 4 screenshots of 256 KiB each, at most 993
// files in game/ totalling 48 MiB, and a 160 KiB text budget for the dossier.
const dossier = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});

writeFileSync(join(outputDir, 'dossier.json'), dossier);
console.log(`dossier written: ${join(outputDir, 'dossier.json')} (${dossier.length} bytes)`);
