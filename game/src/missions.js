// Missions and side jobs. Vera's five story jobs, the taxi job and the
// courier job. All targets are road-snapped so a car can always reach them,
// and every radius a car must hit is generous on purpose.
import { CFG } from './config.js';
import { clamp, dist, randInt } from './random.js';
import { roadSnap } from './city.js';

export const MISSION_DEFS = [
  { id: 1, name: 'M1 The Getaway', brief: 'Pick up the package and bring it back to Vera.', reward: CFG.reward.m1 },
  { id: 2, name: 'M2 Hot Delivery', brief: 'Three drops, four minutes. Do not be late.', reward: CFG.reward.m2 },
  { id: 3, name: 'M3 Dockside Takedown', brief: 'Five Breakers hold the dockside. Clear them out.', reward: CFG.reward.m3 },
  { id: 4, name: 'M4 Harbor Chase', brief: 'Ram the courier to a stop, grab the ledger, bring it home.', reward: CFG.reward.m4 },
  { id: 5, name: 'M5 Night Heist', brief: 'Stop the bank van at night, grab the cash bags, reach the stash.', reward: CFG.reward.m5 },
];

export function nextMission(G) {
  return G.missionsDone.length + 1;
}

export function canStartMission(G, n) {
  return n === nextMission(G) && !G.mission.active;
}

export function startMission(G, n) {
  if (!canStartMission(G, n)) return false;
  const L = G.city.landmarks;
  const m = { id: n, stage: 0, timer: 0, data: {} };
  if (n === 1) {
    m.data.pickup = { x: 1500, y: 600 };
    m.data.home = { x: L.vera.x, y: L.vera.y };
  } else if (n === 2) {
    m.data.drops = [
      { x: 2600, y: 600, done: false },
      { x: 600, y: 2200, done: false },
      { x: 2200, y: 2600, done: false },
    ];
    m.timer = 240;
  } else if (n === 3) {
    G.breakers = [
      { x: 2700, y: 2750, hp: 30, dead: false, shootCd: 1, ox: 2700, oy: 2750 },
      { x: 2850, y: 2700, hp: 30, dead: false, shootCd: 1.4, ox: 2850, oy: 2700 },
      { x: 2750, y: 2900, hp: 30, dead: false, shootCd: 0.8, ox: 2750, oy: 2900 },
      { x: 2900, y: 2850, hp: 30, dead: false, shootCd: 1.2, ox: 2900, oy: 2850 },
      { x: 2650, y: 2900, hp: 30, dead: false, shootCd: 1.6, ox: 2650, oy: 2900 },
    ];
  } else if (n === 4) {
    const c = G.spawnCourierCar();
    m.data.courier = c;
    m.data.home = { x: L.vera.x, y: L.vera.y };
  } else if (n === 5) {
    G.time.hours = 22; G.time.minutes = 0;
    const v = G.spawnBankVan();
    m.data.van = v;
    m.data.stash = { x: L.stash.x, y: L.stash.y };
    m.data.bags = [];
  }
  G.mission = { ...m, active: true };
  G.objective = MISSION_DEFS[n - 1].brief;
  return true;
}

export function completeMission(G) {
  const def = MISSION_DEFS[G.mission.id - 1];
  G.money += def.reward;
  G.missionsDone.push(G.mission.id);
  G.mission = { id: 0, stage: 0, timer: 0, data: {}, active: false };
  G.objective = `${def.name} complete — +$${def.reward}. See Vera for the next job.`;
  G.saveSoon = true;
}

export function failMission(G, why) {
  G.mission = { id: 0, stage: 0, timer: 0, data: {}, active: false };
  G.objective = `Job failed: ${why}. See Vera to try again.`;
}

function playerPos(G) {
  return G.player.inCar ? G.player.inCar : G.player;
}

