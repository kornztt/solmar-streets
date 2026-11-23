// people.js — pedestrians (8 looks) who stroll the sidewalks and flee from trouble,
// plus hostile thugs for the Dockside mission. Police on foot appear when wanted
// is high and the player is on foot.
var PED_TYPES = [
  { name: 'Commuter', shirt: '#3a6fd6', pants: '#2c3e50', skin: '#e8b88a' },
  { name: 'Tourist', shirt: '#e8a33d', pants: '#7a8a9a', skin: '#c98a5a' },
  { name: 'Jogger', shirt: '#27ae60', pants: '#222', skin: '#e8b88a' },
  { name: 'Student', shirt: '#8e44ad', pants: '#3a3a4a', skin: '#f0c8a0' },
  { name: 'Worker', shirt: '#e67e22', pants: '#4a4a4a', skin: '#b87a4a' },
  { name: 'Elder', shirt: '#7f8c8d', pants: '#5a5a5a', skin: '#e8c8a8' },
  { name: 'Business', shirt: '#ecf0f1', pants: '#1a1a1a', skin: '#d89a6a' },
  { name: 'Skater', shirt: '#c2185b', pants: '#2980b9', skin: '#e8b88a' }
];
var pedestrians = [];
var thugs = [];
var footCops = [];

function spawnPedestrians(count) {
  pedestrians = [];
  for (let i = 0; i < count; i++) {
    const p = randomSidewalkPoint();
    pedestrians.push(makePed(p.x, p.y));
  }
}
function makePed(x, y) {
  const t = pick(PED_TYPES);
  return {
    type: t, x: x, y: y, angle: rand(0, Math.PI * 2),
    speed: rand(28, 52), walkPhase: rand(0, 6), fleeing: false,
    fear: 0, targetAngle: rand(0, Math.PI * 2), retarget: rand(1, 4), health: 30
  };
}
function scarePeds(x, y, radius) {
  for (const p of pedestrians) {
    if (dist2(p.x, p.y, x, y) < radius * radius) {
      p.fleeing = true; p.fear = 3;
      p.targetAngle = angleTo(x, y, p.x, p.y);
    }
  }
  for (const t of thugs) {
    if (dist2(t.x, t.y, x, y) < radius * radius) t.alerted = true;
  }
}
function updatePedestrians(dt, px, py, playerCar) {
  for (const p of pedestrians) {
    p.retarget -= dt;
    if (p.fleeing) {
      p.fear -= dt;
      if (p.fear <= 0) p.fleeing = false;
    }
    // A car bearing down scares them off the road.
    if (playerCar && dist2(p.x, p.y, playerCar.x, playerCar.y) < 70 * 70 && Math.abs(playerCar.speed) > 60) {
      p.fleeing = true; p.fear = 2;
      p.targetAngle = angleTo(playerCar.x, playerCar.y, p.x, p.y);
    }
    if (p.retarget <= 0) {
      p.retarget = rand(2, 6);
      p.targetAngle = p.fleeing ? angleTo(px, py, p.x, p.y) : rand(0, Math.PI * 2);
    }
    p.angle = turnToward(p.angle, p.targetAngle, dt * 3);
    const sp = p.fleeing ? p.speed * 2.6 : p.speed;
    const nx = p.x + Math.cos(p.angle) * sp * dt;
    const ny = p.y + Math.sin(p.angle) * sp * dt;
    if (!pointBlocked(nx, ny, 8)) { p.x = nx; p.y = ny; }
    else p.targetAngle += Math.PI / 2;
    p.x = clamp(p.x, 10, WORLD - 10); p.y = clamp(p.y, 10, WORLD - 10);
    p.walkPhase += dt * (p.fleeing ? 14 : 7);
  }
}
function spawnThugs(x, y, n) {
  thugs = [];
  for (let i = 0; i < n; i++) {
    thugs.push({
      x: x + rand(-50, 50), y: y + rand(-50, 50), angle: rand(0, Math.PI * 2),
      speed: 55, health: 40, alerted: false, attackCd: 0, walkPhase: rand(0, 6),
      type: { name: 'Thug', shirt: '#222', pants: '#333', skin: '#c98a5a' }
    });
  }
}
function updateThugs(dt, px, py) {
  for (const t of thugs) {
    if (t.health <= 0) continue;
    t.attackCd -= dt;
    if (t.alerted) {
      const d = dist(t.x, t.y, px, py);
      if (d > 26) {
        t.angle = turnToward(t.angle, angleTo(t.x, t.y, px, py), dt * 4);
        const nx = t.x + Math.cos(t.angle) * t.speed * dt;
        const ny = t.y + Math.sin(t.angle) * t.speed * dt;
        if (!pointBlocked(nx, ny, 8)) { t.x = nx; t.y = ny; }
      } else if (t.attackCd <= 0) {
        t.attackCd = 0.9;
        return { hit: true, dmg: 6 }; // signal: thug landed a punch on the player
      }
      t.walkPhase += dt * 10;
    }
  }
  return null;
}
function spawnFootCops(x, y, n) {
  footCops = [];
  for (let i = 0; i < n; i++) {
    footCops.push({
      x: x + rand(-80, 80), y: y + rand(-80, 80), angle: 0,
      speed: 95, health: 50, attackCd: 0, walkPhase: rand(0, 6),
      type: { name: 'Cop', shirt: '#1a3a6a', pants: '#1a1a1a', skin: '#e8b88a' }
    });
  }
}
function updateFootCops(dt, px, py) {
  let hit = null;
  for (const c of footCops) {
    if (c.health <= 0) continue;
    c.attackCd -= dt;
    const d = dist(c.x, c.y, px, py);
    if (d > 24) {
      c.angle = turnToward(c.angle, angleTo(c.x, c.y, px, py), dt * 4);
      const nx = c.x + Math.cos(c.angle) * c.speed * dt;
      const ny = c.y + Math.sin(c.angle) * c.speed * dt;
      if (!pointBlocked(nx, ny, 8)) { c.x = nx; c.y = ny; }
    } else if (c.attackCd <= 0) {
      c.attackCd = 1.0;
      hit = { hit: true, dmg: 8 };
    }
    c.walkPhase += dt * 11;
  }
  return hit;
}
function drawPerson(ctx, p, isThug) {
  ctx.save();
  ctx.translate(p.x, p.y);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(0, 4, 9, 5, 0, 0, Math.PI * 2); ctx.fill();
  const bob = Math.sin(p.walkPhase) * 1.5;
  ctx.rotate(p.angle);
  // Legs.
  ctx.fillStyle = p.type.pants;
  ctx.fillRect(-5, -5 + bob, 10, 4);
  ctx.fillRect(-5, 1 - bob, 10, 4);
  // Body.
  ctx.fillStyle = p.type.shirt;
  roundRect(ctx, -7, -7, 14, 14, 4);
  ctx.fill();
  // Head.
  ctx.fillStyle = p.type.skin;
  ctx.beginPath(); ctx.arc(8, 0, 5, 0, Math.PI * 2); ctx.fill();
  // Direction tick.
  ctx.fillStyle = '#222';
  ctx.fillRect(9, -2, 4, 4);
  if (isThug) {
    ctx.strokeStyle = '#ff3b30'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}
function drawPeople(ctx) {
  for (const p of pedestrians) drawPerson(ctx, p, false);
  for (const t of thugs) if (t.health > 0) drawPerson(ctx, t, true);
  for (const c of footCops) if (c.health > 0) drawPerson(ctx, c, false);
}
