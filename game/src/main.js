// SOLMAR STREETS — the game itself. Wires every module into one loop and
// exposes a debug API (window.__solmar) the play-test probe drives.
import { CFG } from './config.js';
import { angleDiff, clamp, dist, mulberry32, rand, randInt } from './random.js';
import { buildCity, collideBuildings, isOnRoad, pointInBuilding, roadCentres, roadSnap } from './city.js';
import {
  makeCar, makePed, makePlayer, pickPedTarget, spawnOfficer, spawnParkedCars,
  spawnPoliceCar, spawnTrafficCar, updatePed, updateTrafficCar,
} from './entities.js';
import { bustPlayer, hurtPlayer, punch, raiseWanted, shoot } from './combat.js';
import { AudioSys } from './audio.js';
import { drawHUD, drawBusted, drawPause, drawTitle, drawWasted } from './hud.js';
import { drawMinimap, drawWorld } from './render.js';
import { Input } from './input.js';
import { loadGame, saveGame } from './save.js';
import {
  canStartMission, completeMission, failMission, nextMission, startCourier,
  startMission, startTaxi, updateCourier, updateMissions, updateTaxi,
} from './missions.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = 1280, H = 720;
canvas.width = W; canvas.height = H;

const rng = mulberry32(11); // fixed seed: the same city every run

const G = {
  rng, now: 0, screen: 'title',
  time: { hours: 8, minutes: 0, day: 1 },
  money: CFG.startMoney, missionsDone: [],
  mission: { id: 0, stage: 0, timer: 0, data: {}, active: false },
  taxi: { active: false, stage: 0, cd: 0, pickup: null, dest: null, fare: 0 },
  courier: { active: false, cd: 0, timer: 0, drops: [] },
  objective: 'See Vera at her office to start a job.',
  prompt: '', saveSoon: false, saveTimer: 0,
  wantedTimer: 0, sirenTimer: 0,
  tracers: [], muzzle: 0,
  breakers: [], officers: [],
  cars: [], peds: [],
  camera: { x: 700, y: 700 },
  audio: new AudioSys(),
  input: new Input(canvas),
  debug: { auto: null, aim: null },
};
G.city = buildCity(rng);
G.player = makePlayer(700, 780);
G.cars = spawnParkedCars(rng, G.city, 24);
for (let i = 0; i < 10; i++) G.cars.push(spawnTrafficCar(rng, G.city));
for (let i = 0; i < 40; i++) {
  G.peds.push(makePed(rng, G.city, rand(rng, 200, 3000), rand(rng, 200, 3000)));
}

// mission vehicles the missions module asks main to spawn
G.spawnCourierCar = function () {
  const c = makeCar(5, 1, 2900, 3000, Math.PI, { driver: 'courier' });
  c.speed = 100;
  c.waypoints = [{ x: 600, y: 3000 }, { x: 600, y: 600 }, { x: 2900, y: 600 }];
  c.wp = 0;
  G.cars.push(c);
  return c;
};
G.spawnBankVan = function () {
  const v = makeCar(2, 4, 2600, 600, 0, { driver: 'van' });
  v.speed = 120;
  v.waypoints = [{ x: 3000, y: 600 }, { x: 3000, y: 1000 }, { x: 2600, y: 1000 }, { x: 2600, y: 600 }];
  v.wp = 0;
  G.cars.push(v);
  return v;
};
G.spawnPolice = function () { spawnPoliceCar(G); };
G.spawnOfficer = function () { spawnOfficer(G); };

// Road-routed waypoints: every leg runs along a road centreline, so the
// autopilot never cuts across a block (and its buildings). Route: nearest
// on-road point -> nearest intersection -> across the grid -> target's
// on-road point -> the target itself.
function routeWaypoints(x, y, tx, ty) {
  const centres = roadCentres();
  const nearestC = (v) => centres.reduce((a, c) => (Math.abs(c - v) < Math.abs(a - v) ? c : a), centres[0]);
  const s = roadSnap(x, y), t = roadSnap(tx, ty);
  const i1 = { x: nearestC(x), y: nearestC(y) };
  const i2 = { x: nearestC(tx), y: nearestC(ty) };
  const pts = [s, i1, { x: i2.x, y: i1.y }, i2, t, { x: tx, y: ty }];
  return pts.filter((p, i) => i === 0 || dist(p.x, p.y, pts[i - 1].x, pts[i - 1].y) > 20);
}

