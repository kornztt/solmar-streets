// SOLMAR STREETS — the simulation: the player, traffic, police, the
// wanted level, bullets, pickups and the camera. One clear job: advance
// the world one fixed step, given the input.

import { CAR_MODELS, PICKUP_KINDS, PLACES, ROADS, TUNING, VIEW, WORLD } from './config.js';
import { createCity, hitsCity, isOnRoad, laneOffset, nearestRoadPoint, randomRoadPoint, resolveCityCollision } from './city.js';
import { createRandom } from './random.js';
import { angleDelta, angleTo, burst, clamp, createBullet, createCar, createExplosion, createParticle, createPed, createPickup, createSkid, distance, distanceSq, isPoliceCar, isViper } from './entities.js';
import { beginMission, createFareState, createMissionState, currentObjective, maybeOfferFare, nextJobId, offerMission, updateFare, updateMissions, viperKilled } from './missions.js';
import { saveGame, saveStats } from './save.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const STEP = 1 / 60;
const CAR_RADIUS = 20;

function policeCars(world) {
  return world.police.filter((c) => !c.dead);
}

export function addWanted(world, n) {
  world.wanted = clamp(world.wanted + n, 0, 5);
  world.crimeTimer = TUNING.wantedDecayDelay;
  world.decayTimer = 0;
}

export function spawnPolice(world, n) {
  for (let i = 0; i < n; i += 1) {
    let spot = null;
    for (let t = 0; t < 10; t += 1) {
      const p = randomRoadPoint(world.rng);
      const d = distance(p, world.player);
      if (d > 520 && d < 900) { spot = p; break; }
    }
    if (!spot) spot = randomRoadPoint(world.rng);
    const car = createCar('police', spot.x, spot.y, world.rng.range(0, Math.PI * 2), 'police', world.rng);
    car.axis = spot.axis;
    car.road = spot.road;
    car.dir = 1;
    car.speed = car.cruise;
    world.cars.push(car);
    world.police.push(car);
  }
}

function explodeCar(world, car) {
  if (car.dead) return;
  car.dead = true;
  car.wreckT = 0;
  createExplosion(world.particles, car.x, car.y);
  world.events.push('explosion');
  if (car === world.player.car) {
    // The player's ride just blew up under them.
    world.player.car = null;
    world.player.hp -= 20;
    world.player.x = car.x + 40;
    world.player.y = car.y;
    world.toasts.push({ text: 'Your car blew up!', t: 0 });
  }
  for (const ped of world.peds) {
    if (ped.state !== 'viper' && distance(ped, car) < 220) ped.state = 'flee';
  }
}

function damageCar(world, car, dmg) {
  if (car.dead) return;
  car.hp -= dmg;
  if (car.hp <= 0) explodeCar(world, car);
}

function killPed(world, ped, byPlayer) {
  if (ped.state === 'down') return;
  const viper = isViper(ped);
  ped.state = 'down';
  burst(world.particles, ped.x, ped.y, 12, '#c0392b', 140, 0.7, 4);
  if (byPlayer) {
    world.stats.kills += 1;
  }
  // A dead viper counts toward the takedown however it died — a traffic
  // car or a police ram can finish one, and the mission must not stall
  // at 4/5 because the fifth died to someone else's bumper.
  if (viper) viperKilled(world);
}

