// SOLMAR STREETS — core engine: state, driving, traffic, pedestrians, police, combat, wanted.
// Written fresh for round 9 (rebuild7).
import { WORLD, CITY, CAR_MODELS, CAR_COLORS, PED_TYPES, clamp, dist, angleTo, angleDiff, pick, mulberry32 } from './config.js';
import { buildCity, collideBuildings, randomRoadPoint, nearestRoadPoint, roadCenter } from './city.js';

/** Mission targets sit on roads (landmarks are block centers, inside buildings). */
const roadNear = (p) => nearestRoadPoint(p.x, p.y);

export function createState(seed = 11) {
  const rng = mulberry32(seed);
  const city = buildCity(rng);
  const G = {
    rng, city, seed,
    screen: 'title',
    clock: { hours: 10, minutes: 9, day: 1 },
    money: 500,
    player: {
      x: city.landmarks.home.x, y: city.landmarks.home.y + 40, angle: -Math.PI / 2,
      hp: 100, ammo: 30, onFoot: true, car: null, speed: 0, punchTimer: 0, muzzle: 0,
    },
    cars: [], peds: [], police: [], breakers: [],
    wanted: 0, heat: 0, lastCrime: -999, time: 0,
    missionsDone: [], mission: null,
    taxi: { active: false, stage: 0, passenger: null, dest: null, fare: 0, timer: 0 },
    courier: { active: false, stage: 0, drops: [], timer: 0, done: 0 },
    message: '', messageTimer: 0,
    objective: 'Meet Vera at Home to start work.',
    shopOpen: null, shopNear: null,
    stats: { shots: 0, punches: 0, carsStolen: 0 },
    muted: false,
  };
  spawnTraffic(G, 26);
  spawnPeds(G, 40);
  spawnParked(G, 14);
  return G;
}

export function spawnTraffic(G, n) {
  for (let i = 0; i < n; i++) {
    const p = randomRoadPoint(G.rng);
    const model = pick(G.rng, CAR_MODELS);
    G.cars.push(makeCar(G, p.x, p.y, model, 'traffic'));
  }
}

export function spawnParked(G, n) {
  for (let i = 0; i < n; i++) {
    const p = randomRoadPoint(G.rng);
    const model = pick(G.rng, CAR_MODELS);
    const c = makeCar(G, p.x + (G.rng() - 0.5) * 40, p.y + (G.rng() - 0.5) * 40, model, 'parked');
    c.angle = Math.floor(G.rng() * 4) * Math.PI / 2;
    c.speed = 0;
    G.cars.push(c);
  }
}

export function spawnPeds(G, n) {
  for (let i = 0; i < n; i++) {
    const type = pick(G.rng, PED_TYPES);
    const p = randomRoadPoint(G.rng);
    G.peds.push({
      x: p.x + (G.rng() - 0.5) * 60, y: p.y + (G.rng() - 0.5) * 60,
      angle: G.rng() * Math.PI * 2, type, hp: 30, speed: type.speed,
      wp: null, panic: 0, dead: false, walkPhase: G.rng() * 6,
    });
  }
}

export function makeCar(G, x, y, model, driver) {
  return {
    x, y, angle: Math.floor(G.rng() * 4) * Math.PI / 2,
    speed: 0, model, color: pick(G.rng, CAR_COLORS),
    driver, hp: model.hp, maxHp: model.hp,
    wp: null, target: null, dead: false, siren: 0,
    cruise: 130 + G.rng() * 30,
  };
}

export function addHeat(G, n) {
  G.heat = clamp(G.heat + n, 0, 100);
  G.lastCrime = G.time;
  updateWanted(G);
}

export function updateWanted(G) {
  const h = G.heat;
  G.wanted = h >= 90 ? 5 : h >= 70 ? 4 : h >= 50 ? 3 : h >= 30 ? 2 : h >= 10 ? 1 : 0;
}

export function setMessage(G, text, secs = 4) {
  G.message = text; G.messageTimer = secs;
}