function updateAutopilot(dt) {
  const auto = G.debug.auto;
  if (!auto) return;
  const p = G.player;
  const pos = p.inCar ? p.inCar : p;
  const tgt = auto.pts[auto.i];
  if (!tgt) { G.debug.auto = null; return; }
  if (dist(pos.x, pos.y, tgt.x, tgt.y) < 40) {
    auto.i++;
    if (auto.i >= auto.pts.length) G.debug.auto = null;
    return;
  }
  const want = Math.atan2(tgt.y - pos.y, tgt.x - pos.x);
  if (p.inCar) {
    const car = p.inCar;
    const m = CFG.carModels[car.model];
    const diff = angleDiff(car.angle, want);
    car.angle += clamp(diff, -m.turn * dt, m.turn * dt);
    const d = dist(pos.x, pos.y, tgt.x, tgt.y);
    if (Math.abs(diff) > 1.2) car.speed = Math.max(0, car.speed - 500 * dt);
    // brake near the waypoint: at full speed the turning circle is wide
    // enough to overshoot intersections and oscillate
    else car.speed = Math.min(m.top * (d < 300 ? 0.45 : 0.85), car.speed + m.accel * dt);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    const c = collideBuildings(G.city, car.x, car.y, 26);
    if (c.x !== car.x || c.y !== car.y) { car.x = c.x; car.y = c.y; car.speed *= 0.4; }
    car.x = clamp(car.x, 40, CFG.world - 40); car.y = clamp(car.y, 40, CFG.world - 40);
    p.x = car.x; p.y = car.y; p.angle = car.angle; // keep the player on the car
  } else {
    p.angle = want;
    p.x += Math.cos(want) * CFG.walkSpeed * dt;
    p.y += Math.sin(want) * CFG.walkSpeed * dt;
    const c = collideBuildings(G.city, p.x, p.y, 12);
    p.x = c.x; p.y = c.y;
    p.x = clamp(p.x, 20, CFG.world - 20); p.y = clamp(p.y, 20, CFG.world - 20);
    p.walkAnim += dt;
  }
}

