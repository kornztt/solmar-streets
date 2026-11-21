// localStorage save/load for Continue on the title screen.
const KEY = 'solmar-streets-save-v1';

export function saveGame(G) {
  try {
    const data = {
      money: G.player.money,
      hp: G.player.hp,
      ammo: G.player.ammo,
      wanted: G.player.wanted,
      x: G.player.x,
      y: G.player.y,
      clock: G.clock,
      missionIndex: G.missionIndex,
      kills: G.player.kills || 0,
      savedAt: Date.now(),
    };
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

export function hasSave() {
  try {
    return !!localStorage.getItem(KEY);
  } catch (e) {
    return false;
  }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch (e) { /* no storage */ }
}
