// Entity factories and AI: traffic cars, pedestrians, police and enemies.
import { CAR_MODELS, PED_TYPES, PLACES } from './config.js';
import { clamp, dist, angleDiff, angleTo } from './random.js';
import { collideBuildings, roadDrive, nearestIntersection, onRoad } from './city.js';

let nextId = 1;

export function makeCar(modelIdx, x, y, angle, driver) {
  const model = CAR_MODELS[modelIdx % CAR_MODELS.length];
  return {
    id: nextId++,
    model: modelIdx % CAR_MODELS.length,
    name: model.name,
    color: model.colors[Math.floor(Math.random() * model.colors.length)],
    x, y, angle, speed: 0,
    top: model.top, accel: model.accel, turn: model.turn,
    hp: model.hp, maxHp: model.hp,
    driver, // 'player' | 'traffic' | 'police' | 'courier' | 'van' | 'parked'
    target: null, // road-drive destination {x,y}
    w: 44, h: 22,
    dead: false,
  };
}

export function makePed(typeIdx, x, y) {
  const t = PED_TYPES[typeIdx % PED_TYPES.length];
  return {
    id: nextId++,
    type: typeIdx % PED_TYPES.length,
    name: t.name, color: t.color, speed: t.speed, size: t.size,
    x, y, angle: Math.random() * Math.PI * 2,
    state: 'walk', // walk | flee | taxi (waving) | rider
    fleeX: 0, fleeY: 0,
    dest: null,
  };
}

export function makeBreaker(x, y) {
  return { id: nextId++, x, y, angle: 0, hp: 60, speed: 55, cooldown: 1.8, kind: 'breaker' };
}

export function makePickup(x, y, kind, amount) {
  return { id: nextId++, x, y, kind, amount, t: 0 }; // kind: 'cash' | 'bag' | 'ledger'
}

export function makeParticle(x, y, vx, vy, life, color, size) {
  return { x, y, vx, vy, life, maxLife: life, color, size };
}

// --- traffic ---
export function updateTraffic(G, dt) {
  for (const car of G.cars) {
    if (car.driver !== 'traffic') continue;
    if (!car.target || dist(car.x, car.y, car.target.x, car.target.y) < 60) {
      const ix = nearestIntersection(car.x + (Math.random() - 0.5) * 900, car.y + (Math.random() - 0.5) * 700);
      car.target = ix;
    }
    const cruise = car.top * 0.28;
    roadDrive(car, car.target.x, car.target.y, dt, cruise);
    collideBuildings(G.city, car, 20);
  }
}

// --- pedestrians ---
export function updatePeds(G, dt) {
  for (const p of G.peds) {
    if (p.state === 'rider') continue;
    // Flee from gunfire, fast cars and the player when wanted is high.
    // Taxi riders and passengers never flee — they are waiting for a fare.
    const threat = G.shotsFiredAt > G.time - 1.2;
    const nearCar = G.player.car && dist(p.x, p.y, G.player.car.x, G.player.car.y) < 90 && Math.abs(G.player.car.speed) > 120;
    if ((threat || nearCar) && p.state !== 'flee' && p.state !== 'taxi' && p.state !== 'rider') {
      p.state = 'flee';
      const a = angleTo(G.player.x, G.player.y, p.x, p.y);
      p.fleeX = p.x + Math.cos(a) * 260;
      p.fleeY = p.y + Math.sin(a) * 260;
    }
    if (p.state === 'flee') {
      const a = angleTo(p.x, p.y, p.fleeX, p.fleeY);
      p.angle = a;
      p.x += Math.cos(a) * p.speed * 2.1 * dt;
      p.y += Math.sin(a) * p.speed * 2.1 * dt;
      if (dist(p.x, p.y, p.fleeX, p.fleeY) < 30 || (!threat && !nearCar)) p.state = 'walk';
    } else {
      // Stroll along the sidewalk: keep near a road, drift along it.
      if (!p.dest || dist(p.x, p.y, p.dest.x, p.dest.y) < 40) {
        const ix = nearestIntersection(p.x + (Math.random() - 0.5) * 700, p.y + (Math.random() - 0.5) * 500);
        p.dest = { x: ix.x + (Math.random() - 0.5) * 50, y: ix.y + (Math.random() - 0.5) * 50 };
      }
      const a = angleTo(p.x, p.y, p.dest.x, p.dest.y);
      p.angle += angleDiff(p.angle, a) * Math.min(1, 4 * dt);
      p.x += Math.cos(p.angle) * p.speed * dt;
      p.y += Math.sin(p.angle) * p.speed * dt;
    }
    collideBuildings(G.city, p, p.size);
    p.x = clamp(p.x, 16, 2584);
    p.y = clamp(p.y, 16, 1784);
  }
  // Keep the streets populated.
  if (G.peds.length < 26 && Math.random() < dt * 0.5) {
    const ix = nearestIntersection(Math.random() * 2600, Math.random() * 1800);
    G.peds.push(makePed(Math.floor(Math.random() * PED_TYPES.length), ix.x + (Math.random() - 0.5) * 80, ix.y + (Math.random() - 0.5) * 80));
  }
}

