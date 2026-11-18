// Staged screenshot scenes: each one sets the real game into a lively
// state (a chase, a mission firefight, a fare on the street) and steps the
// simulation forward, so the frame is what the game really looks like.
// The page runs ?shot=cover|chase|mission|streets to stage one.
import { VIEW_W, VIEW_H, ZONES } from './config.js';
import { clamp, angleDiff, dist } from './random.js';
import { makeCar, makePed } from './entities.js';
import { startMission } from './missions.js';

const STEP = 1 / 60;

function fakeInput(world, drive, mouse) {
  return {
    moveAxis: () => ({ x: drive ? drive.x : 0, y: drive ? drive.y : 0 }),
    driveAxis: () => ({ throttle: drive ? drive.throttle : 0, steer: drive ? drive.steer : 0 }),
    down: () => false,
    pressed: () => false,
    mouse: mouse || { x: VIEW_W / 2, y: VIEW_H / 2, down: false, clicked: false, worldX: 0, worldY: 0 },
  };
}

// Steer a car toward (tx, ty): returns {throttle, steer}.
function driveToward(world, tx, ty) {
  const car = world.player.car;
  if (!car) return { throttle: 0, steer: 0 };
  const want = Math.atan2(ty - car.y, tx - car.x);
  const steer = clamp(angleDiff(car.angle, want) * 2.4, -1, 1);
  return { throttle: 1, steer };
}

// Aim the pistol at a world point, as screen coordinates.
function aimAt(world, wx, wy) {
  const cam = world.camera;
  return {
    x: (wx - cam.x) * cam.zoom + VIEW_W / 2,
    y: (wy - cam.y) * cam.zoom + VIEW_H / 2,
    down: true, clicked: false, worldX: wx, worldY: wy,
  };
}

function stepWorld(world, seconds, inputFn) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    world.step(STEP, inputFn());
  }
}

// One-time setup for a scene; the page keeps simulating after it.
export function stageShot(name, world) {
  world.screen = 'play';
  const p = world.player;
  if (name === 'cover') {
    // M1 in progress: the getaway car, cops behind, hideout ahead.
    startMission(world, 'm1');
    const car = world.cars.find((c) => c.id === world.mission.current.getawayId);
    world.teleport(ZONES.m1Car.x, ZONES.m1Car.y);
    if (car) world.enterCar(car);
    stepWorld(world, 2.5, () => fakeInput(world, driveToward(world, ZONES.m1Dest.x, ZONES.m1Dest.y)));
  } else if (name === 'chase') {
    // Three stars, three cruisers on the player's tail.
    const car = makeCar('sedan', 1400, 1200, -Math.PI / 2);
    car.driver = null;
    world.cars.push(car);
    world.teleport(1400, 1200);
    world.enterCar(car);
    world.setWanted(3);
    world.spawnPolice(3);
    stepWorld(world, 2, () => fakeInput(world, driveToward(world, 1400, 300)));
  } else if (name === 'mission') {
    // M3 mid-fight at Pier 9: five Vipers, muzzle flash, HUD counting kills.
    world.mission.done = { m1: true, m2: true };
    world.mission.next = 'm3';
    world.player.money = 1500;
    world.player.ammo = 120;
    world.player.mag = 12;
    startMission(world, 'm3');
    // Stand on road x=3000, 120px from the docks: close enough to trip
    // the ambush (280px) but on the road, clear of the containers.
    world.teleport(2980, ZONES.docks.y);
    stepWorld(world, 0.6, () => fakeInput(world, null));
    // Step the fight a moment with the pistol firing at the nearest Viper.
    stepWorld(world, 0.9, () => {
      const vipers = world.peds.filter((x) => x.pedKind === 'viper' && x.state !== 'down');
      if (vipers.length === 0) return fakeInput(world, null);
      let best = vipers[0];
      let bestD = Infinity;
      for (const v of vipers) {
        const d = dist(p.x, p.y, v.x, v.y);
        if (d < bestD) {
          bestD = d;
          best = v;
        }
      }
      return fakeInput(world, null, aimAt(world, best.x, best.y));
    });
  } else {
    // Streets: on foot by the hideout, a fare waiting, traffic passing.
    world.teleport(ZONES.mara.x + 120, ZONES.mara.y + 60);
    world.fare.state = 'waiting';
    world.fare.x = 560;
    world.fare.y = 1990;
    world.fare.dx = 2600;
    world.fare.dy = 400;
    world.fare.pay = 90;
    const farePed = makePed('fare', 560, 1990);
    world.fare.pedId = farePed.id;
    world.peds.push(farePed);
    stepWorld(world, 2, () => fakeInput(world, null));
  }
  return 'play';
}

// The per-frame input that keeps a staged scene alive while the page runs.
export function shotInput(name, world) {
  const p = world.player;
  if (name === 'cover') {
    return fakeInput(world, driveToward(world, ZONES.m1Dest.x, ZONES.m1Dest.y));
  }
  if (name === 'chase') {
    return fakeInput(world, driveToward(world, 1400, 300));
  }
  if (name === 'mission') {
    const vipers = world.peds.filter((x) => x.pedKind === 'viper' && x.state !== 'down');
    if (vipers.length > 0) {
      let best = vipers[0];
      let bestD = Infinity;
      for (const v of vipers) {
        const d = dist(p.x, p.y, v.x, v.y);
        if (d < bestD) {
          bestD = d;
          best = v;
        }
      }
      return fakeInput(world, null, aimAt(world, best.x, best.y));
    }
    return fakeInput(world, null);
  }
  return fakeInput(world, null);
}
