// SOLMAR STREETS — story missions and taxi fares. One clear job: know
// what the player has to do next, when it is done, and what it pays.
// It works on the world object the caller passes in; it never imports it.

import { MISSIONS, PLACES, REPEAT_JOB, TUNING } from './config.js';
import { nearestRoadPoint, randomRoadPoint } from './city.js';
import { createPed, distance } from './entities.js';

export function createMissionState() {
  return { current: null, done: {}, next: 'm1', intro: null };
}

export function missionDef(id) {
  if (id === REPEAT_JOB.id) return REPEAT_JOB;
  return MISSIONS.find((m) => m.id === id);
}

function nextAfter(id) {
  const i = MISSIONS.findIndex((m) => m.id === id);
  return i >= 0 && i + 1 < MISSIONS.length ? MISSIONS[i + 1].id : null;
}

/** True while a job is running — the HUD and the fare offer both ask. */
export function hasActiveJob(world) {
  return !!world.mission.current;
}

/** The next job Mara can offer: the next story job, or the repeatable one
 *  once the story is done. Null only when a job is already running. */
export function nextJobId(world) {
  if (hasActiveJob(world)) return null;
  if (world.mission.next) return world.mission.next;
  const storyDone = MISSIONS.every((m) => world.mission.done[m.id]);
  return storyDone ? REPEAT_JOB.id : null;
}

/** Show Mara's briefing card; the world freezes until the player accepts. */
export function offerMission(world, id) {
  world.mission.intro = missionDef(id);
}

/** The player accepted the briefing: the job is live. */
export function beginMission(world) {
  const def = world.mission.intro;
  if (!def) return;
  world.mission.intro = null;
  world.mission.current = { id: def.id, step: 0, timer: 0, killed: 0, total: TUNING.viperCount };
  world.toasts.push({ text: `${def.title} — ${def.steps[0].text}`, t: 0 });
  if (def.id === 'm1') world.toasts.push({ text: 'The Comet GT is parked on Palma Blvd', t: 0 });
  if (def.id === REPEAT_JOB.id) world.toasts.push({ text: 'Any car counts — bring it to the hideout', t: 0 });
}

function failMission(world, reason) {
  const id = world.mission.current ? world.mission.current.id : null;
  world.mission.current = null;
  world.banner = { title: 'MISSION FAILED', sub: reason, t: 0, bad: true };
  world.sfxEvent = 'fail';
  if (id) world.toasts.push({ text: 'Talk to Mara at the hideout to retry', t: 0 });
}

function completeMission(world) {
  const cur = world.mission.current;
  const def = missionDef(cur.id);
  world.player.money += def.reward;
  world.stats.cashEarned += def.reward;
  world.stats.missionsDone += 1;
  world.mission.done[cur.id] = true;
  if (cur.id !== REPEAT_JOB.id) world.mission.next = nextAfter(cur.id);
  world.mission.current = null;
  world.banner = { title: 'MISSION PASSED', sub: `${def.title}  +$${def.reward}`, t: 0, bad: false };
  world.sfxEvent = 'mission';
  world.saveRequested = true;
  // A finished job buys a clean slate: Mara has the heat called off and
  // the cruisers give up and drive away. The next job starts fresh.
  world.wanted = 0;
  world.crimeTimer = 0;
  world.decayTimer = 0;
  world.toasts.push({ text: 'The heat is off — Mara had a word with the SPPD', t: 0 });
}

/** The current objective line for the HUD, or null when free-roaming. */
export function currentObjective(world) {
  const cur = world.mission.current;
  if (!cur) return null;
  const def = missionDef(cur.id);
  const step = def.steps[cur.step];
  let text = step.text;
  if (cur.id === 'm3' && cur.step === 1) text = `Eliminate the Viper crew (${cur.killed}/${cur.total})`;
  return { title: def.title, text, timer: cur.timer > 0 ? cur.timer : null };
}

/** The world position the objective marker should point at, or null. */
export function objectiveTarget(world) {
  const cur = world.mission.current;
  if (!cur) return null;
  const def = missionDef(cur.id);
  const step = def.steps[cur.step];
  if (cur.id === 'm3' && cur.step === 1) return PLACES.docks;
  return PLACES[step.target];
}

/** Called by the world when a Viper goes down. */
export function viperKilled(world) {
  const cur = world.mission.current;
  if (!cur || cur.id !== 'm3' || cur.step !== 1) return;
  cur.killed += 1;
  world.toasts.push({ text: `Viper down (${cur.killed}/${cur.total})`, t: 0 });
}

/** Advance the active mission one step. Returns true when it advanced. */
function advance(world, extra) {
  const cur = world.mission.current;
  const def = missionDef(cur.id);
  cur.step += 1;
  if (extra) Object.assign(cur, extra);
  if (cur.step >= def.steps.length) {
    completeMission(world);
    return true;
  }
  const step = def.steps[cur.step];
  cur.timer = step.timer || 0;
  world.toasts.push({ text: step.text, t: 0 });
  if (step.hint) world.toasts.push({ text: step.hint, t: 0 });
  if (cur.id === 'm1' && cur.step === 2) {
    world.wanted = Math.max(world.wanted, 2);
    world.crimeTimer = TUNING.wantedDecayDelay;
    world.spawnPolice(2);
    world.toasts.push({ text: 'The SPPD is on you — lose them!', t: 0 });
  }
  if (cur.id === 'm3' && cur.step === 1) {
    spawnVipers(world);
  }
  return true;
}

