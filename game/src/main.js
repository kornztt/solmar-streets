// SOLMAR STREETS — boot, input, game loop, save/load, screenshot scenes, debug API.
// Written fresh for round 9 (rebuild7).
import { CITY, SHOPS, SAVE_KEY, CAR_MODELS } from './config.js';
import { createState, update, startMission, startCourierJob, doPunch, doShoot, tryEnterCar, buyShop, respawn, setMessage, makeCar } from './engine.js';
import { draw } from './render.js';
import { AudioSys } from './audio.js';

const VW = 1280, VH = 720;
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = VW; canvas.height = VH;

const G = createState(11);
const audio = new AudioSys();
const keys = {};
let mouse = { x: VW / 2, y: VH / 2 };

// ---- save / load ----
function saveGame() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      money: G.money, missionsDone: G.missionsDone,
      x: G.player.x, y: G.player.y, hp: G.player.hp, ammo: G.player.ammo,
      hours: G.clock.hours, minutes: G.clock.minutes, day: G.clock.day,
    }));
  } catch (e) { /* storage unavailable */ }
}
function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const s = JSON.parse(raw);
    G.money = s.money; G.missionsDone = s.missionsDone || [];
    G.player.x = s.x; G.player.y = s.y; G.player.hp = s.hp; G.player.ammo = s.ammo;
    G.player.onFoot = true; G.player.car = null;
    G.clock.hours = s.hours; G.clock.minutes = s.minutes; G.clock.day = s.day || 1;
    G.objective = G.missionsDone.length >= 5 ? 'All missions done! Free roam.' : 'Meet Vera at Home to start work.';
    return true;
  } catch (e) { return false; }
}
G.hasSave = false;
try { G.hasSave = !!localStorage.getItem(SAVE_KEY); } catch (e) { /* ignore */ }

// ---- screenshot scenes (?scene=foot|chase|shop|night) ----
const params = new URLSearchParams(location.search);
const scene = params.get('scene');
function stageScene() {
  const L = G.city.landmarks;
  if (scene === 'foot') {
    G.clock.hours = 10; G.clock.minutes = 9;
    G.player.onFoot = true; G.player.car = null;
    G.player.x = L.pitstop.x - 120; G.player.y = L.pitstop.y - 30;
    G.player.angle = 0;
    // crowd the sidewalk: pedestrians + parked cars around the player
    for (let i = 0; i < 8; i++) {
      const p = G.peds[i % G.peds.length];
      p.x = G.player.x + (i - 4) * 46;
      p.y = G.player.y + (i % 2 === 0 ? 46 : -58);
      p.dead = false;
    }
    G.objective = 'M1 The Getaway: reach the Harbor in 90s.';
    G.screen = 'playing';
  } else if (scene === 'chase') {
    G.clock.hours = 14; G.clock.minutes = 30;
    const car = makeCar(G, L.plaza.x, L.plaza.y, CAR_MODELS[1], 'player');
    G.cars.push(car);
    G.player.car = car; G.player.onFoot = false;
    G.player.x = car.x; G.player.y = car.y; G.player.angle = 0;
    car.speed = 200;
    G.heat = 55; G.wanted = 3;
    for (let i = 0; i < 2; i++) {
      const pc = makeCar(G, car.x - 120 - i * 70, car.y + (i === 0 ? -50 : 60), CAR_MODELS[1], 'police');
      pc.color = '#1f3a93'; pc.hp = 90; pc.maxHp = 90; pc.speed = 220;
      G.police.push(pc); G.cars.push(pc);
    }
    G.objective = 'Lose the cops! Wanted level 3.';
    G.screen = 'playing';
  } else if (scene === 'shop') {
    G.clock.hours = 11; G.clock.minutes = 20;
    G.player.onFoot = true; G.player.car = null;
    G.player.x = L.gunbarn.x - 46; G.player.y = L.gunbarn.y + 10;
    G.player.angle = 0;
    G.money = 750;
    G.shopOpen = SHOPS.find(s => s.id === 'gunbarn');
    G.objective = 'Gun Barn: stock up before the next job.';
    G.screen = 'playing';
  } else if (scene === 'night') {
    G.clock.hours = 22; G.clock.minutes = 30;
    const car = makeCar(G, L.bank.x + 40, L.bank.y + 120, CAR_MODELS[1], 'player');
    G.cars.push(car);
    G.player.car = car; G.player.onFoot = false;
    G.player.x = car.x; G.player.y = car.y; G.player.angle = -Math.PI / 2;
    car.speed = 180;
    G.heat = 40; G.wanted = 3;
    G.objective = 'M5 Night Heist: stop the bank van, grab 3 cash bags.';
    G.screen = 'playing';
  }
}

