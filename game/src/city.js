// City generation for SOLMAR STREETS.
// The city is a GRID x GRID of blocks separated by roads. Every building,
// park and shop sits INSIDE a block — never on a road — so no mission NPC
// or hideout can ever spawn in traffic. All placement is seeded, so the
// same seed builds the same city on every machine.

import { BLOCK, ROAD, GRID, CITY, DISTRICTS } from './config.js';
import { mulberry32, range, int, pick, shuffle, dist } from './random.js';

// Centre of the road that runs along grid line i (0..GRID).
export function roadCenter(i) {
  return i * (BLOCK + ROAD) + ROAD / 2;
}

// Centre of block (bx, by) in world coordinates.
export function blockCenter(bx, by) {
  return {
    x: ROAD + bx * (BLOCK + ROAD) + BLOCK / 2,
    y: ROAD + by * (BLOCK + ROAD) + BLOCK / 2,
  };
}

// A point on a road, given a block corner and a small offset along the road.
export function roadPoint(bx, by, along = 0.5) {
  return {
    x: roadCenter(bx) + (along - 0.5) * ROAD * 0.6,
    y: roadCenter(by) + (along - 0.5) * ROAD * 0.6,
  };
}

export class City {
  constructor(seed) {
    this.seed = seed;
    this.rng = mulberry32(seed);
    this.size = CITY;
    this.blocks = []; // {bx, by, kind, buildings[], trees[], district}
    this.buildings = []; // flat list of {x, y, w, h, color, roof, height}
    this.sites = {}; // named places: hideout, pitstop, gunbarn, pier, taxiStand
    this.parkingSpots = []; // {x, y, angle} on-street parking bays
    this.build();
  }

  build() {
    const rng = this.rng;
    const districtOf = (bx, by) => {
      if (by >= GRID - 1) return 'Harbor';
      if (bx >= GRID - 2 && by >= GRID - 3) return 'The Docks';
      return pick(mulberry32(bx * 31 + by * 7 + this.seed), DISTRICTS);
    };

    for (let by = 0; by < GRID; by++) {
      for (let bx = 0; bx < GRID; bx++) {
        const c = blockCenter(bx, by);
        const kind = this.pickBlockKind(bx, by, rng);
        const block = { bx, by, kind, district: districtOf(bx, by), buildings: [], trees: [] };
        if (kind === 'park') {
          const n = int(rng, 5, 9);
          for (let i = 0; i < n; i++) {
            block.trees.push({
              x: c.x + range(rng, -BLOCK / 2 + 30, BLOCK / 2 - 30),
              y: c.y + range(rng, -BLOCK / 2 + 30, BLOCK / 2 - 30),
              r: range(rng, 12, 20),
            });
          }
        } else if (kind === 'lot') {
          // Open parking lot: painted bays, no buildings.
          for (let i = 0; i < 6; i++) {
            this.parkingSpots.push({
              x: c.x - 90 + (i % 3) * 90,
              y: c.y - 40 + Math.floor(i / 3) * 90,
              angle: 0,
            });
          }
        } else if (kind === 'pier') {
          // Open docks: concrete, no buildings — the M3 fight happens here.
        } else {
          // Built-up block: 1-3 buildings, inset from the block edge.
          const n = int(rng, 1, 3);
          const spots = shuffle(rng, [
            { dx: -60, dy: -60, w: 120, h: 120 },
            { dx: 60, dy: -60, w: 120, h: 120 },
            { dx: -60, dy: 60, w: 120, h: 120 },
            { dx: 60, dy: 60, w: 120, h: 120 },
            { dx: 0, dy: 0, w: 170, h: 170 },
          ]).slice(0, n);
          for (const s of spots) {
            const b = {
              x: c.x + s.dx,
              y: c.y + s.dy,
              w: s.w + range(rng, -20, 10),
              h: s.h + range(rng, -20, 10),
              color: pick(rng, ['#b08968', '#8d99ae', '#a98467', '#6c757d', '#e07a5f', '#81b29a']),
              roof: pick(rng, ['#5d4037', '#37474f', '#6d4c41', '#455a64']),
              height: range(rng, 6, 26),
            };
            block.buildings.push(b);
            this.buildings.push(b);
          }
        }
        this.blocks.push(block);
      }
    }

    this.placeSites();
    this.placeParking();
  }

