// city.js — Solmar city layout: 9x9 blocks over 9 named districts, roads, buildings,
// parks, harbor water, shops and the helipad plaza. Also owns collision vs buildings/water.
var BLOCK = 220, ROAD_W = 72, GRID_N = 9;
var WORLD = GRID_N * BLOCK + (GRID_N + 1) * ROAD_W; // 2700
var DISTRICTS = [
  // 3x3 district grid (columns west->east, rows north->south)
  { name: 'North Suburb', cn: '北郊住宅', kind: 'suburb' },
  { name: 'Downtown', cn: '市中心', kind: 'downtown' },
  { name: 'Harbor', cn: '海港码头', kind: 'harbor' },
  { name: 'Old Town', cn: '砖砌老城', kind: 'oldtown' },
  { name: 'Central Plaza', cn: '中央广场', kind: 'plaza' },
  { name: 'Lakeside Park', cn: '湖畔公园', kind: 'park' },
  { name: 'Market District', cn: '集市区', kind: 'market' },
  { name: 'Marina', cn: '游艇码头', kind: 'marina' },
  { name: 'University', cn: '大学城', kind: 'campus' }
];
function districtAt(bx, by) {
  const dx = clamp(Math.floor(bx / 3), 0, 2), dy = clamp(Math.floor(by / 3), 0, 2);
  return DISTRICTS[dy * 3 + dx];
}
function roadCenter(i) { return i * (BLOCK + ROAD_W) + ROAD_W / 2; }
function blockOrigin(i) { return ROAD_W + i * (BLOCK + ROAD_W); }
function isOnRoad(x, y) {
  const mx = x % (BLOCK + ROAD_W), my = y % (BLOCK + ROAD_W);
  return mx < ROAD_W || my < ROAD_W;
}
function randomRoadPoint() {
  if (chance(0.5)) return { x: roadCenter(randi(0, GRID_N)), y: rand(ROAD_W, WORLD - ROAD_W) };
  return { x: rand(ROAD_W, WORLD - ROAD_W), y: roadCenter(randi(0, GRID_N)) };
}
function randomSidewalkPoint() {
  const p = randomRoadPoint();
  return { x: clamp(p.x + rand(-1, 1) * (ROAD_W / 2 - 8), 8, WORLD - 8), y: clamp(p.y + rand(-1, 1) * (ROAD_W / 2 - 8), 8, WORLD - 8) };
}

var CITY = {
  buildings: [], trees: [], waters: [], lights: [], docks: [], boats: [],
  shops: [], helipad: null, hideout: null, spawn: null
};

function addBuilding(x, y, w, h, opt) {
  const b = { x, y, w, h, hgt: opt.hgt || 1, color: opt.color || '#7a6a58', roof: opt.roof || '#5a4c40',
    lit: !!opt.lit, kind: opt.kind || 'block', label: opt.label || '' };
  CITY.buildings.push(b);
  return b;
}

