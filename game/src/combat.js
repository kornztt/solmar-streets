// Shooting, punching and ram damage.
import { dist, angleTo, angleDiff } from './random.js';
import { explodeCar, hurtPlayer, makePickup, makeParticle } from './entities.js';

const PISTOL_RANGE = 430;
const PISTOL_DMG = 34;
const PUNCH_RANGE = 48;
const PUNCH_DMG = 18;

// Fire the pistol toward the mouse. Hits the nearest enemy, car or ped on the ray.
export function tryShoot(G) {
  if (G.player.ammo <= 0) {
    G.audio.sfx('dryfire');
    return false;
  }
  if (G.time - (G.lastShotAt || 0) < 0.32) return false;
  G.lastShotAt = G.time;
  G.player.ammo -= 1;
  G.shotsFiredAt = G.time;
  const ox = G.player.x;
  const oy = G.player.y;
  const a = Math.atan2(G.mouse.wy - oy, G.mouse.wx - ox);
  G.audio.sfx('shot');
  G.muzzle = { x: ox + Math.cos(a) * 26, y: oy + Math.sin(a) * 26, t: 0.07, angle: a };
  // Find the closest thing on the ray.
  let best = null;
  let bestD = PISTOL_RANGE;
  const consider = (x, y, r, kind, ref) => {
    const dx = x - ox;
    const dy = y - oy;
    const along = dx * Math.cos(a) + dy * Math.sin(a);
    if (along < 0 || along > bestD) return;
    const perp = Math.abs(-dx * Math.sin(a) + dy * Math.cos(a));
    if (perp < r + 8 && along < bestD) { bestD = along; best = { kind, ref, x, y }; }
  };
  for (const e of G.enemies) consider(e.x, e.y, 13, 'enemy', e);
  for (const c of G.cars) {
    if (c === G.player.car) continue;
    consider(c.x, c.y, 24, 'car', c);
  }
  for (const p of G.peds) {
    if (p.state === 'rider') continue;
    consider(p.x, p.y, 10, 'ped', p);
  }
  G.tracer = { x1: ox, y1: oy, x2: ox + Math.cos(a) * bestD, y2: oy + Math.sin(a) * bestD, t: 0.08 };
  if (!best) return true;
  if (best.kind === 'enemy') {
    best.ref.hp -= PISTOL_DMG;
    sparks(G, best.x, best.y);
    if (best.ref.hp <= 0) {
      G.enemies = G.enemies.filter((e) => e !== best.ref);
      G.pickups.push(makePickup(best.x, best.y, 'cash', 30 + Math.floor(Math.random() * 30)));
      G.player.kills = (G.player.kills || 0) + 1;
    }
  } else if (best.kind === 'car') {
    damageCar(G, best.ref, PISTOL_DMG);
  } else if (best.kind === 'ped') {
    best.ref.hp = (best.ref.hp ?? 30) - PISTOL_DMG;
    if (best.ref.hp <= 0) {
      G.peds = G.peds.filter((p) => p !== best.ref);
      G.player.wanted = Math.min(5, G.player.wanted + 1);
      G.pickups.push(makePickup(best.x, best.y, 'cash', 20));
      G.banner('You hurt a bystander — the police are coming', '#e74c3c');
    } else {
      best.ref.state = 'flee';
      best.ref.fleeX = best.x + (best.x - ox);
      best.ref.fleeY = best.y + (best.y - oy);
    }
  }
  return true;
}

export function tryPunch(G) {
  if (G.time - (G.lastPunchAt || 0) < 0.5) return false;
  G.lastPunchAt = G.time;
  const a = Math.atan2(G.mouse.wy - G.player.y, G.mouse.wx - G.player.x);
  G.audio.sfx('punch');
  let hit = false;
  for (const e of [...G.enemies]) {
    if (dist(e.x, e.y, G.player.x, G.player.y) < PUNCH_RANGE) {
      e.hp -= PUNCH_DMG;
      sparks(G, e.x, e.y);
      hit = true;
      if (e.hp <= 0) {
        G.enemies = G.enemies.filter((x) => x !== e);
        G.pickups.push(makePickup(e.x, e.y, 'cash', 30));
      }
    }
  }
  for (const p of [...G.peds]) {
    if (p.state !== 'rider' && dist(p.x, p.y, G.player.x, G.player.y) < PUNCH_RANGE) {
      p.state = 'flee';
      p.fleeX = p.x + (p.x - G.player.x) * 3;
      p.fleeY = p.y + (p.y - G.player.y) * 3;
      G.player.wanted = Math.min(5, G.player.wanted + 1);
      hit = true;
    }
  }
  return hit;
}

// Damage a car; mission targets report the hit back to the mission.
export function damageCar(G, car, dmg) {
  car.hp -= dmg;
  sparks(G, car.x, car.y);
  if (car.hp <= 0 && !car.dead) {
    if (car.driver === 'courier' || car.driver === 'van') {
      car.hp = 1; // mission targets stop, they do not explode
      car.speed = 0;
      car.stopped = true;
      G.audio.sfx('crash');
      return 'stopped';
    }
    explodeCar(G, car);
    return 'exploded';
  }
  return 'hit';
}

export function sparks(G, x, y) {
  for (let i = 0; i < 8; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 80 + Math.random() * 160;
    G.particles.push(makeParticle(x, y, Math.cos(a) * s, Math.sin(a) * s, 0.25, '#f1c40f', 3));
  }
}

// Ram damage between the player's car and another car.
export function ramCheck(G, dt) {
  const pc = G.player.car;
  if (!pc) return;
  for (const c of G.cars) {
    if (c === pc || c.dead) continue;
    if (dist(c.x, c.y, pc.x, pc.y) < 48) {
      const rel = Math.abs(pc.speed - c.speed) + 40;
      if (rel > 130 && G.time - (G.lastRamAt || 0) > 0.35) {
        G.lastRamAt = G.time;
        G.audio.sfx('crash');
        const res = damageCar(G, c, (rel - 110) * 0.35);
        pc.hp -= (rel - 110) * 0.12;
        if (pc.hp <= 0) explodeCar(G, pc);
        if (res === 'stopped') G.banner('Target stopped!', '#f1c40f');
        // Shove both cars apart a little.
        const a = angleTo(c.x, c.y, pc.x, pc.y);
        pc.x += Math.cos(a) * 8;
        pc.y += Math.sin(a) * 8;
      }
    }
  }
}
