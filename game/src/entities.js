// SOLMAR STREETS — the things that move: cars, pedestrians, bullets,
// particles and pickups. One clear job: build them and answer the small
// geometry questions the simulation asks every frame.

import { CAR_MODELS, PED_SHIRTS, PED_SKINS } from './config.js';

let nextId = 1;

export function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Squared distance: cheaper than distance() when only a comparison is needed. */
export function distanceSq(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

export function angleTo(a, b) {
  return Math.atan2(b.y - a.y, b.x - a.x);
}

/** Shortest signed turn from angle a to angle b, in (-PI, PI]. */
export function angleDelta(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d <= -Math.PI) d += Math.PI * 2;
  return d;
}

export function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

/** A car. kind: parked | traffic | police | player. */
export function createCar(model, x, y, angle, kind, rng) {
  const def = CAR_MODELS[model];
  return {
    id: nextId++,
    kind: 'car',
    model,
    name: def.name,
    x, y, angle,
    speed: 0,
    cruise: rng ? rng.range(def.top * 0.45, def.top * 0.65) : def.top * 0.55,
    hp: def.hp,
    maxHp: def.hp,
    color: rng ? rng.pick(def.colors) : def.colors[0],
    driver: kind, // parked | traffic | police | player
    axis: 'v',
    road: 0,
    dir: 1,
    dead: false,
    wreckT: 0,
    dmgCd: 0, // brief immunity between collision hits, so one grind is one hit
    ramCd: 0, // police only: time until this cruiser can ram again
    flash: 0, // police light-bar phase, 0..1
    siren: 0,
  };
}

/** A pedestrian. state: walk | flee | fare | viper | down. */
export function createPed(x, y, rng, state = 'walk') {
  return {
    id: nextId++,
    kind: 'ped',
    x, y,
    angle: rng ? rng.range(0, Math.PI * 2) : 0,
    speed: rng ? rng.range(35, 60) : 45,
    state,
    hp: 100,
    shirt: rng ? rng.pick(PED_SHIRTS) : '#4b7dd9',
    skin: rng ? rng.pick(PED_SKINS) : '#e8b98a',
    fireCd: rng ? rng.range(0, 1) : 0,
    hitCd: 0,
    walkT: 0,
    walkPhase: rng ? rng.range(0, Math.PI * 2) : 0, // walk-bob phase, so no two peds bob together
    axis: rng && rng.chance(0.5) ? 'v' : 'h',
    road: 0,
    dir: rng && rng.chance(0.5) ? 1 : -1,
  };
}

/** True when this pedestrian is one of the Viper crew (dark red shirt). */
export function isViper(ped) {
  return ped.state === 'viper' || ped.shirt === '#7d2b2b';
}

/** True when this car is an SPPD cruiser on duty. */
export function isPoliceCar(car) {
  return car.driver === 'police' || car.model === 'police';
}

/** True when this car is the one the player is driving. */
export function isPlayerCar(world, car) {
  return !!world.player.car && world.player.car === car;
}

/** The nearest pedestrian to a point, within maxDist — or null. */
export function nearestPed(peds, x, y, maxDist = 90) {
  let best = null;
  let bestD = maxDist * maxDist;
  for (const ped of peds) {
    if (ped.state === 'down') continue;
    const d = distanceSq(ped, { x, y });
    if (d < bestD) {
      bestD = d;
      best = ped;
    }
  }
  return best;
}

/** The nearest living Viper to a point, within maxDist — or null. */
export function nearestViper(peds, x, y, maxDist = 600) {
  let best = null;
  let bestD = maxDist * maxDist;
  for (const ped of peds) {
    if (!isViper(ped) || ped.state === 'down') continue;
    const d = distanceSq(ped, { x, y });
    if (d < bestD) {
      bestD = d;
      best = ped;
    }
  }
  return best;
}

/** A bullet. from: 'player' | 'viper'. */
export function createBullet(x, y, angle, from, dmg) {
  return {
    kind: 'bullet',
    x, y,
    vx: Math.cos(angle) * 720,
    vy: Math.sin(angle) * 720,
    life: 0.8,
    from,
    dmg,
  };
}

/** A short-lived visual effect: spark, smoke, blood, muzzle, explosion. */
export function createParticle(x, y, vx, vy, life, color, size) {
  return { kind: 'particle', x, y, vx, vy, life, maxLife: life, color, size };
}

export function burst(particles, x, y, count, color, speed, life, size) {
  for (let i = 0; i < count; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.4 + Math.random() * 0.6);
    particles.push(createParticle(x, y, Math.cos(a) * s, Math.sin(a) * s, life * (0.6 + Math.random() * 0.6), color, size * (0.7 + Math.random() * 0.6)));
  }
}

/** The full fireball of a car blowing up: flame, smoke and bright flash. */
export function createExplosion(particles, x, y) {
  burst(particles, x, y, 26, '#ff7a2a', 260, 0.9, 5);
  burst(particles, x, y, 18, '#3a3a3a', 120, 1.6, 7);
  burst(particles, x, y, 10, '#ffd23f', 320, 0.4, 4);
}

/** A puff of grey smoke that drifts up and fades, for wrecks and exhaust. */
export function createSmoke(particles, x, y, count = 4) {
  for (let i = 0; i < count; i += 1) {
    particles.push(createParticle(x + (Math.random() - 0.5) * 12, y + (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 20, -30 - Math.random() * 30, 1.1 + Math.random() * 0.5, '#8a8a8a', 5 + Math.random() * 4));
  }
}

/** A skid mark segment, for handbrake slides. */
export function createSkid(x1, y1, x2, y2) {
  return { x1, y1, x2, y2, t: 0 };
}

/** A pickup on the ground: cash, health or ammo. */
export function createPickup(x, y, kind, amount) {
  return { kind: 'pickup', pickupKind: kind, x, y, amount, bob: Math.random() * Math.PI * 2 };
}

/** True when a car is effectively parked: slow enough to steal quietly. */
export function isCarStopped(car) {
  return Math.abs(car.speed) < 5;
}

/** True when a car is a burnt-out wreck (exploded, still smoking). */
export function isWreck(car) {
  return !!car.dead;
}

/** The nearest car to a point, within maxDist — or null. */
export function nearestCar(cars, x, y, maxDist = 90) {
  let best = null;
  let bestD = maxDist * maxDist;
  for (const car of cars) {
    const d = distanceSq(car, { x, y });
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}
