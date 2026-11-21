// The city of Solmar: 9 x 9 blocks on a road grid, distinct districts,
// a harbor bay, a park lake, trees, shops and the Rooftop Plaza landmark.

import { WORLD, DISTRICTS, districtAt, SHOPS } from './config.js';
import { mulberry32, pick, range, intRange } from './random.js';

export function roadCenters() {
  const out = [];
  for (let i = 0; i < 9; i++) out.push(200 + i * WORLD.roadGap);
  return out;
}

export function buildWorld(seed) {
  const rng = mulberry32(seed);
  const roads = roadCenters();
  const buildings = [];
  const trees = [];
  const water = [];
  const lamps = [];

  // Harbor bay: the far south-east corner is open water with a dock edge.
  water.push({ x: 3200, y: 3200, w: 400, h: 400, kind: 'bay' });
  // Park lake in Parkside block (1,1).
  water.push({ x: 760, y: 760, w: 220, h: 170, kind: 'lake' });

  const inWater = (x, y, w, h) => water.some((wa) => x < wa.x + wa.w && x + w > wa.x && y < wa.y + wa.h && y + h > wa.y);

  for (let bx = 0; bx < 9; bx++) {
    for (let by = 0; by < 9; by++) {
      const d = districtAt(bx, by);
      const x0 = 232 + bx * WORLD.roadGap;
      const y0 = 232 + by * WORLD.roadGap;
      const w = WORLD.block;
      const h = WORLD.block;
      if (d.kind === 'park') {
        // Park: lawns, paths and trees; the lake block stays clear.
        const n = intRange(rng, 14, 20);
        for (let i = 0; i < n; i++) {
          const tx = range(rng, x0 + 10, x0 + w - 10);
          const ty = range(rng, y0 + 10, y0 + h - 10);
          if (!inWater(tx - 8, ty - 8, 16, 16)) trees.push({ x: tx, y: ty, r: range(rng, 9, 15) });
        }
        continue;
      }
      if (d.kind === 'docks' && bx >= 7 && by >= 7) {
        // Harbor blocks are mostly water; leave a dock strip with containers.
        const dockA = { x: x0 + 20, y: y0 + 20, w: 120, h: 60, hgt: 14, color: '#7a6a4a', kind: 'dock', roof: '#8a7a5a' };
        const dockB = { x: x0 + 180, y: y0 + 120, w: 100, h: 50, hgt: 12, color: '#6a7a8a', kind: 'dock', roof: '#7a8a9a' };
        if (!inWater(dockA.x, dockA.y, dockA.w, dockA.h)) buildings.push(dockA);
        if (!inWater(dockB.x, dockB.y, dockB.w, dockB.h)) buildings.push(dockB);
        continue;
      }
      const count = d.kind === 'towers' ? 1 : d.kind === 'houses' ? 3 : intRange(rng, 2, 3);
      for (let i = 0; i < count; i++) {
        let bw, bh, bx2, by2;
        if (d.kind === 'towers') {
          bw = range(rng, 220, 280); bh = range(rng, 220, 280);
          bx2 = x0 + (w - bw) / 2; by2 = y0 + (h - bh) / 2;
        } else if (d.kind === 'houses') {
          bw = range(rng, 70, 110); bh = range(rng, 60, 100);
          bx2 = x0 + 20 + (i % 2) * 160 + range(rng, 0, 30);
          by2 = y0 + 20 + Math.floor(i / 2) * 160 + range(rng, 0, 30);
        } else {
          bw = range(rng, 110, 170); bh = range(rng, 100, 160);
          bx2 = x0 + 16 + (i % 2) * 170 + range(rng, -8, 8);
          by2 = y0 + 16 + Math.floor(i / 2) * 170 + range(rng, -8, 8);
        }
        if (inWater(bx2, by2, bw, bh)) continue;
        const color = pick(rng, d.roof);
        const hgt = d.kind === 'towers' ? intRange(rng, 40, 90) : d.kind === 'brick' ? intRange(rng, 18, 30) : intRange(rng, 10, 22);
        buildings.push({ x: bx2, y: by2, w: bw, h: bh, hgt, color, kind: d.kind, roof: color });
      }
      // A few street trees on mixed blocks.
      if (d.kind === 'mixed' || d.kind === 'shops') {
        for (let i = 0; i < 3; i++) {
          trees.push({ x: range(rng, x0 + 10, x0 + w - 10), y: range(rng, y0 + 10, y0 + h - 10), r: range(rng, 7, 11) });
        }
      }
    }
  }

  // Rooftop Plaza: the downtown landmark — a wide plaza tower with a helipad.
  const plaza = { x: 1620, y: 1620, w: 260, h: 260, hgt: 70, color: '#2a3a5a', kind: 'plaza', roof: '#3a5a8a' };
  // Remove any building overlapping the plaza footprint, then add it.
  for (let i = buildings.length - 1; i >= 0; i--) {
    const b = buildings[i];
    if (b.x < plaza.x + plaza.w && b.x + b.w > plaza.x && b.y < plaza.y + plaza.h && b.y + b.h > plaza.y) buildings.splice(i, 1);
  }
  buildings.push(plaza);

  // Street lamps along every road, every 200 px.
  for (const rx of roads) {
    for (let y = 200; y <= WORLD.size; y += 200) {
      lamps.push({ x: rx + WORLD.roadWidth / 2 + 8, y });
      lamps.push({ x: rx - WORLD.roadWidth / 2 - 8, y: y + 100 });
    }
  }

  const shops = SHOPS.map((s) => ({ ...s, items: s.items.map((it) => ({ ...it })) }));

  return { seed, roads, buildings, trees, water, lamps, shops, plaza, size: WORLD.size };
}

// Circle-vs-building/water collision. Returns the push-out vector or null.
export function collide(world, x, y, r) {
  for (const b of world.buildings) {
    const cx = Math.max(b.x, Math.min(x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - cx, dy = y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      const d = Math.sqrt(d2) || 0.01;
      return { x: (dx / d) * (r - d), y: (dy / d) * (r - d) };
    }
  }
  for (const wa of world.water) {
    const cx = Math.max(wa.x, Math.min(x, wa.x + wa.w));
    const cy = Math.max(wa.y, Math.min(y, wa.y + wa.h));
    const dx = x - cx, dy = y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      const d = Math.sqrt(d2) || 0.01;
      return { x: (dx / d) * (r - d), y: (dy / d) * (r - d) };
    }
  }
  return null;
}

export function blockedAt(world, x, y, r) {
  return collide(world, x, y, r) !== null;
}

// A random point on a road (for spawning traffic / peds).
export function randomRoadPoint(rng, world) {
  const horizontal = rng() < 0.5;
  const road = world.roads[Math.floor(rng() * world.roads.length)];
  const along = 120 + rng() * (world.size - 240);
  return horizontal ? { x: along, y: road } : { x: road, y: along };
}

// Nearest point on any road centreline.
export function nearestRoad(world, x, y) {
  let best = null, bestD = Infinity;
  for (const rx of world.roads) {
    const d = Math.abs(x - rx);
    if (d < bestD) { bestD = d; best = { x: rx, y }; }
  }
  for (const ry of world.roads) {
    const d = Math.abs(y - ry);
    if (d < bestD) { bestD = d; best = { x, y: ry }; }
  }
  return best;
}
