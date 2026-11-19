// SOLMAR STREETS — boot, game loop and the world object that holds it all
// together: the city, the entities, the missions, the wanted level, the
// shops, the clock and the save. One file, one job: run the game.

import { City } from './city.js';
import { Entities } from './entities.js';
import { Missions } from './missions.js';
import { Combat } from './combat.js';
import { AudioEngine } from './audio.js';
import { Renderer, Particles, daylight } from './render.js';
import { Hud } from './hud.js';
import { Input } from './input.js';
import { readShotQuery, stageShot } from './shots.js';
import { saveGameData, loadGameData, clearSaveData } from './save.js';
import { PRICES, WANTED_MAX, WANTED_DECAY_SECONDS } from './config.js';
import { clamp, dist } from './random.js';

const canvas = document.getElementById('game');
const input = new Input(canvas);

class World {
  constructor(seed) {
    this.seed = seed;
    this.city = new City(seed);
    this.entities = new Entities(this.city, seed);
    this.missions = new Missions(this.city, this.entities, this);
    this.combat = new Combat(this.entities, this.missions, this);
    this.audio = new AudioEngine();
    this.renderer = new Renderer(canvas);
    this.hud = new Hud(canvas);
    this.particles = new Particles();
    this.state = 'title'; // title | playing | paused | wasted | menu
    this.menuIndex = 0;
    this.wanted = 0;
    this.quietTime = 0;
    this.hour = 13; // 1pm, sun high
    this.objective = 'Press M for Vera\'s jobs, or just drive.';
    this.policeTimer = 0;
    this.taxiTimer = 0;
    this.settled = 0;
  }

  // ---- helpers the systems call ----

  toast(text) {
    this.hud.toast(text);
  }

  addShake(amount) {
    this.renderer.addShake(amount);
  }

  setWanted(n) {
    this.wanted = clamp(n, 0, WANTED_MAX);
  }

  raiseWanted(n, why) {
    const before = this.wanted;
    this.setWanted(this.wanted + n);
    this.quietTime = 0;
    if (this.wanted > before) {
      this.toast(`Wanted level ${this.wanted} — ${why}`);
    }
  }

  onPedHit(car) {
    if (car.kind === 'player' || car.driver === 'player') {
      this.raiseWanted(1, 'you hit a pedestrian');
      this.audio.play('crash');
    }
  }

  settle(seconds) {
    this.settled = seconds;
  }

  // ---- shops ----

  tryPitStop() {
    const p = this.entities.player;
    const s = this.city.sites.pitstop;
    const car = p.inCar;
    if (!car) return;
    if (dist(p.x, p.y, s.x, s.y) > 130) return;
    if (car.hp >= 100) {
      // A full-health car is turned away, not charged.
      this.toast('Pit Stop: your car is already mint — no charge.');
      return;
    }
    const missing = 100 - car.hp;
    const cost = Math.ceil(missing * PRICES.repairPerHp);
    if (p.money < cost) {
      this.toast(`Pit Stop: repair costs $${cost} — you have $${Math.floor(p.money)}.`);
      return;
    }
    p.money -= cost;
    car.hp = 100;
    this.toast(`Pit Stop: repaired for $${cost}.`);
    this.audio.play('cash');
  }

  tryGunBarn() {
    const p = this.entities.player;
    const s = this.city.sites.gunbarn;
    if (p.inCar) return;
    if (dist(p.x, p.y, s.x, s.y) > 110) return;
    if (p.money < PRICES.ammoClip) {
      this.toast(`Gun Barn: a clip is $${PRICES.ammoClip} — you have $${Math.floor(p.money)}.`);
      return;
    }
    p.money -= PRICES.ammoClip;
    p.ammo += PRICES.ammoPerClip;
    this.toast(`Gun Barn: +${PRICES.ammoPerClip} rounds.`);
    this.audio.play('cash');
  }

  // ---- save / load ----

  saveGame() {
    const p = this.entities.player;
    saveGameData({
      money: Math.floor(p.money),
      hp: p.hp,
      ammo: p.ammo,
      x: p.x,
      y: p.y,
      hour: this.hour,
      seed: this.seed,
      done: this.missions.done,
      savedAt: Date.now(),
    });
  }

