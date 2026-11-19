// Player, cars, pedestrians: spawning and movement.
import { CFG, CAR_MODELS, CAR_COLORS } from './config.js';
import { RNG, clamp, dist, angTo, angDiff } from './random.js';
import { roadCenter, randomRoadPoint, nearestRoadPoint, moveBody, landmarkPos } from './city.js';

let carId = 0;

export function spawnPlayer(G, city) {
  const h = landmarkPos('hideout');
  G.player.x = h.x + 40;
  G.player.y = h.y + 30;
  G.player.angle = -Math.PI / 2;
  G.player.onFoot = true;
  G.player.car = null;
  G.player.speed = 0;
}

export function makeCar(x, y, angle, modelIdx, color, kind) {
  const m = CAR_MODELS[modelIdx];
  return {
    id: ++carId,
    model: modelIdx,
    color,
    x, y, angle,
    speed: 0,
    hp: m.hp,
    maxHp: m.hp,
    kind, // 'parked' | 'traffic' | 'police' | 'mission' | 'player'
    wp: null,
    driver: kind !== 'parked',
    stuck: 0,
  };
}

export function spawnParkedCars(G, rng) {
  for (let i = 0; i < 26; i++) {
    const p = randomRoadPoint(rng);
    const alongRoad = rng.chance(0.5);
    const off = rng.pick([-22, 22]);
    const x = alongRoad ? p.x + off : p.x;
    const y = alongRoad ? p.y : p.y + off;
    const angle = alongRoad ? (rng.chance(0.5) ? 0 : Math.PI) : (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2);
    G.cars.push(makeCar(x, y, angle, rng.int(0, 5), rng.pick(CAR_COLORS), 'parked'));
  }
}

export function spawnTraffic(G, rng, n = 14) {
  for (let i = 0; i < n; i++) {
    const p = randomRoadPoint(rng);
    const car = makeCar(p.x, p.y, rng.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]), rng.int(0, 5), rng.pick(CAR_COLORS), 'traffic');
    car.wp = randomRoadPoint(rng);
    car.speed = 90;
    G.cars.push(car);
  }
}

export function spawnPeds(G, rng, n = 42) {
  const cols = ['#e8e8e8', '#f2b705', '#2f7fe3', '#e86aa8', '#37b24d', '#f27d16', '#8a5cf6'];
  for (let i = 0; i < n; i++) {
    const p = randomRoadPoint(rng);
    const ped = { x: p.x, y: p.y, angle: rng.range(0, Math.PI * 2), speed: rng.range(32, 55), tx: p.x, ty: p.y, color: rng.pick(cols), fare: false, scared: 0 };
    ped.tx = p.x + rng.range(-260, 260);
    ped.ty = p.y + rng.range(-260, 260);
    G.peds.push(ped);
  }
}

