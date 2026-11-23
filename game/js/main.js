// main.js — SOLMAR STREETS core: game state, input, player on foot / in a car,
// the wanted system, combat, day/night, saving, and the main loop.
var canvas, ctx;
var G = null;
var keys = {};
var mouse = { x: 640, y: 360, down: false };
var parkedCars = [];

function newGameState() {
  return {
    screen: 'title', // title | play | pause | wasted
    timeH: 10.5, nightF: 0,
    player: { x: CITY.spawn.x, y: CITY.spawn.y, angle: 0, speed: 0 },
    inCar: false, car: null,
    health: 100, armor: 0, cash: 250, wanted: 0,
    hasGun: false, ammo: 0,
    completed: [], shopOpen: null, prompt: '',
    hurtFlash: 0, animT: 0, punchCd: 0, shootCd: 0,
    heatTimer: 0, calmTimer: 0, sirenTimer: 0, spawnCd: 0,
    hasSave: false
  };
}
// ---- wanted -----------------------------------------------------------------
// Every wanted message is generated from the live level (see wantedAlertText in hud.js).
function addWanted(g, n, reason) {
  const before = g.wanted;
  g.wanted = clamp(g.wanted + n, 0, 5);
  if (g.wanted > before) {
    showToast(reason + '。' + wantedAlertText(g.wanted));
    g.calmTimer = 0;
    g.spawnCd = 0; // fresh heat: police respond at once
  }
}
function setWanted(g, n) {
  g.wanted = clamp(n, 0, 5);
  g.calmTimer = 0;
}
function wantedPoliceTarget(g) { return Math.min(g.wanted, 4); }
// ---- save / load --------------------------------------------------------------
var SAVE_KEY = 'solmar-streets-save-v1';
function saveGame(g) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: g.cash, health: g.health, armor: g.armor, wanted: g.wanted,
      hasGun: g.hasGun, ammo: g.ammo, completed: g.completed,
      timeH: g.timeH, px: g.player.x, py: g.player.y
    }));
  } catch (e) { /* storage unavailable: play on without saving */ }
}
function loadGame(g) {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const s = JSON.parse(raw);
    g.cash = s.cash; g.health = s.health; g.armor = s.armor; g.wanted = s.wanted;
    g.hasGun = s.hasGun; g.ammo = s.ammo; g.completed = s.completed || [];
    g.timeH = s.timeH; g.player.x = s.px; g.player.y = s.py;
    return true;
  } catch (e) { return false; }
}
function hasSave() {
  try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
}
// ---- cars: enter / exit / steal ------------------------------------------------
function nearestParkedCar(x, y, maxD) {
  let best = null, bd = maxD * maxD;
  for (const c of parkedCars) {
    const d2 = dist2(x, y, c.x, c.y);
    if (d2 < bd) { bd = d2; best = c; }
  }
  return best;
}
function enterCar(g, car, stolen) {
  g.inCar = true; g.car = car;
  car.speed = 0;
  if (stolen) {
    car.stolenByPlayer = true;
    // One single toast for the whole steal: car + live wanted wording together.
    addWanted(g, 1, '偷了一辆' + car.type.name);
    AudioSys.blip(300, 0.15, 'square', 0.2, 500);
  } else {
    showToast('上了' + car.type.name + '。');
  }
}
function exitCar(g) {
  if (!g.car) return;
  const c = g.car;
  c.speed = 0;
  // Step out beside the car.
  const px = c.x - Math.sin(c.angle) * 30, py = c.y + Math.cos(c.angle) * 30;
  const fixed = collideCircle(px, py, 12);
  g.player.x = fixed.x; g.player.y = fixed.y;
  g.player.angle = c.angle;
  g.inCar = false; g.car = null;
  if (parkedCars.indexOf(c) < 0) parkedCars.push(c);
}
function tryEnterCar(g) {
  const p = g.player;
  const tc = nearestTrafficCar(p.x, p.y, 60);
  const pc = nearestParkedCar(p.x, p.y, 60);
  const car = tc || pc;
  if (!car) return false;
  if (tc) {
    const i = trafficCars.indexOf(tc);
    if (i >= 0) trafficCars.splice(i, 1);
    enterCar(g, tc, !tc.stolenByPlayer);
  } else {
    const i = parkedCars.indexOf(pc);
    if (i >= 0) parkedCars.splice(i, 1);
    enterCar(g, pc, false);
  }
  return true;
}
// ---- combat -------------------------------------------------------------------
function hurtPlayer(g, dmg) {
  if (g.armor > 0) {
    const absorbed = Math.min(g.armor, dmg);
    g.armor -= absorbed; dmg -= absorbed;
  }
  g.health -= dmg;
  g.hurtFlash = 1;
  if (g.health <= 0) {
    g.health = 0;
    g.screen = 'wasted';
    AudioSys.fail();
    AudioSys.setEngine(false, 0);
    saveGame(g);
  }
}
function doPunch(g) {
  if (g.punchCd > 0) return;
  g.punchCd = 0.45;
  AudioSys.punch();
  const p = g.player;
  const fx = p.x + Math.cos(p.angle) * 26, fy = p.y + Math.sin(p.angle) * 26;
  let hitAny = false;
  const tryHit = function (t, dmg) {
    if (t.health <= 0) return;
    if (dist(t.x, t.y, fx, fy) < 42) {
      t.health -= dmg; hitAny = true;
      if (t.health <= 0 && t.type && t.type.name === 'Thug') {
        showToast('放倒一名打手！');
        AudioSys.cash();
      }
    }
  };
  for (const t of thugs) tryHit(t, 20);
  for (const c of footCops) tryHit(c, 20);
  for (const ped of pedestrians) {
    if (dist(ped.x, ped.y, fx, fy) < 42) {
      ped.health = 0; hitAny = true;
      pedestrians.splice(pedestrians.indexOf(ped), 1);
      addWanted(g, 1, '当街打人');
      break;
    }
  }
  if (hitAny) scarePeds(p.x, p.y, 160);
}
function doShoot(g) {
  if (!g.hasGun || g.ammo <= 0 || g.shootCd > 0) {
    if (g.hasGun && g.ammo <= 0) showToast('没子弹了，去 GUN BARN 买子弹。');
    return;
  }
  g.shootCd = 0.28;
  g.ammo--;
  AudioSys.gunshot();
  const p = g.player;
  // Aim at the mouse cursor in world space.
  const wx = g.cam.x + mouse.x, wy = g.cam.y + mouse.y;
  const aim = angleTo(p.x, p.y, wx, wy);
  let best = null, bd = 460;
  const consider = function (t) {
    if (!t || t.health <= 0) return;
    const d = dist(p.x, p.y, t.x, t.y);
    if (d > bd) return;
    if (Math.abs(angleDiff(aim, angleTo(p.x, p.y, t.x, t.y))) < 0.22) { best = t; bd = d; }
  };
  for (const t of thugs) consider(t);
  for (const c of footCops) consider(c);
  for (const ped of pedestrians) consider(ped);
  g.tracer = { x1: p.x, y1: p.y, x2: p.x + Math.cos(aim) * (best ? bd : 420), y2: p.y + Math.sin(aim) * (best ? bd : 420), left: 0.08 };
  if (best) {
    best.health -= 34;
    if (best.type && best.type.name === 'Thug' && best.health <= 0) showToast('击倒一名打手！');
    if (best.type && best.type.name !== 'Thug') addWanted(g, 1, '开枪伤人');
    scarePeds(p.x, p.y, 260);
  }
}
// ---- police -------------------------------------------------------------------
function maintainPolice(g, dt) {
  const want = g.wanted > 0 ? wantedPoliceTarget(g) : 0;
  g.spawnCd = Math.max(0, (g.spawnCd || 0) - dt);
  // A cruiser that loses the trail far away gives up; replacements are
  // delayed, so a good escape really does cool the heat down.
  for (let i = policeCars.length - 1; i >= 0; i--) {
    const pc = policeCars[i];
    const d = dist(pc.x, pc.y, g.player.x, g.player.y);
    pc.farT = d > 800 ? (pc.farT || 0) + dt : 0;
    if (pc.farT > 4) { policeCars.splice(i, 1); g.spawnCd = 8; }
  }
  while (policeCars.length < want && g.spawnCd <= 0) {
    const p = randomRoadPoint();
    // Spawn a little way off so they drive in.
    const a = angleTo(g.player.x, g.player.y, p.x, p.y);
    const sp = { x: g.player.x + Math.cos(a) * 520, y: g.player.y + Math.sin(a) * 520 };
    const fixed = collideCircle(clamp(sp.x, 40, WORLD - 40), clamp(sp.y, 40, WORLD - 40), 18);
    policeCars.push(makePoliceCar(fixed.x, fixed.y));
  }
  while (policeCars.length > want) policeCars.pop();
  if (g.wanted > 0) {
    g.sirenTimer -= dt;
    if (g.sirenTimer <= 0) { g.sirenTimer = 1.6; AudioSys.siren(); }
  }
  updatePolice(dt, g.player.x, g.player.y, g.wanted);
  // Police ram the player's car.
  if (g.inCar && g.car) {
    for (const pc of policeCars) {
      if (dist(pc.x, pc.y, g.car.x, g.car.y) < 52) {
        g.car.health -= dt * 14;
        g.car.speed *= (1 - dt * 1.2);
        if (chance(dt * 2)) AudioSys.crash();
        if (g.car.health <= 0) {
          showToast('你的车被撞报废了！');
          AudioSys.crash();
          const dead = g.car;
          exitCar(g);
          parkedCars.splice(parkedCars.indexOf(dead), 1);
          hurtPlayer(g, 15);
        }
      }
    }
  }
  // Foot cops when wanted is high and the player is on foot.
  if (g.wanted >= 3 && !g.inCar && footCops.filter(function (c) { return c.health > 0; }).length < 2) {
    spawnFootCops(g.player.x, g.player.y, 2);
    showToast(wantedAlertText(g.wanted) + ' 便衣也加入了追捕。');
  }
  // Heat cools off when no police is near.
  let near = false;
  for (const pc of policeCars) if (dist(pc.x, pc.y, g.player.x, g.player.y) < 420) near = true;
  for (const c of footCops) if (c.health > 0 && dist(c.x, c.y, g.player.x, g.player.y) < 300) near = true;
  if (g.wanted > 0) {
    if (near) g.calmTimer = 0;
    else {
      g.calmTimer += dt;
      if (g.calmTimer > 9) {
        g.calmTimer = 0;
        setWanted(g, g.wanted - 1);
        showToast(g.wanted > 0 ? '躲了一阵，通缉降到 ' + g.wanted + ' 星。' : '通缉清零了，风平浪静。');
      }
    }
  }
}
// ---- per-frame update -----------------------------------------------------------
function update(dt) {
  const g = G;
  g.animT += dt;
  g.timeH = (g.timeH + dt * 24 / 480) % 24; // a full day in 8 minutes
  // Night factor: 0 by day, 1 deep at night.
  const h = g.timeH;
  if (h >= 20 || h < 5.5) g.nightF = 1;
  else if (h >= 18.5) g.nightF = (20 - h) / 1.5;
  else if (h < 7) g.nightF = (7 - h) / 1.5;
  else g.nightF = 0;
  g.nightF = clamp(g.nightF, 0, 1);
  g.punchCd = Math.max(0, g.punchCd - dt);
  g.shootCd = Math.max(0, g.shootCd - dt);
  g.hurtFlash = Math.max(0, g.hurtFlash - dt * 2.2);
  if (g.tracer) { g.tracer.left -= dt; if (g.tracer.left <= 0) g.tracer = null; }
  updateToasts(dt);
  const p = g.player;
  const blocked = !!g.shopOpen; // browsing a shop: feet and wheels stay put
  const up = (keys['KeyW'] || keys['ArrowUp']) && !blocked;
  const down = (keys['KeyS'] || keys['ArrowDown']) && !blocked;
  const left = (keys['KeyA'] || keys['ArrowLeft']) && !blocked;
  const right = (keys['KeyD'] || keys['ArrowRight']) && !blocked;
  if (g.inCar && g.car) {
    const c = g.car;
    const accel = up ? c.type.accel : 0;
    const brake = down ? c.type.accel * 0.9 : 0;
    c.speed += (accel - brake) * dt;
    if (!up && !down) c.speed = lerp(c.speed, 0, dt * 1.4);
    // Reverse.
    if (down && c.speed < 5) c.speed -= c.type.accel * 0.5 * dt;
    c.speed = clamp(c.speed, -140, c.type.speed);
    const steer = (left ? -1 : 0) + (right ? 1 : 0);
    const dirSign = c.speed >= 0 ? 1 : -1;
    c.angle += steer * dirSign * clamp(Math.abs(c.speed) / 160, 0, 1) * 2.4 * dt;
    const nx = c.x + Math.cos(c.angle) * c.speed * dt;
    const ny = c.y + Math.sin(c.angle) * c.speed * dt;
    const fixed = collideCircle(nx, ny, 20);
    if ((fixed.x !== nx || fixed.y !== ny) && Math.abs(c.speed) > 120) {
      AudioSys.crash();
      c.health -= 4;
      c.speed *= 0.5;
    }
    c.x = fixed.x; c.y = fixed.y;
    // Bumping traffic.
    for (const t of trafficCars) {
      if (dist(t.x, t.y, c.x, c.y) < 48 && Math.abs(c.speed) > 60) {
        t.speed = Math.max(t.speed, 60);
        c.health -= dt * 8;
        if (chance(dt * 2)) AudioSys.crash();
      }
    }
    // Running over pedestrians.
    for (let i = pedestrians.length - 1; i >= 0; i--) {
      const ped = pedestrians[i];
      if (dist(ped.x, ped.y, c.x, c.y) < 26 && Math.abs(c.speed) > 80) {
        pedestrians.splice(i, 1);
        addWanted(g, 1, '撞到了行人');
        AudioSys.crash();
      }
    }
    if (c.health <= 0) {
      showToast('车报废了！');
      const dead = c;
      exitCar(g);
      parkedCars.splice(parkedCars.indexOf(dead), 1);
      hurtPlayer(g, 10);
    }
    p.x = c.x; p.y = c.y; p.angle = c.angle;
    AudioSys.setEngine(true, Math.abs(c.speed) / c.type.speed);
  } else {
    AudioSys.setEngine(false, 0);
    let mx = (right ? 1 : 0) - (left ? 1 : 0);
    let my = (down ? 1 : 0) - (up ? 1 : 0);
    if (mx !== 0 || my !== 0) {
      const len = Math.hypot(mx, my);
      mx /= len; my /= len;
      p.angle = Math.atan2(my, mx);
      const nx = p.x + mx * 175 * dt, ny = p.y + my * 175 * dt;
      const fixed = collideCircle(nx, ny, 12);
      p.x = fixed.x; p.y = fixed.y;
    }
  }
  updateTraffic(dt, p.x, p.y);
  updatePedestrians(dt, p.x, p.y, g.inCar ? g.car : null);
  const thugHit = updateThugs(dt, p.x, p.y);
  if (thugHit) hurtPlayer(g, thugHit.dmg);
  const copHit = updateFootCops(dt, p.x, p.y);
  if (copHit) hurtPlayer(g, copHit.dmg);
  maintainPolice(g, dt);
  updateMission(dt, g);
  updateTaxi(dt, g);
  updateCourier(dt, g);
  // Interaction prompt.
  g.prompt = '';
  if (!g.inCar) {
    if (tryRobVanTarget(g)) g.prompt = '按 E 抢现金袋';
    else if (nearestShop(p.x, p.y, 80)) g.prompt = '按 E 进入 ' + nearestShop(p.x, p.y, 80).name;
    else if (nearestTrafficCar(p.x, p.y, 60) || nearestParkedCar(p.x, p.y, 60)) g.prompt = '按 E 上车（偷车会涨通缉）';
  } else {
    g.prompt = '按 E 下车';
  }
  // Camera follows the player.
  g.cam.x = clamp(p.x - 640, 0, WORLD - 1280);
  g.cam.y = clamp(p.y - 360, 0, WORLD - 720);
}
function tryRobVanTarget(g) {
  const s = currentStep();
  if (!M.active || !s || s.kind !== 'robVan') return false;
  const van = M.data.van;
  return !!van && van.health <= 0 && dist(g.player.x, g.player.y, van.x, van.y) < 70;
}
function interact(g) {
  if (g.shopOpen) { g.shopOpen = null; return; }
  if (!g.inCar) {
    if (tryRobVan(g)) return;
    const shop = nearestShop(g.player.x, g.player.y, 80);
    if (shop) { g.shopOpen = shop; AudioSys.pickup(); return; }
    if (tryEnterCar(g)) return;
  } else {
    exitCar(g);
  }
}
// ---- rendering ------------------------------------------------------------------
function render() {
  const g = G;
  ctx.clearRect(0, 0, 1280, 720);
  if (g.screen === 'title') { drawTitle(ctx, g); return; }
  ctx.save();
  ctx.translate(-Math.round(g.cam.x), -Math.round(g.cam.y));
  drawCity(ctx, g.cam, g.nightF, g.timeH);
  // Shop markers: a colored ground ring + dot in the world only — no floating
  // text here, so a shop can never cover the HUD. Names live on the minimap
  // (top-right) and in the bottom interaction prompt.
  for (const s of CITY.shops) {
    ctx.strokeStyle = s.color; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(s.x, s.y, 16 + Math.sin(g.animT * 3) * 2, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = s.color;
    ctx.beginPath(); ctx.arc(s.x, s.y, 7, 0, Math.PI * 2); ctx.fill();
  }
  // Mission target ring.
  const tp = missionTargetPoint();
  if (tp) {
    const pulse = 26 + Math.sin(g.animT * 4) * 6;
    ctx.strokeStyle = '#ffd23d'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(tp.x, tp.y, pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(255,210,61,0.18)';
    ctx.beginPath(); ctx.arc(tp.x, tp.y, pulse, 0, Math.PI * 2); ctx.fill();
  }
  if (M.taxi.active) {
    const t = M.taxi.stage === 'pickup' ? { x: M.taxi.px, y: M.taxi.py } : { x: M.taxi.dx, y: M.taxi.dy };
    ctx.fillStyle = '#f1c40f';
    ctx.beginPath(); ctx.arc(t.x, t.y, 10 + Math.sin(g.animT * 5) * 3, 0, Math.PI * 2); ctx.fill();
  }
  for (const c of trafficCars) drawCarShape(ctx, c, g.nightF);
  for (const c of parkedCars) drawCarShape(ctx, c, g.nightF);
  for (const pc of policeCars) drawCarShape(ctx, pc, g.nightF);
  if (g.inCar && g.car) drawCarShape(ctx, g.car, g.nightF);
  drawPeople(ctx);
  if (!g.inCar) {
    // Player on foot.
    ctx.save();
    ctx.translate(g.player.x, g.player.y);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(0, 5, 10, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.rotate(g.player.angle);
    ctx.fillStyle = '#222';
    ctx.fillRect(-5, -6, 10, 5); ctx.fillRect(-5, 1, 10, 5);
    ctx.fillStyle = '#e8c33d';
    roundRect(ctx, -8, -8, 16, 16, 5); ctx.fill();
    ctx.fillStyle = '#2c3e50';
    ctx.beginPath(); ctx.arc(9, 0, 5.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  // Bullet tracer.
  if (g.tracer) {
    ctx.strokeStyle = 'rgba(255,240,150,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(g.tracer.x1, g.tracer.y1); ctx.lineTo(g.tracer.x2, g.tracer.y2); ctx.stroke();
  }
  ctx.restore();
  // Night darkness + a soft light pool around the player.
  if (g.nightF > 0.05) {
    ctx.fillStyle = 'rgba(6,10,34,' + (g.nightF * 0.42) + ')';
    ctx.fillRect(0, 0, 1280, 720);
    const px = g.player.x - g.cam.x, py = g.player.y - g.cam.y;
    const grad = ctx.createRadialGradient(px, py, 60, px, py, 340);
    grad.addColorStop(0, 'rgba(255,220,140,0.20)');
    grad.addColorStop(1, 'rgba(255,220,140,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(px - 340, py - 340, 680, 680);
  }
  drawHUD(ctx, g);
  if (g.shopOpen) drawShopPanel(ctx, g, g.shopOpen);
  if (g.screen === 'pause') drawPause(ctx, g);
  if (g.screen === 'wasted') drawWasted(ctx, g);
}
// ---- input ----------------------------------------------------------------------
function onKeyDown(e) {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  keys[e.code] = true;
  const g = G;
  if (e.code === 'KeyM') {
    AudioSys.setMuted(!AudioSys.muted);
    showToast(AudioSys.muted ? '已静音。' : '声音已打开。');
    return;
  }
  if (g.screen === 'title') {
    if (e.code === 'Enter') startPlaying(false);
    else if (e.code === 'KeyL' && g.hasSave) startPlaying(true);
    return;
  }
  if (g.screen === 'wasted') {
    if (e.code === 'Enter') respawn(g);
    return;
  }
  if (e.code === 'KeyP' || e.code === 'Escape') {
    if (g.shopOpen) { g.shopOpen = null; return; }
    g.screen = g.screen === 'pause' ? 'play' : 'pause';
    if (g.screen === 'pause') AudioSys.setEngine(false, 0);
    return;
  }
  if (g.screen !== 'play') return;
  if (g.shopOpen) {
    if (e.code === 'Digit1') buyShopItem(g, g.shopOpen, 0);
    else if (e.code === 'Digit2') buyShopItem(g, g.shopOpen, 1);
    else if (e.code === 'KeyE') g.shopOpen = null;
    return;
  }
  if (e.code === 'KeyE') interact(g);
  else if (e.code === 'Space') doPunch(g);
  else if (e.code === 'KeyT') startTaxi(g);
  else if (e.code === 'KeyC') startCourier(g);
  else if (/^Digit[1-5]$/.test(e.code)) {
    const n = parseInt(e.code.slice(5), 10);
    if (G.completed.indexOf(n) < 0) startMission(n, g);
    else showToast('任务 ' + missionById(n).name + ' 已完成。');
  } else if (e.code === 'KeyS') { saveGame(g); showToast('进度已保存。'); }
}
function onKeyUp(e) { keys[e.code] = false; }
function onMouseMove(e) {
  const r = canvas.getBoundingClientRect();
  mouse.x = (e.clientX - r.left) * (1280 / r.width);
  mouse.y = (e.clientY - r.top) * (720 / r.height);
}
function onMouseDown(e) {
  AudioSys.init(); AudioSys.resume();
  onMouseMove(e);
  const g = G;
  if (g.screen === 'title') { startPlaying(false); return; }
  if (g.screen === 'wasted') { respawn(g); return; }
  if (g.screen === 'play' && !g.shopOpen) doShoot(g);
}
function startPlaying(fromSave) {
  const g = G;
  AudioSys.init(); AudioSys.resume(); AudioSys.startMusic();
  if (fromSave) { loadGame(g); showToast('存档已读取，欢迎回来。'); }
  g.screen = 'play';
}
function respawn(g) {
  g.health = 100;
  g.cash = Math.max(0, g.cash - 100);
  g.wanted = 0;
  policeCars.length = 0; footCops.length = 0;
  g.player.x = CITY.spawn.x; g.player.y = CITY.spawn.y;
  if (g.inCar) { g.inCar = false; g.car = null; }
  g.screen = 'play';
  showToast('在医院醒来，医药费 $100。');
}
// ---- boot -----------------------------------------------------------------------
function boot() {
  canvas = document.getElementById('game');
  ctx = canvas.getContext('2d');
  buildCity();
  G = newGameState();
  G.cam = { x: 0, y: 0, w: 1280, h: 720 };
  G.hasSave = hasSave();
  spawnTraffic(26);
  spawnPedestrians(42);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  // Clean shutdown on navigation so no timer fires mid-reload.
  window.addEventListener('pagehide', function () {
    AudioSys.stopMusic();
    AudioSys.setEngine(false, 0);
  });
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  // Probe / debug hook: read-only state for automated checks.
  window.__SOLMAR__ = {
    G: G, ToastSys: ToastSys, M: M,
    trafficCars: trafficCars, policeCars: policeCars, pedestrians: pedestrians
  };
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (G.screen === 'play') update(dt);
    else { G.animT += dt; updateToasts(dt); }
    render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
document.addEventListener('DOMContentLoaded', boot);