function buildCity() {
  CITY.buildings = []; CITY.trees = []; CITY.waters = []; CITY.lights = []; CITY.docks = []; CITY.boats = [];
  const downtownColors = ['#5d6b7a', '#6b5d7a', '#4e5a6b', '#7a6b5d'];
  const brickColors = ['#8a4a3a', '#7a3f30', '#96543f'];
  const houseColors = ['#c9a86a', '#a8b8c9', '#c9c9a8', '#b89a7a'];
  for (let bx = 0; bx < GRID_N; bx++) {
    for (let by = 0; by < GRID_N; by++) {
      const d = districtAt(bx, by);
      const x0 = blockOrigin(bx), y0 = blockOrigin(by);
      const R = hash2(bx, by);
      if (d.kind === 'downtown') {
        const w = 120 + R * 60, h = 120 + hash2(bx + 9, by) * 60;
        addBuilding(x0 + (BLOCK - w) / 2, y0 + (BLOCK - h) / 2, w, h,
          { hgt: 3 + Math.floor(R * 3), color: pick(downtownColors), lit: true, kind: 'tower' });
        if (chance(0.5)) addBuilding(x0 + 14, y0 + 14, 60, 46, { hgt: 1, color: '#6b6f75', kind: 'block' });
      } else if (d.kind === 'oldtown' || d.kind === 'market') {
        addBuilding(x0 + 16, y0 + 18, 84, 70, { hgt: 1, color: pick(brickColors), kind: 'brick' });
        addBuilding(x0 + BLOCK - 104, y0 + 30, 88, 64, { hgt: 1, color: pick(brickColors), kind: 'brick' });
        addBuilding(x0 + 60, y0 + BLOCK - 96, 96, 66, { hgt: 1, color: pick(brickColors), kind: 'brick' });
      } else if (d.kind === 'suburb' || d.kind === 'campus') {
        for (let i = 0; i < 4; i++) {
          const hx = x0 + 18 + (i % 2) * 104, hy = y0 + 18 + Math.floor(i / 2) * 104;
          addBuilding(hx, hy, 74, 62, { hgt: 1, color: pick(houseColors), kind: 'house', roof: '#8a4a3a' });
          CITY.trees.push({ x: hx + 88, y: hy + 10, r: 12 + R * 6 });
        }
      } else if (d.kind === 'park') {
        const lx = x0 + 30, ly = y0 + 30;
        CITY.waters.push({ x: lx + 20, y: ly + 10, w: 120, h: 90, kind: 'lake' });
        for (let i = 0; i < 10; i++) {
          CITY.trees.push({ x: x0 + 16 + hash2(bx * 7 + i, by) * (BLOCK - 32), y: y0 + 16 + hash2(bx, by * 7 + i) * (BLOCK - 32), r: 11 + hash2(i, bx) * 8 });
        }
      } else if (d.kind === 'harbor') {
        CITY.docks.push({ x: x0, y: y0 + BLOCK - 60, w: BLOCK, h: 60 });
        CITY.waters.push({ x: x0, y: y0 + BLOCK - 26, w: BLOCK, h: 26, kind: 'sea' });
        addBuilding(x0 + 16, y0 + 16, 90, 60, { hgt: 1, color: '#5a6a72', kind: 'warehouse' });
        addBuilding(x0 + 120, y0 + 20, 70, 52, { hgt: 1, color: '#6a5a4a', kind: 'warehouse' });
        for (let i = 0; i < 3; i++) CITY.boats.push({ x: x0 + 30 + i * 60, y: y0 + BLOCK - 18, len: 44 });
      } else if (d.kind === 'marina') {
        CITY.waters.push({ x: x0, y: y0 + BLOCK - 40, w: BLOCK, h: 40, kind: 'sea' });
        for (let i = 0; i < 4; i++) CITY.boats.push({ x: x0 + 24 + i * 48, y: y0 + BLOCK - 26, len: 34 });
        addBuilding(x0 + 20, y0 + 20, 80, 56, { hgt: 1, color: '#7a8a9a', kind: 'block' });
        CITY.trees.push({ x: x0 + 150, y: y0 + 40, r: 14 });
      } else if (d.kind === 'plaza') {
        const cx = x0 + BLOCK / 2, cy = y0 + BLOCK / 2;
        addBuilding(x0 + 20, y0 + 20, 70, 60, { hgt: 2, color: '#8a7a5a', kind: 'block', lit: true });
        addBuilding(x0 + BLOCK - 90, y0 + 20, 70, 60, { hgt: 2, color: '#7a8a7a', kind: 'block', lit: true });
        CITY.helipad = { x: cx, y: cy + 40, r: 42 };
        CITY.trees.push({ x: x0 + 30, y: y0 + BLOCK - 34, r: 13 });
        CITY.trees.push({ x: x0 + BLOCK - 30, y: y0 + BLOCK - 34, r: 13 });
      }
    }
  }
  // Streetlights at every intersection corner.
  for (let i = 0; i <= GRID_N; i++) for (let j = 0; j <= GRID_N; j++) {
    CITY.lights.push({ x: roadCenter(i) - ROAD_W / 2 + 6, y: roadCenter(j) - ROAD_W / 2 + 6 });
  }
  // Shops (road-side storefronts).
  CITY.shops = [
    { id: 'pitstop', name: 'PIT STOP', cn: '修车行', x: roadCenter(4) + 46, y: roadCenter(3), color: '#e8a33d', kind: 'pitstop' },
    { id: 'gunbarn', name: 'GUN BARN', cn: '枪店', x: roadCenter(2) - 46, y: roadCenter(4), color: '#c94f4f', kind: 'gunbarn' },
    { id: 'diner', name: 'DINER', cn: '餐馆', x: roadCenter(6) + 46, y: roadCenter(6), color: '#4fae7a', kind: 'diner' }
  ];
  CITY.hideout = { x: blockOrigin(0) + 55, y: blockOrigin(0) + 50 };
  CITY.spawn = { x: roadCenter(4), y: roadCenter(5) };
}

