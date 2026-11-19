// Entities: the player, cars (parked, traffic, police) and pedestrians.
// One rule keeps the streets honest: a car only ever drives itself when it
// has a traffic driver. Parked cars never move, and the player's car only
// moves while the player is in it.

import { CAR_LENGTH, CAR_WIDTH, CAR_MODELS, PED_COLORS, WALK_SPEED, RUN_SPEED, PLAYER_RADIUS, PLAYER_MAX_HP } from './config.js';
import { mulberry32, range, int, pick, clamp, angleDiff, dist } from './random.js';

let nextCarId = 1;
let nextPedId = 1;

export function makeCar(x, y, angle, model, color, kind) {
  return {
    id: nextCarId++,
    x, y, angle,
    speed: 0,
    model, color,
    kind, // 'parked' | 'traffic' | 'police' | 'player'
    hp: 100,
    driver: kind === 'traffic' ? 'traffic' : null,
    target: null, // traffic: {x, y} intersection to drive to
    wait: 0,
    horn: 0,
    dead: false,
  };
}

export function makePed(x, y, rng) {
  return {
    id: nextPedId++,
    x, y,
    angle: range(rng, 0, Math.PI * 2),
    speed: range(rng, 40, 80),
    color: pick(rng, PED_COLORS),
    hp: 100,
    target: null,
    flee: 0,
    dead: false,
    walkPhase: range(rng, 0, Math.PI * 2),
  };
}

export class Entities {
  constructor(city, seed) {
    this.city = city;
    this.rng = mulberry32(seed + 77);
    this.cars = [];
    this.peds = [];
    this.player = {
      x: city.sites.hideout.x,
      y: city.sites.hideout.y + 100,
      angle: -Math.PI / 2,
      hp: PLAYER_MAX_HP,
      money: 250,
      ammo: 24,
      inCar: null,
      onFoot: true,
      speed: 0,
      dead: false,
    };
    this.spawnCars();
    this.spawnPeds(46);
  }

  spawnCars() {
    const rng = this.rng;
    // Parked cars in the bays: no driver, never self-driving.
    const bays = this.city.parkingSpots.slice();
    for (let i = 0; i < Math.min(22, bays.length); i++) {
      const bay = bays[i];
      const model = pick(rng, CAR_MODELS.filter((m) => m.kind !== 'taxi'));
      this.cars.push(makeCar(bay.x, bay.y, bay.angle, model, pick(rng, model.colors), 'parked'));
    }
    // Traffic cars on the roads.
    for (let i = 0; i < 16; i++) {
      const p = this.city.randomRoadPoint(rng);
      const model = pick(rng, CAR_MODELS.filter((m) => m.kind !== 'taxi'));
      const car = makeCar(p.x, p.y, range(rng, 0, Math.PI * 2), model, pick(rng, model.colors), 'traffic');
      car.target = this.city.randomIntersection(rng);
      this.cars.push(car);
    }
    // One taxi cruising.
    const tp = this.city.randomRoadPoint(rng);
    const taxiModel = CAR_MODELS.find((m) => m.kind === 'taxi');
    const taxi = makeCar(tp.x, tp.y, 0, taxiModel, '#f2c200', 'traffic');
    taxi.isTaxi = true;
    taxi.target = this.city.randomIntersection(rng);
    this.cars.push(taxi);
  }

  spawnPeds(n) {
    for (let i = 0; i < n; i++) {
      const p = this.city.randomRoadPoint(this.rng);
      const ped = makePed(p.x, p.y, this.rng);
      // Keep peds on the sidewalk edge of the road, not in the middle.
      const rp = this.city.nearestRoadPoint(p.x, p.y);
      ped.x = rp.x + range(this.rng, -30, 30);
      ped.y = rp.y + range(this.rng, -30, 30);
      this.peds.push(ped);
    }
  }

  spawnPolice(x, y) {
    const model = { name: 'Interceptor', kind: 'police', top: 480, accel: 460, grip: 2.8, colors: ['#1d3557'] };
    const car = makeCar(x, y, 0, model, '#1d3557', 'police');
    car.driver = 'police';
    this.cars.push(car);
    return car;
  }