// ---- input ----
const KEYMAP = {
  ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
};
window.addEventListener('keydown', (e) => {
  audio.init();
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  const dir = KEYMAP[e.code];
  if (dir) keys[dir] = true;
  if (e.repeat) return;
  if (e.code === 'Space' && G.screen === 'playing' && !G.shopOpen) {
    if (doPunch(G)) audio.sfx('punch');
  }
  if (e.code === 'KeyE') onInteract();
  if (e.code === 'KeyP' || e.code === 'Escape') {
    if (G.shopOpen) { G.shopOpen = null; return; }
    if (G.screen === 'playing') { G.screen = 'paused'; saveGame(); }
    else if (G.screen === 'paused') G.screen = 'playing';
  }
  if (e.code === 'KeyM') { audio.muted = !audio.muted; }
  if (e.code === 'Enter') {
    if (G.screen === 'wasted') { respawn(G); audio.sfx('mission'); }
    else if (G.screen === 'title') startPlaying(false);
  }
  if (e.code === 'KeyC' && G.screen === 'title' && G.hasSave) startPlaying(true);
  if (e.code === 'Digit1' && G.shopOpen) {
    const r = buyShop(G, G.shopOpen.id);
    G.shopResult = r;
    if (r && !r.startsWith('Not enough') && !r.startsWith('Already') && !r.startsWith('Car already')) {
      audio.sfx('money'); saveGame();
    }
  }
});
window.addEventListener('keyup', (e) => {
  const dir = KEYMAP[e.code];
  if (dir) keys[dir] = false;
});
canvas.addEventListener('mousemove', (e) => {
  const r = canvas.getBoundingClientRect();
  mouse.x = (e.clientX - r.left) * (VW / r.width);
  mouse.y = (e.clientY - r.top) * (VH / r.height);
});
canvas.addEventListener('mousedown', (e) => {
  audio.init();
  if (G.screen === 'title') { startPlaying(false); return; }
  if (G.screen !== 'playing' || G.shopOpen || !G.player.onFoot) return;
  const camX = Math.max(VW / 2, Math.min(CITY - VW / 2, G.player.x));
  const camY = Math.max(VH / 2, Math.min(CITY - VH / 2, G.player.y));
  const wx = mouse.x + camX - VW / 2;
  const wy = mouse.y + camY - VH / 2;
  const hit = doShoot(G, wx, wy);
  if (hit) audio.sfx(hit === 'ped' ? 'hit' : 'shoot');
  else if (G.player.ammo > 0) audio.sfx('shoot');
});

function startPlaying(continued) {
  audio.init();
  if (continued && loadGame()) { setMessage(G, 'Save loaded. Welcome back.', 3); }
  G.screen = 'playing';
  audio.music(true);
}

function onInteract() {
  if (G.screen !== 'playing') return;
  if (G.shopOpen) { G.shopOpen = null; return; }
  if (G.shopNear) {
    G.shopOpen = G.shopNear;
    G.shopResult = '';
    return;
  }
  // Vera / Home starts the next story mission
  const L = G.city.landmarks;
  if (!G.mission && G.player.onFoot) {
    const d = Math.hypot(G.player.x - L.home.x, G.player.y - L.home.y);
    if (d < 110) {
      const next = [1, 2, 3, 4, 5].find(id => !G.missionsDone.includes(id));
      if (next) {
        const m = startMission(G, next);
        if (m) { audio.sfx('mission'); saveGame(); }
        return;
      }
    }
  }
  const r = tryEnterCar(G);
  if (r === 'in') audio.sfx('car');
}

// ---- main loop ----
let last = performance.now();
let frames = 0;
function tick(now) {
  requestAnimationFrame(tick);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (G.screen === 'playing') {
    // nearest shop prompt (works on foot and in the car)
    G.shopNear = null;
    {
      const L = G.city.landmarks;
      const spots = [
        { def: SHOPS[0], x: L.pitstop.x, y: L.pitstop.y },
        { def: SHOPS[1], x: L.gunbarn.x, y: L.gunbarn.y },
        { def: SHOPS[2], x: L.diner.x, y: L.diner.y },
      ];
      for (const s of spots) {
        if (Math.hypot(G.player.x - s.x, G.player.y - s.y) < 90) { G.shopNear = s.def; break; }
      }
    }
    const before = G.missionsDone.length;
    update(G, dt, keys);
    if (G.missionsDone.length > before) { audio.sfx('mission'); saveGame(); }
    if (!G.player.onFoot && G.player.car) audio.engine(Math.abs(G.player.car.speed) / 320);
    else audio.engine(0);
  }
  draw(G, ctx);
  frames++;
  if (frames === 5) window.__solmarReady = true;
}

stageScene();
requestAnimationFrame(tick);

// ---- debug API for the verification probe ----
window.__solmar = {
  G,
  startMission: (id) => startMission(G, id),
  startCourier: () => startCourierJob(G),
  respawn: () => respawn(G),
  buyShop: (kind) => buyShop(G, kind),
  doPunch: () => doPunch(G),
  tryEnterCar: () => tryEnterCar(G),
  saveGame, loadGame,
  teleport: (x, y) => {
    if (G.player.car) { G.player.car.x = x; G.player.car.y = y; }
    G.player.x = x; G.player.y = y;
  },
  setClock: (h, m = 0) => { G.clock.hours = h; G.clock.minutes = m; },
  giveCar: () => {
    const car = makeCar(G, G.player.x + 40, G.player.y, CAR_MODELS[1], 'player');
    G.cars.push(car);
    G.player.car = car; G.player.onFoot = false;
    return car;
  },
  setWanted: (n) => { G.heat = [0, 10, 30, 50, 70, 90][n] || 0; G.wanted = n; },
  startPlaying,
};
