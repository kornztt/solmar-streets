// Story missions (M1–M5) and the two repeatable side jobs (taxi, courier).
import { PLACES, PAYOUTS, MISSION_DEFS } from './config.js';
import { dist, clamp } from './random.js';
import { makeCar, makePed, makeBreaker, makePickup } from './entities.js';
import { roadDrive, nearestIntersection } from './city.js';

function marker(G, x, y, label) {
  G.marker = { x, y, label };
}

function completeMission(G) {
  const def = MISSION_DEFS[G.missionIndex];
  G.player.money += def.payout;
  G.banner(`${def.name} complete! +$${def.payout}`, '#2ecc71');
  G.audio.sfx('mission');
  G.missionIndex += 1;
  G.missionStage = 0;
  G.missionData = {};
  G.marker = null;
  G.missionActive = false;
  G.save();
}

function failMission(G, why) {
  G.banner(`${why} — mission reset`, '#e74c3c');
  G.audio.sfx('fail');
  G.missionStage = 0;
  G.missionData = {};
  G.missionActive = false;
  G.marker = null;
  // Clean up mission cars and enemies.
  for (const c of G.cars) if (c.driver === 'courier' || c.driver === 'van') c.dead = true;
  G.cars = G.cars.filter((c) => !c.dead);
  G.enemies = [];
}

// Start the current story mission when the player reaches its start marker.
export function maybeStartMission(G) {
  if (G.missionActive || G.missionIndex >= MISSION_DEFS.length) return;
  const i = G.missionIndex;
  const starts = [
    PLACES.getawayCar,
    PLACES.depot,
    PLACES.harbor,
    PLACES.bank,
    PLACES.bank,
  ];
  const s = starts[i];
  if (dist(G.player.x, G.player.y, s.x, s.y) < 80) {
    G.missionActive = true;
    G.missionStage = 0;
    G.missionData = {};
    const def = MISSION_DEFS[i];
    G.banner(`${def.name}: ${def.brief}`, '#f1c40f');
    G.audio.sfx('start');
    if (i === 4) {
      // M5 is a night job: jump the clock to 22:00.
      G.clock = 22.0;
    }
    if (i === 3) {
      // M4: the courier starts fleeing from the bank.
      const c = makeCar(5, PLACES.bank.x + 40, PLACES.bank.y + 40, 0, 'courier');
      c.hp = 60;
      c.maxHp = 60;
      c.top = 360;
      G.cars.push(c);
      G.missionData.courier = c;
      G.missionData.fleeTarget = { x: 200, y: 1600 };
    }
    if (i === 4) {
      const v = makeCar(4, PLACES.bank.x, PLACES.bank.y + 60, Math.PI, 'van');
      v.hp = 80;
      v.maxHp = 80;
      v.top = 300;
      G.cars.push(v);
      G.missionData.van = v;
      G.missionData.route = [{ x: 1800, y: 1600 }, { x: 600, y: 1600 }, { x: 600, y: 200 }, { x: 1800, y: 200 }];
      G.missionData.routeIdx = 0;
    }
  }
}