  loadSave() {
    const s = loadGameData();
    if (!s) return false;
    const p = this.entities.player;
    p.money = s.money;
    p.hp = s.hp;
    p.ammo = s.ammo;
    p.x = s.x;
    p.y = s.y;
    this.hour = s.hour;
    this.missions.done = s.done || this.missions.done;
    this.toast('Save loaded — welcome back, driver.');
    return true;
  }

  // ---- per-frame update ----

  update(dt) {
    if (this.state === 'title') {
      if (input.pressed('Enter')) {
        this.startGame(false);
      } else if (input.pressed('KeyC')) {
        this.startGame(true);
      }
      return;
    }
    if (this.state === 'wasted') {
      if (input.pressed('Enter')) this.respawn();
      return;
    }
    if (this.state === 'menu') {
      const list = this.missions.availableMissions();
      if (input.pressed('ArrowUp') || input.pressed('KeyW')) {
        this.menuIndex = (this.menuIndex - 1 + Math.max(1, list.length)) % Math.max(1, list.length);
      }
      if (input.pressed('ArrowDown') || input.pressed('KeyS')) {
        this.menuIndex = (this.menuIndex + 1) % Math.max(1, list.length);
      }
      if (input.pressed('Enter') && list.length > 0) {
        const m = list[this.menuIndex];
        if (this.missions.start(m.id)) this.state = 'playing';
      }
      if (input.pressed('KeyM') || input.pressed('Escape')) this.state = 'playing';
      return;
    }
    if (this.state === 'paused') {
      if (input.pressed('KeyP') || input.pressed('Escape')) this.state = 'playing';
      if (input.pressed('KeyM')) {
        this.state = 'menu';
        this.menuIndex = 0;
      }
      if (input.pressed('KeyQ')) {
        this.saveGame();
        this.state = 'title';
      }
      return;
    }

    // --- playing ---
    if (this.settled > 0) {
      this.settled -= dt;
      // World still ticks so the staged scene is alive, but the player
      // cannot act yet — screenshots catch a living street, not a freeze.
    }
    // Clock: one game hour every 100 seconds.
    this.hour = (this.hour + dt / 100) % 24;

    // Pause / menu / taxi keys.
    if (input.pressed('KeyP') || input.pressed('Escape')) {
      this.state = 'paused';
      this.saveGame();
      return;
    }
    if (input.pressed('KeyM')) {
      this.state = 'menu';
      this.menuIndex = 0;
      return;
    }
    if (input.pressed('KeyT')) this.missions.startTaxi();
    if (input.pressed('KeyE')) this.entities.tryEnterExitCar(this);
    if (input.pressed('KeyF')) this.tryPitStop();
    if (input.pressed('KeyB')) this.tryGunBarn();
    if (input.pressed('KeyN')) {
      const on = this.audio.toggleMusic();
      this.toast(on ? 'Music on' : 'Music off');
    }

    const p = this.entities.player;
    // Mouse aim in world coordinates.
    const mw = this.mouseWorld();
    this.entities.updatePlayer(dt, input, this);
    this.entities.updateTraffic(dt, this);
    this.entities.updatePolice(dt, this);
    this.entities.updatePeds(dt, this);
    this.combat.update(dt, input, mw);
    this.missions.update(dt);
    this.particles.update(dt);
    this.hud.update(dt);

    // Wanted decay after quiet time.
    if (this.wanted > 0) {
      this.quietTime += dt;
      if (this.quietTime > WANTED_DECAY_SECONDS) {
        this.wanted -= 1;
        this.quietTime = 0;
        this.toast(`Wanted level ${this.wanted}`);
      }
    }
    // Police pressure scales with the stars.
    const wantPolice = Math.min(this.wanted, 3);
    const havePolice = this.entities.cars.filter((c) => c.kind === 'police' && !c.dead).length;
    this.policeTimer -= dt;
    if (wantPolice > havePolice && this.policeTimer <= 0) {
      this.policeTimer = 2.5;
      const a = Math.random() * Math.PI * 2;
      const sx = clamp(p.x + Math.cos(a) * 700, 40, this.city.size - 40);
      const sy = clamp(p.y + Math.sin(a) * 700, 40, this.city.size - 40);
      const rp = this.city.nearestRoadPoint(sx, sy);
      this.entities.spawnPolice(rp.x, rp.y);
    }
    const anyPolice = havePolice > 0;
    this.audio.setSiren(anyPolice);
    const car = p.inCar;
    this.audio.setEngine(car ? Math.abs(car.speed) / car.model.top : 0, !!car);

    // Death.
    if (p.hp <= 0 && !p.dead) {
      p.dead = true;
      this.state = 'wasted';
      this.audio.play('fail');
    }
    // Autosave every 20 s of play.
    this.taxiTimer += dt;
    if (this.taxiTimer > 20) {
      this.taxiTimer = 0;
      this.saveGame();
    }
  }

