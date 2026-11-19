// SOLMAR STREETS — canvas rendering: city, cars, people, day/night + headlights, HUD, minimap, screens.
// Written fresh for round 9 (rebuild7).
import { WORLD, CITY, SHOPS } from './config.js';
import { roadCenter } from './city.js';

const VW = 1280, VH = 720;

function isNight(G) { return G.clock.hours >= 20 || G.clock.hours < 6; }
function isDusk(G) { return (G.clock.hours >= 17 && G.clock.hours < 20) || (G.clock.hours >= 6 && G.clock.hours < 8); }

function drawCar(ctx, c) {
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(c.angle);
  const w = c.model.w, h = c.model.h;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(-w / 2 + 3, -h / 2 + 3, w, h);
  ctx.fillStyle = c.color;
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2, w, h, 5);
  ctx.fill();
  // windshield + roof
  ctx.fillStyle = '#1c2733';
  ctx.fillRect(w * 0.12, -h / 2 + 3, w * 0.2, h - 6);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(-w * 0.28, -h / 2 + 3, w * 0.3, h - 6);
  // headlights
  ctx.fillStyle = '#fff8c0';
  ctx.fillRect(w / 2 - 2, -h / 2 + 2, 3, 4);
  ctx.fillRect(w / 2 - 2, h / 2 - 6, 3, 4);
  if (c.driver === 'police') {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PD', 0, 3);
    if (Math.floor(c.siren * 3) % 2 === 0) { ctx.fillStyle = '#ff2222'; } else { ctx.fillStyle = '#2255ff'; }
    ctx.fillRect(-4, -h / 2 - 2, 8, 3);
  }
  if (c.driver === 'courier' || c.driver === 'van') {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(c.driver === 'van' ? 'BANK' : '$', 0, 3);
  }
  // damage smoke
  if (c.hp < c.maxHp * 0.4) {
    ctx.fillStyle = 'rgba(120,120,120,0.5)';
    ctx.beginPath();
    ctx.arc(-w / 3, 0, 5 + Math.random() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawPed(ctx, p, t) {
  const bob = p.type.behavior === 'jog' || p.type.behavior === 'dart' ? Math.sin(p.walkPhase) * 1.5 : 0;
  ctx.save();
  ctx.translate(p.x, p.y + bob * 0.3);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(0, 4, 7, 3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = p.type.color;
  ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#222';
  ctx.beginPath(); ctx.arc(Math.cos(p.angle) * 3, Math.sin(p.angle) * 3, 2.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawPlayer(ctx, G) {
  const pl = G.player;
  if (!pl.onFoot) return;
  ctx.save();
  ctx.translate(pl.x, pl.y);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(0, 5, 9, 4, 0, 0, Math.PI * 2); ctx.fill();
  // bright jacket so the player is unmistakable on foot
  ctx.fillStyle = '#ffdd00';
  ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#111'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#222';
  ctx.beginPath(); ctx.arc(Math.cos(pl.angle) * 4, Math.sin(pl.angle) * 4, 3.5, 0, Math.PI * 2); ctx.fill();
  // gun in hand when ammo > 0
  if (pl.ammo > 0) {
    ctx.strokeStyle = '#333'; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(Math.cos(pl.angle) * 8, Math.sin(pl.angle) * 8);
    ctx.lineTo(Math.cos(pl.angle) * 16, Math.sin(pl.angle) * 16);
    ctx.stroke();
  }
  if (pl.muzzle > 0) {
    ctx.fillStyle = '#ffe66d';
    ctx.beginPath(); ctx.arc(Math.cos(pl.angle) * 20, Math.sin(pl.angle) * 20, 6, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawMarker(ctx, x, y, color, t) {
  const r = 14 + Math.sin(t * 5) * 4;
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

export function draw(G, ctx) {
  const t = G.time;
  const pl = G.player;
  const camX = Math.max(VW / 2, Math.min(CITY - VW / 2, pl.x));
  const camY = Math.max(VH / 2, Math.min(CITY - VH / 2, pl.y));
  const ox = camX - VW / 2, oy = camY - VH / 2;
  const night = isNight(G), dusk = isDusk(G);

  // ground
  ctx.fillStyle = night ? '#1a2233' : dusk ? '#7a6a58' : '#8aa06a';
  ctx.fillRect(0, 0, VW, VH);
  // sidewalks + roads
  ctx.fillStyle = night ? '#2c3648' : dusk ? '#6a5f52' : '#b8b0a0';
  for (let i = 0; i <= WORLD.BLOCKS; i++) {
    const c = roadCenter(i);
    ctx.fillRect(c - WORLD.ROAD / 2 - 8 - ox, -oy, WORLD.ROAD + 16, CITY);
    ctx.fillRect(-ox, c - WORLD.ROAD / 2 - 8 - oy, CITY, WORLD.ROAD + 16);
  }
  ctx.fillStyle = night ? '#141a26' : dusk ? '#3d3a44' : '#3a3f4a';
  for (let i = 0; i <= WORLD.BLOCKS; i++) {
    const c = roadCenter(i);
    ctx.fillRect(c - WORLD.ROAD / 2 - ox, -oy, WORLD.ROAD, CITY);
    ctx.fillRect(-ox, c - WORLD.ROAD / 2 - oy, CITY, WORLD.ROAD);
  }
  // lane dashes
  ctx.strokeStyle = night ? '#4a5568' : '#e8e8e8';
  ctx.lineWidth = 2;
  ctx.setLineDash([18, 22]);
  for (let i = 0; i <= WORLD.BLOCKS; i++) {
    const c = roadCenter(i);
    ctx.beginPath(); ctx.moveTo(c - ox, -oy); ctx.lineTo(c - ox, CITY - oy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-ox, c - oy); ctx.lineTo(CITY - ox, c - oy); ctx.stroke();
  }
  ctx.setLineDash([]);

  // buildings
  for (const b of G.city.buildings) {
    ctx.fillStyle = b.color;
    ctx.globalAlpha = night ? 0.85 : 1;
    ctx.fillRect(b.x - ox, b.y - oy, b.w, b.h);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x - ox, b.y - oy, b.w, b.h);
    // windows
    ctx.fillStyle = night ? '#ffd76a' : 'rgba(255,255,255,0.35)';
    for (let w = 0; w < b.windows; w++) {
      const wx = b.x + 8 + (w % 3) * ((b.w - 16) / 3);
      const wy = b.y + 8 + Math.floor(w / 3) * 18;
      if (wy < b.y + b.h - 10) ctx.fillRect(wx - ox, wy - oy, 10, 8);
    }
  }

  // landmarks
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  const lm = G.city.landmarks;
  const lmDraw = (p, label, color) => {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(p.x - ox, p.y - oy, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 3;
    ctx.strokeText(label, p.x - ox, p.y - oy - 16);
    ctx.fillText(label, p.x - ox, p.y - oy - 16);
  };
  lmDraw(lm.harbor, 'Harbor', '#1abc9c');
  lmDraw(lm.bank, 'Solmar Bank', '#f1c40f');
  lmDraw(lm.plaza, 'Rooftop Plaza', '#9b59b6');
  lmDraw(lm.pitstop, 'Pit Stop', '#e74c3c');
  lmDraw(lm.gunbarn, 'Gun Barn', '#f39c12');
  lmDraw(lm.diner, 'Diner', '#2ecc71');
  lmDraw(lm.home, 'Home', '#3498db');
  lmDraw(lm.taxistand, 'Taxi Stand', '#f5c518');

  // mission / job markers
  if (G.mission && G.mission.target) drawMarker(ctx, G.mission.target.x - ox, G.mission.target.y - oy, '#ffe135', t);
  if (G.mission && G.mission.id === 5 && G.mission.stage === 1 && G.mission.extra.bags) {
    for (const b of G.mission.extra.bags) {
      if (!b.got) {
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(b.x - ox - 7, b.y - oy - 6, 14, 12);
        ctx.fillStyle = '#fff'; ctx.font = 'bold 10px sans-serif';
        ctx.fillText('$', b.x - ox, b.y - oy + 3);
      }
    }
  }
  if (G.taxi.active && G.taxi.dest) drawMarker(ctx, G.taxi.dest.x - ox, G.taxi.dest.y - oy, '#f5c518', t);
  if (G.taxi.passenger) drawMarker(ctx, G.taxi.passenger.x - ox, G.taxi.passenger.y - oy, '#f5c518', t);
  if (G.courier.active) {
    const d = G.courier.drops[G.courier.stage];
    if (d) drawMarker(ctx, d.x - ox, d.y - oy, '#e67e22', t);
  }

  // entities
  for (const c of G.cars) if (!c.dead) drawCar(ctx, { ...c, x: c.x - ox, y: c.y - oy, siren: c.siren });
  for (const p of G.peds) if (!p.dead) drawPed(ctx, { ...p, x: p.x - ox, y: p.y - oy }, t);
  for (const b of G.breakers) {
    if (b.dead) continue;
    ctx.save();
    ctx.translate(b.x - ox, b.y - oy);
    ctx.fillStyle = '#c0392b';
    ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 9px sans-serif';
    ctx.fillText('B', 0, 3);
    // hp bar
    ctx.fillStyle = '#333'; ctx.fillRect(-12, -20, 24, 4);
    ctx.fillStyle = '#e74c3c'; ctx.fillRect(-12, -20, 24 * (b.hp / b.maxHp), 4);
    ctx.restore();
  }
  drawPlayer(ctx, { ...G, player: { ...pl, x: pl.x - ox, y: pl.y - oy } });

  // night overlay + headlights
  if (night || dusk) {
    ctx.fillStyle = night ? 'rgba(6,8,28,0.55)' : 'rgba(40,20,60,0.22)';
    ctx.fillRect(0, 0, VW, VH);
    if (night) {
      const src = pl.onFoot ? pl : pl.car;
      if (src) {
        const sx = src.x - ox, sy = src.y - oy;
        const ang = src.angle;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const grad = ctx.createRadialGradient(sx, sy, 10, sx, sy, 260);
        grad.addColorStop(0, 'rgba(255,244,190,0.55)');
        grad.addColorStop(0.5, 'rgba(255,244,190,0.18)');
        grad.addColorStop(1, 'rgba(255,244,190,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.arc(sx, sy, 260, ang - 0.42, ang + 0.42);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }
  }

  drawHUD(G, ctx, t);
  if (G.screen === 'title') drawTitle(G, ctx);
  else if (G.screen === 'paused') drawPause(G, ctx);
  else if (G.screen === 'wasted') drawWasted(G, ctx);
  if (G.shopOpen) drawShop(G, ctx);
}

function drawHUD(G, ctx, t) {
  const pl = G.player;
  // money + wanted
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(12, 10, 190, 52);
  ctx.fillStyle = '#2ecc71';
  ctx.font = 'bold 24px sans-serif'; ctx.textAlign = 'left';
  ctx.fillText('$' + G.money, 22, 36);
  ctx.font = '20px sans-serif';
  let stars = '';
  for (let i = 0; i < 5; i++) stars += i < G.wanted ? '★' : '☆';
  ctx.fillStyle = G.wanted > 0 ? '#f1c40f' : '#888';
  ctx.fillText(stars, 22, 58);
  // clock
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(VW - 190, 10, 178, 34);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'right';
  const moon = (G.clock.hours >= 20 || G.clock.hours < 6) ? '🌙' : '☀️';
  ctx.fillText(`${moon} ${String(G.clock.hours).padStart(2, '0')}:${String(Math.floor(G.clock.minutes)).padStart(2, '0')}  Day ${G.clock.day}`, VW - 22, 34);
  // objective banner
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  const ob = G.objective;
  ctx.font = 'bold 15px sans-serif';
  const w = ctx.measureText(ob).width + 24;
  ctx.fillRect((VW - w) / 2, 10, w, 30);
  ctx.fillStyle = '#ffe135'; ctx.textAlign = 'center';
  ctx.fillText(ob, VW / 2, 30);
  // message
  if (G.messageTimer > 0) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.font = '15px sans-serif';
    const mw = ctx.measureText(G.message).width + 20;
    ctx.fillRect((VW - mw) / 2, 48, mw, 26);
    ctx.fillStyle = '#fff';
    ctx.fillText(G.message, VW / 2, 66);
  }
  // HP + ammo
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(12, VH - 52, 210, 40);
  ctx.fillStyle = '#333'; ctx.fillRect(22, VH - 42, 140, 12);
  ctx.fillStyle = pl.hp > 30 ? '#e74c3c' : '#ff8800';
  ctx.fillRect(22, VH - 42, 140 * (pl.hp / 100), 12);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'left';
  ctx.fillText('HP ' + Math.ceil(pl.hp), 168, VH - 31);
  ctx.fillText('Ammo ' + pl.ammo, 22, VH - 18);
  // speed
  if (!pl.onFoot && pl.car) {
    ctx.fillStyle = '#fff'; ctx.font = 'bold 20px sans-serif'; ctx.textAlign = 'right';
    ctx.fillText(Math.round(Math.abs(pl.car.speed) * 0.7) + ' km/h', VW - 210, VH - 24);
  }
  // shop prompt
  if (G.shopNear && !G.shopOpen) {
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center';
    const s = G.shopNear;
    const txt = `Press E — ${s.name}: ${s.item} ($${s.price})`;
    const tw = ctx.measureText(txt).width + 20;
    ctx.fillRect((VW - tw) / 2, VH - 96, tw, 30);
    ctx.fillStyle = '#ffe135';
    ctx.fillText(txt, VW / 2, VH - 76);
  }
  if (!pl.onFoot) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.font = '14px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('Press E — get out of the car', VW / 2, VH - 110);
  }
  drawMinimap(G, ctx);
}

function drawMinimap(G, ctx) {
  const S = 170, x0 = VW - S - 14, y0 = VH - S - 14;
  const k = S / CITY;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(x0 - 4, y0 - 4, S + 8, S + 8);
  ctx.fillStyle = '#222';
  ctx.fillRect(x0, y0, S, S);
  ctx.strokeStyle = '#555'; ctx.lineWidth = 1;
  for (let i = 0; i <= WORLD.BLOCKS; i++) {
    const c = roadCenter(i) * k;
    ctx.beginPath(); ctx.moveTo(x0 + c, y0); ctx.lineTo(x0 + c, y0 + S); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x0, y0 + c); ctx.lineTo(x0 + S, y0 + c); ctx.stroke();
  }
  const dot = (x, y, color, r = 3) => {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x0 + x * k, y0 + y * k, r, 0, Math.PI * 2); ctx.fill();
  };
  for (const c of G.cars) if (!c.dead) dot(c.x, c.y, c.driver === 'police' ? '#ff3333' : '#f5c518', 2);
  for (const p of G.peds) if (!p.dead) dot(p.x, p.y, '#7fb069', 1.5);
  if (G.mission && G.mission.target) dot(G.mission.target.x, G.mission.target.y, '#ffe135', 5);
  dot(G.player.x, G.player.y, '#fff', 4);
  // player arrow
  ctx.save();
  ctx.translate(x0 + G.player.x * k, y0 + G.player.y * k);
  ctx.rotate(G.player.angle);
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-5, -4); ctx.lineTo(-5, 4); ctx.closePath(); ctx.fill();
  ctx.restore();
}

function drawTitle(G, ctx) {
  ctx.fillStyle = 'rgba(0,0,0,0.72)';
  ctx.fillRect(0, 0, VW, VH);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffe135';
  ctx.font = 'bold 64px sans-serif';
  ctx.fillText('SOLMAR STREETS', VW / 2, 220);
  ctx.fillStyle = '#fff';
  ctx.font = '22px sans-serif';
  ctx.fillText('An open-world crime game — 5 missions, taxi & courier jobs, police, shops, day & night.', VW / 2, 268);
  ctx.font = 'bold 24px sans-serif';
  ctx.fillStyle = '#2ecc71';
  ctx.fillText('Click to play', VW / 2, 360);
  if (G.hasSave) {
    ctx.fillStyle = '#3498db';
    ctx.fillText('Press C — Continue saved game', VW / 2, 400);
  }
  ctx.fillStyle = '#ccc';
  ctx.font = '16px sans-serif';
  ctx.fillText('WASD / arrows — move & drive   E — enter / exit car, interact   Space — punch   Click — shoot', VW / 2, 470);
  ctx.fillText('P — pause   M — mute   Save is automatic after missions.', VW / 2, 498);
}

function drawPause(G, ctx) {
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, VW, VH);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 44px sans-serif';
  ctx.fillText('PAUSED', VW / 2, 320);
  ctx.font = '20px sans-serif';
  ctx.fillText('Press P to resume — progress is saved automatically.', VW / 2, 368);
}

function drawWasted(G, ctx) {
  ctx.fillStyle = 'rgba(60,0,0,0.72)';
  ctx.fillRect(0, 0, VW, VH);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff4444';
  ctx.font = 'bold 72px sans-serif';
  ctx.fillText('WASTED', VW / 2, 330);
  ctx.fillStyle = '#fff';
  ctx.font = '22px sans-serif';
  ctx.fillText('Press Enter to respawn at Home (-$100).', VW / 2, 380);
}

function drawShop(G, ctx) {
  const s = G.shopOpen;
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(0, 0, VW, VH);
  ctx.fillStyle = '#1c2733';
  ctx.fillRect(VW / 2 - 220, 180, 440, 220);
  ctx.strokeStyle = '#ffe135'; ctx.lineWidth = 3;
  ctx.strokeRect(VW / 2 - 220, 180, 440, 220);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffe135';
  ctx.font = 'bold 28px sans-serif';
  ctx.fillText(s.name, VW / 2, 226);
  ctx.fillStyle = '#fff';
  ctx.font = '20px sans-serif';
  ctx.fillText(`${s.item} — $${s.price}`, VW / 2, 268);
  ctx.fillText(`Your money: $${G.money}`, VW / 2, 300);
  ctx.fillStyle = '#2ecc71';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('Press 1 — Buy    Press E / Esc — Close', VW / 2, 350);
  if (G.shopResult) {
    ctx.fillStyle = '#ffe135';
    ctx.font = '18px sans-serif';
    ctx.fillText(G.shopResult, VW / 2, 384);
  }
}
