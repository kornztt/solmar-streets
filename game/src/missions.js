// Story missions M1–M5 and the two repeatable side jobs (taxi, courier).
// Each mission is a small stage machine; the active marker is written to
// G.marker so the renderer and the HUD always agree on the objective.

import { MISSIONS, clamp, dist, angleTo } from './config.js';
import { mulberry32, pick, range } from './random.js';
import { makePed, makeCar, addWanted, scarePeds } from './entities.js';
import { randomRoadPoint, nearestRoad } from './world.js';

function setMarker(G, x, y, label) {
  G.marker = { x, y, label };
}

function clearMarker(G) {
  G.marker = null;
}

function msg(G, text) {
  G.message = text;
  G.messageAt = G.elapsed;
}

export function completeMission(G) {
  const m = G.mission;
  if (!m) return;
  G.player.money += m.def.payout;
  G.completed.add(m.def.id);
  msg(G, `${m.def.name} complete! +$${m.def.payout}`);
  if (G.audio) G.audio.cash();
  G.mission = null;
  clearMarker(G);
  if (G.saveGame) G.saveGame();
}

export function failMission(G, why) {
  const m = G.mission;
  if (!m) return;
  msg(G, `${m.def.name} failed: ${why}`);
  if (G.audio) G.audio.error();
  G.mission = null;
  clearMarker(G);
}

function defOf(id) {
  return MISSIONS.find((m) => m.id === id);
}

export function startMission(G, id) {
  const def = defOf(id);
  if (!def) return false;
  // Clear any previous mission cleanly first.
  if (G.mission) { G.mission = null; clearMarker(G); }
  const m = { def, stage: 0, data: {}, t: 0 };
  G.mission = m;
  msg(G, `${def.name}: ${def.brief}`);
  if (id === 'm1') {
    const car = makeCar('sport', '#e74c3c', 1000, 600, Math.PI / 2, { traffic: false });
    car.getaway = true;
    G.cars.push(car);
    m.data.car = car;
    setMarker(G, 1000, 600, 'Getaway car');
  } else if (id === 'm2') {
    m.data.pickup = { x: 620, y: 1820 };
    setMarker(G, 620, 1820, 'Pick up the package');
  } else if (id === 'm3') {
    m.data.dock = { x: 3050, y: 3050 };
    setMarker(G, 3050, 3050, 'Go to the docks');
  } else if (id === 'm4') {
    const car = makeCar('sedan', '#2c3e50', 2600, 1400, 0, { traffic: false });
    car.targetCar = true;
    car.hp = 9999;
    G.cars.push(car);
    m.data.car = car;
    m.data.tail = 0;
    setMarker(G, 2600, 1400, 'Tail the courier car');
  } else if (id === 'm5') {
    G.clock = 22.0; // the heist happens at night
    const van = makeCar('van', '#f1c40f', 600, 2600, 0, { traffic: false, van: true, hp: 120 });
    van.bankVan = true;
    G.cars.push(van);
    m.data.van = van;
    setMarker(G, 600, 2600, 'Intercept the bank van');
  }
  return true;
}

