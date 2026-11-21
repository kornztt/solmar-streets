// People, cars and police: factories plus per-tick updates.
// All updates take the shared game state G and mutate it in place.

import { WORLD, CAR_MODELS, CAR_COLORS, PED_TYPES, clamp, dist, angleTo, angleDiff } from './config.js';
import { mulberry32, pick, range, intRange } from './random.js';
import { collide, randomRoadPoint, nearestRoad } from './world.js';

let nextId = 1;

export function makePed(type, x, y) {
  const t = PED_TYPES.find((p) => p.id === type) || PED_TYPES[0];
  return {
    id: nextId++, kind: 'ped', type: t.id, color: t.color, speed: t.speed,
    x, y, angle: Math.random() * Math.PI * 2, hp: 30, state: 'walk',
    target: null, wander: 0, dead: false, guard: false, passenger: false,
  };
}

export function makeCar(modelId, color, x, y, angle, opts) {
  const m = CAR_MODELS.find((c) => c.id === modelId) || CAR_MODELS[0];
  const o = opts || {};
  return {
    id: nextId++, kind: 'car', model: m.id, name: m.name, color,
    len: m.len, wid: m.wid, top: m.top, accel: m.accel, grip: m.grip,
    x, y, angle: angle || 0, speed: 0, hp: o.hp || 100, maxHp: 100,
    traffic: !!o.traffic, driver: o.driver !== false, target: null,
    turnAt: 0, stopped: 0, van: !!o.van, targetCar: null, rams: 0,
  };
}

export function makeCop(x, y) {
  const c = makeCar('sedan', '#1a2a4a', x, y, 0, { hp: 120 });
  c.cop = true;
  c.top = 400;
  return c;
}

export function spawnTraffic(G, n) {
  const rng = mulberry32(G.seed + 101);
  for (let i = 0; i < n; i++) {
    const p = randomRoadPoint(rng, G.world);
    const model = pick(rng, CAR_MODELS.filter((m) => m.id !== 'taxi' || rng() < 0.3));
    const car = makeCar(model.id, pick(rng, CAR_COLORS), p.x, p.y, rng() < 0.5 ? 0 : Math.PI / 2, { traffic: true });
    car.speed = range(rng, 60, 140);
    G.cars.push(car);
  }
}

export function spawnPeds(G, n) {
  const rng = mulberry32(G.seed + 202);
  for (let i = 0; i < n; i++) {
    const p = randomRoadPoint(rng, G.world);
    const type = pick(rng, PED_TYPES).id;
    const ped = makePed(type, p.x + range(rng, -40, 40), p.y + range(rng, -40, 40));
    ped.angle = rng() * Math.PI * 2;
    G.peds.push(ped);
  }
}

// --- movement helpers -------------------------------------------------------

function moveWithCollision(G, obj, nx, ny, r) {
  let x = nx, y = ny;
  x = clamp(x, 20, WORLD.size - 20);
  y = clamp(y, 20, WORLD.size - 20);
  const push = collide(G.world, x, y, r);
  if (push) { x += push.x; y += push.y; }
  return { x, y };
}

function carHitsBuilding(G, car) {
  // Check the four corners of the car rectangle against buildings/water.
  const c = Math.cos(car.angle), s = Math.sin(car.angle);
  const hl = car.len / 2, hw = car.wid / 2;
  for (const [dx, dy] of [[hl, hw], [hl, -hw], [-hl, hw], [-hl, -hw]]) {
    const px = car.x + dx * c - dy * s;
    const py = car.y + dx * s + dy * c;
    if (collide(G.world, px, py, 2)) return true;
  }
  return false;
}

// --- pedestrians ------------------------------------------------------------

export function updatePeds(G, dt) {
  for (const p of G.peds) {
    if (p.dead) continue;
    if (p.state === 'flee') {
      const a = angleTo(G.player.x, G.player.y, p.x, p.y);
      const nx = p.x + Math.cos(a) * p.speed * 1.6 * dt;
      const ny = p.y + Math.sin(a) * p.speed * 1.6 * dt;
      const m = moveWithCollision(G, p, nx, ny, 10);
      p.x = m.x; p.y = m.y; p.angle = a;
      p.wander -= dt;
      if (p.wander <= 0) p.state = 'walk';
      continue;
    }
    if (p.state === 'wait') continue; // taxi passenger / mission actor holds still
    p.wander -= dt;
    if (p.wander <= 0) {
      p.wander = 2 + Math.random() * 4;
      // Peds stroll along the nearest road.
      const rp = nearestRoad(G.world, p.x, p.y);
      p.angle = angleTo(p.x, p.y, rp.x + (Math.random() - 0.5) * 300, rp.y + (Math.random() - 0.5) * 300);
    }
    const nx = p.x + Math.cos(p.angle) * p.speed * dt;
    const ny = p.y + Math.sin(p.angle) * p.speed * dt;
    const m = moveWithCollision(G, p, nx, ny, 10);
    if (m.x === p.x && m.y === p.y && (nx !== p.x || ny !== p.y)) p.angle += Math.PI / 2;
    p.x = m.x; p.y = m.y;
  }
  // Prune the dead so the arrays stay small; the player can still see corpses
  // for a while via the recent-deaths list the renderer draws.
  G.peds = G.peds.filter((p) => !p.dead || (p.deadAt !== undefined && G.elapsed - p.deadAt < 20));
}

