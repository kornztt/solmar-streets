// SOLMAR STREETS — tuning, palettes, car models, districts, landmarks.
// All numbers are this game's own design.
export const CFG = {
  pitch: 310, // block + road
  block: 240,
  road: 70,
  grid: 10,
  world: 10 * 310 + 70, // 3170 px square
  viewW: 1280,
  viewH: 720,
  walkSpeed: 230,
  runSpeed: 330,
  punchRange: 46,
  punchDamage: 25,
  bulletSpeed: 780,
  bulletRange: 560,
  bulletDamage: 34,
  pistolMag: 12,
  startMoney: 250,
  repairCost: 120,
  ammoCost: 150,
  ammoPack: 30,
  saveKey: 'solmar-streets-save-v1',
};

export const CAR_MODELS = [
  { name: 'sedan', w: 46, len: 84, max: 300, accel: 250, grip: 3.4, hp: 100 },
  { name: 'sports', w: 44, len: 80, max: 385, accel: 340, grip: 4.4, hp: 80 },
  { name: 'truck', w: 52, len: 102, max: 250, accel: 185, grip: 2.6, hp: 170 },
  { name: 'hatch', w: 42, len: 74, max: 295, accel: 270, grip: 3.7, hp: 90 },
  { name: 'van', w: 50, len: 96, max: 260, accel: 205, grip: 2.9, hp: 145 },
  { name: 'taxi', w: 46, len: 84, max: 315, accel: 255, grip: 3.5, hp: 100 },
];

export const CAR_COLORS = [
  '#e33f2f', '#f2b705', '#2f7fe3', '#37b24d', '#8a5cf6', '#f27d16',
  '#e8e8e8', '#22252b', '#e86aa8', '#19b8a6', '#c98a2e', '#7fb069',
];

// Landmarks by block coordinates (bx, by), grid 0..9.
export const LANDMARKS = {
  hideout: { bx: 1, by: 1, label: 'Hideout' },
  marina: { bx: 8, by: 1, label: 'Marina' },
  pier: { bx: 8, by: 8, label: 'Pier 9' },
  harbor: { bx: 1, by: 8, label: 'Harbor' },
  pitstop: { bx: 4, by: 4, label: 'Pit Stop' },
  gunbarn: { bx: 5, by: 5, label: 'Gun Barn' },
  taxistand: { bx: 4, by: 1, label: 'Taxi Stand' },
  runner: { bx: 6, by: 6, label: 'Runner' },
};

export const MISSION_REWARDS = [700, 800, 1500, 1200];
export const MISSION_NAMES = ['The Getaway', 'Hot Delivery', 'Dockside Takedown', 'Harbor Chase'];

export const PHASES = {
  night: { sky: '#0b1026', road: '#232838', side: '#2e3448', bld: '#1a1f33', roof: '#141828', grass: '#14261c', water: '#0a2036', light: 0.3 },
  dawn: { sky: '#e8a06a', road: '#4a4a52', side: '#6b6b72', bld: '#5a4a52', roof: '#3e3238', grass: '#3d5a3a', water: '#3a6a8a', light: 0.7 },
  day: { sky: '#7ec8e3', road: '#3f434c', side: '#8f939c', bld: '#b98d5f', roof: '#8a6a4a', grass: '#5da24a', water: '#2f7fc4', light: 1.0 },
  dusk: { sky: '#c96a4a', road: '#46424e', side: '#76707c', bld: '#6a5560', roof: '#4a3844', grass: '#47603c', water: '#2a5a7a', light: 0.55 },
};

// Minutes since midnight -> {a, b, t} to blend phase a into phase b.
export function phaseFor(mins) {
  const m = ((mins % 1440) + 1440) % 1440;
  const stops = [
    [0, 'night'], [300, 'night'], [360, 'dawn'], [480, 'day'],
    [1020, 'day'], [1140, 'dusk'], [1260, 'night'], [1440, 'night'],
  ];
  for (let i = 0; i < stops.length - 1; i++) {
    const [m0, p0] = stops[i];
    const [m1, p1] = stops[i + 1];
    if (m >= m0 && m < m1) {
      const t = p0 === p1 ? 0 : (m - m0) / (m1 - m0);
      return { a: p0, b: p1, t };
    }
  }
  return { a: 'night', b: 'night', t: 0 };
}

export function districtAt(bx, by) {
  if (bx < 3 && by < 3) return 'Old Town';
  if (bx >= 7 && by < 3) return 'Marina';
  if (bx >= 7 && by >= 7) return 'Pier District';
  if (bx < 3 && by >= 7) return 'Harbor';
  if (bx >= 4 && bx <= 6 && by >= 4 && by <= 6) return 'Downtown';
  if (by >= 7) return 'Market';
  return 'Downtown';
}

export function fmtClock(mins) {
  const m = Math.floor(((mins % 1440) + 1440) % 1440);
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}
