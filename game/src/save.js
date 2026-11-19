// Autosave to localStorage: money, progress, position, clock.
import { CFG } from './config.js';

export function saveGame(G) {
  try {
    const p = G.player;
    const data = {
      money: G.money,
      missionsDone: G.missionsDone,
      hours: G.time.hours, minutes: G.time.minutes, day: G.time.day,
      x: p.x, y: p.y, hp: p.hp, ammo: p.ammo, wanted: p.wanted,
      carId: p.inCar ? p.inCar.id : null,
    };
    window.localStorage.setItem(CFG.saveKey, JSON.stringify(data));
  } catch (e) { /* storage unavailable: the game still runs */ }
}

export function loadGame() {
  try {
    const raw = window.localStorage.getItem(CFG.saveKey);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

export function clearSave() {
  try { window.localStorage.removeItem(CFG.saveKey); } catch (e) { /* ignore */ }
}
