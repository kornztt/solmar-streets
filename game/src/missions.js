// Missions and the taxi side job.
// M1 The Getaway — pick up Vera's runner, then lose yourself at the hideout.
// M2 Hot Delivery — a sealed case to the marina drop, on the clock.
// M3 Dockside Takedown — five Breakers holding the pier; clear them out.
// M4 Harbor Chase (new) — a Breaker courier is fleeing with the ledger;
//   ram his car until it stops, grab the ledger, bring it home.
// Taxi — fares flag you down; drive them where they point, get paid + tip.

import { REWARDS } from './config.js';
import { dist } from './random.js';

export const MISSION_DEFS = {
  m1: {
    id: 'm1', name: 'The Getaway', giver: 'Vera',
    brief: 'Vera: "My runner is waiting by the market. Pick him up, then get to the hideout before the heat closes in."',
    reward: REWARDS.m1,
  },
  m2: {
    id: 'm2', name: 'Hot Delivery', giver: 'Vera',
    brief: 'Vera: "Sealed case, marina drop, 90 seconds. Don\'t open it, don\'t stop for anyone."',
    reward: REWARDS.m2,
    timeLimit: 90,
  },
  m3: {
    id: 'm3', name: 'Dockside Takedown', giver: 'Vera',
    brief: 'Vera: "The Breakers took the pier. Five of them. Clear them out and the docks are ours again."',
    reward: REWARDS.m3,
  },
  m4: {
    id: 'm4', name: 'Harbor Chase', giver: 'Vera',
    brief: 'Vera: "A Breaker courier is running with our ledger. Ram his car till it stops, grab the ledger, bring it home."',
    reward: REWARDS.m4,
    timeLimit: 150,
  },
};

export class Missions {
  constructor(city, entities, world) {
    this.city = city;
    this.entities = entities;
    this.world = world;
    this.done = { m1: false, m2: false, m3: false, m4: false };
    this.active = null; // {id, stage, timer, marker, target...}
    this.taxi = null; // {stage, ped, dest, timer, fare}
    this.enemies = []; // rival gang members for M3
    this.courier = null; // M4 fleeing car
    this.ledger = null; // M4 pickup after the courier stops
  }

  availableMissions() {
    return Object.values(MISSION_DEFS).filter((m) => !this.done[m.id]);
  }

  start(id) {
    if (this.active) return false;
    const def = MISSION_DEFS[id];
    if (!def || this.done[id]) return false;
    const p = this.entities.player;
    if (id === 'm1') {
      const pickup = this.city.randomIntersection(this.entities.rng);
      this.active = { id, stage: 'pickup', timer: 120, marker: pickup, def };
      this.world.toast('M1: pick up the runner');
    } else if (id === 'm2') {
      const drop = { x: this.city.sites.pier.x - 120, y: this.city.sites.pier.y - 160 };
      this.active = { id, stage: 'deliver', timer: 90, marker: drop, def };
      this.world.toast('M2: deliver the case — 90s');
    } else if (id === 'm3') {
      this.spawnEnemies();
      this.active = { id, stage: 'clear', timer: 0, marker: { x: this.city.sites.pier.x, y: this.city.sites.pier.y }, def };
      this.world.toast('M3: clear the pier — 5 Breakers');
    } else if (id === 'm4') {
      this.spawnCourier();
      this.active = { id, stage: 'chase', timer: 150, marker: null, def };
      this.world.toast('M4: run down the courier');
    }
    this.world.objective = def.brief;
    this.world.audio.play('mission');
    return true;
  }

  spawnEnemies() {
    this.enemies = [];
    const pier = this.city.sites.pier;
    const rng = this.entities.rng;
    const spots = [
      { dx: -60, dy: -40 }, { dx: 40, dy: -60 }, { dx: 90, dy: 30 },
      { dx: -20, dy: 70 }, { dx: 120, dy: -30 },
    ];
    for (const s of spots) {
      this.enemies.push({
        x: pier.x + s.dx,
        y: pier.y + s.dy,
        hp: 100,
        color: '#7b2d26',
        speed: 95,
        angle: rng() * Math.PI * 2,
        attackCd: 0,
        dead: false,
        kind: 'breaker',
      });
    }
  }

