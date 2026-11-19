// Canvas rendering: city, entities, day/night light, headlights, minimap.
import { CFG, PHASES, CAR_MODELS, phaseFor, districtAt } from './config.js';
import { clamp } from './random.js';
import { roadCenter, landmarkPos } from './city.js';
import { missionMarker } from './missions.js';

function hexLerp(a, b, t) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  const c = pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

function palette(G) {
  const ph = phaseFor(G.clock);
  const A = PHASES[ph.a];
  const B = PHASES[ph.b];
  const out = {};
  for (const k of Object.keys(A)) {
    out[k] = typeof A[k] === 'string' ? hexLerp(A[k], B[k], ph.t) : A[k] + (B[k] - A[k]) * ph.t;
  }
  return out;
}

function drawCar(ctx, x, y, angle, model, color, opts = {}) {
  const m = CAR_MODELS[model];
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(-m.len / 2 + 3, -m.w / 2 + 3, m.len, m.w);
  ctx.fillStyle = color;
  ctx.fillRect(-m.len / 2, -m.w / 2, m.len, m.w);
  // Cabin + windshield.
  ctx.fillStyle = 'rgba(20,24,32,0.85)';
  ctx.fillRect(-m.len * 0.18, -m.w * 0.36, m.len * 0.34, m.w * 0.72);
  ctx.fillStyle = '#cfe8ff';
  ctx.fillRect(m.len * 0.16, -m.w * 0.36, 4, m.w * 0.72);
  // Headlights.
  if (opts.lights) {
    ctx.fillStyle = '#ffe9a8';
    ctx.fillRect(m.len / 2 - 2, -m.w / 2 + 3, 3, 7);
    ctx.fillRect(m.len / 2 - 2, m.w / 2 - 10, 3, 7);
  }
  if (opts.police) {
    const on = Math.floor(performance.now() / 280) % 2 === 0;
    ctx.fillStyle = on ? '#ff2d2d' : '#2d6bff';
    ctx.fillRect(-6, -m.w / 2 + 4, 12, 7);
    ctx.fillStyle = on ? '#2d6bff' : '#ff2d2d';
    ctx.fillRect(-6, m.w / 2 - 11, 12, 7);
  }
  if (opts.hp != null && opts.hp < opts.maxHp) {
    ctx.fillStyle = '#222';
    ctx.fillRect(-m.len / 2, -m.w / 2 - 9, m.len, 4);
    ctx.fillStyle = opts.hp > opts.maxHp * 0.4 ? '#37b24d' : '#e33f2f';
    ctx.fillRect(-m.len / 2, -m.w / 2 - 9, m.len * (opts.hp / opts.maxHp), 4);
  }
  ctx.restore();
}

