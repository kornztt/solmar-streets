// SOLMAR STREETS — the city itself: roads, blocks, buildings, the beach,
// the docks, the park, trees and parked cars. One clear job: build the map
// the rest of the game drives around, and answer collision questions about it.

import { ROADS, DISTRICTS, WORLD, PLACES } from './config.js';

const PARK = { x: 1500, y: 700, w: 400, h: 400 }; // the block that stays green
const DOCKS_X0 = 3250; // east of this is Portside concrete, not blocks
const FOUNTAIN = { x: 1700, y: 900, r: 42 }; // the park fountain, a round obstacle
const LIGHTHOUSE = { x: 3520, y: 2560, r: 16 }; // the lighthouse on the sand
const PIER = { x: 3380, y: 2480, w: 60, h: 180 }; // the wooden pier into the sea

function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d;
  }
  return DISTRICTS[0];
}

function shade(hex, f) {
  const n = Number.parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.max(0, Math.round(((n >> 16) & 255) * f)));
  const g = Math.min(255, Math.max(0, Math.round(((n >> 8) & 255) * f)));
  const b = Math.min(255, Math.max(0, Math.round((n & 255) * f)));
  return `rgb(${r},${g},${b})`;
}

/** Build the whole city from the seed. Deterministic: same seed, same Solmar. */
export function createCity(rng) {
  const city = {
    buildings: [],
    trees: [],
    containers: [],
    parked: [],
    lamps: [], // streetlights along the roads, visual only
    benches: [], // park benches around the fountain
    umbrellas: [], // beach umbrellas along the sand, visual only
    roadLines: [], // {x1,y1,x2,y2} dashes for lane paint, drawn on the ground layer
    fountain: FOUNTAIN,
    lighthouse: LIGHTHOUSE,
    pier: PIER,
  };
  const half = ROADS.width / 2;

  // Blocks: the rectangles between neighbouring avenues and streets.
  const xs = [0, ...ROADS.avenues, WORLD.width];
  const ys = [0, ...ROADS.streets, ROADS.coastalY, WORLD.height];
  for (let bi = 0; bi < xs.length - 1; bi += 1) {
    for (let bj = 0; bj < ys.length - 1; bj += 1) {
      const x0 = xs[bi] + half + 14;
      const x1 = xs[bi + 1] - half - 14;
      const y0 = ys[bj] + half + 14;
      const y1 = ys[bj + 1] - half - 14;
      if (x1 - x0 < 60 || y1 - y0 < 60) continue;
      if (x0 >= DOCKS_X0 || y0 >= ROADS.beachTop) continue; // docks and beach are not blocks
      // The park block stays a park.
      if (x0 >= PARK.x - 1 && y0 >= PARK.y - 1 && x1 <= PARK.x + PARK.w + 1 && y1 <= PARK.y + PARK.h + 1) {
        for (let t = 0; t < 16; t += 1) {
          city.trees.push({ x: rng.range(x0 + 20, x1 - 20), y: rng.range(y0 + 20, y1 - 20), r: rng.range(10, 16) });
        }
        // Benches in a ring around the fountain.
        for (let a = 0; a < Math.PI * 2; a += Math.PI / 3) {
          city.benches.push({ x: FOUNTAIN.x + Math.cos(a) * 78, y: FOUNTAIN.y + Math.sin(a) * 78, angle: a + Math.PI / 2 });
        }
        continue;
      }
      const d = districtAt((x0 + x1) / 2, (y0 + y1) / 2);
      const hills = d.name === 'The Hills';
      const count = hills ? rng.int(2, 3) : rng.int(2, 4);
      for (let i = 0; i < count; i += 1) {
        const w = hills ? rng.range(90, 130) : rng.range(70, Math.min(150, (x1 - x0) * 0.42));
        const h = hills ? rng.range(70, 110) : rng.range(60, Math.min(130, (y1 - y0) * 0.42));
        const x = rng.range(x0, Math.max(x0 + 1, x1 - w));
        const y = rng.range(y0, Math.max(y0 + 1, y1 - h));
        const style = hills ? 'house' : d.name === 'Downtown' ? 'tower' : d.name === 'Old Town' ? 'brick' : 'warehouse';
        city.buildings.push({
          x, y, w, h,
          color: shade(d.roof, rng.range(0.85, 1.15)),
          trim: shade(d.accent, rng.range(0.8, 1.1)),
          style,
          tall: style === 'tower' && rng.chance(0.4),
        });
      }
      // A few street trees per block.
      for (let t = 0; t < rng.int(1, 3); t += 1) {
        city.trees.push({ x: rng.range(x0, x1), y: rng.range(y0, y1), r: rng.range(8, 13) });
      }
    }
  }

  // Portside: container stacks and warehouse slabs on the concrete. Rust-red
  // and sea-blue boxes dominate the docks; the rare purple one is a landmark.
  for (let i = 0; i < 26; i += 1) {
    const x = rng.range(DOCKS_X0 + 30, WORLD.width - 120);
    const y = rng.range(220, ROADS.coastalY - 160);
    if (Math.abs(x - PLACES.docks.x) < 160 && Math.abs(y - PLACES.docks.y) < 160) continue;
    city.containers.push({
      x, y, w: rng.range(60, 110), h: rng.range(26, 34),
      color: rng.weightedPick([['#b0402f', 4], ['#2e6fb0', 4], ['#c08a2e', 3], ['#3f6b4f', 3], ['#7d4a8a', 1]]),
    });
  }
  // A couple of warehouse slabs the player can hide behind.
  city.buildings.push({ x: 3300, y: 500, w: 180, h: 120, color: '#8a8f96', trim: '#6f747b', style: 'warehouse', tall: false });
  city.buildings.push({ x: 3300, y: 1500, w: 200, h: 140, color: '#7d8a96', trim: '#5f6a75', style: 'warehouse', tall: false });

  // Beach trees along the boulevard.
  for (let x = 200; x < WORLD.width - 100; x += rng.range(120, 220)) {
    city.trees.push({ x, y: rng.range(ROADS.coastalY + 40, ROADS.beachTop - 20), r: rng.range(9, 14) });
  }

  // Beach umbrellas on the sand, in alternating red and yellow — the beach
  // reads as a beach from the minimap, not just a tan strip.
  const umbrellaColors = ['#e05252', '#ffd23f', '#e05252', '#2e8fc0'];
  for (let x = 260; x < WORLD.width - 200; x += rng.range(130, 220)) {
    city.umbrellas.push({
      x,
      y: rng.range(ROADS.beachTop + 40, WORLD.height - 60),
      color: umbrellaColors[Math.floor(rng.next() * umbrellaColors.length)],
      r: rng.range(10, 15),
    });
  }

  // Streetlights: one every ~240 px along each avenue and street, on the
  // right-hand sidewalk. Visual only — they never block movement.
  for (const ax of ROADS.avenues) {
    for (let y = 200; y < ROADS.coastalY - 100; y += 240) {
      city.lamps.push({ x: ax + half + 8, y });
    }
  }
  for (const st of ROADS.streets) {
    for (let x = 200; x < DOCKS_X0 - 100; x += 240) {
      city.lamps.push({ x, y: st + half + 8 });
    }
  }

  // Parked cars along the avenues and streets, on the shoulder. Dealt from
  // a shuffled deck so the mix never clumps on one model.
  const deck = rng.shuffle(['sedan', 'sedan', 'sedan', 'pickup', 'van', 'sedan', 'taxi', 'falcon', 'sedan', 'pickup']);
  let dealt = 0;
  const deal = () => deck[dealt++ % deck.length];
  for (const ax of ROADS.avenues) {
    for (let i = 0; i < 5; i += 1) {
      const y = rng.range(200, ROADS.coastalY - 100);
      const side = rng.chance(0.5) ? -1 : 1;
      city.parked.push({
        x: ax + side * (half - 14), y,
        angle: side > 0 ? Math.PI / 2 : -Math.PI / 2,
        model: deal(),
      });
    }
  }
  for (const st of ROADS.streets) {
    for (let i = 0; i < 4; i += 1) {
      const x = rng.range(200, DOCKS_X0 - 100);
      const side = rng.chance(0.5) ? -1 : 1;
      city.parked.push({
        x, y: st + side * (half - 14),
        angle: side > 0 ? 0 : Math.PI,
        model: deal(),
      });
    }
  }
  // The hero car: a red Comet GT on Palma Blvd, waiting to be stolen.
  city.parked.push({ x: PLACES.comet.x, y: PLACES.comet.y, angle: 0, model: 'comet', hero: true });

  return city;
}

