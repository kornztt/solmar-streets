// SOLMAR STREETS — game loop, input, combat, car stealing, shops, save/load,
// screenshot staging and the debug hooks the verification probe uses.

import { WORLD, DAY_LENGTH_SEC, START_MONEY, SAVE_KEY, clamp, dist, angleTo, angleDiff } from './config.js';
import { mulberry32, pick, range } from './random.js';
import { buildWorld, collide, randomRoadPoint } from './world.js';
import { makePed, makeCar, spawnTraffic, spawnPeds, updatePeds, updateTraffic, updatePolice, explodeCar, hurtPlayer, addWanted, scarePeds } from './entities.js';
import { startMission, updateMission, startTaxi, updateTaxi, startCourier, updateCourier } from './missions.js';
import { createAudio, musicTick } from './audio.js';
import { draw } from './render.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

const params = new URLSearchParams(location.search);
const seed = parseInt(params.get('seed') || '7', 10);
const shot = params.get('shot') || '';

const G = {
  canvas, ctx, seed,
  world: buildWorld(seed),
  clock: 10.0,
  elapsed: 0,
  screen: 'title',
  player: {
    x: 1400, y: 1400, angle: -Math.PI / 2, health: 100, money: START_MONEY,
    wanted: 0, ammo: 0, hasPistol: false, inCar: null, invuln: 0,
  },
  cars: [], peds: [],
  mission: null, taxi: null, courier: null,
  completed: new Set(),
  marker: null,
  message: '', messageAt: -10,
  keys: {}, mouse: { x: 0, y: 0, down: false },
  camera: { x: 1400, y: 1400 },
  shopOpen: null,
  audio: createAudio(),
  saveExists: false,
  musicTick: 0,
  musicAt: 0,
  ramCooldown: 0,
  shot,
};
G.hurtPlayer = (amt) => hurtPlayer(G, amt);
G.saveGame = () => saveGame();

function msg(text) {
  G.message = text;
  G.messageAt = G.elapsed;
}

// --- save / load --------------------------------------------------------------

function saveGame() {
  try {
    const P = G.player;
    const data = {
      money: P.money, health: P.health, ammo: P.ammo, hasPistol: P.hasPistol,
      x: P.x, y: P.y, clock: G.clock, completed: [...G.completed],
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    G.saveExists = true;
    msg('Game saved.');
  } catch (e) { msg('Save failed (storage unavailable).'); }
}

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) { return null; }
}

function applySave(d) {
  const P = G.player;
  P.money = d.money; P.health = d.health; P.ammo = d.ammo; P.hasPistol = d.hasPistol;
  P.x = d.x; P.y = d.y; P.inCar = null;
  G.clock = d.clock;
  G.completed = new Set(d.completed || []);
  G.camera.x = P.x; G.camera.y = P.y;
}

G.saveExists = !!loadSave();

// --- world setup --------------------------------------------------------------

spawnTraffic(G, 26);
spawnPeds(G, 60);
// A few parked cars near the start for stealing.
{
  const rng = mulberry32(seed + 505);
  for (let i = 0; i < 8; i++) {
    const p = randomRoadPoint(rng, G.world);
    const model = pick(rng, ['sedan', 'coupe', 'van', 'sport']);
    G.cars.push(makeCar(model, pick(rng, ['#c0392b', '#2980b9', '#f1c40f', '#ecf0f1', '#27ae60', '#8e44ad']), p.x, p.y, rng() < 0.5 ? 0 : Math.PI / 2, { traffic: false }));
  }
}

// --- input --------------------------------------------------------------------

window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
  G.keys[k] = true;
  G.audio.init();
  G.audio.resume();
  handleKeyPress(k);
});

window.addEventListener('keyup', (e) => { G.keys[e.key.toLowerCase()] = false; });

window.addEventListener('mousemove', (e) => { G.mouse.x = e.clientX; G.mouse.y = e.clientY; });
window.addEventListener('mousedown', (e) => {
  G.mouse.x = e.clientX; G.mouse.y = e.clientY;
  if (e.button === 0) shoot();
});
window.addEventListener('blur', () => { G.keys = {}; });

