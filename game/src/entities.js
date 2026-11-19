// Entities: the player, cars (traffic, parked, police), pedestrians and cops.
// Everything here is plain state; main.js drives the update order.
import { CFG } from './config.js';
import { angleDiff, choice, clamp, dist, rand, randInt } from './random.js';
import { collideBuildings, isOnRoad, pointInBuilding, roadCentres, roadSnap } from './city.js';

let nextId = 1;

export function makePlayer(x, y) {
  return {
    id: nextId++, kind: 'player', x, y, angle: -Math.PI / 2, speed: 0,
    hp: CFG.maxHp, ammo: CFG.startAmmo, inCar: null, wanted: 0,
    walkAnim: 0, punchCd: 0, shootCd: 0, bustedTimer: 0,
  };
}

export function makeCar(modelIdx, colourIdx, x, y, angle, opts = {}) {
  const m = CFG.carModels[modelIdx];
  return {
    id: nextId++, kind: 'car', model: modelIdx, colour: colourIdx,
    x, y, angle, speed: 0, hp: m.hp, maxHp: m.hp,
    traffic: !!opts.traffic, police: !!opts.police, parked: !!opts.parked,
    driver: opts.driver ?? null, // 'player' | 'traffic' | 'courier' | 'van' | null
    lane: opts.lane ?? null, dir: opts.dir ?? 1, roadAxis: opts.roadAxis ?? 'x',
    stopTimer: 0, dead: false,
  };
}

export function spawnParkedCars(rng, city, n) {
  const cars = [];
  const centres = roadCentres();
  for (let i = 0; i < n; i++) {
    const vertical = rng() < 0.5;
    const c = choice(rng, centres);
    const along = rand(rng, 300, CFG.world - 300);
    const off = (CFG.roadWidth / 2 - 14) * (rng() < 0.5 ? -1 : 1);
    const x = vertical ? c + off : along;
    const y = vertical ? along : c + off;
    if (pointInBuilding(city, x, y)) continue;
    cars.push(makeCar(randInt(rng, 0, 5), randInt(rng, 0, 11), x, y,
      vertical ? (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (rng() < 0.5 ? 0 : Math.PI),
      { parked: true }));
  }
  return cars;
}

export function spawnTrafficCar(rng, city) {
  const centres = roadCentres();
  const vertical = rng() < 0.5;
  const c = choice(rng, centres);
  const along = rand(rng, 200, CFG.world - 200);
  const off = (CFG.roadWidth / 2 - 30) * (rng() < 0.5 ? -1 : 1);
  const dir = rng() < 0.5 ? 1 : -1;
  const car = makeCar(randInt(rng, 0, 4), randInt(rng, 0, 11),
    vertical ? c + off : along, vertical ? along : c + off,
    vertical ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI),
    { traffic: true, dir, roadAxis: vertical ? 'y' : 'x' });
  car.speed = rand(rng, 90, 150);
  return car;
}

// 8 pedestrian types, each with its own look and behaviour
export const PED_TYPES = [
  { name: 'walker', speed: 70, colour: '#7a9cc6', size: 9 },
  { name: 'jogger', speed: 150, colour: '#e07a5f', size: 9 },
  { name: 'business', speed: 85, colour: '#3d405b', size: 10 },
  { name: 'tourist', speed: 55, colour: '#f2cc8f', size: 10 },
  { name: 'worker', speed: 65, colour: '#81b29a', size: 11 },
  { name: 'student', speed: 95, colour: '#b5838d', size: 9 },
  { name: 'elder', speed: 40, colour: '#6d6875', size: 9 },
  { name: 'vendor', speed: 0, colour: '#e76f51', size: 11 },
];

export function makePed(rng, city, x, y) {
  const t = randInt(rng, 0, PED_TYPES.length - 1);
  const p = {
    id: nextId++, kind: 'ped', type: t, x, y,
    angle: rand(rng, 0, Math.PI * 2), hp: 20, dead: false,
    tx: x, ty: y, flee: 0, pause: 0,
  };
  pickPedTarget(rng, city, p);
  return p;
}

export function pickPedTarget(rng, city, p) {
  // walk along sidewalks: pick a point just off a road
  const s = roadSnap(p.x + rand(rng, -500, 500), p.y + rand(rng, -500, 500));
  const off = CFG.roadWidth / 2 + 24;
  p.tx = clamp(s.x + (rng() < 0.5 ? -off : off), 80, CFG.world - 80);
  p.ty = clamp(s.y + (rng() < 0.5 ? -off : off), 80, CFG.world - 80);
  if (pointInBuilding(city, p.tx, p.ty)) { p.tx = s.x; p.ty = s.y; }
}