/** True when the point is on a road (drivable), beach road included. */
export function isOnRoad(x, y) {
  const half = ROADS.width / 2;
  if (y >= ROADS.coastalY - half && y <= ROADS.coastalY + half) return true;
  for (const ax of ROADS.avenues) if (Math.abs(x - ax) <= half) return true;
  for (const st of ROADS.streets) if (Math.abs(y - st) <= half) return true;
  return false;
}

/** A random point on a road, for spawning traffic and police. */
export function randomRoadPoint(rng) {
  if (rng.chance(0.5)) {
    const ax = rng.pick(ROADS.avenues);
    return { x: ax + rng.range(-26, 26), y: rng.range(120, ROADS.coastalY - 60), axis: 'v', road: ax };
  }
  const st = rng.pick(ROADS.streets);
  return { x: rng.range(120, DOCKS_X0 - 60), y: st + rng.range(-26, 26), axis: 'h', road: st };
}

/** The nearest road centre to a point, used to drop police onto the grid. */
export function nearestRoadPoint(x, y) {
  let best = null;
  let bestD = Infinity;
  for (const ax of ROADS.avenues) {
    const d = Math.abs(x - ax);
    if (d < bestD) { bestD = d; best = { x: ax, y, axis: 'v', road: ax }; }
  }
  for (const st of ROADS.streets) {
    const d = Math.abs(y - st);
    if (d < bestD) { bestD = d; best = { x, y: st, axis: 'h', road: st }; }
  }
  return best;
}

