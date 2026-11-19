// SOLMAR STREETS — city generation: road grid, buildings, landmarks.
// Written fresh for round 9 (rebuild7).
import { WORLD, CITY, pick } from './config.js';

/** Road centerline coordinate for road index i (0..BLOCKS). */
export function roadCenter(i) {
  return i * (WORLD.BLOCK + WORLD.ROAD) + WORLD.ROAD / 2;
}

const BUILDING_COLORS = ['#7d8a99', '#8a7f72', '#6f7f6a', '#93806a', '#5f6f8a', '#a08a7a', '#77877f', '#8d7d8d'];

export function buildCity(rng) {
  const buildings = [];
  for (let bx = 0; bx < WORLD.BLOCKS; bx++) {
    for (let by = 0; by < WORLD.BLOCKS; by++) {
      const x0 = roadCenter(bx) + WORLD.ROAD / 2 + 8;
      const y0 = roadCenter(by) + WORLD.ROAD / 2 + 8;
      const bw = WORLD.BLOCK - 16;
      const bh = WORLD.BLOCK - 16;
      const n = 1 + Math.floor(rng() * 2); // 1-2 buildings per block
      for (let k = 0; k < n; k++) {
        const w = bw * (n === 1 ? 0.72 : 0.42);
        const h = bh * (n === 1 ? 0.6 : 0.42);
        const x = x0 + (n === 1 ? bw * 0.14 : k * (bw * 0.5) + 4);
        const y = y0 + (n === 1 ? bh * 0.2 : 6 + k * 4);
        buildings.push({
          x, y, w, h,
          color: pick(rng, BUILDING_COLORS),
          shade: 0.75 + rng() * 0.25,
          windows: 2 + Math.floor(rng() * 4),
        });
      }
    }
  }
  const blockCenter = (bx, by) => ({
    x: roadCenter(bx) + WORLD.ROAD / 2 + WORLD.BLOCK / 2,
    y: roadCenter(by) + WORLD.ROAD / 2 + WORLD.BLOCK / 2,
  });
  // Landmarks: fixed blocks so missions always find them.
  const landmarks = {
    home: { ...blockCenter(1, 5), name: 'Home' },
    vera: { ...blockCenter(1, 5), name: 'Vera' },
    harbor: { x: CITY - 60, y: roadCenter(2), name: 'Harbor' },
    bank: { ...blockCenter(4, 1), name: 'Solmar Bank' },
    plaza: { ...blockCenter(3, 3), name: 'Rooftop Plaza' },
    pitstop: { x: roadCenter(2), y: roadCenter(4) + WORLD.ROAD / 2 + 30, name: 'Pit Stop' },
    gunbarn: { x: roadCenter(5), y: roadCenter(4) + WORLD.ROAD / 2 + 30, name: 'Gun Barn' },
    diner: { x: roadCenter(1), y: roadCenter(2) + WORLD.ROAD / 2 + 30, name: 'Diner' },
    taxistand: { x: roadCenter(3), y: CITY - WORLD.ROAD / 2, name: 'Taxi Stand South' },
  };
  return { size: CITY, buildings, landmarks };
}

/** Push a circle (x,y,r) out of every building rect it overlaps. Returns corrected {x,y}. */
export function collideBuildings(city, x, y, r) {
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - cx, dy = y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      if (d2 === 0) { x = b.x - r; continue; }
      const d = Math.sqrt(d2);
      x = cx + (dx / d) * r;
      y = cy + (dy / d) * r;
    }
  }
  return { x, y };
}

/** A random point on a road centerline. */
export function randomRoadPoint(rng) {
  const i = Math.floor(rng() * (WORLD.BLOCKS + 1));
  const j = Math.floor(rng() * (WORLD.BLOCKS + 1));
  if (rng() < 0.5) return { x: roadCenter(i), y: 40 + rng() * (CITY - 80) };
  return { x: 40 + rng() * (CITY - 80), y: roadCenter(j) };
}

/** Nearest road centerline point to (x,y) — used for traffic waypoints. */
export function nearestRoadPoint(x, y) {
  let best = null, bd = Infinity;
  for (let i = 0; i <= WORLD.BLOCKS; i++) {
    const c = roadCenter(i);
    const d1 = Math.abs(x - c), d2 = Math.abs(y - c);
    if (d1 < bd) { bd = d1; best = { x: c, y }; }
    if (d2 < bd) { bd = d2; best = { x, y: c }; }
  }
  return best;
}
