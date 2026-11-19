// SOLMAR STREETS — dossier builder entry point (Node 22, no build step).
// Run: MAKEFUN_OUTPUT_DIR=out node main.ts
import { buildDossier } from './vendor/makefun-game.ts';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const outDir = process.env.MAKEFUN_OUTPUT_DIR || 'out';
mkdirSync(outDir, { recursive: true });
const dossier = buildDossier('.', {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);
console.log(`dossier written: ${outDir}/dossier.json (${dossier.length} bytes)`);
