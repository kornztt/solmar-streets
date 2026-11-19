// SOLMAR STREETS — boot, game loop, wiring. ES modules, no network, no assets.
import { CFG } from './config.js';
import { RNG, clamp, dist } from './random.js';
import { createGame } from './state.js';
import { buildCity, landmarkPos } from './city.js';
import { spawnPlayer, spawnParkedCars, spawnTraffic, spawnPeds, updatePlayer, updateTraffic, updatePeds, nearestCar, enterCar, exitCar } from './entities.js';
import { talkToVera, updateMissions, tryHailTaxi, updateTaxi, toast } from './missions.js';
import { tryPunch, tryShoot, updateBullets, updateBreakers, updateCourier, updateWanted, updateCops, addHeat } from './combat.js';
import { initAudio, sfx, musicTick } from './audio.js';
import { draw } from './render.js';
import { drawHud, drawScreen } from './hud.js';
import { bindInput } from './input.js';
import { saveGame, loadSave, applySave, hasSave } from './save.js';
import { applyShot } from './shots.js';

const params = new URLSearchParams(location.search);
const seed = parseInt(params.get('seed') || '11', 10) || 11;
const shotName = params.get('shot');

const G = createGame(seed);
const city = buildCity(seed);
const rng = new RNG(seed);

spawnPlayer(G, city);
spawnParkedCars(G, rng);
spawnTraffic(G, rng, 14);
spawnPeds(G, rng, 42);
if (shotName) applyShot(G, city, shotName);

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = CFG.viewW;
canvas.height = CFG.viewH;
bindInput(G, canvas);

window.__solmarSave = () => saveGame(G);

function startGame() {
  initAudio();
  sfx('click');
  G.screen = 'playing';
}

function continueGame() {
  const data = loadSave();
  if (data) {
    applySave(G, data);
    G.player.onFoot = true;
    G.player.car = null;
    toast(G, 'Save loaded — welcome back to Solmar.');
  }
  startGame();
}

function respawn() {
  G.hp = 100;
  G.wanted = 0;
  G.heat = 0;
  G.cops.length = 0;
  G.money = Math.max(0, G.money - 100);
  const h = landmarkPos('hideout');
  G.player.x = h.x + 40;
  G.player.y = h.y + 30;
  G.player.onFoot = true;
  G.player.car = null;
  G.screen = 'playing';
  G.over = null;
  toast(G, 'Back on your feet. Vera is waiting.');
}

function interact() {
  const p = G.player;
  if (p.onFoot) {
    const h = landmarkPos('hideout');
    if (dist(p.x, p.y, h.x, h.y) < 90 && G.mission.id === null) {
      if (talkToVera(G)) { sfx('pickup'); return; }
    }
    const car = nearestCar(G, p.x, p.y, 70);
    if (car) {
      enterCar(G, car);
      addHeat(G, 25);
      sfx('click');
      toast(G, 'Car stolen — the heat is on.');
      return;
    }
  } else {
    exitCar(G);
    sfx('click');
  }
}

function repair() {
  const p = G.player;
  if (!p.car) return;
  const ps = landmarkPos('pitstop');
  if (dist(p.x, p.y, ps.x, ps.y) > 95) return;
  if (p.car.hp >= p.car.maxHp) {
    toast(G, 'Pit Stop: already mint — no charge.');
    return;
  }
  if (G.money < CFG.repairCost) {
    toast(G, 'Pit Stop: you cannot afford the $120 repair.');
    return;
  }
  G.money -= CFG.repairCost;
  p.car.hp = p.car.maxHp;
  sfx('repair');
  toast(G, 'Pit Stop: repaired to full.');
}

function buyAmmo() {
  const p = G.player;
  if (!p.onFoot) return;
  const gb = landmarkPos('gunbarn');
  if (dist(p.x, p.y, gb.x, gb.y) > 80) return;
  if (G.money < CFG.ammoCost) {
    toast(G, 'Gun Barn: you cannot afford $150 of ammo.');
    return;
  }
  G.money -= CFG.ammoCost;
  G.reserve += CFG.ammoPack;
  sfx('pickup');
  toast(G, `Gun Barn: +${CFG.ammoPack} ammo in reserve.`);
}

function reload() {
  const p = G.player;
  if (!p.onFoot || G.ammo >= CFG.pistolMag || G.reserve <= 0) return;
  const need = CFG.pistolMag - G.ammo;
  const take = Math.min(need, G.reserve);
  G.ammo += take;
  G.reserve -= take;
  sfx('click');
}

window.__solmarKey = (code, isDown) => {
  if (!isDown) return;
  if (G.screen === 'title') {
    if (code === 'KeyC' && hasSave()) continueGame();
    else if (code === 'Enter' || code === 'Space') startGame();
    return;
  }
  if (G.screen === 'wasted' || G.screen === 'busted') {
    if (code === 'Enter') respawn();
    return;
  }
  if (code === 'KeyP' || code === 'Escape') {
    G.screen = G.screen === 'paused' ? 'playing' : 'paused';
    sfx('click');
    return;
  }
  if (G.screen !== 'playing') return;
  if (code === 'KeyE') interact();
  else if (code === 'KeyF') repair();
  else if (code === 'KeyB') buyAmmo();
  else if (code === 'KeyT') { if (tryHailTaxi(G)) sfx('pickup'); }
  else if (code === 'KeyR') reload();
  else if (code === 'KeyM') { /* mute handled by audio master in a later pass */ }
};