  mouseWorld() {
    const rect = canvas.getBoundingClientRect();
    const cx = (input.mouseX - rect.width / 2) / this.renderer.zoom + this.renderer.camX;
    const cy = (input.mouseY - rect.height / 2) / this.renderer.zoom + this.renderer.camY;
    return { x: cx, y: cy };
  }

  startGame(fromSave) {
    this.audio.ensure();
    if (fromSave) {
      this.loadSave();
    } else {
      clearSaveData();
    }
    this.state = 'playing';
  }

  respawn() {
    const p = this.entities.player;
    p.dead = false;
    p.hp = 100;
    p.money = Math.max(0, Math.floor(p.money * 0.9));
    this.setWanted(0);
    if (p.inCar) {
      p.inCar.kind = 'parked';
      p.inCar.driver = null;
      p.inCar = null;
      p.onFoot = true;
    }
    p.x = this.city.sites.hideout.x;
    p.y = this.city.sites.hideout.y + 100;
    this.missions.active = null;
    this.missions.enemies = [];
    this.state = 'playing';
    this.toast('Back on the street. Vera kept your car — mostly.');
  }

  draw() {
    const ctx = this.renderer.ctx;
    if (this.state === 'title') {
      this.hud.drawTitle(this);
      return;
    }
    this.renderer.draw(this);
    if (this.state === 'playing' || this.state === 'menu' || this.state === 'paused') {
      this.hud.draw(this);
    }
    if (this.state === 'paused') this.hud.drawPause(this);
    if (this.state === 'wasted') this.hud.drawWasted(this);
    if (this.state === 'menu') this.hud.drawMissionMenu(this);
  }
}

// ---- boot ----

function boot() {
  const shot = readShotQuery();
  const seed = shot ? shot.seed : 11;
  const world = new World(seed);

  function resize() {
    world.renderer.resize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener('resize', resize);
  resize();

  // Debug hook for automated play-testing (harmless in normal play).
  window.__solmar = {
    world,
    version: 'rebuild2',
    state: () => world.state,
    player: () => world.entities.player,
    wanted: () => world.wanted,
    mission: () => world.missions.active,
    done: () => world.missions.done,
    startMission: (id) => world.missions.start(id),
    teleport: (x, y) => {
      const p = world.entities.player;
      if (p.inCar) {
        p.inCar.x = x;
        p.inCar.y = y;
      }
      p.x = x;
      p.y = y;
    },
    setWanted: (n) => world.setWanted(n),
    giveMoney: (n) => { world.entities.player.money += n; },
    damagePlayer: (n) => { world.entities.player.hp = Math.max(0, world.entities.player.hp - n); },
    damageCar: (n) => {
      const c = world.entities.player.inCar;
      if (c) c.hp = Math.max(0, c.hp - n);
    },
    startTaxi: () => world.missions.startTaxi(),
    enemies: () => world.missions.enemies,
    courier: () => world.missions.courier,
    cars: () => world.entities.cars,
    peds: () => world.entities.peds,
    save: () => world.saveGame(),
  };

  if (shot) {
    world.audio.ensure();
    stageShot(world, shot);
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    try {
      world.update(dt);
      world.draw();
    } catch (e) {
      console.error('SOLMAR error', e);
    }
    input.endFrame();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

boot();
