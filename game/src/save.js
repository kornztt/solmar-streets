// localStorage save / load.
import { CFG } from './config.js';

export function hasSave() {
  try {
    return !!localStorage.getItem(CFG.saveKey);
  } catch {
    return false;
  }
}

export function saveGame(G) {
  try {
    const data = {
      money: G.money,
      hp: G.hp,
      ammo: G.ammo,
      reserve: G.reserve,
      clock: G.clock,
      done: G.mission.done,
      idx: G.mission.idx,
      earned: G.stats.earned,
      fares: G.stats.fares,
      x: G.player.x,
      y: G.player.y,
      seed: G.seed,
    };
    localStorage.setItem(CFG.saveKey, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(CFG.saveKey);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function applySave(G, data) {
  if (!data) return false;
  G.money = data.money;
  G.hp = data.hp;
  G.ammo = data.ammo;
  G.reserve = data.reserve ?? 24;
  G.clock = data.clock;
  G.mission.done = data.done || [false, false, false, false];
  G.stats.earned = data.earned || 0;
  G.stats.fares = data.fares || 0;
  if (typeof data.x === 'number') {
    G.player.x = data.x;
    G.player.y = data.y;
  }
  return true;
}
