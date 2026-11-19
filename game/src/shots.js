// Screenshot staging: ?shot=<scene>&seed=<n>&time=<hour>
// The game boots straight into a staged scene so its own screenshots are
// real renders of live play — a chase, a mission, the streets at dusk —
// never a menu or a placeholder. The query is read once at boot.

import { roadCenter } from './city.js';

export function readShotQuery() {
  const q = new URLSearchParams(window.location.search);
  const shot = q.get('shot');
  if (!shot) return null;
  return {
    shot,
    seed: parseInt(q.get('seed') || '11', 10),
    time: parseFloat(q.get('time') || '13'),
  };
}

// Place the world into the named scene. Runs after the world is built and
// the game has started, before the first rendered frame.
export function stageShot(world, spec) {
  const { entities, city, missions } = world;
  const p = entities.player;
  const rng = entities.rng;
  world.hour = spec.time;
  world.state = 'playing';

  if (spec.shot === 'cover') {
    // M1 in progress: the player, on foot by the hideout, the runner's
    // marker glowing down the street, morning light.
    world.hour = 9;
    p.x = city.sites.hideout.x;
    p.y = city.sites.hideout.y + 110;
    missions.start('m1');
  } else if (spec.shot === 'chase') {
    // Mid-chase at noon, mid-city so the camera is all streets: the player
    // in a fast car on a long straight, heading east, two units behind.
    const roadY = roadCenter(4);
    const startX = roadCenter(2);
    let car = entities.cars.find((c) => c.kind === 'parked' && c.model.kind === 'sport')
      || entities.cars.find((c) => c.kind === 'parked');
    car.kind = 'player';
    car.driver = 'player';
    car.x = startX;
    car.y = roadY;
    car.angle = 0;
    car.speed = 640;
    p.inCar = car;
    p.onFoot = false;
    p.x = car.x;
    p.y = car.y;
    p.angle = 0;
    world.setWanted(3);
    const u1 = entities.spawnPolice(startX - 240, roadY + 10);
    const u2 = entities.spawnPolice(startX - 430, roadY - 10);
    u1.angle = 0;
    u2.angle = 0;
    world.hour = 13;
  } else if (spec.shot === 'mission') {
    // M3 at the pier at dusk: rivals on the dock, pistol out.
    world.hour = 18;
    p.x = city.sites.pier.x - 260;
    p.y = city.sites.pier.y + 40;
    p.ammo = 60;
    missions.start('m3');
  } else if (spec.shot === 'streets') {
    // Dusk on the boulevard: traffic, peds, the taxi cruising past.
    world.hour = 18.5;
    p.x = city.sites.taxiStand.x + 40;
    p.y = city.sites.taxiStand.y + 60;
    const car = entities.cars.find((c) => c.kind === 'traffic' && c.isTaxi);
    if (car) {
      car.x = p.x + 130;
      car.y = p.y - 20;
      car.angle = 0;
      car.speed = 200;
    }
  }
  // Let the world settle for a moment so the first frame is alive.
  world.settle(0.4);
}
