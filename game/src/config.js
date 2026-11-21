// SOLMAR STREETS — tuning tables and content data. All names, places and
// characters are original inventions for this game.
export const WORLD = { w: 2600, h: 1800 };
export const ROADS_X = [200, 600, 1000, 1400, 1800, 2200];
export const ROADS_Y = [200, 550, 900, 1250, 1600];
export const ROAD_W = 90;

// Six car models, each with its own handling and a share of twelve colours.
export const CAR_MODELS = [
  { name: 'Sundown', kind: 'sedan', top: 330, accel: 260, turn: 2.6, hp: 100, colors: ['#c0392b', '#2e86c1'] },
  { name: 'Vagabond', kind: 'hatch', top: 350, accel: 300, turn: 3.0, hp: 80, colors: ['#f1c40f', '#16a085'] },
  { name: 'Longhorn', kind: 'pickup', top: 300, accel: 230, turn: 2.2, hp: 160, colors: ['#7d3c98', '#e67e22'] },
  { name: 'Cruiser', kind: 'coupe', top: 380, accel: 320, turn: 2.9, hp: 90, colors: ['#ecf0f1', '#1a1a1a'] },
  { name: 'Hauler', kind: 'van', top: 270, accel: 200, turn: 2.0, hp: 180, colors: ['#f39c12', '#5d6d7e'] },
  { name: 'Stinger', kind: 'sports', top: 430, accel: 380, turn: 3.3, hp: 70, colors: ['#ff2d78', '#00c2ff'] },
];
export const CAR_COLORS = ['#c0392b', '#2e86c1', '#f1c40f', '#16a085', '#7d3c98', '#e67e22', '#ecf0f1', '#1a1a1a', '#f39c12', '#5d6d7e', '#ff2d78', '#00c2ff'];

// Eight pedestrian types with distinct looks and walking speeds.
export const PED_TYPES = [
  { name: 'commuter', color: '#34495e', speed: 42, size: 9 },
  { name: 'jogger', color: '#e74c3c', speed: 95, size: 9 },
  { name: 'tourist', color: '#f39c12', speed: 34, size: 10 },
  { name: 'worker', color: '#f1c40f', speed: 40, size: 10 },
  { name: 'shopper', color: '#9b59b6', speed: 36, size: 9 },
  { name: 'student', color: '#1abc9c', speed: 55, size: 8 },
  { name: 'elder', color: '#95a5a6', speed: 26, size: 9 },
  { name: 'vendor', color: '#d35400', speed: 30, size: 10 },
];

// Fixed places around the city (x, y are world coordinates).
export const PLACES = {
  home: { x: 320, y: 320, label: 'Home' },
  plaza: { x: 1200, y: 725, label: 'Rooftop Plaza' },
  harbor: { x: 1300, y: 1700, label: 'Dockside' },
  bank: { x: 1850, y: 500, label: 'Meridian Bank' },
  pitstop: { x: 1350, y: 950, label: 'Pit Stop' },
  gunbarn: { x: 950, y: 1200, label: 'Gun Barn' },
  diner: { x: 650, y: 850, label: 'Diner' },
  depot: { x: 2150, y: 1200, label: 'Courier Depot' },
  taxiStand: { x: 1000, y: 250, label: 'Taxi Stand' },
  getawayCar: { x: 640, y: 235, label: 'Getaway Car' },
  deliveryDrop: { x: 1000, y: 1650, label: 'Drop-off' },
};

export const PRICES = { repair: 120, ammo: 150, heal: 50, ammoAmount: 30 };
export const PAYOUTS = { m1: 950, m2: 800, m3: 1500, m4: 1200, m5: 2000, taxiBase: 150, parcel: 120, parcelBonus: 80 };

export const MISSION_DEFS = [
  { id: 1, name: 'M1 The Getaway', brief: 'Steal the getaway car and bring it home.', payout: PAYOUTS.m1 },
  { id: 2, name: 'M2 Hot Delivery', brief: 'Pick up the package at the depot, deliver it in time.', payout: PAYOUTS.m2 },
  { id: 3, name: 'M3 Dockside Takedown', brief: 'Clear the dockside of the five Breakers.', payout: PAYOUTS.m3 },
  { id: 4, name: 'M4 Harbor Chase', brief: 'Stop the courier, grab the ledger, bring it home.', payout: PAYOUTS.m4 },
  { id: 5, name: 'M5 Night Heist', brief: 'Stop the bank van at night, grab the cash, reach the stash.', payout: PAYOUTS.m5 },
];

export const DAY_LENGTH_S = 240; // one full in-game day in real seconds
export const WANTED_DECAY_S = 25;