window.__solmarClick = (x, y) => {
  if (G.screen === 'title') { startGame(); return; }
  if (G.screen === 'paused') { G.screen = 'playing'; return; }
  if (G.screen !== 'playing') return;
  const wx = G.camera.x + x;
  const wy = G.camera.y + y;
  if (G.player.onFoot) {
    if (tryShoot(G, wx, wy)) sfx('shoot');
  }
};

// Space doubles as punch on foot: polled in the loop (held key).
let last = performance.now();

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (G.screen === 'playing') {
    G.time += dt;
    G.clock += dt * 0.5; // 1 game-minute per 2 real seconds
    // Mouse world position.
    G.mouse.wx = G.camera.x + G.mouse.x;
    G.mouse.wy = G.camera.y + G.mouse.y;
    // Held space = punch on foot.
    if (G.keys['Space'] && G.player.onFoot) {
      if (tryPunch(G)) sfx('punch');
    }
    updatePlayer(G, dt, city);
    updateTraffic(G, dt, city);
    updatePeds(G, dt, city);
    updateMissions(G, dt);
    updateTaxi(G, dt);
    updateBullets(G, dt, city);
    updateBreakers(G, dt);
    updateCourier(G, dt);
    updateWanted(G, dt);
    updateCops(G, dt, city);
    // Particles + floats + toasts.
    for (let i = G.parts.length - 1; i >= 0; i--) {
      const pt = G.parts[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.life -= dt;
      if (pt.life <= 0) G.parts.splice(i, 1);
    }
    for (let i = G.floats.length - 1; i >= 0; i--) {
      const f = G.floats[i];
      f.y -= 30 * dt;
      f.life -= dt;
      if (f.life <= 0) G.floats.splice(i, 1);
    }
    for (let i = G.toasts.length - 1; i >= 0; i--) {
      G.toasts[i].t -= dt;
      if (G.toasts[i].t <= 0) G.toasts.splice(i, 1);
    }
    // Camera follows the player.
    const tx = clamp(G.player.x - CFG.viewW / 2, 0, CFG.world - CFG.viewW);
    const ty = clamp(G.player.y - CFG.viewH / 2, 0, CFG.world - CFG.viewH);
    G.camera.x += (tx - G.camera.x) * Math.min(1, dt * 6);
    G.camera.y += (ty - G.camera.y) * Math.min(1, dt * 6);
    // Autosave.
    G.saveTimer += dt;
    if (G.saveTimer > 15) {
      G.saveTimer = 0;
      saveGame(G);
    }
    musicTick(G, dt);
  } else if (G.over) {
    G.over.t += dt;
  }
  draw(G, ctx, city, CFG.viewW, CFG.viewH);
  if (G.screen === 'playing' || G.screen === 'paused') drawHud(G, ctx, CFG.viewW, CFG.viewH);
  drawScreen(G, ctx, CFG.viewW, CFG.viewH);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

// Debug / probe handle: state read-outs and honest gameplay hooks.
window.__game = {
  G,
  city,
  start: startGame,
  continue: continueGame,
  respawn,
  applyShot: (name) => applyShot(G, city, name),
  interact,
  repair,
  buyAmmo,
  reload,
  talkToVera: () => talkToVera(G),
  state: () => ({
    screen: G.screen,
    money: G.money,
    hp: G.hp,
    ammo: G.ammo,
    reserve: G.reserve,
    wanted: G.wanted,
    heat: G.heat,
    mission: { id: G.mission.id, stage: G.mission.stage, timer: G.mission.timer, breakers: G.mission.breakers.length, done: G.mission.done.slice() },
    taxi: { active: G.taxi.active, pay: G.taxi.pay },
    player: { x: Math.round(G.player.x), y: Math.round(G.player.y), onFoot: G.player.onFoot, car: !!G.player.car },
    cars: G.cars.length,
    peds: G.peds.length,
    cops: G.cops.length,
    clock: G.clock,
  }),
  // Teleport the player (probe hook — the game's own logic still runs the objectives).
  teleport: (x, y) => {
    if (G.player.car) {
      G.player.car.x = x;
      G.player.car.y = y;
      G.player.car.speed = 0;
    }
    G.player.x = x;
    G.player.y = y;
    G.camera.x = clamp(x - CFG.viewW / 2, 0, CFG.world - CFG.viewW);
    G.camera.y = clamp(y - CFG.viewH / 2, 0, CFG.world - CFG.viewH);
  },
  // Screen coordinates of a world point (for aimed clicks in the probe).
  toScreen: (x, y) => ({ x: x - G.camera.x, y: y - G.camera.y }),
  errors: [],
};

window.addEventListener('error', (e) => {
  window.__game.errors.push(String(e.message || e.error));
});
