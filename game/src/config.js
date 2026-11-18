// SOLMAR STREETS — tuning, car models, districts and mission text.
// One clear job: every number the rest of the game tunes against lives here.

export const GAME_TITLE = 'SOLMAR STREETS';
export const GAME_VERSION = '1.2.0';
export const SAVE_VERSION = 2;

export const VIEW = { width: 1280, height: 720 };
export const WORLD = { width: 3600, height: 2700 };
export const SAVE_KEY = 'solmar-streets-save-v2';
export const STATS_KEY = 'solmar-streets-stats-v1';

// The road grid: avenues run north-south, streets east-west, 90 px wide.
export const ROADS = {
  width: 90,
  avenues: [300, 700, 1100, 1500, 1900, 2300, 2700, 3100],
  streets: [300, 700, 1100, 1500, 1900, 2300],
  coastalY: 2450, // Palma Blvd, the beachfront road
  beachTop: 2520, // sand starts here
  waterTop: 2610, // the sea
};

// Six districts, each with its own palette, character and street flavour.
export const DISTRICTS = [
  { name: 'Downtown', x: 900, y: 100, w: 1300, h: 700, roof: '#7d8aa5', accent: '#5b6b8c', blurb: 'glass towers, the Gun Barn, and the busiest traffic in Solmar' },
  { name: 'Old Town', x: 500, y: 1400, w: 1000, h: 800, roof: '#b0703f', accent: '#8a5230', blurb: 'brick streets, Mara\u2019s hideout, tight corners for a clean getaway' },
  { name: 'Portside', x: 3250, y: 200, w: 350, h: 2100, roof: '#6e7a72', accent: '#57615a', blurb: 'docks, warehouses and the Viper crew\u2019s turf' },
  { name: 'Palma Beach', x: 100, y: 2400, w: 3400, h: 300, roof: '#e8d29a', accent: '#d9bd7f', blurb: 'sand, surf and the long coastal boulevard' },
  { name: 'The Hills', x: 100, y: 100, w: 600, h: 600, roof: '#a86a7d', accent: '#8a5266', blurb: 'mansions, gates and long driveways' },
  { name: 'Industrial', x: 2100, y: 1700, w: 1100, h: 600, roof: '#8a8f96', accent: '#6f747b', blurb: 'the Pit Stop garage and wide, empty service roads' },
];

// Car models: how each one drives. Comet GT is the hero car of mission 1;
// the Falcon S is its street-racing cousin, parked around Downtown.
export const CAR_MODELS = {
  sedan: { name: 'Meridian Sedan', accel: 260, top: 330, turn: 2.6, hp: 100, len: 48, wid: 22, colors: ['#c0392b', '#2e6fb0', '#7d8a96', '#d9a441', '#5b8c5a'] },
  taxi: { name: 'Solmar Cab', accel: 250, top: 320, turn: 2.6, hp: 100, len: 48, wid: 22, colors: ['#f2c200'] },
  comet: { name: 'Comet GT', accel: 420, top: 520, turn: 3.1, hp: 110, len: 50, wid: 22, colors: ['#e0402e'] },
  falcon: { name: 'Falcon S', accel: 380, top: 480, turn: 3.0, hp: 100, len: 48, wid: 22, colors: ['#2b6cb0', '#e8e8e8'] },
  van: { name: 'Box Van', accel: 180, top: 250, turn: 2.1, hp: 140, len: 56, wid: 24, colors: ['#e8e8e8', '#7d8a96'] },
  pickup: { name: 'Rancher Pickup', accel: 280, top: 340, turn: 2.5, hp: 120, len: 52, wid: 24, colors: ['#3f6b4f', '#8a4a2b'] },
  truck: { name: 'Hauler Truck', accel: 150, top: 220, turn: 1.8, hp: 180, len: 64, wid: 26, colors: ['#5b6b8c', '#c0392b'] },
  police: { name: 'SPPD Cruiser', accel: 360, top: 460, turn: 3.0, hp: 130, len: 50, wid: 22, colors: ['#1c2733'] },
};

export const TUNING = {
  walkSpeed: 175,
  runSpeed: 265,
  playerRadius: 10,
  playerHp: 100,
  pistolDamage: 34,
  pistolRange: 520,
  pistolFireRate: 0.22,
  pistolMag: 12,
  punchDamage: 25,
  punchRange: 46,
  punchRate: 0.45,
  viperHp: 100,
  viperCount: 5,
  viperDamage: 9,
  viperRange: 380,
  viperFireRate: 1.1,
  wantedDecayDelay: 15, // seconds of quiet before the heat starts to cool
  wantedDecayStep: 6, // seconds per star lost while cool
  policeView: 460, // a cop this close keeps the heat on
  maxPolice: 5,
  trafficCount: 13,
  pedCount: 26,
  fareTimer: 75, // seconds to drop a passenger off
  fareRewardMin: 40,
  fareRewardMax: 90,
  fareCooldown: 8, // seconds after a run starts before a fare can be offered
  ammoPrice: 150,
  ammoAmount: 30,
  repairPrice: 100,
  startMoney: 120,
  startAmmo: 24,
  nearMissReward: 5, // cash for a close call at speed, no contact
  nearMissCooldown: 3,
  nearMissMin: 36, // a traffic car this close at speed counts as a near miss
  nearMissMax: 62,
  nearMissSpeed: 200, // the player's speed must be above this for it to count
  fareTip: 15, // bonus for dropping a passenger off with half the timer left
  policeRamDamage: 4, // health a police ram costs the player's car (a ram is a shove, not a shredder)
  hornCooldown: 1, // seconds between honks
};