export function updatePed(G, p, dt) {
  if (p.dead) return;
  const t = PED_TYPES[p.type];
  if (p.flee > 0) {
    p.flee -= dt;
    p.x += Math.cos(p.angle) * t.speed * 2 * dt;
    p.y += Math.sin(p.angle) * t.speed * 2 * dt;
  } else if (p.pause > 0) {
    p.pause -= dt;
  } else if (t.speed > 0) {
    const d = dist(p.x, p.y, p.tx, p.ty);
    if (d < 12) {
      if (G.rng() < 0.4) p.pause = rand(G.rng, 1, 4);
      else pickPedTarget(G.rng, G.city, p);
    } else {
      p.angle = Math.atan2(p.ty - p.y, p.tx - p.x);
      p.x += Math.cos(p.angle) * t.speed * dt;
      p.y += Math.sin(p.angle) * t.speed * dt;
    }
  }
  const c = collideBuildings(G.city, p.x, p.y, 10);
  p.x = clamp(c.x, 20, CFG.world - 20); p.y = clamp(c.y, 20, CFG.world - 20);
}

export function scarePeds(G, x, y, radius) {
  // fleeing only ever touches LIVING peds; the dead stay dead, forever
  for (const p of G.peds) {
    if (p.dead) continue;
    if (dist(p.x, p.y, x, y) < radius) {
      p.angle = Math.atan2(p.y - y, p.x - x);
      p.flee = 2;
    }
  }
}

export function updateTrafficCar(G, car, dt) {
  if (car.dead || car.driver === 'player') return;
  if (car.driver === 'courier' || car.driver === 'van') return; // mission vehicles follow waypoints, not traffic AI
  const m = CFG.carModels[car.model];
  // traffic cruises its road; at a crossing it sometimes turns
  const speed = car.police ? CFG.policeCarSpeed : 130;
  if (car.police) {
    // police chase: steer straight at the player
    const px = G.player.inCar ? G.player.inCar.x : G.player.x;
    const py = G.player.inCar ? G.player.inCar.y : G.player.y;
    const want = Math.atan2(py - car.y, px - car.x);
    car.angle += clamp(angleDiff(car.angle, want), -3.2 * dt, 3.2 * dt);
    car.speed = Math.min(CFG.policeCarSpeed, car.speed + 400 * dt);
  } else {
    car.speed = Math.min(speed, car.speed + 200 * dt);
    if (isOnRoad(car.x, car.y) && G.rng() < 0.002) {
      // turn at a crossing: rotate 90 degrees either way
      car.angle += (G.rng() < 0.5 ? 1 : -1) * Math.PI / 2;
      car.roadAxis = car.roadAxis === 'x' ? 'y' : 'x';
    }
  }
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  // keep inside the world; bounce off the edge
  if (car.x < 60 || car.x > CFG.world - 60 || car.y < 60 || car.y > CFG.world - 60) {
    car.angle += Math.PI;
    car.x = clamp(car.x, 60, CFG.world - 60);
    car.y = clamp(car.y, 60, CFG.world - 60);
  }
  const c = collideBuildings(G.city, car.x, car.y, 26);
  // a traffic car that wedges on a building nudges back onto the road
  if (c.x !== car.x || c.y !== car.y) {
    const s = roadSnap(car.x, car.y);
    car.x = s.x; car.y = s.y;
    car.angle = Math.abs(car.x - s.x) < 1 ? Math.PI / 2 : 0;
  }
  void m;
}

export function spawnPoliceCar(G) {
  const px = G.player.inCar ? G.player.inCar.x : G.player.x;
  const py = G.player.inCar ? G.player.inCar.y : G.player.y;
  const a = G.rng() * Math.PI * 2;
  const x = clamp(px + Math.cos(a) * 700, 100, CFG.world - 100);
  const y = clamp(py + Math.sin(a) * 700, 100, CFG.world - 100);
  const car = makeCar(0, 3, x, y, Math.atan2(py - y, px - x), { police: true, traffic: true });
  car.speed = 200;
  G.cars.push(car);
  return car;
}

export function spawnOfficer(G) {
  const px = G.player.x, py = G.player.y;
  const a = G.rng() * Math.PI * 2;
  const o = {
    id: nextId++, kind: 'officer', x: clamp(px + Math.cos(a) * 420, 60, CFG.world - 60),
    y: clamp(py + Math.sin(a) * 420, 60, CFG.world - 60), angle: 0,
    hp: 40, dead: false, speed: CFG.officerSpeed,
  };
  G.officers.push(o);
  return o;
}
