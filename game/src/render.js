// Everything on screen: the city, the people and cars, the HUD with its
// minimap, and the title / pause / wasted screens. One canvas, no images.
import { VIEW_W, VIEW_H, WORLD_W, WORLD_H, ROAD_X, ROAD_Y, ROAD_HALF, COLORS, TUNE, ZONES, MISSIONS } from './config.js';
import { clamp } from './random.js';
import { hasSave } from './save.js';

const MINIMAP_W = 220;
const MINIMAP_H = 150;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = COLORS.hudBg;
  roundRect(ctx, x, y, w, h, 8);
  ctx.fill();
}

function bar(ctx, x, y, w, h, frac, color, bg) {
  ctx.fillStyle = bg || 'rgba(0,0,0,0.55)';
  roundRect(ctx, x, y, w, h, 4);
  ctx.fill();
  ctx.fillStyle = color;
  roundRect(ctx, x, y, Math.max(4, w * clamp(frac, 0, 1)), h, 4);
  ctx.fill();
}

export function draw(ctx, world) {
  const cam = world.camera;
  const zoom = cam.zoom;
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  ctx.save();
  ctx.scale(zoom, zoom);
  ctx.translate(VIEW_W / 2 / zoom - cam.x, VIEW_H / 2 / zoom - cam.y);

  const vx0 = cam.x - VIEW_W / 2 / zoom - 60;
  const vy0 = cam.y - VIEW_H / 2 / zoom - 60;
  const vx1 = cam.x + VIEW_W / 2 / zoom + 60;
  const vy1 = cam.y + VIEW_H / 2 / zoom + 60;

  drawGround(ctx, world, vx0, vy0, vx1, vy1);
  drawZones(ctx, world);
  drawMarkers(ctx, world);
  drawCars(ctx, world, vx0, vy0, vx1, vy1);
  drawPeds(ctx, world, vx0, vy0, vx1, vy1);
  drawBullets(ctx, world);
  drawParticles(ctx, world);
  ctx.restore();

  if (world.screen === 'play' || world.screen === 'pause') {
    drawHud(ctx, world);
    drawMinimap(ctx, world);
  }
  if (world.screen === 'title') drawTitle(ctx, world);
  else if (world.screen === 'pause') drawPause(ctx, world);
  else if (world.screen === 'wasted') drawWasted(ctx, world);
  if (world.mission.intro) drawIntro(ctx, world);
}

