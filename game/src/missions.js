// Story missions and the taxi job: state machines driven by world.js.
// Each mission is offered by Mara in order (m1 -> m2 -> m3); the taxi job
// repeats once m1 is done. Rewards are paid on completion, in cash.
import { MISSIONS, ZONES, TUNE } from './config.js';
import { makeCar, makePed } from './entities.js';
import { randomRoadPoint } from './city.js';
import { dist } from './random.js';

export function freshMissionState() {
  return { current: null, done: {}, next: 'm1', intro: null };
}

export function freshFareState() {
  return { state: 'none', x: 0, y: 0, dx: 0, dy: 0, pay: 0, timer: 0, cooldown: 4, pedId: 0 };
}

// The mission Mara has to offer, or null when the story is finished.
export function offeredMission(world) {
  const next = world.mission.next;
  if (!next || world.mission.done[next]) return null;
  if (world.mission.current) return null;
  return MISSIONS[next];
}

export function startMission(world, id) {
  const def = MISSIONS[id];
  const m = {
    id, step: 0, timer: def.timer, killed: 0, total: 0,
    tx: 0, ty: 0, hasPackage: false, name: def.name,
  };
  if (id === 'm1') {
    m.tx = ZONES.m1Car.x;
    m.ty = ZONES.m1Car.y;
    // The getaway car waits a block from the hideout, engine running.
    const car = makeCar('getaway', ZONES.m1Car.x, ZONES.m1Car.y, -Math.PI / 2);
    car.driver = null;
    world.cars.push(car);
    m.getawayId = car.id;
  } else if (id === 'm2') {
    m.tx = ZONES.m2Pickup.x;
    m.ty = ZONES.m2Pickup.y;
  } else if (id === 'm3') {
    m.tx = ZONES.docks.x;
    m.ty = ZONES.docks.y;
  }
  world.mission.current = m;
  world.mission.intro = null;
  world.setObjective(def.name + ': ' + stepText(m));
  return m;
}

export function stepText(m) {
  if (m.id === 'm1') return m.step === 0 ? 'Steal the getaway car' : 'Reach the north hideout';
  if (m.id === 'm2') return m.step === 0 ? 'Pick up the package' : 'Deliver the package';
  if (m.id === 'm3') {
    if (m.step === 0) return 'Go to Pier 9';
    if (m.step === 1) return 'Take down the Viper crew (' + m.killed + '/' + m.total + ')';
    return 'Report back to Mara';
  }
  return '';
}

function completeMission(world, m) {
  const def = MISSIONS[m.id];
  world.player.money += def.reward;
  world.mission.done[m.id] = true;
  world.mission.current = null;
  world.mission.next = m.id === 'm1' ? 'm2' : m.id === 'm2' ? 'm3' : null;
  world.stats.missionsDone += 1;
  world.stats.earned += def.reward;
  world.toast(def.name + ' complete — +$' + def.reward);
  world.audio.missionDone();
  world.audio.cash();
  world.setObjective(world.mission.next ? 'Talk to Mara for your next job' : 'Story complete — Solmar is yours');
  world.save();
}

function failMission(world, m, reason) {
  world.mission.current = null;
  world.toast(reason + ' — talk to Mara to try again');
  world.setObjective('Talk to Mara for work');
}