function handleKeyPress(k) {
  if (G.screen === 'title') {
    if (k === 'enter') { startNewGame(); return; }
    if (k === 'c' && G.saveExists) {
      const d = loadSave();
      if (d) { applySave(d); G.screen = 'play'; msg('Welcome back to Solmar.'); }
    }
    return;
  }
  if (G.screen === 'wasted') {
    if (k === 'enter') respawn();
    return;
  }
  if (G.screen === 'pause') {
    if (k === 'p' || k === 'escape') { G.screen = 'play'; return; }
    if (k === 's') { saveGame(); return; }
    if (k === 'q') { G.screen = 'title'; return; }
    return;
  }
  // play screen
  if (G.shopOpen) {
    if (k === 'e' || k === 'escape') { G.shopOpen = null; return; }
    if (k === '1' || k === '2' || k === '3') { buyItem(parseInt(k, 10) - 1); return; }
    return;
  }
  if (k === 'p' || k === 'escape') { G.screen = 'pause'; return; }
  if (k === 'm') { G.audio.muted = !G.audio.muted; msg(G.audio.muted ? 'Sound muted.' : 'Sound on.'); return; }
  if (k === 'e') { interact(); return; }
  if (k === ' ') { punch(); return; }
  if (k >= '1' && k <= '5') {
    const id = `m${k}`;
    if (G.completed.has(id)) { msg(`Mission ${id.toUpperCase()} already complete.`); return; }
    startMission(G, id);
    return;
  }
  if (k === 't') { if (!G.taxi) startTaxi(G); else msg('Taxi job already running.'); return; }
  if (k === 'c') { if (!G.courier) startCourier(G); else msg('Courier job already running.'); return; }
}

function startNewGame() {
  const P = G.player;
  P.money = START_MONEY; P.health = 100; P.ammo = 0; P.hasPistol = false;
  P.wanted = 0; P.inCar = null; P.x = 1400; P.y = 1400; P.angle = -Math.PI / 2;
  G.completed = new Set();
  G.mission = null; G.taxi = null; G.courier = null; G.marker = null;
  G.clock = 10.0;
  G.screen = 'play';
  msg('Welcome to Solmar. Press 1–5 for a mission, T for taxi, C for courier.');
}

function respawn() {
  const P = G.player;
  P.money = Math.max(0, P.money - 100);
  P.health = 100;
  P.wanted = 0;
  P.inCar = null;
  P.x = 1400; P.y = 1400; P.angle = -Math.PI / 2;
  G.camera.x = P.x; G.camera.y = P.y;
  G.screen = 'play';
  msg('You woke up at the hospital. -$100.');
}

// --- interaction --------------------------------------------------------------

