// SOLMAR STREETS — everything the player sees: the city, the cars, the
// people, the effects, the HUD, the minimap and every menu. One clear job:
// paint the world, then paint the interface on top of it.

import { CAR_MODELS, DISTRICTS, GAME_VERSION, PLACES, ROADS, TUNING, VIEW, WORLD } from './config.js';
import { distance } from './entities.js';
import { currentObjective, objectiveTarget } from './missions.js';
import { hasSave, loadGame, saveSummary, statsSummary } from './save.js';

const MINIMAP_W = 184;
const MINIMAP_H = 138;
const MAP_SCALE = MINIMAP_W / WORLD.width;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function groundBaseColor(x, y) {
  if (y >= ROADS.waterTop) return '#1f6f9f';
  if (y >= ROADS.beachTop) return '#e8d29a';
  if (x >= 3250) return '#8a8f96';
  return '#9aa86b';
}

/** Pre-render the static city once, onto an offscreen canvas. */
export function ensureGround(world) {
  if (world._ground) return world._ground;
  const g = document.createElement('canvas');
  g.width = WORLD.width;
  g.height = WORLD.height;
  const ctx = g.getContext('2d');
  const city = world.city;
  const half = ROADS.width / 2;

  // Ground: dry grass, beach sand, sea, dock concrete.
  ctx.fillStyle = '#9aa86b';
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);
  ctx.fillStyle = '#8a8f96';
  ctx.fillRect(3250, 0, WORLD.width - 3250, WORLD.height);
  ctx.fillStyle = '#e8d29a';
  ctx.fillRect(0, ROADS.beachTop, WORLD.width, WORLD.height - ROADS.beachTop);
  const sea = ctx.createLinearGradient(0, ROADS.waterTop, 0, WORLD.height);
  sea.addColorStop(0, '#2e8fc0');
  sea.addColorStop(1, '#155a86');
  ctx.fillStyle = sea;
  ctx.fillRect(0, ROADS.waterTop, WORLD.width, WORLD.height - ROADS.waterTop);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  for (let y = ROADS.waterTop + 18; y < WORLD.height; y += 26) {
    ctx.beginPath();
    for (let x = 0; x <= WORLD.width; x += 60) {
      const yy = y + Math.sin(x * 0.01 + y) * 3;
      if (x === 0) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
  // The park: a green block with paths, and the fountain at its heart.
  ctx.fillStyle = '#6f9e5a';
  ctx.fillRect(1500, 700, 400, 400);
  ctx.strokeStyle = '#d9c9a0';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(1500, 900);
  ctx.lineTo(1900, 900);
  ctx.moveTo(1700, 700);
  ctx.lineTo(1700, 1100);
  ctx.stroke();
  // The fountain: stone rim, blue water, a white jet in the middle.
  ctx.fillStyle = '#8a8f96';
  ctx.beginPath();
  ctx.arc(1700, 900, 42, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2e8fc0';
  ctx.beginPath();
  ctx.arc(1700, 900, 34, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8f6ff';
  ctx.beginPath();
  ctx.arc(1700, 900, 10, 0, Math.PI * 2);
  ctx.fill();
  // The wooden pier reaching into the sea, and the lighthouse on the sand.
  ctx.fillStyle = '#8a6a45';
  ctx.fillRect(3380, 2480, 60, 180);
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 2;
  for (let y = 2490; y < 2660; y += 18) {
    ctx.beginPath();
    ctx.moveTo(3380, y);
    ctx.lineTo(3440, y);
    ctx.stroke();
  }
  ctx.fillStyle = '#e8e8e8';
  ctx.fillRect(3508, 2500, 24, 60);
  ctx.fillStyle = '#c0392b';
  ctx.fillRect(3508, 2500, 24, 18);
  ctx.fillStyle = '#ffd23f';
  ctx.beginPath();
  ctx.arc(3520, 2492, 7, 0, Math.PI * 2);
  ctx.fill();
  // District names, painted faintly on the ground so the map reads as a city.
  ctx.font = 'bold 44px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(0,0,0,0.10)';
  for (const d of DISTRICTS) {
    ctx.fillText(d.name.toUpperCase(), d.x + d.w / 2, d.y + d.h / 2);
  }
  ctx.textAlign = 'left';

  // Blocks: sidewalk slabs under the buildings.
  const xs = [0, ...ROADS.avenues, WORLD.width];
  const ys = [0, ...ROADS.streets, ROADS.coastalY, WORLD.height];
  for (let bi = 0; bi < xs.length - 1; bi += 1) {
    for (let bj = 0; bj < ys.length - 1; bj += 1) {
      const x0 = xs[bi] + half;
      const x1 = xs[bi + 1] - half;
      const y0 = ys[bj] + half;
      const y1 = ys[bj + 1] - half;
      if (x1 - x0 < 40 || y1 - y0 < 40) continue;
      if (x0 >= 3250 || y0 >= ROADS.beachTop) continue;
      ctx.fillStyle = '#b8b0a0';
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    }
  }

  // Roads: asphalt, edge lines, dashed centres, crosswalks.
  ctx.fillStyle = '#3d4149';
  for (const ax of ROADS.avenues) ctx.fillRect(ax - half, 0, ROADS.width, ROADS.coastalY + half);
  for (const st of ROADS.streets) ctx.fillRect(0, st - half, 3250 + half, ROADS.width);
  ctx.fillRect(0, ROADS.coastalY - half, WORLD.width, ROADS.width);
  ctx.strokeStyle = '#c9c9c9';
  ctx.lineWidth = 2;
  ctx.setLineDash([18, 22]);
  for (const ax of ROADS.avenues) {
    ctx.beginPath();
    ctx.moveTo(ax, 0);
    ctx.lineTo(ax, ROADS.coastalY + half);
    ctx.stroke();
  }
  for (const st of ROADS.streets) {
    ctx.beginPath();
    ctx.moveTo(0, st);
    ctx.lineTo(3250 + half, st);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(0, ROADS.coastalY);
  ctx.lineTo(WORLD.width, ROADS.coastalY);
  ctx.stroke();
  ctx.setLineDash([]);
  // Crosswalks at every intersection.
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  for (const ax of ROADS.avenues) {
    for (const st of ROADS.streets) {
      for (let i = -3; i <= 3; i += 1) {
        ctx.fillRect(ax - half + 8, st + i * 12 - 3, 16, 6);
        ctx.fillRect(ax + i * 12 - 3, st - half + 8, 6, 16);
      }
    }
  }

  // Buildings: roof, trim, rooftop details, a soft shadow.
  for (const b of city.buildings) {
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(b.x + 6, b.y + 8, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = b.trim;
    ctx.lineWidth = 4;
    ctx.strokeRect(b.x + 2, b.y + 2, b.w - 4, b.h - 4);
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(b.x + 10, b.y + 10, 14, 10);
    ctx.fillRect(b.x + b.w - 26, b.y + b.h - 22, 16, 12);
    if (b.style === 'tower') {
      // A lit top edge, a window grid, and rooftop plant on tall towers.
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(b.x + 8, b.y + 8, b.w - 16, 6);
      ctx.fillStyle = 'rgba(20,30,50,0.5)';
      for (let wy = b.y + 22; wy < b.y + b.h - 12; wy += 18) {
        for (let wx = b.x + 10; wx < b.x + b.w - 10; wx += 16) {
          if ((wx * 7 + wy * 13) % 5 !== 0) ctx.fillRect(wx, wy, 7, 9);
        }
      }
      if (b.tall) {
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(b.x + b.w / 2 - 12, b.y + b.h / 2 - 12, 24, 24);
        ctx.strokeStyle = '#ffd23f';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(b.x + b.w / 2, b.y + b.h / 2, 12, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    if (b.style === 'brick') {
      // Shop awnings along the street-facing side.
      ctx.fillStyle = '#c0392b';
      ctx.fillRect(b.x + 6, b.y + b.h - 4, 26, 8);
      ctx.fillStyle = '#2e6fb0';
      ctx.fillRect(b.x + b.w - 32, b.y + b.h - 4, 26, 8);
    }
    if (b.style === 'house') {
      ctx.fillStyle = b.trim;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y + b.h * 0.4);
      ctx.lineTo(b.x + b.w / 2, b.y - 6);
      ctx.lineTo(b.x + b.w, b.y + b.h * 0.4);
      ctx.closePath();
      ctx.fill();
    }
  }
  // Containers at the docks.
  for (const c of city.containers) {
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(c.x + 3, c.y + 4, c.w, c.h);
    ctx.fillStyle = c.color;
    ctx.fillRect(c.x, c.y, c.w, c.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 2;
    for (let x = c.x + 10; x < c.x + c.w; x += 14) {
      ctx.beginPath();
      ctx.moveTo(x, c.y + 3);
      ctx.lineTo(x, c.y + c.h - 3);
      ctx.stroke();
    }
  }
  // Trees.
  for (const t of city.trees) {
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.arc(t.x + 3, t.y + 4, t.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4d7d3a';
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#6fae4e';
    ctx.beginPath();
    ctx.arc(t.x - 3, t.y - 3, t.r * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
  // Streetlights: a dark pole and a pale lamp head on every one.
  for (const lamp of city.lamps) {
    ctx.fillStyle = '#2b2b2b';
    ctx.fillRect(lamp.x - 1, lamp.y - 8, 3, 16);
    ctx.fillStyle = '#ffe9a0';
    ctx.beginPath();
    ctx.arc(lamp.x, lamp.y - 10, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  // Park benches around the fountain.
  for (const bench of city.benches) {
    ctx.save();
    ctx.translate(bench.x, bench.y);
    ctx.rotate(bench.angle);
    ctx.fillStyle = '#6b4a2b';
    ctx.fillRect(-14, -4, 28, 8);
    ctx.restore();
  }
  // Beach umbrellas: a coloured disc and a thin pole, on the sand.
  for (const u of city.umbrellas) {
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.arc(u.x + 2, u.y + 3, u.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = u.color;
    ctx.beginPath();
    ctx.arc(u.x, u.y, u.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(u.x, u.y, u.r * 0.35, 0, Math.PI * 2);
    ctx.fill();
  }
  world._ground = g;
  return g;
}

function drawCar(ctx, car, time) {
  const def = CAR_MODELS[car.model];
  const len = def.len;
  const wid = def.wid;
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  if (car.dead) {
    // A burnt-out husk, still smoking.
    ctx.fillStyle = '#2b2b2b';
    roundRect(ctx, -len / 2, -wid / 2, len, wid, 6);
    ctx.fill();
    ctx.fillStyle = `rgba(120,120,120,${0.5 + 0.3 * Math.sin(time * 3 + car.id)})`;
    ctx.beginPath();
    ctx.arc(0, -6 - ((time * 12 + car.id * 7) % 24), 5 + ((time * 8 + car.id) % 6), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  roundRect(ctx, -len / 2 + 3, -wid / 2 + 4, len, wid, 7);
  ctx.fill();
  // Body.
  ctx.fillStyle = car.color;
  roundRect(ctx, -len / 2, -wid / 2, len, wid, 7);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Police livery: white doors and a flashing light bar.
  if (car.model === 'police') {
    ctx.fillStyle = '#e8e8e8';
    ctx.fillRect(-6, -wid / 2, 12, wid);
    const phase = Math.floor(car.flash) % 2 === 0;
    ctx.fillStyle = phase ? '#ff2d2d' : '#2d5fff';
    ctx.fillRect(-8, -wid / 2 - 2, 6, 5);
    ctx.fillStyle = phase ? '#2d5fff' : '#ff2d2d';
    ctx.fillRect(2, -wid / 2 - 2, 6, 5);
    ctx.fillStyle = '#111';
    ctx.font = 'bold 8px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SPPD', 0, wid / 2 + 12);
  }
  if (car.model === 'taxi') {
    ctx.fillStyle = '#111';
    for (let x = -len / 2 + 4; x < len / 2 - 8; x += 8) {
      ctx.fillRect(x, -wid / 2 + 2, 4, 4);
      ctx.fillRect(x + 4, -wid / 2 + 6, 4, 4);
    }
    ctx.fillStyle = '#111';
    ctx.font = 'bold 7px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TAXI', 0, 3);
  }
  // Windshield, roof, rear window.
  ctx.fillStyle = 'rgba(180,210,230,0.85)';
  ctx.fillRect(len / 2 - 12, -wid / 2 + 3, 8, wid - 6);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(-8, -wid / 2 + 4, 16, wid - 8);
  ctx.fillStyle = 'rgba(180,210,230,0.7)';
  ctx.fillRect(-len / 2 + 3, -wid / 2 + 3, 7, wid - 6);
  // Headlights and taillights.
  ctx.fillStyle = '#ffe9a0';
  ctx.fillRect(len / 2 - 2, -wid / 2 + 2, 3, 4);
  ctx.fillRect(len / 2 - 2, wid / 2 - 6, 3, 4);
  ctx.fillStyle = '#ff2d2d';
  ctx.fillRect(-len / 2 - 1, -wid / 2 + 2, 3, 4);
  ctx.fillRect(-len / 2 - 1, wid / 2 - 6, 3, 4);
  if (car.model === 'comet') {
    // The hero car gets a spoiler.
    ctx.fillStyle = '#111';
    ctx.fillRect(-len / 2 - 4, -wid / 2 - 1, 4, wid + 2);
  }
  // Damage smoke.
  if (car.hp < car.maxHp * 0.45) {
    ctx.fillStyle = `rgba(90,90,90,${0.4 + 0.2 * Math.sin(time * 5 + car.id)})`;
    ctx.beginPath();
    ctx.arc(-len / 4, 0, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawPed(ctx, ped, time) {
  ctx.save();
  ctx.translate(ped.x, ped.y);
  if (ped.state === 'down') {
    ctx.rotate(ped.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 12, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.shirt;
    ctx.beginPath();
    ctx.ellipse(0, 0, 10, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(1, 2, 9, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(ped.angle);
  ctx.fillStyle = ped.shirt;
  ctx.beginPath();
  ctx.arc(0, 0, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = ped.skin;
  ctx.beginPath();
  ctx.arc(5, 0, 4.5, 0, Math.PI * 2);
  ctx.fill();
  if (ped.state === 'viper') {
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(6, 0);
    ctx.lineTo(18, 0);
    ctx.stroke();
  }
  if (ped.state === 'fare') {
    // Waving for a cab.
    const wave = Math.sin(time * 6) * 0.6;
    ctx.strokeStyle = ped.skin;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(-6, -14 + wave * 4);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPlayer(ctx, world, time) {
  const p = world.player;
  if (p.car) return; // the car drawing shows the player
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(1, 3, 10, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(p.angle);
  // Teal jacket, dark jeans, Jax's silhouette.
  ctx.fillStyle = '#2a9d8f';
  ctx.beginPath();
  ctx.arc(0, 0, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f0c8a0';
  ctx.beginPath();
  ctx.arc(6, 0, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#222';
  ctx.beginPath();
  ctx.arc(4, 0, 5, Math.PI * 0.6, Math.PI * 1.4);
  ctx.fill();
  if (p.fireCd > 0 || p.mag < 12) {
    ctx.strokeStyle = '#1c1c1c';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(8, 2);
    ctx.lineTo(18, 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawMarker(ctx, x, y, color, label, time, big) {
  const bob = Math.sin(time * 3) * 4;
  const s = big ? 16 : 11;
  ctx.save();
  ctx.translate(x, y + bob);
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, -s);
  ctx.lineTo(s * 0.8, 0);
  ctx.lineTo(0, s);
  ctx.lineTo(-s * 0.8, 0);
  ctx.closePath();
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, 4, 0, Math.PI * 2);
  ctx.fill();
  if (label) {
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillText(label, 1, -s - 9);
    ctx.fillStyle = '#fff';
    ctx.fillText(label, 0, -s - 10);
  }
  ctx.restore();
  // A beam so the marker reads from far away.
  ctx.save();
  ctx.globalAlpha = 0.18 + 0.08 * Math.sin(time * 3);
  ctx.fillStyle = color;
  ctx.fillRect(x - 3, y - 90, 6, 90);
  ctx.restore();
}

function drawMinimap(ctx, world) {
  const x0 = 16;
  const y0 = VIEW.height - MINIMAP_H - 16;
  const ground = ensureGround(world);
  ctx.save();
  roundRect(ctx, x0 - 4, y0 - 4, MINIMAP_W + 8, MINIMAP_H + 8, 10);
  ctx.fillStyle = 'rgba(10,14,20,0.85)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath();
  roundRect(ctx, x0, y0, MINIMAP_W, MINIMAP_H, 8);
  ctx.clip();
  ctx.drawImage(ground, 0, 0, WORLD.width, WORLD.height, x0, y0, MINIMAP_W, MINIMAP_H);
  const mx = (x) => x0 + x * MAP_SCALE;
  const my = (y) => y0 + y * MAP_SCALE;
  // Mission marker: a gold dot with a slow pulse ring, so it reads even
  // when the player is looking at the other side of the map.
  const target = objectiveTarget(world);
  if (target) {
    const pulse = 5 + Math.sin(world.time * 3) * 2;
    ctx.strokeStyle = 'rgba(255,210,63,0.7)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(mx(target.x), my(target.y), pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.arc(mx(target.x), my(target.y), 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  // Hideout.
  if (world.mission.next && !world.mission.current) {
    ctx.fillStyle = '#4dd0a5';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('M', mx(PLACES.hideout.x), my(PLACES.hideout.y) + 4);
  }
  // Fare.
  if (world.fare.fare) {
    const f = world.fare.fare;
    const pt = f.state === 'wait' ? f.ped : f.dest;
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.arc(mx(pt.x), my(pt.y), 4, 0, Math.PI * 2);
    ctx.fill();
  }
  // Police blips.
  for (const cop of world.police) {
    if (cop.dead) continue;
    ctx.fillStyle = '#ff3b30';
    ctx.beginPath();
    ctx.arc(mx(cop.x), my(cop.y), 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // The player, an arrow that turns with them.
  ctx.save();
  ctx.translate(mx(world.player.x), my(world.player.y));
  ctx.rotate(world.player.angle);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(7, 0);
  ctx.lineTo(-5, -5);
  ctx.lineTo(-5, 5);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
  ctx.restore();
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText('SOLMAR', x0 + 2, y0 + MINIMAP_H + 14);
}

function drawHud(ctx, world, input) {
  const p = world.player;
  // Objective card, top-left.
  const obj = currentObjective(world);
  ctx.textAlign = 'left';
  if (obj) {
    ctx.fillStyle = 'rgba(10,14,20,0.72)';
    roundRect(ctx, 16, 14, 330, 62, 8);
    ctx.fill();
    ctx.fillStyle = '#ffd23f';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillText(obj.title, 28, 34);
    ctx.fillStyle = '#fff';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText(obj.text, 28, 54);
    if (obj.timer !== null) {
      ctx.fillStyle = obj.timer < 20 ? '#ff5a4e' : '#fff';
      ctx.font = 'bold 16px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`${Math.ceil(obj.timer)}s`, 334, 36);
      ctx.textAlign = 'left';
    }
  } else if (world.mission.next) {
    ctx.fillStyle = 'rgba(10,14,20,0.6)';
    roundRect(ctx, 16, 14, 330, 40, 8);
    ctx.fill();
    ctx.fillStyle = '#4dd0a5';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillText('Mara has work — follow the M on the map', 28, 39);
  }
  // Cash, wanted stars and clock, top-right.
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(10,14,20,0.72)';
  roundRect(ctx, VIEW.width - 268, 14, 252, 62, 8);
  ctx.fill();
  ctx.fillStyle = '#7ee787';
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillText(`$${p.money.toLocaleString('en-US')}`, VIEW.width - 28, 42);
  let stars = '';
  for (let i = 0; i < 5; i += 1) stars += i < world.wanted ? '★' : '☆';
  ctx.fillStyle = world.wanted > 0 ? '#ffd23f' : 'rgba(255,255,255,0.5)';
  ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.fillText(stars, VIEW.width - 28, 66);
  const hh = String(Math.floor(world.clock / 60)).padStart(2, '0');
  const mm = String(Math.floor(world.clock % 60)).padStart(2, '0');
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.font = '12px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`${hh}:${mm}  SOLMAR`, VIEW.width - 256, 42);
  ctx.textAlign = 'left';

  // Health, ammo, speed — bottom-right.
  const bx = VIEW.width - 268;
  const by = VIEW.height - 84;
  ctx.fillStyle = 'rgba(10,14,20,0.72)';
  roundRect(ctx, bx, by, 252, 68, 8);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.fillText('HEALTH', bx + 12, by + 20);
  ctx.fillStyle = '#222';
  roundRect(ctx, bx + 70, by + 10, 170, 12, 6);
  ctx.fill();
  ctx.fillStyle = p.hp > 30 ? '#7ee787' : '#ff5a4e';
  roundRect(ctx, bx + 70, by + 10, 170 * (p.hp / 100), 12, 6);
  ctx.fill();
  if (p.car) {
    ctx.fillStyle = '#fff';
    ctx.fillText('CAR', bx + 12, by + 42);
    ctx.fillStyle = '#222';
    roundRect(ctx, bx + 70, by + 32, 170, 12, 6);
    ctx.fill();
    ctx.fillStyle = p.car.hp > p.car.maxHp * 0.4 ? '#ffd23f' : '#ff5a4e';
    roundRect(ctx, bx + 70, by + 32, 170 * Math.max(0, p.car.hp / p.car.maxHp), 12, 6);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.round(Math.abs(p.car.speed) * 0.55)} mph`, VIEW.width - 28, by + 62);
    ctx.textAlign = 'left';
  } else {
    ctx.fillStyle = '#fff';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText(`PISTOL  ${p.mag} / ${p.ammo}`, bx + 12, by + 44);
    ctx.fillStyle = p.mag === 0 ? '#ff5a4e' : 'rgba(255,255,255,0.6)';
    ctx.font = p.mag === 0 ? 'bold 11px system-ui, sans-serif' : '11px system-ui, sans-serif';
    ctx.fillText(p.mag === 0 ? 'Magazine empty — R reload' : 'F punch  •  click shoot  •  R reload', bx + 12, by + 60);
  }

  // Context prompt, bottom-centre.
  if (world.prompt) {
    ctx.font = 'bold 15px system-ui, sans-serif';
    const w = ctx.measureText(world.prompt.text).width + 28;
    ctx.fillStyle = 'rgba(10,14,20,0.78)';
    roundRect(ctx, (VIEW.width - w) / 2, VIEW.height - 52, w, 34, 17);
    ctx.fill();
    ctx.fillStyle = '#ffd23f';
    ctx.textAlign = 'center';
    ctx.fillText(world.prompt.text, VIEW.width / 2, VIEW.height - 30);
    ctx.textAlign = 'left';
  }

  // Toasts above the prompt.
  ctx.font = '13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  world.toasts.forEach((t, i) => {
    const alpha = t.t > 3.5 ? Math.max(0, 1 - (t.t - 3.5)) : 1;
    ctx.globalAlpha = alpha;
    const w = ctx.measureText(t.text).width + 24;
    const y = VIEW.height - 100 - i * 28;
    ctx.fillStyle = 'rgba(10,14,20,0.75)';
    roundRect(ctx, (VIEW.width - w) / 2, y, w, 22, 11);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(t.text, VIEW.width / 2, y + 15);
    ctx.globalAlpha = 1;
  });
  ctx.textAlign = 'left';

  // Mission banner, centre.
  if (world.banner) {
    const a = world.banner.t < 0.3 ? world.banner.t / 0.3 : world.banner.t > 3 ? Math.max(0, 1 - (world.banner.t - 3) / 0.5) : 1;
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.fillStyle = world.banner.bad ? '#ff5a4e' : '#ffd23f';
    ctx.font = 'bold 44px system-ui, sans-serif';
    ctx.fillText(world.banner.title, VIEW.width / 2, 220);
    ctx.fillStyle = '#fff';
    ctx.font = '20px system-ui, sans-serif';
    ctx.fillText(world.banner.sub, VIEW.width / 2, 252);
    ctx.textAlign = 'left';
    ctx.globalAlpha = 1;
  }

  // Hurt flash.
  if (world.player.hurtT > 0) {
    ctx.fillStyle = `rgba(255,30,30,${Math.min(0.28, world.player.hurtT * 0.6)})`;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  }

  drawMinimap(ctx, world);
}

function drawIntro(ctx, world) {
  const m = world.mission.intro;
  if (!m) return;
  ctx.fillStyle = 'rgba(5,8,14,0.72)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.fillStyle = '#141a26';
  roundRect(ctx, 290, 150, 700, 360, 14);
  ctx.fill();
  ctx.strokeStyle = '#ffd23f';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffd23f';
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.fillText(m.title, 320, 200);
  ctx.fillStyle = '#4dd0a5';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.fillText(`From ${m.giver}  •  Reward $${m.reward}`, 320, 228);
  ctx.fillStyle = '#e8e8e8';
  ctx.font = '16px/1.5 system-ui, sans-serif';
  wrapText(ctx, m.intro, 320, 262, 640, 26);
  ctx.fillStyle = '#ffd23f';
  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Press ENTER to accept the job', 640, 470);
  ctx.textAlign = 'left';
}

function wrapText(ctx, text, x, y, maxW, lineH) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, yy);
      line = word;
      yy += lineH;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, yy);
}

function drawTitle(ctx, world) {
  const t = world.time;
  // Sunset gradient sky over a skyline silhouette.
  const sky = ctx.createLinearGradient(0, 0, 0, VIEW.height);
  sky.addColorStop(0, '#1c2a4a');
  sky.addColorStop(0.55, '#c95f3f');
  sky.addColorStop(1, '#f2a541');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.fillStyle = '#ffd23f';
  ctx.beginPath();
  ctx.arc(1020, 170, 52, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(20,16,32,0.9)';
  const towers = [60, 140, 90, 200, 120, 170, 80, 220, 110, 150, 70, 190];
  let x = 0;
  towers.forEach((h, i) => {
    const w = 104;
    ctx.fillRect(x, VIEW.height - 190 - h, w, 190 + h);
    ctx.fillStyle = 'rgba(255,210,63,0.85)';
    for (let wy = VIEW.height - 180 - h + 14; wy < VIEW.height - 200; wy += 26) {
      for (let wx = x + 10; wx < x + w - 10; wx += 22) {
        if ((i * 7 + wx + wy) % 3 === 0) ctx.fillRect(wx, wy, 8, 10);
      }
    }
    ctx.fillStyle = 'rgba(20,16,32,0.9)';
    x += w + 4;
  });
  ctx.fillStyle = 'rgba(20,16,32,0.9)';
  ctx.fillRect(0, VIEW.height - 60, VIEW.width, 60);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd23f';
  ctx.font = 'bold 84px system-ui, sans-serif';
  ctx.fillText('SOLMAR', VIEW.width / 2, 190);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 54px system-ui, sans-serif';
  ctx.fillText('STREETS', VIEW.width / 2, 252);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '17px system-ui, sans-serif';
  ctx.fillText('An open-world crime game — steal it, drive it, lose the cops, get paid.', VIEW.width / 2, 296);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText(`version ${GAME_VERSION}`, VIEW.width / 2, 320);
  // The save, in plain words, so a returning player knows where they stand.
  if (hasSave()) {
    ctx.fillStyle = 'rgba(77,208,165,0.9)';
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillText(saveSummary(loadGame()), VIEW.width / 2, 344);
  }
  const blink = 0.65 + 0.35 * Math.sin(t * 3);
  ctx.globalAlpha = blink;
  ctx.fillStyle = '#ffd23f';
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillText(hasSave() ? 'Click or press ENTER — Continue your story' : 'Click or press ENTER — New Game', VIEW.width / 2, 380);
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '15px/1.7 system-ui, sans-serif';
  ctx.fillText('WASD move / drive  •  E enter a car  •  F punch  •  mouse + click shoot  •  P pause  •  M mute', VIEW.width / 2, 470);
  ctx.fillText('Missions from Mara at the hideout  •  Taxi fares pay cash  •  Progress saves automatically', VIEW.width / 2, 496);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText('100% original: Solmar, Jax Carter, Mara Voss and the SPPD are invented for this game.', VIEW.width / 2, 690);
  ctx.textAlign = 'left';
}

function drawPaused(ctx, world) {
  ctx.fillStyle = 'rgba(5,8,14,0.7)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd23f';
  ctx.font = 'bold 44px system-ui, sans-serif';
  ctx.fillText('PAUSED', VIEW.width / 2, 240);
  ctx.fillStyle = '#fff';
  ctx.font = '18px/1.9 system-ui, sans-serif';
  ctx.fillText('P / Esc — resume', VIEW.width / 2, 310);
  ctx.fillText('S — save game now', VIEW.width / 2, 344);
  ctx.fillText('R — restart from the hideout', VIEW.width / 2, 378);
  ctx.fillText('M — mute sound', VIEW.width / 2, 412);
  ctx.fillText('Q — quit to the title screen', VIEW.width / 2, 446);
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '14px system-ui, sans-serif';
  ctx.fillText(statsSummary(world.stats), VIEW.width / 2, 500);
  ctx.textAlign = 'left';
}

function drawOver(ctx, world) {
  ctx.fillStyle = 'rgba(10,0,0,0.72)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff5a4e';
  ctx.font = 'bold 84px system-ui, sans-serif';
  ctx.fillText('WASTED', VIEW.width / 2, 280);
  ctx.fillStyle = '#fff';
  ctx.font = '19px/1.9 system-ui, sans-serif';
  ctx.fillText(`Missions completed: ${world.stats.missionsDone}    Cash earned: $${world.stats.cashEarned}`, VIEW.width / 2, 350);
  ctx.fillText(`Cars stolen: ${world.stats.carsStolen}    Fares driven: ${world.stats.fares}    Takedowns: ${world.stats.kills}`, VIEW.width / 2, 388);
  const blink = 0.65 + 0.35 * Math.sin(world.time * 3);
  ctx.globalAlpha = blink;
  ctx.fillStyle = '#ffd23f';
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillText('Press R or click to try again', VIEW.width / 2, 470);
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  return {
    render(world, input) {
      const cam = world.camera;
      ctx.clearRect(0, 0, VIEW.width, VIEW.height);
      if (world.screen === 'title') {
        drawTitle(ctx, world);
        return;
      }
      const ground = ensureGround(world);
      // World space. The camera is clamped here too, so a staged shot
      // near the edge of the map never shows the void past it.
      const vw = VIEW.width / cam.zoom;
      const vh = VIEW.height / cam.zoom;
      const cx = Math.max(vw / 2, Math.min(WORLD.width - vw / 2, cam.x));
      const cy = Math.max(vh / 2, Math.min(WORLD.height - vh / 2, cam.y));
      ctx.save();
      ctx.translate(VIEW.width / 2, VIEW.height / 2);
      ctx.scale(cam.zoom, cam.zoom);
      ctx.translate(-cx, -cy);
      ctx.drawImage(ground, cx - vw / 2, cy - vh / 2, vw, vh, cx - vw / 2, cy - vh / 2, vw, vh);
      // Skid marks.
      ctx.strokeStyle = 'rgba(20,20,20,0.4)';
      ctx.lineWidth = 5;
      for (const s of world.skids) {
        ctx.globalAlpha = Math.max(0, 1 - s.t / 9) * 0.7;
        ctx.beginPath();
        ctx.moveTo(s.x1, s.y1);
        ctx.lineTo(s.x2, s.y2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      // Pickups.
      for (const pk of world.pickups) {
        const bob = Math.sin(world.time * 3 + pk.bob) * 3;
        ctx.save();
        ctx.translate(pk.x, pk.y + bob);
        if (pk.pickupKind === 'cash') {
          ctx.fillStyle = '#2fae5f';
          ctx.beginPath();
          ctx.arc(0, 0, 11, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 13px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('$', 0, 5);
        } else if (pk.pickupKind === 'health') {
          ctx.fillStyle = '#e8e8e8';
          ctx.beginPath();
          ctx.arc(0, 0, 11, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#d23b2e';
          ctx.fillRect(-2, -7, 4, 14);
          ctx.fillRect(-7, -2, 14, 4);
        } else {
          ctx.fillStyle = '#ffd23f';
          ctx.beginPath();
          ctx.arc(0, 0, 11, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#111';
          ctx.font = 'bold 10px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('AMMO', 0, 4);
        }
        ctx.restore();
      }
      // Place markers: shops, hideout, mission target, fare.
      drawMarker(ctx, PLACES.gunBarn.x, PLACES.gunBarn.y, '#e8e8e8', 'GUN BARN', world.time, false);
      drawMarker(ctx, PLACES.pitStop.x, PLACES.pitStop.y, '#7ee787', 'PIT STOP', world.time, false);
      if (world.mission.next && !world.mission.current) {
        drawMarker(ctx, PLACES.hideout.x, PLACES.hideout.y, '#4dd0a5', 'MARA', world.time, true);
      }
      const target = objectiveTarget(world);
      if (target) drawMarker(ctx, target.x, target.y, '#ffd23f', null, world.time, true);
      if (world.fare.fare) {
        const f = world.fare.fare;
        const pt = f.state === 'wait' ? f.ped : f.dest;
        drawMarker(ctx, pt.x, pt.y, '#ffd23f', f.state === 'wait' ? 'FARE' : 'DROP OFF', world.time, false);
      }
      // Cars, peds, player, bullets, particles — peds under cars under bullets.
      for (const car of world.cars) drawCar(ctx, car, world.time);
      for (const ped of world.peds) drawPed(ctx, ped, world.time);
      drawPlayer(ctx, world, world.time);
      ctx.strokeStyle = '#ffe9a0';
      ctx.lineWidth = 3;
      for (const b of world.bullets) {
        ctx.beginPath();
        ctx.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      for (const pt of world.particles) {
        ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
        ctx.fillStyle = pt.color;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      // Speed lines at the screen edges when the car is really moving —
      // a cheap sense of speed that costs no physics.
      const carSpeed = world.player.car ? Math.abs(world.player.car.speed) : 0;
      if (carSpeed > 300 && world.screen === 'play') {
        const n = Math.min(10, Math.floor((carSpeed - 300) / 15));
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 2;
        for (let i = 0; i < n; i += 1) {
          const y = ((world.time * 900 + i * 137) % (VIEW.height + 40)) - 20;
          const len = 26 + ((i * 53) % 30);
          ctx.beginPath();
          ctx.moveTo(18, y);
          ctx.lineTo(18 + len, y);
          ctx.moveTo(VIEW.width - 18, VIEW.height - y);
          ctx.lineTo(VIEW.width - 18 - len, VIEW.height - y);
          ctx.stroke();
        }
      }
      // Aim crosshair on foot.
      if (!world.player.car && world.screen === 'play') {
        const wx = cx + (input.mouseX - VIEW.width / 2) / cam.zoom;
        const wy = cy + (input.mouseY - VIEW.height / 2) / cam.zoom;
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(wx, wy, 9, 0, Math.PI * 2);
        ctx.moveTo(wx - 13, wy);
        ctx.lineTo(wx - 5, wy);
        ctx.moveTo(wx + 5, wy);
        ctx.lineTo(wx + 13, wy);
        ctx.moveTo(wx, wy - 13);
        ctx.lineTo(wx, wy - 5);
        ctx.moveTo(wx, wy + 5);
        ctx.lineTo(wx, wy + 13);
        ctx.stroke();
      }
      ctx.restore();

      // Interface.
      drawHud(ctx, world, input);
      if (world.mission.intro) drawIntro(ctx, world);
      if (world.screen === 'paused') drawPaused(ctx, world);
      if (world.screen === 'over') drawOver(ctx, world);
    },
  };
}