function steerToward(car, tx, ty, dt, turnRate = 2.6) {
  const want = angleTo(car.x, car.y, tx, ty);
  const d = angleDiff(car.angle, want);
  car.angle += clamp(d, -turnRate * dt, turnRate * dt);
  return Math.abs(d);
}

/** Road-following drive: pick intersection waypoints along road centerlines and steer toward them.
    Used by traffic cars and by mission vehicles (courier, bank van) so they stay on roads. */
function roadDrive(G, c, dt, cruise) {
  if (!c.wp || dist(c.x, c.y, c.wp.x, c.wp.y) < 26) {
    const np = nearestRoadPoint(c.x, c.y);
    const onV = Math.abs(c.x - np.x) < 8; // on a vertical road
    const step = WORLD.BLOCK + WORLD.ROAD;
    let nx = c.x, ny = c.y;
    const r = G.rng();
    if (onV) {
      const dir = Math.sin(c.angle) > 0 ? 1 : -1;
      if (r < 0.25) { // turn onto the crossing horizontal road
        nx = c.x + (G.rng() < 0.5 ? 1 : -1) * step; ny = np.y;
      } else { nx = c.x; ny = c.y + dir * step; }
    } else {
      const dir = Math.cos(c.angle) > 0 ? 1 : -1;
      if (r < 0.25) {
        nx = np.x; ny = c.y + (G.rng() < 0.5 ? 1 : -1) * step;
      } else { nx = c.x + dir * step; ny = c.y; }
    }
    c.wp = { x: clamp(nx, 30, CITY - 30), y: clamp(ny, 30, CITY - 30) };
  }
  const d = steerToward(c, c.wp.x, c.wp.y, dt, 2.2);
  const target = d > 0.6 ? 60 : cruise;
  c.speed += (target - c.speed) * dt * 1.5;
  c.x += Math.cos(c.angle) * c.speed * dt;
  c.y += Math.sin(c.angle) * c.speed * dt;
  const col = collideBuildings(G.city, c.x, c.y, 20);
  c.x = col.x; c.y = col.y;
  c.x = clamp(c.x, 20, CITY - 20); c.y = clamp(c.y, 20, CITY - 20);
}

/** Traffic cars drive road centerlines and turn at intersections. */
function updateTrafficCar(G, c, dt) {
  if (c.driver !== 'traffic') return;
  roadDrive(G, c, dt, c.cruise || 150);
}

function updatePed(G, p, dt) {
  if (p.dead) return;
  p.walkPhase += dt * 4;
  if (p.panic > 0) {
    p.panic -= dt;
    p.x += Math.cos(p.angle) * 150 * dt;
    p.y += Math.sin(p.angle) * 150 * dt;
  } else if (p.type.behavior === 'stand') {
    // idle, occasionally shuffle
    if (G.rng() < 0.002) p.angle = G.rng() * Math.PI * 2;
  } else {
    if (!p.wp || dist(p.x, p.y, p.wp.x, p.wp.y) < 14) {
      const np = nearestRoadPoint(p.x, p.y);
      const off = (G.rng() - 0.5) * 60;
      // stroll along the sidewalk beside the nearest road
      p.wp = { x: clamp(np.x + off, 20, CITY - 20), y: clamp(np.y + off, 20, CITY - 20) };
      if (G.rng() < 0.5) p.wp = randomRoadPoint(G.rng);
    }
    steerToward(p, p.wp.x, p.wp.y, dt, 3);
    const sp = (p.type.behavior === 'dart' ? p.speed * 1.4 : p.speed) * 60;
    p.x += Math.cos(p.angle) * sp * dt;
    p.y += Math.sin(p.angle) * sp * dt;
  }
  const col = collideBuildings(G.city, p.x, p.y, 9);
  p.x = clamp(col.x, 16, CITY - 16); p.y = clamp(col.y, 16, CITY - 16);
}

