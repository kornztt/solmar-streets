// hud.js — everything on screen: HUD, minimap, toasts, shop menu, title / pause /
// WASTED screens, and the off-screen objective arrow.
//
// Fix 1 (toasts): at most 3 visible at once, drawn at the BOTTOM of the screen;
// extra toasts wait in a queue and appear as slots free up. Never the old
// pile-up in the middle of the screen.
// Fix 2 (wanted wording): every message that names stars or police cars is built
// from the live wanted level by wantedAlertText() — no hard-coded star counts.
// Fix 3 (PIT STOP label): shop labels live on the minimap (top-right corner),
// far from the mission panel (top-left), so they can never overlap it.
var ToastSys = { queue: [], visible: [], MAX_VISIBLE: 3 };
function showToast(text, dur) {
  ToastSys.queue.push({ text: text, dur: dur || 3.5 });
}
function updateToasts(dt) {
  while (ToastSys.visible.length < ToastSys.MAX_VISIBLE && ToastSys.queue.length > 0) {
    const t = ToastSys.queue.shift();
    t.left = t.dur;
    ToastSys.visible.push(t);
  }
  for (let i = ToastSys.visible.length - 1; i >= 0; i--) {
    ToastSys.visible[i].left -= dt;
    if (ToastSys.visible[i].left <= 0) ToastSys.visible.splice(i, 1);
  }
}
// Wanted text is ALWAYS generated from the live level — never written with a fixed number.
function wantedAlertText(level) {
  if (level <= 0) return '风平浪静，没有通缉。';
  return '通缉 ' + level + ' 星：' + level + ' 辆警车正在追捕你！';
}
function drawToasts(ctx) {
  const cx = 640;
  let y = 690;
  for (let i = ToastSys.visible.length - 1; i >= 0; i--) {
    const t = ToastSys.visible[i];
    ctx.font = 'bold 15px sans-serif';
    const w = ctx.measureText(t.text).width + 28;
    const alpha = clamp(t.left, 0, 1);
    ctx.fillStyle = 'rgba(10,12,18,' + (0.82 * alpha) + ')';
    roundRect(ctx, cx - w / 2, y - 24, w, 30, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(232,195,61,' + alpha + ')';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,' + alpha + ')';
    ctx.textAlign = 'center';
    ctx.fillText(t.text, cx, y - 4);
    y -= 38;
  }
}
function drawStars(ctx, x, y, level) {
  for (let i = 0; i < 5; i++) {
    ctx.font = '26px sans-serif';
    ctx.fillStyle = i < level ? '#ffd23d' : 'rgba(255,255,255,0.25)';
    ctx.textAlign = 'center';
    ctx.fillText('★', x + i * 30, y);
  }
}
function drawMinimap(ctx, G) {
  const S = 190, ox = 1280 - S - 16, oy = 16;
  const k = S / WORLD;
  ctx.fillStyle = 'rgba(8,10,16,0.78)';
  roundRect(ctx, ox - 6, oy - 6, S + 12, S + 12, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.save();
  ctx.beginPath(); ctx.rect(ox, oy, S, S); ctx.clip();
  // Roads.
  ctx.fillStyle = '#3a3a42';
  for (let i = 0; i <= GRID_N; i++) {
    ctx.fillRect(ox + roadCenter(i) * k - 2, oy, 4, S);
    ctx.fillRect(ox, oy + roadCenter(i) * k - 2, S, 4);
  }
  // Water.
  ctx.fillStyle = '#2a5a8a';
  for (const w of CITY.waters) ctx.fillRect(ox + w.x * k, oy + w.y * k, w.w * k, w.h * k);
  // Buildings.
  ctx.fillStyle = '#7a7a84';
  for (const b of CITY.buildings) ctx.fillRect(ox + b.x * k, oy + b.y * k, Math.max(1, b.w * k), Math.max(1, b.h * k));
  // Shops: dot + label, all inside the minimap (top-right), away from the mission panel.
  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'left';
  for (const s of CITY.shops) {
    const sx = ox + s.x * k, sy = oy + s.y * k;
    ctx.fillStyle = s.color;
    ctx.beginPath(); ctx.arc(sx, sy, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(s.name, sx + 6, sy + 3);
  }
  // Hideout.
  ctx.fillStyle = '#e8c33d';
  ctx.beginPath(); ctx.arc(ox + CITY.hideout.x * k, oy + CITY.hideout.y * k, 4, 0, Math.PI * 2); ctx.fill();
  // Mission / job target.
  const tp = missionTargetPoint();
  if (tp) {
    const pulse = 4 + Math.sin(G.animT * 5) * 1.5;
    ctx.fillStyle = '#ffd23d';
    ctx.beginPath(); ctx.arc(ox + tp.x * k, oy + tp.y * k, pulse, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(ox + tp.x * k, oy + tp.y * k, pulse + 3, 0, Math.PI * 2); ctx.stroke();
  }
  // Traffic (white), police (red), player (green arrow).
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  for (const c of trafficCars) ctx.fillRect(ox + c.x * k - 1, oy + c.y * k - 1, 2.5, 2.5);
  ctx.fillStyle = '#ff3b30';
  for (const p of policeCars) {
    ctx.beginPath(); ctx.arc(ox + p.x * k, oy + p.y * k, 3, 0, Math.PI * 2); ctx.fill();
  }
  const px = ox + G.player.x * k, py = oy + G.player.y * k;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(G.player.angle);
  ctx.fillStyle = '#39d353';
  ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-5, -5); ctx.lineTo(-5, 5); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '11px sans-serif'; ctx.textAlign = 'left';
  ctx.fillText('SOLMAR · 小地图', ox, oy + S + 16);
}
function drawObjectiveArrow(ctx, G) {
  const tp = missionTargetPoint();
  if (!tp) return;
  const sx = tp.x - G.cam.x, sy = tp.y - G.cam.y;
  if (sx > 60 && sx < 1220 && sy > 60 && sy < 660) return; // on screen already
  const cx0 = clamp(sx, 70, 1210), cy0 = clamp(sy, 70, 650);
  // Keep the arrow out of the HUD panels: mission panel top-left, minimap
  // top-right, status panel bottom-left.
  let cx = cx0, cy = cy0;
  if (cx < 360 && cy < 110) cy = 110;
  if (cx > 1020 && cy < 240) cy = 240;
  if (cx < 300 && cy > 610) cy = 610;
  const a = angleTo(G.player.x, G.player.y, tp.x, tp.y);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(a);
  ctx.fillStyle = '#ffd23d';
  ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-10, -10); ctx.lineTo(-10, 10); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#ffd23d';
  ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(Math.round(dist(G.player.x, G.player.y, tp.x, tp.y)) + 'm', cx, cy + 26);
}
function drawHUD(ctx, G) {
  // Top-left: mission panel.
  ctx.fillStyle = 'rgba(8,10,16,0.72)';
  roundRect(ctx, 14, 14, 330, 74, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(232,195,61,0.7)'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = '#e8c33d';
  ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'left';
  ctx.fillText('SOLMAR STREETS', 26, 38);
  ctx.fillStyle = '#fff';
  ctx.font = '13px sans-serif';
  const obj = missionObjectiveText();
  ctx.fillText(obj.length > 46 ? obj.slice(0, 46) + '…' : obj, 26, 60);
  ctx.fillStyle = '#9aa3b2';
  ctx.font = '12px sans-serif';
  const done = MISSIONS.filter(function (m) { return G.completed.indexOf(m.id) >= 0; }).length;
  ctx.fillText('剧情任务 ' + done + '/5 完成 · 现金 ' + fmtMoney(G.cash), 26, 78);
  // Top-center: wanted stars.
  drawStars(ctx, 640 - 60, 46, G.wanted);
  if (G.wanted > 0) {
    ctx.fillStyle = '#ff6b5e';
    ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(wantedAlertText(G.wanted), 640, 66);
  }
  // Minimap (top-right).
  drawMinimap(ctx, G);
  // Bottom-left: health / armor / cash / weapon.
  ctx.fillStyle = 'rgba(8,10,16,0.72)';
  roundRect(ctx, 14, 720 - 92, 250, 78, 10);
  ctx.fill();
  bar(ctx, 28, 720 - 76, 180, 12, G.health / 100, '#39d353', '生命');
  bar(ctx, 28, 720 - 54, 180, 12, G.armor / 100, '#4faeef', '护甲');
  ctx.fillStyle = '#fff'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'left';
  ctx.fillText(fmtMoney(G.cash), 28, 720 - 26);
  ctx.fillStyle = G.hasGun ? '#ffd23d' : '#9aa3b2';
  ctx.font = '13px sans-serif';
  ctx.fillText(G.hasGun ? '手枪 · 子弹 ' + G.ammo : '无枪 · 去 GUN BARN 购买', 120, 720 - 26);
  // Bottom-right: speed + clock.
  ctx.fillStyle = 'rgba(8,10,16,0.72)';
  roundRect(ctx, 1280 - 190, 720 - 92, 176, 78, 10);
  ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 22px sans-serif'; ctx.textAlign = 'right';
  const spd = G.inCar && G.car ? Math.round(Math.abs(G.car.speed) * 0.36) : 0;
  ctx.fillText(spd + ' km/h', 1280 - 30, 720 - 48);
  ctx.fillStyle = '#9aa3b2'; ctx.font = '13px sans-serif';
  ctx.fillText(fmtClock(G.timeH) + (G.nightF > 0.5 ? ' · 夜' : ' · 白天'), 1280 - 30, 720 - 26);
  ctx.fillText(G.inCar && G.car ? G.car.type.name + ' · 耐久 ' + Math.round(G.car.health) : '步行', 1280 - 30, 720 - 72);
  drawToasts(ctx);
  drawObjectiveArrow(ctx, G);
  // Damage flash.
  if (G.hurtFlash > 0) {
    ctx.fillStyle = 'rgba(255,30,30,' + (G.hurtFlash * 0.35) + ')';
    ctx.fillRect(0, 0, 1280, 720);
  }
  // Interaction prompt.
  if (G.prompt) {
    ctx.font = 'bold 16px sans-serif';
    const w = ctx.measureText(G.prompt).width + 30;
    ctx.fillStyle = 'rgba(8,10,16,0.85)';
    roundRect(ctx, 640 - w / 2, 560, w, 34, 8);
    ctx.fill();
    ctx.fillStyle = '#ffd23d'; ctx.textAlign = 'center';
    ctx.fillText(G.prompt, 640, 582);
  }
}
function bar(ctx, x, y, w, h, frac, color, label) {
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  roundRect(ctx, x, y, w, h, 5); ctx.fill();
  ctx.fillStyle = color;
  if (frac > 0) { roundRect(ctx, x, y, Math.max(6, w * clamp(frac, 0, 1)), h, 5); ctx.fill(); }
  ctx.fillStyle = '#cfd6e2'; ctx.font = '11px sans-serif'; ctx.textAlign = 'left';
  ctx.fillText(label, x + w + 8, y + h - 2);
}
function drawShopPanel(ctx, G, shop) {
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 0, 1280, 720);
  ctx.fillStyle = '#14161d';
  roundRect(ctx, 440, 180, 400, 300, 14);
  ctx.fill();
  ctx.strokeStyle = shop.color; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = shop.color; ctx.font = 'bold 26px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(shop.name, 640, 226);
  ctx.fillStyle = '#fff'; ctx.font = '15px sans-serif';
  ctx.fillText(shop.cn + ' · 现金 ' + fmtMoney(G.cash), 640, 252);
  const items = shopMenu(shop);
  ctx.textAlign = 'left';
  items.forEach(function (it, i) {
    const y = 300 + i * 56;
    ctx.fillStyle = it.can(G) ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)';
    roundRect(ctx, 470, y - 22, 340, 44, 8); ctx.fill();
    ctx.fillStyle = it.can(G) ? '#fff' : '#777';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText('[' + it.key + '] ' + it.name, 486, y - 4);
    ctx.fillStyle = '#e8c33d'; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'right';
    ctx.fillText(fmtMoney(it.price), 794, y - 4);
    ctx.textAlign = 'left';
    if (!it.can(G)) { ctx.fillStyle = '#888'; ctx.font = '12px sans-serif'; ctx.fillText(it.why, 486, y + 14); }
  });
  ctx.fillStyle = '#9aa3b2'; ctx.font = '13px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('按 1 / 2 购买 · 按 E 离开', 640, 440);
}
function drawTitle(ctx, G) {
  ctx.fillStyle = '#0d1526';
  ctx.fillRect(0, 0, 1280, 720);
  // Skyline silhouette.
  ctx.fillStyle = '#16233d';
  for (let i = 0; i < 22; i++) {
    const bw = 40 + hash2(i, 3) * 50, bh = 120 + hash2(i, 7) * 220;
    ctx.fillRect(i * 60, 720 - 260 - bh + 120, bw, bh);
  }
  ctx.fillStyle = '#ffd23d';
  ctx.beginPath(); ctx.arc(1050, 130, 46, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e8c33d';
  ctx.font = 'bold 84px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('SOLMAR', 640, 250);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 54px sans-serif';
  ctx.fillText('STREETS', 640, 320);
  ctx.fillStyle = '#9aa3b2'; ctx.font = '18px sans-serif';
  ctx.fillText('索尔玛街头 · 一座属于你的开放世界犯罪之城', 640, 360);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 20px sans-serif';
  ctx.fillText(G.hasSave ? '按 ENTER 开始 · 按 L 读取存档继续' : '按 ENTER 开始', 640, 440);
  ctx.fillStyle = '#9aa3b2'; ctx.font = '15px sans-serif';
  ctx.fillText('WASD 走路 / 开车 · E 偷车 / 进店 · SPACE 出拳 · 鼠标开枪', 640, 480);
  ctx.fillText('1–5 剧情任务 · T 出租车 · C 快递 · P 暂停 · M 静音', 640, 506);
  ctx.fillStyle = '#e8c33d'; ctx.font = '13px sans-serif';
  ctx.fillText('9 个街区 · 6 种车型 · 5 个剧情任务 · 通缉 0–5 星 · 昼夜循环', 640, 560);
}
function drawPause(ctx, G) {
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, 1280, 720);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 44px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('已暂停', 640, 300);
  ctx.font = '17px sans-serif'; ctx.fillStyle = '#cfd6e2';
  ctx.fillText('P / ESC 继续 · S 保存进度 · M 静音 · R 回到标题', 640, 350);
  ctx.fillText('现金 ' + fmtMoney(G.cash) + ' · 任务完成 ' + G.completed.length + '/5 · 通缉 ' + G.wanted + ' 星', 640, 386);
}
function drawWasted(ctx, G) {
  ctx.fillStyle = 'rgba(20,0,0,0.72)';
  ctx.fillRect(0, 0, 1280, 720);
  ctx.fillStyle = '#ff3b30'; ctx.font = 'bold 72px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('WASTED', 640, 320);
  ctx.fillStyle = '#fff'; ctx.font = '18px sans-serif';
  ctx.fillText('你在索尔玛街头倒下了。按 ENTER 在医院醒来（花费 $100）。', 640, 380);
}