  pickBlockKind(bx, by, rng) {
    // Bottom row is the harbour: piers and water-side lots, not houses.
    if (by === GRID - 1 && (bx === GRID - 1 || bx === GRID - 2)) return 'pier';
    if (by === GRID - 1) return rng() < 0.5 ? 'park' : 'lot';
    const r = rng();
    if (r < 0.14) return 'park';
    if (r < 0.24) return 'lot';
    return 'built';
  }

  placeSites() {
    // Hideout: a house in a built block near the west side, well inside it.
    const hideBlock = this.blocks.find((b) => b.bx === 1 && b.by === 2 && b.kind === 'built')
      || this.blocks.find((b) => b.kind === 'built' && b.bx <= 2);
    const hc = blockCenter(hideBlock.bx, hideBlock.by);
    // Clear any random building off the hideout plot, then put the house
    // in as a real solid building so the player cannot walk through it.
    this.buildings = this.buildings.filter((b) => dist(b.x, b.y, hc.x, hc.y) > 130);
    hideBlock.buildings = hideBlock.buildings.filter((b) => dist(b.x, b.y, hc.x, hc.y) > 130);
    const house = { x: hc.x, y: hc.y, w: 100, h: 72, color: '#e8dcc8', roof: '#c0392b', height: 10 };
    hideBlock.buildings.push(house);
    this.buildings.push(house);
    this.sites.hideout = { x: hc.x, y: hc.y, block: hideBlock, label: 'Hideout' };

    // Pit Stop: on the south road of a central block, facing the road.
    const pitBlock = this.blocks.find((b) => b.bx === 4 && b.by === 4) || this.blocks[36];
    const pc = blockCenter(pitBlock.bx, pitBlock.by);
    this.sites.pitstop = { x: pc.x, y: pc.y + BLOCK / 2 - 8, label: 'Pit Stop' };

    // Gun Barn: two blocks east of the hideout, inside its block.
    const gunBlock = this.blocks.find((b) => b.bx === 3 && b.by === 2 && b.kind !== 'pier')
      || this.blocks.find((b) => b.kind === 'built' && b.bx === 3);
    const gc = blockCenter(gunBlock.bx, gunBlock.by);
    // Keep the shop front clear of random buildings.
    this.buildings = this.buildings.filter((b) => dist(b.x, b.y, gc.x, gc.y) > 110);
    gunBlock.buildings = gunBlock.buildings.filter((b) => dist(b.x, b.y, gc.x, gc.y) > 110);
    this.sites.gunbarn = { x: gc.x, y: gc.y, block: gunBlock, label: 'Gun Barn' };

    // Pier: the harbour block at the south-east corner, on the docks.
    const pierBlock = this.blocks.find((b) => b.kind === 'pier' && b.bx === GRID - 1);
    const prc = blockCenter(pierBlock.bx, pierBlock.by);
    this.sites.pier = { x: prc.x, y: prc.y + 40, block: pierBlock, label: 'Harbor Pier' };

    // Taxi stand: on the road by the central plaza.
    this.sites.taxiStand = { x: roadCenter(4), y: roadCenter(3), label: 'Taxi Stand' };
  }

  placeParking() {
    // On-street bays along a few roads, angled to the kerb.
    const rng = mulberry32(this.seed + 999);
    for (let i = 0; i < 26; i++) {
      const vertical = rng() < 0.5;
      const line = int(rng, 1, GRID - 1);
      const along = int(rng, 1, GRID - 1);
      const c = roadCenter(line);
      const a = roadCenter(along);
      if (vertical) {
        this.parkingSpots.push({ x: c + ROAD / 2 - 22, y: a, angle: Math.PI / 2 });
      } else {
        this.parkingSpots.push({ x: a, y: c + ROAD / 2 - 22, angle: 0 });
      }
    }
  }

