// City generation and spatial queries. Grid of blocks separated by roads.
import { CFG, LANDMARKS } from './config.js';
import { RNG } from './random.js';

export function roadCenter(i) {
  return i * CFG.pitch + CFG.road / 2;
}

export function isRoad(x, y) {
  const p = CFG.pitch;
  const mx = ((x % p) + p) % p;
  const my = ((y % p) + p) % p;
  return mx < CFG.road || my < CFG.road;
}

export function blockCenter(bx, by) {
  return { x: bx * CFG.pitch + CFG.road + CFG.block / 2, y: by * CFG.pitch + CFG.road + CFG.block / 2 };
}

export function landmarkPos(name) {
  const lm = LANDMARKS[name];
  return blockCenter(lm.bx, lm.by);
}

// Nearest point on the road network to (x, y): snap to the closest road strip.
export function nearestRoadPoint(x, y) {
  const p = CFG.pitch;
  const rx = Math.round((x - CFG.road / 2) / p) * p + CFG.road / 2;
  const ry = Math.round((y - CFG.road / 2) / p) * p + CFG.road / 2;
  const dx = Math.abs(rx - x);
  const dy = Math.abs(ry - y);
  // Stay on a road: pick the nearer road axis, keep the other coordinate.
  if (dx < dy) return { x: rx, y: Math.max(40, Math.min(CFG.world - 40, y)) };
  return { x: Math.max(40, Math.min(CFG.world - 40, x)), y: ry };
}

export function randomRoadPoint(rng) {
  const i = rng.int(0, CFG.grid);
  const j = rng.int(0, CFG.grid);
  if (rng.chance(0.5)) return { x: roadCenter(i), y: rng.range(40, CFG.world - 40) };
  return { x: rng.range(40, CFG.world - 40), y: roadCenter(j) };
}

export function buildCity(seed) {
  const rng = new RNG(seed * 7919 + 13);
  const buildings = [];
  const trees = [];
  const palette = ['#b98d5f', '#a87f6a', '#7d8aa0', '#9a8f7a', '#6f7f8a', '#c2a878'];
  for (let bx = 0; bx < CFG.grid; bx++) {
    for (let by = 0; by < CFG.grid; by++) {
      const x0 = bx * CFG.pitch + CFG.road + 16;
      const y0 = by * CFG.pitch + CFG.road + 16;
      const w0 = CFG.block - 32;
      const h0 = CFG.block - 32;
      const n = rng.chance(0.35) ? 2 : 1;
      for (let k = 0; k < n; k++) {
        const w = n === 1 ? w0 * rng.range(0.5, 0.8) : w0 * rng.range(0.35, 0.45);
        const h = n === 1 ? h0 * rng.range(0.5, 0.8) : h0 * rng.range(0.35, 0.45);
        const x = x0 + (n === 1 ? (w0 - w) / 2 : k === 0 ? 0 : w0 - w);
        const y = y0 + (n === 1 ? (h0 - h) / 2 : k === 0 ? 0 : h0 - h);
        buildings.push({ x, y, w, h, color: rng.pick(palette), roof: rng.chance(0.5) });
      }
      if (rng.chance(0.6)) {
        trees.push({ x: x0 + rng.range(0, w0), y: y0 + rng.range(0, h0), r: rng.range(8, 14) });
      }
    }
  }
  // Landmark blocks are open ground (hideout, shops, mission spots): clear
  // any building overlapping them so the player can always stand there.
  const spots = [
    landmarkPos('hideout'), landmarkPos('marina'), landmarkPos('pier'),
    landmarkPos('harbor'), landmarkPos('pitstop'), landmarkPos('gunbarn'),
    landmarkPos('taxistand'), landmarkPos('runner'),
  ];
  for (const s of spots) {
    for (let i = buildings.length - 1; i >= 0; i--) {
      const b = buildings[i];
      if (b.x < s.x + 130 && b.x + b.w > s.x - 130 && b.y < s.y + 130 && b.y + b.h > s.y - 130) {
        buildings.splice(i, 1);
      }
    }
  }
  return { buildings, trees };
}

// Circle vs building AABBs: returns true when the circle overlaps any building.
export function hitsBuilding(x, y, r, city) {
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - cx;
    const dy = y - cy;
    if (dx * dx + dy * dy < r * r) return true;
  }
  return false;
}

// Move with axis-separated sliding against buildings and the world edge.
export function moveBody(x, y, dx, dy, r, city) {
  const W = CFG.world;
  let nx = x + dx;
  if (!hitsBuilding(nx, y, r, city)) x = nx;
  x = Math.max(r + 4, Math.min(W - r - 4, x));
  let ny = y + dy;
  if (!hitsBuilding(x, ny, r, city)) y = ny;
  y = Math.max(r + 4, Math.min(W - r - 4, y));
  return { x, y };
}
