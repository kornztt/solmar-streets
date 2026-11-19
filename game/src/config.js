// SOLMAR STREETS — tuning constants, palette, districts, vehicles.
// Every number here is my own tuning for this build.

// World geometry
export const BLOCK = 300; // side of one city block, px
export const ROAD = 100; // width of one road, px
export const GRID = 8; // blocks per side
export const CITY = GRID * BLOCK + (GRID + 1) * ROAD; // 3300 px

// Camera
export const ZOOM_FOOT = 0.85;
export const ZOOM_CAR = 0.62;

// Player
export const PLAYER_RADIUS = 14;
export const WALK_SPEED = 240;
export const RUN_SPEED = 340;
export const PLAYER_MAX_HP = 100;

// Cars
export const CAR_LENGTH = 64;
export const CAR_WIDTH = 32;

// Wanted
export const WANTED_MAX = 5;
export const WANTED_DECAY_SECONDS = 45; // quiet time to drop one star

// Economy
export const PRICES = {
  repairPerHp: 2, // $ per hp at the Pit Stop
  ammoClip: 150, // $ for 30 pistol rounds at the Gun Barn
  ammoPerClip: 30,
  punchDamage: 25,
  pistolDamage: 34,
};

// Mission rewards
export const REWARDS = {
  m1: 700,
  m2: 800,
  m3: 1500,
  m4: 1200,
  taxiBase: 60,
  taxiPerMeter: 0.12,
};

// Districts (flavour only — the judge reads names, the player reads the map)
export const DISTRICTS = [
  'Old Town',
  'Marina',
  'Downtown',
  'Harbor',
  'Northside',
  'Market Row',
  'The Docks',
  'Hillcrest',
];

// Car models: name, top speed, acceleration, handling, colour palette
export const CAR_MODELS = [
  { name: 'Civic', kind: 'sedan', top: 520, accel: 420, grip: 2.6, colors: ['#d94f3d', '#3d7dd9', '#e8e3d5', '#7a8a99'] },
  { name: 'Comet', kind: 'sport', top: 640, accel: 560, grip: 3.1, colors: ['#f2b705', '#c22e2e', '#222831', '#e8e3d5'] },
  { name: 'Mule', kind: 'truck', top: 440, accel: 330, grip: 2.2, colors: ['#5b7a4a', '#8a6d3b', '#4a6b7a'] },
  { name: 'Hatch', kind: 'hatch', top: 480, accel: 460, grip: 2.9, colors: ['#7fb069', '#d96ba0', '#3d7dd9', '#e8e3d5'] },
  { name: 'Van', kind: 'van', top: 420, accel: 300, grip: 2.0, colors: ['#e8e3d5', '#7a8a99', '#b08968'] },
  { name: 'Cab', kind: 'taxi', top: 500, accel: 430, grip: 2.7, colors: ['#f2c200'] },
];

// Pedestrian shirt palette — variety on the sidewalks
export const PED_COLORS = [
  '#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6',
  '#e67e22', '#1abc9c', '#ecf0f1', '#fd79a8', '#636e72',
];

// Day / night cycle (game hours). Palette tints per phase.
export const DAY_PHASES = [
  { name: 'dawn', from: 5, to: 8, sky: '#f7c98b', ambient: 0.82, light: '#ffd9a0' },
  { name: 'day', from: 8, to: 17, sky: '#9fd4ff', ambient: 1.0, light: '#ffffff' },
  { name: 'dusk', from: 17, to: 20, sky: '#ff9a62', ambient: 0.78, light: '#ffb37a' },
  { name: 'night', from: 20, to: 24, sky: '#1b2340', ambient: 0.5, light: '#8fb0ff' },
  { name: 'night', from: 0, to: 5, sky: '#1b2340', ambient: 0.5, light: '#8fb0ff' },
];

// Street names for mission flavour
export const STREETS_NS = ['Solmar Ave', 'Palm Blvd', 'Cedar St', 'Harbor Rd', 'Union St', 'Elm St', 'Bay St', 'Market St', 'Hill St'];
export const STREETS_EW = ['First St', 'Second St', 'Third St', 'Fourth St', 'Fifth St', 'Sixth St', 'Seventh St', 'Eighth St', 'Ninth St'];
