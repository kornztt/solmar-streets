// Deterministic scene staging for screenshots (?shot=cover|chase|mission|streets).
import { CFG } from './config.js';
import { RNG, clamp } from './random.js';
import { landmarkPos, nearestRoadPoint } from './city.js';
import { makeCar } from './entities.js';

export function applyShot(G, city, name) {
  G.shotName = name;
  if (name === 'cover') {
    G.clock = 10 * 60;
    const h = landmarkPos('hideout');
    const rp = nearestRoadPoint(h.x + 160, h.y);
    const car = makeCar(rp.x, rp.y, 0, 1, '#e33f2f', 'player');
    G.cars.push(car);
    G.player.car = car;
    G.player.onFoot = false;
    G.player.x = car.x;
    G.player.y = car.y;
    G.player.angle = 0;
  } else if (name === 'chase') {
    G.clock = 23 * 60;
    G.heat = 55;
    G.wanted = 3;
    const ps = landmarkPos('pitstop');
    const rp = nearestRoadPoint(ps.x, ps.y - 120);
    const car = makeCar(rp.x, rp.y, Math.PI / 2, 1, '#f2b705', 'player');
    car.speed = 260;
    G.cars.push(car);
    G.player.car = car;
    G.player.onFoot = false;
    G.player.x = car.x;
    G.player.y = car.y;
    G.player.angle = Math.PI / 2;
    for (let i = 0; i < 2; i++) {
      const pc = makeCar(rp.x - 40 - i * 70, rp.y - 90, Math.PI / 2, 0, '#1c2733', 'police');
      pc.speed = 250;
      G.cops.push({ kind: 'car', x: pc.x, y: pc.y, angle: Math.PI / 2, speed: 250, car: pc, bustT: 0 });
    }
  } else if (name === 'mission') {
    G.clock = 18 * 60 + 30;
    const pier = landmarkPos('pier');
    G.player.x = pier.x - 150;
    G.player.y = pier.y + 60;
    G.player.onFoot = true;
    G.player.car = null;
    G.player.angle = 0;
    G.mission.id = 2;
    G.mission.stage = 1;
    G.mission.target = pier;
    const r2 = new RNG(G.seed * 31 + 7);
    for (let i = 0; i < 5; i++) {
      G.mission.breakers.push({ x: pier.x + r2.range(-110, 110), y: pier.y + r2.range(-110, 110), hp: 100, shootT: r2.range(0.5, 2), angle: 0 });
    }
  } else if (name === 'streets') {
    G.clock = 10 * 60;
    const gb = landmarkPos('gunbarn');
    G.player.x = gb.x + 120;
    G.player.y = gb.y + 40;
    G.player.onFoot = true;
    G.player.car = null;
    G.player.angle = -Math.PI / 2;
    const rp = nearestRoadPoint(gb.x, gb.y - 140);
    const taxi = makeCar(rp.x, rp.y, 0, 5, '#f2b705', 'traffic');
    taxi.wp = nearestRoadPoint(rp.x + 400, rp.y);
    G.cars.push(taxi);
  }
  G.camera.x = clamp(G.player.x - CFG.viewW / 2, 0, CFG.world - CFG.viewW);
  G.camera.y = clamp(G.player.y - CFG.viewH / 2, 0, CFG.world - CFG.viewH);
}