export function updateMissions(G, dt) {
  const m = G.mission;
  if (!m.active) return;
  if (m.timer > 0) {
    m.timer -= dt;
    if (m.timer <= 0) { failMission(G, 'ran out of time'); return; }
  }
  const p = playerPos(G);
  if (m.id === 1) {
    if (m.stage === 0 && dist(p.x, p.y, m.data.pickup.x, m.data.pickup.y) < 70) {
      m.stage = 1;
      G.objective = 'Package grabbed. Bring it back to Vera.';
    } else if (m.stage === 1 && dist(p.x, p.y, m.data.home.x, m.data.home.y) < 220) {
      completeMission(G);
    }
  } else if (m.id === 2) {
    let all = true;
    for (const d of m.data.drops) {
      if (!d.done && dist(p.x, p.y, d.x, d.y) < 70) {
        d.done = true;
        G.objective = `Drop done (${m.data.drops.filter((x) => x.done).length}/3).`;
      }
      if (!d.done) all = false;
    }
    if (all) completeMission(G);
  } else if (m.id === 3) {
    const alive = G.breakers.filter((b) => !b.dead).length;
    G.objective = `Dockside: ${5 - alive}/5 Breakers down.`;
    if (alive === 0) completeMission(G);
  } else if (m.id === 4) {
    const c = m.data.courier;
    if (m.stage === 0) {
      if (c.hp <= 0) {
        m.stage = 1;
        m.data.ledger = { x: c.x, y: c.y };
        G.objective = 'Courier stopped. Grab the ledger.';
      }
    } else if (m.stage === 1) {
      if (dist(p.x, p.y, m.data.ledger.x, m.data.ledger.y) < 70) {
        m.stage = 2;
        G.objective = 'Ledger in hand. Bring it home to Vera.';
      }
    } else if (m.stage === 2 && dist(p.x, p.y, m.data.home.x, m.data.home.y) < 220) {
      completeMission(G);
    }
  } else if (m.id === 5) {
    const v = m.data.van;
    if (m.stage === 0) {
      if (v.hp <= 0) {
        m.stage = 1;
        m.data.bags = [
          { x: v.x + 60, y: v.y, got: false },
          { x: v.x - 60, y: v.y + 40, got: false },
          { x: v.x, y: v.y - 60, got: false },
        ];
        G.player.wanted = Math.max(G.player.wanted, 3);
        G.objective = 'Van stopped. Grab the 3 cash bags (0/3).';
      }
    } else if (m.stage === 1) {
      let got = 0;
      for (const b of m.data.bags) {
        if (!b.got && dist(p.x, p.y, b.x, b.y) < 70) b.got = true;
        if (b.got) got++;
      }
      G.objective = `Cash bags (${got}/3). Then reach the stash.`;
      if (got === 3) { m.stage = 2; G.objective = 'All bags grabbed. Reach the stash house.'; }
    } else if (m.stage === 2 && dist(p.x, p.y, m.data.stash.x, m.data.stash.y) < 120) {
      completeMission(G);
    }
  }
}

// ---------- taxi job ----------
export function startTaxi(G) {
  if (G.taxi.active || G.taxi.cd > 0) return false;
  const L = G.city.landmarks;
  const a = L.taxiA, b = L.taxiB;
  const p = playerPos(G);
  const stand = dist(p.x, p.y, a.x, a.y) < dist(p.x, p.y, b.x, b.y) ? a : b;
  const dest = roadSnap(randInt(G.rng, 400, 2800), randInt(G.rng, 400, 2800));
  G.taxi = {
    active: true, stage: 0, cd: 0,
    pickup: { x: stand.x, y: stand.y },
    dest: { x: clamp(dest.x, 200, 3000), y: clamp(dest.y, 200, 3000) },
    fare: 0,
  };
  G.objective = 'Taxi: pick up the passenger.';
  return true;
}

export function updateTaxi(G, dt) {
  if (G.taxi.cd > 0) G.taxi.cd -= dt;
  if (!G.taxi.active) return;
  const p = playerPos(G);
  if (G.taxi.stage === 0) {
    if (dist(p.x, p.y, G.taxi.pickup.x, G.taxi.pickup.y) < 70) {
      G.taxi.stage = 1;
      const d = dist(G.taxi.pickup.x, G.taxi.pickup.y, G.taxi.dest.x, G.taxi.dest.y);
      G.taxi.fare = Math.round(CFG.taxiBase + d / 10);
      G.objective = `Taxi: drop the passenger off. Fare $${G.taxi.fare}.`;
    }
  } else if (dist(p.x, p.y, G.taxi.dest.x, G.taxi.dest.y) < 70) {
    G.money += G.taxi.fare;
    G.objective = `Taxi fare paid: +$${G.taxi.fare}.`;
    G.taxi = { active: false, stage: 0, cd: 5, pickup: null, dest: null, fare: 0 };
    G.saveSoon = true;
  }
}

// ---------- courier job ----------
export function startCourier(G) {
  if (G.courier.active || G.courier.cd > 0) return false;
  G.courier = {
    active: true, cd: 0, timer: 180,
    drops: [
      { x: 2200, y: 600, done: false },
      { x: 600, y: 1800, done: false },
      { x: 2600, y: 2200, done: false },
    ],
  };
  G.objective = 'Courier: 3 parcels, 3 minutes. $120 each.';
  return true;
}

export function updateCourier(G, dt) {
  if (G.courier.cd > 0) G.courier.cd -= dt;
  if (!G.courier.active) return;
  G.courier.timer -= dt;
  if (G.courier.timer <= 0) {
    G.courier = { active: false, cd: 5, timer: 0, drops: [] };
    G.objective = 'Courier run timed out. Try again at the depot.';
    return;
  }
  const p = playerPos(G);
  let done = 0;
  for (const d of G.courier.drops) {
    if (!d.done && dist(p.x, p.y, d.x, d.y) < 70) {
      d.done = true;
      G.money += CFG.courierDrop;
      G.objective = `Parcel delivered +$${CFG.courierDrop} (${G.courier.drops.filter((x) => x.done).length}/3).`;
    }
    if (d.done) done++;
  }
  if (done === 3) {
    G.money += CFG.courierBonus;
    G.objective = `All parcels delivered. Bonus +$${CFG.courierBonus}.`;
    G.courier = { active: false, cd: 5, timer: 0, drops: [] };
    G.saveSoon = true;
  }
}