  nearestParkedCar(x, y, maxDist = 70) {
    let best = null;
    let bestD = maxDist;
    for (const car of this.cars) {
      if (car.kind !== 'parked' || car.dead) continue;
      const d = dist(x, y, car.x, car.y);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    return best;
  }

  // ---- per-frame updates ----

  updatePlayer(dt, input, world) {
    const p = this.player;
    if (p.dead) return;
    if (p.inCar) {
      this.updateDriving(dt, input, world);
      return;
    }
    // On foot: WASD / arrows, Shift to run.
    const ax = input.axis('KeyA', 'KeyD') + input.axis('ArrowLeft', 'ArrowRight');
    const ay = input.axis('KeyW', 'KeyS') + input.axis('ArrowUp', 'ArrowDown');
    const running = input.down('ShiftLeft') || input.down('ShiftRight');
    const speed = running ? RUN_SPEED : WALK_SPEED;
    const len = Math.hypot(ax, ay);
    if (len > 0) {
      const nx = ax / len;
      const ny = ay / len;
      p.x += nx * speed * dt;
      p.y += ny * speed * dt;
      p.angle = Math.atan2(ny, nx);
      p.speed = speed;
    } else {
      p.speed = 0;
    }
    const fixed = this.city.resolveCircle(p.x, p.y, PLAYER_RADIUS);
    p.x = clamp(fixed.x, 20, this.city.size - 20);
    p.y = clamp(fixed.y, 20, this.city.size - 20);
  }

  updateDriving(dt, input, world) {
    const p = this.player;
    const car = p.inCar;
    if (!car) return;
    const throttle = input.axis('KeyS', 'KeyW') + input.axis('ArrowDown', 'ArrowUp');
    const steer = input.axis('KeyA', 'KeyD') + input.axis('ArrowLeft', 'ArrowRight');
    const handbrake = input.down('Space');
    const m = car.model;
    if (throttle !== 0) {
      car.speed += throttle * m.accel * dt;
    } else {
      car.speed -= Math.sign(car.speed) * 260 * dt;
      if (Math.abs(car.speed) < 12) car.speed = 0;
    }
    if (handbrake) car.speed *= Math.max(0, 1 - 3.2 * dt);
    car.speed = clamp(car.speed, -m.top * 0.45, m.top);
    const turnRate = m.grip * clamp(Math.abs(car.speed) / 220, 0, 1) * (car.speed >= 0 ? 1 : -1);
    car.angle += steer * turnRate * dt;
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    // Building collision: slide along the wall, lose speed. The collision
    // circle is the car's half-width, not its length — a car must be able
    // to drive a road whose buildings stand 25 px back from the kerb.
    const fixed = this.city.resolveCircle(nx, ny, CAR_LENGTH * 0.34);
    if (fixed.x !== nx || fixed.y !== ny) {
      car.speed *= 0.55;
      car.hp = Math.max(0, car.hp - Math.abs(car.speed) * 0.02);
      world.addShake(Math.min(6, Math.abs(car.speed) * 0.01));
    }
    car.x = clamp(fixed.x, 24, this.city.size - 24);
    car.y = clamp(fixed.y, 24, this.city.size - 24);
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    p.speed = Math.abs(car.speed);
    // Car-to-car bumps.
    for (const other of this.cars) {
      if (other === car || other.dead) continue;
      const d = dist(car.x, car.y, other.x, other.y);
      if (d < CAR_LENGTH * 0.8 && d > 0.01) {
        const push = (CAR_LENGTH * 0.8 - d) / 2;
        const ux = (car.x - other.x) / d;
        const uy = (car.y - other.y) / d;
        car.x += ux * push;
        car.y += uy * push;
        if (other.kind === 'traffic' || other.kind === 'parked') {
          other.x -= ux * push;
          other.y -= uy * push;
        }
        if (Math.abs(car.speed) > 180) {
          car.hp = Math.max(0, car.hp - 3);
          other.hp = Math.max(0, other.hp - 4);
          world.addShake(4);
          world.particles.burst(car.x, car.y, '#ffd166', 8);
        }
        car.speed *= 0.82;
      }
    }
  }

  updateTraffic(dt, world) {
    for (const car of this.cars) {
      if (car.kind !== 'traffic' || car.dead) continue;
      if (car.driver !== 'traffic') continue; // only traffic-driven cars drive
      if (car.wait > 0) {
        car.wait -= dt;
        continue;
      }
      if (!car.target) car.target = this.city.randomIntersection(this.rng);
      const d = dist(car.x, car.y, car.target.x, car.target.y);
      if (d < 30) {
        car.target = this.city.randomIntersection(this.rng);
        if (this.rng() < 0.25) car.wait = range(this.rng, 0.5, 2);
        continue;
      }
      const want = Math.atan2(car.target.y - car.y, car.target.x - car.x);
      const diff = angleDiff(car.angle, want);
      car.angle += clamp(diff, -1.9 * dt, 1.9 * dt);
      const cruise = car.model.top * 0.42;
      car.speed += (cruise - car.speed) * Math.min(1, dt * 1.2);
      const nx = car.x + Math.cos(car.angle) * car.speed * dt;
      const ny = car.y + Math.sin(car.angle) * car.speed * dt;
      // Traffic stays on roads: if the next step leaves the road, retarget.
      if (!this.city.isRoad(nx, ny)) {
        car.target = this.city.randomIntersection(this.rng);
        car.angle += Math.PI / 2;
        continue;
      }
      const fixed = this.city.resolveCircle(nx, ny, CAR_LENGTH * 0.4);
      car.x = fixed.x;
      car.y = fixed.y;
      // Avoid rear-ending the car ahead.
      for (const other of this.cars) {
        if (other === car || other.dead) continue;
        const od = dist(car.x, car.y, other.x, other.y);
        if (od < CAR_LENGTH * 0.9) {
          car.speed *= 0.5;
          break;
        }
      }
    }
  }

  updatePolice(dt, world) {
    const p = this.player;
    for (const car of this.cars) {
      if (car.kind !== 'police' || car.dead) continue;
      const d = dist(car.x, car.y, p.x, p.y);
      if (d > 1400) {
        // Too far away: the unit gives up and leaves.
        car.dead = true;
        continue;
      }
      const want = Math.atan2(p.y - car.y, p.x - car.x);
      const diff = angleDiff(car.angle, want);
      car.angle += clamp(diff, -2.6 * dt, 2.6 * dt);
      // Police top speed is deliberately below the player's best cars.
      const cruise = Math.min(car.model.top, 500);
      car.speed += (cruise - car.speed) * Math.min(1, dt * 1.4);
      const nx = car.x + Math.cos(car.angle) * car.speed * dt;
      const ny = car.y + Math.sin(car.angle) * car.speed * dt;
      if (!this.city.isRoad(nx, ny)) {
        car.angle += Math.PI * 0.7;
        continue;
      }
      const fixed = this.city.resolveCircle(nx, ny, CAR_LENGTH * 0.4);
      car.x = fixed.x;
      car.y = fixed.y;
      // Ram the player: damage on contact, worse on foot.
      if (d < CAR_LENGTH * 0.75) {
        if (p.inCar) {
          p.inCar.hp = Math.max(0, p.inCar.hp - 9 * dt);
          world.addShake(3);
        } else {
          p.hp = Math.max(0, p.hp - 3 * dt * 60 * 0.16);
          world.addShake(5);
        }
        car.speed *= 0.6;
      }
    }
    this.cars = this.cars.filter((c) => !c.dead || c.kind === 'parked');
  }

  updatePeds(dt, world) {
    for (const ped of this.peds) {
      if (ped.dead) continue;
      if (ped.flee > 0) {
        ped.flee -= dt;
        ped.x += Math.cos(ped.angle) * 150 * dt;
        ped.y += Math.sin(ped.angle) * 150 * dt;
      } else {
        if (!ped.target || dist(ped.x, ped.y, ped.target.x, ped.target.y) < 24) {
          const p = this.city.randomRoadPoint(this.rng);
          ped.target = this.city.nearestRoadPoint(p.x, p.y);
        }
        const want = Math.atan2(ped.target.y - ped.y, ped.target.x - ped.x);
        ped.angle += clamp(angleDiff(ped.angle, want), -3 * dt, 3 * dt);
        ped.x += Math.cos(ped.angle) * ped.speed * dt;
        ped.y += Math.sin(ped.angle) * ped.speed * dt;
      }
      ped.walkPhase += dt * 6;
      const fixed = this.city.resolveCircle(ped.x, ped.y, 12);
      ped.x = clamp(fixed.x, 16, this.city.size - 16);
      ped.y = clamp(fixed.y, 16, this.city.size - 16);
      // A speeding car hits a ped: the ped goes down, wanted rises.
      // Traffic never does this — only the player, the police and the
      // courier, so the sidewalks do not empty themselves.
      for (const car of this.cars) {
        if (car.dead) continue;
        if (car.kind === 'parked' || car.kind === 'traffic') continue;
        if (Math.abs(car.speed) < 60) continue;
        if (dist(ped.x, ped.y, car.x, car.y) < 34) {
          ped.dead = true;
          world.onPedHit(car);
          break;
        }
      }
    }
    this.peds = this.peds.filter((p) => !p.dead);
    while (this.peds.length < 40) {
      const p = this.city.randomRoadPoint(this.rng);
      const ped = makePed(p.x, p.y, this.rng);
      this.peds.push(ped);
    }
  }

  // Steal / enter the nearest parked car, or get out of the current one.
  tryEnterExitCar(world) {
    const p = this.player;
    if (p.inCar) {
      const car = p.inCar;
      car.kind = 'parked';
      car.driver = null;
      car.speed = 0;
      // Step out beside the car.
      const side = car.angle + Math.PI / 2;
      p.x = car.x + Math.cos(side) * 44;
      p.y = car.y + Math.sin(side) * 44;
      const fixed = this.city.resolveCircle(p.x, p.y, PLAYER_RADIUS);
      p.x = fixed.x;
      p.y = fixed.y;
      p.inCar = null;
      p.onFoot = true;
      world.toast('Out of the car');
      return true;
    }
    const car = this.nearestParkedCar(p.x, p.y, 76);
    if (!car) return false;
    car.kind = 'player';
    car.driver = 'player';
    p.inCar = car;
    p.onFoot = false;
    world.toast(`Took the ${car.model.name}`);
    world.raiseWanted(1, 'stole a car');
    return true;
  }
}
