// All canvas drawing: the city, its people and cars, day/night lighting with
// headlight cones, the HUD, the minimap and the title/pause/wasted/shop screens.

import { WORLD, districtAt, clamp, dist } from './config.js';

function isNight(clock) {
  return clock < 6 || clock >= 19;
}
function isDusk(clock) {
  return (clock >= 17 && clock < 19) || (clock >= 6 && clock < 8);
}

export function draw(G) {
  const { ctx, canvas } = G;
  const W = canvas.width, H = canvas.height;
  const cam = G.camera;
  ctx.clearRect(0, 0, W, H);

  // ---- world ---------------------------------------------------------------
  ctx.save();
  ctx.translate(-cam.x + W / 2, -cam.y + H / 2);
  const view = { x0: cam.x - W / 2 - 80, y0: cam.y - H / 2 - 80, x1: cam.x + W / 2 + 80, y1: cam.y + H / 2 + 80 };

  // Base asphalt.
  ctx.fillStyle = '#33363d';
  ctx.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);

  // District ground per block.
  for (let bx = 0; bx < 9; bx++) {
    for (let by = 0; by < 9; by++) {
      const x0 = 232 + bx * WORLD.roadGap, y0 = 232 + by * WORLD.roadGap;
      if (x0 > view.x1 || y0 > view.y1 || x0 + WORLD.block < view.x0 || y0 + WORLD.block < view.y0) continue;
      const d = districtAt(bx, by);
      ctx.fillStyle = d.ground;
      ctx.fillRect(x0, y0, WORLD.block, WORLD.block);
      if (d.kind === 'park') {
        ctx.fillStyle = '#4a7a3d';
        ctx.fillRect(x0 + 8, y0 + 8, WORLD.block - 16, WORLD.block - 16);
      }
    }
  }

  // Water: harbor bay and park lake, with a lighter shore line.
  for (const wa of G.world.water) {
    ctx.fillStyle = wa.kind === 'bay' ? '#2a6a9a' : '#3a8ab0';
    ctx.fillRect(wa.x, wa.y, wa.w, wa.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 3;
    ctx.strokeRect(wa.x, wa.y, wa.w, wa.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(wa.x + 20, wa.y + (wa.h / 4) * i);
      ctx.lineTo(wa.x + wa.w - 20, wa.y + (wa.h / 4) * i);
      ctx.stroke();
    }
  }

  // Roads: dark strips with pale edge lines and dashed centres.
  ctx.fillStyle = '#2b2e33';
  for (const rx of G.world.roads) {
    ctx.fillRect(rx - WORLD.roadWidth / 2, 0, WORLD.roadWidth, WORLD.size);
    ctx.fillRect(0, rx - WORLD.roadWidth / 2, WORLD.size, WORLD.roadWidth);
  }
  ctx.strokeStyle = '#c8c8a8';
  ctx.lineWidth = 2;
  for (const rx of G.world.roads) {
    ctx.beginPath(); ctx.moveTo(rx - WORLD.roadWidth / 2 + 3, 0); ctx.lineTo(rx - WORLD.roadWidth / 2 + 3, WORLD.size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(rx + WORLD.roadWidth / 2 - 3, 0); ctx.lineTo(rx + WORLD.roadWidth / 2 - 3, WORLD.size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, rx - WORLD.roadWidth / 2 + 3); ctx.lineTo(WORLD.size, rx - WORLD.roadWidth / 2 + 3); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, rx + WORLD.roadWidth / 2 - 3); ctx.lineTo(WORLD.size, rx + WORLD.roadWidth / 2 - 3); ctx.stroke();
  }
  ctx.strokeStyle = '#e8d44d';
  ctx.lineWidth = 3;
  ctx.setLineDash([26, 22]);
  for (const rx of G.world.roads) {
    ctx.beginPath(); ctx.moveTo(rx, 0); ctx.lineTo(rx, WORLD.size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, rx); ctx.lineTo(WORLD.size, rx); ctx.stroke();
  }
  ctx.setLineDash([]);

  // Trees.
  for (const t of G.world.trees) {
    if (t.x < view.x0 || t.x > view.x1 || t.y < view.y0 || t.y > view.y1) continue;
    ctx.fillStyle = '#2d5a24';
    ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3f7a33';
    ctx.beginPath(); ctx.arc(t.x - 2, t.y - 2, t.r * 0.65, 0, Math.PI * 2); ctx.fill();
  }

  // Buildings: shadow, body, roof detail; towers get lit windows at night.
  const night = isNight(G.clock);
  for (const b of G.world.buildings) {
    if (b.x > view.x1 || b.y > view.y1 || b.x + b.w < view.x0 || b.y + b.h < view.y0) continue;
    const sh = b.hgt * 0.35;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(b.x + sh, b.y + sh, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    // Roof details.
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(b.x + b.w * 0.15, b.y + b.h * 0.15, b.w * 0.25, b.h * 0.25);
    ctx.fillRect(b.x + b.w * 0.6, b.y + b.h * 0.6, b.w * 0.2, b.h * 0.2);
    if (b.kind === 'plaza') {
      // Helipad: a ring with an H.
      ctx.strokeStyle = '#f1c40f';
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(b.x + b.w / 2, b.y + b.h / 2, 52, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#f1c40f';
      ctx.font = 'bold 44px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('H', b.x + b.w / 2, b.y + b.h / 2);
    }
    if (night && b.kind === 'towers') {
      ctx.fillStyle = 'rgba(255,220,120,0.85)';
      for (let wy = b.y + 14; wy < b.y + b.h - 10; wy += 22) {
        for (let wx = b.x + 12; wx < b.x + b.w - 10; wx += 20) {
          if (((wx * 7 + wy * 13) % 5) < 2) ctx.fillRect(wx, wy, 7, 9);
        }
      }
    }
  }

  // Shops: coloured storefronts with a sign.
  for (const s of G.world.shops) {
    ctx.fillStyle = s.color;
    ctx.fillRect(s.x - 34, s.y - 24, 68, 48);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(s.x - 34, s.y - 24, 68, 48);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const short = s.id === 'pitstop' ? 'PIT STOP' : s.id === 'gunbarn' ? 'GUN BARN' : 'DINER';
    ctx.fillText(short, s.x, s.y);
  }

  // Mission marker: pulsing diamond + a ground ring.
  if (G.marker) {
    const pulse = 1 + Math.sin(G.elapsed * 5) * 0.18;
    const mx = G.marker.x, my = G.marker.y;
    ctx.save();
    ctx.translate(mx, my);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = '#f1c40f';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -22); ctx.lineTo(14, 0); ctx.lineTo(0, 22); ctx.lineTo(-14, 0);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = 'rgba(241,196,15,0.8)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(mx, my, 34 + Math.sin(G.elapsed * 5) * 6, 0, Math.PI * 2); ctx.stroke();
  }

  // Cash bags (M5).
  if (G.mission && G.mission.def.id === 'm5' && G.mission.data.bags) {
    for (const b of G.mission.data.bags) {
      if (b.got) continue;
      ctx.fillStyle = '#27ae60';
      ctx.beginPath(); ctx.arc(b.x, b.y, 14, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('$', b.x, b.y);
    }
  }

  // Pedestrians: a body dot with a facing tick, coloured by type.
  for (const p of G.peds) {
    if (p.dead) {
      ctx.fillStyle = 'rgba(120,20,20,0.7)';
      ctx.beginPath(); ctx.arc(p.x, p.y, 8, 0, Math.PI * 2); ctx.fill();
      continue;
    }
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, 9, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.strokeStyle = p.color;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + Math.cos(p.angle) * 12, p.y + Math.sin(p.angle) * 12); ctx.stroke();
    if (p.guard) {
      ctx.fillStyle = '#e74c3c';
      ctx.fillRect(p.x - 10, p.y - 20, 20, 4);
      ctx.fillStyle = '#27ae60';
      ctx.fillRect(p.x - 10, p.y - 20, 20 * Math.max(0, p.hp / 80), 4);
    }
    if (p.passenger) {
      ctx.fillStyle = '#f1c40f';
      ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('TAXI', p.x, p.y - 16);
    }
  }

  // Cars.
  for (const car of G.cars) {
    if (car.hp <= 0 && !car.cop) continue;
    drawCar(G, car);
  }

  // Player on foot.
  const P = G.player;
  if (!P.inCar) {
    ctx.fillStyle = '#f39c12';
    ctx.beginPath(); ctx.arc(P.x, P.y, 11, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = '#f39c12'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(P.x, P.y);
    ctx.lineTo(P.x + Math.cos(P.angle) * 15, P.y + Math.sin(P.angle) * 15); ctx.stroke();
  }

  // ---- night lighting --------------------------------------------------------
  if (night) {
    ctx.fillStyle = 'rgba(8,10,38,0.5)';
    ctx.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    // Headlight cones.
    for (const car of G.cars) {
      if (car.hp <= 0) continue;
      drawCone(G, car);
    }
    if (P.inCar) drawCone(G, P.inCar);
    // Lamp glows.
    for (const l of G.world.lamps) {
      if (l.x < view.x0 || l.x > view.x1 || l.y < view.y0 || l.y > view.y1) continue;
      if (Math.abs(l.x - cam.x) > W / 2 + 40 || Math.abs(l.y - cam.y) > H / 2 + 40) continue;
      const g = ctx.createRadialGradient(l.x, l.y, 2, l.x, l.y, 46);
      g.addColorStop(0, 'rgba(255,220,130,0.35)');
      g.addColorStop(1, 'rgba(255,220,130,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(l.x, l.y, 46, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  } else if (isDusk(G.clock)) {
    ctx.fillStyle = 'rgba(255,120,40,0.12)';
    ctx.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);
  }

  // Screen-edge arrow to the marker when it is off-screen.
  if (G.marker) {
    const dx = G.marker.x - cam.x, dy = G.marker.y - cam.y;
    if (Math.abs(dx) > W / 2 - 60 || Math.abs(dy) > H / 2 - 60) {
      const a = Math.atan2(dy, dx);
      const ax = cam.x + Math.cos(a) * (Math.min(W, H) / 2 - 70);
      const ay = cam.y + Math.sin(a) * (Math.min(W, H) / 2 - 70);
      ctx.save();
      ctx.translate(ax, ay);
      ctx.rotate(a);
      ctx.fillStyle = '#f1c40f';
      ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(-10, -12); ctx.lineTo(-10, 12); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }

  ctx.restore();

  // ---- HUD -------------------------------------------------------------------
  drawHUD(G);
  if (G.screen === 'title') drawTitle(G);
  else if (G.screen === 'pause') drawPause(G);
  else if (G.screen === 'wasted') drawWasted(G);
  if (G.shopOpen) drawShop(G);
}

function drawCar(G, car) {
  const { ctx } = G;
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(-car.len / 2 + 4, -car.wid / 2 + 4, car.len, car.wid);
  ctx.fillStyle = car.color;
  roundRect(ctx, -car.len / 2, -car.wid / 2, car.len, car.wid, 8);
  ctx.fill();
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 1.5;
  roundRect(ctx, -car.len / 2, -car.wid / 2, car.len, car.wid, 8);
  ctx.stroke();
  // Windshield + rear window.
  ctx.fillStyle = 'rgba(180,220,255,0.85)';
  ctx.fillRect(car.len * 0.12, -car.wid / 2 + 3, car.len * 0.2, car.wid - 6);
  ctx.fillStyle = 'rgba(30,30,40,0.8)';
  ctx.fillRect(-car.len * 0.38, -car.wid / 2 + 3, car.len * 0.12, car.wid - 6);
  if (car.model === 'taxi') {
    ctx.fillStyle = '#f1c40f';
    ctx.fillRect(-car.len * 0.1, -car.wid / 2 - 2, car.len * 0.2, 5);
    ctx.fillStyle = '#111';
    ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('TAXI', 0, 0);
  }
  if (car.cop) {
    // Light bar, flashing red/blue.
    const on = Math.floor(G.elapsed * 6) % 2 === 0;
    ctx.fillStyle = on ? '#ff2a2a' : '#2a5aff';
    ctx.fillRect(-6, -car.wid / 2 - 4, 12, 6);
    ctx.fillStyle = on ? '#2a5aff' : '#ff2a2a';
    ctx.fillRect(-6, car.wid / 2 - 2, 12, 6);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('POLICE', 0, 0);
  }
  if (car.bankVan) {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('$ BANK $', 0, 0);
  }
  if (car.getaway) {
    ctx.fillStyle = '#f1c40f';
    ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('GETAWAY', 0, -car.wid / 2 - 10);
  }
  ctx.restore();
  // Damage smoke.
  if (car.hp < 50 && car.hp > 0) {
    ctx.fillStyle = 'rgba(120,120,120,0.6)';
    ctx.beginPath(); ctx.arc(car.x - Math.cos(car.angle) * car.len / 2, car.y - Math.sin(car.angle) * car.len / 2, 8 + Math.random() * 6, 0, Math.PI * 2); ctx.fill();
  }
}

function drawCone(G, car) {
  const { ctx } = G;
  const fx = car.x + Math.cos(car.angle) * car.len / 2;
  const fy = car.y + Math.sin(car.angle) * car.len / 2;
  const len = 240;
  const spread = 0.42;
  const g = ctx.createLinearGradient(fx, fy, fx + Math.cos(car.angle) * len, fy + Math.sin(car.angle) * len);
  g.addColorStop(0, 'rgba(255,240,180,0.30)');
  g.addColorStop(1, 'rgba(255,240,180,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(fx, fy);
  const a1 = car.angle - spread, a2 = car.angle + spread;
  ctx.lineTo(fx + Math.cos(a1) * len, fy + Math.sin(a1) * len);
  ctx.lineTo(fx + Math.cos(a2) * len, fy + Math.sin(a2) * len);
  ctx.closePath();
  ctx.fill();
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

function drawHUD(G) {
  const { ctx, canvas } = G;
  const P = G.player;
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  // Money.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(12, 12, 220, 86);
  ctx.fillStyle = '#2ecc71';
  ctx.font = 'bold 28px sans-serif';
  ctx.fillText(`$${Math.floor(P.money)}`, 22, 44);
  // Health bar.
  ctx.fillStyle = '#333';
  ctx.fillRect(22, 54, 140, 12);
  ctx.fillStyle = P.health > 40 ? '#2ecc71' : '#e74c3c';
  ctx.fillRect(22, 54, 140 * clamp(P.health / 100, 0, 1), 12);
  ctx.fillStyle = '#fff';
  ctx.font = '12px sans-serif';
  ctx.fillText(`HP ${Math.ceil(P.health)}`, 168, 65);
  // Wanted stars.
  ctx.font = 'bold 24px sans-serif';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < Math.floor(P.wanted) ? '#f1c40f' : 'rgba(255,255,255,0.25)';
    ctx.fillText('★', 22 + i * 28, 96);
  }
  // Ammo / weapon.
  ctx.fillStyle = '#fff';
  ctx.font = '16px sans-serif';
  ctx.fillText(P.hasPistol ? `🔫 Ammo ${P.ammo}` : 'No gun — visit Gun Barn', 22, 122);
  if (P.inCar) {
    ctx.fillStyle = '#fff';
    ctx.font = '14px sans-serif';
    ctx.fillText(`${P.inCar.name}  HP ${Math.max(0, Math.ceil(P.inCar.hp))}`, 22, 144);
  }
  // Clock.
  const hh = Math.floor(G.clock) % 24;
  const mm = Math.floor((G.clock % 1) * 60);
  const label = isNight(G.clock) ? 'NIGHT' : isDusk(G.clock) ? 'DUSK' : 'DAY';
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(canvas.width - 120, 12, 108, 34);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')} ${label}`, canvas.width - 22, 35);
  ctx.textAlign = 'left';

  // Objective line.
  const objective = G.marker ? G.marker.label : (G.mission ? G.mission.def.brief : 'Free roam — press 1-5 for a mission, T taxi, C courier');
  ctx.font = 'bold 15px sans-serif';
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  const ow = ctx.measureText(objective).width + 24;
  ctx.fillRect((canvas.width - ow) / 2, canvas.height - 44, ow, 30);
  ctx.fillStyle = '#f1c40f';
  ctx.textAlign = 'center';
  ctx.fillText(objective, canvas.width / 2, canvas.height - 23);
  ctx.textAlign = 'left';

  // Transient message.
  if (G.message && G.elapsed - G.messageAt < 4) {
    ctx.font = '15px sans-serif';
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    const mw = ctx.measureText(G.message).width + 24;
    ctx.fillRect((canvas.width - mw) / 2, 110, mw, 30);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(G.message, canvas.width / 2, 131);
    ctx.textAlign = 'left';
  }

  drawMinimap(G);
}

function drawMinimap(G) {
  const { ctx, canvas } = G;
  const S = 168, X = canvas.width - S - 12, Y = 56;
  const k = S / 3600;
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(X - 4, Y - 4, S + 8, S + 8);
  ctx.save();
  ctx.beginPath(); ctx.rect(X, Y, S, S); ctx.clip();
  ctx.fillStyle = '#2b2e33';
  ctx.fillRect(X, Y, S, S);
  for (const wa of G.world.water) {
    ctx.fillStyle = '#2a6a9a';
    ctx.fillRect(X + wa.x * k, Y + wa.y * k, wa.w * k, wa.h * k);
  }
  ctx.fillStyle = '#555';
  for (const b of G.world.buildings) ctx.fillRect(X + b.x * k, Y + b.y * k, Math.max(1.5, b.w * k), Math.max(1.5, b.h * k));
  for (const s of G.world.shops) {
    ctx.fillStyle = s.color;
    ctx.beginPath(); ctx.arc(X + s.x * k, Y + s.y * k, 3.5, 0, Math.PI * 2); ctx.fill();
  }
  if (G.marker) {
    ctx.fillStyle = '#f1c40f';
    ctx.beginPath(); ctx.arc(X + G.marker.x * k, Y + G.marker.y * k, 4 + Math.sin(G.elapsed * 5) * 1.5, 0, Math.PI * 2); ctx.fill();
  }
  for (const car of G.cars) {
    if (!car.cop || car.hp <= 0) continue;
    ctx.fillStyle = '#2a5aff';
    ctx.fillRect(X + car.x * k - 2, Y + car.y * k - 2, 4, 4);
  }
  const P = G.player;
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(X + P.x * k, Y + P.y * k, 4, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#f1c40f'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(X + P.x * k, Y + P.y * k, 6.5, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(X - 4, Y - 4, S + 8, S + 8);
}

function overlay(G, alpha) {
  const { ctx, canvas } = G;
  ctx.fillStyle = `rgba(8,10,18,${alpha})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawTitle(G) {
  const { ctx, canvas } = G;
  overlay(G, 0.82);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f1c40f';
  ctx.font = 'bold 64px sans-serif';
  ctx.fillText('SOLMAR STREETS', canvas.width / 2, canvas.height / 2 - 110);
  ctx.fillStyle = '#fff';
  ctx.font = '20px sans-serif';
  ctx.fillText('An open-world crime game — five missions, two side jobs, one city that never sleeps.', canvas.width / 2, canvas.height / 2 - 66);
  ctx.font = 'bold 24px sans-serif';
  ctx.fillStyle = '#2ecc71';
  ctx.fillText(G.saveExists ? 'ENTER — Play      C — Continue saved game' : 'ENTER — Play', canvas.width / 2, canvas.height / 2 - 10);
  ctx.fillStyle = '#ccc';
  ctx.font = '15px sans-serif';
  const lines = [
    'WASD / Arrows — walk & drive      E — enter car / interact      SPACE — punch      Click — shoot',
    '1–5 — start mission      T — taxi job      C — courier job      P / ESC — pause      M — mute',
    'Steal cars, dodge the police, make money. Wanted level 0–5. Save with P → Save.',
  ];
  lines.forEach((l, i) => ctx.fillText(l, canvas.width / 2, canvas.height / 2 + 34 + i * 24));
  ctx.textAlign = 'left';
}

function drawPause(G) {
  const { ctx, canvas } = G;
  overlay(G, 0.7);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 44px sans-serif';
  ctx.fillText('PAUSED', canvas.width / 2, canvas.height / 2 - 40);
  ctx.font = '18px sans-serif';
  ctx.fillText('P / ESC — resume      S — save game      Q — quit to title', canvas.width / 2, canvas.height / 2 + 6);
  ctx.textAlign = 'left';
}

function drawWasted(G) {
  const { ctx, canvas } = G;
  overlay(G, 0.75);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#e74c3c';
  ctx.font = 'bold 72px sans-serif';
  ctx.fillText('WASTED', canvas.width / 2, canvas.height / 2 - 20);
  ctx.fillStyle = '#fff';
  ctx.font = '20px sans-serif';
  ctx.fillText('You lost $100. Press ENTER to get back on your feet.', canvas.width / 2, canvas.height / 2 + 30);
  ctx.textAlign = 'left';
}

function drawShop(G) {
  const { ctx, canvas } = G;
  const shop = G.shopOpen;
  const pw = 460, ph = 300;
  const x = (canvas.width - pw) / 2, y = (canvas.height - ph) / 2;
  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#1c1e24';
  ctx.fillRect(x, y, pw, ph);
  ctx.strokeStyle = shop.color;
  ctx.lineWidth = 3;
  ctx.strokeRect(x, y, pw, ph);
  ctx.textAlign = 'center';
  ctx.fillStyle = shop.color;
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText(shop.name.toUpperCase(), canvas.width / 2, y + 40);
  ctx.fillStyle = '#2ecc71';
  ctx.font = '18px sans-serif';
  ctx.fillText(`Your money: $${Math.floor(G.player.money)}`, canvas.width / 2, y + 68);
  ctx.textAlign = 'left';
  shop.items.forEach((it, i) => {
    const iy = y + 100 + i * 52;
    ctx.fillStyle = '#fff';
    ctx.font = '17px sans-serif';
    ctx.fillText(`${i + 1}. ${it.name}`, x + 24, iy);
    ctx.fillStyle = '#f1c40f';
    ctx.textAlign = 'right';
    ctx.fillText(`$${it.price}`, x + pw - 24, iy);
    ctx.textAlign = 'left';
  });
  ctx.fillStyle = '#aaa';
  ctx.font = '14px sans-serif';
  ctx.fillText('Press 1–3 to buy, E to leave.', x + 24, y + ph - 22);
}