export function nearestCar(G, x, y, maxD) {
  let best = null;
  let bd = maxD;
  for (const c of G.cars) {
    if (c.kind === 'player') continue;
    const d = dist(x, y, c.x, c.y);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

export function enterCar(G, car) {
  car.kind = 'player';
  car.driver = true;
  G.player.car = car;
  G.player.onFoot = false;
  G.player.speed = 0;
}

export function exitCar(G) {
  const car = G.player.car;
  if (!car) return;
  car.kind = 'parked';
  car.speed = 0;
  const a = G.player.angle;
  G.player.x = car.x + Math.cos(a + Math.PI / 2) * 40;
  G.player.y = car.y + Math.sin(a + Math.PI / 2) * 40;
  G.player.onFoot = true;
  G.player.car = null;
}

// --- per-frame updates ---

export function updatePlayer(G, dt, city) {
  const p = G.player;
  const k = G.keys;
  const run = k['ShiftLeft'] || k['ShiftRight'];
  if (p.onFoot) {
    let mx = 0;
    let my = 0;
    if (k['KeyW'] || k['ArrowUp']) my -= 1;
    if (k['KeyS'] || k['ArrowDown']) my += 1;
    if (k['KeyA'] || k['ArrowLeft']) mx -= 1;
    if (k['KeyD'] || k['ArrowRight']) mx += 1;
    if (mx !== 0 || my !== 0) {
      const len = Math.hypot(mx, my);
      const sp = (run ? CFG.runSpeed : CFG.walkSpeed) * dt;
      p.angle = Math.atan2(my, mx);
      const pos = moveBody(p.x, p.y, (mx / len) * sp, (my / len) * sp, 14, city);
      p.x = pos.x;
      p.y = pos.y;
      p.speed = run ? CFG.runSpeed : CFG.walkSpeed;
    } else {
      p.speed = 0;
    }
  } else if (p.car) {
    const car = p.car;
    const m = CAR_MODELS[car.model];
    const fwd = (k['KeyW'] || k['ArrowUp'] ? 1 : 0) - (k['KeyS'] || k['ArrowDown'] ? 0.6 : 0);
    const steer = (k['KeyA'] || k['ArrowLeft'] ? -1 : 0) + (k['KeyD'] || k['ArrowRight'] ? 1 : 0);
    car.speed += fwd * m.accel * dt;
    if (k['Space']) car.speed *= Math.max(0, 1 - 3.2 * dt); // handbrake
    car.speed -= car.speed * 0.55 * dt; // drag
    car.speed = clamp(car.speed, -m.max * 0.45, m.max);
    if (Math.abs(car.speed) > 8) {
      car.angle += steer * m.grip * dt * clamp(Math.abs(car.speed) / 120, 0.25, 1) * Math.sign(car.speed);
    }
    const dx = Math.cos(car.angle) * car.speed * dt;
    const dy = Math.sin(car.angle) * car.speed * dt;
    const pos = moveBody(car.x, car.y, dx, dy, 24, city);
    // Bumped into a building: bleed speed.
    if (Math.abs(pos.x - (car.x + dx)) > 0.5 || Math.abs(pos.y - (car.y + dy)) > 0.5) car.speed *= 0.4;
    car.x = pos.x;
    car.y = pos.y;
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    p.speed = Math.abs(car.speed);
  }
  p.punchT = Math.max(0, p.punchT - dt);
  p.shootT = Math.max(0, p.shootT - dt);
}

export function updateTraffic(G, dt, city) {
  for (const car of G.cars) {
    if (car.kind !== 'traffic') continue;
    const m = CAR_MODELS[car.model];
    if (!car.wp || dist(car.x, car.y, car.wp.x, car.wp.y) < 14) {
      // Pick a neighbouring intersection.
      const ci = Math.round((car.x - CFG.road / 2) / CFG.pitch);
      const cj = Math.round((car.y - CFG.road / 2) / CFG.pitch);
      const opts = [];
      if (ci > 0) opts.push({ x: roadCenter(ci - 1), y: roadCenter(cj) });
      if (ci < CFG.grid) opts.push({ x: roadCenter(ci + 1), y: roadCenter(cj) });
      if (cj > 0) opts.push({ x: roadCenter(ci), y: roadCenter(cj - 1) });
      if (cj < CFG.grid) opts.push({ x: roadCenter(ci), y: roadCenter(cj + 1) });
      car.wp = opts.length ? opts[Math.floor(Math.random() * opts.length)] : randomRoadPoint(new RNG((Math.random() * 1e9) | 0));
    }
    const want = angTo(car.x, car.y, car.wp.x, car.wp.y);
    car.angle += clamp(angDiff(car.angle, want), -2.4 * dt, 2.4 * dt);
    // Slow for a car ahead.
    let slow = false;
    for (const o of G.cars) {
      if (o === car) continue;
      const d = dist(car.x, car.y, o.x, o.y);
      if (d < 64) {
        const a = angTo(car.x, car.y, o.x, o.y);
        if (Math.abs(angDiff(car.angle, a)) < 0.7) { slow = true; break; }
      }
    }
    const target = slow ? 0 : 120;
    car.speed += clamp(target - car.speed, -260 * dt, 160 * dt);
    const pos = moveBody(car.x, car.y, Math.cos(car.angle) * car.speed * dt, Math.sin(car.angle) * car.speed * dt, 24, city);
    car.x = pos.x;
    car.y = pos.y;
  }
  // Car-car separation (soft push).
  for (let i = 0; i < G.cars.length; i++) {
    for (let j = i + 1; j < G.cars.length; j++) {
      const a = G.cars[i];
      const b = G.cars[j];
      const d = dist(a.x, a.y, b.x, b.y);
      if (d > 0.01 && d < 44) {
        const push = (44 - d) / 2;
        const nx = (b.x - a.x) / d;
        const ny = (b.y - a.y) / d;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
        if (a.kind === 'player' || b.kind === 'player') {
          const pc = a.kind === 'player' ? a : b;
          pc.speed *= 0.85;
        }
      }
    }
  }
}

export function updatePeds(G, dt, city) {
  for (const ped of G.peds) {
    if (ped.scared > 0) {
      ped.scared -= dt;
      // Flee from the player.
      const a = angTo(G.player.x, G.player.y, ped.x, ped.y);
      const pos = moveBody(ped.x, ped.y, Math.cos(a) * 130 * dt, Math.sin(a) * 130 * dt, 10, city);
      ped.x = pos.x;
      ped.y = pos.y;
      ped.angle = a;
      continue;
    }
    if (dist(ped.x, ped.y, ped.tx, ped.ty) < 12) {
      ped.tx = Math.max(40, Math.min(CFG.world - 40, ped.x + (Math.random() - 0.5) * 520));
      ped.ty = Math.max(40, Math.min(CFG.world - 40, ped.y + (Math.random() - 0.5) * 520));
    }
    const a = angTo(ped.x, ped.y, ped.tx, ped.ty);
    ped.angle = a;
    const pos = moveBody(ped.x, ped.y, Math.cos(a) * ped.speed * dt, Math.sin(a) * ped.speed * dt, 10, city);
    ped.x = pos.x;
    ped.y = pos.y;
  }
}
