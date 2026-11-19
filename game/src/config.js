// SOLMAR STREETS — shared constants, seeded RNG and small helpers.
// Written fresh for round 9 (rebuild7). No code copied from earlier rounds.

export const WORLD = { BLOCK: 260, ROAD: 90, BLOCKS: 7 };
export const CITY = WORLD.BLOCKS * WORLD.BLOCK + (WORLD.BLOCKS + 1) * WORLD.ROAD; // 2540

/** Deterministic RNG (mulberry32). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
export const angleTo = (x1, y1, x2, y2) => Math.atan2(y2 - y1, x2 - x1);
/** Shortest signed turn from angle a toward b. */
export function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
export function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

/** Six car models (top-down rectangles, w = length along heading). */
export const CAR_MODELS = [
  { name: 'Hatch', w: 42, h: 20, top: 5.2, hp: 80 },
  { name: 'Sedan', w: 48, h: 22, top: 5.6, hp: 100 },
  { name: 'Coupe', w: 46, h: 20, top: 6.4, hp: 90 },
  { name: 'Van', w: 54, h: 24, top: 4.6, hp: 130 },
  { name: 'Truck', w: 58, h: 24, top: 4.2, hp: 150 },
  { name: 'Taxi', w: 48, h: 22, top: 5.8, hp: 100 },
];

export const CAR_COLORS = [
  '#f5c518', '#e74c3c', '#3498db', '#ecf0f1', '#9b59b6', '#e67e22',
  '#2ecc71', '#1abc9c', '#f39c12', '#7f8c8d', '#c0392b', '#16a085',
];

/** Eight pedestrian types with distinct looks and behaviours. */
export const PED_TYPES = [
  { name: 'walker', color: '#e8c39e', speed: 1.1, behavior: 'walk' },
  { name: 'jogger', color: '#ff7f50', speed: 2.2, behavior: 'jog' },
  { name: 'shopper', color: '#8e44ad', speed: 0.9, behavior: 'walk' },
  { name: 'worker', color: '#2c3e50', speed: 1.3, behavior: 'walk' },
  { name: 'tourist', color: '#f1c40f', speed: 0.8, behavior: 'stand' },
  { name: 'kid', color: '#3498db', speed: 1.6, behavior: 'dart' },
  { name: 'elder', color: '#95a5a6', speed: 0.7, behavior: 'walk' },
  { name: 'courier', color: '#e67e22', speed: 1.8, behavior: 'jog' },
];

/** Shop definitions. */
export const SHOPS = [
  { id: 'pitstop', name: 'Pit Stop', item: 'Repair car', price: 120, color: '#e74c3c' },
  { id: 'gunbarn', name: 'Gun Barn', item: '+30 ammo', price: 150, color: '#f39c12' },
  { id: 'diner', name: 'Diner', item: 'Heal to full', price: 50, color: '#2ecc71' },
];

/** Story mission payouts. */
export const MISSIONS = [
  { id: 1, name: 'M1 The Getaway', pay: 950 },
  { id: 2, name: 'M2 Hot Delivery', pay: 800 },
  { id: 3, name: 'M3 Dockside Takedown', pay: 1500 },
  { id: 4, name: 'M4 Harbor Chase', pay: 1200 },
  { id: 5, name: 'M5 Night Heist', pay: 2000 },
];

export const SAVE_KEY = 'solmar-streets-save-v1';
