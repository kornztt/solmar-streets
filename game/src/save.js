// Save / load through localStorage: money, finished missions and totals.
// Nothing else is stored, and a missing or corrupt save just starts fresh.
import { SAVE_KEY } from './config.js';

export function saveGame(world) {
  try {
    const data = {
      version: 1,
      money: world.player.money,
      done: world.mission.done,
      stats: world.stats,
      savedAt: Date.now(),
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data.money !== 'number' || !data.done) return null;
    return data;
  } catch (e) {
    return null;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch (e) { /* storage unavailable */ }
}

export function hasSave() {
  return loadGame() !== null;
}
