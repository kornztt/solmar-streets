// SOLMAR STREETS — configuration: world size, districts, vehicles, people, shops, missions.
// Every number here is original to this build.

export const WORLD = {
  size: 3600,
  roadGap: 400, // distance between parallel road centrelines
  roadWidth: 64,
  block: 336, // usable block side between roads
};

export const DAY_LENGTH_SEC = 240; // one full game day = 4 real minutes
export const START_MONEY = 250;

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
export const angleTo = (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax);
export const angleDiff = (a, b) => {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
};

// Districts are named by block column/row (9 x 9 blocks). Each has its own
// ground tint, building palette and flavour so the map reads as a real city.
export const DISTRICTS = [
  { name: 'Parkside', cols: [0, 1, 2], rows: [0, 1, 2], ground: '#5d8a4a', roof: ['#7a5a3a', '#8a6a4a', '#6a4a3a'], kind: 'park' },
  { name: 'Northgate', cols: [6, 7, 8], rows: [0, 1, 2], ground: '#7d8a6a', roof: ['#a08a6a', '#b09a7a', '#8a7a5a'], kind: 'houses' },
  { name: 'Old Town', cols: [0, 1, 2], rows: [6, 7, 8], ground: '#8a7a5a', roof: ['#9a4a3a', '#7a3a2a', '#b06a4a'], kind: 'brick' },
  { name: 'Harbor', cols: [6, 7, 8], rows: [6, 7, 8], ground: '#6a7a7a', roof: ['#5a6a7a', '#4a5a6a', '#7a8a9a'], kind: 'docks' },
  { name: 'Downtown', cols: [3, 4, 5], rows: [3, 4, 5], ground: '#5a5f6a', roof: ['#3a4a6a', '#4a5a7a', '#2a3a5a'], kind: 'towers' },
  { name: 'Midtown', cols: [3, 4, 5], rows: [0, 1, 2], ground: '#6a6a5a', roof: ['#8a7a5a', '#7a6a4a', '#9a8a6a'], kind: 'shops' },
  { name: 'Westside', cols: [0, 1, 2], rows: [3, 4, 5], ground: '#7a7a5a', roof: ['#6a5a4a', '#8a7a6a', '#5a6a5a'], kind: 'mixed' },
  { name: 'Eastside', cols: [6, 7, 8], rows: [3, 4, 5], ground: '#6a6a6a', roof: ['#7a6a5a', '#5a6a7a', '#8a7a5a'], kind: 'mixed' },
  { name: 'Southside', cols: [3, 4, 5], rows: [6, 7, 8], ground: '#7a6a5a', roof: ['#5a4a3a', '#6a5a4a', '#4a4a3a'], kind: 'mixed' },
];

export function districtAt(bx, by) {
  for (const d of DISTRICTS) {
    if (d.cols.includes(bx) && d.rows.includes(by)) return d;
  }
  return DISTRICTS[8];
}

// Six car models, twelve paint colours.
export const CAR_MODELS = [
  { id: 'sedan', name: 'Sedan', len: 52, wid: 26, top: 330, accel: 420, grip: 2.6 },
  { id: 'coupe', name: 'Coupe', len: 48, wid: 24, top: 380, accel: 480, grip: 2.9 },
  { id: 'taxi', name: 'Taxi', len: 52, wid: 26, top: 330, accel: 420, grip: 2.6 },
  { id: 'van', name: 'Van', len: 60, wid: 28, top: 280, accel: 340, grip: 2.2 },
  { id: 'truck', name: 'Truck', len: 68, wid: 30, top: 260, accel: 300, grip: 2.0 },
  { id: 'sport', name: 'Sport', len: 50, wid: 25, top: 460, accel: 560, grip: 3.2 },
];

export const CAR_COLORS = [
  '#c0392b', '#e67e22', '#f1c40f', '#27ae60', '#2980b9', '#8e44ad',
  '#ecf0f1', '#2c3e50', '#e74c3c', '#16a085', '#d35400', '#7f8c8d',
];

// Eight pedestrian types, each with a look, a walk speed and a habit.
export const PED_TYPES = [
  { id: 'business', color: '#2c3e50', speed: 55, label: 'Business' },
  { id: 'tourist', color: '#e74c3c', speed: 40, label: 'Tourist' },
  { id: 'jogger', color: '#27ae60', speed: 110, label: 'Jogger' },
  { id: 'worker', color: '#e67e22', speed: 60, label: 'Worker' },
  { id: 'student', color: '#2980b9', speed: 70, label: 'Student' },
  { id: 'elder', color: '#95a5a6', speed: 30, label: 'Elder' },
  { id: 'vendor', color: '#8e44ad', speed: 35, label: 'Vendor' },
  { id: 'officer', color: '#1a5276', speed: 65, label: 'Officer' },
];

export const SHOPS = [
  { id: 'pitstop', name: 'Pit Stop', x: 1400, y: 300, color: '#e67e22', items: [
    { name: 'Quick repair (+40 HP)', price: 50, kind: 'repair', amount: 40 },
    { name: 'Full repair', price: 120, kind: 'repair', amount: 999 },
    { name: 'Armour plating', price: 200, kind: 'armour', amount: 50 },
  ]},
  { id: 'gunbarn', name: 'Gun Barn', x: 300, y: 2620, color: '#c0392b', items: [
    { name: 'Pistol', price: 200, kind: 'pistol', amount: 1 },
    { name: 'Ammo x30', price: 30, kind: 'ammo', amount: 30 },
    { name: 'Ammo x90', price: 70, kind: 'ammo', amount: 90 },
  ]},
  { id: 'diner', name: 'Diner', x: 2620, y: 1620, color: '#27ae60', items: [
    { name: 'Hot meal (+40 HP)', price: 20, kind: 'heal', amount: 40 },
    { name: 'Full meal (+100 HP)', price: 45, kind: 'heal', amount: 100 },
    { name: 'Coffee (wanted -1)', price: 15, kind: 'cool', amount: 1 },
  ]},
];

export const MISSIONS = [
  { id: 'm1', name: 'M1 The Getaway', payout: 950, brief: 'Steal the getaway car and reach the safehouse.' },
  { id: 'm2', name: 'M2 Hot Delivery', payout: 800, brief: 'Pick up the package and deliver it before the timer runs out.' },
  { id: 'm3', name: 'M3 Dockside Takedown', payout: 1500, brief: 'Take down the three dock guards at the harbor.' },
  { id: 'm4', name: 'M4 Harbor Chase', payout: 1200, brief: 'Tail the courier car, then ram it three times to stop it.' },
  { id: 'm5', name: 'M5 Night Heist', payout: 2000, brief: 'Stop the bank van at night, grab 3 cash bags, reach the stash.' },
];

export const SAVE_KEY = 'solmar-streets-save-v1';