/** Build a fresh Solmar: city, traffic, pedestrians, pickups, the player. */
export function createWorld(seed) {
  const rng = createRandom(seed);
  const city = createCity(rng);
  const world = {
    seed,
    rng,
    city,
    screen: SCREEN_TITLE,
    overReason: null,
    time: 0,
    clock: 600, // 10:00 in the morning, sun high over Solmar
    player: {
      x: PLACES.hideout.x, y: PLACES.hideout.y, angle: -Math.PI / 2,
      hp: TUNING.playerHp, money: TUNING.startMoney,
      mag: TUNING.pistolMag, ammo: TUNING.startAmmo,
      car: null, punchCd: 0, fireCd: 0, reloadT: 0, hurtT: 0,
      moveX: 0, moveY: 0,
    },
    cars: [],
    police: [],
    peds: [],
    bullets: [],
    particles: [],
    pickups: [],
    skids: [],
    wanted: 0,
    crimeTimer: 0,
    decayTimer: 0,
    policeSpawnT: 0,
    shootWantedCd: 0,
    hitPedWantedCd: 0,
    hornCd: 0,
    nearMissCd: 0,
    mission: createMissionState(),
    fare: createFareState(),
    toasts: [],
    banner: null,
    prompt: null,
    events: [],
    sfxEvent: null,
    saveRequested: false,
    stats: { kills: 0, carsStolen: 0, fares: 0, missionsDone: 0, cashEarned: 0 },
    camera: { x: PLACES.hideout.x, y: PLACES.hideout.y, zoom: 1 },
    spawnPolice: (n) => spawnPolice(world, n),
  };

  // Parked cars from the city, including the hero Comet GT.
  for (const spot of city.parked) {
    const car = createCar(spot.model, spot.x, spot.y, spot.angle, 'parked', rng);
    car.hero = !!spot.hero;
    world.cars.push(car);
  }
  // Pedestrians on the sidewalks, never spawned inside a parked car.
  for (let i = 0; i < TUNING.pedCount; i += 1) {
    let spot = randomRoadPoint(rng);
    for (let t = 0; t < 8 && world.cars.some((c) => Math.hypot(c.x - spot.x, c.y - spot.y) < 70); t += 1) {
      spot = randomRoadPoint(rng);
    }
    const ped = createPed(spot.x, spot.y, rng, 'walk');
    ped.axis = spot.axis;
    ped.road = spot.road;
    ped.dir = rng.chance(0.5) ? 1 : -1;
    // Start on the sidewalk, not in the traffic lane.
    if (ped.axis === 'v') ped.x = ped.road + (ped.dir > 0 ? 58 : -58);
    else ped.y = ped.road + (ped.dir > 0 ? 58 : -58);
    world.peds.push(ped);
  }
  // Traffic on the roads, never spawned on top of a pedestrian.
  for (let i = 0; i < TUNING.trafficCount; i += 1) {
    let spot = randomRoadPoint(rng);
    for (let t = 0; t < 8 && world.peds.some((pd) => Math.hypot(pd.x - spot.x, pd.y - spot.y) < 120); t += 1) {
      spot = randomRoadPoint(rng);
    }
    const model = rng.pick(['sedan', 'sedan', 'sedan', 'taxi', 'van', 'pickup', 'truck', 'falcon']);
    const car = createCar(model, spot.x, spot.y, spot.axis === 'v' ? Math.PI / 2 : 0, 'traffic', rng);
    car.axis = spot.axis;
    car.road = spot.road;
    car.dir = rng.chance(0.5) ? 1 : -1;
    car.angle = car.axis === 'v' ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (car.dir > 0 ? 0 : Math.PI);
    car.speed = car.cruise;
    world.cars.push(car);
  }
  // Pickups scattered around town.
  for (const kind of PICKUP_KINDS) {
    const spot = randomRoadPoint(rng);
    world.pickups.push(createPickup(spot.x + rng.range(-60, 60), spot.y + rng.range(-60, 60), kind, kind === 'cash' ? rng.int(25, 60) : kind === 'health' ? 30 : 12));
  }
  return world;
}

/** Start a run: fresh defaults, or a loaded save applied on top. */
export function startRun(world, saveData) {
  // A new run starts clean: no leftover cruisers from the last one.
  for (const cop of [...world.police]) {
    const i = world.cars.indexOf(cop);
    if (i >= 0) world.cars.splice(i, 1);
  }
  world.police = [];
  const p = world.player;
  p.x = PLACES.hideout.x;
  p.y = PLACES.hideout.y;
  p.angle = -Math.PI / 2;
  p.hp = TUNING.playerHp;
  p.money = TUNING.startMoney;
  p.mag = TUNING.pistolMag;
  p.ammo = TUNING.startAmmo;
  p.car = null;
  world.wanted = 0;
  world.crimeTimer = 0;
  world.hornCd = 0;
  world.nearMissCd = 0;
  world.mission = createMissionState();
  world.fare = createFareState();
  world.stats = { kills: 0, carsStolen: 0, fares: 0, missionsDone: 0, cashEarned: 0 };
  world.toasts = [];
  world.banner = null;
  world.time = 0;
  world.clock = 600;
  if (saveData) {
    p.money = saveData.money;
    p.ammo = saveData.ammo;
    p.hp = saveData.hp;
    p.x = saveData.x;
    p.y = saveData.y;
    world.mission.done = saveData.missionsDone || {};
    world.mission.next = saveData.next || 'm1';
    world.stats = { ...world.stats, ...(saveData.stats || {}) };
    world.time = saveData.time || 0;
    world.clock = saveData.clock || 600;
    world.toasts.push({ text: 'Save loaded — welcome back to Solmar', t: 0 });
  } else {
    world.toasts.push({ text: 'Mara has work at the hideout — follow the M marker', t: 0 });
  }
  world.camera.x = p.x;
  world.camera.y = p.y;
  world.screen = SCREEN_PLAY;
}