export function updateMission(G, dt) {
  if (!G.missionActive || G.missionIndex >= MISSION_DEFS.length) return;
  const i = G.missionIndex;
  const D = G.missionData;
  const P = G.player;

  if (i === 0) {
    // M1: get in the getaway car, then bring it home.
    if (G.missionStage === 0) {
      marker(G, PLACES.getawayCar.x, PLACES.getawayCar.y, 'Getaway car');
      if (P.car && P.car.isGetaway) G.missionStage = 1;
      else if (dist(P.x, P.y, PLACES.getawayCar.x, PLACES.getawayCar.y) < 70) {
        const car = G.cars.find((c) => c.isGetaway);
        if (car) G.hint = 'Press E to get in the getaway car';
      }
    } else {
      marker(G, PLACES.home.x, PLACES.home.y, 'Safehouse');
      if (dist(P.x, P.y, PLACES.home.x, PLACES.home.y) < 80 && P.car && P.car.isGetaway) completeMission(G);
    }
  } else if (i === 1) {
    // M2: pick up at the depot, deliver in 90 seconds.
    if (G.missionStage === 0) {
      marker(G, PLACES.depot.x, PLACES.depot.y, 'Pick up the package');
      if (dist(P.x, P.y, PLACES.depot.x, PLACES.depot.y) < 70) {
        G.missionStage = 1;
        D.timer = 90;
        G.banner('Package picked up — deliver it fast!', '#f1c40f');
      }
    } else {
      marker(G, PLACES.deliveryDrop.x, PLACES.deliveryDrop.y, `Deliver (${Math.ceil(D.timer)}s)`);
      D.timer -= dt;
      if (D.timer <= 0) { failMission(G, 'Too slow'); return; }
      if (dist(P.x, P.y, PLACES.deliveryDrop.x, PLACES.deliveryDrop.y) < 70) completeMission(G);
    }
  } else if (i === 2) {
    // M3: five Breakers at the dockside.
    if (G.missionStage === 0) {
      marker(G, PLACES.harbor.x, PLACES.harbor.y, 'Dockside');
      if (dist(P.x, P.y, PLACES.harbor.x, PLACES.harbor.y) < 120) {
        G.missionStage = 1;
        // Breakers fan out around the dockside at a fair distance, with a
        // moment before they open fire, so the fight is winnable.
        for (let k = 0; k < 5; k++) {
          const a = (k / 5) * Math.PI * 2 + 0.4;
          const bx = clamp(PLACES.harbor.x + Math.cos(a) * 280, 60, 2540);
          const by = clamp(PLACES.harbor.y + Math.sin(a) * 230, 60, 1740);
          G.enemies.push(makeBreaker(bx, by));
        }
        G.banner('Five Breakers — take them all down!', '#e74c3c');
        G.audio.sfx('alarm');
      }
    } else {
      marker(G, PLACES.harbor.x, PLACES.harbor.y, `Breakers left: ${G.enemies.length}`);
      if (G.enemies.length === 0) completeMission(G);
    }
  } else if (i === 3) {
    // M4: stop the fleeing courier, grab the ledger, bring it home.
    const c = D.courier;
    if (G.missionStage === 0) {
      if (!c || c.dead) { failMission(G, 'The courier got away'); return; }
      marker(G, c.x, c.y, 'Stop the courier');
      if (dist(c.x, c.y, D.fleeTarget.x, D.fleeTarget.y) < 80) {
        D.fleeTarget = { x: 200 + Math.random() * 2000, y: 200 + Math.random() * 1300 };
      }
      roadDrive(c, D.fleeTarget.x, D.fleeTarget.y, dt, c.top * 0.9);
      if (c.stopped) {
        G.missionStage = 1;
        G.pickups.push(makePickup(c.x, c.y, 'ledger', 0));
        G.banner('Courier stopped — grab the ledger!', '#f1c40f');
      }
    } else if (G.missionStage === 1) {
      marker(G, c.x, c.y, 'Grab the ledger');
      if (D.hasLedger || G.missionData.hasLedger) G.missionStage = 2;
      else if (G.missionData.ledgerTaken) G.missionStage = 2;
    } else {
      marker(G, PLACES.home.x, PLACES.home.y, 'Bring the ledger home');
      if (dist(P.x, P.y, PLACES.home.x, PLACES.home.y) < 80) completeMission(G);
    }
  } else if (i === 4) {
    // M5: stop the bank van, collect 3 cash bags, reach the stash at wanted 3.
    const v = D.van;
    if (G.missionStage === 0) {
      if (!v || v.dead) { failMission(G, 'The van got away'); return; }
      marker(G, v.x, v.y, 'Stop the bank van');
      const wp = D.route[D.routeIdx];
      const d = roadDrive(v, wp.x, wp.y, dt, v.top * 0.8);
      if (d < 70) D.routeIdx = (D.routeIdx + 1) % D.route.length;
      if (v.stopped) {
        G.missionStage = 1;
        D.bags = 0;
        for (let k = 0; k < 3; k++) {
          G.pickups.push(makePickup(v.x + (k - 1) * 50, v.y + 40, 'bag', 0));
        }
        G.banner('Van stopped — grab all 3 cash bags!', '#f1c40f');
      }
    } else if (G.missionStage === 1) {
      marker(G, v.x, v.y, `Cash bags: ${D.bags || 0}/3`);
      if ((D.bags || 0) >= 3) {
        G.missionStage = 2;
        P.wanted = Math.max(P.wanted, 3);
        G.banner('Heat is on — reach the stash!', '#e74c3c');
      }
    } else {
      marker(G, PLACES.home.x, PLACES.home.y, 'Reach the stash');
      if (dist(P.x, P.y, PLACES.home.x, PLACES.home.y) < 80) completeMission(G);
    }
  }
}

