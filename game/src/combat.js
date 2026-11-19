// Combat: fists on foot (Space), pistol aimed with the mouse (click).
// Hitting a pedestrian or firing in the open raises the wanted level;
// rivals and the courier take damage like anyone else.

import { PRICES } from './config.js';
import { dist } from './random.js';

export class Combat {
  constructor(entities, missions, world) {
    this.entities = entities;
    this.missions = missions;
    this.world = world;
    this.punchCd = 0;
    this.shotCd = 0;
  }

  update(dt, input, mouseWorld) {
    this.punchCd = Math.max(0, this.punchCd - dt);
    this.shotCd = Math.max(0, this.shotCd - dt);
    const p = this.entities.player;
    if (p.dead || p.inCar) return;
    if (input.pressed('Space') && this.punchCd <= 0) this.punch(input);
    if (input.mouseClicked && this.shotCd <= 0) this.shoot(mouseWorld, input);
  }

  punch(input) {
    const p = this.entities.player;
    this.punchCd = 0.38;
    this.world.audio.play('punch');
    const reach = 52;
    const px = p.x + Math.cos(p.angle) * reach * 0.6;
    const py = p.y + Math.sin(p.angle) * reach * 0.6;
    let hit = false;
    const tryHit = (t, hpKey) => {
      if (t.dead) return;
      const d = dist(px, py, t.x, t.y);
      const facing = Math.abs(((Math.atan2(t.y - p.y, t.x - p.x) - p.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      if (d < reach && facing < 1.1) {
        t[hpKey] = Math.max(0, t[hpKey] - PRICES.punchDamage);
        this.world.particles.burst(t.x, t.y, '#ffffff', 6);
        this.world.audio.play('hit');
        hit = true;
        if (t[hpKey] <= 0) this.onKill(t);
      }
    };
    for (const ped of this.entities.peds) tryHit(ped, 'hp');
    for (const e of this.missions.enemies) tryHit(e, 'hp');
    if (!hit) this.world.particles.burst(px, py, '#cccccc', 3);
  }

  shoot(mouseWorld, input) {
    const p = this.entities.player;
    if (p.ammo <= 0) {
      this.world.toast('No ammo — visit the Gun Barn');
      this.world.audio.play('empty');
      this.shotCd = 0.3;
      return;
    }
    p.ammo -= 1;
    this.shotCd = 0.22;
    this.world.audio.play('shot');
    const aim = Math.atan2(mouseWorld.y - p.y, mouseWorld.x - p.x);
    p.angle = aim;
    const range = 520;
    const ex = p.x + Math.cos(aim) * range;
    const ey = p.y + Math.sin(aim) * range;
    this.world.particles.tracer(p.x, p.y, ex, ey);
    // Nearest target along the aim line takes the bullet.
    let best = null;
    let bestD = range;
    const consider = (t) => {
      if (t.dead) return;
      const dx = t.x - p.x;
      const dy = t.y - p.y;
      const along = dx * Math.cos(aim) + dy * Math.sin(aim);
      if (along < 0 || along > range) return;
      const perp = Math.abs(-dx * Math.sin(aim) + dy * Math.cos(aim));
      if (perp < 26 && along < bestD) {
        bestD = along;
        best = t;
      }
    };
    for (const ped of this.entities.peds) consider(ped);
    for (const e of this.missions.enemies) consider(e);
    if (this.missions.courier && !this.missions.courier.dead) {
      const c = this.missions.courier;
      const dx = c.x - p.x;
      const dy = c.y - p.y;
      const along = dx * Math.cos(aim) + dy * Math.sin(aim);
      const perp = Math.abs(-dx * Math.sin(aim) + dy * Math.cos(aim));
      if (along > 0 && along < bestD && perp < 40) {
        best = c;
        bestD = along;
      }
    }
    if (best) {
      best.hp = Math.max(0, best.hp - PRICES.pistolDamage);
      this.world.particles.burst(best.x, best.y, '#ff6b6b', 8);
      this.world.raiseWanted(1, 'shots fired');
      if (best.hp <= 0) this.onKill(best);
    }
  }

  onKill(t) {
    t.dead = true;
    const p = this.entities.player;
    if (t.kind === 'breaker') {
      p.money += 50;
      this.world.toast('Breaker down! +$50');
      this.world.particles.burst(t.x, t.y, '#ffd166', 12);
    } else if (t.kind === 'courier') {
      // Courier is handled by the mission (car stops, ledger drops).
    } else {
      // A civilian went down.
      this.world.raiseWanted(1, 'a pedestrian was hurt');
      this.world.particles.burst(t.x, t.y, '#ff6b6b', 10);
    }
    // Nearby peds run.
    for (const ped of this.entities.peds) {
      if (!ped.dead && dist(ped.x, ped.y, t.x, t.y) < 300) {
        ped.flee = 3;
        ped.angle = Math.atan2(ped.y - t.y, ped.x - t.x);
      }
    }
  }
}
