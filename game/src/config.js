// SOLMAR STREETS — tuning and constants. All gameplay numbers live here.
export const CFG = {
  world: 3200, // world is world x world pixels
  roadPitch: 400, // distance between road centrelines
  roadWidth: 120,
  roadFirst: 200, // first road centreline
  roadCount: 8, // centrelines at 200, 600, ... 3000
  blockClear: 30, // buildings keep this clear lane from every road edge
  startMoney: 500,
  startAmmo: 24,
  maxHp: 100,
  walkSpeed: 240,
  // car models: name, top speed px/s, accel, handling (turn rad/s), hp, size
  carModels: [
    { name: 'Sedan', top: 480, accel: 320, turn: 2.6, hp: 100, w: 46, l: 84 },
    { name: 'Coupe', top: 520, accel: 360, turn: 2.9, hp: 90, w: 44, l: 80 },
    { name: 'Van', top: 400, accel: 260, turn: 2.2, hp: 140, w: 50, l: 96 },
    { name: 'Taxi', top: 460, accel: 330, turn: 2.7, hp: 100, w: 46, l: 84 },
    { name: 'Truck', top: 380, accel: 230, turn: 2.0, hp: 160, w: 54, l: 110 },
    { name: 'Sports', top: 570, accel: 420, turn: 3.2, hp: 80, w: 44, l: 82 },
  ],
  carColours: [
    '#d33', '#e80', '#fc0', '#3a3', '#06c', '#63c',
    '#eee', '#222', '#c46', '#0aa', '#f6c', '#888',
  ],
  punchDamage: 15,
  bulletDamage: 10,
  bulletSpeed: 900,
  bulletRange: 700,
  gunshotHeard: 420, // peds flee within this radius of a shot
  wantedDecaySecs: 15, // lose a star after this long unseen by police
  policeCarSpeed: 500,
  officerSpeed: 200,
  bustedHoldSecs: 1.5,
  // mission rewards
  reward: { m1: 950, m2: 800, m3: 1500, m4: 1200, m5: 2000 },
  taxiBase: 80,
  courierDrop: 120,
  courierBonus: 80,
  shop: { diner: 50, pitstop: 120, gunbarn: 150 },
  respawnFine: 100,
  bustedFine: 200,
  // clock: 1 game hour = 30 real seconds
  hourSecs: 30,
  saveKey: 'solmar-streets-save-v1',
};
