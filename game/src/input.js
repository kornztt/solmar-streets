// Keyboard and mouse input: one clear job — track what the player is
// pressing right now, and which keys were just pressed this frame.

export const ACTION_CONFIRM = 'confirm';
export const ACTION_PAUSE = 'pause';
export const ACTION_ENTER_CAR = 'enterCar';
export const ACTION_PUNCH = 'punch';
export const ACTION_RELOAD = 'reload';
export const ACTION_MUTE = 'mute';
export const ACTION_HORN = 'horn';
export const ACTION_RESTART = 'restart';
export const ACTION_FPS = 'fps'; // the frame-rate readout toggle (T)

/** The keys shown on the help line, one per action — kept next to the
 * bindings so the help text can never drift away from the real keys. */
export const ACTION_LABELS = {
  [ACTION_ENTER_CAR]: 'E — enter / exit car, talk, buy',
  [ACTION_PUNCH]: 'F — punch',
  [ACTION_RELOAD]: 'R — reload',
  [ACTION_HORN]: 'H — honk',
  [ACTION_PAUSE]: 'P — pause',
  [ACTION_MUTE]: 'M — mute',
  [ACTION_FPS]: 'T — show frame rate',
  [ACTION_RESTART]: 'R — restart (game over)',
};

const KEY_ACTIONS = {
  Enter: ACTION_CONFIRM,
  Escape: ACTION_PAUSE,
  KeyP: ACTION_PAUSE,
  KeyE: ACTION_ENTER_CAR,
  KeyF: ACTION_PUNCH,
  KeyR: ACTION_RELOAD,
  KeyM: ACTION_MUTE,
  KeyH: ACTION_HORN,
  KeyT: ACTION_FPS,
};

export function createInput(canvas) {
  const input = {
    keys: new Set(),
    pressed: new Set(), // keys pressed since the last endFrameInput
    released: new Set(), // keys released since the last endFrameInput
    mouseX: 0,
    mouseY: 0,
    mouseDown: false,
    mouseClicked: false, // set on mousedown, cleared by endFrameInput
    locked: false,
  };

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    input.keys.add(event.code);
    input.pressed.add(event.code);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
  });
  window.addEventListener('keyup', (event) => {
    input.keys.delete(event.code);
    input.released.add(event.code);
  });
  // Losing the window must never leave a key stuck down — or a press that
  // fired before the blur landing on the frame after it. Released keys are
  // cleared too: a release that happened off-screen is already forgotten.
  window.addEventListener('blur', () => {
    input.keys.clear();
    input.pressed.clear();
    input.released.clear();
  });

  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    input.mouseX = (event.clientX - rect.left) * (canvas.width / rect.width);
    input.mouseY = (event.clientY - rect.top) * (canvas.height / rect.height);
  });
  canvas.addEventListener('mousedown', (event) => {
    if (event.button !== 0) return;
    input.mouseDown = true;
    input.mouseClicked = true;
    const rect = canvas.getBoundingClientRect();
    input.mouseX = (event.clientX - rect.left) * (canvas.width / rect.width);
    input.mouseY = (event.clientY - rect.top) * (canvas.height / rect.height);
  });
  window.addEventListener('mouseup', () => {
    input.mouseDown = false;
  });
  return input;
}

/** True while the key is held down. */
export function keyDown(input, code) {
  return input.keys.has(code);
}

/** True only on the frame the key went down (raw code, e.g. 'KeyN'). */
export function justPressed(input, code) {
  return input.pressed.has(code);
}

/** True only on the frame the key went up. */
export function justReleased(input, code) {
  return input.released.has(code);
}

/** True only on the frame the left mouse button went down. */
export function wasClicked(input) {
  return input.mouseClicked;
}

/** True only on the frame the key went down. */
export function keyPressed(input, action) {
  for (const code of input.pressed) {
    if (KEY_ACTIONS[code] === action) return true;
  }
  return false;
}

/** Every named action pressed this frame, for screens that read them all. */
export function pressedActions(input) {
  const out = [];
  for (const code of input.pressed) {
    const action = KEY_ACTIONS[code];
    if (action && !out.includes(action)) out.push(action);
  }
  return out;
}

/** WASD / arrows as a -1..1 movement vector, already normalised. */
export function moveVector(input) {
  let x = 0;
  let y = 0;
  if (keyDown(input, 'KeyA') || keyDown(input, 'ArrowLeft')) x -= 1;
  if (keyDown(input, 'KeyD') || keyDown(input, 'ArrowRight')) x += 1;
  if (keyDown(input, 'KeyW') || keyDown(input, 'ArrowUp')) y -= 1;
  if (keyDown(input, 'KeyS') || keyDown(input, 'ArrowDown')) y += 1;
  if (x !== 0 && y !== 0) {
    x *= Math.SQRT1_2;
    y *= Math.SQRT1_2;
  }
  return { x, y };
}

export function endFrameInput(input) {
  input.pressed.clear();
  input.released.clear();
  input.mouseClicked = false;
}
