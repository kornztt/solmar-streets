// The city of Solmar: a road grid, buildings, two parks, the dockyard and
// the named zones. Generation is seeded, so the same seed builds the same city.
import { ROAD_X, ROAD_Y, ROAD_HALF, WORLD_W, WORLD_H, COLORS, ZONES } from './config.js';
import { RNG, clamp } from './random.js';

export function buildCity(seed) {
  const rng = new RNG(seed);
  const buildings = [];
  const parks = [];
  const containers = [];

  // Block bounds between neighbouring roads.
  const blockXs = [];
  for (let i = 0; i < ROAD_X.length - 1; i += 1) {
    blockXs.push([ROAD_X[i] + ROAD_HALF + 14, ROAD_X[i + 1] - ROAD_HALF - 14]);
  }
  const blockYs = [];
  for (let i = 0; i < ROAD_Y.length - 1; i += 1) {
    blockYs.push([ROAD_Y[i] + ROAD_HALF + 14, ROAD_Y[i + 1] - ROAD_HALF - 14]);
  }

  // Two parks and two shop lots replace buildings in fixed blocks.
  const parkBlocks = ['1,1', '5,3'];
  const lotBlocks = { '2,1': 'pitstop', '5,2': 'gunbarn' };
  // The hideout block (south-west, between roads x 200-600, y 1800-2000)
  // is reserved: Mara's building goes there instead of random ones.
  const hideoutBlock = '0,4';

  for (let bx = 0; bx < blockXs.length; bx += 1) {
    for (let by = 0; by < blockYs.length; by += 1) {
      const key = bx + ',' + by;
      const [x0, x1] = blockXs[bx];
      const [y0, y1] = blockYs[by];
      if (parkBlocks.includes(key)) {
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0, trees: [] });
        const park = parks[parks.length - 1];
        for (let t = 0; t < 12; t += 1) {
          park.trees.push({ x: rng.range(x0 + 20, x1 - 20), y: rng.range(y0 + 20, y1 - 20), r: rng.range(9, 15) });
        }
        continue;
      }
      if (lotBlocks[key]) continue;
      if (key === hideoutBlock) continue;
      // One or two buildings per block, inset from the block edge.
      const count = rng.chance(0.55) ? 2 : 1;
      for (let b = 0; b < count; b += 1) {
        const bw = rng.range(90, 190);
        const bh = rng.range(70, 150);
        const bx0 = count === 1
          ? x0 + (x1 - x0 - bw) / 2
          : x0 + 10 + b * ((x1 - x0 - bw - 20) / Math.max(1, count - 1));
        const by0 = y0 + (y1 - y0 - bh) / 2 + rng.range(-12, 12);
        buildings.push({
          x: bx0, y: by0, w: bw, h: bh,
          color: rng.pick(COLORS.building),
          roof: rng.pick(COLORS.roof),
          windows: rng.int(2, 5),
        });
      }
    }
  }

  // The hideout itself: a solid building in its reserved block, matching
  // the landmark the renderer draws at ZONES.hideout.
  buildings.push({
    x: ZONES.hideout.x - 55, y: ZONES.hideout.y - 38, w: 110, h: 76,
    color: '#7a4a6e', roof: '#5e3656', windows: 3,
  });

  // Dockyard: containers stacked east of the last road, water at the edge.
  for (let i = 0; i < 14; i += 1) {
    containers.push({
      x: rng.range(3050, 3120), y: 740 + i * 62 + rng.range(-8, 8),
      w: 56, h: 26, color: rng.pick(COLORS.container),
    });
  }

  return {
    seed,
    buildings,
    parks,
    containers,
    water: { x: 3150, y: 0, w: WORLD_W - 3150, h: WORLD_H },
    docks: { x: 3040, y: 700, w: 130, h: 1000 },
    zones: ZONES,
  };
}

// True when the point is on a road (inside the asphalt band).
export function isOnRoad(x, y) {
  for (const rx of ROAD_X) if (Math.abs(x - rx) <= ROAD_HALF) return true;
  for (const ry of ROAD_Y) if (Math.abs(y - ry) <= ROAD_HALF) return true;
  return false;
}

// The building rect a circle overlaps, or null. r is the circle radius.
export function buildingAt(city, x, y, r) {
  for (const b of city.buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return b;
  }
  return null;
}

// Push a circle out of buildings and the world edge; returns corrected x/y.
export function collideCircle(city, x, y, r) {
  let nx = clamp(x, r, WORLD_W - r);
  let ny = clamp(y, r, WORLD_H - r);
  for (let pass = 0; pass < 2; pass += 1) {
    const b = buildingAt(city, nx, ny, r);
    if (!b) break;
    const left = nx + r - b.x;
    const right = b.x + b.w - (nx - r);
    const top = ny + r - b.y;
    const bottom = b.y + b.h - (ny - r);
    const m = Math.min(left, right, top, bottom);
    if (m === left) nx = b.x - r;
    else if (m === right) nx = b.x + b.w + r;
    else if (m === top) ny = b.y - r;
    else ny = b.y + b.h + r;
  }
  // The dock water is solid too.
  if (nx > city.water.x - r) nx = city.water.x - r;
  return { x: nx, y: ny };
}

// A random point on a road, for spawning traffic, fares and police.
export function randomRoadPoint(rng) {
  if (rng.chance(0.5)) {
    return { x: rng.pick(ROAD_X) + rng.range(-20, 20), y: rng.range(120, WORLD_H - 120) };
  }
  return { x: rng.range(120, WORLD_W - 120), y: rng.pick(ROAD_Y) + rng.range(-20, 20) };
}

// The nearest point on the road grid to (x, y).
export function nearestRoadPoint(x, y) {
  let best = null;
  let bestD = Infinity;
  for (const rx of ROAD_X) {
    const d = Math.abs(x - rx);
    if (d < bestD) { bestD = d; best = { x: rx, y }; }
  }
  for (const ry of ROAD_Y) {
    const d = Math.abs(y - ry);
    if (d < bestD) { bestD = d; best = { x, y: ry }; }
  }
  return best;
}
