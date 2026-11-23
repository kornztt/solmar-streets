// vehicles.js — the six stealable car types, 12 paint colors, traffic that cruises
// the road grid, and police interceptors. Cars are drawn top-down with headlights.
var CAR_TYPES = [
  { id: 'sedan', name: 'Sedan', len: 46, wid: 22, speed: 300, accel: 220 },
  { id: 'taxi', name: 'Taxi', len: 46, wid: 22, speed: 310, accel: 230 },
  { id: 'sports', name: 'Sports', len: 48, wid: 22, speed: 430, accel: 330 },
  { id: 'van', name: 'Van', len: 54, wid: 24, speed: 260, accel: 180 },
  { id: 'truck', name: 'Truck', len: 62, wid: 26, speed: 240, accel: 160 },
  { id: 'muscle', name: 'Muscle', len: 50, wid: 24, speed: 380, accel: 290 }
];
var CAR_COLORS = ['#c0392b', '#2980b9', '#27ae60', '#f1c40f', '#8e44ad', '#e67e22',
  '#ecf0f1', '#2c3e50', '#16a085', '#d35400', '#7f8c8d', '#c2185b'];
var trafficCars = [];
var policeCars = [];

function makeCar(type, x, y, angle, color) {
  return {
    type: type, x: x, y: y, angle: angle, speed: 0,
    color: color || pick(CAR_COLORS), health: 100,
    // traffic AI
    dir: angle, cruise: rand(90, 150), turnAt: 0, stuck: 0,
    isPolice: type.id === 'police', sirenPhase: Math.random() * 10
  };
}
function makePoliceCar(x, y) {
  const c = makeCar({ id: 'police', name: 'Interceptor', len: 48, wid: 23, speed: 400, accel: 320 }, x, y, 0, '#1a1a1a');
  c.isPolice = true;
  return c;
}
function spawnTraffic(count) {
  trafficCars = [];
  for (let i = 0; i < count; i++) {
    const p = randomRoadPoint();
    const type = pick(CAR_TYPES);
    const angle = chance(0.5) ? 0 : Math.PI / 2;
    const c = makeCar(type, p.x, p.y, angle, type.id === 'taxi' ? '#f1c40f' : undefined);
    c.speed = c.cruise;
    trafficCars.push(c);
  }
}
function nearestTrafficCar(x, y, maxD) {
  let best = null, bd = maxD * maxD;
  for (const c of trafficCars) {
    if (c.mission) continue; // mission cars (chase target, armored van) can't be stolen
    const d2 = dist2(x, y, c.x, c.y);
    if (d2 < bd) { bd = d2; best = c; }
  }
  return best;
}
// Traffic: drive along the road center line, turn at intersections, avoid buildings.
function updateTraffic(dt, playerX, playerY) {
  for (const c of trafficCars) {
    if (c.mission) continue; // mission cars are driven by missions.js, not traffic AI
    // At an intersection center, sometimes turn.
    const onH = Math.abs(c.y - roadCenter(Math.round((c.y - ROAD_W / 2) / (BLOCK + ROAD_W)))) < 6;
    const onV = Math.abs(c.x - roadCenter(Math.round((c.x - ROAD_W / 2) / (BLOCK + ROAD_W)))) < 6;
    if (onH && onV && chance(dt * 0.9)) {
      c.dir += pick([-Math.PI / 2, Math.PI / 2]);
    }
    // Keep to the nearest road center line: steer gently toward it.
    let targetAngle = c.dir;
    if (Math.abs(Math.sin(c.dir)) < 0.5) { // moving east/west: snap y to road center
      const rc = roadCenter(Math.round((c.y - ROAD_W / 2) / (BLOCK + ROAD_W)));
      targetAngle = Math.atan2((rc - c.y) * 0.06, Math.cos(c.dir));
    } else {
      const rc = roadCenter(Math.round((c.x - ROAD_W / 2) / (BLOCK + ROAD_W)));
      targetAngle = Math.atan2(Math.sin(c.dir), (rc - c.x) * 0.06);
    }
    c.dir = turnToward(c.dir, targetAngle, dt * 1.6);
    // Slow near the player to avoid piling up.
    const pd = dist(c.x, c.y, playerX, playerY);
    const want = pd < 90 ? c.cruise * 0.3 : c.cruise;
    c.speed = lerp(c.speed, want, dt * 2);
    const nx = c.x + Math.cos(c.dir) * c.speed * dt;
    const ny = c.y + Math.sin(c.dir) * c.speed * dt;
    if (!pointBlocked(nx, ny, 16)) { c.x = nx; c.y = ny; }
    else { c.dir += Math.PI / 2; }
    c.angle = c.dir;
    // Wrap around the city edge instead of driving off the map.
    if (c.x < 20 || c.x > WORLD - 20 || c.y < 20 || c.y > WORLD - 20) {
      const p = randomRoadPoint();
      c.x = p.x; c.y = p.y; c.dir = chance(0.5) ? 0 : Math.PI / 2;
    }
  }
}
// Police: steer toward the player, ram speed, give up and despawn when far and calm.
function updatePolice(dt, px, py, wanted) {
  for (const p of policeCars) {
    const target = angleTo(p.x, p.y, px, py);
    p.angle = turnToward(p.angle, target, dt * 4.2);
    const want = 380 + wanted * 12;
    p.speed = lerp(p.speed, want, dt * 1.5);
    const nx = p.x + Math.cos(p.angle) * p.speed * dt;
    const ny = p.y + Math.sin(p.angle) * p.speed * dt;
    const fixed = collideCircle(nx, ny, 18);
    p.x = fixed.x; p.y = fixed.y;
    p.sirenPhase += dt;
  }
}
function drawCarShape(ctx, c, nightF) {
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(c.angle);
  const L = c.type.len, W = c.type.wid;
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(-L / 2 + 3, -W / 2 + 3, L, W);
  // Body.
  ctx.fillStyle = c.color;
  roundRect(ctx, -L / 2, -W / 2, L, W, 7);
  ctx.fill();
  // Cabin / windshield.
  ctx.fillStyle = c.isPolice ? '#dfe9f2' : 'rgba(20,30,44,0.85)';
  roundRect(ctx, -L * 0.18, -W / 2 + 3, L * 0.34, W - 6, 4);
  ctx.fill();
  // Police livery.
  if (c.isPolice) {
    ctx.fillStyle = '#fff';
    ctx.fillRect(-L / 2 + 2, -W / 2 + 2, L - 4, 5);
    ctx.fillStyle = '#2a6fd6';
    ctx.fillRect(-L * 0.1, -W / 2, 8, W);
    // Light bar, flashing.
    const on = Math.floor(c.sirenPhase * 4) % 2 === 0;
    ctx.fillStyle = on ? '#ff2a2a' : '#2a6bff';
    ctx.fillRect(-4, -W / 2 - 1, 8, 5);
    ctx.fillStyle = on ? '#2a6bff' : '#ff2a2a';
    ctx.fillRect(-4, W / 2 - 4, 8, 5);
  }
  // Taxi sign.
  if (c.type.id === 'taxi') {
    ctx.fillStyle = '#222';
    ctx.fillRect(-6, -W / 2 - 3, 12, 5);
    ctx.fillStyle = '#f1c40f';
    ctx.font = 'bold 6px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('TAXI', 0, -W / 2 + 1);
  }
  // Headlights + taillights.
  ctx.fillStyle = '#fff7c0';
  ctx.fillRect(L / 2 - 2, -W / 2 + 2, 3, 5);
  ctx.fillRect(L / 2 - 2, W / 2 - 7, 3, 5);
  ctx.fillStyle = '#ff3b30';
  ctx.fillRect(-L / 2 - 1, -W / 2 + 2, 3, 5);
  ctx.fillRect(-L / 2 - 1, W / 2 - 7, 3, 5);
  ctx.restore();
  // Headlight cones at night.
  if (nightF > 0.25 && c.speed > 5) {
    const fx = c.x + Math.cos(c.angle) * (c.type.len / 2);
    const fy = c.y + Math.sin(c.angle) * (c.type.len / 2);
    ctx.save();
    ctx.translate(fx, fy);
    ctx.rotate(c.angle);
    const g = ctx.createLinearGradient(0, 0, 190, 0);
    g.addColorStop(0, 'rgba(255,244,180,' + (0.30 * nightF) + ')');
    g.addColorStop(1, 'rgba(255,244,180,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, -6); ctx.lineTo(190, -46); ctx.lineTo(190, 46); ctx.lineTo(0, 6);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
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