export const PRICES = { ammo: TUNING.ammoPrice, repair: TUNING.repairPrice };

// Pickups scattered around town at the start of a run.
export const PICKUP_KINDS = ['cash', 'health', 'ammo', 'cash', 'health', 'ammo', 'cash', 'cash'];

// Pedestrian variety: shirts and skin tones the city draws from.
export const PED_SHIRTS = ['#d95f4b', '#4b7dd9', '#e8c84a', '#7db069', '#a05fa8', '#e8e8e8', '#3a3a3a', '#e07b39'];
export const PED_SKINS = ['#e8b98a', '#c98a5a', '#8a5a35', '#f0c8a0'];

// Where the story lives. All coordinates are world pixels.
export const PLACES = {
  hideout: { x: 1150, y: 1650, label: "Mara's Hideout" },
  comet: { x: 2830, y: 2405, label: 'Comet GT' },
  portPickup: { x: 3350, y: 1180, label: 'Warehouse 7' },
  hillsDrop: { x: 300, y: 430, label: 'Villa Solana' },
  docks: { x: 3400, y: 880, label: 'Pier 9' },
  gunBarn: { x: 1120, y: 380, label: 'Gun Barn' },
  pitStop: { x: 2680, y: 2050, label: 'Pit Stop' },
};

// The three story jobs Mara hands out, in order.
export const MISSIONS = [
  {
    id: 'm1',
    title: 'THE GETAWAY',
    giver: 'Mara Voss',
    reward: 600,
    intro: 'Mara: "Jax, listen close. A cherry-red Comet GT is parked on Palma Blvd, keys in it, owner nowhere. Bring it to my hideout in Old Town. The second you touch that car the SPPD will be all over you — sirens, roadblocks, the works. Lose them, get here in one piece, and the six hundred is yours."',
    steps: [
      { text: 'Steal the Comet GT on Palma Blvd', target: 'comet', hint: 'Any car gets you there, but the Comet is the prize — it is parked on the coastal road.' },
      { text: 'Get in the Comet GT', target: 'comet', hint: 'Walk up to it and press E. The cops will not wait for you.' },
      { text: 'Reach the hideout — lose the cops on the way', target: 'hideout', timer: 100, hint: 'Three stars means three cruisers. Break line of sight down a side street and the heat cools off.' },
    ],
  },
  {
    id: 'm2',
    title: 'HOT DELIVERY',
    giver: 'Mara Voss',
    reward: 900,
    intro: 'Mara: "Warehouse 7 at Portside has a package for Villa Solana, up in The Hills. Two minutes, Jax. The whole city is in your way and the clock does not care. Do not stop for anything — not the lights, not the cops, not the view."',
    steps: [
      { text: 'Pick up the package at Warehouse 7, Portside', target: 'portPickup', hint: 'Portside is the far east edge — take the coastal road, it is the fastest way across.' },
      { text: 'Deliver the package to Villa Solana, The Hills', target: 'hillsDrop', timer: 120, hint: 'North-west corner of the map. The Hills roads are narrow — brake before the corners.' },
    ],
  },
  {
    id: 'm3',
    title: 'DOCKSIDE TAKEDOWN',
    giver: 'Mara Voss',
    reward: 1500,
    intro: 'Mara: "The Vipers moved onto Pier 9 and they are taxing my docks — my trucks, my crews, my money. Five of them, armed, and they do not scare easy. Clear the pier, then come home. Bring the Comet if you want — it will not mind. And Jax? Make it loud. I want the whole harbour to hear it."',
    steps: [
      { text: 'Get to Pier 9 at the docks', target: 'docks', hint: 'Far east, past the containers. On foot is safer once you are there — the pier is tight.' },
      { text: 'Eliminate the Viper crew (0/5)', target: 'docks', hint: 'Pistol out, click to shoot. They shoot back — use the containers as cover.' },
      { text: 'Report back to the hideout', target: 'hideout', hint: 'Job done means the heat is off. Mara will have a word with the SPPD.' },
    ],
  },
];

// The repeatable job Mara offers once the three story jobs are done: steal
// any car and bring it to the hideout, for a smaller cut, as often as liked.
export const REPEAT_JOB = {
  id: 'm4',
  title: 'QUICK GETAWAY',
  giver: 'Mara Voss',
  reward: 300,
  intro: 'Mara: "The story jobs are done, but the city still needs wheels moved. Steal any car, bring it to the hideout, three hundred in your pocket. Quick and clean — the SPPD hates it, which is half the fun."',
  steps: [
    { text: 'Steal any car and get in it', target: 'hideout', hint: 'Parked cars are free; traffic costs you a star.' },
    { text: 'Bring it to the hideout', target: 'hideout', hint: 'Any car counts. Faster cars pay the same — your call.' },
  ],
};

export const STORY_BLURB =
  'Solmar, 2026. You are Jax Carter, a wheelman with a fast car habit and a slow bank account. ' +
  'Mara Voss, the fixer of Old Town, has work — if you can stay ahead of the SPPD long enough to finish it.';