// One tick of the active mission. Called from world.step.
export function updateMission(world, dt) {
  const m = world.mission.current;
  if (!m) return;
  const p = world.player;

  if (m.timer > 0) {
    m.timer -= dt;
    if (m.timer <= 0) {
      failMission(world, m, MISSIONS[m.id].name + ' failed: out of time');
      return;
    }
  }

  if (m.id === 'm1') {
    if (m.step === 0) {
      const car = world.cars.find((c) => c.id === m.getawayId);
      if (p.car && car && p.car.id === car.id) {
        m.step = 1;
        m.tx = ZONES.m1Dest.x;
        m.ty = ZONES.m1Dest.y;
        m.timer = MISSIONS.m1.timer;
        world.setWanted(2);
        world.spawnPolice(2);
        world.setObjective('The Getaway: Reach the north hideout');
        world.toast('The cops are on you — lose them!');
      }
    } else if (dist(p.x, p.y, m.tx, m.ty) < 100 && p.car) {
      completeMission(world, m);
    }
  } else if (m.id === 'm2') {
    if (m.step === 0) {
      if (dist(p.x, p.y, m.tx, m.ty) < 80) {
        m.step = 1;
        m.hasPackage = true;
        m.tx = ZONES.m2Dest.x;
        m.ty = ZONES.m2Dest.y;
        m.timer = MISSIONS.m2.timer;
        world.audio.pickup();
        world.setObjective('Hot Delivery: Deliver the package');
        world.toast('Package secured — go!');
      }
    } else if (dist(p.x, p.y, m.tx, m.ty) < 90) {
      completeMission(world, m);
    }
  } else if (m.id === 'm3') {
    if (m.step === 0) {
      if (dist(p.x, p.y, m.tx, m.ty) < 280) {
        m.step = 1;
        m.total = 5;
        m.killed = 0;
        // The crew fans out around the player and opens fire.
        for (let i = 0; i < 5; i += 1) {
          const a = (i / 5) * Math.PI * 2 + 0.4;
          const v = makePed('viper', p.x + Math.cos(a) * 320, p.y + Math.sin(a) * 320);
          const fixed = world.fixPosition(v.x, v.y, 13);
          v.x = fixed.x;
          v.y = fixed.y;
          world.peds.push(v);
        }
        world.setWanted(Math.max(world.wanted, 2));
        world.setObjective('Dockside Takedown: Take down the Viper crew (0/5)');
        world.toast('Ambush! Five Vipers — take them all down');
      }
    } else if (m.step === 1) {
      if (m.killed >= m.total) {
        m.step = 2;
        m.tx = ZONES.mara.x;
        m.ty = ZONES.mara.y;
        world.setObjective('Dockside Takedown: Report back to Mara');
        world.toast('Crew down — report back to Mara');
      }
    } else if (dist(p.x, p.y, ZONES.mara.x, ZONES.mara.y) < 90) {
      completeMission(world, m);
    }
  }
}

// ---- Taxi job ----

// Offer a new fare at a random road point once the cooldown runs out.
export function updateFare(world, dt) {
  const f = world.fare;
  const p = world.player;
  if (!world.mission.done.m1) return;
  if (f.state === 'none') {
    f.cooldown -= dt;
    if (f.cooldown <= 0) {
      const a = randomRoadPoint(world.rng);
      const b = randomRoadPoint(world.rng);
      f.state = 'waiting';
      f.x = a.x;
      f.y = a.y;
      f.dx = b.x;
      f.dy = b.y;
      f.pay = world.rng.int(TUNE.farePay[0], TUNE.farePay[1]);
      f.timer = 0;
      const ped = makePed('fare', a.x, a.y);
      f.pedId = ped.id;
      world.peds.push(ped);
    }
    return;
  }
  if (f.state === 'waiting') {
    if (p.car && dist(p.x, p.y, f.x, f.y) < 80) {
      f.state = 'dropoff';
      f.timer = 0;
      const ped = world.peds.find((x) => x.id === f.pedId);
      if (ped) ped.dead = true;
      world.audio.pickup();
      world.toast('Fare aboard — take them to the marker');
    }
    return;
  }
  if (f.state === 'dropoff') {
    f.timer += dt;
    if (p.car && dist(p.x, p.y, f.dx, f.dy) < 90) {
      let pay = f.pay;
      let tip = 0;
      if (f.timer < TUNE.fareTipSeconds) {
        tip = TUNE.fareTip;
        pay += tip;
        world.audio.cash();
      }
      p.money += pay;
      world.stats.fares += 1;
      world.stats.earned += pay;
      world.toast('Fare paid $' + pay + (tip ? ' (incl. $' + tip + ' tip)' : ''));
      f.state = 'none';
      f.cooldown = 8;
      world.save();
    }
  }
}
