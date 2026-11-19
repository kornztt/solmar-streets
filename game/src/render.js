// Rendering: the city, the cars, the people, the light.
// The camera follows the player; the day/night cycle tints the whole scene
// and switches on headlights after dark, so the same street looks different
// at noon, at dusk and at midnight.

import { BLOCK, ROAD, CITY, DAY_PHASES, ZOOM_FOOT, ZOOM_CAR, CAR_LENGTH, CAR_WIDTH } from './config.js';
import { clamp, lerp } from './random.js';

export class Particles {
  constructor() {
    this.list = [];
    this.tracers = [];
  }

  burst(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 60 + Math.random() * 180;
      this.list.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5, color });
    }
  }

  tracer(x1, y1, x2, y2) {
    this.tracers.push({ x1, y1, x2, y2, life: 0.12 });
  }

  update(dt) {
    for (const p of this.list) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.92;
      p.vy *= 0.92;
      p.life -= dt;
    }
    this.list = this.list.filter((p) => p.life > 0);
    for (const t of this.tracers) t.life -= dt;
    this.tracers = this.tracers.filter((t) => t.life > 0);
  }

  draw(ctx) {
    for (const p of this.list) {
      ctx.globalAlpha = Math.max(0, p.life * 2);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    }
    ctx.globalAlpha = 1;
    for (const t of this.tracers) {
      ctx.globalAlpha = Math.max(0, t.life / 0.12);
      ctx.strokeStyle = '#ffe66d';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(t.x1, t.y1);
      ctx.lineTo(t.x2, t.y2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}

// Which phase of the day is it, and how dark is the world?
export function daylight(hour) {
  for (const ph of DAY_PHASES) {
    if (hour >= ph.from && hour < ph.to) return ph;
  }
  return DAY_PHASES[3];
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.camX = 0;
    this.camY = 0;
    this.zoom = ZOOM_FOOT;
    this.shake = 0;
  }

  resize(w, h) {
    this.canvas.width = w;
    this.canvas.height = h;
  }

  addShake(amount) {
    this.shake = Math.min(10, this.shake + amount);
  }

  draw(world) {
    const { ctx, canvas } = this;
    const { entities, city, missions, particles } = world;
    const p = entities.player;
    const hour = world.hour;
    const phase = daylight(hour);
    const night = phase.name === 'night';

    // Camera: ease toward the player, zoom out in a car.
    const targetZoom = p.inCar ? ZOOM_CAR : ZOOM_FOOT;
    this.zoom += (targetZoom - this.zoom) * 0.06;
    this.camX += (p.x - this.camX) * 0.12;
    this.camY += (p.y - this.camY) * 0.12;
    this.shake = Math.max(0, this.shake - 0.5);
    const sx = (Math.random() - 0.5) * this.shake;
    const sy = (Math.random() - 0.5) * this.shake;

    ctx.save();
    ctx.fillStyle = phase.sky;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.camX + sx, -this.camY + sy);

    this.drawGround(ctx, city, phase);
    this.drawSites(ctx, city, world);
    this.drawMarkers(ctx, world);
    this.drawPeds(ctx, entities);
    this.drawEnemies(ctx, missions);
    this.drawCars(ctx, entities, world);
    this.drawPlayer(ctx, entities, world);
    particles.draw(ctx);
    if (night) this.drawNight(ctx, world);

    ctx.restore();

    // Daylight tint over everything (kept outside the world transform).
    if (phase.ambient < 1) {
      ctx.fillStyle = `rgba(20, 24, 60, ${(1 - phase.ambient) * 0.55})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    this.drawMinimap(ctx, world);
  }

  drawGround(ctx, city, phase) {
    const size = city.size;
    // Base: grass.
    ctx.fillStyle = '#5e8f5a';
    ctx.fillRect(-ROAD, -ROAD, size + ROAD * 2, size + ROAD * 2);
    // Blocks: sidewalk + inner ground.
    for (const b of city.blocks) {
      const c = { x: ROAD + b.bx * (BLOCK + ROAD), y: ROAD + b.by * (BLOCK + ROAD) };
      ctx.fillStyle = '#b8b0a4';
      ctx.fillRect(c.x, c.y, BLOCK, BLOCK);
      if (b.kind === 'park') {
        ctx.fillStyle = '#4e7d46';
        ctx.fillRect(c.x + 8, c.y + 8, BLOCK - 16, BLOCK - 16);
        ctx.fillStyle = '#3f6b3a';
        for (const t of b.trees) {
          ctx.beginPath();
          ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (b.kind === 'lot') {
        ctx.fillStyle = '#6d6d6d';
        ctx.fillRect(c.x + 8, c.y + 8, BLOCK - 16, BLOCK - 16);
        ctx.strokeStyle = '#e8e3d5';
        ctx.lineWidth = 2;
        for (const s of city.parkingSpots) {
          if (s.x > c.x && s.x < c.x + BLOCK && s.y > c.y && s.y < c.y + BLOCK) {
            ctx.strokeRect(s.x - 36, s.y - 18, 72, 36);
          }
        }
      } else {
        ctx.fillStyle = '#9a8f80';
        ctx.fillRect(c.x + 8, c.y + 8, BLOCK - 16, BLOCK - 16);
      }
      // Buildings with a soft shadow and a coloured roof.
      for (const bd of b.buildings) {
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(bd.x - bd.w / 2 + 6, bd.y - bd.h / 2 + 8, bd.w, bd.h);
        ctx.fillStyle = bd.color;
        ctx.fillRect(bd.x - bd.w / 2, bd.y - bd.h / 2, bd.w, bd.h);
        ctx.fillStyle = bd.roof;
        ctx.fillRect(bd.x - bd.w / 2 + 6, bd.y - bd.h / 2 + 6, bd.w - 12, bd.h - 12);
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.fillRect(bd.x - bd.w / 2 + 10, bd.y - bd.h / 2 + 10, bd.w - 20, 8);
      }
    }
    // Roads: asphalt + centre dashes.
    ctx.fillStyle = '#3a3f4a';
    for (let i = 0; i <= 8; i++) {
      const c = i * (BLOCK + ROAD) + ROAD / 2;
      ctx.fillRect(-ROAD, c - ROAD / 2, size + ROAD * 2, ROAD);
      ctx.fillRect(c - ROAD / 2, -ROAD, ROAD, size + ROAD * 2);
    }
    ctx.strokeStyle = '#e8d44d';
    ctx.lineWidth = 3;
    ctx.setLineDash([26, 22]);
    for (let i = 0; i <= 8; i++) {
      const c = i * (BLOCK + ROAD) + ROAD / 2;
      ctx.beginPath();
      ctx.moveTo(0, c);
      ctx.lineTo(size, c);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(c, 0);
      ctx.lineTo(c, size);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    // Harbour water along the south edge.
    ctx.fillStyle = '#2b6cb0';
    ctx.fillRect(-ROAD, size, size + ROAD * 2, 160);
    ctx.fillStyle = '#3182ce';
    for (let x = 0; x < size; x += 90) {
      ctx.fillRect(x + ((Date.now() / 40) % 90), size + 30, 46, 5);
      ctx.fillRect(x + ((Date.now() / 55 + 40) % 90), size + 90, 60, 5);
    }
    // Piers jutting into the water.
    ctx.fillStyle = '#8d6e63';
    ctx.fillRect(city.sites.pier.x - 90, size - 10, 180, 70);
    ctx.fillRect(city.sites.pier.x - 30, size - 10, 60, 110);
  }

  drawSites(ctx, city, world) {
    const s = city.sites;
    // Hideout: a solid house with a red roof — the one safe place.
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(s.hideout.x - 46, s.hideout.y - 36, 96, 76);
    ctx.fillStyle = '#e8dcc8';
    ctx.fillRect(s.hideout.x - 50, s.hideout.y - 40, 100, 72);
    ctx.fillStyle = '#c0392b';
    ctx.beginPath();
    ctx.moveTo(s.hideout.x - 56, s.hideout.y - 40);
    ctx.lineTo(s.hideout.x, s.hideout.y - 66);
    ctx.lineTo(s.hideout.x + 56, s.hideout.y - 40);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#2c3e50';
    ctx.fillRect(s.hideout.x - 12, s.hideout.y - 8, 24, 40);
    this.label(ctx, 'HIDEOUT', s.hideout.x, s.hideout.y - 84, '#ffffff');

    // Pit Stop: yellow garage doors on the road edge.
    ctx.fillStyle = '#f2c200';
    ctx.fillRect(s.pitstop.x - 60, s.pitstop.y - 26, 120, 52);
    ctx.fillStyle = '#222831';
    ctx.fillRect(s.pitstop.x - 52, s.pitstop.y - 18, 44, 36);
    ctx.fillRect(s.pitstop.x + 8, s.pitstop.y - 18, 44, 36);
    this.label(ctx, 'PIT STOP', s.pitstop.x, s.pitstop.y - 40, '#f2c200');

    // Gun Barn: brown storefront.
    ctx.fillStyle = '#6d4c41';
    ctx.fillRect(s.gunbarn.x - 55, s.gunbarn.y - 35, 110, 70);
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(s.gunbarn.x - 45, s.gunbarn.y - 25, 90, 22);
    ctx.fillStyle = '#222831';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('GUN BARN', s.gunbarn.x, s.gunbarn.y - 10);
    this.label(ctx, 'GUN BARN', s.gunbarn.x, s.gunbarn.y - 50, '#ffd166');

    // Pier label.
    this.label(ctx, 'HARBOR PIER', s.pier.x, s.pier.y - 60, '#ffffff');
    // Taxi stand sign.
    ctx.fillStyle = '#f2c200';
    ctx.beginPath();
    ctx.arc(s.taxiStand.x, s.taxiStand.y, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#222831';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('T', s.taxiStand.x, s.taxiStand.y + 5);
  }

  label(ctx, text, x, y, color) {
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.strokeText(text, x, y);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }

  drawMarkers(ctx, world) {
    const { missions, entities } = world;
    const pulse = 1 + Math.sin(Date.now() / 220) * 0.18;
    const beacon = (x, y, color, text) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(pulse, pulse);
      ctx.strokeStyle = color;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, 26, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      if (text) this.label(ctx, text, x, y - 40, color);
    };
    if (missions.active) {
      const a = missions.active;
      if (a.marker) beacon(a.marker.x, a.marker.y, '#ffe66d', a.id.toUpperCase());
      if (a.id === 'm4' && missions.courier && !missions.courier.dead) {
        beacon(missions.courier.x, missions.courier.y, '#ff6b6b', 'COURIER');
      }
      if (a.id === 'm4' && missions.ledger && !missions.ledger.taken) {
        beacon(missions.ledger.x, missions.ledger.y, '#ffe66d', 'LEDGER');
      }
    }
    if (missions.taxi) {
      const t = missions.taxi;
      if (t.stage === 'pickup') beacon(t.ped.x, t.ped.y, '#f2c200', 'FARE');
      else beacon(t.dest.x, t.dest.y, '#f2c200', 'DROP-OFF');
    }
    // A dropped pickup glints.
    if (missions.ledger && !missions.ledger.taken) {
      beacon(missions.ledger.x, missions.ledger.y, '#ffe66d', 'LEDGER');
    }
  }

  drawPeds(ctx, entities) {
    for (const ped of entities.peds) {
      const bob = Math.sin(ped.walkPhase) * 2;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(ped.x, ped.y + 10, 9, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = ped.color;
      ctx.beginPath();
      ctx.arc(ped.x, ped.y + bob * 0.3, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f2c9a0';
      ctx.beginPath();
      ctx.arc(ped.x + Math.cos(ped.angle) * 4, ped.y + Math.sin(ped.angle) * 4 + bob * 0.3, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawEnemies(ctx, missions) {
    for (const e of missions.enemies) {
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(e.x, e.y + 11, 10, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = e.color;
      ctx.beginPath();
      ctx.arc(e.x, e.y, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#222831';
      ctx.beginPath();
      ctx.arc(e.x, e.y - 3, 6, 0, Math.PI * 2);
      ctx.fill();
      // Health bar.
      ctx.fillStyle = '#222831';
      ctx.fillRect(e.x - 16, e.y - 26, 32, 5);
      ctx.fillStyle = '#e74c3c';
      ctx.fillRect(e.x - 16, e.y - 26, 32 * (e.hp / 100), 5);
    }
  }

  drawCarShape(ctx, car, isPlayer) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(-CAR_LENGTH / 2 + 4, -CAR_WIDTH / 2 + 5, CAR_LENGTH, CAR_WIDTH);
    // Body.
    ctx.fillStyle = car.color;
    const r = 9;
    ctx.beginPath();
    ctx.roundRect(-CAR_LENGTH / 2, -CAR_WIDTH / 2, CAR_LENGTH, CAR_WIDTH, r);
    ctx.fill();
    // Windshield + roof.
    ctx.fillStyle = 'rgba(180,220,255,0.85)';
    ctx.fillRect(6, -CAR_WIDTH / 2 + 4, 14, CAR_WIDTH - 8);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(-12, -CAR_WIDTH / 2 + 4, 14, CAR_WIDTH - 8);
    // Headlights.
    ctx.fillStyle = '#ffe66d';
    ctx.fillRect(CAR_LENGTH / 2 - 3, -CAR_WIDTH / 2 + 3, 3, 6);
    ctx.fillRect(CAR_LENGTH / 2 - 3, CAR_WIDTH / 2 - 9, 3, 6);
    // Wheels.
    ctx.fillStyle = '#111111';
    ctx.fillRect(-CAR_LENGTH / 2 + 6, -CAR_WIDTH / 2 - 3, 12, 6);
    ctx.fillRect(-CAR_LENGTH / 2 + 6, CAR_WIDTH / 2 - 3, 12, 6);
    ctx.fillRect(CAR_LENGTH / 2 - 18, -CAR_WIDTH / 2 - 3, 12, 6);
    ctx.fillRect(CAR_LENGTH / 2 - 18, CAR_WIDTH / 2 - 3, 12, 6);
    if (car.kind === 'police') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-8, -CAR_WIDTH / 2 + 2, 16, CAR_WIDTH - 4);
      ctx.fillStyle = '#e74c3c';
      ctx.fillRect(-8, -CAR_WIDTH / 2 + 2, 8, 5);
      ctx.fillStyle = '#3498db';
      ctx.fillRect(0, -CAR_WIDTH / 2 + 2, 8, 5);
    }
    if (car.isTaxi) {
      ctx.fillStyle = '#222831';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('TAXI', 0, 3);
    }
    if (isPlayer) {
      ctx.strokeStyle = '#ffe66d';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(-CAR_LENGTH / 2 - 3, -CAR_WIDTH / 2 - 3, CAR_LENGTH + 6, CAR_WIDTH + 6, 11);
      ctx.stroke();
    }
    ctx.restore();
    // Damage smoke.
    if (car.hp < 45 && car.hp > 0) {
      ctx.fillStyle = 'rgba(120,120,120,0.5)';
      ctx.beginPath();
      ctx.arc(car.x - Math.cos(car.angle) * 20, car.y - Math.sin(car.angle) * 20, 8 + Math.random() * 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawCars(ctx, entities, world) {
    for (const car of entities.cars) {
      if (car.dead) continue;
      this.drawCarShape(ctx, car, entities.player.inCar === car);
    }
    // Courier gets a red outline so the chase reads at a glance.
    if (world.missions.courier && !world.missions.courier.dead) {
      const c = world.missions.courier;
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.angle);
      ctx.strokeStyle = '#ff6b6b';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(-CAR_LENGTH / 2 - 5, -CAR_WIDTH / 2 - 5, CAR_LENGTH + 10, CAR_WIDTH + 10, 12);
      ctx.stroke();
      ctx.restore();
    }
  }

  drawPlayer(ctx, entities, world) {
    const p = entities.player;
    if (p.dead || p.inCar) return;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 11, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2d6a4f';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f2c9a0';
    ctx.beginPath();
    ctx.arc(p.x + Math.cos(p.angle) * 5, p.y + Math.sin(p.angle) * 5, 7, 0, Math.PI * 2);
    ctx.fill();
    // Aim line while the pistol is out.
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + Math.cos(p.angle) * 34, p.y + Math.sin(p.angle) * 34);
    ctx.stroke();
    // Health bar.
    ctx.fillStyle = '#222831';
    ctx.fillRect(p.x - 16, p.y - 28, 32, 5);
    ctx.fillStyle = p.hp > 30 ? '#2ecc71' : '#e74c3c';
    ctx.fillRect(p.x - 16, p.y - 28, 32 * (p.hp / 100), 5);
  }

  drawNight(ctx, world) {
    // Headlight cones for every moving car.
    const { entities } = world;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const cone = (car) => {
      const fx = car.x + Math.cos(car.angle) * 90;
      const fy = car.y + Math.sin(car.angle) * 90;
      const g = ctx.createRadialGradient(car.x, car.y, 10, fx, fy, 150);
      g.addColorStop(0, 'rgba(255,230,140,0.20)');
      g.addColorStop(1, 'rgba(255,230,140,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(fx, fy, 150, 0, Math.PI * 2);
      ctx.fill();
    };
    for (const car of entities.cars) {
      if (!car.dead && Math.abs(car.speed) > 5) cone(car);
    }
    const p = entities.player;
    if (!p.inCar && !p.dead) {
      const g = ctx.createRadialGradient(p.x, p.y, 10, p.x, p.y, 120);
      g.addColorStop(0, 'rgba(255,230,140,0.14)');
      g.addColorStop(1, 'rgba(255,230,140,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 120, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawMinimap(ctx, world) {
    const { city, entities, missions } = world;
    const size = 168;
    const x0 = this.canvas.width - size - 14;
    const y0 = 14;
    const scale = size / city.size;
    ctx.save();
    ctx.fillStyle = 'rgba(20,24,36,0.82)';
    ctx.beginPath();
    ctx.roundRect(x0 - 6, y0 - 6, size + 12, size + 12, 8);
    ctx.fill();
    ctx.strokeStyle = '#ffe66d';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Roads.
    ctx.fillStyle = '#8a94a6';
    for (let i = 0; i <= 8; i++) {
      const c = (i * (BLOCK + ROAD) + ROAD / 2) * scale;
      ctx.fillRect(x0, y0 + c - 3, size, 6);
      ctx.fillRect(x0 + c - 3, y0, 6, size);
    }
    // Water.
    ctx.fillStyle = '#2b6cb0';
    ctx.fillRect(x0, y0 + size - 6, size, 6);
    // Sites.
    const dot = (wx, wy, color, r = 4) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x0 + wx * scale, y0 + wy * scale, r, 0, Math.PI * 2);
      ctx.fill();
    };
    dot(city.sites.hideout.x, city.sites.hideout.y, '#2ecc71', 5);
    dot(city.sites.pitstop.x, city.sites.pitstop.y, '#f2c200', 4);
    dot(city.sites.gunbarn.x, city.sites.gunbarn.y, '#ffd166', 4);
    dot(city.sites.pier.x, city.sites.pier.y, '#3498db', 4);
    if (missions.active && missions.active.marker) {
      dot(missions.active.marker.x, missions.active.marker.y, '#ffe66d', 6);
    }
    if (missions.courier && !missions.courier.dead) {
      dot(missions.courier.x, missions.courier.y, '#ff6b6b', 5);
    }
    // Police blips.
    for (const car of entities.cars) {
      if (car.kind === 'police' && !car.dead) dot(car.x, car.y, '#3498db', 3);
    }
    // Player arrow.
    const p = entities.player;
    ctx.save();
    ctx.translate(x0 + p.x * scale, y0 + p.y * scale);
    ctx.rotate(p.angle);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(7, 0);
    ctx.lineTo(-5, -5);
    ctx.lineTo(-5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.restore();
  }
}
