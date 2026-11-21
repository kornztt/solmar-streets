// City layout: a road grid with buildings in the blocks, plus road helpers
// the traffic, police and fleeing cars use to drive around.
import { ROADS_X, ROADS_Y, ROAD_W, WORLD } from './config.js';
import { makeRng, clamp, dist, angleDiff } from './random.js';

const ROOF_COLORS = ['#7f8c8d', '#95a5a6', '#b03a2e', '#2e4053', '#6c3483', '#1e8449', '#935116', '#2c3e50'];
const WALL_COLORS = ['#aeb6bf', '#a9cce3', '#f5cba7', '#d5dbdb', '#f1948a', '#aed6f1', '#f9e79f', '#d2b4de'];

export function buildCity(seed = 11) {
  const rng = makeRng(seed);
  const buildings = [];
  // Blocks sit between neighbouring roads (and outside the outer roads).
  const xs = [0, ...ROADS_X, WORLD.w];
  const ys = [0, ...ROADS_Y, WORLD.h];
  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < ys.length - 1; j++) {
      const x0 = xs[i] + (i === 0 ? 20 : ROAD_W / 2 + 14);
      const x1 = xs[i + 1] - (i === xs.length - 2 ? 20 : ROAD_W / 2 + 14);
      const y0 = ys[j] + (j === 0 ? 20 : ROAD_W / 2 + 14);
      const y1 = ys[j + 1] - (j === ys.length - 2 ? 20 : ROAD_W / 2 + 14);
      const bw = x1 - x0;
      const bh = y1 - y0;
      if (bw < 60 || bh < 60) continue;
      // Rooftop Plaza block stays open; the dockside strip stays open too.
      if (x0 >= 990 && x1 <= 1410 && y0 >= 540 && y1 <= 910) continue;
      if (y0 >= 1590) continue;
      const n = bw > 260 && bh > 200 && rng.chance(0.6) ? 2 : 1;
      for (let k = 0; k < n; k++) {
        const w = n === 2 ? bw / 2 - 24 : bw * rng.range(0.55, 0.8);
        const h = n === 2 ? bh * rng.range(0.5, 0.75) : bh * rng.range(0.5, 0.75);
        const bx = n === 2 ? x0 + 12 + k * (bw / 2) : x0 + (bw - w) / 2;
        const by = y0 + (bh - h) / 2 + rng.range(-8, 8);
        buildings.push({
          x: bx, y: by, w, h,
          wall: rng.pick(WALL_COLORS), roof: rng.pick(ROOF_COLORS),
          tall: rng.chance(0.35),
        });
      }
    }
  }
  return { buildings, seed };
}

// Is a point on a road (within the road width)?
export function onRoad(x, y) {
  for (const rx of ROADS_X) if (Math.abs(x - rx) <= ROAD_W / 2) return true;
  for (const ry of ROADS_Y) if (Math.abs(y - ry) <= ROAD_W / 2) return true;
  return false;
}

// Nearest point on any road to (x, y).
export function nearestRoadPoint(x, y) {
  let best = null;
  let bestD = Infinity;
  for (const rx of ROADS_X) {
    const d = Math.abs(x - rx);
    if (d < bestD) { bestD = d; best = { x: rx, y: clamp(y, 0, WORLD.h) }; }
  }
  for (const ry of ROADS_Y) {
    const d = Math.abs(y - ry);
    if (d < bestD) { bestD = d; best = { x: clamp(x, 0, WORLD.w), y: ry }; }
  }
  return best;
}

// Nearest intersection to (x, y).
export function nearestIntersection(x, y) {
  let bx = ROADS_X[0];
  let by = ROADS_Y[0];
  for (const rx of ROADS_X) if (Math.abs(rx - x) < Math.abs(bx - x)) bx = rx;
  for (const ry of ROADS_Y) if (Math.abs(ry - y) < Math.abs(by - y)) by = ry;
  return { x: bx, y: by };
}

// Push a circle (x, y, r) out of every building it overlaps. Returns true if pushed.
export function collideBuildings(city, o, r) {
  let hit = false;
  for (const b of city.buildings) {
    const cx = clamp(o.x, b.x, b.x + b.w);
    const cy = clamp(o.y, b.y, b.y + b.h);
    const dx = o.x - cx;
    const dy = o.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 >= r * r) continue;
    hit = true;
    if (d2 < 0.001) {
      // Centre inside the rect: push out along the smallest exit.
      const left = o.x - b.x;
      const right = b.x + b.w - o.x;
      const top = o.y - b.y;
      const bot = b.y + b.h - o.y;
      const m = Math.min(left, right, top, bot);
      if (m === left) o.x = b.x - r;
      else if (m === right) o.x = b.x + b.w + r;
      else if (m === top) o.y = b.y - r;
      else o.y = b.y + b.h + r;
    } else {
      const d = Math.sqrt(d2);
      o.x = cx + (dx / d) * r;
      o.y = cy + (dy / d) * r;
    }
  }
  o.x = clamp(o.x, 20, WORLD.w - 20);
  o.y = clamp(o.y, 20, WORLD.h - 20);
  return hit;
}

// Steer a car along roads toward (tx, ty). The car keeps to roads: if it is
// off-road it heads for the nearest road point, otherwise it drives along its
// current road toward the crossing that gets it closer to the target.
export function roadDrive(car, tx, ty, dt, speed) {
  const near = nearestRoadPoint(car.x, car.y);
  let aim;
  if (dist(car.x, car.y, near.x, near.y) > 70) {
    aim = near;
  } else {
    // On a road: are we on a vertical or horizontal one?
    const onV = ROADS_X.some((rx) => Math.abs(car.x - rx) <= ROAD_W / 2 + 6);
    const onH = ROADS_Y.some((ry) => Math.abs(car.y - ry) <= ROAD_W / 2 + 6);
    if (onV && !onH) {
      const rx = ROADS_X.reduce((a, b) => (Math.abs(b - car.x) < Math.abs(a - car.x) ? b : a));
      // Drive along this vertical road toward the horizontal road nearest the target.
      const tyRoad = ROADS_Y.reduce((a, b) => (Math.abs(b - ty) < Math.abs(a - ty) ? b : a));
      aim = { x: rx, y: tyRoad };
      if (Math.abs(car.y - tyRoad) < 40) aim = { x: tx, y: car.y };
    } else if (onH && !onV) {
      const ry = ROADS_Y.reduce((a, b) => (Math.abs(b - car.y) < Math.abs(a - car.y) ? b : a));
      const txRoad = ROADS_X.reduce((a, b) => (Math.abs(b - tx) < Math.abs(a - tx) ? b : a));
      aim = { x: txRoad, y: ry };
      if (Math.abs(car.x - txRoad) < 40) aim = { x: car.x, y: ty };
    } else {
      // At an intersection: pick the axis with the bigger remaining gap.
      aim = Math.abs(tx - car.x) > Math.abs(ty - car.y) ? { x: tx, y: car.y } : { x: car.x, y: ty };
    }
  }
  const want = Math.atan2(aim.y - car.y, aim.x - car.x);
  const turn = angleDiff(car.angle, want);
  car.angle += clamp(turn, -2.4 * dt, 2.4 * dt);
  car.speed = speed;
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  return dist(car.x, car.y, tx, ty);
}
