// Combat: pistol, punching, wanted level, police pursuit, WASTED / BUSTED.
import { CFG } from './config.js';
import { clamp, dist, angTo, angDiff, RNG } from './random.js';
import { hitsBuilding, nearestRoadPoint, randomRoadPoint } from './city.js';
import { toast } from './missions.js';

export function addHeat(G, n) {
  G.heat = clamp(G.heat + n, 0, 100);
  const stars = G.heat >= 90 ? 5 : G.heat >= 70 ? 4 : G.heat >= 50 ? 3 : G.heat >= 30 ? 2 : G.heat >= 12 ? 1 : 0;
  if (stars > G.wanted) toast(G, `Wanted level ${stars} — the police are coming.`);
  G.wanted = stars;
}

export function tryPunch(G) {
  const p = G.player;
  if (!p.onFoot || p.punchT > 0) return false;
  p.punchT = 0.35;
  const px = p.x + Math.cos(p.angle) * 30;
  const py = p.y + Math.sin(p.angle) * 30;
  let hit = false;
  for (let i = G.peds.length - 1; i >= 0; i--) {
    const ped = G.peds[i];
    if (dist(px, py, ped.x, ped.y) < CFG.punchRange) {
      G.peds.splice(i, 1);
      addHeat(G, 40);
      G.stats.kills++;
      spawnBlood(G, ped.x, ped.y);
      hit = true;
    }
  }
  for (let i = G.mission.breakers.length - 1; i >= 0; i--) {
    const b = G.mission.breakers[i];
    if (dist(px, py, b.x, b.y) < CFG.punchRange) {
      b.hp -= CFG.punchDamage;
      hit = true;
      if (b.hp <= 0) {
        G.mission.breakers.splice(i, 1);
        G.stats.kills++;
        spawnBlood(G, b.x, b.y);
        toast(G, 'Breaker down!');
      }
    }
  }
  return hit;
}

export function tryShoot(G, wx, wy) {
  const p = G.player;
  if (!p.onFoot || p.shootT > 0 || G.ammo <= 0) return false;
  p.shootT = 0.22;
  G.ammo--;
  const a = angTo(p.x, p.y, wx, wy);
  G.bullets.push({
    x: p.x + Math.cos(a) * 22, y: p.y + Math.sin(a) * 22,
    vx: Math.cos(a) * CFG.bulletSpeed, vy: Math.sin(a) * CFG.bulletSpeed,
    left: CFG.bulletRange, from: 'player', dmg: CFG.bulletDamage,
  });
  addHeat(G, 1);
  return true;
}

function spawnBlood(G, x, y) {
  for (let i = 0; i < 10; i++) {
    G.parts.push({ x, y, vx: (Math.random() - 0.5) * 160, vy: (Math.random() - 0.5) * 160, life: 0.5, color: '#c22525', size: 3 });
  }
}

function spawnSparks(G, x, y, color) {
  for (let i = 0; i < 6; i++) {
    G.parts.push({ x, y, vx: (Math.random() - 0.5) * 220, vy: (Math.random() - 0.5) * 220, life: 0.3, color, size: 2 });
  }
}