export function updateMission(G, dt) {
  const m = G.mission;
  if (!m) return;
  m.t += dt;
  const P = G.player;

  if (m.def.id === 'm1') {
    if (m.stage === 0) {
      if (P.inCar === m.data.car) {
        m.stage = 1;
        setMarker(G, 3050, 620, 'Reach the safehouse');
        msg(G, 'Now drive to the safehouse!');
      }
    } else if (m.stage === 1) {
      if (P.inCar === m.data.car && dist(P.x, P.y, 3050, 620) < 90) completeMission(G);
    }
  } else if (m.def.id === 'm2') {
    if (m.stage === 0) {
      if (dist(P.x, P.y, m.data.pickup.x, m.data.pickup.y) < 60) {
        m.stage = 1;
        m.data.timer = 90;
        m.data.dest = { x: 3050, y: 3050 };
        setMarker(G, 3050, 3050, 'Deliver the package (90s)');
        msg(G, 'Package picked up — 90 seconds!');
        if (G.audio) G.audio.pickup();
      }
    } else if (m.stage === 1) {
      m.data.timer -= dt;
      setMarker(G, 3050, 3050, `Deliver! ${Math.max(0, Math.ceil(m.data.timer))}s`);
      if (m.data.timer <= 0) { failMission(G, 'ran out of time'); return; }
      if (dist(P.x, P.y, 3050, 3050) < 90) completeMission(G);
    }
  } else if (m.def.id === 'm3') {
    if (m.stage === 0) {
      if (dist(P.x, P.y, 3050, 3050) < 260) {
        m.stage = 1;
        m.data.guards = [];
        const spots = [[2960, 2960], [3140, 2980], [3030, 3180]];
        for (const [gx, gy] of spots) {
          const g = makePed('officer', gx, gy);
          g.guard = true;
          g.hp = 80;
          g.state = 'wait';
          g.color = '#5d1a1a';
          G.peds.push(g);
          m.data.guards.push(g);
        }
        setMarker(G, 3050, 3050, 'Take down 3 guards');
        msg(G, 'Three guards — take them all down!');
        addWanted(G, 1);
      }
    } else if (m.stage === 1) {
      // Guards close in and swing when the player is near.
      for (const g of m.data.guards) {
        if (g.dead) continue;
        const d = dist(g.x, g.y, P.x, P.y);
        if (d < 260 && d > 26) {
          const a = angleTo(g.x, g.y, P.x, P.y);
          g.x += Math.cos(a) * 70 * dt;
          g.y += Math.sin(a) * 70 * dt;
          g.angle = a;
        } else if (d <= 26) {
          if (P.inCar) { P.inCar.hp -= 8 * dt; } else if (G.hurtPlayer) { G.hurtPlayer(12 * dt); }
        }
      }
      const left = m.data.guards.filter((g) => !g.dead).length;
      setMarker(G, 3050, 3050, `Guards left: ${left}`);
      if (left === 0) completeMission(G);
    }
  } else if (m.def.id === 'm4') {
    const car = m.data.car;
    if (!car || car.hp <= 0) { failMission(G, 'the courier car was destroyed'); return; }
    if (m.stage === 0) {
      // The courier cruises the harbor road; stay close to tail it.
      car.speed = 170;
      const d = dist(P.x, P.y, car.x, car.y);
      if (d < 550) m.data.tail += dt;
      setMarker(G, car.x, car.y, `Tail it! ${Math.max(0, Math.ceil(10 - m.data.tail))}s`);
      if (m.data.tail >= 10) {
        m.stage = 1;
        m.data.rams = 0;
        setMarker(G, car.x, car.y, 'Ram it 3 times!');
        msg(G, 'Now ram the courier car!');
      }
    } else if (m.stage === 1) {
      car.speed = 260;
      // The ram count lives on the target car itself (updateCarCollisions
      // increments car.rams on every hard hit).
      const rams = car.rams || 0;
      setMarker(G, car.x, car.y, `Rams: ${rams}/3`);
      if (rams >= 3) completeMission(G);
    }
    // Drive the courier around the road loop: east on 1400, south on 3400,
    // west on 3400, north on 200 — always on a road, never through buildings.
    const cx = clamp(car.x + Math.cos(car.angle) * car.speed * dt, 40, 3560);
    const cy = clamp(car.y + Math.sin(car.angle) * car.speed * dt, 40, 3560);
    car.x = cx; car.y = cy;
    if (car.angle === 0 && car.x >= 3400) car.angle = Math.PI / 2;
    else if (car.angle === Math.PI / 2 && car.y >= 3400) car.angle = Math.PI;
    else if (car.angle === Math.PI && car.x <= 200) car.angle = -Math.PI / 2;
    else if (car.angle === -Math.PI / 2 && car.y <= 1400) car.angle = 0;
  } else if (m.def.id === 'm5') {
    const van = m.data.van;
    if (!van) { failMission(G, 'the van vanished'); return; }
    if (m.stage === 0) {
      if (van.hp <= 0 || van.rams >= 3) {
        van.speed = 0;
        van.stopped = true;
        m.stage = 1;
        m.data.bags = [
          { x: van.x + 60, y: van.y + 30, got: false },
          { x: van.x - 50, y: van.y + 60, got: false },
          { x: van.x + 20, y: van.y - 70, got: false },
        ];
        addWanted(G, 3);
        setMarker(G, van.x, van.y, 'Grab the 3 cash bags');
        msg(G, 'Van stopped! Grab the cash bags!');
        scarePeds(G, van.x, van.y, 300);
      } else {
        // The van flees east along the south road, then back west.
        van.speed = 200;
        van.x = clamp(van.x + Math.cos(van.angle) * van.speed * dt, 40, 3560);
        van.y = clamp(van.y + Math.sin(van.angle) * van.speed * dt, 40, 3560);
        if (van.x >= 3400 && van.angle === 0) van.angle = Math.PI;
        if (van.x <= 200 && van.angle === Math.PI) van.angle = 0;
        setMarker(G, van.x, van.y, 'Stop the bank van!');
      }
    } else if (m.stage === 1) {
      for (const b of m.data.bags) {
        if (!b.got && dist(P.x, P.y, b.x, b.y) < 46) {
          b.got = true;
          if (G.audio) G.audio.pickup();
          msg(G, `Cash bag ${m.data.bags.filter((x) => x.got).length}/3`);
        }
      }
      const got = m.data.bags.filter((b) => b.got).length;
      setMarker(G, van.x, van.y, `Bags: ${got}/3`);
      if (got >= 3) {
        m.stage = 2;
        m.data.stash = { x: 340, y: 340 };
        setMarker(G, 340, 340, 'Reach the stash (wanted 3!)');
        msg(G, 'All bags! Lose the heat and reach the stash.');
      }
    } else if (m.stage === 2) {
      if (dist(P.x, P.y, 340, 340) < 90) completeMission(G);
    }
  }
}