function updatePolice(G, dt) {
  // spawn to match wanted level
  const want = Math.min(G.wanted, 5);
  while (G.police.length < want) {
    const a = G.rng() * Math.PI * 2;
    const d = 380 + G.rng() * 200;
    const p = randomRoadPoint(G.rng);
    const model = CAR_MODELS[1];
    const car = makeCar(G, clamp(G.player.x + Math.cos(a) * d, 40, CITY - 40), clamp(G.player.y + Math.sin(a) * d, 40, CITY - 40), model, 'police');
    car.color = '#1f3a93'; car.hp = 90; car.maxHp = 90;
    G.police.push(car);
    G.cars.push(car);
  }
  // despawn extras when wanted falls
  while (G.police.length > want) {
    const car = G.police.pop();
    car.dead = true;
    const i = G.cars.indexOf(car);
    if (i >= 0) G.cars.splice(i, 1);
  }
  for (const car of G.police) {
    if (car.dead) continue;
    car.siren += dt;
    const pl = G.player;
    const tx = pl.onFoot ? pl.x : (pl.car ? pl.car.x : pl.x);
    const ty = pl.onFoot ? pl.y : (pl.car ? pl.car.y : pl.y);
    steerToward(car, tx, ty, dt, 3.0);
    const d = dist(car.x, car.y, tx, ty);
    const target = d > 260 ? 330 : 280;
    car.speed += (target - car.speed) * dt * 1.2;
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    const col = collideBuildings(G.city, car.x, car.y, 20);
    car.x = col.x; car.y = col.y;
    // ram damage
    if (d < 42) {
      if (!pl.onFoot && pl.car) {
        pl.car.hp -= 8 * dt;
        if (pl.car.hp <= 0) { pl.car.hp = 0; }
      } else {
        pl.hp -= 6 * dt;
      }
      if (G.rng() < dt * 0.5) addHeat(G, 1);
    }
    if (car.hp <= 0) {
      car.dead = true;
      const i = G.police.indexOf(car);
      if (i >= 0) G.police.splice(i, 1);
      const j = G.cars.indexOf(car);
      if (j >= 0) G.cars.splice(j, 1);
    }
  }
}

/** Player driving physics + collisions. */
function updatePlayerCar(G, dt, input) {
  const pl = G.player;
  const car = pl.car;
  if (!car) return;
  const fwd = input.up ? 1 : input.down ? -0.55 : 0;
  const topSpeed = car.model.top * 55;
  car.speed += (fwd * topSpeed - car.speed) * dt * (input.up ? 1.4 : 2.2);
  if (Math.abs(car.speed) < 3 && !input.up && !input.down) car.speed = 0;
  const steer = (input.left ? -1 : 0) + (input.right ? 1 : 0);
  const dir = car.speed >= 0 ? 1 : -1;
  car.angle += steer * 2.4 * dt * clamp(Math.abs(car.speed) / 150, 0, 1) * dir;
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  const col = collideBuildings(G.city, car.x, car.y, 20);
  if (col.x !== car.x || col.y !== car.y) {
    // hitting a building scrubs speed and damages the car a little
    if (Math.abs(car.speed) > 150) car.hp -= 2;
    car.speed *= 0.4;
    car.x = col.x; car.y = col.y;
  }
  car.x = clamp(car.x, 20, CITY - 20); car.y = clamp(car.y, 20, CITY - 20);
  pl.x = car.x; pl.y = car.y; pl.angle = car.angle;
  // running over pedestrians
  for (const p of G.peds) {
    if (!p.dead && dist(car.x, car.y, p.x, p.y) < 26 && Math.abs(car.speed) > 60) {
      p.dead = true; addHeat(G, 12); setMessage(G, 'Pedestrian hit! Wanted up.', 2);
    }
  }
  // car-car bumps
  for (const o of G.cars) {
    if (o === car || o.dead) continue;
    const d = dist(car.x, car.y, o.x, o.y);
    if (d < 40 && d > 0.01) {
      const push = (40 - d) / 2;
      const nx = (o.x - car.x) / d, ny = (o.y - car.y) / d;
      o.x += nx * push; o.y += ny * push;
      if (Math.abs(car.speed) > 200) {
        o.hp -= 12;
        if (o.driver === 'courier' || o.driver === 'van') {
          // mission targets take ram damage
        }
        if (o.hp <= 0 && o.driver !== 'police') { o.dead = true; }
        if (o.driver === 'traffic' || o.driver === 'parked') addHeat(G, 3);
      }
    }
  }
  G.cars = G.cars.filter(c => !c.dead || c.driver === 'police');
}

