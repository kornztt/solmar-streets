// Seeded random numbers (mulberry32) plus small helpers, so the city and
// traffic are the same for a given seed and every run is reproducible.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class RNG {
  constructor(seed) {
    this.next = mulberry32(seed);
  }
  // Float in [0, 1).
  float() {
    return this.next();
  }
  // Float in [min, max).
  range(min, max) {
    return min + this.next() * (max - min);
  }
  // Integer in [min, max] inclusive.
  int(min, max) {
    return Math.floor(this.range(min, max + 1));
  }
  // One element of an array.
  pick(list) {
    return list[Math.floor(this.next() * list.length)];
  }
  // True with probability p.
  chance(p) {
    return this.next() < p;
  }
  // Angle in radians, uniform over the circle.
  angle() {
    return this.next() * Math.PI * 2;
  }
  // A point inside a rectangle.
  inRect(x, y, w, h) {
    return { x: this.range(x, x + w), y: this.range(y, y + h) };
  }
}

// Clamp a value into [min, max].
export function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

// Shortest signed angle from a to b, in (-PI, PI].
export function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// Distance between two points.
export function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

// Linear interpolation.
export function lerp(a, b, t) {
  return a + (b - a) * t;
}