export function updateBullets(G, dt, city) {
  for (let i = G.bullets.length - 1; i >= 0; i--) {
    const b = G.bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.left -= Math.hypot(b.vx, b.vy) * dt;
    let dead = b.left <= 0;
    if (!dead && hitsBuilding(b.x, b.y, 2, city)) {
      spawnSparks(G, b.x, b.y, '#f2b705');
      dead = true;
    }
    if (!dead && b.from === 'player') {
      for (let j = G.mission.breakers.length - 1; j >= 0; j--) {
        const br = G.mission.breakers[j];
        if (dist(b.x, b.y, br.x, br.y) < 18) {
          br.hp -= b.dmg;
          spawnBlood(G, br.x, br.y);
          dead = true;
          if (br.hp <= 0) {
            G.mission.breakers.splice(j, 1);
            G.stats.kills++;
            toast(G, 'Breaker down!');
          }
          break;
        }
      }
      if (!dead && G.mission.courier) {
        const c = G.mission.courier;
        if (dist(b.x, b.y, c.x, c.y) < 30) {
          c.hp -= b.dmg;
          spawnSparks(G, b.x, b.y, '#e33f2f');
          dead = true;
        }
      }
      if (!dead) {
        for (let j = G.peds.length - 1; j >= 0; j--) {
          const ped = G.peds[j];
          if (dist(b.x, b.y, ped.x, ped.y) < 14) {
            G.peds.splice(j, 1);
            addHeat(G, 40);
            G.stats.kills++;
            spawnBlood(G, ped.x, ped.y);
            dead = true;
            break;
          }
        }
      }
    }
    if (!dead && b.from === 'enemy') {
      if (dist(b.x, b.y, G.player.x, G.player.y) < 16) {
        damagePlayer(G, b.dmg / 4);
        dead = true;
      }
    }
    if (dead) G.bullets.splice(i, 1);
  }
}

export function updateBreakers(G, dt) {
  for (const b of G.mission.breakers) {
    const d = dist(b.x, b.y, G.player.x, G.player.y);
    b.shootT -= dt;
    if (d < 420 && b.shootT <= 0) {
      b.shootT = 1.6 + Math.random() * 0.8;
      const a = angTo(b.x, b.y, G.player.x, G.player.y) + (Math.random() - 0.5) * 0.25;
      G.bullets.push({
        x: b.x, y: b.y,
        vx: Math.cos(a) * 520, vy: Math.sin(a) * 520,
        left: 460, from: 'enemy', dmg: 20,
      });
    }
    if (d > 200) {
      const a = angTo(b.x, b.y, G.player.x, G.player.y);
      b.x += Math.cos(a) * 55 * dt;
      b.y += Math.sin(a) * 55 * dt;
      b.angle = a;
    }
  }
}

// Courier flees from the player along the road network.
export function updateCourier(G, dt) {
  const m = G.mission;
  if (!m.courier) return;
  const c = m.courier;
  const d = dist(c.x, c.y, G.player.x, G.player.y);
  if (!c.wp || dist(c.x, c.y, c.wp.x, c.wp.y) < 20 || d < 90) {
    // Pick a waypoint away from the player.
    let best = null;
    let bd = -1;
    for (let i = 0; i < 6; i++) {
      const cand = randomRoadPoint(new RNG((Math.random() * 1e9) | 0));
      const dd = dist(cand.x, cand.y, G.player.x, G.player.y);
      if (dd > bd) { bd = dd; best = cand; }
    }
    c.wp = best;
  }
  const want = angTo(c.x, c.y, c.wp.x, c.wp.y);
  c.angle += clamp(angDiff(c.angle, want), -2.8 * dt, 2.8 * dt);
  c.speed = 235;
  c.x += Math.cos(c.angle) * c.speed * dt;
  c.y += Math.sin(c.angle) * c.speed * dt;
  c.x = clamp(c.x, 40, CFG.world - 40);
  c.y = clamp(c.y, 40, CFG.world - 40);
  // Ramming damage: the player's car hurting the courier.
  const pc = G.player.car;
  if (pc) {
    const dd = dist(c.x, c.y, pc.x, pc.y);
    if (dd < 52 && Math.abs(pc.speed) > 60) {
      c.hp -= Math.abs(pc.speed) * dt * 0.35;
      if (Math.random() < dt * 8) spawnSparks(G, (c.x + pc.x) / 2, (c.y + pc.y) / 2, '#f2b705');
      pc.speed *= 0.94;
    }
  }
}

export function damagePlayer(G, n) {
  if (G.screen !== 'playing') return;
  G.hp -= n;
  if (G.hp <= 0) {
    G.hp = 0;
    G.screen = 'wasted';
    G.over = { kind: 'wasted', t: 0 };
    toast(G, 'WASTED.');
  }
}