/** Right-hand lane offset for a road and a direction of travel. */
export function laneOffset(axis, dir) {
  // Driving down (+y) keeps right at +x; driving right (+x) keeps right at +y.
  if (axis === 'v') return dir > 0 ? 20 : -20;
  return dir > 0 ? 20 : -20;
}

/** Push a circle out of a round obstacle (the fountain, the lighthouse). */
function pushCircle(px, py, r, cx, cy, cr) {
  const dx = px - cx;
  const dy = py - cy;
  const d = Math.sqrt(dx * dx + dy * dy);
  const min = r + cr;
  if (d >= min) return { x: px, y: py };
  if (d > 0.0001) return { x: cx + (dx / d) * min, y: cy + (dy / d) * min };
  return { x: cx + min, y: cy };
}

/** Push a circle out of every building and container it overlaps. */
export function resolveCityCollision(city, x, y, r) {
  let px = x;
  let py = y;
  const push = (bx, by, bw, bh) => {
    const cx = Math.max(bx, Math.min(px, bx + bw));
    const cy = Math.max(by, Math.min(py, by + bh));
    const dx = px - cx;
    const dy = py - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 >= r * r) return;
    if (d2 > 0.0001) {
      const d = Math.sqrt(d2);
      px = cx + (dx / d) * r;
      py = cy + (dy / d) * r;
    } else {
      // Dead centre: push out along the smallest penetration.
      const left = px - bx;
      const right = bx + bw - px;
      const top = py - by;
      const bottom = by + bh - py;
      const m = Math.min(left, right, top, bottom);
      if (m === left) px = bx - r;
      else if (m === right) px = bx + bw + r;
      else if (m === top) py = by - r;
      else py = by + bh + r;
    }
  };
  for (const b of city.buildings) {
    if (px > b.x - r && px < b.x + b.w + r && py > b.y - r && py < b.y + b.h + r) push(b.x, b.y, b.w, b.h);
  }
  for (const c of city.containers) {
    if (px > c.x - r && px < c.x + c.w + r && py > c.y - r && py < c.y + c.h + r) push(c.x, c.y, c.w, c.h);
  }
  // Round obstacles: the park fountain and the lighthouse.
  const f = pushCircle(px, py, r, city.fountain.x, city.fountain.y, city.fountain.r);
  px = f.x;
  py = f.y;
  const l = pushCircle(px, py, r, city.lighthouse.x, city.lighthouse.y, city.lighthouse.r);
  px = l.x;
  py = l.y;
  // The sea is not drivable and not walkable.
  if (py > ROADS.waterTop - r) py = ROADS.waterTop - r;
  // The world edge is a wall.
  px = Math.max(r, Math.min(WORLD.width - r, px));
  py = Math.max(r, Math.min(WORLD.height - r, py));
  return { x: px, y: py };
}

/** True when a circle overlaps any building, container or round obstacle. */
export function hitsCity(city, x, y, r) {
  for (const b of city.buildings) {
    if (x > b.x - r && x < b.x + b.w + r && y > b.y - r && y < b.y + b.h + r) return true;
  }
  for (const c of city.containers) {
    if (x > c.x - r && x < c.x + c.w + r && y > c.y - r && y < c.y + c.h + r) return true;
  }
  const df = Math.hypot(x - city.fountain.x, y - city.fountain.y);
  if (df < r + city.fountain.r) return true;
  const dl = Math.hypot(x - city.lighthouse.x, y - city.lighthouse.y);
  if (dl < r + city.lighthouse.r) return true;
  return false;
}
