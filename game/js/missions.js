// missions.js — the 5 story missions plus the two repeatable side jobs (taxi, courier).
// A mission is a list of steps; each step completes on a condition the update checks.
var MISSIONS = [
  { id: 1, name: 'The Getaway', cn: '逃出生天',
    intro: '抢一辆车，甩掉条子，冲到北郊藏匿点。',
    steps: [
      { kind: 'stealCar', text: '抢一辆车（靠近按 E 上车）' },
      { kind: 'goto', text: '开到北郊藏匿点', at: 'hideout', radius: 70 }
    ] },
  { id: 2, name: 'Hot Delivery', cn: '火线送货',
    intro: '限时把三批“热货”送到三个接头点，别撞车。',
    steps: [
      { kind: 'getInCar', text: '先上车' },
      { kind: 'deliver', text: '送货到接头点', count: 3, time: 150 }
    ] },
  { id: 3, name: 'Dockside Takedown', cn: '码头清场',
    intro: '码头上有三个打手挡路，把他们放倒。',
    steps: [
      { kind: 'goto', text: '前往海港码头', at: 'harbor', radius: 90 },
      { kind: 'beat', text: '放倒 3 名打手', count: 3 },
      { kind: 'goto', text: '回到中央广场', at: 'plaza', radius: 80 }
    ] },
  { id: 4, name: 'Harbor Chase', cn: '港口追逐',
    intro: '一辆叛徒的车正在逃往码头，撞停它。',
    steps: [
      { kind: 'getInCar', text: '先上车' },
      { kind: 'chase', text: '撞停逃跑的车' }
    ] },
  { id: 5, name: 'Night Heist', cn: '午夜劫案',
    intro: '天黑了。截停运钞车，抢走 3 袋现金，顶着通缉回到藏匿点。',
    steps: [
      { kind: 'goto', text: '前往运钞车路线（大学城）', at: 'campus', radius: 100 },
      { kind: 'robVan', text: '截停运钞车，靠近按 E 抢现金（0/3 袋）' },
      { kind: 'goto', text: '带着现金回到藏匿点', at: 'hideout', radius: 70 }
    ] }
];
var M = {
  active: null, stepIdx: 0, timer: 0, data: {},
  taxi: { active: false, stage: '', px: 0, py: 0, dx: 0, dy: 0, fare: 0 },
  courier: { active: false, idx: 0, points: [], delivered: 0 }
};
var MISSION_SPOTS = {
  hideout: function () { return { x: CITY.hideout.x, y: CITY.hideout.y }; },
  harbor: function () { return { x: blockOrigin(6) + BLOCK / 2, y: blockOrigin(0) + BLOCK / 2 }; },
  plaza: function () { return { x: blockOrigin(4) + BLOCK / 2, y: blockOrigin(4) + BLOCK / 2 }; },
  campus: function () { return { x: blockOrigin(6) + BLOCK / 2, y: blockOrigin(6) + BLOCK / 2 }; },
  downtown: function () { return { x: blockOrigin(3) + BLOCK / 2, y: blockOrigin(0) + BLOCK / 2 }; }
};
function missionById(id) { return MISSIONS.find(function (m) { return m.id === id; }); }
function currentStep() {
  if (!M.active) return null;
  return M.active.steps[M.stepIdx] || null;
}
function missionObjectiveText() {
  if (M.active) {
    const s = currentStep();
    return '任务 ' + M.active.name + '：' + (s ? s.text : '');
  }
  if (M.taxi.active) return M.taxi.stage === 'pickup' ? '出租车：去接乘客' : '出租车：把乘客送到目的地';
  if (M.courier.active) return '快递：送货 ' + M.courier.delivered + '/3';
  return '按 1–5 开始剧情任务 · T 出租车 · C 快递';
}
function missionTargetPoint() {
  if (M.active) {
    const s = currentStep();
    if (!s) return null;
    if (s.kind === 'goto') return MISSION_SPOTS[s.at]();
    if (s.kind === 'deliver' && M.data.points) return M.data.points[M.data.idx || 0];
    if (s.kind === 'beat') return MISSION_SPOTS.harbor();
    if (s.kind === 'chase' && M.data.chaseCar) return { x: M.data.chaseCar.x, y: M.data.chaseCar.y };
    if (s.kind === 'robVan' && M.data.van) return { x: M.data.van.x, y: M.data.van.y };
    return null;
  }
  if (M.taxi.active) return M.taxi.stage === 'pickup' ? { x: M.taxi.px, y: M.taxi.py } : { x: M.taxi.dx, y: M.taxi.dy };
  if (M.courier.active) return M.courier.points[M.courier.idx];
  return null;
}
function startMission(id, G) {
  if (M.active) { showToast('已有任务进行中，先完成它。'); return false; }
  const def = missionById(id);
  if (!def) return false;
  if (id === 5 && G.completed.indexOf(4) < 0) { showToast('先完成前 4 个任务再接午夜劫案。'); return false; }
  M.active = def; M.stepIdx = 0; M.timer = 0; M.data = {};
  if (id === 5) { G.timeH = 21.5; showToast('夜幕降临——午夜劫案开始。'); }
  showToast('任务开始：' + def.name + ' — ' + def.intro);
  AudioSys.pickup();
  enterStep(G);
  return true;
}
function enterStep(G) {
  const s = currentStep();
  if (!s) return;
  if (s.kind === 'deliver') {
    M.data.points = [];
    for (let i = 0; i < s.count; i++) M.data.points.push(randomRoadPoint());
    M.data.idx = 0;
    M.timer = s.time || 120;
  }
  if (s.kind === 'beat') {
    const hp = { x: roadCenter(7), y: roadCenter(1) }; // harbor road, clear of buildings
    spawnThugs(hp.x, hp.y, s.count);
    showToast('打手出现了，小心他们的拳头！');
  }
  if (s.kind === 'chase') {
    const p = randomRoadPoint();
    const car = makeCar(pick(CAR_TYPES), p.x, p.y, rand(0, Math.PI * 2));
    car.speed = 200; car.fleeing = true; car.health = 100; car.mission = true;
    M.data.chaseCar = car;
    trafficCars.push(car);
    showToast('目标车辆正在逃跑，撞停它！');
  }
  if (s.kind === 'robVan') {
    const van = makeCar(CAR_TYPES[3], roadCenter(6), roadCenter(7), 0);
    van.speed = 60; van.isVan = true; van.health = 200; van.bags = 0; van.dir = 0; van.mission = true;
    M.data.van = van;
    trafficCars.push(van);
    showToast('运钞车来了！把它撞停再靠近抢现金。');
  }
}
function advanceStep(G) {
  M.stepIdx++;
  if (M.stepIdx >= M.active.steps.length) { completeMission(G); return; }
  const s = currentStep();
  showToast('下一步：' + s.text);
  AudioSys.pickup();
  enterStep(G);
}
function completeMission(G) {
  const reward = 300 + M.active.id * 150;
  G.cash += reward;
  G.completed.push(M.active.id);
  showToast('任务完成：' + M.active.name + '，报酬 ' + fmtMoney(reward) + '！');
  AudioSys.missionDone();
  if (M.data.chaseCar) {
    const i = trafficCars.indexOf(M.data.chaseCar);
    if (i >= 0) trafficCars.splice(i, 1);
  }
  if (M.data.van) {
    const i = trafficCars.indexOf(M.data.van);
    if (i >= 0) trafficCars.splice(i, 1);
  }
  thugs = [];
  M.active = null; M.stepIdx = 0; M.data = {};
  saveGame(G);
}
function failMission(G, why) {
  showToast('任务失败：' + why);
  AudioSys.fail();
  if (M.data.chaseCar) {
    const i = trafficCars.indexOf(M.data.chaseCar);
    if (i >= 0) trafficCars.splice(i, 1);
  }
  if (M.data.van) {
    const i = trafficCars.indexOf(M.data.van);
    if (i >= 0) trafficCars.splice(i, 1);
  }
  thugs = [];
  M.active = null; M.stepIdx = 0; M.data = {};
}
function updateMission(dt, G) {
  if (!M.active) return;
  const s = currentStep();
  if (!s) return;
  const px = G.player.x, py = G.player.y;
  if (s.kind === 'stealCar' || s.kind === 'getInCar') {
    if (G.inCar) advanceStep(G);
  } else if (s.kind === 'goto') {
    const t = MISSION_SPOTS[s.at]();
    if (dist(px, py, t.x, t.y) < s.radius) advanceStep(G);
  } else if (s.kind === 'deliver') {
    M.timer -= dt;
    if (M.timer <= 0) { failMission(G, '送货超时了。'); return; }
    const t = M.data.points[M.data.idx];
    if (t && dist(px, py, t.x, t.y) < 60) {
      M.data.idx++;
      G.cash += 60;
      showToast('送达一单，+' + fmtMoney(60) + '。');
      AudioSys.cash();
      if (M.data.idx >= M.data.points.length) advanceStep(G);
      else showToast('下一单：开往地图标记点。');
    }
  } else if (s.kind === 'beat') {
    const left = thugs.filter(function (t) { return t.health > 0; }).length;
    if (left === 0) advanceStep(G);
  } else if (s.kind === 'chase') {
    const car = M.data.chaseCar;
    if (!car) { advanceStep(G); return; }
    // Fleeing car runs away from the player along roads.
    const away = angleTo(px, py, car.x, car.y);
    car.dir = turnToward(car.dir, away, dt * 2);
    if (car.x < 60 || car.x > WORLD - 60 || car.y < 60 || car.y > WORLD - 60) {
      car.dir = angleTo(car.x, car.y, WORLD / 2, WORLD / 2); // turn back into town
    }
    car.speed = lerp(car.speed, car.health > 40 ? 300 : 120, dt);
    const nx = car.x + Math.cos(car.dir) * car.speed * dt;
    const ny = car.y + Math.sin(car.dir) * car.speed * dt;
    if (!pointBlocked(nx, ny, 18)) { car.x = nx; car.y = ny; }
    car.angle = car.dir;
    // Ramming: player car close + fast = damage.
    if (G.inCar && G.car && dist(car.x, car.y, G.car.x, G.car.y) < 55 && Math.abs(G.car.speed) > 120) {
      car.health -= dt * 60;
      if (chance(dt * 3)) AudioSys.crash();
    }
    if (car.health <= 0) {
      showToast('目标车辆被撞停了！');
      advanceStep(G);
    }
  } else if (s.kind === 'robVan') {
    const van = M.data.van;
    if (!van) { advanceStep(G); return; }
    // Van cruises slowly until rammed to a stop; turns around at the city edge.
    if (van.health > 0) {
      if (van.x > WORLD - 60 || van.x < 60) van.dir = van.dir === 0 ? Math.PI : 0;
      van.speed = lerp(van.speed, 70, dt);
      const nx = van.x + Math.cos(van.dir) * van.speed * dt;
      const ny = van.y + Math.sin(van.dir) * van.speed * dt;
      if (!pointBlocked(nx, ny, 18)) { van.x = nx; van.y = ny; }
      if (G.inCar && G.car && dist(van.x, van.y, G.car.x, G.car.y) < 60 && Math.abs(G.car.speed) > 120) {
        van.health -= dt * 55;
        if (chance(dt * 3)) AudioSys.crash();
      }
    }
    if (van.health <= 0 && van.bags >= 3) advanceStep(G);
  }
}
// Called when the player presses E near the stopped van during the heist.
function tryRobVan(G) {
  const s = currentStep();
  if (!M.active || !s || s.kind !== 'robVan') return false;
  const van = M.data.van;
  if (!van || van.health > 0) return false;
  if (dist(G.player.x, G.player.y, van.x, van.y) > 70) return false;
  van.bags++;
  G.cash += 150;
  showToast('抢到现金袋 ' + van.bags + '/3，+' + fmtMoney(150) + '！');
  AudioSys.cash();
  if (van.bags === 1) addWanted(G, 3, '抢劫运钞车');
  return true;
}
// ---- side jobs ---------------------------------------------------------------
function startTaxi(G) {
  if (M.taxi.active || M.courier.active) { showToast('先完成手头的工作。'); return; }
  const p = randomSidewalkPoint(), d = randomRoadPoint();
  M.taxi = { active: true, stage: 'pickup', px: p.x, py: p.y, dx: d.x, dy: d.y, fare: randi(25, 60) };
  showToast('出租车工作：去接乘客（黄点）。');
}
function updateTaxi(dt, G) {
  if (!M.taxi.active) return;
  const px = G.player.x, py = G.player.y;
  if (M.taxi.stage === 'pickup') {
    if (dist(px, py, M.taxi.px, M.taxi.py) < 55 && G.inCar) {
      M.taxi.stage = 'dropoff';
      showToast('乘客上车了，送到目的地。');
      AudioSys.pickup();
    }
  } else if (dist(px, py, M.taxi.dx, M.taxi.dy) < 60) {
    G.cash += M.taxi.fare;
    showToast('送达！车费 +' + fmtMoney(M.taxi.fare) + '。');
    AudioSys.cash();
    M.taxi.active = false;
    saveGame(G);
  }
}
function startCourier(G) {
  if (M.taxi.active || M.courier.active) { showToast('先完成手头的工作。'); return; }
  const pts = [randomRoadPoint(), randomRoadPoint(), randomRoadPoint()];
  M.courier = { active: true, idx: 0, points: pts, delivered: 0 };
  showToast('快递工作：按顺序送 3 个包裹。');
}
function updateCourier(dt, G) {
  if (!M.courier.active) return;
  const t = M.courier.points[M.courier.idx];
  if (!t) return;
  if (dist(G.player.x, G.player.y, t.x, t.y) < 60) {
    M.courier.idx++; M.courier.delivered++;
    G.cash += 40;
    showToast('包裹送达 ' + M.courier.delivered + '/3，+' + fmtMoney(40) + '。');
    AudioSys.cash();
    if (M.courier.idx >= M.courier.points.length) {
      showToast('快递工作完成！');
      M.courier.active = false;
      saveGame(G);
    }
  }
}
