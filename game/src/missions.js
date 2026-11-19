// Story missions (Vera's jobs) and the repeatable taxi job.
import { CFG, MISSION_REWARDS, MISSION_NAMES } from './config.js';
import { dist, RNG } from './random.js';
import { landmarkPos, nearestRoadPoint, randomRoadPoint } from './city.js';
import { makeCar } from './entities.js';

export function toast(G, text) {
  G.toasts.push({ text, t: 4 });
  if (G.toasts.length > 4) G.toasts.shift();
}

export function nextMissionIdx(G) {
  for (let i = 0; i < 4; i++) if (!G.mission.done[i]) return i;
  return -1;
}

export function talkToVera(G) {
  const h = landmarkPos('hideout');
  if (dist(G.player.x, G.player.y, h.x, h.y) > 90) return false;
  if (G.mission.id !== null) return false;
  const idx = nextMissionIdx(G);
  if (idx < 0) {
    toast(G, 'Vera: no more jobs right now. The city is yours.');
    return true;
  }
  startMission(G, idx);
  return true;
}

export function startMission(G, idx) {
  const m = G.mission;
  m.id = idx;
  m.stage = 0;
  m.timer = 0;
  m.target = null;
  m.breakers = [];
  m.courier = null;
  m.ledger = null;
  m.runner = null;
  const names = [
    'Vera: pick up the runner at the north market. Then bring him home.',
    'Vera: take the sealed case to the marina. Ninety seconds. No stops.',
    'Vera: five Breakers hold Pier 9. Put them all down.',
    'Vera: a courier is running the harbor with our ledger. Ram him off the road, grab it, bring it home.',
  ];
  toast(G, `M${idx + 1} ${MISSION_NAMES[idx]} — ${names[idx]}`);
  if (idx === 0) m.target = landmarkPos('runner');
  if (idx === 1) m.target = landmarkPos('hideout');
  if (idx === 2) m.target = landmarkPos('pier');
  if (idx === 3) m.target = landmarkPos('harbor');
}

function failMission(G, why) {
  toast(G, `Mission failed: ${why}. Talk to Vera to retry.`);
  G.mission.id = null;
  G.mission.stage = 0;
  G.mission.breakers = [];
  if (G.mission.courier) {
    const i = G.cars.indexOf(G.mission.courier);
    if (i >= 0) G.cars.splice(i, 1);
    G.mission.courier = null;
  }
  G.mission.ledger = null;
  G.mission.runner = null;
}

function completeMission(G) {
  const idx = G.mission.id;
  const pay = MISSION_REWARDS[idx];
  G.money += pay;
  G.stats.earned += pay;
  G.mission.done[idx] = true;
  G.floats.push({ x: G.player.x, y: G.player.y - 30, text: `+$${pay}`, life: 2.2, color: '#f2b705' });
  toast(G, `M${idx + 1} ${MISSION_NAMES[idx]} complete! +$${pay}`);
  G.mission.id = null;
  G.mission.stage = 0;
  G.mission.breakers = [];
  G.mission.courier = null;
  G.mission.ledger = null;
  G.mission.runner = null;
  if (window.__solmarSave) window.__solmarSave();
}

export function updateMissions(G, dt) {
  const m = G.mission;
  if (m.id === null) return;
  const p = G.player;
  if (m.id === 0) {
    // M1 The Getaway
    if (m.stage === 0) {
      if (dist(p.x, p.y, m.target.x, m.target.y) < 60) {
        m.stage = 1;
        m.timer = 120;
        m.target = landmarkPos('hideout');
        m.runner = { x: p.x, y: p.y };
        toast(G, 'Runner aboard! Get him to the hideout — 2:00 on the clock.');
      }
    } else {
      m.timer -= dt;
      if (dist(p.x, p.y, m.target.x, m.target.y) < 70) { completeMission(G); return; }
      if (m.timer <= 0) failMission(G, 'the runner got cold feet');
    }
  } else if (m.id === 1) {
    // M2 Hot Delivery
    if (m.stage === 0) {
      if (dist(p.x, p.y, m.target.x, m.target.y) < 70) {
        m.stage = 1;
        m.timer = 90;
        m.target = landmarkPos('marina');
        toast(G, 'Case in hand. Marina, 90 seconds — go!');
      }
    } else {
      m.timer -= dt;
      if (dist(p.x, p.y, m.target.x, m.target.y) < 70) { completeMission(G); return; }
      if (m.timer <= 0) failMission(G, 'the delivery window closed');
    }
  } else if (m.id === 2) {
    // M3 Dockside Takedown
    if (m.stage === 0) {
      if (dist(p.x, p.y, m.target.x, m.target.y) < 130) {
        m.stage = 1;
        const pier = landmarkPos('pier');
        const rng = new RNG(G.seed * 31 + 7);
        for (let i = 0; i < 5; i++) {
          m.breakers.push({ x: pier.x + rng.range(-110, 110), y: pier.y + rng.range(-110, 110), hp: 100, shootT: rng.range(0.5, 2), angle: 0 });
        }
        toast(G, 'Five Breakers on the pier. Take them all down!');
      }
    } else if (m.breakers.length === 0) {
      completeMission(G);
    }
  } else if (m.id === 3) {
    // M4 Harbor Chase
    if (m.stage === 0) {
      if (dist(p.x, p.y, m.target.x, m.target.y) < 130) {
        m.stage = 1;
        const hb = landmarkPos('harbor');
        const rp = nearestRoadPoint(hb.x + 120, hb.y);
        const courier = makeCar(rp.x, rp.y, 0, 1, '#e33f2f', 'mission');
        courier.hp = 120;
        courier.maxHp = 120;
        courier.speed = 200;
        courier.wp = randomRoadPoint(new RNG(G.seed * 17 + 3));
        G.cars.push(courier);
        m.courier = courier;
        toast(G, 'There he is — the courier. Ram his car until it stops!');
      }
    } else if (m.stage === 1) {
      const c = m.courier;
      if (!c || c.hp <= 0) {
        if (c) {
          m.ledger = { x: c.x, y: c.y };
          const i = G.cars.indexOf(c);
          if (i >= 0) G.cars.splice(i, 1);
          m.courier = null;
        }
        m.stage = 2;
        toast(G, 'He is done. Grab the ledger!');
      }
    } else if (m.stage === 2) {
      if (m.ledger && dist(p.x, p.y, m.ledger.x, m.ledger.y) < 42) {
        m.ledger = null;
        m.stage = 3;
        m.target = landmarkPos('hideout');
        toast(G, 'Ledger secured. Bring it home to Vera.');
      }
    } else if (m.stage === 3) {
      if (dist(p.x, p.y, m.target.x, m.target.y) < 70) completeMission(G);
    }
  }
}