// Circle vs buildings/water: push the circle out. Returns corrected {x, y}.
function collideCircle(x, y, r) {
  for (const b of CITY.buildings) {
    const nx = clamp(x, b.x, b.x + b.w), ny = clamp(y, b.y, b.y + b.h);
    const d2 = dist2(x, y, nx, ny);
    if (d2 < r * r) {
      if (d2 > 0.01) {
        const d = Math.sqrt(d2);
        x = nx + (x - nx) / d * r; y = ny + (y - ny) / d * r;
      } else { x = b.x - r; }
    }
  }
  for (const w of CITY.waters) {
    const nx = clamp(x, w.x, w.x + w.w), ny = clamp(y, w.y, w.y + w.h);
    if (dist2(x, y, nx, ny) < r * r) {
      // Push out along the smallest penetration axis.
      const left = x - w.x, right = w.x + w.w - x, top = y - w.y, bot = w.y + w.h - y;
      const m = Math.min(left, right, top, bot);
      if (m === left) x = w.x - r; else if (m === right) x = w.x + w.w + r;
      else if (m === top) y = w.y - r; else y = w.y + w.h + r;
    }
  }
  return { x: clamp(x, r, WORLD - r), y: clamp(y, r, WORLD - r) };
}
function pointBlocked(x, y, r) {
  for (const b of CITY.buildings) {
    if (x > b.x - r && x < b.x + b.w + r && y > b.y - r && y < b.y + b.h + r) return true;
  }
  for (const w of CITY.waters) {
    if (x > w.x - r && x < w.x + w.w + r && y > w.y - r && y < w.y + w.h + r) return true;
  }
  return false;
}

