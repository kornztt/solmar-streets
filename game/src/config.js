// SOLMAR STREETS — configuration: world layout, tuning, palette, zones.
// Every number the game runs on lives here so the other files stay readable.
export const VIEW_W = 1280;
export const VIEW_H = 720;
export const WORLD_W = 3200;
export const WORLD_H = 2400;

// Road grid: vertical roads at these x centres, horizontal at these y centres.
export const ROAD_X = [200, 600, 1000, 1400, 1800, 2200, 2600, 3000];
export const ROAD_Y = [200, 600, 1000, 1400, 1800, 2200];
export const ROAD_HALF = 36;

// City palette: sun-soaked Solmar — sand ground, dark asphalt, pastel blocks.
export const COLORS = {
  ground: '#d9c69c',
  groundAlt: '#d2bd8f',
  road: '#3b4048',
  roadLine: '#e8d27a',
  sidewalk: '#c9b78d',
  water: '#3f7fa8',
  waterDeep: '#2f6390',
  park: '#7fae5a',
  parkDark: '#6a9a4a',
  building: ['#8fa3b8', '#b8a58f', '#a8b89a', '#c2a3a3', '#9aa78f', '#b3a6c2', '#c9b183'],
  roof: ['#6e7f92', '#8f7d68', '#7d8f74', '#967d7d', '#767d6b'],
  container: ['#c25e3a', '#3a7fc2', '#7fae3a', '#c2a13a'],
  player: '#2f9e6e',
  playerShirt: '#f2f2f2',
  mara: '#c23a6e',
  viper: '#a83232',
  cop: '#2f4fb2',
  ped: ['#e8b04b', '#4ba3e8', '#e87a4b', '#8a5fc2', '#4bc2a3', '#e84b7a'],
  taxi: '#f2c230',
  police: '#2f4fb2',
  policeLight: ['#ff3b30', '#3b82ff'],
  bullet: '#ffd23b',
  muzzle: '#ffe9a8',
  marker: '#ffd23b',
  markerGreen: '#4be38a',
  hudBg: 'rgba(12, 16, 24, 0.72)',
  hudText: '#f5f2e8',
  hudDim: '#b8b2a2',
};

// Tuning: movement, combat, wanted, economy.
export const TUNE = {
  playerWalk: 175,
  playerSprint: 265,
  playerRadius: 14,
  playerHp: 100,
  playerRegen: 2, // hp per second after 5 s without damage
  punchRange: 48,
  punchDamage: 25,
  punchCooldown: 0.35,
  punchKnock: 260,
  pistolDamage: 25,
  pistolRange: 560,
  pistolMag: 12,
  pistolReserveStart: 48,
  pistolFireInterval: 0.16,
  bulletSpeed: 920,
  viperHp: 100,
  viperSpeed: 150,
  viperDamage: 8,
  viperRange: 380,
  viperFireInterval: 1.0,
  copSpeed: 205,
  carAccel: 430,
  carMaxSpeed: 540,
  carReverse: 190,
  carTurn: 2.7,
  carRadius: 18,
  policeMaxSpeed: 500,
  trafficSpeed: [120, 185],
  wantedDecaySeconds: 30,
  policeSpawnInterval: 3,
  ramDamage: 6,
  pitStopPrice: 100,
  ammoPrice: 150,
  ammoPack: 30,
  farePay: [60, 120],
  fareTip: 15,
  fareTipSeconds: 75,
};

// Named places in the city.
export const ZONES = {
  hideout: { x: 430, y: 1900, label: 'Hideout' },
  mara: { x: 300, y: 1900 },
  spawn: { x: 350, y: 1950 },
  docks: { x: 3100, y: 1200, label: 'Pier 9' },
  pitStop: { x: 1200, y: 800, r: 90, label: 'Pit Stop' },
  gunBarn: { x: 2400, y: 1600, r: 80, label: 'Gun Barn' },
  m1Car: { x: 520, y: 1850 },
  m1Dest: { x: 2600, y: 400 },
  m2Pickup: { x: 600, y: 1800 },
  m2Dest: { x: 2600, y: 1800 },
};

// Mission definitions: id, name, reward, timer (seconds, 0 = no timer).
export const MISSIONS = {
  m1: { id: 'm1', name: 'The Getaway', reward: 700, timer: 100, brief: 'Steal the getaway car and reach the north hideout before the timer runs out.' },
  m2: { id: 'm2', name: 'Hot Delivery', reward: 800, timer: 150, brief: 'Pick up the package on 6th Street and deliver it across town — fast.' },
  m3: { id: 'm3', name: 'Dockside Takedown', reward: 1500, timer: 0, brief: 'The Viper crew is waiting at Pier 9. Put all five of them down, then report back to Mara.' },
};

export const SAVE_KEY = 'solmar-streets-save-v3';
export const GAME_VERSION = '1.0.0';
