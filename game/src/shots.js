// SOLMAR STREETS — deterministic staged scenes for screenshots.
// ?shot=title|drive|chase|mission|streets (with &seed=N) stages that scene
// instead of running the loop, paints it twice and sets window.__shotReady.
// Each scene is composed for the camera: the zoom is set per shot so the
// action fills the frame, and the HUD tells the story at a glance.

import { PLACES } from './config.js';
import { createCar, createPed } from './entities.js';
import { spawnPolice, startRun } from './world.js';

function givePlayerCar(world, model, x, y, angle) {
  const car = createCar(model, x, y, angle, 'player', world.rng);
  car.speed = 240;
  world.cars.push(car);
  world.player.car = car;
  world.player.x = x;
  world.player.y = y;
  world.player.angle = angle;
  world.camera.x = x;
  world.camera.y = y;
  return car;
}

function parkTrafficNear(world, cx, cy, count) {
  let placed = 0;
  for (const car of world.cars) {
    if (placed >= count) break;
    if (car.driver !== 'traffic') continue;
    const a = world.rng.range(0, Math.PI * 2);
    const d = world.rng.range(120, 420);
    car.x = cx + Math.cos(a) * d;
    car.y = cy + Math.sin(a) * d;
    car.axis = world.rng.chance(0.5) ? 'v' : 'h';
    car.road = car.axis === 'v' ? Math.round(car.x / 100) * 100 : Math.round(car.y / 100) * 100;
    car.angle = car.axis === 'v' ? Math.PI / 2 : 0;
    car.speed = car.cruise;
    placed += 1;
  }
}

/** Stage one named scene on a fresh run. Returns the screen to show. */
export function stageShot(name, world) {
  // A fresh run, then the scene is arranged on top of it. The run's own
  // welcome toast does not belong in a staged shot.
  startRun(world, null);
  world.toasts = [];
  world.screen = 'play';
  world.player.money = 1240;
  // ?zoom=1.2 reframes any shot without touching the scene itself — useful
  // when a cover wants the action tighter or the street wider.
  const zoomParam = Number.parseFloat(new URLSearchParams(window.location.search).get('zoom') ?? '');
  const zoomOverride = Number.isFinite(zoomParam) && zoomParam >= 0.5 && zoomParam <= 2 ? zoomParam : null;

  if (name === 'title') {
    world.screen = 'title';
    return { screen: 'title' };
  }

  if (name === 'drive') {
    // Downtown, behind the wheel of the Comet GT, traffic all around, the
    // getaway job live on the HUD with its timer and marker — and a cab
    // with a waving fare in the frame, so the side job reads too.
    givePlayerCar(world, 'comet', 1500, 1180, -Math.PI / 2);
    parkTrafficNear(world, 1500, 1180, 8);
    // One sedan right beside the player, close enough to read as a
    // near-miss: the cover should feel fast, not parked.
    const nearMiss = createCar('sedan', 1470, 1330, -Math.PI / 2, 'traffic', world.rng);
    nearMiss.speed = nearMiss.cruise;
    world.cars.push(nearMiss);
    const fare = createPed(1620, 1240, world.rng, 'fare');
    fare.shirt = '#e8c84a';
    world.peds.push(fare);
    world.fare.fare = { state: 'wait', ped: fare, dest: { x: 1900, y: 700 }, timer: 0, reward: 65 };
    world.mission.current = { id: 'm1', step: 2, timer: 78, killed: 0, total: 5 };
    world.wanted = 0;
    world.camera.zoom = 0.95;
    world.toasts.push({ text: 'The SPPD is on you — lose them!', t: 0 });
    return { screen: 'play' };
  }

  if (name === 'chase') {
    // Three stars, three cruisers on the player's tail, sirens in the air.
    givePlayerCar(world, 'sedan', 1500, 1560, -Math.PI / 2);
    world.player.car.color = '#2e6fb0';
    world.wanted = 3;
    world.crimeTimer = 15;
    spawnPolice(world, 3);
    const spots = [
      { x: 1500, y: 1740, a: -Math.PI / 2 },
      { x: 1462, y: 1700, a: -Math.PI / 2 },
      { x: 1540, y: 1800, a: -Math.PI / 2 },
    ];
    world.police.forEach((cop, i) => {
      const s = spots[i % spots.length];
      cop.x = s.x;
      cop.y = s.y;
      cop.angle = s.a;
      cop.speed = 380;
      cop.flash = i * 0.5;
    });
    parkTrafficNear(world, 1500, 1500, 5);
    world.mission.current = { id: 'm1', step: 2, timer: 61, killed: 0, total: 5 };
    world.camera.zoom = 0.9;
    return { screen: 'play' };
  }

  if (name === 'mission') {
    // On foot at Pier 9, pistol out, the whole Viper crew in front of the
    // player — two already down, a muzzle flash in the air, three left.
    world.player.x = 3340;
    world.player.y = 900;
    world.player.angle = 0.3;
    world.player.mag = 9;
    world.camera.x = 3380;
    world.camera.y = 900;
    world.camera.zoom = 1.1;
    world.mission.current = { id: 'm3', step: 1, timer: 0, killed: 2, total: 5 };
    const spots = [
      { x: 3420, y: 860, a: Math.PI, down: false },
      { x: 3460, y: 920, a: Math.PI * 0.9, down: true },
      { x: 3400, y: 960, a: Math.PI * 1.1, down: false },
      { x: 3480, y: 880, a: Math.PI, down: false },
      { x: 3440, y: 1000, a: Math.PI * 0.8, down: true },
    ];
    for (const s of spots) {
      const v = createPed(s.x, s.y, world.rng, 'viper');
      v.shirt = '#7d2b2b';
      v.angle = s.a;
      if (s.down) { v.state = 'down'; v.hp = 0; }
      world.peds.push(v);
    }
    world.bullets.push({
      kind: 'bullet', x: 3380, y: 905, vx: 700, vy: 60, life: 0.5, from: 'player', dmg: 34,
    });
    world.particles.push({
      kind: 'particle', x: 3362, y: 903, vx: 40, vy: -20, life: 0.3, maxLife: 0.3, color: '#ffd23f', size: 7,
    });
    world.toasts.push({ text: 'Viper down (2/5)', t: 0 });
    return { screen: 'play' };
  }

  // 'streets': on foot in Old Town, pedestrians, a fare waiting, a Falcon S
  // parked at the kerb, Mara's marker on the map — the city at street level.
  world.player.x = 1150;
  world.player.y = 1560;
  world.player.angle = -Math.PI / 2;
  world.camera.x = 1150;
  world.camera.y = 1560;
  world.camera.zoom = 1.05;
  for (let i = 0; i < 6; i += 1) {
    const ped = createPed(1150 + world.rng.range(-160, 160), 1560 + world.rng.range(-120, 120), world.rng, 'walk');
    world.peds.push(ped);
  }
  const fare = createPed(1230, 1620, world.rng, 'fare');
  fare.shirt = '#e8c84a';
  world.peds.push(fare);
  world.fare.fare = { state: 'wait', ped: fare, dest: { x: 1900, y: 700 }, timer: 0, reward: 65 };
  const falcon = createCar('falcon', 1080, 1620, 0, 'parked', world.rng);
  world.cars.push(falcon);
  // A box van at the next kerb, so the street reads as lived-in, not empty.
  const van = createCar('van', 1300, 1500, Math.PI / 2, 'parked', world.rng);
  world.cars.push(van);
  world.mission.next = 'm1';
  if (zoomOverride) world.camera.zoom = zoomOverride;
  return { screen: 'play' };
}