  spawnCourier() {
    const pier = this.city.sites.pier;
    const model = { name: 'Comet', kind: 'sport', top: 470, accel: 420, grip: 2.6, colors: ['#7b2d26'] };
    // The courier's car is deliberately slower than the player's best rides,
    // so the chase is winnable by driving, not by luck.
    const car = {
      id: 9001,
      x: pier.x, y: pier.y - 60, angle: -Math.PI / 2,
      speed: 0, model, color: '#7b2d26', kind: 'courier', hp: 100,
      driver: 'courier', target: null, wait: 0, dead: false,
    };
    this.courier = car;
    this.entities.cars.push(car);
    this.world.toast('The courier is running!');
  }

  update(dt) {
    const p = this.entities.player;
    // Taxi job ticks on its own, even mid-mission.
    this.updateTaxi(dt);
    // Enemies wander the pier and swing at the player up close.
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = dist(e.x, e.y, p.x, p.y);
      if (d < 420 && !p.dead) {
        e.angle = Math.atan2(p.y - e.y, p.x - e.x);
        if (d > 40) {
          e.x += Math.cos(e.angle) * e.speed * dt;
          e.y += Math.sin(e.angle) * e.speed * dt;
        } else if (e.attackCd <= 0) {
          p.hp = Math.max(0, p.hp - 8);
          e.attackCd = 0.9;
          this.world.addShake(4);
          this.world.audio.play('hit');
        }
      }
      e.attackCd = Math.max(0, e.attackCd - dt);
    }
    this.enemies = this.enemies.filter((e) => !e.dead);
    // Courier AI: flee from the player along the roads.
    if (this.courier && !this.courier.dead) {
      const c = this.courier;
      if (c.hp <= 0) {
        c.dead = true;
        c.speed = 0;
        this.ledger = { x: c.x, y: c.y, taken: false };
        if (this.active && this.active.id === 'm4') {
          this.active.stage = 'grab';
          this.world.toast('Courier stopped — grab the ledger!');
        }
      } else {
        const away = Math.atan2(c.y - p.y, c.x - p.x);
        const diff = ((away - c.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        c.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
        const cruise = c.model.top * 0.8;
        c.speed += (cruise - c.speed) * Math.min(1, dt * 1.1);
        const nx = c.x + Math.cos(c.angle) * c.speed * dt;
        const ny = c.y + Math.sin(c.angle) * c.speed * dt;
        if (this.city.isRoad(nx, ny)) {
          const fixed = this.city.resolveCircle(nx, ny, 30);
          c.x = fixed.x;
          c.y = fixed.y;
        } else {
          c.angle += Math.PI / 2;
        }
        // Ramming the courier damages it.
        if (p.inCar && dist(p.x, p.y, c.x, c.y) < 62 && Math.abs(p.inCar.speed) > 120) {
          c.hp = Math.max(0, c.hp - 14);
          p.inCar.speed *= 0.6;
          this.world.addShake(5);
          this.world.particles.burst(c.x, c.y, '#ffd166', 10);
          this.world.audio.play('crash');
        }
      }
    }
    if (!this.active) return;
    const a = this.active;
    if (a.timer > 0) {
      a.timer -= dt;
      if (a.timer <= 0) {
        this.fail('Out of time.');
        return;
      }
    }
    if (a.id === 'm1') {
      if (a.stage === 'pickup' && dist(p.x, p.y, a.marker.x, a.marker.y) < 60) {
        a.stage = 'return';
        a.timer = 120;
        a.marker = { x: this.city.sites.hideout.x, y: this.city.sites.hideout.y + 100 };
        this.world.raiseWanted(1, 'the runner was spotted');
        this.world.toast('Runner aboard — get to the hideout!');
      } else if (a.stage === 'return' && dist(p.x, p.y, a.marker.x, a.marker.y) < 70) {
        this.complete();
      }
    } else if (a.id === 'm2') {
      if (dist(p.x, p.y, a.marker.x, a.marker.y) < 60) this.complete();
    } else if (a.id === 'm3') {
      if (this.enemies.length === 0) this.complete();
    } else if (a.id === 'm4') {
      if (a.stage === 'grab' && this.ledger && !this.ledger.taken
        && dist(p.x, p.y, this.ledger.x, this.ledger.y) < 50) {
        this.ledger.taken = true;
        a.stage = 'return';
        a.marker = { x: this.city.sites.hideout.x, y: this.city.sites.hideout.y + 100 };
        this.world.toast('Ledger secured — bring it home!');
      } else if (a.stage === 'return' && dist(p.x, p.y, a.marker.x, a.marker.y) < 70) {
        this.complete();
      }
    }
  }

  complete() {
    const a = this.active;
    if (!a) return;
    this.done[a.id] = true;
    this.entities.player.money += a.def.reward;
    this.world.toast(`${a.def.name} complete! +$${a.def.reward}`);
    this.world.audio.play('win');
    this.world.objective = 'All clear. Pick your next job from the menu (M).';
    this.active = null;
    this.enemies = [];
    this.courier = null;
    this.ledger = null;
    this.world.saveGame();
  }

  fail(reason) {
    const a = this.active;
    if (!a) return;
    this.world.toast(`${a.def.name} failed — ${reason}`);
    this.world.audio.play('fail');
    this.active = null;
    this.enemies = [];
    if (this.courier) {
      this.entities.cars = this.entities.cars.filter((c) => c !== this.courier);
      this.courier = null;
    }
    this.ledger = null;
    this.world.objective = 'Job failed. Try again from the menu (M).';
  }

  // ---- taxi side job ----

  startTaxi() {
    if (this.taxi || this.entities.player.inCar === null) return false;
    const rng = this.entities.rng;
    const stand = this.city.sites.taxiStand;
    const ped = {
      id: 8000 + Math.floor(rng() * 1000),
      x: stand.x + 20, y: stand.y + 20,
      angle: 0, speed: 0, color: '#f1c40f', hp: 100,
      target: null, flee: 0, dead: false, walkPhase: 0, fare: true,
    };
    this.entities.peds.push(ped);
    const dest = this.city.randomIntersection(rng);
    this.taxi = { stage: 'pickup', ped, dest, timer: 100, fare: 0 };
    this.world.toast('Taxi fare waiting at the stand — pick them up!');
    return true;
  }

  updateTaxi(dt) {
    const t = this.taxi;
    if (!t) return;
    const p = this.entities.player;
    t.timer -= dt;
    if (t.timer <= 0) {
      this.world.toast('Fare gave up and walked away.');
      this.taxi = null;
      return;
    }
    if (t.stage === 'pickup') {
      if (p.inCar && dist(p.x, p.y, t.ped.x, t.ped.y) < 60) {
        t.stage = 'dropoff';
        t.timer = 120;
        t.ped.dead = true; // they are in the cab now
        this.world.toast('Fare aboard — drive to the marker!');
      }
    } else if (t.stage === 'dropoff') {
      if (p.inCar && dist(p.x, p.y, t.dest.x, t.dest.y) < 60) {
        const timeBonus = Math.max(0, Math.floor(t.timer));
        const fare = Math.round(REWARDS.taxiBase + timeBonus * 1.5);
        p.money += fare;
        this.world.toast(`Fare paid! +$${fare}`);
        this.world.audio.play('win');
        this.taxi = null;
      }
    }
  }
}