  // ---- collision & queries ----

  // True when the circle (x, y, r) touches any building.
  hitsBuilding(x, y, r) {
    for (const b of this.buildings) {
      const nx = Math.max(b.x - b.w / 2, Math.min(x, b.x + b.w / 2));
      const ny = Math.max(b.y - b.h / 2, Math.min(y, b.y + b.h / 2));
      const dx = x - nx;
      const dy = y - ny;
      if (dx * dx + dy * dy < r * r) return b;
    }
    return null;
  }

  // Push a circle out of buildings; returns the corrected position.
  resolveCircle(x, y, r) {
    for (let iter = 0; iter < 3; iter++) {
      const b = this.hitsBuilding(x, y, r);
      if (!b) break;
      const nx = Math.max(b.x - b.w / 2, Math.min(x, b.x + b.w / 2));
      const ny = Math.max(b.y - b.h / 2, Math.min(y, b.y + b.h / 2));
      let dx = x - nx;
      let dy = y - ny;
      let d = Math.sqrt(dx * dx + dy * dy);
      if (d < 0.001) {
        // Centre inside the building: push out along the smallest axis.
        const left = x - (b.x - b.w / 2);
        const right = b.x + b.w / 2 - x;
        const top = y - (b.y - b.h / 2);
        const bottom = b.y + b.h / 2 - y;
        const m = Math.min(left, right, top, bottom);
        if (m === left) x = b.x - b.w / 2 - r;
        else if (m === right) x = b.x + b.w / 2 + r;
        else if (m === top) y = b.y - b.h / 2 - r;
        else y = b.y + b.h / 2 + r;
        continue;
      }
      dx /= d;
      dy /= d;
      x = nx + dx * r;
      y = ny + dy * r;
    }
    return { x, y };
  }

  // Is the point on a road (not inside a block)?
  isRoad(x, y) {
    if (x < 0 || y < 0 || x > this.size || y > this.size) return false;
    const inRoadX = (x % (BLOCK + ROAD)) < ROAD;
    const inRoadY = (y % (BLOCK + ROAD)) < ROAD;
    return inRoadX || inRoadY;
  }

  // Nearest point on the road network to (x, y) — used to keep peds and
  // traffic on the streets and to place mission markers on roads.
  nearestRoadPoint(x, y) {
    const pitch = BLOCK + ROAD;
    const gx = Math.floor(x / pitch);
    const gy = Math.floor(y / pitch);
    const lx = x - gx * pitch;
    const ly = y - gy * pitch;
    if (lx < ROAD && ly < ROAD) {
      // In the intersection: stay put.
      return { x, y };
    }
    if (lx < ROAD) return { x: gx * pitch + ROAD / 2, y };
    if (ly < ROAD) return { x, y: gy * pitch + ROAD / 2 };
    // Inside a block: walk to the nearest road edge.
    const dxRoad = Math.min(lx - ROAD, pitch - lx);
    const dyRoad = Math.min(ly - ROAD, pitch - ly);
    if (dxRoad < dyRoad) {
      return { x: lx < pitch / 2 ? gx * pitch + ROAD / 2 : (gx + 1) * pitch + ROAD / 2, y };
    }
    return { x, y: ly < pitch / 2 ? gy * pitch + ROAD / 2 : (gy + 1) * pitch + ROAD / 2 };
  }

  // A random intersection centre.
  randomIntersection(rng) {
    return { x: roadCenter(int(rng, 0, GRID)), y: roadCenter(int(rng, 0, GRID)) };
  }

  // A random point on a road (for spawning traffic and peds).
  randomRoadPoint(rng) {
    const vertical = rng() < 0.5;
    const line = int(rng, 0, GRID);
    const along = range(rng, ROAD, this.size - ROAD);
    return vertical
      ? { x: roadCenter(line), y: along }
      : { x: along, y: roadCenter(line) };
  }
}