export function draw(G, ctx, city, vw, vh) {
  const pal = palette(G);
  const cam = G.camera;
  const night = pal.light < 0.75;
  ctx.fillStyle = pal.sky;
  ctx.fillRect(0, 0, vw, vh);
  ctx.save();
  ctx.translate(-cam.x, -cam.y);
  // Ground.
  ctx.fillStyle = pal.grass;
  ctx.fillRect(0, 0, CFG.world, CFG.world);
  // Roads.
  ctx.fillStyle = pal.road;
  for (let i = 0; i <= CFG.grid; i++) {
    ctx.fillRect(i * CFG.pitch, 0, CFG.road, CFG.world);
    ctx.fillRect(0, i * CFG.pitch, CFG.world, CFG.road);
  }
  // Road centre dashes.
  ctx.fillStyle = 'rgba(240,220,120,0.55)';
  for (let i = 0; i <= CFG.grid; i++) {
    const c = roadCenter(i);
    for (let d = 0; d < CFG.world; d += 64) {
      ctx.fillRect(c - 2, d, 4, 30);
      ctx.fillRect(d, c - 2, 30, 4);
    }
  }
  // Marina water.
  const marina = landmarkPos('marina');
  ctx.fillStyle = pal.water;
  ctx.fillRect(marina.x - 90, marina.y - 90, 180, 180);
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 3;
  ctx.strokeRect(marina.x - 90, marina.y - 90, 180, 180);
  // Buildings.
  for (const b of city.buildings) {
    ctx.fillStyle = pal.bld;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = pal.roof;
    ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
  }
  // Trees.
  for (const t of city.trees) {
    ctx.fillStyle = '#2f6b2f';
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
    ctx.fill();
  }
  // Landmark pads.
  const pads = [
    ['hideout', '#f2b705'], ['pitstop', '#37b24d'], ['gunbarn', '#8a5cf6'],
    ['taxistand', '#f2b705'], ['pier', '#e33f2f'], ['harbor', '#19b8a6'],
  ];
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'center';
  for (const [name, color] of pads) {
    const p = landmarkPos(name);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#10131a';
    ctx.fillText(name === 'hideout' ? 'H' : name === 'pitstop' ? 'P' : name === 'gunbarn' ? 'G' : name === 'taxistand' ? 'T' : name === 'pier' ? '9' : 'H', p.x, p.y + 5);
  }
  // Ledger pickup.
  if (G.mission.ledger) {
    ctx.fillStyle = '#f2b705';
    ctx.save();
    ctx.translate(G.mission.ledger.x, G.mission.ledger.y);
    ctx.rotate(Math.sin(G.time * 3) * 0.2);
    ctx.fillRect(-10, -7, 20, 14);
    ctx.fillStyle = '#10131a';
    ctx.fillRect(-10, -2, 20, 3);
    ctx.restore();
  }
  // Mission target marker.
  const mk = missionMarker(G);
  const pulse = 18 + Math.sin(G.time * 4) * 5;
  ctx.strokeStyle = '#f2b705';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(mk.x, mk.y, pulse, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#f2b705';
  ctx.beginPath();
  ctx.arc(mk.x, mk.y, 5, 0, Math.PI * 2);
  ctx.fill();
  // Pedestrians.
  for (const ped of G.peds) {
    ctx.fillStyle = ped.color;
    ctx.beginPath();
    ctx.arc(ped.x, ped.y, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#10131a';
    ctx.beginPath();
    ctx.arc(ped.x + Math.cos(ped.angle) * 4, ped.y + Math.sin(ped.angle) * 4, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  // Breakers.
  for (const b of G.mission.breakers) {
    ctx.fillStyle = '#c22525';
    ctx.beginPath();
    ctx.arc(b.x, b.y, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillRect(b.x - 10, b.y - 20, 20, 4);
    ctx.fillStyle = '#e33f2f';
    ctx.fillRect(b.x - 10, b.y - 20, 20 * (b.hp / 100), 4);
  }
  // Cars.
  for (const car of G.cars) {
    drawCar(ctx, car.x, car.y, car.angle, car.model, car.color, { lights: night, hp: car.hp, maxHp: car.maxHp });
  }
  // Police.
  for (const cop of G.cops) {
    if (cop.kind === 'car') {
      drawCar(ctx, cop.car.x, cop.car.y, cop.car.angle, 0, '#1c2733', { lights: night, police: true, hp: cop.car.hp, maxHp: cop.car.maxHp });
    } else {
      ctx.fillStyle = '#1c2733';
      ctx.beginPath();
      ctx.arc(cop.x, cop.y, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2d6bff';
      ctx.beginPath();
      ctx.arc(cop.x, cop.y - 4, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Player.
  const p = G.player;
  if (p.onFoot) {
    ctx.fillStyle = '#f2f2f2';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#e33f2f';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + Math.cos(p.angle) * 20, p.y + Math.sin(p.angle) * 20);
    ctx.stroke();
    if (p.punchT > 0.15) {
      ctx.strokeStyle = '#f2b705';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(p.x + Math.cos(p.angle) * 26, p.y + Math.sin(p.angle) * 26, 12, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  // Bullets.
  ctx.strokeStyle = '#ffe066';
  ctx.lineWidth = 3;
  for (const b of G.bullets) {
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
    ctx.stroke();
  }
  // Particles.
  for (const pt of G.parts) {
    ctx.globalAlpha = clamp(pt.life * 2, 0, 1);
    ctx.fillStyle = pt.color;
    ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
  }
  ctx.globalAlpha = 1;
  // Floating texts.
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'center';
  for (const f of G.floats) {
    ctx.globalAlpha = clamp(f.life, 0, 1);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
  // Night darkness + headlight cones.
  if (night) {
    ctx.fillStyle = `rgba(5,8,24,${(0.75 - pal.light) * 0.55})`;
    ctx.fillRect(cam.x, cam.y, vw, vh);
    const car = p.car;
    if (car) {
      const gx = car.x + Math.cos(car.angle) * 190;
      const gy = car.y + Math.sin(car.angle) * 190;
      const grad = ctx.createRadialGradient(gx, gy, 10, gx, gy, 260);
      grad.addColorStop(0, 'rgba(255,233,168,0.5)');
      grad.addColorStop(1, 'rgba(255,233,168,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(gx, gy, 260, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const grad = ctx.createRadialGradient(p.x, p.y, 10, p.x, p.y, 130);
      grad.addColorStop(0, 'rgba(255,233,168,0.35)');
      grad.addColorStop(1, 'rgba(255,233,168,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 130, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
  drawMinimap(G, ctx, vw, vh);
  drawEdgeArrow(G, ctx, vw, vh);
}

function drawMinimap(G, ctx, vw, vh) {
  const size = 176;
  const x0 = vw - size - 14;
  const y0 = vh - size - 14;
  const s = size / CFG.world;
  ctx.fillStyle = 'rgba(10,14,24,0.82)';
  ctx.fillRect(x0 - 4, y0 - 4, size + 8, size + 8);
  ctx.strokeStyle = '#f2b705';
  ctx.lineWidth = 2;
  ctx.strokeRect(x0 - 4, y0 - 4, size + 8, size + 8);
  ctx.fillStyle = '#3f434c';
  for (let i = 0; i <= CFG.grid; i++) {
    ctx.fillRect(x0 + (i * CFG.pitch * s), y0, CFG.road * s, size);
    ctx.fillRect(x0, y0 + (i * CFG.pitch * s), size, CFG.road * s);
  }
  const mk = missionMarker(G);
  ctx.fillStyle = '#f2b705';
  ctx.beginPath();
  ctx.arc(x0 + mk.x * s, y0 + mk.y * s, 5, 0, Math.PI * 2);
  ctx.fill();
  for (const cop of G.cops) {
    ctx.fillStyle = '#ff2d2d';
    ctx.beginPath();
    ctx.arc(x0 + cop.x * s, y0 + cop.y * s, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(x0 + G.player.x * s, y0 + G.player.y * s, 4, 0, Math.PI * 2);
  ctx.fill();
}

function drawEdgeArrow(G, ctx, vw, vh) {
  const mk = missionMarker(G);
  const sx = mk.x - G.camera.x;
  const sy = mk.y - G.camera.y;
  if (sx > 0 && sx < vw && sy > 0 && sy < vh) return;
  const cx = vw / 2;
  const cy = vh / 2;
  const a = Math.atan2(sy - cy, sx - cx);
  const ex = cx + Math.cos(a) * 300;
  const ey = cy + Math.sin(a) * 220;
  ctx.save();
  ctx.translate(ex, ey);
  ctx.rotate(a);
  ctx.fillStyle = '#f2b705';
  ctx.beginPath();
  ctx.moveTo(16, 0);
  ctx.lineTo(-10, -11);
  ctx.lineTo(-10, 11);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