// --- police ---
export function updatePolice(G, dt) {
  const want = G.player.wanted;
  const wantCount = Math.min(4, want);
  // Spawn up to the wanted count.
  if (G.police.length < wantCount && Math.random() < dt * 0.8) {
    const a = Math.random() * Math.PI * 2;
    const x = clamp(G.player.x + Math.cos(a) * 520, 60, 2540);
    const y = clamp(G.player.y + Math.sin(a) * 520, 60, 1740);
    const car = makeCar(Math.floor(Math.random() * 6), x, y, 0, 'police');
    car.color = '#1f2a44';
    car.top = 400;
    G.police.push(car);
    G.cars.push(car);
  }
  for (const car of G.police) {
    if (car.dead) continue;
    const target = G.player.car || G.player;
    roadDrive(car, target.x, target.y, dt, car.top * (0.85 + want * 0.04));
    collideBuildings(G.city, car, 20);
    // Ram damage on contact with the player's car.
    if (G.player.car && dist(car.x, car.y, G.player.car.x, G.player.car.y) < 46) {
      G.player.car.hp -= 26 * dt;
      if (G.player.car.hp <= 0) explodeCar(G, G.player.car);
      // Push the police car back a touch so it does not stick.
      const a = angleTo(G.player.car.x, G.player.car.y, car.x, car.y);
      car.x += Math.cos(a) * 30 * dt;
      car.y += Math.sin(a) * 30 * dt;
    }
    // On-foot player: a touch costs health.
    if (!G.player.car && dist(car.x, car.y, G.player.x, G.player.y) < 34) {
      hurtPlayer(G, 14 * dt);
    }
  }
  // Remove police when the heat is gone.
  if (want === 0) {
    for (const car of G.police) car.dead = true;
    G.police = [];
    G.cars = G.cars.filter((c) => c.driver !== 'police');
  } else {
    G.police = G.police.filter((c) => !c.dead);
  }
}

export function explodeCar(G, car) {
  if (car.dead) return;
  car.dead = true;
  for (let i = 0; i < 26; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 60 + Math.random() * 220;
    G.particles.push(makeParticle(car.x, car.y, Math.cos(a) * s, Math.sin(a) * s, 0.5 + Math.random() * 0.5, i % 3 ? '#f39c12' : '#e74c3c', 3 + Math.random() * 4));
  }
  G.audio.sfx('explosion');
  if (car === G.player.car) {
    G.player.car = null;
    G.player.onFoot = true;
    G.player.x = car.x + 30;
    G.player.y = car.y + 30;
    hurtPlayer(G, 25);
    G.banner('Your car blew up!', '#e74c3c');
  }
}

export function hurtPlayer(G, dmg) {
  if (G.player.hp <= 0) return;
  G.player.hp -= dmg;
  if (G.player.hp <= 0) {
    G.player.hp = 0;
    G.mode = 'wasted';
    G.audio.sfx('wasted');
  }
}

// --- enemies (Breakers) ---
export function updateEnemies(G, dt) {
  for (const e of G.enemies) {
    e.cooldown -= dt;
    const d = dist(e.x, e.y, G.player.x, G.player.y);
    if (d > 420) {
      // Walk toward the player.
      const a = angleTo(e.x, e.y, G.player.x, G.player.y);
      e.angle = a;
      e.x += Math.cos(a) * e.speed * dt;
      e.y += Math.sin(a) * e.speed * dt;
    } else if (e.cooldown <= 0) {
      e.cooldown = 1.1 + Math.random() * 0.5;
      e.angle = angleTo(e.x, e.y, G.player.x, G.player.y);
      // Enemy shot: a visible tracer the player can dodge by moving.
      G.enemyShots.push({ x: e.x, y: e.y, angle: e.angle, speed: 520, life: 1.2 });
      G.audio.sfx('eshot');
    }
    collideBuildings(G.city, e, 12);
  }
  // Enemy bullets.
  for (const s of G.enemyShots) {
    s.x += Math.cos(s.angle) * s.speed * dt;
    s.y += Math.sin(s.angle) * s.speed * dt;
    s.life -= dt;
    if (dist(s.x, s.y, G.player.x, G.player.y) < 16) {
      s.life = 0;
      hurtPlayer(G, 5);
      G.audio.sfx('hit');
    }
  }
  G.enemyShots = G.enemyShots.filter((s) => s.life > 0);
}

// --- pickups & particles ---
export function updatePickups(G, dt) {
  for (const p of G.pickups) {
    p.t += dt;
    const d = dist(p.x, p.y, G.player.x, G.player.y);
    const reach = G.player.car ? 60 : 34;
    if (d < reach) {
      p.taken = true;
      if (p.kind === 'cash') {
        G.player.money += p.amount;
        G.banner(`+$${p.amount}`, '#2ecc71');
        G.audio.sfx('cash');
      } else if (p.kind === 'ledger') {
        G.missionData.ledgerTaken = true;
        G.missionData.hasLedger = true;
        G.banner('Ledger grabbed — bring it home', '#f1c40f');
        G.audio.sfx('pickup');
      } else if (p.kind === 'bag') {
        G.missionData.bags = (G.missionData.bags || 0) + 1;
        G.banner(`Cash bag ${G.missionData.bags}/3`, '#f1c40f');
        G.audio.sfx('pickup');
      }
    }
  }
  G.pickups = G.pickups.filter((p) => !p.taken);
  for (const pt of G.particles) {
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx *= 0.96;
    pt.vy *= 0.96;
    pt.life -= dt;
  }
  G.particles = G.particles.filter((pt) => pt.life > 0);
}