// ---------- player ----------
function nearestCar(maxD) {
  let best = null, bd = maxD;
  for (const c of G.cars) {
    if (c.dead || c === G.player.inCar) continue;
    const d = dist(G.player.x, G.player.y, c.x, c.y);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

function enterCar(car) {
  const p = G.player;
  if (car.driver && car.driver !== 'player') {
    // carjacking a driven car: the driver bails, the law notices
    raiseWanted(G, 1);
  } else if (!car.ownerPlayer) {
    raiseWanted(G, 1);
  }
  car.driver = 'player'; // the traffic AI must never drive the player's car
  car.ownerPlayer = true;
  car.traffic = false; car.parked = false;
  p.inCar = car;
  p.x = car.x; p.y = car.y;
}

function exitCar() {
  const p = G.player, car = p.inCar;
  if (!car) return;
  p.inCar = null;
  p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 40;
  p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 40;
  p.angle = car.angle;
  car.speed = 0;
}

function updatePlayer(dt) {
  const p = G.player, inp = G.input;
  p.shootCd = Math.max(0, p.shootCd - dt);
  p.punchCd = Math.max(0, p.punchCd - dt);
  G.muzzle = Math.max(0, G.muzzle - dt);
  // aim follows the mouse
  const wx = G.camera.x - W / 2 + inp.mouse.x;
  const wy = G.camera.y - H / 2 + inp.mouse.y;
  if (G.debug.aim) { p.angle = Math.atan2(G.debug.aim.y - p.y, G.debug.aim.x - p.x); }
  else if (!p.inCar) { p.angle = Math.atan2(wy - p.y, wx - p.x); }
  if (G.debug.auto) { updateAutopilot(dt); return; }
  if (p.inCar) {
    const car = p.inCar;
    const m = CFG.carModels[car.model];
    const mv = inp.moveVector();
    const fwd = mv.y < 0 ? 1 : mv.y > 0 ? -0.6 : 0;
    const steer = mv.x;
    if (fwd !== 0) {
      const dir = car.speed >= 0 ? 1 : -1;
      car.angle += steer * m.turn * dt * clamp(Math.abs(car.speed) / 120, 0.25, 1) * dir;
      car.speed += fwd * m.accel * dt;
    } else {
      car.speed *= Math.max(0, 1 - 1.6 * dt);
      if (Math.abs(car.speed) < 4) car.speed = 0;
    }
    car.speed = clamp(car.speed, -m.top * 0.4, m.top);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    const c = collideBuildings(G.city, car.x, car.y, 26);
    if (c.x !== car.x || c.y !== car.y) {
      if (Math.abs(car.speed) > 250) { car.hp -= 10; G.audio.thud(); }
      car.x = c.x; car.y = c.y; car.speed *= 0.3;
    }
    car.x = clamp(car.x, 40, CFG.world - 40); car.y = clamp(car.y, 40, CFG.world - 40);
    p.x = car.x; p.y = car.y; p.angle = car.angle;
    if (car.hp <= 0) { car.dead = true; car.speed = 0; exitCar(); G.objective = 'Your car is wrecked. Find another ride.'; }
    G.audio.setEngine(Math.abs(car.speed), m.top);
    if (inp.mouse.clicked) shoot(G, wx, wy);
  } else {
    const mv = inp.moveVector();
    p.x += mv.x * CFG.walkSpeed * dt;
    p.y += mv.y * CFG.walkSpeed * dt;
    const c = collideBuildings(G.city, p.x, p.y, 12);
    p.x = c.x; p.y = c.y;
    p.x = clamp(p.x, 20, CFG.world - 20); p.y = clamp(p.y, 20, CFG.world - 20);
    if (mv.x || mv.y) p.walkAnim += dt;
    G.audio.setEngine(0, 1);
    if (inp.mouse.clicked) shoot(G, wx, wy);
    if (inp.wasPressed(' ')) punch(G, wx, wy);
  }
  // E: enter/exit car, shops, mission start, jobs
  if (inp.wasPressed('e')) interact();
}

function interact() {
  const p = G.player;
  if (p.inCar) {
    const L = G.city.landmarks;
    if (dist(p.inCar.x, p.inCar.y, L.pitstop.x, L.pitstop.y) < 90
      && G.money >= CFG.shop.pitstop && p.inCar.hp < p.inCar.maxHp) {
      G.money -= CFG.shop.pitstop;
      p.inCar.hp = p.inCar.maxHp;
      G.objective = `Pit Stop: car repaired. -$${CFG.shop.pitstop}.`;
      G.audio.pickup();
      return;
    }
    exitCar(); return;
  }
  const car = nearestCar(70);
  if (car) { enterCar(car); return; }
  const L = G.city.landmarks;
  if (dist(p.x, p.y, L.vera.x, L.vera.y) < 90) {
    const n = nextMission(G);
    if (n <= 5 && startMission(G, n)) { G.audio.pickup(); return; }
  }
  if (dist(p.x, p.y, L.diner.x, L.diner.y) < 80) {
    if (G.money >= CFG.shop.diner && p.hp < CFG.maxHp) {
      G.money -= CFG.shop.diner; p.hp = Math.min(CFG.maxHp, p.hp + 50);
      G.objective = `Diner: healed to ${Math.ceil(p.hp)} HP. -$${CFG.shop.diner}.`;
      G.audio.pickup();
    }
    return;
  }
  if (dist(p.x, p.y, L.gunbarn.x, L.gunbarn.y) < 80) {
    if (G.money >= CFG.shop.gunbarn) {
      G.money -= CFG.shop.gunbarn; p.ammo += 30;
      G.objective = `Gun Barn: +30 ammo. -$${CFG.shop.gunbarn}.`;
      G.audio.pickup();
    }
    return;
  }
  if (dist(p.x, p.y, L.depot.x, L.depot.y) < 90) {
    if (startCourier(G)) { G.audio.pickup(); return; }
  }
  const stands = [L.taxiA, L.taxiB];
  for (const s of stands) {
    if (dist(p.x, p.y, s.x, s.y) < 80) {
      if (startTaxi(G)) { G.audio.pickup(); return; }
    }
  }
}

// ---------- collisions between cars ----------
function updateCarCollisions(dt) {
  const p = G.player;
  const cars = G.cars;
  for (let i = 0; i < cars.length; i++) {
    const a = cars[i];
    if (a.dead) continue;
    for (let j = i + 1; j < cars.length; j++) {
      const b = cars[j];
      if (b.dead) continue;
      const d = dist(a.x, a.y, b.x, b.y);
      if (d < 52 && d > 0.01) {
        const nx = (b.x - a.x) / d, ny = (b.y - a.y) / d;
        const overlap = (52 - d) / 2;
        a.x -= nx * overlap; a.y -= ny * overlap;
        b.x += nx * overlap; b.y += ny * overlap;
        // a hard ram into a mission vehicle damages it
        const rel = Math.abs(a.speed - b.speed);
        if (rel > 60) {
          if (a === p.inCar && (b.driver === 'courier' || b.driver === 'van')) {
            b.hp -= 25; b.speed *= 0.4; G.audio.thud();
          }
          if (b === p.inCar && (a.driver === 'courier' || a.driver === 'van')) {
            a.hp -= 25; a.speed *= 0.4; G.audio.thud();
          }
          if (a === p.inCar || b === p.inCar) {
            const other = a === p.inCar ? b : a;
            other.hp -= 6;
            if (other.hp <= 0) other.dead = true;
          }
        }
      }
    }
  }
  // player car vs pedestrians: running someone over is a crime
  if (p.inCar && Math.abs(p.inCar.speed) > 120) {
    for (const ped of G.peds) {
      if (ped.dead) continue;
      if (dist(ped.x, ped.y, p.inCar.x, p.inCar.y) < 40) {
        ped.hp = 0; ped.dead = true;
        raiseWanted(G, 1);
        G.audio.thud();
      }
    }
  }
  void dt;
}

// ---------- mission vehicles ----------
function updateMissionVehicles(dt) {
  for (const c of G.cars) {
    if (c.dead || !c.waypoints || c.hp <= 0) continue;
    const wp = c.waypoints[c.wp];
    if (!wp) continue;
    const d = dist(c.x, c.y, wp.x, wp.y);
    if (d < 40) { c.wp = (c.wp + 1) % c.waypoints.length; continue; }
    const want = Math.atan2(wp.y - c.y, wp.x - c.x);
    c.angle += clamp(angleDiff(c.angle, want), -2.4 * dt, 2.4 * dt);
    c.x += Math.cos(c.angle) * c.speed * dt;
    c.y += Math.sin(c.angle) * c.speed * dt;
  }
}

// ---------- police ----------
function updatePolice(dt) {
  const p = G.player;
  const px = p.inCar ? p.inCar.x : p.x, py = p.inCar ? p.inCar.y : p.y;
  let near = false;
  for (const c of G.cars) {
    if (c.police && !c.dead && dist(c.x, c.y, px, py) < 600) near = true;
  }
  for (const o of G.officers) {
    if (!o.dead && dist(o.x, o.y, p.x, p.y) < 400) near = true;
  }
  if (p.wanted > 0) {
    if (near) G.wantedTimer = 0;
    else {
      G.wantedTimer += dt;
      if (G.wantedTimer >= CFG.wantedDecaySecs) {
        p.wanted -= 1; G.wantedTimer = 0;
      }
    }
    G.sirenTimer -= dt;
    if (G.sirenTimer <= 0) { G.audio.siren(); G.sirenTimer = 1.6; }
  }
  // officers chase on foot; hold them close to bust the player
  for (const o of G.officers) {
    if (o.dead) continue;
    const d = dist(o.x, o.y, p.x, p.y);
    if (!p.inCar && d < 45) {
      p.bustedTimer += dt;
      if (p.bustedTimer >= CFG.bustedHoldSecs) { bustPlayer(G); return; }
    } else {
      p.bustedTimer = Math.max(0, p.bustedTimer - dt * 2);
    }
    if (d > 12) {
      const a = Math.atan2(p.y - o.y, p.x - o.x);
      o.angle = a;
      o.x += Math.cos(a) * o.speed * dt;
      o.y += Math.sin(a) * o.speed * dt;
      const c = collideBuildings(G.city, o.x, o.y, 10);
      o.x = c.x; o.y = c.y;
    }
  }
  // a police car ramming the player on foot hurts — at most once a second,
  // so one car sitting on the player cannot melt them in a single frame
  if (!p.inCar) {
    for (const c of G.cars) {
      if (c.police && !c.dead && dist(c.x, c.y, p.x, p.y) < 42 && Math.abs(c.speed) > 100) {
        if (G.now - (G.lastRamAt || -99) > 1.0) {
          G.lastRamAt = G.now;
          hurtPlayer(G, 15);
          p.x += (p.x - c.x) * 0.6; p.y += (p.y - c.y) * 0.6;
        }
      }
    }
  }
  // wanted 0: police drive off (despawn when far)
  if (p.wanted === 0) {
    G.cars = G.cars.filter((c) => !c.police || dist(c.x, c.y, px, py) < 900);
    G.officers = [];
  }
}

// ---------- breakers ----------
function updateBreakers(dt) {
  const p = G.player;
  for (const b of G.breakers) {
    if (b.dead) continue;
    // small strafe around the spawn point — never far enough to leave view
    b.x = b.ox + Math.sin(G.now * 0.7 + b.ox) * 30;
    b.y = b.oy + Math.cos(G.now * 0.5 + b.oy) * 30;
    b.shootCd -= dt;
    const d = dist(b.x, b.y, p.x, p.y);
    if (b.shootCd <= 0 && d < 400) {
      b.shootCd = 2.0;
      G.tracers.push({ x1: b.x, y1: b.y, x2: p.x, y2: p.y, t: 0.1 });
      hurtPlayer(G, 3);
    }
  }
}

// ---------- shops by the roadside ----------
function updateShops(dt) {
  const p = G.player;
  const L = G.city.landmarks;
  G.prompt = '';
  if (!p.inCar) {
    if (dist(p.x, p.y, L.vera.x, L.vera.y) < 90) {
      const n = nextMission(G);
      G.prompt = n <= 5 ? `Press E — start ${['', 'M1 The Getaway', 'M2 Hot Delivery', 'M3 Dockside Takedown', 'M4 Harbor Chase', 'M5 Night Heist'][n]}` : 'All story jobs done. Vera is proud of you.';
    } else if (dist(p.x, p.y, L.diner.x, L.diner.y) < 80) G.prompt = 'Press E — Diner: heal $50';
    else if (dist(p.x, p.y, L.gunbarn.x, L.gunbarn.y) < 80) G.prompt = 'Press E — Gun Barn: +30 ammo $150';
    else if (dist(p.x, p.y, L.depot.x, L.depot.y) < 90) G.prompt = 'Press E — Courier depot: start a run';
    else if (dist(p.x, p.y, L.taxiA.x, L.taxiA.y) < 80 || dist(p.x, p.y, L.taxiB.x, L.taxiB.y) < 80) G.prompt = 'Press E — Taxi stand: take a fare';
    else {
      const car = nearestCar(70);
      if (car) G.prompt = `Press E — steal the ${CFG.carModels[car.model].name}`;
    }
  } else if (dist(p.inCar.x, p.inCar.y, L.pitstop.x, L.pitstop.y) < 90) {
    G.prompt = 'Press E — Pit Stop: repair $120';
  } else {
    G.prompt = 'Press E — get out of the car';
  }
  void dt;
}

// ---------- main loop ----------
let last = performance.now();
let trafficTimer = 0, pedTimer = 0;

function update(dt) {
  G.now += dt;
  // clock
  const mins = dt / CFG.hourSecs * 60;
  G.time.minutes += mins;
  if (G.time.minutes >= 60) {
    G.time.minutes -= 60;
    G.time.hours += 1;
    if (G.time.hours >= 24) { G.time.hours -= 24; G.time.day += 1; }
  }
  updatePlayer(dt);
  for (const car of G.cars) updateTrafficCar(G, car, dt);
  updateMissionVehicles(dt);
  updateCarCollisions(dt);
  for (const ped of G.peds) updatePed(G, ped, dt);
  updateBreakers(dt);
  updatePolice(dt);
  updateMissions(G, dt);
  updateTaxi(G, dt);
  updateCourier(G, dt);
  updateShops(dt);
  // traffic density: keep ~10 cruisers near the player
  trafficTimer += dt;
  if (trafficTimer > 1) {
    trafficTimer = 0;
    const px = G.player.x, py = G.player.y;
    G.cars = G.cars.filter((c) => !c.traffic || c.police || c.driver === 'player' || dist(c.x, c.y, px, py) < 1500);
    const cruisers = G.cars.filter((c) => c.traffic && !c.police).length;
    for (let i = cruisers; i < 10; i++) G.cars.push(spawnTrafficCar(rng, G.city));
  }
  // dead peds are replaced far from the player so the city stays alive
  pedTimer += dt;
  if (pedTimer > 20) {
    pedTimer = 0;
    G.peds = G.peds.filter((p) => !p.dead || G.rng() < 0.5);
    while (G.peds.length < 40) {
      G.peds.push(makePed(rng, G.city, rand(rng, 200, 3000), rand(rng, 200, 3000)));
    }
  }
  for (const tr of G.tracers) tr.t -= dt;
  G.tracers = G.tracers.filter((tr) => tr.t > 0);
  // camera follows the player (or their car)
  const px = G.player.inCar ? G.player.inCar.x : G.player.x;
  const py = G.player.inCar ? G.player.inCar.y : G.player.y;
  G.camera.x = clamp(px, W / 2, CFG.world - W / 2);
  G.camera.y = clamp(py, H / 2, CFG.world - H / 2);
  // autosave
  G.saveTimer += dt;
  if (G.saveSoon || G.saveTimer > 15) {
    G.saveSoon = false; G.saveTimer = 0;
    saveGame(G);
  }
  G.input.endFrame();
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  drawWorld(G, ctx, W, H);
  if (G.screen === 'title') drawTitle(G, ctx, W, H);
  else {
    drawHUD(G, ctx, W, H);
    drawMinimap(G, ctx, W, H);
    if (G.screen === 'paused') drawPause(G, ctx, W, H);
    if (G.screen === 'wasted') drawWasted(G, ctx, W, H);
    if (G.screen === 'busted') drawBusted(G, ctx, W, H);
  }
}

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const inp = G.input;
  if (G.screen === 'title') {
    if (inp.mouse.clicked || inp.wasPressed('enter') || inp.wasPressed(' ')) {
      G.audio.init();
      G.screen = 'playing';
    } else if (inp.wasPressed('c') && loadGame()) {
      G.audio.init();
      continueSave();
    }
    G.input.endFrame();
  } else if (G.screen === 'playing') {
    if (inp.wasPressed('p') || inp.wasPressed('escape')) G.screen = 'paused';
    else if (inp.wasPressed('m')) G.audio.toggleMute();
    else update(dt);
    // consume the frame's presses here too: without this, a 'p' that
    // paused the game would still be "pressed" next frame and unpause it
    G.input.endFrame();
  } else if (G.screen === 'paused') {
    if (inp.wasPressed('p') || inp.wasPressed('escape')) G.screen = 'playing';
    G.input.endFrame();
  } else if (G.screen === 'wasted' || G.screen === 'busted') {
    if (inp.wasPressed('enter') || inp.mouse.clicked) respawn();
    G.input.endFrame();
  }
  draw();
  requestAnimationFrame(frame);
}

function respawn() {
  const p = G.player;
  const L = G.city.landmarks;
  p.hp = CFG.maxHp;
  p.inCar = null;
  p.wanted = 0;
  p.bustedTimer = 0;
  if (G.screen === 'wasted') { p.x = L.hospital.x; p.y = L.hospital.y; }
  else { p.x = L.police.x; p.y = L.police.y; }
  G.screen = 'playing';
  G.objective = 'Back on the streets. See Vera for work.';
}

function continueSave() {
  const s = loadGame();
  if (!s) return;
  G.money = s.money;
  G.missionsDone = s.missionsDone || [];
  G.time.hours = s.hours; G.time.minutes = s.minutes; G.time.day = s.day;
  G.player.x = s.x; G.player.y = s.y;
  G.player.hp = s.hp; G.player.ammo = s.ammo;
  G.player.wanted = s.wanted || 0;
  G.screen = 'playing';
  G.objective = 'Save loaded. See Vera for work.';
}

// ---------- debug API for the play-test probe ----------
window.__solmar = {
  G,
  state() {
    const p = G.player;
    return {
      screen: G.screen, money: G.money, hp: p.hp, ammo: p.ammo,
      wanted: p.wanted, x: p.x, y: p.y, inCar: !!p.inCar,
      carHp: p.inCar ? p.inCar.hp : null,
      carModel: p.inCar ? CFG.carModels[p.inCar.model].name : null,
      mission: { id: G.mission.id, stage: G.mission.stage, active: G.mission.active, timer: Math.ceil(G.mission.timer) },
      missionsDone: [...G.missionsDone],
      taxi: { active: G.taxi.active, stage: G.taxi.stage, fare: G.taxi.fare },
      courier: { active: G.courier.active, done: G.courier.drops.filter((d) => d.done).length, timer: Math.ceil(G.courier.timer) },
      hours: G.time.hours, objective: G.objective,
      breakersAlive: G.breakers.filter((b) => !b.dead).length,
      cars: G.cars.length, peds: G.peds.filter((x) => !x.dead).length,
    };
  },
  debug: {
    teleport(x, y) {
      const p = G.player;
      if (p.inCar) { p.inCar.x = x; p.inCar.y = y; p.inCar.speed = 0; }
      p.x = x; p.y = y;
      G.debug.auto = null;
    },
    driveTo(x, y) {
      const p = G.player;
      const sx = p.inCar ? p.inCar.x : p.x, sy = p.inCar ? p.inCar.y : p.y;
      G.debug.auto = { pts: routeWaypoints(sx, sy, x, y), i: 0 };
    },
    // direct pursuit: steer straight at a MOVING target (a chase). The
    // routed driveTo detours via intersections and can never catch one.
    driveToDirect(x, y) {
      G.debug.auto = { pts: [{ x, y }], i: 0 };
    },
    autoDone() { return !G.debug.auto; },
    aimAt(x, y) { G.debug.aim = { x, y }; },
    fire(x, y) { return shoot(G, x, y); },
    startMission(n) { return startMission(G, n); },
    startTaxi() { return startTaxi(G); },
    startCourier() { return startCourier(G); },
    giveAmmo(n) { G.player.ammo += n; },
    setMoney(n) { G.money = n; },
    setTime(h) { G.time.hours = h; G.time.minutes = 0; },
    setHp(n) { G.player.hp = n; },
    setWanted(n) { G.player.wanted = n; },
    hurt(n) { hurtPlayer(G, n); },
    damageCar(n) { if (G.player.inCar) G.player.inCar.hp = Math.max(1, G.player.inCar.hp - n); },
    enterNearestCar() { const c = nearestCar(120); if (c) enterCar(c); return !!c; },
    getOut() { exitCar(); },
    interact() { interact(); },
    save() { saveGame(G); },
    breakers() { return G.breakers.map((b) => ({ x: b.x, y: b.y, hp: b.hp, dead: b.dead })); },
    missionTarget() {
      const m = G.mission;
      if (!m.active) return null;
      if (m.id === 1) return m.stage === 0 ? m.data.pickup : m.data.home;
      if (m.id === 2) return m.data.drops.find((d) => !d.done) || null;
      if (m.id === 4) {
        if (m.stage === 0) return { x: m.data.courier.x, y: m.data.courier.y };
        if (m.stage === 1) return m.data.ledger;
        return m.data.home;
      }
      if (m.id === 5) {
        if (m.stage === 0) return { x: m.data.van.x, y: m.data.van.y };
        if (m.stage === 1) return m.data.bags.find((b) => !b.got) || null;
        return m.data.stash;
      }
      return null;
    },
    taxiTarget() {
      if (!G.taxi.active) return null;
      return G.taxi.stage === 0 ? G.taxi.pickup : G.taxi.dest;
    },
    courierTarget() {
      if (!G.courier.active) return null;
      return G.courier.drops.find((d) => !d.done) || null;
    },
  },
};

requestAnimationFrame(frame);
