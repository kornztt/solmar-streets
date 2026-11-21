// SOLMAR STREETS — game loop, player control, shops, screens and save wiring.
import { WORLD, PLACES, PRICES, MISSION_DEFS, DAY_LENGTH_S, WANTED_DECAY_S } from './config.js';
import { buildCity, collideBuildings, nearestIntersection } from './city.js';
import { makeCar, makePed, updateTraffic, updatePeds, updatePolice, updateEnemies, updatePickups, hurtPlayer, explodeCar } from './entities.js';
import { maybeStartMission, updateMission, updateSideJobs, startCourierJob, pickUpTaxi } from './missions.js';
import { tryShoot, tryPunch, ramCheck } from './combat.js';
import { AudioSys } from './audio.js';
import { Input } from './input.js';
import { drawWorld, drawMinimap, daylight } from './render.js';
import { drawHUD } from './hud.js';
import { saveGame, loadGame, hasSave } from './save.js';
import { clamp, dist } from './random.js';

const VW = 1280;
const VH = 720;

function newState() {
  return {
    time: 0,
    clock: 8.0,
    mode: 'title',
    city: buildCity(11),
    player: {
      x: PLACES.home.x, y: PLACES.home.y, angle: 0,
      hp: 100, money: 500, ammo: 24, wanted: 0,
      onFoot: true, car: null, kills: 0,
    },
    cars: [], peds: [], police: [], enemies: [], enemyShots: [],
    pickups: [], particles: [],
    missionIndex: 0, missionStage: 0, missionData: {}, missionActive: false,
    marker: null, taxi: null, taxiRider: null, taxiTimer: 8, taxiCooldown: 0,
    courier: null, shopOpen: null,
    bannerText: '', bannerColor: '#fff', bannerT: 0, hint: '',
    camera: { x: 1300, y: 900 },
    mouse: { x: 0, y: 0, wx: 0, wy: 0, down: false, clicked: false },
    lastShotAt: -9, lastPunchAt: -9, lastRamAt: -9, shotsFiredAt: -9,
    tracer: null, muzzle: null, wantedTimer: 0,
  };
}

const G = newState();
G.audio = new AudioSys();
G.banner = (text, color) => { G.bannerText = text; G.bannerColor = color || '#fff'; G.bannerT = 3.4; };
G.save = () => saveGame(G);

function spawnWorld() {
  G.cars = [];
  G.peds = [];
  // Traffic cars on the roads.
  for (let i = 0; i < 14; i++) {
    const ix = nearestIntersection(Math.random() * 2600, Math.random() * 1800);
    const c = makeCar(Math.floor(Math.random() * 6), ix.x + (Math.random() - 0.5) * 40, ix.y + (Math.random() - 0.5) * 40, Math.random() * Math.PI * 2, 'traffic');
    G.cars.push(c);
  }
  // Parked cars along road edges.
  for (let i = 0; i < 7; i++) {
    const ix = nearestIntersection(Math.random() * 2600, Math.random() * 1800);
    const c = makeCar(Math.floor(Math.random() * 6), ix.x + 62, ix.y + 30, (Math.random() < 0.5 ? 0 : Math.PI / 2), 'parked');
    G.cars.push(c);
  }
  // The M1 getaway car, parked by the taxi stand road.
  const gw = makeCar(0, PLACES.getawayCar.x, PLACES.getawayCar.y, 0, 'parked');
  gw.color = '#c0392b';
  gw.isGetaway = true;
  G.cars.push(gw);
  // Pedestrians around the intersections.
  for (let i = 0; i < 26; i++) {
    const ix = nearestIntersection(Math.random() * 2600, Math.random() * 1800);
    G.peds.push(makePed(Math.floor(Math.random() * 8), ix.x + (Math.random() - 0.5) * 90, ix.y + (Math.random() - 0.5) * 90));
  }
}

