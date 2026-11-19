// Save / load through localStorage. The save holds the player's money,
// finished missions, position, health, ammo and the time of day — enough
// that Continue drops you back where you left off.

const KEY = 'solmar-streets-save-v1';

export function saveGameData(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch (e) {
    return false;
  }
}

export function loadGameData() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export function clearSaveData() {
  try {
    localStorage.removeItem(KEY);
  } catch (e) {
    /* storage unavailable */
  }
}

export function hasSaveData() {
  try {
    return localStorage.getItem(KEY) !== null;
  } catch (e) {
    return false;
  }
}