export function missionObjective(G) {
  const m = G.mission;
  if (m.id === null) {
    const n = nextMissionIdx(G);
    return n < 0 ? 'All jobs done — free roam' : `Talk to Vera at the Hideout (M${n + 1} ${MISSION_NAMES[n]})`;
  }
  const t = m.timer > 0 ? ` — ${Math.ceil(m.timer)}s` : '';
  const steps = [
    ['Reach the runner', 'Runner aboard — get to the Hideout'],
    ['Pick up the case at the Hideout', 'Deliver the case to the Marina'],
    ['Reach Pier 9', `Breakers left: ${m.breakers.length}`],
    ['Reach the Harbor', 'Ram the courier until he stops', 'Grab the ledger', 'Bring the ledger to the Hideout'],
  ];
  return `M${m.id + 1} ${MISSION_NAMES[m.id]}: ${steps[m.id][m.stage]}${t}`;
}

export function missionMarker(G) {
  const m = G.mission;
  if (m.id === null) return landmarkPos('hideout');
  if (m.id === 3 && m.stage === 1 && m.courier) return { x: m.courier.x, y: m.courier.y };
  if (m.id === 3 && m.stage === 2 && m.ledger) return m.ledger;
  if (m.id === 2 && m.stage === 1 && m.breakers.length) return { x: m.breakers[0].x, y: m.breakers[0].y };
  return m.target || landmarkPos('hideout');
}

// --- Taxi job ---

export function tryHailTaxi(G) {
  if (G.taxi.active || G.mission.id !== null) return false;
  if (G.player.onFoot) return false;
  // Find a waiting pedestrian near the player.
  let best = null;
  let bd = 120;
  for (const ped of G.peds) {
    const d = dist(G.player.x, G.player.y, ped.x, ped.y);
    if (d < bd) { bd = d; best = ped; }
  }
  if (!best) {
    toast(G, 'No fares nearby — cruise past pedestrians and press T.');
    return false;
  }
  const rng = new RNG((G.seed + G.time * 1000) | 0);
  const dest = randomRoadPoint(rng);
  const pay = Math.round(40 + dist(G.player.x, G.player.y, dest.x, dest.y) * 0.05);
  G.taxi.active = true;
  G.taxi.fare = best;
  G.taxi.dest = dest;
  G.taxi.pay = pay;
  G.taxi.timer = 150;
  const i = G.peds.indexOf(best);
  if (i >= 0) G.peds.splice(i, 1);
  toast(G, `Fare aboard! Drop them off — $${pay} plus a tip for speed.`);
  return true;
}

export function updateTaxi(G, dt) {
  const t = G.taxi;
  if (!t.active) return;
  t.timer -= dt;
  if (t.timer <= 0) {
    t.active = false;
    t.fare = null;
    toast(G, 'The fare got out. Too slow.');
    return;
  }
  if (dist(G.player.x, G.player.y, t.dest.x, t.dest.y) < 60) {
    const tip = t.timer > 90 ? Math.round(t.pay * 0.5) : t.timer > 45 ? Math.round(t.pay * 0.25) : 0;
    const total = t.pay + tip;
    G.money += total;
    G.stats.earned += total;
    G.stats.fares++;
    G.floats.push({ x: G.player.x, y: G.player.y - 30, text: `+$${total}`, life: 2.2, color: '#f2b705' });
    toast(G, `Fare paid $${total}${tip ? ` (incl. $${tip} tip)` : ''}.`);
    t.active = false;
    t.fare = null;
    if (window.__solmarSave) window.__solmarSave();
  }
}