function updatePlayerFoot(G, dt, input) {
  const pl = G.player;
  const sp = 3.4;
  let mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  if (mx || my) {
    const len = Math.hypot(mx, my);
    const sp = 3.4 * 60;
    pl.x += (mx / len) * sp * dt;
    pl.y += (my / len) * sp * dt;
    pl.angle = Math.atan2(my, mx);
  }
  const col = collideBuildings(G.city, pl.x, pl.y, 10);
  pl.x = clamp(col.x, 16, CITY - 16); pl.y = clamp(col.y, 16, CITY - 16);
  pl.punchTimer = Math.max(0, pl.punchTimer - dt);
  pl.muzzle = Math.max(0, pl.muzzle - dt);
}

/** Punch: damages the nearest breaker/ped/car in front. */
export function doPunch(G) {
  const pl = G.player;
  if (!pl.onFoot || pl.punchTimer > 0) return false;
  pl.punchTimer = 0.35;
  let best = null, bd = 48;
  const consider = (x, y, obj) => {
    const d = dist(pl.x, pl.y, x, y);
    const ang = Math.abs(angleDiff(pl.angle, angleTo(pl.x, pl.y, x, y)));
    if (d < bd && ang < 1.2) { bd = d; best = obj; }
  };
  for (const b of G.breakers) if (!b.dead) consider(b.x, b.y, { kind: 'breaker', o: b });
  for (const p of G.peds) if (!p.dead) consider(p.x, p.y, { kind: 'ped', o: p });
  for (const c of G.cars) if (!c.dead) consider(c.x, c.y, { kind: 'car', o: c });
  if (!best) return false;
  if (best.kind === 'breaker') {
    best.o.hp -= 12;
    if (best.o.hp <= 0) { best.o.dead = true; }
  } else if (best.kind === 'ped') {
    best.o.dead = true; addHeat(G, 12);
  } else {
    best.o.hp -= 6;
    if (best.o.hp <= 0) best.o.dead = true;
    addHeat(G, 4);
  }
  return true;
}

/** Shoot toward world point (wx,wy). Returns what was hit. */
export function doShoot(G, wx, wy) {
  const pl = G.player;
  if (!pl.onFoot || pl.ammo <= 0) return null;
  pl.ammo--; pl.muzzle = 0.12;
  const ang = angleTo(pl.x, pl.y, wx, wy);
  pl.angle = ang;
  let best = null, bd = 340;
  const consider = (x, y, obj) => {
    const d = dist(pl.x, pl.y, x, y);
    if (d > 340 || d > bd) return;
    const a = Math.abs(angleDiff(ang, angleTo(pl.x, pl.y, x, y)));
    if (a < 0.12 || d < 30) { bd = d; best = obj; }
  };
  for (const b of G.breakers) if (!b.dead) consider(b.x, b.y, { kind: 'breaker', o: b });
  for (const p of G.peds) if (!p.dead) consider(p.x, p.y, { kind: 'ped', o: p });
  for (const c of G.cars) if (!c.dead) consider(c.x, c.y, { kind: 'car', o: c });
  if (!best) return null;
  if (best.kind === 'breaker') {
    best.o.hp -= 25;
    if (best.o.hp <= 0) best.o.dead = true;
  } else if (best.kind === 'ped') {
    best.o.dead = true; addHeat(G, 10);
  } else {
    best.o.hp -= 20;
    if (best.o.hp <= 0 && best.o.driver !== 'police') best.o.dead = true;
    addHeat(G, 3);
  }
  return best.kind;
}

