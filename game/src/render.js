// Canvas rendering: city, cars, people, effects, day/night light and minimap.
import { WORLD, ROADS_X, ROADS_Y, ROAD_W, PLACES } from './config.js';
import { clamp } from './random.js';

// Daylight factor 0..1 from the clock: 1 at noon, 0 at midnight.
export function daylight(clock) {
  const h = ((clock % 24) + 24) % 24;
  if (h >= 6 && h <= 18) return 0.55 + 0.45 * Math.sin(((h - 6) / 12) * Math.PI);
  if (h > 18 && h < 20) return 0.55 * (1 - (h - 18) / 2);
  if (h >= 4 && h < 6) return 0.55 * ((h - 4) / 2);
  return 0.12;
}

function skyColor(dl) {
  if (dl > 0.7) return '#79a6c8';
  if (dl > 0.4) return '#e8a56b';
  return '#0d1526';
}

export function drawWorld(G, ctx, W, H) {
  const cam = G.camera;
  const dl = daylight(G.clock);
  ctx.fillStyle = skyColor(dl);
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.translate(-cam.x + W / 2, -cam.y + H / 2);

  // Ground.
  ctx.fillStyle = dl > 0.5 ? '#5d8a4a' : dl > 0.3 ? '#4a6b3d' : '#1d2b1a';
  ctx.fillRect(0, 0, WORLD.w, WORLD.h);

  // Sidewalks (lighter strips along roads).
  ctx.fillStyle = dl > 0.5 ? '#9aa0a6' : '#3a3f45';
  for (const rx of ROADS_X) ctx.fillRect(rx - ROAD_W / 2 - 10, 0, ROAD_W + 20, WORLD.h);
  for (const ry of ROADS_Y) ctx.fillRect(0, ry - ROAD_W / 2 - 10, WORLD.w, ROAD_W + 20);

  // Roads.
  ctx.fillStyle = dl > 0.5 ? '#3d3d3d' : '#232323';
  for (const rx of ROADS_X) ctx.fillRect(rx - ROAD_W / 2, 0, ROAD_W, WORLD.h);
  for (const ry of ROADS_Y) ctx.fillRect(0, ry - ROAD_W / 2, WORLD.w, ROAD_W);

  // Dashed centre lines.
  ctx.strokeStyle = dl > 0.5 ? '#f1c40f' : '#8a7a2a';
  ctx.lineWidth = 3;
  ctx.setLineDash([18, 22]);
  ctx.beginPath();
  for (const rx of ROADS_X) { ctx.moveTo(rx, 0); ctx.lineTo(rx, WORLD.h); }
  for (const ry of ROADS_Y) { ctx.moveTo(0, ry); ctx.lineTo(WORLD.w, ry); }
  ctx.stroke();
  ctx.setLineDash([]);

  // Rooftop Plaza: paved square with planters and a rooftop sign.
  const pz = PLACES.plaza;
  ctx.fillStyle = dl > 0.5 ? '#b8b0a0' : '#4a453c';
  ctx.fillRect(pz.x - 130, pz.y - 110, 260, 220);
  ctx.fillStyle = '#2e86c1';
  ctx.fillRect(pz.x - 100, pz.y - 80, 200, 60);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('ROOFTOP PLAZA', pz.x, pz.y - 44);
  ctx.fillStyle = '#27ae60';
  for (const [ox, oy] of [[-100, 60], [0, 60], [100, 60], [-100, -90], [100, -90]]) {
    ctx.beginPath();
    ctx.arc(pz.x + ox, pz.y + oy, 14, 0, Math.PI * 2);
    ctx.fill();
  }

  // Dockside: water strip and piers along the bottom edge.
  ctx.fillStyle = dl > 0.5 ? '#2e86c1' : '#0e2a44';
  ctx.fillRect(0, 1645, WORLD.w, 155);
  ctx.fillStyle = '#7d6608';
  for (let x = 120; x < WORLD.w; x += 320) ctx.fillRect(x, 1645, 180, 26);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText('DOCKSIDE', 1300, 1780);

  // Buildings.
  for (const b of G.city.buildings) {
    ctx.fillStyle = b.wall;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 5, b.y + 5, b.w - 10, b.h - 10);
    if (b.tall) {
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(b.x + 8, b.y + 8, b.w - 16, 10);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(b.x, b.y + b.h - 6, b.w, 6);
  }

  // Shops: coloured fronts with signs.
  drawShop(G, ctx, PLACES.pitstop, '#e67e22', 'PIT STOP', dl);
  drawShop(G, ctx, PLACES.gunbarn, '#8e44ad', 'GUN BARN', dl);
  drawShop(G, ctx, PLACES.diner, '#e74c3c', 'DINER', dl);
  drawShop(G, ctx, PLACES.bank, '#2e86c1', 'BANK', dl);
  drawShop(G, ctx, PLACES.depot, '#16a085', 'DEPOT', dl);
  // Home: a small house with a warm roof.
  const hm = PLACES.home;
  ctx.fillStyle = '#f5cba7';
  ctx.fillRect(hm.x - 34, hm.y - 26, 68, 52);
  ctx.fillStyle = '#b03a2e';
  ctx.beginPath();
  ctx.moveTo(hm.x - 40, hm.y - 26);
  ctx.lineTo(hm.x, hm.y - 52);
  ctx.lineTo(hm.x + 40, hm.y - 26);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText('HOME', hm.x, hm.y + 44);

  // Mission marker (pulsing diamond + beam).
  if (G.marker) {
    const pulse = 1 + 0.18 * Math.sin(G.time * 5);
    ctx.save();
    ctx.translate(G.marker.x, G.marker.y);
    ctx.fillStyle = 'rgba(241,196,15,0.25)';
    ctx.fillRect(-26 * pulse, -120, 52 * pulse, 120);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#f1c40f';
    ctx.fillRect(-11 * pulse, -11 * pulse, 22 * pulse, 22 * pulse);
    ctx.restore();
    ctx.fillStyle = '#f1c40f';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(G.marker.label, G.marker.x, G.marker.y - 128);
  }

  // Pickups.
  for (const p of G.pickups) {
    const bob = Math.sin(p.t * 4) * 3;
    if (p.kind === 'cash') {
      ctx.fillStyle = '#2ecc71';
      ctx.fillRect(p.x - 9, p.y - 6 + bob, 18, 12);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px sans-serif';
      ctx.fillText('$', p.x, p.y + 3 + bob);
    } else if (p.kind === 'ledger') {
      ctx.fillStyle = '#f1c40f';
      ctx.fillRect(p.x - 10, p.y - 13 + bob, 20, 26);
      ctx.fillStyle = '#7d6608';
      ctx.fillRect(p.x - 6, p.y - 8 + bob, 12, 3);
      ctx.fillRect(p.x - 6, p.y - 2 + bob, 12, 3);
    } else {
      ctx.fillStyle = '#27ae60';
      ctx.beginPath();
      ctx.arc(p.x, p.y + bob, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText('$', p.x, p.y + 4 + bob);
    }
  }

  // Pedestrians.
  for (const p of G.peds) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(0, 0, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f5d0a9';
    ctx.beginPath();
    ctx.arc(4, 0, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    if (p.state === 'taxi') {
      ctx.fillStyle = '#f1c40f';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('TAXI!', p.x, p.y - 20);
    }
  }

  // Enemies (Breakers).
  for (const e of G.enemies) {
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.rotate(e.angle);
    ctx.fillStyle = '#922b21';
    ctx.fillRect(-13, -10, 26, 20);
    ctx.fillStyle = '#f5d0a9';
    ctx.beginPath();
    ctx.arc(6, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2c3e50';
    ctx.fillRect(10, -2, 14, 4);
    ctx.restore();
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(e.x - 14, e.y - 24, 28, 4);
    ctx.fillStyle = '#2ecc71';
    ctx.fillRect(e.x - 14, e.y - 24, 28 * Math.max(0, e.hp / 60), 4);
  }

  // Cars.
  for (const c of G.cars) {
    if (c.dead) continue;
    drawCar(ctx, c, dl);
  }

  // Enemy bullets.
  ctx.fillStyle = '#ff5e3a';
  for (const s of G.enemyShots) {
    ctx.beginPath();
    ctx.arc(s.x, s.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Tracer + muzzle flash.
  if (G.tracer && G.tracer.t > 0) {
    ctx.strokeStyle = 'rgba(255,220,120,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(G.tracer.x1, G.tracer.y1);
    ctx.lineTo(G.tracer.x2, G.tracer.y2);
    ctx.stroke();
  }
  if (G.muzzle && G.muzzle.t > 0) {
    ctx.fillStyle = '#ffd94d';
    ctx.beginPath();
    ctx.arc(G.muzzle.x, G.muzzle.y, 7, 0, Math.PI * 2);
    ctx.fill();
  }

  // Particles.
  for (const pt of G.particles) {
    ctx.globalAlpha = clamp(pt.life / pt.maxLife, 0, 1);
    ctx.fillStyle = pt.color;
    ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
  }
  ctx.globalAlpha = 1;

  // Player (on foot): yellow jacket, dark trousers.
  if (G.player.onFoot) {
    const p = G.player;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.fillStyle = '#f1c40f';
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2c3e50';
    ctx.fillRect(-6, -4, 12, 8);
    ctx.fillStyle = '#f5d0a9';
    ctx.beginPath();
    ctx.arc(8, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Night: darken everything, then cut headlight cones.
  if (dl < 0.45) {
    ctx.fillStyle = `rgba(6,10,28,${0.55 * (1 - dl / 0.45)})`;
    ctx.fillRect(cam.x - W / 2 - 40, cam.y - H / 2 - 40, W + 80, H + 80);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const lights = [];
    if (G.player.car) lights.push(G.player.car);
    for (const c of G.cars) if (c.driver === 'police') lights.push(c);
    for (const c of lights) {
      const grad = ctx.createRadialGradient(c.x, c.y, 10, c.x + Math.cos(c.angle) * 130, c.y + Math.sin(c.angle) * 130, 170);
      grad.addColorStop(0, 'rgba(255,240,180,0.30)');
      grad.addColorStop(1, 'rgba(255,240,180,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(c.x + Math.cos(c.angle + 0.5) * 14, c.y + Math.sin(c.angle + 0.5) * 14);
      ctx.lineTo(c.x + Math.cos(c.angle) * 190, c.y + Math.sin(c.angle) * 190);
      ctx.lineTo(c.x + Math.cos(c.angle - 0.5) * 14, c.y + Math.sin(c.angle - 0.5) * 14);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  ctx.restore();
}

function drawShop(G, ctx, place, color, sign, dl) {
  ctx.fillStyle = color;
  ctx.fillRect(place.x - 46, place.y - 30, 92, 60);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillRect(place.x - 46, place.y - 30, 92, 18);
  ctx.fillStyle = '#222';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(sign, place.x, place.y - 17);
  ctx.fillStyle = '#fff';
  ctx.font = '11px sans-serif';
  ctx.fillText('E', place.x, place.y + 18);
}

export function drawCar(ctx, c, dl) {
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(c.angle);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(-22, -10, 46, 24);
  // Body.
  ctx.fillStyle = c.color;
  roundRect(ctx, -22, -11, 44, 22, 6);
  ctx.fill();
  // Cabin + windows.
  ctx.fillStyle = 'rgba(180,220,255,0.85)';
  roundRect(ctx, -6, -9, 14, 18, 3);
  ctx.fill();
  ctx.fillStyle = c.color;
  ctx.fillRect(-20, -11, 6, 22);
  // Headlights.
  ctx.fillStyle = '#fff8c0';
  ctx.fillRect(20, -9, 3, 5);
  ctx.fillRect(20, 4, 3, 5);
  // Police livery.
  if (c.driver === 'police') {
    ctx.fillStyle = '#fff';
    ctx.fillRect(-8, -11, 16, 22);
    ctx.fillStyle = '#1f2a44';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PD', 0, 3);
    const blink = Math.floor(Date.now() / 300) % 2 === 0;
    ctx.fillStyle = blink ? '#ff0000' : '#0066ff';
    ctx.beginPath();
    ctx.arc(-2, -8, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = blink ? '#0066ff' : '#ff0000';
    ctx.beginPath();
    ctx.arc(-2, 8, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Damage smoke.
  if (c.hp < c.maxHp * 0.4) {
    ctx.fillStyle = 'rgba(120,120,120,0.6)';
    ctx.beginPath();
    ctx.arc(-14 + Math.random() * 6, -4 + Math.random() * 8, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  // Health bar for mission targets.
  if (c.driver === 'courier' || c.driver === 'van') {
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(c.x - 24, c.y - 32, 48, 5);
    ctx.fillStyle = '#f1c40f';
    ctx.fillRect(c.x - 24, c.y - 32, 48 * Math.max(0, c.hp / c.maxHp), 5);
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Minimap: world scaled into a small box, with dots for the player, cars,
// police, mission marker and shops.
export function drawMinimap(G, ctx, x, y, w, h) {
  const sx = w / WORLD.w;
  const sy = h / WORLD.h;
  ctx.save();
  ctx.fillStyle = 'rgba(10,14,24,0.78)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#f1c40f';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = '#3d3d3d';
  for (const rx of ROADS_X) ctx.fillRect(x + rx * sx - 1, y, 2, h);
  for (const ry of ROADS_Y) ctx.fillRect(x, y + ry * sy, w, 2);
  const dot = (wx, wy, color, r = 3) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x + wx * sx, y + wy * sy, r, 0, Math.PI * 2);
    ctx.fill();
  };
  dot(PLACES.home.x, PLACES.home.y, '#2ecc71', 3);
  if (G.marker) dot(G.marker.x, G.marker.y, '#f1c40f', 4);
  for (const c of G.police) dot(c.x, c.y, '#e74c3c', 3);
  if (G.player.car) dot(G.player.car.x, G.player.car.y, '#fff', 3);
  dot(G.player.x, G.player.y, '#f1c40f', 4);
  ctx.restore();
}
