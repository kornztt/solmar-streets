// A tiny seeded random number generator (mulberry32), so the city, the
// traffic and the staged screenshots are the same every time for one seed.
// Everything here is deterministic: same seed, same Solmar.

export function createRandom(seed) {
  let a = seed >>> 0;
  return {
    next() {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    range(min, max) {
      return min + this.next() * (max - min);
    },
    int(min, max) {
      return Math.floor(this.range(min, max + 1));
    },
    pick(list) {
      return list[Math.floor(this.next() * list.length)];
    },
    chance(p) {
      return this.next() < p;
    },
    // A coin flip: true half the time, on the seeded stream.
    nextBool() {
      return this.next() < 0.5;
    },
    // +1 or -1, evenly: a direction picked at random.
    sign() {
      return this.next() < 0.5 ? -1 : 1;
    },
    // A shuffled copy of the list (Fisher-Yates): deal from a deck instead
    // of drawing with replacement, so a set of picks never repeats early.
    shuffle(list) {
      const out = list.slice();
      for (let i = out.length - 1; i > 0; i -= 1) {
        const j = Math.floor(this.next() * (i + 1));
        const tmp = out[i];
        out[i] = out[j];
        out[j] = tmp;
      }
      return out;
    },
    // n distinct items from the list, in shuffled order: a hand dealt
    // from a shuffled deck, never the same card twice.
    sample(list, n) {
      return this.shuffle(list).slice(0, Math.max(0, Math.min(n, list.length)));
    },
    // An integer in [0, max): a die roll without the range bookkeeping.
    nextInt(max) {
      return Math.floor(this.next() * Math.max(1, max));
    },
    // One of the pairs, weighted: [[value, weight], ...]. Weights need not
    // sum to one; a zero weight never wins.
    weightedPick(pairs) {
      let total = 0;
      for (const [, w] of pairs) total += w;
      let roll = this.next() * total;
      for (const [value, w] of pairs) {
        roll -= w;
        if (roll <= 0) return value;
      }
      return pairs[pairs.length - 1][0];
    },
    // Approximately normal, mean 0, standard deviation 1 (Box-Muller).
    // Useful for scattering things that should cluster, not spread evenly.
    gauss() {
      let u = 0;
      let v = 0;
      while (u === 0) u = this.next();
      while (v === 0) v = this.next();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    },
    // A normal draw clamped to a range: a crowd that clusters around the
    // middle of a street instead of piling up at its ends.
    gaussRange(min, max) {
      const mid = (min + max) / 2;
      const half = (max - min) / 2;
      return Math.max(min, Math.min(max, mid + (this.gauss() * half) / 2));
    },
    // A whole-number normal draw clamped to [min, max]: a group size that
    // clusters around the middle instead of landing anywhere at random.
    gaussInt(min, max) {
      return Math.round(this.gaussRange(min, max));
    },
  };
}

/** Turn any string into a stable 32-bit seed (FNV-1a), so ?seed=solmar works. */
export function seedFromString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
