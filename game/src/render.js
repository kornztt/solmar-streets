// Canvas rendering: the city, cars, people, night lighting and the minimap.
// Colours shift with the time of day; after dark the player gets headlights.
import { CFG } from './config.js';
import { clamp, lerp } from './random.js';
import { PED_TYPES } from './entities.js';

function palette(hours) {
  // dawn 6-8, day 8-17, dusk 17-19, night otherwise
  if (hours >= 8 && hours < 17) return { ground: '#6f7f5e', road: '#3c3f45', night: 0, sky: '#87b5d6' };
  if (hours >= 6 && hours < 8) return { ground: '#7f7a5e', road: '#46413f', night: 0.15, sky: '#e8a56b' };
  if (hours >= 17 && hours < 19) return { ground: '#6f5e4e', road: '#3f3838', night: 0.3, sky: '#d67b4a' };
  return { ground: '#3a4152', road: '#23252c', night: 0.55, sky: '#0d1526' };
}

export function isNight(hours) { return hours < 6 || hours >= 19; }

export function drawWorld(G, ctx, W, H) {
  const pal = palette(G.time.hours);
  const cam = G.camera;
  const vw = W, vh = H;
  ctx.fillStyle = pal.ground;
  ctx.fillRect(0, 0, vw, vh);
  const x0 = cam.x - vw / 2, y0 = cam.y - vh / 2;
  // roads
  ctx.fillStyle = pal.road;
  for (const c of G.city.centres) {
    ctx.fillRect(c - CFG.roadWidth / 2 - x0, 0 - y0, CFG.roadWidth, CFG.world);
    ctx.fillRect(0 - x0, c - CFG.roadWidth / 2 - y0, CFG.world, CFG.roadWidth);
  }
  // road dashes
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 3;
  ctx.setLineDash([24, 30]);
  ctx.beginPath();
  for (const c of G.city.centres) {
    ctx.moveTo(c - x0, -y0); ctx.lineTo(c - x0, CFG.world - y0);
    ctx.moveTo(-x0, c - y0); ctx.lineTo(CFG.world - x0, c - y0);
  }
  ctx.stroke();
  ctx.setLineDash([]);
  // buildings
  for (const b of G.city.buildings) {
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x - x0, b.y - y0, b.w, b.h);
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.fillRect(b.x - x0, b.y - y0, b.w, 6);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    for (let f = 0; f < b.floors; f += 2) {
      ctx.fillRect(b.x + 8 - x0, b.y + 10 + f * 8 - y0, b.w - 16, 4);
    }
  }
  // landmarks
  for (const lm of Object.values(G.city.landmarks)) {
    ctx.fillStyle = lm.colour;
    ctx.beginPath(); ctx.arc(lm.x - x0, lm.y - y0, 14, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(lm.name, lm.x - x0, lm.y - 22 - y0);
  }
  // mission / job markers: pulsing beacons
  const t = G.now;
  const pulse = 10 + 4 * Math.sin(t * 5);
  const markers = currentMarkers(G);
  for (const mk of markers) {
    ctx.strokeStyle = mk.colour;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(mk.x - x0, mk.y - y0, pulse + 8, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = mk.colour;
    ctx.beginPath(); ctx.arc(mk.x - x0, mk.y - y0, 5, 0, Math.PI * 2); ctx.fill();
    // off-screen arrow: point toward markers outside the view
    const sx = mk.x - x0, sy = mk.y - y0;
    if (sx < 20 || sx > vw - 20 || sy < 20 || sy > vh - 20) {
      const cx = clamp(sx, 40, vw - 40), cy = clamp(sy, 40, vh - 40);
      const a = Math.atan2(sy - cy, sx - cx);
      ctx.save();
      ctx.translate(cx, cy); ctx.rotate(a);
      ctx.fillStyle = mk.colour;
      ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-8, -9); ctx.lineTo(-8, 9); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }
  // pedestrians
  for (const p of G.peds) {
    if (p.dead) {
      ctx.fillStyle = '#5a2a2a';
      ctx.beginPath(); ctx.ellipse(p.x - x0, p.y - y0, 12, 5, p.angle, 0, Math.PI * 2); ctx.fill();
      continue;
    }
    const tp = PED_TYPES[p.type];
    ctx.fillStyle = tp.colour;
    ctx.beginPath(); ctx.arc(p.x - x0, p.y - y0, tp.size, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.arc(p.x - x0, p.y - y0, 4, 0, Math.PI * 2); ctx.fill();
  }
  // breakers (M3)
  for (const b of G.breakers) {
    if (b.dead) {
      ctx.fillStyle = '#3a1a1a';
      ctx.beginPath(); ctx.ellipse(b.x - x0, b.y - y0, 12, 5, 0, 0, Math.PI * 2); ctx.fill();
      continue;
    }
    ctx.fillStyle = '#c0392b';
    ctx.beginPath(); ctx.arc(b.x - x0, b.y - y0, 13, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('BRK', b.x - x0, b.y - 18 - y0);
  }
  // officers
  for (const o of G.officers) {
    if (o.dead) continue;
    ctx.fillStyle = '#1a3a6b';
    ctx.beginPath(); ctx.arc(o.x - x0, o.y - y0, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('PD', o.x - x0, o.y - 16 - y0);
  }
  // cars
  for (const car of G.cars) drawCar(G, ctx, car, x0, y0);
  // player
  drawPlayer(G, ctx, x0, y0);
  // tracers
  for (const tr of G.tracers) {
    ctx.strokeStyle = 'rgba(255,240,120,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(tr.x1 - x0, tr.y1 - y0); ctx.lineTo(tr.x2 - x0, tr.y2 - y0); ctx.stroke();
  }
  // night: dark overlay, then headlight cones cut through it
  if (pal.night > 0) {
    ctx.fillStyle = `rgba(4,8,28,${pal.night})`;
    ctx.fillRect(0, 0, vw, vh);
    const px = (G.player.inCar ? G.player.inCar.x : G.player.x) - x0;
    const py = (G.player.inCar ? G.player.inCar.y : G.player.y) - y0;
    const ang = G.player.inCar ? G.player.inCar.angle : G.player.angle;
    const grad = ctx.createRadialGradient(px, py, 20, px, py, 260);
    grad.addColorStop(0, 'rgba(255,240,180,0.55)');
    grad.addColorStop(1, 'rgba(255,240,180,0)');
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(px, py, 260, 0, Math.PI * 2); ctx.fill();
    // headlight cone
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.arc(px, py, 340, ang - 0.35, ang + 0.35);
    ctx.closePath();
    const cone = ctx.createRadialGradient(px, py, 10, px, py, 340);
    cone.addColorStop(0, 'rgba(255,244,200,0.5)');
    cone.addColorStop(1, 'rgba(255,244,200,0)');
    ctx.fillStyle = cone;
    ctx.fill();
    ctx.restore();
  }
}

export function currentMarkers(G) {
  const out = [];
  const m = G.mission;
  if (m.active) {
    if (m.id === 1) out.push({ x: m.stage === 0 ? m.data.pickup.x : m.data.home.x, y: m.stage === 0 ? m.data.pickup.y : m.data.home.y, colour: '#f5a623' });
    if (m.id === 2) for (const d of m.data.drops) if (!d.done) out.push({ x: d.x, y: d.y, colour: '#f5a623' });
    if (m.id === 3) for (const b of G.breakers) if (!b.dead) out.push({ x: b.x, y: b.y, colour: '#dc322f' });
    if (m.id === 4) {
      if (m.stage === 0) out.push({ x: m.data.courier.x, y: m.data.courier.y, colour: '#dc322f' });
      if (m.stage === 1) out.push({ x: m.data.ledger.x, y: m.data.ledger.y, colour: '#f5a623' });
      if (m.stage === 2) out.push({ x: m.data.home.x, y: m.data.home.y, colour: '#f5a623' });
    }
    if (m.id === 5) {
      if (m.stage === 0) out.push({ x: m.data.van.x, y: m.data.van.y, colour: '#dc322f' });
      if (m.stage === 1) for (const b of m.data.bags) if (!b.got) out.push({ x: b.x, y: b.y, colour: '#f5a623' });
      if (m.stage === 2) out.push({ x: m.data.stash.x, y: m.data.stash.y, colour: '#2aa198' });
    }
  } else {
    const L = G.city.landmarks;
    out.push({ x: L.vera.x, y: L.vera.y, colour: '#f5a623' });
  }
  if (G.taxi.active) {
    out.push({ x: G.taxi.stage === 0 ? G.taxi.pickup.x : G.taxi.dest.x, y: G.taxi.stage === 0 ? G.taxi.pickup.y : G.taxi.dest.y, colour: '#fc0' });
  }
  if (G.courier.active) for (const d of G.courier.drops) if (!d.done) out.push({ x: d.x, y: d.y, colour: '#cb4b16' });
  return out;
}

function drawCar(G, ctx, car, x0, y0) {
  const m = CFG.carModels[car.model];
  ctx.save();
  ctx.translate(car.x - x0, car.y - y0);
  ctx.rotate(car.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(-m.l / 2 + 3, -m.w / 2 + 3, m.l, m.w);
  ctx.fillStyle = car.police ? '#1a3a6b' : CFG.carColours[car.colour];
  ctx.fillRect(-m.l / 2, -m.w / 2, m.l, m.w);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillRect(-m.l / 2 + 8, -m.w / 2 + 6, 12, m.w - 12);
  ctx.fillStyle = '#222';
  ctx.fillRect(-4, -m.w / 2 + 4, m.l / 2 - 8, m.w - 8);
  if (car.police) {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('PD', 0, 4);
  }
  if (car.dead) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(-m.l / 2, -m.w / 2, m.l, m.w);
  }
  ctx.restore();
  // hp bar for damaged mission vehicles
  if ((car.driver === 'courier' || car.driver === 'van') && car.hp < car.maxHp) {
    ctx.fillStyle = '#000';
    ctx.fillRect(car.x - 30 - x0, car.y - 46 - y0, 60, 6);
    ctx.fillStyle = '#e33';
    ctx.fillRect(car.x - 30 - x0, car.y - 46 - y0, 60 * (car.hp / car.maxHp), 6);
  }
}

function drawPlayer(G, ctx, x0, y0) {
  const p = G.player;
  if (p.inCar) return; // the car is drawn; the driver is inside
  const bob = Math.sin(p.walkAnim * 10) * 2;
  ctx.fillStyle = '#f5d76e';
  ctx.beginPath(); ctx.arc(p.x - x0, p.y - y0, 11, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#2c3e50';
  ctx.beginPath(); ctx.arc(p.x - x0, p.y - y0, 5, 0, Math.PI * 2); ctx.fill();
  // facing tick
  ctx.strokeStyle = '#f5d76e';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(p.x - x0, p.y - y0);
  ctx.lineTo(p.x + Math.cos(p.angle) * 18 - x0, p.y + Math.sin(p.angle) * 18 - y0);
  ctx.stroke();
  void bob;
}

export function drawMinimap(G, ctx, W, H) {
  const size = 190, s = size / CFG.world;
  const mx = W - size - 14, my = H - size - 14;
  ctx.fillStyle = 'rgba(10,14,24,0.85)';
  ctx.fillRect(mx - 4, my - 4, size + 8, size + 8);
  ctx.strokeStyle = '#666';
  ctx.lineWidth = 1;
  for (const c of G.city.centres) {
    ctx.beginPath(); ctx.moveTo(mx + c * s, my); ctx.lineTo(mx + c * s, my + size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(mx, my + c * s); ctx.lineTo(mx + size, my + c * s); ctx.stroke();
  }
  for (const lm of Object.values(G.city.landmarks)) {
    ctx.fillStyle = lm.colour;
    ctx.fillRect(mx + lm.x * s - 2, my + lm.y * s - 2, 4, 4);
  }
  for (const mk of currentMarkers(G)) {
    ctx.fillStyle = mk.colour;
    ctx.beginPath(); ctx.arc(mx + mk.x * s, my + mk.y * s, 4, 0, Math.PI * 2); ctx.fill();
  }
  for (const car of G.cars) {
    if (car.police && !car.dead) {
      ctx.fillStyle = '#f33';
      ctx.fillRect(mx + car.x * s - 2, my + car.y * s - 2, 4, 4);
    }
  }
  const px = G.player.inCar ? G.player.inCar.x : G.player.x;
  const py = G.player.inCar ? G.player.inCar.y : G.player.y;
  const ang = G.player.inCar ? G.player.inCar.angle : G.player.angle;
  ctx.save();
  ctx.translate(mx + px * s, my + py * s);
  ctx.rotate(ang);
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-5, -5); ctx.lineTo(-5, 5); ctx.closePath(); ctx.fill();
  ctx.restore();
}