// --- traffic ----------------------------------------------------------------

export function updateTraffic(G, dt) {
  for (const car of G.cars) {
    if (!car.traffic || car.hp <= 0) continue;
    // Pick a new heading at intersections.
    const onV = G.world.roads.some((rx) => Math.abs(car.x - rx) < 6);
    const onH = G.world.roads.some((ry) => Math.abs(car.y - ry) < 6);
    if ((onV || onH) && Math.random() < dt * 0.5) {
      const dirs = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
      car.angle = dirs[Math.floor(Math.random() * dirs.length)];
    }
    // Slow down for the car ahead.
    let ahead = false;
    for (const other of G.cars) {
      if (other === car || other.hp <= 0) continue;
      const d = dist(car.x, car.y, other.x, other.y);
      if (d < 70 && Math.abs(angleDiff(angleTo(car.x, car.y, other.x, other.y), car.angle)) < 0.6) { ahead = true; break; }
    }
    const want = ahead ? 0 : 110;
    car.speed += clamp(want - car.speed, -300 * dt, 200 * dt);
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    const oldX = car.x, oldY = car.y;
    car.x = clamp(nx, 20, WORLD.size - 20);
    car.y = clamp(ny, 20, WORLD.size - 20);
    if (carHitsBuilding(G, car)) {
      car.x = oldX; car.y = oldY;
      car.angle += Math.PI / 2;
      car.speed = 40;
    }
    // Wrap around the far edge so traffic never thins out.
    if (car.x <= 25 || car.x >= WORLD.size - 25 || car.y <= 25 || car.y >= WORLD.size - 25) {
      const p = randomRoadPoint(Math.random, G.world);
      car.x = p.x; car.y = p.y;
    }
  }
}

// --- police -----------------------------------------------------------------

export function wantedCount(G) {
  return Math.min(5, Math.floor(G.player.wanted));
}

export function updatePolice(G, dt) {
  const want = wantedCount(G);
  // Spawn cops up to the wanted level, near the player but off-screen.
  const cops = G.cars.filter((c) => c.cop && c.hp > 0);
  if (cops.length < want && Math.random() < dt * 0.8) {
    const a = Math.random() * Math.PI * 2;
    const cx = clamp(G.player.x + Math.cos(a) * 700, 60, WORLD.size - 60);
    const cy = clamp(G.player.y + Math.sin(a) * 700, 60, WORLD.size - 60);
    const cop = makeCop(cx, cy);
    G.cars.push(cop);
    if (G.audio) G.audio.siren();
  }
  for (const cop of G.cars) {
    if (!cop.cop || cop.hp <= 0) continue;
    const target = G.player.inCar || G.player;
    const d = dist(cop.x, cop.y, target.x, target.y);
    const wantAngle = angleTo(cop.x, cop.y, target.x, target.y);
    cop.angle += clamp(angleDiff(wantAngle, cop.angle), -2.4 * dt, 2.4 * dt);
    const targetSpeed = d > 260 ? 420 : d > 60 ? 300 : 140;
    cop.speed += clamp(targetSpeed - cop.speed, -500 * dt, 400 * dt);
    const nx = cop.x + Math.cos(cop.angle) * cop.speed * dt;
    const ny = cop.y + Math.sin(cop.angle) * cop.speed * dt;
    const oldX = cop.x, oldY = cop.y;
    cop.x = clamp(nx, 20, WORLD.size - 20);
    cop.y = clamp(ny, 20, WORLD.size - 20);
    if (carHitsBuilding(G, cop)) { cop.x = oldX; cop.y = oldY; cop.speed = 60; }
    // Ramming the player hurts.
    if (d < 46) {
      if (G.player.inCar) {
        G.player.inCar.hp -= 18 * dt;
        if (G.player.inCar.hp <= 0) explodeCar(G, G.player.inCar);
      } else {
        hurtPlayer(G, 22 * dt);
      }
      cop.speed *= 0.5;
    }
  }
  // Wanted cools off when the heat dies down.
  if (want > 0) {
    const nearest = cops.reduce((m, c) => Math.min(m, dist(c.x, c.y, G.player.x, G.player.y)), Infinity);
    if (nearest > 900) G.player.wanted = Math.max(0, G.player.wanted - dt * 0.08);
  }
}

export function explodeCar(G, car) {
  car.hp = 0;
  car.dead = true;
  if (G.player.inCar === car) {
    G.player.inCar = null;
    hurtPlayer(G, 25);
  }
  if (G.audio) G.audio.noise(0.5, 0.5, 600);
}

export function hurtPlayer(G, amount) {
  if (G.player.invuln > 0) return;
  G.player.health -= amount;
  if (G.player.health <= 0) {
    G.player.health = 0;
    G.screen = 'wasted';
    if (G.audio) G.audio.tone(110, 0.8, 'sawtooth', 0.2, 40);
  }
}

export function addWanted(G, n) {
  G.player.wanted = clamp(G.player.wanted + n, 0, 5);
}

export function scarePeds(G, x, y, radius) {
  for (const p of G.peds) {
    if (p.dead) continue;
    if (dist(p.x, p.y, x, y) < radius) {
      p.state = 'flee';
      p.wander = 3 + Math.random() * 2;
    }
  }
}