function nearestCar(maxD) {
  let best = null, bestD = maxD;
  for (const car of G.cars) {
    if (car.hp <= 0) continue;
    const d = dist(G.player.x, G.player.y, car.x, car.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

function interact() {
  const P = G.player;
  if (P.inCar) {
    // Exit the car.
    const car = P.inCar;
    car.speed = 0;
    P.x = car.x + Math.cos(car.angle + Math.PI / 2) * 40;
    P.y = car.y + Math.sin(car.angle + Math.PI / 2) * 40;
    P.angle = car.angle;
    P.inCar = null;
    return;
  }
  // Near a shop? Open it.
  for (const s of G.world.shops) {
    if (dist(P.x, P.y, s.x, s.y) < 100) {
      G.shopOpen = s;
      return;
    }
  }
  // Near a car? Steal / enter it.
  tryEnterCar();
}

// Enter the nearest car (used by interact() and by the debug hook directly,
// so entering a car never gets shadowed by a nearby shop).
function tryEnterCar() {
  const P = G.player;
  const car = nearestCar(78);
  if (!car) return false;
  if (car.cop) { msg('That is a police car.'); return false; }
  if (car.traffic) {
    car.traffic = false;
    addWanted(G, 1);
    msg(`Stole a ${car.name}! Wanted +1.`);
    scarePeds(G, car.x, car.y, 200);
  } else {
    msg(`Got in the ${car.name}.`);
  }
  P.inCar = car;
  P.x = car.x; P.y = car.y; P.angle = car.angle;
  if (G.audio) G.audio.engineStart();
  return true;
}

function buyItem(idx) {
  const shop = G.shopOpen;
  if (!shop) return;
  const item = shop.items[idx];
  if (!item) return;
  const P = G.player;
  if (P.money < item.price) { msg('Not enough money.'); if (G.audio) G.audio.error(); return; }
  if (item.kind === 'pistol' && P.hasPistol) { msg('You already own a pistol.'); return; }
  if ((item.kind === 'repair' || item.kind === 'armour') && !P.inCar) {
    // Repair the nearest car instead.
    const car = nearestCar(120);
    if (!car) { msg('Get in a car first (or park one here).'); return; }
    P.money -= item.price;
    if (item.kind === 'armour') { car.maxHp += item.amount; car.hp = Math.min(car.maxHp, car.hp + item.amount); }
    else car.hp = Math.min(car.maxHp, car.hp + item.amount);
    msg(`${shop.name}: ${item.name} — $${item.price}`);
    if (G.audio) G.audio.pickup();
    return;
  }
  P.money -= item.price;
  if (item.kind === 'repair') P.inCar.hp = Math.min(P.inCar.maxHp, P.inCar.hp + item.amount);
  else if (item.kind === 'armour') { P.inCar.maxHp += item.amount; P.inCar.hp = Math.min(P.inCar.maxHp, P.inCar.hp + item.amount); }
  else if (item.kind === 'pistol') { P.hasPistol = true; P.ammo += 30; }
  else if (item.kind === 'ammo') P.ammo += item.amount;
  else if (item.kind === 'heal') P.health = Math.min(100, P.health + item.amount);
  else if (item.kind === 'cool') P.wanted = Math.max(0, P.wanted - item.amount);
  msg(`${shop.name}: ${item.name} — $${item.price}`);
  if (G.audio) G.audio.pickup();
}

// --- combat -------------------------------------------------------------------

function punch() {
  if (G.screen !== 'play' || G.shopOpen || G.player.inCar) return;
  const P = G.player;
  if (G.audio) G.audio.punch();
  for (const p of G.peds) {
    if (p.dead) continue;
    const d = dist(P.x, P.y, p.x, p.y);
    if (d < 46 && Math.abs(angleDiff(angleTo(P.x, P.y, p.x, p.y), P.angle)) < 1.2) {
      p.hp -= 15;
      p.x += Math.cos(P.angle) * 14;
      p.y += Math.sin(P.angle) * 14;
      if (p.hp <= 0) killPed(p);
      return;
    }
  }
  for (const car of G.cars) {
    if (car.hp <= 0 || car === P.inCar) continue;
    if (dist(P.x, P.y, car.x, car.y) < 60) {
      car.hp -= 8;
      if (car.hp <= 0) explodeCar(G, car);
      return;
    }
  }
}

function killPed(p) {
  p.dead = true;
  p.deadAt = G.elapsed;
  if (!p.guard) addWanted(G, 1);
  scarePeds(G, p.x, p.y, 260);
}

function shoot() {
  if (G.screen !== 'play' || G.shopOpen) return;
  const P = G.player;
  if (!P.hasPistol || P.ammo <= 0) {
    if (P.hasPistol) msg('Out of ammo — visit Gun Barn.');
    return;
  }
  P.ammo -= 1;
  if (G.audio) G.audio.shot();
  // Aim from the player toward the mouse in world space.
  const wx = G.camera.x + (G.mouse.x - G.canvas.width / 2);
  const wy = G.camera.y + (G.mouse.y - G.canvas.height / 2);
  const aim = angleTo(P.x, P.y, wx, wy);
  P.angle = aim;
  let best = null, bestD = 560, bestKind = '';
  for (const p of G.peds) {
    if (p.dead) continue;
    const d = dist(P.x, P.y, p.x, p.y);
    if (d < bestD && Math.abs(angleDiff(angleTo(P.x, P.y, p.x, p.y), aim)) < 0.22) { best = p; bestD = d; bestKind = 'ped'; }
  }
  for (const car of G.cars) {
    if (car.hp <= 0 || car === P.inCar) continue;
    const d = dist(P.x, P.y, car.x, car.y);
    if (d < bestD && Math.abs(angleDiff(angleTo(P.x, P.y, car.x, car.y), aim)) < 0.18) { best = car; bestD = d; bestKind = 'car'; }
  }
  if (!best) return;
  if (bestKind === 'ped') {
    best.hp -= 34;
    if (best.hp <= 0) killPed(best);
    else { best.state = 'flee'; best.wander = 4; }
  } else {
    best.hp -= 25;
    if (best.hp <= 0) explodeCar(G, best);
    if (best.bankVan || best.targetCar) addWanted(G, 0.5);
  }
}

// --- player movement ----------------------------------------------------------

function carBlocked(car) {
  const c = Math.cos(car.angle), s = Math.sin(car.angle);
  const hl = car.len / 2, hw = car.wid / 2;
  for (const [dx, dy] of [[hl, hw], [hl, -hw], [-hl, hw], [-hl, -hw]]) {
    const px = car.x + dx * c - dy * s;
    const py = car.y + dx * s + dy * c;
    if (collide(G.world, px, py, 2)) return true;
  }
  return false;
}

function updatePlayer(dt) {
  const P = G.player;
  const k = G.keys;
  const up = k['w'] || k['arrowup'];
  const down = k['s'] || k['arrowdown'];
  const left = k['a'] || k['arrowleft'];
  const right = k['d'] || k['arrowright'];

  if (P.inCar) {
    const car = P.inCar;
    if (up) car.speed += car.accel * dt;
    if (down) car.speed -= (car.speed > 0 ? 600 : 260) * dt;
    if (!up && !down) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 220 * dt);
    car.speed = clamp(car.speed, -140, car.top);
    const steer = (left ? -1 : 0) + (right ? 1 : 0);
    if (steer !== 0 && Math.abs(car.speed) > 8) {
      car.angle += steer * car.grip * (car.speed / car.top) * dt * (car.speed < 0 ? -1 : 1);
    }
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    const oldX = car.x, oldY = car.y, oldSpeed = car.speed;
    car.x = clamp(nx, 24, WORLD.size - 24);
    car.y = clamp(ny, 24, WORLD.size - 24);
    if (carBlocked(car)) {
      car.x = oldX; car.y = oldY;
      car.speed = oldSpeed * -0.25;
      car.hp -= Math.abs(oldSpeed) * 0.02;
      if (car.hp <= 0) explodeCar(G, car);
    }
    P.x = car.x; P.y = car.y; P.angle = car.angle;
    // Running over pedestrians.
    for (const p of G.peds) {
      if (p.dead) continue;
      if (dist(car.x, car.y, p.x, p.y) < 30 && Math.abs(car.speed) > 60) {
        killPed(p);
        msg('You ran someone over! Wanted +1.');
      }
    }
    if (G.audio) G.audio.setEngine(true, Math.abs(car.speed) / car.top);
  } else {
    const mx = (right ? 1 : 0) - (left ? 1 : 0);
    const my = (down ? 1 : 0) - (up ? 1 : 0);
    if (mx !== 0 || my !== 0) {
      const a = Math.atan2(my, mx);
      P.angle = a;
      const sp = 230;
      let nx = P.x + Math.cos(a) * sp * dt;
      let ny = P.y + Math.sin(a) * sp * dt;
      nx = clamp(nx, 20, WORLD.size - 20);
      ny = clamp(ny, 20, WORLD.size - 20);
      const push = collide(G.world, nx, ny, 12);
      if (push) { nx += push.x; ny += push.y; }
      P.x = nx; P.y = ny;
    }
    if (G.audio) G.audio.setEngine(false, 0);
  }
  if (P.invuln > 0) P.invuln -= dt;
}

// --- car-vs-car collisions ----------------------------------------------------

function updateCarCollisions(dt) {
  const P = G.player;
  if (!P.inCar) return;
  const mine = P.inCar;
  for (const other of G.cars) {
    if (other === mine || other.hp <= 0) continue;
    const d = dist(mine.x, mine.y, other.x, other.y);
    const minD = (mine.len + other.len) / 2 * 0.72;
    if (d >= minD || d === 0) continue;
    const a = angleTo(other.x, other.y, mine.x, mine.y);
    const push = (minD - d) / 2;
    mine.x += Math.cos(a) * push;
    mine.y += Math.sin(a) * push;
    other.x -= Math.cos(a) * push;
    other.y -= Math.sin(a) * push;
    const impact = Math.abs(mine.speed - (other.speed || 0));
    if (impact > 60) {
      mine.hp -= impact * 0.03;
      other.hp -= impact * 0.03;
      // Mission rams: a hard hit on the target counts, once per 0.8 s.
      if ((other.targetCar || other.bankVan) && Math.abs(mine.speed) > 150 && G.ramCooldown <= 0) {
        other.rams = (other.rams || 0) + 1;
        G.ramCooldown = 0.8;
        msg(`Ram ${other.rams}/3!`);
        if (G.audio) G.audio.punch();
        if (other.bankVan && other.rams >= 3) other.hp = 0;
      }
      if (mine.hp <= 0) explodeCar(G, mine);
      if (other.hp <= 0) explodeCar(G, other);
      mine.speed *= 0.55;
    }
  }
  if (G.ramCooldown > 0) G.ramCooldown -= dt;
}

// --- screenshot staging -------------------------------------------------------

function setupShot() {
  if (!shot) return;
  G.screen = 'play';
  const P = G.player;
  if (shot === 'cover') {
    G.clock = 10.5;
    P.x = 1400; P.y = 1600; P.angle = -Math.PI / 2; P.inCar = null;
    const car = makeCar('sport', '#e74c3c', 1400, 1500, 0, { traffic: false });
    G.cars.push(car);
    spawnNear(1400, 1600, 4);
  } else if (shot === 'chase') {
    G.clock = 14.0;
    const car = makeCar('sport', '#f1c40f', 1400, 1400, 0, { traffic: false });
    G.cars.push(car);
    P.inCar = car; P.x = car.x; P.y = car.y; P.angle = 0;
    P.wanted = 3;
    const rng = mulberry32(seed + 909);
    for (let i = 0; i < 3; i++) {
      const cop = makeCar('sedan', '#1a2a4a', 1400 - 160 - i * 90, 1400 + (i - 1) * 80, 0, { hp: 120 });
      cop.cop = true;
      cop.speed = 200;
      G.cars.push(cop);
    }
    void rng;
  } else if (shot === 'shop') {
    G.clock = 11.0;
    P.x = 300; P.y = 2560; P.angle = Math.PI / 2; P.inCar = null;
    P.money = 1250;
    G.shopOpen = G.world.shops.find((s) => s.id === 'gunbarn');
  } else if (shot === 'night') {
    G.clock = 22.2;
    const car = makeCar('coupe', '#2980b9', 1800, 1000, 0, { traffic: false });
    G.cars.push(car);
    P.inCar = car; P.x = car.x; P.y = car.y; P.angle = 0;
    car.speed = 220;
    spawnNear(1800, 1000, 5);
  }
  G.camera.x = P.x; G.camera.y = P.y;
}

function spawnNear(x, y, n) {
  const rng = mulberry32(seed + 808);
  for (let i = 0; i < n; i++) {
    const px = x + range(rng, -260, 260);
    const py = y + range(rng, -200, 200);
    const type = pick(rng, ['business', 'tourist', 'jogger', 'worker', 'student']);
    const ped = makePed(type, px, py);
    G.peds.push(ped);
  }
}

// --- main loop ----------------------------------------------------------------

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (G.screen === 'play' && !G.shopOpen) {
    G.elapsed += dt;
    G.clock = (G.clock + dt * (24 / DAY_LENGTH_SEC)) % 24;
    updatePlayer(dt);
    updatePeds(G, dt);
    updateTraffic(G, dt);
    updatePolice(G, dt);
    updateCarCollisions(dt);
    updateMission(G, dt);
    updateTaxi(G, dt);
    updateCourier(G, dt);
    // Keep the streets populated.
    if (G.cars.filter((c) => c.traffic).length < 20 && Math.random() < dt * 0.5) spawnTraffic(G, 1);
    if (G.peds.filter((p) => !p.dead).length < 45 && Math.random() < dt * 0.5) spawnPeds(G, 1);
    // Music step.
    if (now - G.musicAt > 250) {
      G.musicAt = now;
      musicTick(G.audio, G.musicTick++);
    }
  } else if (G.screen === 'play' && G.shopOpen) {
    G.elapsed += dt; // keep animations alive behind the panel
  }
  // Camera follows the player.
  G.camera.x = clamp(G.player.x, canvas.width / 2, WORLD.size - canvas.width / 2);
  G.camera.y = clamp(G.player.y, canvas.height / 2, WORLD.size - canvas.height / 2);
  if (canvas.width >= WORLD.size) G.camera.x = WORLD.size / 2;
  if (canvas.height >= WORLD.size) G.camera.y = WORLD.size / 2;
  draw(G);
  requestAnimationFrame(frame);
}

setupShot();
requestAnimationFrame(frame);

// --- debug hooks (verification probe only) ------------------------------------

window.SOLMAR = {
  state: G,
  ready: true,
  startMission(id) {
    const ok = startMission(G, id);
    return { ok, active: G.mission ? G.mission.def.id : null, stage: G.mission ? G.mission.stage : null };
  },
  teleport(x, y) {
    const P = G.player;
    if (P.inCar) { P.inCar.x = x; P.inCar.y = y; P.inCar.speed = 0; }
    P.x = x; P.y = y;
    G.camera.x = x; G.camera.y = y;
    return { x: P.x, y: P.y };
  },
  exitCar() {
    if (!G.player.inCar) return { inCar: false };
    interact();
    return { inCar: !!G.player.inCar };
  },
  enterNearestCar() {
    tryEnterCar();
    return { inCar: !!G.player.inCar, car: G.player.inCar ? G.player.inCar.model : null };
  },
  spawnCarNear(model, color) {
    const P = G.player;
    const car = makeCar(model || 'sedan', color || '#c0392b', P.x + 60, P.y, 0, { traffic: false });
    G.cars.push(car);
    return { id: car.id, model: car.model, x: car.x, y: car.y };
  },
  setClock(h) { G.clock = h; return G.clock; },
  giveAmmo(n) { G.player.ammo += n; return G.player.ammo; },
  giveMoney(n) { G.player.money += n; return G.player.money; },
  heal() { G.player.health = 100; return 100; },
  openShop(id) {
    const s = G.world.shops.find((x) => x.id === id);
    if (s) G.shopOpen = s;
    return { open: !!G.shopOpen };
  },
  buyItem(idx) { buyItem(idx); return { money: G.player.money }; },
  getState() {
    const P = G.player;
    return {
      screen: G.screen, money: Math.floor(P.money), health: Math.ceil(P.health),
      wanted: P.wanted, ammo: P.ammo, hasPistol: P.hasPistol,
      inCar: !!P.inCar, carHp: P.inCar ? Math.ceil(P.inCar.hp) : null,
      x: Math.round(P.x), y: Math.round(P.y), clock: +G.clock.toFixed(2),
      mission: G.mission ? G.mission.def.id : null,
      stage: G.mission ? G.mission.stage : null,
      marker: G.marker,
      taxi: G.taxi ? G.taxi.stage : null,
      courier: G.courier ? G.courier.stage : null,
      completed: [...G.completed],
      cars: G.cars.length, peds: G.peds.filter((p) => !p.dead).length,
      shopOpen: G.shopOpen ? G.shopOpen.id : null,
    };
  },
};