function resetGame(fromSave) {
  const fresh = newState();
  Object.keys(fresh).forEach((k) => { G[k] = fresh[k]; });
  G.audio = new AudioSys();
  G.banner = (text, color) => { G.bannerText = text; G.bannerColor = color || '#fff'; G.bannerT = 3.4; };
  G.save = () => saveGame(G);
  spawnWorld();
  if (fromSave) {
    G.player.money = fromSave.money;
    G.player.hp = fromSave.hp;
    G.player.ammo = fromSave.ammo;
    G.player.wanted = fromSave.wanted;
    G.player.x = fromSave.x;
    G.player.y = fromSave.y;
    G.clock = fromSave.clock;
    G.missionIndex = fromSave.missionIndex;
    G.player.kills = fromSave.kills || 0;
  }
  G.mode = 'playing';
  G.banner('SOLMAR STREETS', '#f1c40f');
}

function nearestCar(x, y, maxD) {
  let best = null;
  let bestD = maxD;
  for (const c of G.cars) {
    if (c.dead) continue;
    const d = dist(x, y, c.x, c.y);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

function nearestShop(x, y) {
  const shops = [
    { id: 'pitstop', ...PLACES.pitstop },
    { id: 'gunbarn', ...PLACES.gunbarn },
    { id: 'diner', ...PLACES.diner },
  ];
  for (const s of shops) if (dist(x, y, s.x, s.y) < 80) return s;
  return null;
}

function openShop(id) {
  G.shopOpen = id;
  const panel = document.getElementById('shop-panel');
  const title = document.getElementById('shop-title');
  const desc = document.getElementById('shop-desc');
  const buy = document.getElementById('shop-buy');
  const info = {
    pitstop: ['Pit Stop — Car Repair', 'Full repair for your car.', `$${PRICES.repair}`],
    gunbarn: ['Gun Barn — Ammo', `+${PRICES.ammoAmount} pistol rounds.`, `$${PRICES.ammo}`],
    diner: ['Diner — A Meal', 'Heal back to full health.', `$${PRICES.heal}`],
  }[id];
  title.textContent = info[0];
  desc.textContent = info[1];
  buy.textContent = `Buy — ${info[2]}`;
  panel.style.display = 'block';
  G.audio.sfx('pickup');
}

function buyShop() {
  const id = G.shopOpen;
  if (!id) return;
  const price = id === 'pitstop' ? PRICES.repair : id === 'gunbarn' ? PRICES.ammo : PRICES.heal;
  if (G.player.money < price) {
    G.banner('Not enough cash', '#e74c3c');
    G.audio.sfx('fail');
    return;
  }
  if (id === 'pitstop' && (!G.player.car || G.player.car.hp >= G.player.car.maxHp)) {
    G.banner('Your car is already fixed up', '#f1c40f');
    return;
  }
  if (id === 'diner' && G.player.hp >= 100) {
    G.banner('You are already full health', '#f1c40f');
    return;
  }
  G.player.money -= price;
  if (id === 'pitstop') G.player.car.hp = G.player.car.maxHp;
  if (id === 'gunbarn') G.player.ammo += PRICES.ammoAmount;
  if (id === 'diner') G.player.hp = 100;
  G.banner('Bought!', '#2ecc71');
  G.audio.sfx('cash');
  closeShop();
  G.save();
}

function closeShop() {
  G.shopOpen = null;
  document.getElementById('shop-panel').style.display = 'none';
}

function interact() {
  const P = G.player;
  if (P.car) {
    // In a car: a nearby shop opens first (Pit Stop needs the car), then a
    // taxi rider can be picked up, otherwise get out.
    const shopInCar = nearestShop(P.x, P.y);
    if (shopInCar) { openShop(shopInCar.id); return; }
    if (pickUpTaxi(G)) return;
    const car = P.car;
    car.driver = 'parked';
    car.speed = 0;
    P.car = null;
    P.onFoot = true;
    P.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
    P.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
    P.angle = car.angle;
    return;
  }
  const shop = nearestShop(P.x, P.y);
  if (shop) { openShop(shop.id); return; }
  if (pickUpTaxi(G)) return;
  if (!G.courier && dist(P.x, P.y, PLACES.depot.x, PLACES.depot.y) < 80) {
    startCourierJob(G);
    return;
  }
  const car = nearestCar(P.x, P.y, 58);
  if (car) {
    if (car.driver === 'traffic') {
      P.wanted = Math.min(5, P.wanted + 1);
      G.banner('You stole a car — the police are coming', '#e74c3c');
      G.audio.sfx('alarm');
    }
    car.driver = 'player';
    car.speed = 0;
    P.car = car;
    P.onFoot = false;
  }
}

function updatePlayer(dt, input) {
  const P = G.player;
  const axes = input.axes();
  if (P.car) {
    const car = P.car;
    // Arcade driving: W accelerates, S brakes/reverses, A/D steer.
    const throttle = axes.y < 0 ? 1 : axes.y > 0 ? -0.55 : 0;
    const steer = axes.x;
    if (throttle > 0) car.speed = Math.min(car.top, car.speed + car.accel * dt);
    else if (throttle < 0) car.speed = Math.max(-car.top * 0.35, car.speed - car.accel * 0.7 * dt);
    else car.speed *= Math.max(0, 1 - 1.6 * dt);
    const grip = clamp(Math.abs(car.speed) / car.top, 0.25, 1);
    car.angle += steer * car.turn * grip * dt * (car.speed >= 0 ? 1 : -1);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    collideBuildings(G.city, car, 20);
    // Push away from other cars.
    for (const c of G.cars) {
      if (c === car || c.dead) continue;
      const d = dist(car.x, car.y, c.x, c.y);
      if (d < 44 && d > 0.01) {
        const push = (44 - d) / 2;
        const a = Math.atan2(car.y - c.y, car.x - c.x);
        car.x += Math.cos(a) * push;
        car.y += Math.sin(a) * push;
      }
    }
    // Running over pedestrians is a crime.
    for (const ped of [...G.peds]) {
      if (ped.state === 'rider') continue;
      if (Math.abs(car.speed) > 140 && dist(car.x, car.y, ped.x, ped.y) < 26) {
        G.peds = G.peds.filter((p) => p !== ped);
        P.wanted = Math.min(5, P.wanted + 1);
        G.audio.sfx('crash');
        car.speed *= 0.85;
      }
    }
    P.x = car.x;
    P.y = car.y;
    G.audio.setEngine(Math.abs(car.speed) / car.top);
  } else {
    const sprint = input.down('ShiftLeft') || input.down('ShiftRight');
    const sp = sprint ? 250 : 165;
    let mx = axes.x;
    let my = axes.y;
    const len = Math.hypot(mx, my);
    if (len > 0) { mx /= len; my /= len; }
    P.x += mx * sp * dt;
    P.y += my * sp * dt;
    collideBuildings(G.city, P, 11);
    P.x = clamp(P.x, 16, 2584);
    P.y = clamp(P.y, 16, 1784);
    // Face the mouse while on foot.
    P.angle = Math.atan2(G.mouse.wy - P.y, G.mouse.wx - P.x);
    G.audio.setEngine(0);
  }
  // Wanted decays when the police cannot see the player.
  const nearestCop = G.police.reduce((m, c) => Math.min(m, dist(c.x, c.y, P.x, P.y)), Infinity);
  if (P.wanted > 0 && nearestCop > 520 && G.time - G.shotsFiredAt > 5) {
    G.wantedTimer += dt;
    if (G.wantedTimer >= WANTED_DECAY_S) {
      G.wantedTimer = 0;
      P.wanted -= 1;
    }
  } else {
    G.wantedTimer = 0;
  }
}

function update(dt, input) {
  G.time += dt;
  G.clock = (G.clock + (dt / DAY_LENGTH_S) * 24) % 24;
  G.hint = '';
  if (G.bannerT > 0) G.bannerT -= dt;
  if (G.tracer) { G.tracer.t -= dt; if (G.tracer.t <= 0) G.tracer = null; }
  if (G.muzzle) { G.muzzle.t -= dt; if (G.muzzle.t <= 0) G.muzzle = null; }
  if (G.mode !== 'playing' || G.shopOpen) return;
  if (G.mode === 'playing') {
    updatePlayer(dt, input);
    updateTraffic(G, dt);
    updatePeds(G, dt);
    updatePolice(G, dt);
    updateEnemies(G, dt);
    maybeStartMission(G);
    updateMission(G, dt);
    updateSideJobs(G, dt);
    ramCheck(G, dt);
    updatePickups(G, dt);
    // Shooting: hold to fire, click to punch when out of ammo.
    if (input.mouse.clicked) {
      if (G.player.ammo > 0) tryShoot(G);
      else tryPunch(G);
    } else if (input.mouse.down && G.player.ammo > 0) {
      tryShoot(G);
    }
    if (input.pressed('KeyF')) tryPunch(G);
    if (input.pressed('KeyE')) interact();
    // Contextual hints.
    const P = G.player;
    if (!P.car) {
      if (nearestShop(P.x, P.y)) G.hint = 'Press E to open the shop';
      else if (nearestCar(P.x, P.y, 58)) G.hint = 'Press E to get in the car';
      else if (G.taxiRider && dist(P.x, P.y, G.taxiRider.x, G.taxiRider.y) < 90) G.hint = 'Press E to pick up the taxi rider';
      else if (!G.courier && dist(P.x, P.y, PLACES.depot.x, PLACES.depot.y) < 80) G.hint = 'Press E to start a courier job';
    } else {
      G.hint = 'E to get out · Click to shoot from the car';
    }
  }
}

function render(ctx) {
  const P = G.player;
  G.camera.x = clamp(P.x, VW / 2 - 100, WORLD.w - VW / 2 + 100);
  G.camera.y = clamp(P.y, VH / 2 - 100, WORLD.h - VH / 2 + 100);
  drawWorld(G, ctx, VW, VH);
  drawHUD(G, ctx, VW, VH);
  drawMinimap(G, ctx, VW - 212, 46, 200, 138);
}

// --- boot & screens ---
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const input = new Input(canvas);
spawnWorld();

function show(id, on) {
  document.getElementById(id).style.display = on ? 'flex' : 'none';
}

document.getElementById('start-btn').addEventListener('click', () => {
  G.audio.ensure();
  G.audio.startMusic();
  show('title-screen', false);
  resetGame(null);
});
document.getElementById('continue-btn').addEventListener('click', () => {
  G.audio.ensure();
  G.audio.startMusic();
  show('title-screen', false);
  resetGame(loadGame());
});
document.getElementById('resume-btn').addEventListener('click', () => {
  G.mode = 'playing';
  show('pause-screen', false);
});
document.getElementById('respawn-btn').addEventListener('click', () => {
  const P = G.player;
  P.hp = 100;
  P.money = Math.max(0, P.money - 100);
  P.wanted = 0;
  P.x = PLACES.home.x;
  P.y = PLACES.home.y;
  if (P.car) { P.car.driver = 'parked'; P.car = null; }
  P.onFoot = true;
  G.police = [];
  G.cars = G.cars.filter((c) => c.driver !== 'police');
  G.enemies = [];
  G.missionActive = false;
  G.missionStage = 0;
  G.missionData = {};
  G.marker = null;
  G.mode = 'playing';
  show('wasted-screen', false);
  G.banner('Back on your feet — $100 hospital bill', '#f1c40f');
  G.save();
});
document.getElementById('shop-buy').addEventListener('click', buyShop);
document.getElementById('shop-close').addEventListener('click', closeShop);

if (hasSave()) document.getElementById('continue-btn').style.display = 'inline-block';

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  // Mouse in world coordinates.
  G.mouse.x = input.mouse.x;
  G.mouse.y = input.mouse.y;
  G.mouse.wx = G.camera.x + (input.mouse.x - VW / 2);
  G.mouse.wy = G.camera.y + (input.mouse.y - VH / 2);
  G.mouse.down = input.mouse.down;
  G.mouse.clicked = input.mouse.clicked;
  if (G.mode === 'title') {
    // Attract mode: traffic drifts while the title shows.
    updateTraffic(G, dt);
    updatePeds(G, dt);
    G.camera.x = 1300;
    G.camera.y = 900;
    drawWorld(G, ctx, VW, VH);
  } else if (G.mode === 'playing' || G.mode === 'paused' || G.mode === 'wasted') {
    if (input.pressed('KeyP') || input.pressed('Escape')) {
      if (G.shopOpen) closeShop();
      else if (G.mode === 'playing') { G.mode = 'paused'; show('pause-screen', true); }
      else if (G.mode === 'paused') { G.mode = 'playing'; show('pause-screen', false); }
    }
    if (input.pressed('KeyM')) {
      G.audio.muted = !G.audio.muted;
      G.banner(G.audio.muted ? 'Sound off' : 'Sound on', '#fff');
    }
    update(dt, input);
    render(ctx);
    if (G.mode === 'wasted') show('wasted-screen', true);
  }
  input.endFrame();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// --- probe/debug hook (used by the verification probe; harmless in play) ---
window.__solmar = {
  G,
  state: () => ({
    mode: G.mode, money: G.player.money, hp: G.player.hp, ammo: G.player.ammo,
    wanted: G.player.wanted, x: Math.round(G.player.x), y: Math.round(G.player.y),
    onFoot: G.player.onFoot, inCar: !!G.player.car,
    carHp: G.player.car ? Math.round(G.player.car.hp) : null,
    missionIndex: G.missionIndex, missionActive: G.missionActive, missionStage: G.missionStage,
    enemies: G.enemies.length, police: G.police.length, peds: G.peds.length,
    clock: +G.clock.toFixed(2), taxi: !!G.taxi, courier: !!G.courier,
    shopOpen: G.shopOpen, marker: G.marker,
  }),
  start: () => { document.getElementById('start-btn').click(); },
  teleport: (x, y) => {
    if (G.player.car) { G.player.car.x = x; G.player.car.y = y; G.player.car.speed = 0; }
    G.player.x = x; G.player.y = y;
  },
  setClock: (h) => { G.clock = h; },
  setMoney: (n) => { G.player.money = n; },
  giveAmmo: (n) => { G.player.ammo = n; },
  setWanted: (n) => { G.player.wanted = n; },
  setHp: (n) => { G.player.hp = n; },
  damagePlayer: (n) => hurtPlayer(G, n),
  enterNearestCar: () => { const c = nearestCar(G.player.x, G.player.y, 400); if (c) { c.driver = 'player'; c.speed = 0; G.player.car = c; G.player.onFoot = false; return true; } return false; },
  spawnPolice: (n) => { for (let i = 0; i < n; i++) { const c = makeCar(0, G.player.x + 120 + i * 60, G.player.y - 60, 0, 'police'); c.color = '#1f2a44'; c.top = 400; G.police.push(c); G.cars.push(c); } },
  spawnBreakers: (n) => { for (let i = 0; i < n; i++) G.enemies.push({ id: 9000 + i, x: G.player.x + 80 + i * 40, y: G.player.y + 60, angle: 0, hp: 60, speed: 0, cooldown: 9, kind: 'breaker' }); },
  setMission: (i) => { G.missionIndex = i; G.missionActive = false; G.missionStage = 0; G.missionData = {}; },
  openShop: (id) => openShop(id),
  buyShop: () => buyShop(),
  saveNow: () => G.save(),
  hasSave: () => hasSave(),
};
