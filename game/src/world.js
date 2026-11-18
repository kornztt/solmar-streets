// The simulation: the player, traffic, police, pedestrians, combat, wanted
// level, shops, camera and prompts. Missions and fares live in missions.js;
// this file steps the world one frame at a time and answers the debug hook.
import { VIEW_W, VIEW_H, WORLD_W, WORLD_H, TUNE, ZONES, MISSIONS } from './config.js';
import { RNG, clamp, angleDiff, dist } from './random.js';
import { buildCity, isOnRoad, buildingAt, collideCircle, randomRoadPoint, nearestRoadPoint } from './city.js';
import { makePlayer, makeCar, makePed, makeBullet, makeParticle, stepCarPhysics, stepPedWalk } from './entities.js';
import { startMission, updateMission, updateFare, offeredMission, freshMissionState, freshFareState, stepText } from './missions.js';
import { saveGame, loadGame, clearSave } from './save.js';
import { ROAD_X, ROAD_Y } from './config.js';

// The value in list nearest to v.
function nearestValue(list, v) {
  let best = list[0];
  let bestD = Infinity;
  for (const item of list) {
    const d = Math.abs(item - v);
    if (d < bestD) {
      bestD = d;
      best = item;
    }
  }
  return best;
}

export class World {
  constructor(seed, audio) {
    this.audio = audio;
    this.reset(seed || 7);
  }

  reset(seed) {
    this.seed = seed;
    this.rng = new RNG(seed);
    this.city = buildCity(seed);
    this.time = 0;
    this.screen = 'title';
    this.wastedReason = '';
    this.player = makePlayer(ZONES.spawn.x, ZONES.spawn.y);
    this.cars = [];
    this.peds = [];
    this.bullets = [];
    this.particles = [];
    this.wanted = 0;
    this.lastCrimeAt = -99;
    this.decayTimer = 0;
    this.policeTimer = 0;
    this.mission = freshMissionState();
    this.fare = freshFareState();
    this.camera = { x: this.player.x, y: this.player.y, zoom: 1 };
    this.prompt = null;
    this.toastText = '';
    this.toastUntil = 0;
    this.objective = 'Talk to Mara at the hideout';
    this.stats = { missionsDone: 0, fares: 0, earned: 0, kills: 0, shotsFired: 0, timePlayed: 0 };
    this.mara = makePed('mara', ZONES.mara.x, ZONES.mara.y);
    this.peds.push(this.mara);
    this.spawnTraffic();
    this.spawnWalkers(14);
  }

