// The city of Solmar: a road grid, blocks with buildings kept off the roads,
// and the named landmarks the missions and shops use.
import { CFG } from './config.js';
import { choice, clamp, rand, randInt } from './random.js';

export function roadCentres() {
  const out = [];
  for (let i = 0; i < CFG.roadCount; i++) out.push(CFG.roadFirst + i * CFG.roadPitch);
  return out;
}

export function isOnRoad(x, y) {
  const half = CFG.roadWidth / 2;
  for (const c of roadCentres()) {
    if (Math.abs(x - c) <= half || Math.abs(y - c) <= half) return true;
  }
  return false;
}

// nearest point on a road centreline (used by autopilot routing)
export function roadSnap(x, y) {
  const centres = roadCentres();
  let bx = centres[0], bd = Infinity;
  for (const c of centres) { const d = Math.abs(x - c); if (d < bd) { bd = d; bx = c; } }
  let by = centres[0]; bd = Infinity;
  for (const c of centres) { const d = Math.abs(y - c); if (d < bd) { bd = d; by = c; } }
  // snap to whichever axis is nearer: stay on the closer road
  return Math.abs(x - bx) <= Math.abs(y - by) ? { x: bx, y } : { x, y: by };
}

// point on the road grid closest to (x,y) along the same row/column
export function nearestRoadPoint(x, y) {
  const s = roadSnap(x, y);
  return { x: clamp(s.x, 0, CFG.world), y: clamp(s.y, 0, CFG.world) };
}

export function buildCity(rng) {
  const centres = roadCentres();
  const buildings = [];
  const roofColours = ['#5a6a7a', '#7a5a4a', '#4a5a6a', '#6a5a7a', '#556b5a', '#715a4a'];
  // blocks sit between neighbouring roads; each block gets 1-3 buildings,
  // inset by roadWidth/2 + blockClear from the road centreline so a clear
  // lane always runs beside every road.
  const inset = CFG.roadWidth / 2 + CFG.blockClear; // 90
  const blockSpan = CFG.roadPitch - 2 * inset; // 220 of buildable space
  for (let i = 0; i < CFG.roadCount - 1; i++) {
    for (let j = 0; j < CFG.roadCount - 1; j++) {
      const bx = centres[i] + inset, by = centres[j] + inset;
      const n = randInt(rng, 1, 2);
      for (let k = 0; k < n; k++) {
        const w = rand(rng, 70, blockSpan);
        const h = rand(rng, 70, blockSpan / n);
        const x = bx + rand(rng, 0, Math.max(0, blockSpan - w));
        const y = by + (k * blockSpan) / n + rand(rng, 0, Math.max(0, blockSpan / n - h));
        buildings.push({
          x, y, w, h,
          roof: choice(rng, roofColours),
          floors: randInt(rng, 2, 9),
        });
      }
    }
  }
  // Landmarks: named spots on roadside positions (all reachable by car).
  const landmarks = {
    vera: { name: "Vera's Office", x: 700, y: 700, colour: '#f5a623' },
    harbor: { name: 'Harbor', x: 2900, y: 2900, colour: '#2aa198' },
    bank: { name: 'Solmar Bank', x: 2580, y: 620, colour: '#b58900' },
    diner: { name: 'Diner', x: 1020, y: 2180, colour: '#d33682' },
    pitstop: { name: 'Pit Stop', x: 2180, y: 1020, colour: '#dc322f' },
    gunbarn: { name: 'Gun Barn', x: 1420, y: 2580, colour: '#859900' },
    plaza: { name: 'Rooftop Plaza', x: 1800, y: 1800, colour: '#6c71c4' },
    hospital: { name: 'Hospital', x: 620, y: 2580, colour: '#eee8d5' },
    police: { name: 'Police Station', x: 2180, y: 2180, colour: '#268bd2' },
    depot: { name: 'Courier Depot', x: 1420, y: 1020, colour: '#cb4b16' },
    stash: { name: 'Stash House', x: 2620, y: 2380, colour: '#2aa198' },
    taxiA: { name: 'Taxi Stand North', x: 1000, y: 600, colour: '#fc0' },
    taxiB: { name: 'Taxi Stand South', x: 2200, y: 2600, colour: '#fc0' },
  };
  // keep buildings clear of landmark fronts so markers are reachable
  for (const lm of Object.values(landmarks)) {
    for (let i = buildings.length - 1; i >= 0; i--) {
      const b = buildings[i];
      if (lm.x > b.x - 70 && lm.x < b.x + b.w + 70 && lm.y > b.y - 70 && lm.y < b.y + b.h + 70) {
        buildings.splice(i, 1);
      }
    }
  }
  return { centres, buildings, landmarks };
}

// circle vs building collision: push (x,y,r) out of every building rect
export function collideBuildings(city, x, y, r) {
  let px = x, py = y;
  for (const b of city.buildings) {
    const nx = clamp(px, b.x, b.x + b.w), ny = clamp(py, b.y, b.y + b.h);
    const dx = px - nx, dy = py - ny, d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      if (d2 < 0.001) { px = b.x - r; continue; }
      const d = Math.sqrt(d2);
      px = nx + (dx / d) * r; py = ny + (dy / d) * r;
    }
  }
  return { x: px, y: py };
}

export function pointInBuilding(city, x, y) {
  for (const b of city.buildings) {
    if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) return true;
  }
  return false;
}