// --- side jobs ---------------------------------------------------------------

export function startTaxi(G) {
  if (G.taxi) return false;
  const rng = mulberry32((G.seed + 303 + Math.floor(G.elapsed)) >>> 0);
  const p = randomRoadPoint(rng, G.world);
  const ped = makePed(pick(rng, ['tourist', 'business', 'student', 'elder']), p.x, p.y);
  ped.state = 'wait';
  ped.passenger = true;
  G.peds.push(ped);
  G.taxi = { stage: 'pickup', passenger: ped, dest: null, fare: 0, timer: 0 };
  setMarker(G, p.x, p.y, 'Pick up the passenger');
  msg(G, 'Taxi job: pick up the passenger.');
  return true;
}

export function updateTaxi(G, dt) {
  const t = G.taxi;
  if (!t) return;
  const P = G.player;
  if (t.stage === 'pickup') {
    if (P.inCar && dist(P.x, P.y, t.passenger.x, t.passenger.y) < 70) {
      const rng = mulberry32((G.seed + 404 + Math.floor(G.elapsed * 10)) >>> 0);
      const d = randomRoadPoint(rng, G.world);
      t.dest = d;
      t.fare = 40 + Math.floor(dist(t.passenger.x, t.passenger.y, d.x, d.y) / 25);
      t.timer = 75;
      t.stage = 'dropoff';
      t.passenger.dead = true;
      t.passenger.deadAt = G.elapsed;
      setMarker(G, d.x, d.y, `Drop off ($${t.fare})`);
      msg(G, `Passenger aboard — drop them off for $${t.fare}!`);
      if (G.audio) G.audio.pickup();
    }
  } else if (t.stage === 'dropoff') {
    t.timer -= dt;
    setMarker(G, t.dest.x, t.dest.y, `Drop off $${t.fare} (${Math.max(0, Math.ceil(t.timer))}s)`);
    if (t.timer <= 0) {
      msg(G, 'Taxi job: passenger gave up and left.');
      G.taxi = null;
      clearMarker(G);
      return;
    }
    if (P.inCar && dist(P.x, P.y, t.dest.x, t.dest.y) < 80) {
      const tip = t.timer > 30 ? 20 : 0;
      P.money += t.fare + tip;
      msg(G, `Taxi fare +$${t.fare}${tip ? ` (+$${tip} tip)` : ''}`);
      if (G.audio) G.audio.cash();
      G.taxi = null;
      clearMarker(G);
      if (G.saveGame) G.saveGame();
    }
  }
}

export function startCourier(G) {
  if (G.courier) return false;
  const depot = { x: 1820, y: 620 };
  const drops = [
    { x: 620, y: 2620 },
    { x: 3050, y: 1820 },
    { x: 620, y: 620 },
  ];
  G.courier = { stage: 'pickup', depot, drops, idx: 0, carried: 0 };
  setMarker(G, depot.x, depot.y, 'Pick up 3 packages');
  msg(G, 'Courier job: collect 3 packages at the depot.');
  return true;
}

export function updateCourier(G, dt) {
  const c = G.courier;
  if (!c) return;
  const P = G.player;
  if (c.stage === 'pickup') {
    if (dist(P.x, P.y, c.depot.x, c.depot.y) < 70) {
      c.carried = 3;
      c.stage = 'deliver';
      c.idx = 0;
      setMarker(G, c.drops[0].x, c.drops[0].y, 'Deliver package 1/3');
      msg(G, '3 packages loaded — deliver them!');
      if (G.audio) G.audio.pickup();
    }
  } else if (c.stage === 'deliver') {
    const d = c.drops[c.idx];
    setMarker(G, d.x, d.y, `Deliver package ${c.idx + 1}/3 (+$120)`);
    if (dist(P.x, P.y, d.x, d.y) < 70) {
      P.money += 120;
      c.idx++;
      if (G.audio) G.audio.cash();
      if (c.idx >= 3) {
        P.money += 80; // completion bonus
        msg(G, 'Courier run done! +$360 + $80 bonus');
        G.courier = null;
        clearMarker(G);
        if (G.saveGame) G.saveGame();
      } else {
        msg(G, `Package ${c.idx}/3 delivered (+$120)`);
      }
    }
  }
}