/** Enter / exit the nearest car. */
export function tryEnterCar(G) {
  const pl = G.player;
  if (!pl.onFoot) {
    // get out
    if (pl.car) {
      const car = pl.car;
      pl.car = null; pl.onFoot = true;
      pl.x = car.x + Math.cos(car.angle + Math.PI / 2) * 30;
      pl.y = car.y + Math.sin(car.angle + Math.PI / 2) * 30;
      pl.speed = 0;
      return 'out';
    }
    return null;
  }
  let best = null, bd = 46;
  for (const c of G.cars) {
    if (c.dead || c.driver === 'police') continue;
    const d = dist(pl.x, pl.y, c.x, c.y);
    if (d < bd) { bd = d; best = c; }
  }
  if (!best) return null;
  pl.car = best; pl.onFoot = false;
  if (best.driver === 'parked' || best.driver === 'traffic') {
    best.driver = 'player';
    addHeat(G, 15);
    G.stats.carsStolen++;
    setMessage(G, 'Car stolen! Wanted up.', 2);
  }
  pl.x = best.x; pl.y = best.y; pl.angle = best.angle;
  return 'in';
}

/** One simulation step (dt in seconds). input: {up,down,left,right}. */
export function update(G, dt, input) {
  G.time += dt;
  // clock: 1 game minute per 2 real seconds
  G.clock.minutes += dt * 0.5;
  while (G.clock.minutes >= 60) { G.clock.minutes -= 60; G.clock.hours++; }
  while (G.clock.hours >= 24) { G.clock.hours -= 24; G.clock.day++; }
  // wanted decay
  if (G.time - G.lastCrime > 8 && G.heat > 0) {
    G.heat = Math.max(0, G.heat - dt * 1.2);
    updateWanted(G);
  }
  if (G.messageTimer > 0) G.messageTimer -= dt;
  if (pl_dead_check(G)) return;
  if (G.player.onFoot) updatePlayerFoot(G, dt, input);
  else updatePlayerCar(G, dt, input);
  for (const c of G.cars) if (!c.dead) updateTrafficCar(G, c, dt);
  G.cars = G.cars.filter(c => !c.dead);
  for (const p of G.peds) updatePed(G, p, dt);
  G.peds = G.peds.filter(p => !p.dead);
  updateBreakers(G, dt);
  updatePolice(G, dt);
  if (G.mission) updateMission(G, dt);
  updateTaxi(G, dt);
  updateCourier(G, dt);
  // M5 auto-trigger at 22:00 once M4 is done
  if (G.clock.hours === 22 && G.clock.minutes < 1 && G.missionsDone.includes(4) && !G.missionsDone.includes(5) && !G.mission) {
    const m = startMission(G, 5);
    if (m) setMessage(G, 'Night Heist! Intercept the bank van.', 5);
  }
}

function pl_dead_check(G) {
  if (G.player.hp <= 0) {
    G.player.hp = 0;
    if (G.screen === 'playing') {
      G.screen = 'wasted';
      G.money = Math.max(0, G.money - 100);
    }
    return true;
  }
  return false;
}

export function respawn(G) {
  const h = G.city.landmarks.home;
  G.player.hp = 100;
  G.player.x = h.x; G.player.y = h.y + 40;
  G.player.onFoot = true; G.player.car = null;
  G.wanted = 0; G.heat = 0;
  G.police.forEach(c => { c.dead = true; });
  G.police = [];
  G.screen = 'playing';
  setMessage(G, 'You woke up at Home. -$100 hospital bill.', 4);
}

/** Breakers: M3 enemies that chase and hit the player. */
export function spawnBreakers(G, n = 5) {
  G.breakers = [];
  const harbor = G.city.landmarks.harbor;
  for (let i = 0; i < n; i++) {
    G.breakers.push({
      x: harbor.x - 60 - i * 40, y: harbor.y + (G.rng() - 0.5) * 160,
      angle: 0, hp: 50, maxHp: 50, speed: 2.0, dead: false, hitTimer: 0,
    });
  }
}

