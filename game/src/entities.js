// Entity factories and motion: the player, cars, pedestrians, bullets and
// particles. Each factory returns a plain object; world.js drives them.
import { TUNE, COLORS } from './config.js';

let nextId = 1;

export function makePlayer(x, y) {
  return {
    id: nextId++, kind: 'player',
    x, y, angle: -Math.PI / 2, radius: TUNE.playerRadius,
    hp: TUNE.playerHp, maxHp: TUNE.playerHp,
    money: 0, mag: TUNE.pistolMag, ammo: TUNE.pistolReserveStart,
    car: null, speed: 0, moving: false,
    punchCooldown: 0, fireCooldown: 0, hurtAt: -99, lastDamageAt: -99,
    dead: false,
  };
}

// kind: sedan | taxi | police | van | getaway. angle in radians.
export function makeCar(kind, x, y, angle) {
  const palette = {
    sedan: ['#c25e3a', '#3a7fc2', '#7fae3a', '#8a5fc2', '#e8e8e8'],
    taxi: [COLORS.taxi],
    police: [COLORS.police],
    van: ['#8f8f8f', '#6e7f92'],
    getaway: ['#c22f2f'],
  };
  const colors = palette[kind] || palette.sedan;
  return {
    id: nextId++, kind: 'car', carKind: kind,
    x, y, angle: angle || 0, radius: TUNE.carRadius,
    color: colors[Math.floor(Math.random() * colors.length)],
    speed: 0, hp: 100, maxHp: 100,
    driver: kind === 'police' ? 'police' : (kind === 'taxi' ? 'traffic' : null),
    dead: false, stuckAt: 0, stuckTime: 0, sirenPhase: Math.random() * 6,
    targetAngle: angle || 0, waitAt: 0,
  };
}

// kind: walker | viper | cop | mara | fare.
export function makePed(kind, x, y) {
  const base = {
    id: nextId++, kind: 'ped', pedKind: kind,
    x, y, angle: Math.random() * Math.PI * 2, radius: 13,
    hp: kind === 'viper' ? TUNE.viperHp : 100,
    speed: kind === 'viper' ? TUNE.viperSpeed : kind === 'cop' ? TUNE.copSpeed : 55,
    state: kind, // walker | viper | cop | mara | fare | down | fleeing
    color: kind === 'viper' ? COLORS.viper : kind === 'cop' ? COLORS.cop
      : kind === 'mara' ? COLORS.mara : COLORS.ped[Math.floor(Math.random() * COLORS.ped.length)],
    fireCooldown: 0, wanderAngle: Math.random() * Math.PI * 2, wanderAt: 0,
    dead: false, downAt: 0,
  };
  return base;
}

export function makeBullet(x, y, angle, owner, damage) {
  return {
    id: nextId++, kind: 'bullet',
    x, y, angle, owner, damage,
    speed: TUNE.bulletSpeed, travelled: 0, range: TUNE.pistolRange,
    dead: false,
  };
}

export function makeParticle(x, y, color, count, speed) {
  const parts = [];
  for (let i = 0; i < count; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.4 + Math.random() * 0.6);
    parts.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: 0.35 + Math.random() * 0.3, maxLife: 0.65, color,
    });
  }
  return parts;
}

// Drive a car one step: throttle -1..1, steer -1..1, with slidey arcade grip.
export function stepCarPhysics(car, dt, throttle, steer) {
  const max = car.carKind === 'police' ? TUNE.policeMaxSpeed : TUNE.carMaxSpeed;
  if (throttle > 0) car.speed += TUNE.carAccel * throttle * dt;
  else if (throttle < 0) car.speed += TUNE.carAccel * 0.55 * throttle * dt;
  else {
    const drag = 260 * dt;
    car.speed = Math.abs(car.speed) <= drag ? 0 : car.speed - Math.sign(car.speed) * drag;
  }
  car.speed = Math.max(-TUNE.carReverse, Math.min(max, car.speed));
  const grip = Math.min(1, Math.abs(car.speed) / 120);
  car.angle += steer * TUNE.carTurn * grip * dt * (car.speed >= 0 ? 1 : -1);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
}

// Walk a pedestrian one step toward a heading, with a speed in px/s.
export function stepPedWalk(ped, dt, heading, speed) {
  ped.angle = heading;
  ped.x += Math.cos(heading) * speed * dt;
  ped.y += Math.sin(heading) * speed * dt;
}