function nearestCar(world, x, y, maxD) {
  let best = null;
  let bestD = maxD;
  for (const car of world.cars) {
    if (car.dead) continue;
    const d = distance({ x, y }, car);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

function stepPlayerOnFoot(world, input, dt, mouseWorld) {
  const p = world.player;
  const mv = input.moveVector ? input.moveVector : { x: 0, y: 0 };
  const run = input.keys.has('ShiftLeft') || input.keys.has('ShiftRight');
  const speed = run ? TUNING.runSpeed : TUNING.walkSpeed;
  const moving = mv.x !== 0 || mv.y !== 0;
  p.moveX = mv.x;
  p.moveY = mv.y;
  if (moving) {
    p.x += mv.x * speed * dt;
    p.y += mv.y * speed * dt;
    // Face where the player is going, unless they are aiming.
    if (!input.mouseDown && p.fireCd <= 0.05) p.angle = Math.atan2(mv.y, mv.x);
  }
  const solved = resolveCityCollision(world.city, p.x, p.y, TUNING.playerRadius);
  p.x = solved.x;
  p.y = solved.y;
  // Aim at the mouse while firing.
  if (input.mouseDown || p.fireCd > 0) p.angle = angleTo(p, mouseWorld);
  p.punchCd -= dt;
  p.fireCd -= dt;
  p.reloadT -= dt;
  p.hurtT -= dt;

  // Punch: a close arc in front of the player.
  if (input.punchPressed && p.punchCd <= 0) {
    p.punchCd = TUNING.punchRate;
    world.events.push('punch');
    for (const ped of world.peds) {
      if (ped.state === 'down') continue;
      const d = distance(p, ped);
      if (d < TUNING.punchRange && Math.abs(angleDelta(p.angle, angleTo(p, ped))) < 1.1) {
        ped.hp -= TUNING.punchDamage;
        ped.x += Math.cos(p.angle) * 26;
        ped.y += Math.sin(p.angle) * 26;
        burst(world.particles, ped.x, ped.y, 6, '#ffd23f', 120, 0.4, 3);
        if (ped.hp <= 0) killPed(world, ped, true);
        else if (ped.state === 'viper') { /* vipers fight back */ }
        else ped.state = 'flee';
      }
    }
  }
  // Shoot: the pistol, aimed at the mouse.
  if (input.mouseDown && p.fireCd <= 0 && p.reloadT <= 0) {
    if (p.mag > 0) {
      p.mag -= 1;
      p.fireCd = TUNING.pistolFireRate;
      const a = angleTo(p, mouseWorld);
      world.bullets.push(createBullet(p.x + Math.cos(a) * 16, p.y + Math.sin(a) * 16, a, 'player', TUNING.pistolDamage));
      world.particles.push(createParticle(p.x + Math.cos(a) * 20, p.y + Math.sin(a) * 20, Math.cos(a) * 60, Math.sin(a) * 60, 0.08, '#ffd23f', 5));
      world.events.push('shot');
      if (world.shootWantedCd <= 0) {
        addWanted(world, 1);
        world.shootWantedCd = 4;
      }
      for (const ped of world.peds) {
        if (ped.state !== 'viper' && distance(p, ped) < 260) ped.state = 'flee';
      }
    } else {
      p.fireCd = 0.3;
      world.events.push('click');
    }
  }
  if (input.reloadPressed && p.reloadT <= 0 && p.mag < TUNING.pistolMag && p.ammo > 0) {
    const need = TUNING.pistolMag - p.mag;
    const take = Math.min(need, p.ammo);
    p.ammo -= take;
    p.mag += take;
    p.reloadT = 0.8;
    world.events.push('reload');
  }
}

function stepPlayerDriving(world, input, dt) {
  const p = world.player;
  const car = p.car;
  if (!car || car.dead) { p.car = null; return; }
  const def = CAR_MODELS[car.model];
  const mv = input.moveVector ? input.moveVector : { x: 0, y: 0 };
  const handbrake = input.keys.has('Space');
  // H for horn: a honk makes nearby pedestrians step out of the way.
  if (input.hornPressed && world.hornCd <= 0) {
    world.hornCd = TUNING.hornCooldown;
    world.events.push('horn');
    for (const ped of world.peds) {
      if (ped.state === 'walk' && distance(ped, car) < 140) {
        ped.dir = angleTo(car, ped) > 0 ? 1 : -1;
        ped.walkT = 0;
      }
    }
  }
  // mv.y is -1 for W (up) = accelerate, +1 for S = brake/reverse.
  if (mv.y < 0) car.speed += def.accel * dt;
  else if (mv.y > 0) {
    if (car.speed > 10) car.speed -= def.accel * 1.4 * dt;
    else car.speed -= def.accel * 0.5 * dt;
  } else {
    car.speed -= Math.sign(car.speed) * 90 * dt;
    if (Math.abs(car.speed) < 8) car.speed = 0;
  }
  if (handbrake) {
    car.speed -= Math.sign(car.speed) * 320 * dt;
    if (Math.abs(car.speed) < 20) car.speed = 0;
  }
  const top = def.top * (handbrake ? 0.9 : 1);
  car.speed = clamp(car.speed, -top * 0.42, top);
  // Steering: stronger at speed, stronger still with the handbrake.
  const steer = mv.x * def.turn * clamp(Math.abs(car.speed) / 120, 0, 1) * (handbrake ? 1.5 : 1);
  car.angle += steer * dt * Math.sign(car.speed || 1);
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const before = { x: car.x, y: car.y };
  const solved = resolveCityCollision(world.city, nx, ny, CAR_RADIUS);
  const hitWall = Math.abs(solved.x - nx) > 0.5 || Math.abs(solved.y - ny) > 0.5;
  if (hitWall && Math.abs(car.speed) > 150 && car.dmgCd <= 0) {
    car.dmgCd = 0.6;
    damageCar(world, car, Math.max(3, Math.round((Math.abs(car.speed) - 150) / 30)));
    burst(world.particles, solved.x, solved.y, 8, '#ffd23f', 160, 0.4, 3);
    world.events.push('crash');
  }
  if (hitWall) car.speed *= 0.45;
  car.x = solved.x;
  car.y = solved.y;
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  // Near miss: threading past a traffic car at speed, no contact, pays a
  // little cash. The game rewards driving like you mean it.
  if (Math.abs(car.speed) > TUNING.nearMissSpeed && world.nearMissCd <= 0) {
    for (const other of world.cars) {
      if (other === car || other.dead || other.driver !== 'traffic') continue;
      const d = distance(car, other);
      if (d > TUNING.nearMissMin && d < TUNING.nearMissMax) {
        world.nearMissCd = TUNING.nearMissCooldown;
        p.money += TUNING.nearMissReward;
        world.stats.cashEarned += TUNING.nearMissReward;
        world.toasts.push({ text: `Close call +$${TUNING.nearMissReward}`, t: 0 });
        world.events.push('nearMiss');
        break;
      }
    }
  }
  if (handbrake && Math.abs(car.speed) > 120) {
    world.skids.push(createSkid(before.x, before.y, car.x, car.y));
    if (world.skids.length > 220) world.skids.shift();
    if (world.rng.chance(0.5)) {
      world.particles.push(createParticle(car.x - Math.cos(car.angle) * 20, car.y - Math.sin(car.angle) * 20, 0, 0, 0.5, '#cfcfcf', 3));
    }
  }
  // Slow health regen while driving is not a thing; cars take the hits.
  p.fireCd -= dt;
  p.hurtT -= dt;
}

function stepTraffic(world, dt) {
  for (const car of world.cars) {
    if (car.driver !== 'traffic' || car.dead) continue;
    const def = CAR_MODELS[car.model];
    // Slow down for a car ahead in the same lane.
    let blocked = false;
    for (const other of world.cars) {
      if (other === car || other.dead) continue;
      const dx = other.x - car.x;
      const dy = other.y - car.y;
      const ahead = car.axis === 'v' ? dy * car.dir : dx * car.dir;
      const side = car.axis === 'v' ? Math.abs(dx) : Math.abs(dy);
      if (ahead > 0 && ahead < 85 && side < 30) { blocked = true; break; }
    }
    const target = blocked ? 0 : car.cruise;
    car.speed += clamp(target - car.speed, -260 * dt, 200 * dt);
    // At an intersection, sometimes turn onto the crossing road.
    const onV = car.axis === 'v';
    const cross = onV ? ROADS.streets : ROADS.avenues;
    for (const c of cross) {
      const along = onV ? car.y : car.x;
      if (Math.abs(along - c) < 6 && world.rng.chance(0.22)) {
        car.axis = onV ? 'h' : 'v';
        car.road = c;
        car.dir = world.rng.chance(0.5) ? 1 : -1;
        break;
      }
    }
    const lane = laneOffset(car.axis, car.dir);
    // Steer toward the lane instead of snapping to it, so a turn at an
    // intersection reads as a turn, not a teleport.
    const laneX = car.axis === 'v' ? car.road + lane : car.x;
    const laneY = car.axis === 'h' ? car.road + lane : car.y;
    const desired = car.axis === 'v'
      ? { x: car.x + (laneX - car.x) * Math.min(1, 3 * dt), y: car.y + car.dir * car.speed * dt }
      : { x: car.x + car.dir * car.speed * dt, y: car.y + (laneY - car.y) * Math.min(1, 3 * dt) };
    car.angle += angleDelta(car.angle, Math.atan2(desired.y - car.y, desired.x - car.x)) * Math.min(1, 6 * dt);
    const solved = resolveCityCollision(world.city, desired.x, desired.y, CAR_RADIUS);
    car.x = solved.x;
    car.y = solved.y;
    if (car.x < 60 || car.x > WORLD.width - 60 || car.y < 60 || car.y > ROADS.coastalY + 40) {
      // Reached the edge of the grid: turn around on the spot.
      car.dir *= -1;
    }
  }
}

function stepPolice(world, dt) {
  const p = world.player;
  const fleeing = world.wanted === 0;
  for (const cop of policeCars(world)) {
    const def = CAR_MODELS.police;
    // Chasing: steer at the player. Heat off: steer away and leave town.
    const targetAngle = fleeing ? angleTo(p, cop) : angleTo(cop, p);
    const d = angleDelta(cop.angle, targetAngle);
    cop.angle += clamp(d, -def.turn * 1.4 * dt, def.turn * 1.4 * dt);
    const targetSpeed = fleeing ? def.top * 0.8 : (distance(cop, p) > 240 ? def.top : def.top * 0.72);
    cop.speed += clamp(targetSpeed - cop.speed, -300 * dt, 320 * dt);
    const nx = cop.x + Math.cos(cop.angle) * cop.speed * dt;
    const ny = cop.y + Math.sin(cop.angle) * cop.speed * dt;
    const solved = resolveCityCollision(world.city, nx, ny, CAR_RADIUS);
    const hitWall = Math.abs(solved.x - nx) > 0.5 || Math.abs(solved.y - ny) > 0.5;
    if (hitWall) cop.speed *= 0.5;
    cop.x = solved.x;
    cop.y = solved.y;
    cop.flash += dt * 2;
    // Ram the player: their car, or the player on foot. One hit per
    // 0.7 s per cruiser — a ram is a shove, not a shredder. Only while chasing.
    const pd = distance(cop, p);
    if (!fleeing && pd < 46) {
      if (p.car && !p.car.dead) {
        if (cop.ramCd <= 0) {
          cop.ramCd = 0.7;
          damageCar(world, p.car, TUNING.policeRamDamage);
          burst(world.particles, cop.x, cop.y, 5, '#ffd23f', 120, 0.3, 3);
          world.events.push('crash');
        }
        cop.speed *= 0.4;
      } else if (p.car === null) {
        p.hp -= 14 * dt;
        p.hurtT = 0.3;
        p.x += Math.cos(angleTo(cop, p)) * 60 * dt;
        p.y += Math.sin(angleTo(cop, p)) * 60 * dt;
        cop.speed *= 0.5;
      }
    }
  }
  // Keep the pressure on: top the force up to the wanted level.
  const want = world.wanted <= 1 ? 2 : world.wanted;
  world.policeSpawnT -= dt;
  if (world.wanted > 0 && policeCars(world).length < want && world.policeSpawnT <= 0) {
    spawnPolice(world, 1);
    world.policeSpawnT = 2;
  }
  // The heat is off: cruisers give up and leave.
  if (world.wanted === 0) {
    for (const cop of [...world.police]) {
      if (distance(cop, p) > 1100) {
        world.cars.splice(world.cars.indexOf(cop), 1);
        world.police.splice(world.police.indexOf(cop), 1);
      }
    }
  }
}

function stepPeds(world, dt) {
  const p = world.player;
  for (const ped of world.peds) {
    if (ped.state === 'down') continue;
    ped.hitCd = Math.max(0, (ped.hitCd || 0) - dt);
    if (ped.state === 'viper') {
      const d = distance(ped, p);
      if (d < TUNING.viperRange && p.hp > 0) {
        ped.angle = angleTo(ped, p);
        if (d > 220) {
          ped.x += Math.cos(ped.angle) * 90 * dt;
          ped.y += Math.sin(ped.angle) * 90 * dt;
        }
        ped.fireCd -= dt;
        if (ped.fireCd <= 0) {
          ped.fireCd = TUNING.viperFireRate * world.rng.range(0.8, 1.3);
          const a = ped.angle + world.rng.range(-0.16, 0.16);
          world.bullets.push(createBullet(ped.x, ped.y, a, 'viper', TUNING.viperDamage));
          world.events.push('shot');
        }
      } else if (d < 500) {
        ped.angle = angleTo(ped, p);
        ped.x += Math.cos(ped.angle) * 70 * dt;
        ped.y += Math.sin(ped.angle) * 70 * dt;
      }
      continue;
    }
    if (ped.state === 'flee') {
      ped.walkT -= dt;
      const a = angleTo(p, ped);
      ped.x += Math.cos(a) * 150 * dt;
      ped.y += Math.sin(a) * 150 * dt;
      const solved = resolveCityCollision(world.city, ped.x, ped.y, 9);
      ped.x = solved.x;
      ped.y = solved.y;
      if (ped.walkT <= 0) ped.state = 'walk';
      continue;
    }
    if (ped.state === 'fare') continue; // stands and waves
    // Walk the sidewalks: along a road, turning at intersections. The
    // lateral position eases toward the sidewalk line, never snaps.
    ped.walkT -= dt;
    const side = ped.axis === 'v' ? (ped.dir > 0 ? 58 : -58) : (ped.dir > 0 ? 58 : -58);
    const laneX = ped.axis === 'v' ? ped.road + side : ped.x + ped.dir * ped.speed * dt;
    const laneY = ped.axis === 'h' ? ped.road + side : ped.y + ped.dir * ped.speed * dt;
    const lane = {
      x: ped.axis === 'v' ? ped.x + (laneX - ped.x) * Math.min(1, 4 * dt) : laneX,
      y: ped.axis === 'h' ? ped.y + (laneY - ped.y) * Math.min(1, 4 * dt) : laneY,
    };
    const cross = ped.axis === 'v' ? ROADS.streets : ROADS.avenues;
    for (const c of cross) {
      const along = ped.axis === 'v' ? ped.y : ped.x;
      if (Math.abs(along - c) < 5 && world.rng.chance(0.3)) {
        ped.axis = ped.axis === 'v' ? 'h' : 'v';
        ped.road = c;
        ped.dir = world.rng.chance(0.5) ? 1 : -1;
        break;
      }
    }
    const solved = resolveCityCollision(world.city, lane.x, lane.y, 9);
    ped.x = solved.x;
    ped.y = solved.y;
    ped.angle = Math.atan2(lane.y - ped.y, lane.x - ped.x) || ped.angle;
    if (ped.walkT <= 0) {
      ped.walkT = world.rng.range(4, 9);
      if (world.rng.chance(0.25)) ped.dir *= -1;
    }
  }
}

function stepCarCollisions(world) {
  const cars = world.cars.filter((c) => !c.dead);
  for (const car of cars) {
    car.dmgCd = Math.max(0, car.dmgCd - 1 / 60);
    car.ramCd = Math.max(0, (car.ramCd || 0) - 1 / 60);
  }
  for (let i = 0; i < cars.length; i += 1) {
    for (let j = i + 1; j < cars.length; j += 1) {
      const a = cars[i];
      const b = cars[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const min = CAR_RADIUS * 2 - 4;
      const d2 = dx * dx + dy * dy;
      if (d2 > 0.01 && d2 < min * min) {
        const d = Math.sqrt(d2);
        const push = (min - d) / 2;
        const nx = dx / d;
        const ny = dy / d;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
        // Only the player's crashes (and police rams) cost health: two
        // background cars scraping each other just push apart.
        const involvesPlayer = a === world.player.car || b === world.player.car
          || isPoliceCar(a) || isPoliceCar(b);
        const rel = Math.abs(a.speed - b.speed);
        if (involvesPlayer && rel > 120) {
          for (const c of [a, b]) {
            if (c.dmgCd <= 0) {
              c.dmgCd = 0.6;
              damageCar(world, c, Math.max(3, Math.round(rel / 40)));
            }
          }
          burst(world.particles, (a.x + b.x) / 2, (a.y + b.y) / 2, 6, '#ffd23f', 140, 0.35, 3);
          world.events.push('crash');
        }
        if (a.driver === 'traffic') a.speed *= 0.6;
        if (b.driver === 'traffic') b.speed *= 0.6;
      }
    }
  }
  // Cars vs pedestrians: a fast car is a weapon, and the law notices.
  // One hit never kills: the pedestrian gets a second to get out of the way.
  const p = world.player;
  for (const car of cars) {
    if (car.speed < 140 && car.driver !== 'police') continue;
    for (const ped of world.peds) {
      if (ped.state === 'down' || (ped.hitCd || 0) > 0) continue;
      if (distance(car, ped) < 26) {
        ped.hitCd = 1;
        ped.hp -= Math.round(Math.abs(car.speed) / 6) + 10;
        ped.x += Math.cos(angleTo(car, ped)) * 30;
        ped.y += Math.sin(angleTo(car, ped)) * 30;
        const solved = resolveCityCollision(world.city, ped.x, ped.y, 9);
        ped.x = solved.x;
        ped.y = solved.y;
        burst(world.particles, ped.x, ped.y, 8, '#c0392b', 120, 0.5, 4);
        if (ped.hp <= 0) {
          killPed(world, ped, car === p.car);
          if (car === p.car && !isViper(ped) && world.hitPedWantedCd <= 0) {
            addWanted(world, 1);
            world.hitPedWantedCd = 5;
            world.toasts.push({ text: 'You hit a pedestrian!', t: 0 });
          }
        } else if (ped.state !== 'viper') {
          // Civilians scatter; vipers stand and fight — a viper that fled
          // would leave the takedown unwinnable, with no one left to count.
          ped.state = 'flee';
          ped.walkT = 3;
        }
        if (car.driver === 'traffic') car.speed *= 0.5;
      }
    }
  }
}

function stepBullets(world, dt) {
  for (const b of [...world.bullets]) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    let dead = b.life <= 0;
    if (!dead && hitsCity(world.city, b.x, b.y, 2)) {
      burst(world.particles, b.x, b.y, 4, '#ffd23f', 100, 0.25, 2);
      dead = true;
    }
    if (!dead && b.from === 'player') {
      for (const ped of world.peds) {
        if (ped.state === 'down') continue;
        if (distance(b, ped) < 13) {
          ped.hp -= b.dmg;
          burst(world.particles, ped.x, ped.y, 6, '#c0392b', 110, 0.4, 3);
          if (ped.hp <= 0) killPed(world, ped, true);
          else if (ped.state !== 'viper') ped.state = 'flee';
          dead = true;
          break;
        }
      }
      if (!dead) {
        for (const car of world.cars) {
          if (car.dead || car === world.player.car) continue;
          if (distance(b, car) < 22) {
            damageCar(world, car, b.dmg);
            burst(world.particles, b.x, b.y, 4, '#ffd23f', 100, 0.25, 2);
            if (car.driver === 'police' && world.shootWantedCd <= 0) {
              addWanted(world, 1);
              world.shootWantedCd = 4;
            }
            dead = true;
            break;
          }
        }
      }
    }
    if (!dead && b.from === 'viper') {
      const p = world.player;
      if (p.car === null && distance(b, p) < 12) {
        p.hp -= b.dmg;
        p.hurtT = 0.3;
        burst(world.particles, p.x, p.y, 5, '#c0392b', 100, 0.4, 3);
        dead = true;
      } else if (p.car && distance(b, p.car) < 22) {
        damageCar(world, p.car, b.dmg);
        dead = true;
      }
    }
    if (dead) world.bullets.splice(world.bullets.indexOf(b), 1);
  }
}

function stepPickups(world) {
  const p = world.player;
  for (const pk of [...world.pickups]) {
    if (distance(p, pk) < 28) {
      if (pk.pickupKind === 'cash') {
        p.money += pk.amount;
        world.stats.cashEarned += pk.amount;
        world.toasts.push({ text: `Found $${pk.amount} on the street`, t: 0 });
        world.events.push('coin');
      } else if (pk.pickupKind === 'health') {
        p.hp = Math.min(TUNING.playerHp, p.hp + pk.amount);
        world.toasts.push({ text: `Health +${pk.amount}`, t: 0 });
        world.events.push('heal');
      } else {
        p.ammo += pk.amount;
        world.toasts.push({ text: `Ammo +${pk.amount}`, t: 0 });
        world.events.push('pickup');
      }
      world.pickups.splice(world.pickups.indexOf(pk), 1);
    }
  }
}

/** The contextual prompt shown at the bottom of the screen, or null. */
function computePrompt(world, input) {
  const p = world.player;
  if (world.mission.intro) return { text: 'Press ENTER to accept the job' };
  if (p.car === null) {
    if (distance(p, PLACES.gunBarn) < 70) {
      return { text: p.money >= TUNING.ammoPrice ? `E — Buy ammo $${TUNING.ammoPrice}` : `Gun Barn — ammo $${TUNING.ammoPrice} (not enough cash)`, shop: 'gun' };
    }
    if (distance(p, PLACES.hideout) < 80 && nextJobId(world)) {
      return { text: 'E — Talk to Mara', shop: 'mara' };
    }
    const car = nearestCar(world, p.x, p.y, 55);
    if (car) {
      const stealing = car.driver === 'traffic' || car.driver === 'police';
      return { text: `E — ${stealing ? 'Steal' : 'Get in'} the ${car.name}`, car };
    }
  } else {
    if (distance(p, PLACES.pitStop) < 90 && p.car.hp < p.car.maxHp) {
      return { text: p.money >= TUNING.repairPrice ? `E — Repair car $${TUNING.repairPrice}` : `Pit Stop — repair $${TUNING.repairPrice} (not enough cash)`, shop: 'pit' };
    }
    return { text: `E — Get out of the ${p.car.name}` };
  }
  return null;
}

function handleInteract(world, input) {
  const p = world.player;
  const prompt = world.prompt;
  if (!prompt) return;
  if (prompt.shop === 'gun' && p.money >= TUNING.ammoPrice) {
    p.money -= TUNING.ammoPrice;
    p.ammo += TUNING.ammoAmount;
    world.toasts.push({ text: `Ammo +${TUNING.ammoAmount} — stay safe out there`, t: 0 });
    world.events.push('buy');
    return;
  }
  if (prompt.shop === 'pit' && p.money >= TUNING.repairPrice && p.car) {
    p.money -= TUNING.repairPrice;
    p.car.hp = p.car.maxHp;
    world.toasts.push({ text: 'Car repaired — good as new', t: 0 });
    world.events.push('buy');
    return;
  }
  if (prompt.shop === 'mara') {
    offerMission(world, nextJobId(world));
    return;
  }
  if (prompt.car) {
    const car = prompt.car;
    const wasTraffic = car.driver === 'traffic';
    const wasPolice = car.driver === 'police';
    if (wasTraffic) {
      // The driver bails out and runs.
      const driver = createPed(car.x + 30, car.y, world.rng, 'flee');
      driver.walkT = 4;
      world.peds.push(driver);
      addWanted(world, 1);
      world.toasts.push({ text: 'Car stolen! The SPPD noticed', t: 0 });
    } else if (wasPolice) {
      addWanted(world, 2);
      world.toasts.push({ text: 'You stole a police cruiser!', t: 0 });
    }
    if (car.driver === 'parked') {
      const nearCop = policeCars(world).some((c) => distance(c, car) < 350);
      if (nearCop) addWanted(world, 1);
    }
    car.driver = 'player';
    p.car = car;
    world.stats.carsStolen += 1;
    world.events.push('doorSlam');
    world.events.push('engineStart');
    return;
  }
  if (p.car) {
    // Get out: step to the side of the car.
    const car = p.car;
    car.driver = 'parked';
    car.speed = 0;
    p.car = null;
    p.x = car.x - Math.sin(car.angle) * 34;
    p.y = car.y + Math.cos(car.angle) * 34;
    const solved = resolveCityCollision(world.city, p.x, p.y, TUNING.playerRadius);
    p.x = solved.x;
    p.y = solved.y;
    world.events.push('doorSlam');
  }
}

/** Advance the world one fixed 1/60 s step. Called from the main loop. */
export function stepWorld(world, input, dt, mouseWorld) {
  if (world.mission.intro) {
    if (input.confirmPressed) beginMission(world);
    return;
  }
  world.time += dt;
  world.clock = (600 + world.time) % 1440;
  world.shootWantedCd -= dt;
  world.hitPedWantedCd -= dt;
  world.hornCd -= dt;
  world.nearMissCd -= dt;

  // Toasts and banners age out.
  for (const t of [...world.toasts]) {
    t.t += dt;
    if (t.t > 4.5) world.toasts.splice(world.toasts.indexOf(t), 1);
  }
  if (world.banner) {
    world.banner.t += dt;
    if (world.banner.t > 3.5) world.banner = null;
  }

  // Wanted: quiet time first, then the heat cools — unless a cop can see you.
  if (world.wanted > 0) {
    if (world.crimeTimer > 0) world.crimeTimer -= dt;
    else {
      const seen = policeCars(world).some((c) => distance(c, world.player) < TUNING.policeView);
      if (!seen) {
        world.decayTimer += dt;
        if (world.decayTimer >= TUNING.wantedDecayStep) {
          world.wanted -= 1;
          world.decayTimer = 0;
          if (world.wanted === 0) world.toasts.push({ text: 'You lost them — heat is off', t: 0 });
        }
      }
    }
  }

  // Player.
  world.prompt = computePrompt(world, input);
  if (input.enterPressed) handleInteract(world, input);
  if (world.player.car) stepPlayerDriving(world, input, dt);
  else stepPlayerOnFoot(world, input, dt, mouseWorld);

  // The city lives around the player.
  stepTraffic(world, dt);
  stepPolice(world, dt);
  stepPeds(world, dt);
  stepCarCollisions(world);
  stepBullets(world, dt);
  stepPickups(world);
  updateMissions(world, dt);
  maybeOfferFare(world, dt);
  updateFare(world, dt);

  // Particles and skid marks age out.
  for (const pt of [...world.particles]) {
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx *= 0.92;
    pt.vy *= 0.92;
    pt.life -= dt;
    if (pt.life <= 0) world.particles.splice(world.particles.indexOf(pt), 1);
  }
  for (const s of [...world.skids]) {
    s.t += dt;
    if (s.t > 9) world.skids.splice(world.skids.indexOf(s), 1);
  }
  for (const car of world.cars) {
    if (car.dead) car.wreckT += dt;
  }
  // Slow health regen, only when nobody has hurt the player lately.
  const p = world.player;
  if (p.hurtT <= -5) {
    // (hurtT keeps counting down past 0, so this is "5 s since last hit")
    p.hp = Math.min(TUNING.playerHp, p.hp + 2 * dt);
  }

  // The camera follows the player, a little ahead when driving fast.
  const lead = p.car ? 0.25 : 0;
  const tx = p.x + (p.car ? Math.cos(p.car.angle) * p.car.speed * lead : 0);
  const ty = p.y + (p.car ? Math.sin(p.car.angle) * p.car.speed * lead : 0);
  world.camera.x += (tx - world.camera.x) * Math.min(1, 5 * dt);
  world.camera.y += (ty - world.camera.y) * Math.min(1, 5 * dt);
  world.camera.zoom += ((p.car && Math.abs(p.car.speed) > 300 ? 0.9 : 1) - world.camera.zoom) * Math.min(1, 2 * dt);
  // Never show the void past the edge of the world.
  const vw = VIEW.width / world.camera.zoom;
  const vh = VIEW.height / world.camera.zoom;
  world.camera.x = clamp(world.camera.x, vw / 2, WORLD.width - vw / 2);
  world.camera.y = clamp(world.camera.y, vh / 2, WORLD.height - vh / 2);

  // Wasted: the run ends, but the totals live on.
  if (p.hp <= 0) {
    p.hp = 0;
    world.screen = SCREEN_OVER;
    world.overReason = 'wasted';
    world.events.push('explosion');
    saveStats(world);
  }

  if (world.saveRequested) {
    saveGame(world);
    world.saveRequested = false;
  }
}