function updateBreakers(G, dt) {
  for (const b of G.breakers) {
    if (b.dead) continue;
    b.hitTimer = Math.max(0, b.hitTimer - dt);
    const d = dist(b.x, b.y, G.player.x, G.player.y);
    if (d < 320) {
      const a = angleTo(b.x, b.y, G.player.x, G.player.y);
      b.angle = a;
      if (d > 26) {
        b.x += Math.cos(a) * b.speed * 60 * dt;
        b.y += Math.sin(a) * b.speed * 60 * dt;
      } else if (b.hitTimer <= 0) {
        G.player.hp -= 6;
        b.hitTimer = 1.2;
        if (G.player.hp <= 0) pl_dead_check(G);
      }
      const col = collideBuildings(G.city, b.x, b.y, 10);
      b.x = col.x; b.y = col.y;
    }
  }
  G.breakers = G.breakers.filter(b => !b.dead);
}

/** Start a story mission by id (1-5). Returns the mission object or null. */
export function startMission(G, id) {
  if (G.mission) return null;
  if (G.missionsDone.includes(id)) return null;
  if (id > 1 && !G.missionsDone.includes(id - 1)) return null;
  const L = G.city.landmarks;
  const m = { id, stage: 0, timer: 0, target: null, extra: {} };
  if (id === 1) {
    m.target = { x: L.harbor.x, y: L.harbor.y };
    m.timer = 90;
    m.text = 'M1 The Getaway: reach the Harbor in 90s.';
  } else if (id === 2) {
    m.target = roadNear(L.bank);
    m.timer = 120;
    m.text = 'M2 Hot Delivery: drop the package at Solmar Bank, then Rooftop Plaza.';
  } else if (id === 3) {
    spawnBreakers(G, 5);
    m.target = { x: L.harbor.x, y: L.harbor.y };
    m.text = 'M3 Dockside Takedown: take down all 5 Breakers at the Harbor.';
  } else if (id === 4) {
    const c = makeCar(G, L.harbor.x - 120, L.harbor.y + 60, CAR_MODELS[3], 'courier');
    c.color = '#e74c3c'; c.hp = 60; c.maxHp = 60; c.cruise = 165;
    c.wp = null; // roadDrive picks road waypoints; never aim at a block center
    G.cars.push(c);
    m.extra.courier = c;
    m.target = { x: c.x, y: c.y };
    m.text = 'M4 Harbor Chase: ram the courier to a stop, grab the ledger, bring it home.';
  } else if (id === 5) {
    G.clock.hours = 22; G.clock.minutes = 0;
    const v = makeCar(G, L.bank.x + 80, L.bank.y, CAR_MODELS[3], 'van');
    v.color = '#2c3e50'; v.hp = 80; v.maxHp = 80; v.cruise = 176;
    v.wp = null; // roadDrive picks road waypoints; never aim at a block center
    G.cars.push(v);
    m.extra.van = v;
    m.target = { x: v.x, y: v.y };
    addHeat(G, 40);
    m.text = 'M5 Night Heist: stop the bank van, grab 3 cash bags, reach the stash.';
  }
  G.mission = m;
  G.objective = m.text;
  return m;
}