// ---- drawing ---------------------------------------------------------------
function drawCity(ctx, cam, nightF, timeH) {
  const x0 = Math.max(0, cam.x - 40), y0 = Math.max(0, cam.y - 40);
  const x1 = Math.min(WORLD, cam.x + cam.w + 40), y1 = Math.min(WORLD, cam.y + cam.h + 40);
  // Ground: grass base.
  ctx.fillStyle = '#4a7a44';
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  // District ground tints.
  for (let bx = 0; bx < GRID_N; bx++) for (let by = 0; by < GRID_N; by++) {
    const d = districtAt(bx, by);
    const px = blockOrigin(bx), py = blockOrigin(by);
    if (px > x1 || py > y1 || px + BLOCK < x0 || py + BLOCK < y0) continue;
    let fill = null;
    if (d.kind === 'downtown') fill = '#5a5a62';
    else if (d.kind === 'park') fill = '#3f7a3a';
    else if (d.kind === 'plaza') fill = '#8a8578';
    else if (d.kind === 'harbor' || d.kind === 'marina') fill = '#6a6a62';
    else if (d.kind === 'oldtown' || d.kind === 'market') fill = '#7a6a58';
    if (fill) { ctx.fillStyle = fill; ctx.fillRect(px, py, BLOCK, BLOCK); }
    // District name painted on the ground, faint.
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(d.name.toUpperCase(), px + BLOCK / 2, py + BLOCK / 2 + 5);
  }
  // Roads.
  ctx.fillStyle = '#2e2e33';
  for (let i = 0; i <= GRID_N; i++) {
    ctx.fillRect(roadCenter(i) - ROAD_W / 2, 0, ROAD_W, WORLD);
    ctx.fillRect(0, roadCenter(i) - ROAD_W / 2, WORLD, ROAD_W);
  }
  // Sidewalk edges.
  ctx.strokeStyle = '#565660'; ctx.lineWidth = 3;
  for (let i = 0; i <= GRID_N; i++) {
    ctx.beginPath(); ctx.moveTo(roadCenter(i) - ROAD_W / 2, 0); ctx.lineTo(roadCenter(i) - ROAD_W / 2, WORLD); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(roadCenter(i) + ROAD_W / 2, 0); ctx.lineTo(roadCenter(i) + ROAD_W / 2, WORLD); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, roadCenter(i) - ROAD_W / 2); ctx.lineTo(WORLD, roadCenter(i) - ROAD_W / 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, roadCenter(i) + ROAD_W / 2); ctx.lineTo(WORLD, roadCenter(i) + ROAD_W / 2); ctx.stroke();
  }
  // Lane dashes.
  ctx.strokeStyle = '#c9b458'; ctx.lineWidth = 2; ctx.setLineDash([18, 22]);
  for (let i = 0; i <= GRID_N; i++) {
    ctx.beginPath(); ctx.moveTo(roadCenter(i), 0); ctx.lineTo(roadCenter(i), WORLD); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, roadCenter(i)); ctx.lineTo(WORLD, roadCenter(i)); ctx.stroke();
  }
  ctx.setLineDash([]);
  // Water.
  for (const w of CITY.waters) {
    ctx.fillStyle = w.kind === 'lake' ? '#3a7ab8' : '#2a5a8a';
    ctx.fillRect(w.x, w.y, w.w, w.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 2;
    for (let k = 1; k < 4; k++) {
      ctx.beginPath();
      ctx.moveTo(w.x + 8, w.y + w.h * k / 4);
      ctx.lineTo(w.x + w.w - 8, w.y + w.h * k / 4);
      ctx.stroke();
    }
  }
  // Docks.
  for (const d of CITY.docks) { ctx.fillStyle = '#8a7a5a'; ctx.fillRect(d.x, d.y, d.w, d.h); }
  // Boats.
  for (const b of CITY.boats) {
    ctx.fillStyle = '#e8e8e8';
    ctx.beginPath(); ctx.ellipse(b.x, b.y, b.len / 2, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#c94f4f'; ctx.fillRect(b.x - 4, b.y - 12, 8, 10);
  }
  // Helipad.
  if (CITY.helipad) {
    const hp = CITY.helipad;
    ctx.fillStyle = '#3a3a40';
    ctx.beginPath(); ctx.arc(hp.x, hp.y, hp.r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#e8c33d'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(hp.x, hp.y, hp.r - 6, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#e8c33d'; ctx.font = 'bold 34px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('H', hp.x, hp.y + 12);
  }
  // Buildings with lit windows at night.
  for (const b of CITY.buildings) {
    if (b.x > x1 || b.y > y1 || b.x + b.w < x0 || b.y + b.h < y0) continue;
    const shade = 1 - b.hgt * 0.05;
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    // Fake height: offset top edge.
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(b.x, b.y, b.w, 4 + b.hgt * 2);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 4, b.y + 4, b.w - 8, b.h - 8);
    // Windows.
    const cols = Math.max(2, Math.floor(b.w / 26)), rows = Math.max(2, Math.floor(b.h / 26));
    for (let cx = 0; cx < cols; cx++) for (let cy = 0; cy < rows; cy++) {
      const wx = b.x + 10 + cx * ((b.w - 20) / cols), wy = b.y + 10 + cy * ((b.h - 20) / rows);
      const litWin = b.lit && hash2(b.x + cx * 13, b.y + cy * 7) > 0.45;
      if (nightF > 0.25 && litWin) ctx.fillStyle = '#ffd66e';
      else if (litWin) ctx.fillStyle = '#ffe9a8';
      else ctx.fillStyle = 'rgba(20,28,40,0.55)';
      ctx.fillRect(wx, wy, 10, 12);
    }
    if (b.label) {
      ctx.fillStyle = '#fff'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2);
    }
  }
  // Trees.
  for (const t of CITY.trees) {
    if (t.x < x0 || t.x > x1 || t.y < y0 || t.y > y1) continue;
    ctx.fillStyle = '#2a5a2a';
    ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3f8a3a';
    ctx.beginPath(); ctx.arc(t.x - 3, t.y - 3, t.r * 0.7, 0, Math.PI * 2); ctx.fill();
  }
  // Hideout marker (small house flag).
  if (CITY.hideout) {
    ctx.fillStyle = '#e8c33d';
    ctx.beginPath(); ctx.arc(CITY.hideout.x, CITY.hideout.y, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#222'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('H', CITY.hideout.x, CITY.hideout.y + 4);
  }
  // Streetlights: poles, glow at night.
  for (const l of CITY.lights) {
    if (l.x < x0 || l.x > x1 || l.y < y0 || l.y > y1) continue;
    ctx.fillStyle = '#3a3a40'; ctx.fillRect(l.x - 2, l.y - 2, 4, 4);
    if (nightF > 0.2) {
      const g = ctx.createRadialGradient(l.x, l.y, 2, l.x, l.y, 46);
      g.addColorStop(0, 'rgba(255,220,130,' + (0.55 * nightF) + ')');
      g.addColorStop(1, 'rgba(255,220,130,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(l.x, l.y, 46, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffe9a8';
      ctx.beginPath(); ctx.arc(l.x, l.y, 4, 0, Math.PI * 2); ctx.fill();
    }
  }
}