function spawnVipers(world) {
  const spots = [
    { x: 3360, y: 820 }, { x: 3440, y: 900 }, { x: 3380, y: 980 },
    { x: 3480, y: 840 }, { x: 3340, y: 920 },
  ];
  for (const s of spots) {
    const v = createPed(s.x, s.y, world.rng, 'viper');
    v.shirt = '#7d2b2b';
    world.peds.push(v);
  }
  world.toasts.push({ text: 'The Vipers are here — five of them', t: 0 });
}

/** Step the active mission: proximity checks, timers, step changes. */
export function updateMissions(world, dt) {
  const cur = world.mission.current;
  if (!cur) return;
  const p = world.player;
  const def = missionDef(cur.id);
  const step = def.steps[cur.step];

  if (cur.timer > 0) {
    cur.timer -= dt;
    if (cur.timer <= 0) {
      failMission(world, 'Out of time');
      return;
    }
  }

  const at = (place, r) => distance(p, PLACES[place]) < r;
  if (cur.id === 'm1') {
    if (cur.step === 0 && at('comet', 70)) advance(world);
    else if (cur.step === 1 && p.car && p.car.model === 'comet') advance(world);
    else if (cur.step === 2 && at('hideout', 80) && p.car) completeMission(world);
  } else if (cur.id === 'm2') {
    if (cur.step === 0 && at('portPickup', 60)) advance(world);
    else if (cur.step === 1 && at('hillsDrop', 70)) completeMission(world);
  } else if (cur.id === 'm3') {
    if (cur.step === 0 && at('docks', 90)) advance(world);
    else if (cur.step === 1 && cur.killed >= cur.total) advance(world);
    else if (cur.step === 2 && at('hideout', 80)) completeMission(world);
  } else if (cur.id === REPEAT_JOB.id) {
    if (cur.step === 0 && p.car) advance(world);
    else if (cur.step === 1 && at('hideout', 80) && p.car) completeMission(world);
  }
}

// ---------------------------------------------------------------------------
// Taxi fares: the repeatable side job. Drive any car, pick up a waving
// pedestrian, drop them off before the timer runs out.
// ---------------------------------------------------------------------------

export function createFareState() {
  return { fare: null, cooldown: TUNING.fareCooldown };
}

/** Offer a fare when the player is driving with nothing else going on. */
export function maybeOfferFare(world, dt) {
  const f = world.fare;
  if (f.fare) return;
  f.cooldown -= dt;
  if (f.cooldown > 0) return;
  const p = world.player;
  if (!p.car || world.mission.current) return;
  // A waving pedestrian on a nearby road.
  const a = world.rng.range(0, Math.PI * 2);
  const d = world.rng.range(220, 420);
  const spot = { x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d };
  const road = nearestRoadPoint(spot.x, spot.y);
  const ped = createPed(road.x, road.y, world.rng, 'fare');
  ped.shirt = '#e8c84a';
  world.peds.push(ped);
  const dest = randomRoadPoint(world.rng);
  f.fare = { state: 'wait', ped, dest: { x: dest.x, y: dest.y }, timer: 0, reward: 0 };
  world.toasts.push({ text: 'Someone is hailing a cab — drive up and they will hop in', t: 0 });
}

export function updateFare(world, dt) {
  const f = world.fare;
  if (!f.fare) return;
  const fare = f.fare;
  const p = world.player;
  if (fare.state === 'wait') {
    if (!world.peds.includes(fare.ped)) { f.fare = null; f.cooldown = 10; return; }
    if (p.car && distance(p, fare.ped) < 60) {
      // Passenger hops in.
      world.peds.splice(world.peds.indexOf(fare.ped), 1);
      fare.state = 'ride';
      fare.timer = TUNING.fareTimer;
      fare.reward = world.rng.int(TUNING.fareRewardMin, TUNING.fareRewardMax);
      world.toasts.push({ text: `Fare up! Drop them off — $${fare.reward} waiting`, t: 0 });
      world.sfxEvent = 'pickup';
    }
  } else if (fare.state === 'ride') {
    fare.timer -= dt;
    if (fare.timer <= 0) {
      world.toasts.push({ text: 'Fare cancelled — too slow', t: 0 });
      world.sfxEvent = 'fail';
      f.fare = null;
      f.cooldown = 15;
      return;
    }
    if (distance(p, fare.dest) < 70) {
      // Fast drop-off earns a tip: half the timer left is a good ride.
      const tip = fare.timer > TUNING.fareTimer / 2 ? TUNING.fareTip : 0;
      const total = fare.reward + tip;
      p.money += total;
      world.stats.cashEarned += total;
      world.stats.fares += 1;
      world.toasts.push({ text: tip > 0 ? `Fare complete +$${total} (incl. $${tip} tip)` : `Fare complete +$${total}`, t: 0 });
      world.sfxEvent = tip > 0 ? 'tip' : 'coin';
      world.saveRequested = true;
      f.fare = null;
      f.cooldown = 20;
    }
  }
}