/** Advance the active mission. Returns 'done' | 'fail' | null. */
export function updateMission(G, dt) {
  const m = G.mission;
  if (!m) return null;
  const pl = G.player;
  const L = G.city.landmarks;
  const near = (t, r = 60) => dist(pl.x, pl.y, t.x, t.y) < r;
  if (m.id === 1) {
    m.timer -= dt;
    if (near(m.target, 70)) return completeMission(G, 1);
    if (m.timer <= 0) return failMission(G, 'M1 failed: out of time.');
  } else if (m.id === 2) {
    m.timer -= dt;
    if (m.stage === 0 && near(m.target, 70)) {
      m.stage = 1; m.target = roadNear(L.plaza);
      m.text = 'M2 Hot Delivery: package 1 dropped. Now Rooftop Plaza.';
      G.objective = m.text; setMessage(G, 'Package 1 delivered.', 3);
    } else if (m.stage === 1 && near(m.target, 70)) {
      return completeMission(G, 2);
    }
    if (m.timer <= 0) return failMission(G, 'M2 failed: out of time.');
  } else if (m.id === 3) {
    if (G.breakers.length === 0) return completeMission(G, 3);
  } else if (m.id === 4) {
    const c = m.extra.courier;
    if (m.stage === 0) {
      // courier flees along the roads; the player rams it to a stop.
      // NOTE: the ram sets c.dead in updatePlayerCar, so the hp<=0 check
      // must run even when c.dead is already true (else the stage never advances).
      if (c && !c.dead) {
        roadDrive(G, c, dt, c.cruise);
        m.target = { x: c.x, y: c.y };
      }
      if (c && (c.hp <= 0 || c.dead)) {
        c.dead = true; c.speed = 0;
        m.stage = 1;
        m.text = 'M4: courier stopped! Grab the ledger.';
        G.objective = m.text; setMessage(G, 'Courier stopped. Grab the ledger.', 4);
      } else if (!c) return failMission(G, 'M4 failed: courier lost.');
    } else if (m.stage === 1) {
      if (!pl.onFoot && pl.car) { /* must be on foot to grab */ }
      else if (near({ x: c.x, y: c.y }, 46)) {
        m.stage = 2; m.target = roadNear(L.home);
        m.text = 'M4: ledger grabbed! Bring it home.';
        G.objective = m.text; setMessage(G, 'Ledger grabbed!', 3);
      }
    } else if (m.stage === 2 && near(m.target, 70)) {
      return completeMission(G, 4);
    }
  } else if (m.id === 5) {
    const v = m.extra.van;
    if (m.stage === 0) {
      // van flees along the roads; the player stops it by ramming or shooting.
      // NOTE: same as M4 — the hp<=0 check must run even when v.dead is
      // already true, or the stage never advances.
      if (v && !v.dead) {
        roadDrive(G, v, dt, v.cruise);
        m.target = { x: v.x, y: v.y };
      }
      if (v && (v.hp <= 0 || v.dead)) {
        v.dead = true; v.speed = 0;
        m.stage = 1;
        // spawn 3 cash bags around the van
        m.extra.bags = [0, 1, 2].map(i => ({ x: v.x + (i - 1) * 44, y: v.y + 36, got: false }));
        m.text = 'M5: van stopped! Grab all 3 cash bags.';
        G.objective = m.text; setMessage(G, 'Van stopped. Grab the cash bags!', 4);
      }
    } else if (m.stage === 1) {
      let got = 0;
      for (const b of m.extra.bags) {
        if (!b.got && near(b, 40)) { b.got = true; setMessage(G, 'Cash bag grabbed!', 2); }
        if (b.got) got++;
      }
      m.text = `M5: cash bags (${got}/3). Then reach the stash.`;
      G.objective = m.text;
      if (got === 3) {
        m.stage = 2; m.target = roadNear(L.home);
        m.text = 'M5: all bags grabbed! Reach the stash house.';
        G.objective = m.text;
      }
    } else if (m.stage === 2 && near(m.target, 70)) {
      return completeMission(G, 5);
    }
  }
  return null;
}

export function completeMission(G, id) {
  const pay = [0, 950, 800, 1500, 1200, 2000][id] || 0;
  G.money += pay;
  G.missionsDone.push(id);
  G.mission = null;
  const next = id < 5 ? ` Next: M${id + 1}.` : ' All missions done!';
  G.objective = `M${id} complete! +$${pay}.${next}`;
  setMessage(G, `Mission complete! +$${pay}`, 5);
  return 'done';
}

export function failMission(G, why) {
  G.mission = null;
  G.objective = 'Meet Vera at Home to start work.';
  setMessage(G, why + ' Talk to Vera to retry.', 5);
  return 'fail';
}