export function updateWanted(G, dt) {
  // Heat decays when no cop is near; faster when the player hides.
  let nearCop = false;
  for (const cop of G.cops) if (dist(cop.x, cop.y, G.player.x, G.player.y) < 700) { nearCop = true; break; }
  G.heat = clamp(G.heat - (nearCop ? 0.8 : 2.4) * dt, 0, 100);
  const stars = G.heat >= 90 ? 5 : G.heat >= 70 ? 4 : G.heat >= 50 ? 3 : G.heat >= 30 ? 2 : G.heat >= 12 ? 1 : 0;
  G.wanted = stars;
  // Match the cop count to the wanted level.
  const wantCars = Math.min(stars, 3);
  const wantOfficers = stars >= 3 ? stars - 2 : 0;
  const cars = G.cops.filter((c) => c.kind === 'car');
  const officers = G.cops.filter((c) => c.kind === 'officer');
  if (cars.length < wantCars) {
    const rp = nearestRoadPoint(G.player.x + (Math.random() < 0.5 ? -560 : 560), G.player.y + (Math.random() < 0.5 ? -420 : 420));
    const car = { model: 0, color: '#1c2733', x: rp.x, y: rp.y, angle: 0, speed: 200, hp: 120, maxHp: 120, kind: 'police', wp: null, driver: true, stuck: 0 };
    G.cops.push({ kind: 'car', x: rp.x, y: rp.y, angle: 0, speed: 200, car, bustT: 0 });
  }
  if (officers.length < wantOfficers) {
    const a = Math.random() * Math.PI * 2;
    G.cops.push({ kind: 'officer', x: G.player.x + Math.cos(a) * 320, y: G.player.y + Math.sin(a) * 320, angle: a, speed: 200, car: null, bustT: 0 });
  }
  if (G.wanted === 0) G.cops.length = 0;
}

export function updateCops(G, dt, city) {
  for (let i = G.cops.length - 1; i >= 0; i--) {
    const cop = G.cops[i];
    if (cop.kind === 'car') {
      const car = cop.car;
      const want = angTo(car.x, car.y, G.player.x, G.player.y);
      car.angle += clamp(angDiff(car.angle, want), -3.2 * dt, 3.2 * dt);
      car.speed = 268;
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      car.x = clamp(car.x, 30, CFG.world - 30);
      car.y = clamp(car.y, 30, CFG.world - 30);
      cop.x = car.x;
      cop.y = car.y;
      cop.angle = car.angle;
      const d = dist(car.x, car.y, G.player.x, G.player.y);
      if (d < 50) {
        // Ram! Hard enough to hurt, light enough to survive and escape.
        if (G.player.car) {
          const pc = G.player.car;
          pc.hp -= 14 * dt;
          pc.speed *= 0.9;
          if (Math.random() < dt * 6) spawnSparks(G, (car.x + pc.x) / 2, (car.y + pc.y) / 2, '#f2b705');
          if (pc.hp <= 0) {
            toast(G, 'Your car is wrecked!');
            G.player.car = null;
            G.player.onFoot = true;
            const idx = G.cars.indexOf(pc);
            if (idx >= 0) G.cars.splice(idx, 1);
            damagePlayer(G, 20);
          }
        } else {
          damagePlayer(G, 8 * dt);
        }
      }
    } else {
      // Officer on foot: chase and try to bust.
      const want = angTo(cop.x, cop.y, G.player.x, G.player.y);
      cop.angle = want;
      cop.x += Math.cos(want) * cop.speed * dt;
      cop.y += Math.sin(want) * cop.speed * dt;
      const d = dist(cop.x, cop.y, G.player.x, G.player.y);
      if (d < 42) {
        cop.bustT += dt;
        if (cop.bustT > 1.5 && G.player.onFoot) {
          G.screen = 'busted';
          G.over = { kind: 'busted', t: 0 };
          toast(G, 'BUSTED.');
        }
      } else {
        cop.bustT = 0;
      }
    }
  }
}
