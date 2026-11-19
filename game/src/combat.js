// Combat: pistol shots, punches, damage and the wanted level.
// A shot is a hitscan tracer with a short travel delay feel; punch is melee.
import { CFG } from './config.js';
import { angleTo, clamp, dist } from './random.js';
import { scarePeds } from './entities.js';

export function shoot(G, tx, ty) {
  const p = G.player;
  if (p.shootCd > 0 || p.ammo <= 0) return false;
  p.ammo -= 1;
  p.shootCd = 0.28;
  const from = p.inCar ? p.inCar : p;
  const a = angleTo(from.x, from.y, tx, ty);
  const range = CFG.bulletRange;
  // find the nearest thing the bullet hits along the ray
  let best = null, bestD = range;
  const targets = [];
  for (const b of G.breakers) if (!b.dead) targets.push({ x: b.x, y: b.y, r: 22, ref: b, kind: 'breaker' });
  for (const c of G.cars) {
    if (c === p.inCar || c.dead) continue;
    targets.push({ x: c.x, y: c.y, r: 30, ref: c, kind: 'car' });
  }
  for (const o of G.officers) if (!o.dead) targets.push({ x: o.x, y: o.y, r: 14, ref: o, kind: 'officer' });
  for (const ped of G.peds) if (!ped.dead) targets.push({ x: ped.x, y: ped.y, r: 12, ref: ped, kind: 'ped' });
  for (const t of targets) {
    const dx = t.x - from.x, dy = t.y - from.y;
    const along = dx * Math.cos(a) + dy * Math.sin(a);
    if (along < 0 || along > range) continue;
    const perp = Math.abs(-dx * Math.sin(a) + dy * Math.cos(a));
    if (perp < t.r && along < bestD) { best = t; bestD = along; }
  }
  const ex = from.x + Math.cos(a) * bestD, ey = from.y + Math.sin(a) * bestD;
  G.tracers.push({ x1: from.x, y1: from.y, x2: ex, y2: ey, t: 0.12 });
  G.muzzle = 0.06;
  if (best) damageTarget(G, best, CFG.bulletDamage);
  G.audio.shot();
  scarePeds(G, ex, ey, CFG.gunshotHeard);
  // gunfire draws the law, but not a full star per bullet: at most one
  // star per 5 seconds of shooting
  if (G.now - (G.lastShotWantedAt || -99) > 5) {
    raiseWanted(G, 1);
    G.lastShotWantedAt = G.now;
  }
  return true;
}

export function punch(G, tx, ty) {
  const p = G.player;
  if (p.punchCd > 0 || p.inCar) return false;
  p.punchCd = 0.45;
  const a = angleTo(p.x, p.y, tx, ty);
  const hx = p.x + Math.cos(a) * 46, hy = p.y + Math.sin(a) * 46;
  for (const ped of G.peds) {
    if (!ped.dead && dist(ped.x, ped.y, hx, hy) < 30) {
      ped.hp -= CFG.punchDamage;
      if (ped.hp <= 0) { ped.dead = true; raiseWanted(G, 1); }
      G.audio.thud();
      return true;
    }
  }
  for (const o of G.officers) {
    if (!o.dead && dist(o.x, o.y, hx, hy) < 30) {
      o.hp -= CFG.punchDamage;
      if (o.hp <= 0) o.dead = true;
      raiseWanted(G, 1);
      G.audio.thud();
      return true;
    }
  }
  G.audio.swing();
  return true;
}

function damageTarget(G, t, dmg) {
  const ref = t.ref;
  if (t.kind === 'breaker') {
    ref.hp -= dmg;
    if (ref.hp <= 0) ref.dead = true;
  } else if (t.kind === 'car') {
    ref.hp -= dmg;
    if (ref.hp <= 0 && !ref.dead) {
      ref.dead = true;
      if (ref.driver === 'courier' || ref.driver === 'van') {
        // mission vehicles stop when wrecked; their drivers bail out
        ref.speed = 0;
      }
    }
  } else if (t.kind === 'officer') {
    ref.hp -= dmg;
    if (ref.hp <= 0) ref.dead = true;
    raiseWanted(G, 1);
  } else if (t.kind === 'ped') {
    ref.hp -= dmg;
    if (ref.hp <= 0) { ref.dead = true; raiseWanted(G, 1); }
  }
}

export function raiseWanted(G, n) {
  const p = G.player;
  const before = p.wanted;
  p.wanted = clamp(p.wanted + n, 0, 5);
  if (p.wanted > before) {
    G.wantedTimer = 0;
    // one fresh police car per new star, capped by live count
    const live = G.cars.filter((c) => c.police && !c.dead).length;
    if (live < p.wanted) G.spawnPolice();
    if (p.wanted >= 3 && G.officers.filter((o) => !o.dead).length < 2) G.spawnOfficer();
  }
}

export function hurtPlayer(G, dmg) {
  const p = G.player;
  if (G.screen !== 'playing') return;
  p.hp -= dmg;
  G.audio.hurt();
  if (p.hp <= 0) {
    p.hp = 0;
    if (G.mission.active) {
      const id = G.mission.id;
      G.mission = { id: 0, stage: 0, timer: 0, data: {}, active: false };
      G.objective = `You were wasted during job ${id}. See Vera to try again.`;
    }
    G.screen = 'wasted';
    G.money = Math.max(0, G.money - CFG.respawnFine);
  }
}

export function bustPlayer(G) {
  const p = G.player;
  if (G.screen !== 'playing') return;
  p.wanted = 0;
  G.money = Math.max(0, G.money - CFG.bustedFine);
  if (G.mission.active) {
    G.mission = { id: 0, stage: 0, timer: 0, data: {}, active: false };
    G.objective = 'Busted. The job is off. See Vera to try again.';
  }
  G.screen = 'busted';
}