/** Taxi side job. */
export function updateTaxi(G, dt) {
  const t = G.taxi;
  const L = G.city.landmarks;
  if (!t.active) {
    // spawn a waiting passenger at the taxi stand sometimes
    if (!t.passenger && G.rng() < dt * 0.05 && !G.mission) {
      t.passenger = { x: L.taxistand.x + (G.rng() - 0.5) * 40, y: L.taxistand.y + (G.rng() - 0.5) * 40 };
    }
    if (t.passenger && !G.player.onFoot && dist(G.player.x, G.player.y, t.passenger.x, t.passenger.y) < 60) {
      t.active = true; t.stage = 1;
      t.dest = roadNear(L.plaza);
      t.fare = 180 + Math.floor(G.rng() * 80);
      t.timer = 90;
      t.passenger = null;
      G.objective = `Taxi: take the passenger to Rooftop Plaza. Fare $${t.fare}.`;
      setMessage(G, 'Passenger picked up!', 3);
    }
    return;
  }
  t.timer -= dt;
  if (dist(G.player.x, G.player.y, t.dest.x, t.dest.y) < 70) {
    G.money += t.fare;
    setMessage(G, `Taxi fare paid: +$${t.fare}.`, 4);
    t.active = false; t.stage = 0; t.dest = null;
    G.objective = 'Meet Vera at Home to start work.';
    return 'done';
  }
  if (t.timer <= 0) {
    t.active = false; t.stage = 0; t.dest = null;
    setMessage(G, 'Taxi passenger left. Too slow.', 3);
    return 'fail';
  }
  return null;
}

/** Start the courier side job (shared by the random trigger and the debug API). */
export function startCourierJob(G) {
  const L = G.city.landmarks;
  const c = G.courier;
  c.active = true; c.stage = 0; c.done = 0; c.timer = 150;
  c.drops = [
    roadNear(L.bank),
    roadNear(L.plaza),
    { x: L.harbor.x, y: L.harbor.y },
  ];
  G.objective = 'Courier: 3 timed parcel drops. $120 each + $80 bonus.';
  setMessage(G, 'Courier job started: 3 drops.', 4);
}

/** Courier side job: 3 timed parcel drops. */
export function updateCourier(G, dt) {
  const c = G.courier;
  if (!c.active) {
    if (G.rng() < dt * 0.03 && !G.mission && G.missionsDone.length >= 1) {
      startCourierJob(G);
    }
    return;
  }
  c.timer -= dt;
  const d = c.drops[c.stage];
  if (d && dist(G.player.x, G.player.y, d.x, d.y) < 70) {
    G.money += 120; c.done++; c.stage++;
    setMessage(G, `Parcel ${c.done}/3 delivered. +$120.`, 3);
    if (c.stage >= 3) {
      G.money += 80;
      setMessage(G, 'Courier job done! +$80 bonus.', 4);
      c.active = false;
      G.objective = 'Meet Vera at Home to start work.';
      return 'done';
    }
    G.objective = `Courier: drop ${c.stage + 1}/3. $120 each.`;
  }
  if (c.timer <= 0) {
    c.active = false;
    setMessage(G, 'Courier job expired.', 3);
    return 'fail';
  }
  return null;
}

/** Shop purchase. kind: 'pitstop' | 'gunbarn' | 'diner'. */
export function buyShop(G, kind) {
  const pl = G.player;
  if (kind === 'pitstop') {
    if (!pl.car || pl.car.hp >= pl.car.maxHp) return 'Car already at full health.';
    if (G.money < 120) return 'Not enough money ($120).';
    G.money -= 120; pl.car.hp = pl.car.maxHp;
    return 'Car repaired to full.';
  }
  if (kind === 'gunbarn') {
    if (G.money < 150) return 'Not enough money ($150).';
    G.money -= 150; pl.ammo += 30;
    return '+30 ammo.';
  }
  if (kind === 'diner') {
    if (pl.hp >= 100) return 'Already at full health.';
    if (G.money < 50) return 'Not enough money ($50).';
    G.money -= 50; pl.hp = 100;
    return 'Healed to full.';
  }
  return null;
}