  spawnTraffic() {
    for (let i = 0; i < 10; i += 1) {
      const p = randomRoadPoint(this.rng);
      const alongX = Math.abs(p.x - Math.round(p.x / 400) * 400) < 40;
      const car = makeCar(this.rng.chance(0.18) ? 'taxi' : 'sedan', p.x, p.y, alongX ? 0 : Math.PI / 2);
      car.driver = 'traffic';
      car.speed = this.rng.range(TUNE.trafficSpeed[0], TUNE.trafficSpeed[1]);
      this.cars.push(car);
    }
    for (let i = 0; i < 8; i += 1) {
      const p = randomRoadPoint(this.rng);
      const car = makeCar(this.rng.chance(0.25) ? 'van' : 'sedan', p.x, p.y, this.rng.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]));
      car.driver = null;
      this.cars.push(car);
    }
  }

  spawnWalkers(n) {
    for (let i = 0; i < n; i += 1) {
      const p = randomRoadPoint(this.rng);
      this.peds.push(makePed('walker', p.x, p.y));
    }
  }

  // ---- small helpers the debug hook and missions use ----

  fixPosition(x, y, r) {
    return collideCircle(this.city, x, y, r);
  }

  teleport(x, y) {
    const fixed = this.fixPosition(x, y, 16);
    this.player.x = fixed.x;
    this.player.y = fixed.y;
    if (this.player.car) {
      this.player.car.x = fixed.x;
      this.player.car.y = fixed.y;
    }
    this.camera.x = fixed.x;
    this.camera.y = fixed.y;
  }

  setObjective(text) {
    this.objective = text;
  }

  toast(text) {
    this.toastText = text;
    this.toastUntil = this.time + 3.5;
  }

  setWanted(n) {
    this.wanted = clamp(n, 0, 5);
    this.lastCrimeAt = this.time;
    this.decayTimer = 0;
  }

  wantedUp(n) {
    this.setWanted(this.wanted + n);
  }

  spawnPolice(n) {
    for (let i = 0; i < n; i += 1) {
      let p = randomRoadPoint(this.rng);
      let tries = 0;
      while (dist(p.x, p.y, this.player.x, this.player.y) < 650 && tries < 12) {
        p = randomRoadPoint(this.rng);
        tries += 1;
      }
      const car = makeCar('police', p.x, p.y, 0);
      car.driver = 'police';
      this.cars.push(car);
    }
  }

  save() {
    saveGame(this);
  }

  applySave(data) {
    if (!data) return;
    this.player.money = data.money;
    this.mission.done = data.done || {};
    this.mission.next = this.mission.done.m1 ? (this.mission.done.m2 ? (this.mission.done.m3 ? null : 'm3') : 'm2') : 'm1';
    this.stats = { ...this.stats, ...(data.stats || {}) };
    this.setObjective(this.mission.next ? 'Talk to Mara for your next job' : 'Story complete — Solmar is yours');
  }

  startGame(fromSave) {
    this.audio.ensure();
    this.audio.startMusic();
    if (fromSave) {
      this.applySave(loadGame());
    }
    this.screen = 'play';
  }

  // ---- combat ----

  damagePlayer(amount) {
    const p = this.player;
    if (p.dead || this.screen !== 'play') return;
    p.hp -= amount;
    p.lastDamageAt = this.time;
    this.audio.hit();
    if (p.hp <= 0) {
      p.hp = 0;
      this.wasted('WASTED');
    }
  }

  wasted(reason) {
    this.screen = 'wasted';
    this.wastedReason = reason;
    this.audio.wasted();
    this.audio.siren(false);
    this.save();
  }

  respawn() {
    const p = this.player;
    p.hp = p.maxHp;
    p.dead = false;
    p.car = null;
    this.teleport(ZONES.spawn.x, ZONES.spawn.y);
    this.setWanted(0);
    this.mission.current = null;
    this.mission.intro = null;
    this.bullets = [];
    // Clear police so the player restarts clean.
    this.cars = this.cars.filter((c) => c.carKind !== 'police');
    this.peds = this.peds.filter((x) => x.pedKind !== 'cop');
    this.screen = 'play';
    this.setObjective(this.mission.next ? 'Talk to Mara for your next job' : 'Story complete — Solmar is yours');
  }

  punch() {
    const p = this.player;
    if (p.punchCooldown > 0 || p.car) return;
    p.punchCooldown = TUNE.punchCooldown;
    this.audio.punch();
    const reach = TUNE.punchRange;
    let best = null;
    let bestD = Infinity;
    for (const ped of this.peds) {
      if (ped.dead || ped.state === 'down' || ped.pedKind === 'mara') continue;
      const d = dist(p.x, p.y, ped.x, ped.y);
      if (d < reach + ped.radius && d < bestD) {
        const ang = Math.atan2(ped.y - p.y, ped.x - p.x);
        if (Math.abs(angleDiff(p.angle, ang)) < 2.1) {
          best = ped;
          bestD = d;
        }
      }
    }
    if (best) {
      this.hurtPed(best, TUNE.punchDamage, 'punch');
      const a = Math.atan2(best.y - p.y, best.x - p.x);
      best.x += Math.cos(a) * 18;
      best.y += Math.sin(a) * 18;
      this.particles.push(...makeParticle(best.x, best.y, '#ffffff', 6, 120));
    }
  }

  hurtPed(ped, damage, source) {
    ped.hp -= damage;
    if (ped.pedKind === 'walker' || ped.pedKind === 'fare') {
      if (source === 'punch' || source === 'bullet') this.wantedUp(source === 'bullet' ? 1 : 1);
      ped.state = 'fleeing';
      ped.wanderAt = 0;
    }
    if (ped.pedKind === 'viper') {
      ped.state = 'viper';
    }
    if (ped.hp <= 0 && ped.state !== 'down') {
      ped.state = 'down';
      ped.downAt = this.time;
      ped.hp = 0;
      this.stats.kills += 1;
      if (ped.pedKind === 'viper') {
        const m = this.mission.current;
        if (m && m.id === 'm3' && m.step === 1) {
          m.killed += 1;
          this.setObjective('Dockside Takedown: Take down the Viper crew (' + m.killed + '/' + m.total + ')');
          this.toast('Viper down (' + m.killed + '/' + m.total + ')');
        }
        this.wantedUp(1);
      } else if (ped.pedKind === 'walker' || ped.pedKind === 'fare') {
        this.wantedUp(1);
      }
    }
  }

  shootAt(wx, wy) {
    const p = this.player;
    if (p.car || p.fireCooldown > 0) return;
    if (p.mag <= 0) {
      this.audio.denied();
      p.fireCooldown = 0.25;
      return;
    }
    p.mag -= 1;
    p.fireCooldown = TUNE.pistolFireInterval;
    p.angle = Math.atan2(wy - p.y, wx - p.x);
    this.stats.shotsFired += 1;
    this.audio.shoot();
    const bx = p.x + Math.cos(p.angle) * 20;
    const by = p.y + Math.sin(p.angle) * 20;
    this.bullets.push(makeBullet(bx, by, p.angle, 'player', TUNE.pistolDamage));
    this.particles.push(...makeParticle(bx, by, '#ffe9a8', 3, 90));
    // A gunshot nearby is a crime the cops hear.
    this.wantedUp(0);
    this.lastCrimeAt = this.time;
    if (this.wanted === 0) this.wantedUp(1);
  }

  reload() {
    const p = this.player;
    if (p.car || p.mag >= TUNE.pistolMag || p.ammo <= 0) return;
    const need = TUNE.pistolMag - p.mag;
    const take = Math.min(need, p.ammo);
    p.ammo -= take;
    p.mag += take;
    this.audio.reload();
  }

  // ---- cars ----

  nearestCar(maxD) {
    const p = this.player;
    let best = null;
    let bestD = maxD;
    for (const car of this.cars) {
      if (car.dead || car.wrecked) continue;
      const d = dist(p.x, p.y, car.x, car.y);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    return best;
  }

  enterCar(car) {
    const p = this.player;
    if (car.driver === 'traffic' || car.driver === 'police') {
      // Yank the driver out; they run off on foot.
      const driver = makePed('walker', car.x + 30, car.y + 30);
      driver.state = 'fleeing';
      this.peds.push(driver);
      car.driver = null;
    }
    p.car = car;
    car.driver = 'player';
    this.audio.carStart();
    if (car.carKind !== 'police' && car.driver === 'player') this.wantedUp(1);
  }

  exitCar() {
    const p = this.player;
    if (!p.car) return;
    const car = p.car;
    car.driver = null;
    car.speed = 0;
    const side = this.fixPosition(car.x + 40, car.y + 30, 14);
    p.x = side.x;
    p.y = side.y;
    p.car = null;
  }

  // ---- per-frame update ----

  step(dt, input) {
    this.time += dt;
    if (this.screen === 'play') this.stats.timePlayed += dt;

    // Title / pause / wasted screens: input only, no simulation.
    if (this.screen === 'title') {
      if (input.pressed('Enter') || input.mouse.clicked) {
        this.startGame(loadGame() !== null);
      } else if (input.pressed('KeyN')) {
        clearSave();
        this.startGame(false);
      }
      return;
    }
    if (this.screen === 'pause') {
      if (input.pressed('Escape') || input.pressed('KeyP') || input.mouse.clicked) {
        this.screen = 'play';
        this.audio.siren(this.wanted >= 2);
      }
      return;
    }
    if (this.screen === 'wasted') {
      if (input.pressed('Enter') || input.mouse.clicked) this.respawn();
      return;
    }
    if (this.screen !== 'play') return;

    // Pause toggle.
    if (input.pressed('Escape') || input.pressed('KeyP')) {
      this.screen = 'pause';
      this.audio.siren(false);
      this.save();
      return;
    }

    const p = this.player;
    const axis = input.moveAxis();
    const drive = input.driveAxis();
    const sprint = input.down('ShiftLeft') || input.down('ShiftRight');

    // Aim the pistol at the mouse.
    const zoom = this.camera.zoom;
    const aimX = this.camera.x + (input.mouse.x - VIEW_W / 2) / zoom;
    const aimY = this.camera.y + (input.mouse.y - VIEW_H / 2) / zoom;
    input.mouse.worldX = aimX;
    input.mouse.worldY = aimY;

    // Mission intro dialogue.
    if (this.mission.intro) {
      if (input.pressed('Enter')) {
        const id = this.mission.intro.id;
        startMission(this, id);
      } else if (input.pressed('Escape')) {
        this.mission.intro = null;
      }
      this.updateCamera(dt);
      return;
    }

    // Cooldowns and regen.
    p.punchCooldown = Math.max(0, p.punchCooldown - dt);
    p.fireCooldown = Math.max(0, p.fireCooldown - dt);
    if (this.time - p.lastDamageAt > 5 && p.hp > 0 && p.hp < p.maxHp) {
      p.hp = Math.min(p.maxHp, p.hp + TUNE.playerRegen * dt);
    }

    // Interact: E near Mara, a car, or a shop.
    this.updatePrompt();
    if (input.pressed('KeyE')) this.usePrompt();
    if (input.pressed('KeyF')) this.punch();
    if (input.pressed('KeyR')) this.reload();
    if (input.mouse.down) this.shootAt(aimX, aimY);
    if (input.pressed('KeyM')) {
      this.audio.setMuted(!this.audio.muted);
      this.toast(this.audio.muted ? 'Sound off (M to turn on)' : 'Sound on');
    }

    // Player movement.
    if (p.car) {
      const car = p.car;
      stepCarPhysics(car, dt, drive.throttle, drive.steer);
      const fixed = collideCircle(this.city, car.x, car.y, TUNE.carRadius);
      if (Math.abs(fixed.x - car.x) > 2 || Math.abs(fixed.y - car.y) > 2) {
        car.speed *= 0.35;
      }
      car.x = fixed.x;
      car.y = fixed.y;
      p.x = car.x;
      p.y = car.y;
      p.angle = car.angle;
      p.moving = Math.abs(car.speed) > 20;
    } else {
      const speed = sprint ? TUNE.playerSprint : TUNE.playerWalk;
      let mx = axis.x;
      let my = axis.y;
      const len = Math.hypot(mx, my);
      if (len > 0) {
        mx /= len;
        my /= len;
        p.angle = Math.atan2(my, mx);
        p.moving = true;
      } else {
        p.moving = false;
      }
      p.x += mx * speed * dt;
      p.y += my * speed * dt;
      const fixed = collideCircle(this.city, p.x, p.y, p.radius);
      p.x = fixed.x;
      p.y = fixed.y;
    }

    this.updateCars(dt);
    this.updatePeds(dt);
    this.updateBullets(dt);
    this.updateParticles(dt);
    this.updatePolice(dt);
    updateMission(this, dt);
    updateFare(this, dt);
    this.updateWanted(dt);
    this.updateCamera(dt);
    this.audio.siren(this.wanted >= 2);
  }

  updatePrompt() {
    const p = this.player;
    this.prompt = null;
    if (this.mission.intro) return;
    // Mara offers the next job.
    const offered = offeredMission(this);
    if (offered && !p.car && dist(p.x, p.y, ZONES.mara.x, ZONES.mara.y) < 80) {
      this.prompt = { text: 'E — Talk to Mara (' + offered.name + ')', action: 'mara' };
      return;
    }
    // Pit Stop repair.
    if (p.car && dist(p.x, p.y, ZONES.pitStop.x, ZONES.pitStop.y) < ZONES.pitStop.r && p.car.hp < p.car.maxHp) {
      this.prompt = { text: 'E — Repair car $' + TUNE.pitStopPrice, action: 'pitstop' };
      return;
    }
    // Gun Barn ammo.
    if (!p.car && dist(p.x, p.y, ZONES.gunBarn.x, ZONES.gunBarn.y) < ZONES.gunBarn.r) {
      this.prompt = { text: 'E — Buy ammo $' + TUNE.ammoPrice + ' (' + TUNE.ammoPack + ' rounds)', action: 'gunbarn' };
      return;
    }
    // Enter / exit a car.
    if (!p.car) {
      const car = this.nearestCar(70);
      if (car) {
        this.prompt = { text: car.carKind === 'police' ? 'E — Steal the police cruiser' : 'E — Steal the car', action: 'enter', car };
        return;
      }
    } else {
      this.prompt = { text: 'E — Get out of the car', action: 'exit' };
    }
  }

  usePrompt() {
    const pr = this.prompt;
    if (!pr) return;
    const p = this.player;
    if (pr.action === 'mara') {
      const offered = offeredMission(this);
      if (offered) this.mission.intro = { id: offered.id };
    } else if (pr.action === 'enter' && pr.car) {
      this.enterCar(pr.car);
    } else if (pr.action === 'exit') {
      this.exitCar();
    } else if (pr.action === 'pitstop') {
      if (p.car && p.car.hp >= p.car.maxHp) {
        this.toast('Your car is already in top shape');
      } else if (p.money >= TUNE.pitStopPrice) {
        p.money -= TUNE.pitStopPrice;
        p.car.hp = p.car.maxHp;
        this.audio.cash();
        this.toast('Car repaired — $' + TUNE.pitStopPrice);
        this.save();
      } else {
        this.audio.denied();
        this.toast('Not enough cash — repairs cost $' + TUNE.pitStopPrice);
      }
    } else if (pr.action === 'gunbarn') {
      if (p.money >= TUNE.ammoPrice) {
        p.money -= TUNE.ammoPrice;
        p.ammo += TUNE.ammoPack;
        this.audio.cash();
        this.toast('Bought ' + TUNE.ammoPack + ' rounds — $' + TUNE.ammoPrice);
        this.save();
      } else {
        this.audio.denied();
        this.toast('Not enough cash — ammo costs $' + TUNE.ammoPrice);
      }
    }
  }

  updateCars(dt) {
    const p = this.player;
    for (const car of this.cars) {
      if (car.dead) continue;
      if (car.driver === 'player') continue; // driven in step()
      if (car.wrecked) {
        car.speed = 0;
        continue;
      }
      if (car.driver === 'police') {
        // Chase the player: steer at their predicted position.
        const lead = 0.4;
        const tx = p.x + Math.cos(p.angle) * (p.car ? p.car.speed : 0) * lead;
        const ty = p.y + Math.sin(p.angle) * (p.car ? p.car.speed : 0) * lead;
        const want = Math.atan2(ty - car.y, tx - car.x);
        const diff = angleDiff(car.angle, want);
        const steer = clamp(diff * 2.2, -1, 1);
        stepCarPhysics(car, dt, 1, steer);
        const fixed = collideCircle(this.city, car.x, car.y, TUNE.carRadius);
        if (Math.abs(fixed.x - car.x) > 2 || Math.abs(fixed.y - car.y) > 2) car.speed *= 0.4;
        car.x = fixed.x;
        car.y = fixed.y;
        car.sirenPhase += dt * 6;
        // Ram the player's car or the player on foot.
        const target = p.car || p;
        const d = dist(car.x, car.y, target.x, target.y);
        if (d < 44) {
          if (p.car) {
            p.car.hp -= TUNE.ramDamage * dt * 1.5;
            if (p.car.hp <= 0) {
              p.car.hp = 0;
              p.car.wrecked = true;
              this.toast('Your car is wrecked!');
              this.exitCar();
            }
          } else {
            this.damagePlayer(TUNE.ramDamage * dt * 0.5);
          }
          car.speed *= 0.35;
        }
        continue;
      }
      // Parked cars (no driver) stay where they are: only traffic drives.
      if (car.driver !== 'traffic') continue;
      // Traffic: cruise along its road, turn at intersections.
      // A car moving along X sits on a horizontal road (constant y); moving
      // along Y it sits on a vertical road (constant x).
      const movingAlongX = Math.abs(Math.cos(car.angle)) > 0.5;
      const roadLine = movingAlongX
        ? nearestValue(ROAD_Y, car.y)
        : nearestValue(ROAD_X, car.x);
      const cross = movingAlongX ? car.y - roadLine : car.x - roadLine;
      const heading = movingAlongX
        ? (Math.cos(car.angle) >= 0 ? 0 : Math.PI)
        : (Math.sin(car.angle) >= 0 ? Math.PI / 2 : -Math.PI / 2);
      const steer = clamp(-cross * 0.03 + angleDiff(car.angle, heading) * 0.5, -1, 1);
      stepCarPhysics(car, dt, 0.55, steer);
      // At an intersection, sometimes turn left or right.
      const along = movingAlongX ? car.x : car.y;
      const crossings = movingAlongX ? ROAD_X : ROAD_Y;
      for (const c of crossings) {
        if (Math.abs(along - c) < 26 && car.waitAt < this.time) {
          if (this.rng.chance(0.3)) {
            car.angle += this.rng.pick([-Math.PI / 2, Math.PI / 2]);
            car.waitAt = this.time + 1.5;
          }
          break;
        }
      }
      const fixed = collideCircle(this.city, car.x, car.y, TUNE.carRadius);
      car.x = fixed.x;
      car.y = fixed.y;
    }
    // Car-car separation so traffic does not pile up.
    for (let i = 0; i < this.cars.length; i += 1) {
      for (let j = i + 1; j < this.cars.length; j += 1) {
        const a = this.cars[i];
        const b = this.cars[j];
        if (a.dead || b.dead) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        if (d > 0.01 && d < 44) {
          const push = (44 - d) / 2;
          const nx = dx / d;
          const ny = dy / d;
          a.x -= nx * push;
          a.y -= ny * push;
          b.x += nx * push;
          b.y += ny * push;
        }
      }
    }
    // Drop wrecked / far police cruisers the player outran.
    this.cars = this.cars.filter((c) => {
      if (c.carKind === 'police' && c.driver === 'police' && this.wanted === 0) return false;
      return true;
    });
  }

  updatePeds(dt) {
    const p = this.player;
    for (const ped of this.peds) {
      if (ped.dead) continue;
      if (ped.state === 'down') {
        if (this.time - ped.downAt > 8) {
          ped.state = 'fleeing';
          ped.hp = 40;
          ped.wanderAt = 0;
        }
        continue;
      }
      if (ped.pedKind === 'mara') continue;
      if (ped.pedKind === 'fare' && this.fare.state === 'waiting') continue;
      if (ped.pedKind === 'viper') {
        const d = dist(ped.x, ped.y, p.x, p.y);
        ped.fireCooldown -= dt;
        if (d > 330) {
          const a = Math.atan2(p.y - ped.y, p.x - ped.x);
          stepPedWalk(ped, dt, a, TUNE.viperSpeed);
        } else if (d < 230) {
          const a = Math.atan2(ped.y - p.y, ped.x - p.x);
          stepPedWalk(ped, dt, a, TUNE.viperSpeed * 0.8);
        } else {
          ped.angle = Math.atan2(p.y - ped.y, p.x - ped.x);
        }
        if (d < TUNE.viperRange && ped.fireCooldown <= 0 && this.hasLineOfSight(ped.x, ped.y, p.x, p.y)) {
          ped.fireCooldown = TUNE.viperFireInterval;
          const spread = (this.rng.float() - 0.5) * 0.24;
          const a = Math.atan2(p.y - ped.y, p.x - ped.x) + spread;
          this.bullets.push(makeBullet(ped.x + Math.cos(a) * 18, ped.y + Math.sin(a) * 18, a, 'viper', TUNE.viperDamage));
          this.audio.shoot();
        }
        const fixed = collideCircle(this.city, ped.x, ped.y, ped.radius);
        ped.x = fixed.x;
        ped.y = fixed.y;
        continue;
      }
      if (ped.pedKind === 'cop') {
        const a = Math.atan2(p.y - ped.y, p.x - ped.x);
        stepPedWalk(ped, dt, a, TUNE.copSpeed);
        const fixed = collideCircle(this.city, ped.x, ped.y, ped.radius);
        ped.x = fixed.x;
        ped.y = fixed.y;
        if (dist(ped.x, ped.y, p.x, p.y) < 26 && !p.car) {
          this.wasted('BUSTED');
        }
        continue;
      }
      // Walkers and fleeing peds.
      if (ped.state === 'fleeing') {
        const a = Math.atan2(ped.y - p.y, ped.x - p.x);
        stepPedWalk(ped, dt, a, 200);
        if (dist(ped.x, ped.y, p.x, p.y) > 700) {
          ped.state = 'walker';
        }
      } else {
        ped.wanderAt -= dt;
        if (ped.wanderAt <= 0) {
          ped.wanderAngle = this.rng.angle();
          ped.wanderAt = this.rng.range(2, 5);
        }
        stepPedWalk(ped, dt, ped.wanderAngle, ped.speed);
        // Keep walkers near roads: steer back when deep inside a block.
        if (!isOnRoad(ped.x, ped.y)) {
          const near = nearestRoadPoint(ped.x, ped.y);
          const a = Math.atan2(near.y - ped.y, near.x - ped.x);
          ped.wanderAngle = a;
        }
      }
      const fixed = collideCircle(this.city, ped.x, ped.y, ped.radius);
      ped.x = fixed.x;
      ped.y = fixed.y;
    }
    this.peds = this.peds.filter((x) => !x.dead);
    // A gunshot nearby scares walkers into fleeing.
    if (this.bullets.some((b) => b.owner === 'player')) {
      for (const ped of this.peds) {
        if ((ped.pedKind === 'walker' || ped.pedKind === 'fare') && dist(ped.x, ped.y, p.x, p.y) < 420) {
          ped.state = 'fleeing';
          ped.wanderAt = 0;
        }
      }
    }
  }

  hasLineOfSight(ax, ay, bx, by) {
    for (let t = 0.15; t < 1; t += 0.15) {
      const x = ax + (bx - ax) * t;
      const y = ay + (by - ay) * t;
      if (buildingAt(this.city, x, y, 4)) return false;
    }
    return true;
  }

  updateBullets(dt) {
    const p = this.player;
    for (const b of this.bullets) {
      if (b.dead) continue;
      b.x += Math.cos(b.angle) * b.speed * dt;
      b.y += Math.sin(b.angle) * b.speed * dt;
      b.travelled += b.speed * dt;
      if (b.travelled > b.range || b.x < 0 || b.x > WORLD_W || b.y < 0 || b.y > WORLD_H) {
        b.dead = true;
        continue;
      }
      if (buildingAt(this.city, b.x, b.y, 2)) {
        b.dead = true;
        this.particles.push(...makeParticle(b.x, b.y, '#c9c9c9', 3, 80));
        continue;
      }
      if (b.owner === 'player') {
        for (const ped of this.peds) {
          if (ped.dead || ped.state === 'down' || ped.pedKind === 'mara') continue;
          if (dist(b.x, b.y, ped.x, ped.y) < ped.radius + 4) {
            b.dead = true;
            this.hurtPed(ped, b.damage, 'bullet');
            this.particles.push(...makeParticle(b.x, b.y, '#ff5a5a', 5, 120));
            break;
          }
        }
        if (b.dead) continue;
        for (const car of this.cars) {
          if (car.dead || car.wrecked) continue;
          if (dist(b.x, b.y, car.x, car.y) < 22) {
            b.dead = true;
            car.hp -= b.damage;
            this.particles.push(...makeParticle(b.x, b.y, '#ffd23b', 4, 100));
            if (car.hp <= 0) {
              car.hp = 0;
              car.wrecked = true;
              car.speed = 0;
              if (car.driver === 'player') {
                this.toast('Your car is wrecked!');
                this.exitCar();
              }
            }
            break;
          }
        }
      } else if (b.owner === 'viper') {
        const target = p.car || p;
        if (dist(b.x, b.y, target.x, target.y) < 18) {
          b.dead = true;
          if (p.car) {
            p.car.hp -= b.damage;
            if (p.car.hp <= 0) {
              p.car.hp = 0;
              p.car.wrecked = true;
              this.toast('Your car is wrecked!');
              this.exitCar();
            }
          } else {
            this.damagePlayer(b.damage);
          }
        }
      }
    }
    this.bullets = this.bullets.filter((b) => !b.dead);
  }

  updateParticles(dt) {
    for (const pt of this.particles) {
      pt.life -= dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
    }
    this.particles = this.particles.filter((pt) => pt.life > 0);
  }

  updatePolice(dt) {
    if (this.wanted <= 0) return;
    const cops = this.cars.filter((c) => c.carKind === 'police' && c.driver === 'police').length;
    this.policeTimer -= dt;
    if (cops < this.wanted && this.policeTimer <= 0) {
      this.spawnPolice(1);
      this.policeTimer = TUNE.policeSpawnInterval;
    }
    // On foot at high wanted, an officer gets out and chases the player.
    if (this.wanted >= 3 && !this.player.car) {
      const copsOnFoot = this.peds.filter((x) => x.pedKind === 'cop' && x.state !== 'down').length;
      const nearCruiser = this.cars.find((c) => c.carKind === 'police' && dist(c.x, c.y, this.player.x, this.player.y) < 500);
      if (copsOnFoot === 0 && nearCruiser) {
        const cop = makePed('cop', nearCruiser.x + 30, nearCruiser.y);
        this.peds.push(cop);
      }
    }
  }

  updateWanted(dt) {
    if (this.wanted <= 0) return;
    const nearPolice = this.cars.some((c) => c.carKind === 'police' && dist(c.x, c.y, this.player.x, this.player.y) < 700);
    if (this.time - this.lastCrimeAt > 10 && !nearPolice) {
      this.decayTimer += dt;
      if (this.decayTimer >= TUNE.wantedDecaySeconds) {
        this.decayTimer = 0;
        this.wanted -= 1;
        if (this.wanted === 0) this.toast('You lost the cops');
      }
    } else {
      this.decayTimer = 0;
    }
  }

  updateCamera(dt) {
    const p = this.player;
    const targetZoom = p.car ? 0.62 : 0.8;
    this.camera.zoom += (targetZoom - this.camera.zoom) * Math.min(1, dt * 2);
    const k = Math.min(1, dt * 5);
    this.camera.x += (p.x - this.camera.x) * k;
    this.camera.y += (p.y - this.camera.y) * k;
    const vw = VIEW_W / this.camera.zoom / 2;
    const vh = VIEW_H / this.camera.zoom / 2;
    this.camera.x = clamp(this.camera.x, vw, WORLD_W - vw);
    this.camera.y = clamp(this.camera.y, vh, WORLD_H - vh);
  }
}