function drawGround(ctx, world, vx0, vy0, vx1, vy1) {
  const city = world.city;
  ctx.fillStyle = COLORS.ground;
  ctx.fillRect(vx0, vy0, vx1 - vx0, vy1 - vy0);
  // Subtle checker tint so the ground is not one flat colour.
  ctx.fillStyle = COLORS.groundAlt;
  for (let x = Math.max(0, Math.floor(vx0 / 200) * 200); x < Math.min(WORLD_W, vx1); x += 400) {
    for (let y = Math.max(0, Math.floor(vy0 / 200) * 200); y < Math.min(WORLD_H, vy1); y += 400) {
      if (((x + y) / 200) % 2 === 0) ctx.fillRect(x, y, 200, 200);
    }
  }
  // Parks.
  for (const park of city.parks) {
    ctx.fillStyle = COLORS.park;
    ctx.fillRect(park.x, park.y, park.w, park.h);
    for (const tree of park.trees) {
      ctx.fillStyle = COLORS.parkDark;
      ctx.beginPath();
      ctx.arc(tree.x, tree.y, tree.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = COLORS.park;
      ctx.beginPath();
      ctx.arc(tree.x - 3, tree.y - 3, tree.r * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Water at the east edge.
  ctx.fillStyle = COLORS.water;
  ctx.fillRect(city.water.x, 0, city.water.w, WORLD_H);
  ctx.fillStyle = COLORS.waterDeep;
  for (let y = 40; y < WORLD_H; y += 160) {
    ctx.fillRect(city.water.x + 8, y, 18, 5);
  }
  // Sidewalks then asphalt, so roads read as streets.
  ctx.fillStyle = COLORS.sidewalk;
  for (const rx of ROAD_X) ctx.fillRect(rx - ROAD_HALF - 10, 0, (ROAD_HALF + 10) * 2, WORLD_H);
  for (const ry of ROAD_Y) ctx.fillRect(0, ry - ROAD_HALF - 10, WORLD_W, (ROAD_HALF + 10) * 2);
  ctx.fillStyle = COLORS.road;
  for (const rx of ROAD_X) ctx.fillRect(rx - ROAD_HALF, 0, ROAD_HALF * 2, WORLD_H);
  for (const ry of ROAD_Y) ctx.fillRect(0, ry - ROAD_HALF, WORLD_W, ROAD_HALF * 2);
  // Dashed centre lines.
  ctx.fillStyle = COLORS.roadLine;
  for (const rx of ROAD_X) {
    for (let y = 0; y < WORLD_H; y += 64) ctx.fillRect(rx - 2, y, 4, 30);
  }
  for (const ry of ROAD_Y) {
    for (let x = 0; x < WORLD_W; x += 64) ctx.fillRect(x, ry - 2, 30, 4);
  }
  // Buildings with a roof inset and windows.
  for (const b of city.buildings) {
    if (b.x > vx1 || b.x + b.w < vx0 || b.y > vy1 || b.y + b.h < vy0) continue;
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 8, b.y + 8, b.w - 16, b.h - 16);
    ctx.fillStyle = 'rgba(255,255,220,0.75)';
    const cols = Math.max(1, Math.floor(b.w / 34));
    const rows = Math.max(1, Math.floor(b.h / 34));
    for (let i = 0; i < cols; i += 1) {
      for (let j = 0; j < rows; j += 1) {
        ctx.fillRect(b.x + 14 + i * 34, b.y + 14 + j * 34, 12, 10);
      }
    }
  }
  // Dock containers.
  for (const c of city.containers) {
    if (c.x > vx1 || c.x + c.w < vx0 || c.y > vy1 || c.y + c.h < vy0) continue;
    ctx.fillStyle = c.color;
    ctx.fillRect(c.x, c.y, c.w, c.h);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(c.x, c.y + c.h - 6, c.w, 6);
  }
}

function drawZones(ctx, world) {
  const z = ZONES;
  ctx.textAlign = 'center';
  // Pit Stop garage.
  ctx.fillStyle = '#5a6e8a';
  ctx.fillRect(z.pitStop.x - 70, z.pitStop.y - 46, 140, 92);
  ctx.fillStyle = '#3a4a61';
  ctx.fillRect(z.pitStop.x - 70, z.pitStop.y - 46, 140, 16);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText('PIT STOP', z.pitStop.x, z.pitStop.y - 52);
  ctx.strokeStyle = 'rgba(255,210,59,0.8)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(z.pitStop.x, z.pitStop.y, ZONES.pitStop.r, 0, Math.PI * 2);
  ctx.stroke();
  // Gun Barn shop.
  ctx.fillStyle = '#7a5a3a';
  ctx.fillRect(z.gunBarn.x - 60, z.gunBarn.y - 40, 120, 80);
  ctx.fillStyle = '#5a3a22';
  ctx.fillRect(z.gunBarn.x - 60, z.gunBarn.y - 40, 120, 14);
  ctx.fillStyle = '#ffffff';
  ctx.fillText('GUN BARN', z.gunBarn.x, z.gunBarn.y - 46);
  ctx.strokeStyle = 'rgba(255,210,59,0.8)';
  ctx.beginPath();
  ctx.arc(z.gunBarn.x, z.gunBarn.y, ZONES.gunBarn.r, 0, Math.PI * 2);
  ctx.stroke();
  // Hideout.
  ctx.fillStyle = '#8a5a7a';
  ctx.fillRect(z.hideout.x - 55, z.hideout.y - 38, 110, 76);
  ctx.fillStyle = '#6a3a5a';
  ctx.fillRect(z.hideout.x - 55, z.hideout.y - 38, 110, 14);
  ctx.fillStyle = '#ffffff';
  ctx.fillText('HIDEOUT', z.hideout.x, z.hideout.y - 44);
  // Pier 9 label on the docks.
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('PIER 9', z.docks.x - 60, z.docks.y - 120);
  ctx.textAlign = 'left';
}

function markerAt(ctx, world) {
  const m = world.mission.current;
  const f = world.fare;
  let target = null;
  let color = COLORS.marker;
  let label = '';
  if (m) {
    target = { x: m.tx, y: m.ty };
    label = m.name;
  } else if (f.state === 'waiting') {
    target = { x: f.x, y: f.y };
    color = '#4bd8e8';
    label = 'FARE';
  } else if (f.state === 'dropoff') {
    target = { x: f.dx, y: f.dy };
    color = '#4bd8e8';
    label = 'DROP OFF';
  } else if (world.mission.next && !m) {
    target = { x: ZONES.mara.x, y: ZONES.mara.y };
    color = COLORS.markerGreen;
    label = 'MARA';
  }
  return { target, color, label };
}

function drawMarkers(ctx, world) {
  const { target, color, label } = markerAt(ctx, world);
  if (!target) return;
  const pulse = 1 + Math.sin(world.time * 4) * 0.15;
  const p = world.player;
  // A beam of light so the marker reads from far away.
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.25;
  ctx.fillRect(target.x - 6, target.y - 260, 12, 260);
  ctx.globalAlpha = 1;
  // A pulsing diamond on the ground.
  ctx.save();
  ctx.translate(target.x, target.y);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = color;
  const s = 16 * pulse;
  ctx.fillRect(-s / 2, -s / 2, s, s);
  ctx.restore();
  ctx.fillStyle = '#111';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, target.x, target.y - 22);
  ctx.textAlign = 'left';
  // An edge arrow when the target is off screen.
  const cam = world.camera;
  const zoom = cam.zoom;
  const vw = VIEW_W / zoom / 2;
  const vh = VIEW_H / zoom / 2;
  if (target.x < cam.x - vw || target.x > cam.x + vw || target.y < cam.y - vh || target.y > cam.y + vh) {
    const cx = clamp(target.x, cam.x - vw + 40, cam.x + vw - 40);
    const cy = clamp(target.y, cam.y - vh + 40, cam.y + vh - 40);
    const a = Math.atan2(target.y - p.y, target.x - p.x);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(a);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.lineTo(-10, -12);
    ctx.lineTo(-10, 12);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

function drawCars(ctx, world, vx0, vy0, vx1, vy1) {
  for (const car of world.cars) {
    if (car.dead || car.x < vx0 - 80 || car.x > vx1 + 80 || car.y < vy0 - 80 || car.y > vy1 + 80) continue;
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    roundRect(ctx, -21, -11 + 4, 44, 22, 6);
    ctx.fill();
    ctx.fillStyle = car.wrecked ? '#3a3a3a' : car.color;
    roundRect(ctx, -22, -12, 44, 24, 7);
    ctx.fill();
    // Cabin and windshield.
    ctx.fillStyle = car.wrecked ? '#222' : 'rgba(220,235,245,0.9)';
    roundRect(ctx, -6, -9, 14, 18, 3);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(8, -10, 4, 20);
    // Headlights.
    ctx.fillStyle = '#fff8c0';
    ctx.fillRect(20, -10, 3, 5);
    ctx.fillRect(20, 5, 3, 5);
    // Police light bar, flashing.
    if (car.carKind === 'police') {
      const phase = Math.floor(world.time * 4 + car.sirenPhase) % 2 === 0;
      ctx.fillStyle = phase ? '#ff3b30' : '#3b82ff';
      ctx.fillRect(-4, -12, 8, 5);
      ctx.fillStyle = phase ? '#3b82ff' : '#ff3b30';
      ctx.fillRect(-4, 7, 8, 5);
    }
    // Wreck smoke.
    if (car.wrecked) {
      ctx.fillStyle = 'rgba(120,120,120,0.5)';
      ctx.beginPath();
      ctx.arc(-6, -4, 8 + Math.sin(world.time * 5) * 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    // Health pip above a damaged car.
    if (car.hp < car.maxHp && !car.wrecked) {
      bar(ctx, car.x - 18, car.y - 30, 36, 5, car.hp / car.maxHp, '#e8b23a');
    }
  }
}

function drawPeds(ctx, world, vx0, vy0, vx1, vy1) {
  for (const ped of world.peds) {
    if (ped.dead || ped.x < vx0 - 40 || ped.x > vx1 + 40 || ped.y < vy0 - 40 || ped.y > vy1 + 40) continue;
    if (ped.state === 'down') {
      // Lying flat.
      ctx.fillStyle = ped.color;
      ctx.beginPath();
      ctx.ellipse(ped.x, ped.y, 14, 7, ped.angle, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    // Shadow + body + head, facing the walk direction.
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(ped.x + 2, ped.y + 3, 11, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.color;
    ctx.beginPath();
    ctx.arc(ped.x, ped.y, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f2c9a0';
    ctx.beginPath();
    ctx.arc(ped.x + Math.cos(ped.angle) * 4, ped.y + Math.sin(ped.angle) * 4, 5, 0, Math.PI * 2);
    ctx.fill();
    // Vipers carry a visible gun; Mara gets a name tag.
    if (ped.pedKind === 'viper') {
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(ped.x + Math.cos(ped.angle) * 10, ped.y + Math.sin(ped.angle) * 10);
      ctx.lineTo(ped.x + Math.cos(ped.angle) * 20, ped.y + Math.sin(ped.angle) * 20);
      ctx.stroke();
      bar(ctx, ped.x - 14, ped.y - 26, 28, 4, ped.hp / 100, '#ff5a5a');
    }
    if (ped.pedKind === 'mara') {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('MARA', ped.x, ped.y - 20);
      ctx.textAlign = 'left';
    }
    if (ped.pedKind === 'fare' && world.fare.state === 'waiting') {
      ctx.fillStyle = '#4bd8e8';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('FARE', ped.x, ped.y - 20);
      ctx.textAlign = 'left';
    }
  }
  // The player, drawn on top of everyone else.
  const p = world.player;
  if (!p.car) {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(p.x + 2, p.y + 4, 12, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.player;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.playerShirt;
    ctx.beginPath();
    ctx.arc(p.x + Math.cos(p.angle) * 5, p.y + Math.sin(p.angle) * 5, 6, 0, Math.PI * 2);
    ctx.fill();
    // Pistol in hand when armed.
    if (p.mag > 0 || p.ammo > 0) {
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(p.x + Math.cos(p.angle) * 10, p.y + Math.sin(p.angle) * 10);
      ctx.lineTo(p.x + Math.cos(p.angle) * 19, p.y + Math.sin(p.angle) * 19);
      ctx.stroke();
    }
  }
}

function drawBullets(ctx, world) {
  for (const b of world.bullets) {
    ctx.fillStyle = COLORS.bullet;
    ctx.beginPath();
    ctx.arc(b.x, b.y, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,210,59,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(b.x - Math.cos(b.angle) * 14, b.y - Math.sin(b.angle) * 14);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
}

function drawParticles(ctx, world) {
  for (const pt of world.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
    ctx.fillStyle = pt.color;
    ctx.fillRect(pt.x - 2, pt.y - 2, 4, 4);
  }
  ctx.globalAlpha = 1;
}

function drawHud(ctx, world) {
  const p = world.player;
  const m = world.mission.current;
  // Objective panel, top left.
  panel(ctx, 12, 12, 380, 64);
  ctx.fillStyle = COLORS.hudText;
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(world.objective.split(':')[0] || 'SOLMAR', 24, 34);
  ctx.fillStyle = COLORS.hudDim;
  ctx.font = '13px sans-serif';
  const sub = world.objective.includes(':') ? world.objective.split(':').slice(1).join(':').trim() : '';
  ctx.fillText(sub, 24, 56);
  if (m && m.timer > 0) {
    ctx.fillStyle = m.timer < 20 ? '#ff6b5a' : COLORS.hudText;
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(Math.ceil(m.timer) + 's', 380, 40);
    ctx.textAlign = 'left';
  }
  // Money and wanted, top right.
  panel(ctx, VIEW_W - 260, 12, 248, 64);
  ctx.fillStyle = '#7ee2a0';
  ctx.font = 'bold 24px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('$' + p.money.toLocaleString(), VIEW_W - 24, 42);
  ctx.textAlign = 'left';
  // Wanted stars.
  ctx.font = '22px sans-serif';
  let stars = '';
  for (let i = 0; i < 5; i += 1) stars += i < world.wanted ? '★' : '☆';
  ctx.fillStyle = world.wanted > 0 ? '#ffd23b' : '#6a6558';
  ctx.fillText(stars, VIEW_W - 248, 66);
  // Health / car / ammo, bottom right.
  panel(ctx, VIEW_W - 260, VIEW_H - 92, 248, 80);
  ctx.fillStyle = COLORS.hudText;
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText('HEALTH', VIEW_W - 248, VIEW_H - 70);
  bar(ctx, VIEW_W - 248, VIEW_H - 64, 224, 10, p.hp / p.maxHp, '#4be38a');
  if (p.car) {
    ctx.fillText('CAR', VIEW_W - 248, VIEW_H - 42);
    bar(ctx, VIEW_W - 248, VIEW_H - 36, 224, 10, p.car.hp / p.car.maxHp, '#e8b23a');
  } else {
    ctx.fillText('PISTOL  ' + p.mag + ' / ' + p.ammo, VIEW_W - 248, VIEW_H - 40);
    ctx.fillStyle = COLORS.hudDim;
    ctx.font = '12px sans-serif';
    ctx.fillText('F punch · click shoot · R reload', VIEW_W - 248, VIEW_H - 22);
  }
  // Prompt, bottom centre.
  if (world.prompt) {
    ctx.font = 'bold 16px sans-serif';
    const w = ctx.measureText(world.prompt.text).width + 28;
    panel(ctx, VIEW_W / 2 - w / 2, VIEW_H - 150, w, 34);
    ctx.fillStyle = COLORS.hudText;
    ctx.textAlign = 'center';
    ctx.fillText(world.prompt.text, VIEW_W / 2, VIEW_H - 127);
    ctx.textAlign = 'left';
  }
  // Toast, top centre.
  if (world.toastText && world.time < world.toastUntil) {
    ctx.font = 'bold 16px sans-serif';
    const w = ctx.measureText(world.toastText).width + 28;
    panel(ctx, VIEW_W / 2 - w / 2, 92, w, 34);
    ctx.fillStyle = '#ffe9a8';
    ctx.textAlign = 'center';
    ctx.fillText(world.toastText, VIEW_W / 2, 115);
    ctx.textAlign = 'left';
  }
  // Speed while driving.
  if (p.car) {
    ctx.fillStyle = COLORS.hudText;
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(Math.round(Math.abs(p.car.speed) * 0.24) + ' mph', VIEW_W - 24, VIEW_H - 108);
    ctx.textAlign = 'left';
  }
}

function drawMinimap(ctx, world) {
  const x0 = 12;
  const y0 = VIEW_H - MINIMAP_H - 12;
  const sx = MINIMAP_W / WORLD_W;
  const sy = MINIMAP_H / WORLD_H;
  panel(ctx, x0 - 4, y0 - 4, MINIMAP_W + 8, MINIMAP_H + 8);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, MINIMAP_W, MINIMAP_H);
  ctx.clip();
  ctx.fillStyle = '#c9b78d';
  ctx.fillRect(x0, y0, MINIMAP_W, MINIMAP_H);
  ctx.fillStyle = '#3b4048';
  for (const rx of ROAD_X) ctx.fillRect(x0 + rx * sx - 1, y0, 2, MINIMAP_H);
  for (const ry of ROAD_Y) ctx.fillRect(x0, y0 + ry * sy - 1, MINIMAP_W, 2);
  ctx.fillStyle = '#3f7fa8';
  ctx.fillRect(x0 + 3150 * sx, y0, MINIMAP_W - 3150 * sx, MINIMAP_H);
  // Objective marker.
  const { target, color } = markerAt(ctx, world);
  if (target) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x0 + target.x * sx, y0 + target.y * sy, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Police dots.
  ctx.fillStyle = '#2f4fb2';
  for (const car of world.cars) {
    if (car.carKind === 'police') {
      ctx.beginPath();
      ctx.arc(x0 + car.x * sx, y0 + car.y * sy, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Player dot with a white ring.
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x0 + world.player.x * sx, y0 + world.player.y * sy, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2f9e6e';
  ctx.beginPath();
  ctx.arc(x0 + world.player.x * sx, y0 + world.player.y * sy, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = COLORS.hudText;
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('SOLMAR', x0, y0 + MINIMAP_H + 2);
}

function drawTitle(ctx, world) {
  ctx.fillStyle = 'rgba(10, 12, 20, 0.82)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd23b';
  ctx.font = 'bold 84px sans-serif';
  ctx.fillText('SOLMAR', VIEW_W / 2, 230);
  ctx.fillStyle = '#f5f2e8';
  ctx.font = 'bold 44px sans-serif';
  ctx.fillText('STREETS', VIEW_W / 2, 285);
  ctx.fillStyle = '#b8b2a2';
  ctx.font = '18px sans-serif';
  ctx.fillText('An open-world crime game — steal cars, dodge the cops, run jobs for Mara.', VIEW_W / 2, 330);
  const save = hasSave();
  ctx.fillStyle = '#4be38a';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText(save ? 'ENTER — Continue' : 'ENTER or CLICK — Start', VIEW_W / 2, 410);
  if (save) {
    ctx.fillStyle = '#b8b2a2';
    ctx.font = '16px sans-serif';
    ctx.fillText('N — New game (erases the save)', VIEW_W / 2, 445);
  }
  ctx.fillStyle = '#f5f2e8';
  ctx.font = '15px sans-serif';
  const lines = [
    'WASD drive / walk · E enter car, talk, buy · F punch · Mouse shoot · R reload',
    'Shift sprint · P pause · M mute · Complete missions, take taxi fares, stay out of jail',
  ];
  ctx.fillText(lines[0], VIEW_W / 2, 510);
  ctx.fillText(lines[1], VIEW_W / 2, 538);
  ctx.fillStyle = '#8a8474';
  ctx.font = '13px sans-serif';
  ctx.fillText('A 100% original game. No network, no assets — everything is drawn and played live.', VIEW_W / 2, 600);
  ctx.textAlign = 'left';
}

function drawPause(ctx, world) {
  ctx.fillStyle = 'rgba(10, 12, 20, 0.6)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f5f2e8';
  ctx.font = 'bold 48px sans-serif';
  ctx.fillText('PAUSED', VIEW_W / 2, 320);
  ctx.font = '18px sans-serif';
  ctx.fillStyle = '#b8b2a2';
  ctx.fillText('Esc / P or click to resume — your progress is saved', VIEW_W / 2, 370);
  ctx.textAlign = 'left';
}

function drawWasted(ctx, world) {
  ctx.fillStyle = 'rgba(20, 8, 8, 0.72)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff5a4a';
  ctx.font = 'bold 92px sans-serif';
  ctx.fillText(world.wastedReason || 'WASTED', VIEW_W / 2, 330);
  ctx.fillStyle = '#f5f2e8';
  ctx.font = '20px sans-serif';
  ctx.fillText('Mara patched you up at the hideout. Your missions and cash are safe.', VIEW_W / 2, 390);
  ctx.fillStyle = '#4be38a';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('ENTER or CLICK — Back on the streets', VIEW_W / 2, 450);
  ctx.textAlign = 'left';
}

function drawIntro(ctx, world) {
  const intro = world.mission.intro;
  if (!intro) return;
  const def = MISSIONS[intro.id];
  if (!def) return;
  panel(ctx, VIEW_W / 2 - 320, VIEW_H / 2 - 110, 640, 220);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#c23a6e';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('MARA — ' + def.name, VIEW_W / 2, VIEW_H / 2 - 68);
  ctx.fillStyle = COLORS.hudText;
  ctx.font = '17px sans-serif';
  const words = def.brief.split(' ');
  let line = '';
  let y = VIEW_H / 2 - 34;
  for (const word of words) {
    if ((line + ' ' + word).trim().length > 52) {
      ctx.fillText(line.trim(), VIEW_W / 2, y);
      y += 24;
      line = word;
    } else {
      line += ' ' + word;
    }
  }
  ctx.fillText(line.trim(), VIEW_W / 2, y);
  ctx.fillStyle = '#ffd23b';
  ctx.font = 'bold 17px sans-serif';
  ctx.fillText('Reward: $' + def.reward + (def.timer ? ' · ' + def.timer + 's on the clock' : ''), VIEW_W / 2, y + 36);
  ctx.fillStyle = '#4be38a';
  ctx.fillText('ENTER — Accept job    ·    ESC — Not now', VIEW_W / 2, y + 68);
  ctx.textAlign = 'left';
}