// --- side jobs ---
export function updateSideJobs(G, dt) {
  // Taxi: a waving pedestrian appears now and then while the player drives.
  G.taxiTimer = (G.taxiTimer || 8) - dt;
  if (!G.taxi && G.player.car && G.taxiTimer <= 0) {
    G.taxiTimer = 14 + Math.random() * 10;
    const ix = nearestIntersection(G.player.x + (Math.random() - 0.5) * 700, G.player.y + (Math.random() - 0.5) * 500);
    const ped = makePed(Math.floor(Math.random() * 8), ix.x + 60, ix.y + 60);
    ped.state = 'taxi';
    G.peds.push(ped);
    G.taxiRider = ped;
  }
  if (G.taxi) {
    const t = G.taxi;
    marker(G, t.dest.x, t.dest.y, `Taxi: ${t.fare}$`);
    if (dist(G.player.x, G.player.y, t.dest.x, t.dest.y) < 60) {
      G.player.money += t.fare;
      G.banner(`Taxi fare +$${t.fare}`, '#2ecc71');
      G.audio.sfx('cash');
      const rider = G.taxiRider;
      if (rider) { rider.state = 'walk'; rider.x = G.player.x + 40; rider.y = G.player.y + 40; }
      G.taxi = null;
      G.taxiRider = null;
      G.taxiCooldown = 10;
    }
  }
  G.taxiCooldown = Math.max(0, (G.taxiCooldown || 0) - dt);

  // Courier: start at the depot with E, then three timed drops.
  if (G.courier) {
    const c = G.courier;
    let allDone = true;
    for (const d of c.drops) {
      if (d.done) continue;
      allDone = false;
      d.timer -= dt;
      if (d.timer <= 0) {
        G.banner('A parcel went late — courier job over', '#e74c3c');
        G.courier = null;
        return;
      }
      if (dist(G.player.x, G.player.y, d.x, d.y) < 60) {
        d.done = true;
        G.player.money += PAYOUTS.parcel;
        G.banner(`Parcel delivered +$${PAYOUTS.parcel}`, '#2ecc71');
        G.audio.sfx('cash');
      }
    }
    if (allDone) {
      G.player.money += PAYOUTS.parcelBonus;
      G.banner(`All parcels done! Bonus +$${PAYOUTS.parcelBonus}`, '#2ecc71');
      G.courier = null;
    } else {
      const next = c.drops.find((d) => !d.done);
      if (next) marker(G, next.x, next.y, `Parcel (${Math.ceil(next.timer)}s)`);
    }
  }
}

export function startCourierJob(G) {
  const drops = [];
  for (let k = 0; k < 3; k++) {
    const ix = nearestIntersection(Math.random() * 2600, Math.random() * 1800);
    drops.push({ x: ix.x, y: ix.y, done: false, timer: 75 });
  }
  G.courier = { drops };
  G.banner('Courier job: deliver 3 parcels in time', '#f1c40f');
  G.audio.sfx('start');
}

export function pickUpTaxi(G) {
  const rider = G.taxiRider;
  if (!rider || G.taxi || (G.taxiCooldown || 0) > 0) return false;
  if (dist(G.player.x, G.player.y, rider.x, rider.y) > 90) return false;
  const ix = nearestIntersection(G.player.x + (Math.random() - 0.5) * 1600, G.player.y + (Math.random() - 0.5) * 1200);
  const fare = PAYOUTS.taxiBase + Math.round(dist(G.player.x, G.player.y, ix.x, ix.y) * 0.06);
  G.taxi = { dest: { x: ix.x, y: ix.y }, fare };
  rider.state = 'rider';
  G.banner(`Taxi: take the rider to the marker — $${fare}`, '#f1c40f');
  G.audio.sfx('pickup');
  return true;
}
