// SOLMAR STREETS — the save system. One clear job: keep the player's
// money, missions and place in the city in localStorage, and bring it back.
// Version 2 of the save format: it also records when it was written and the
// most cash the player ever held, and it still loads a version 1 save.

import { SAVE_KEY, SAVE_VERSION, STATS_KEY } from './config.js';

export function hasSave() {
  try {
    return !!window.localStorage.getItem(SAVE_KEY);
  } catch {
    return false;
  }
}

export function saveGame(world) {
  try {
    const p = world.player;
    const best = Math.max(loadBest(), p.money);
    const data = {
      version: SAVE_VERSION,
      savedAt: Date.now(),
      money: p.money,
      ammo: p.ammo,
      hp: Math.max(1, Math.round(p.hp)),
      x: Math.round(p.x),
      y: Math.round(p.y),
      missionsDone: world.mission.done,
      next: world.mission.next,
      stats: world.stats,
      bestCash: best,
      time: Math.round(world.time),
      clock: world.clock,
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

/** Cross-run totals, kept apart from the save so a new game never wipes them. */
export function saveStats(world) {
  try {
    const prev = loadStats();
    const totals = {
      missionsDone: prev.missionsDone + world.stats.missionsDone,
      fares: prev.fares + world.stats.fares,
      kills: prev.kills + world.stats.kills,
      cashEarned: prev.cashEarned + world.stats.cashEarned,
      carsStolen: prev.carsStolen + world.stats.carsStolen,
      bestCash: Math.max(prev.bestCash, world.player.money),
      runs: prev.runs + 1,
    };
    window.localStorage.setItem(STATS_KEY, JSON.stringify(totals));
    return totals;
  } catch {
    return null;
  }
}

export function loadStats() {
  const empty = { missionsDone: 0, fares: 0, kills: 0, cashEarned: 0, carsStolen: 0, bestCash: 0, runs: 0 };
  try {
    const raw = window.localStorage.getItem(STATS_KEY);
    if (!raw) return empty;
    return { ...empty, ...(JSON.parse(raw) || {}) };
  } catch {
    return empty;
  }
}

/** True when the player has any cross-run history at all. */
export function hasStats() {
  return loadStats().runs > 0;
}

/** The most cash ever held (from the save, or from the cross-run totals). */
export function loadBest() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (data && typeof data.bestCash === 'number') return data.bestCash;
      if (data && typeof data.money === 'number') return data.money;
    }
    return loadStats().bestCash;
  } catch {
    return 0;
  }
}

export function loadGame() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data) return null;
    // Version 1 saves load as version 2: same fields, no bestCash yet.
    if (data.version !== 1 && data.version !== SAVE_VERSION) return null;
    return data;
  } catch {
    return null;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // A browser that refuses storage just starts fresh.
  }
}

/** Wipe the cross-run totals as well as the save — a clean slate. */
export function wipeAll() {
  clearSave();
  try {
    window.localStorage.removeItem(STATS_KEY);
  } catch {
    // Same as above: nothing stored, nothing to wipe.
  }
}

/** One line for the title screen: what the save holds, in plain words. */
export function saveSummary(data) {
  if (!data) return 'No save yet — a new story starts in Solmar.';
  const cash = data.money ?? 0;
  const done = data.missionsDone ? Object.keys(data.missionsDone).length : 0;
  const when = data.savedAt ? new Date(data.savedAt).toLocaleDateString() : 'earlier';
  const best = data.bestCash ? ` Best haul yet: $${data.bestCash}.` : '';
  return `Saved ${when}: $${cash}, ${done} mission${done === 1 ? '' : 's'} done.${best}`;
}
