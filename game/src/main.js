// SOLMAR STREETS — boot, the frame loop and the screen state machine.
// One clear job: own the frame — read input, step the world, draw it —
// and move between title, play, pause and game over.

import { GAME_VERSION, VIEW } from './config.js';
import { createInput, endFrameInput, justPressed, keyPressed, moveVector, ACTION_CONFIRM, ACTION_ENTER_CAR, ACTION_FPS, ACTION_HORN, ACTION_MUTE, ACTION_PAUSE, ACTION_PUNCH, ACTION_RELOAD } from './input.js';
import { createAudio, sfx, toggleMute, unlockAudio, updateAudio } from './audio.js';
import { createWorld, startRun, stepWorld, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './world.js';
import { createRenderer } from './render.js';
import { stageShot } from './shots.js';
import { clearSave, hasSave, loadGame, saveGame, saveSummary } from './save.js';
import { seedFromString } from './random.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = VIEW.width;
canvas.height = VIEW.height;

const input = createInput(canvas);
const audio = createAudio();
const params = new URLSearchParams(window.location.search);
const seedRaw = params.get('seed') ?? '';
const seedNum = Number.parseInt(seedRaw, 10);
const seed = Number.isInteger(seedNum) ? seedNum : seedRaw ? seedFromString(seedRaw) : Math.floor(Math.random() * 4294967296);
const shotName = params.get('shot');
const world = createWorld(seed);
const renderer = createRenderer(canvas);

let frozen = false;
let fpsEma = 60;
let showFps = false;

if (shotName) {
  const staged = stageShot(shotName, world);
  world.screen = staged.screen;
  frozen = true;
  // ?zoom= reframes any shot after staging, so one URL frames the cover.
  const zoomParam = Number.parseFloat(params.get('zoom') ?? '');
  if (Number.isFinite(zoomParam) && zoomParam >= 0.5 && zoomParam <= 2) {
    world.camera.zoom = zoomParam;
  }
  document.title = `SOLMAR STREETS — ${shotName}`;
}

function mouseWorldPos() {
  const cam = world.camera;
  // Same clamp the renderer uses, so the aim point matches the crosshair.
  const vw = VIEW.width / cam.zoom;
  const vh = VIEW.height / cam.zoom;
  const cx = Math.max(vw / 2, Math.min(3600 - vw / 2, cam.x));
  const cy = Math.max(vh / 2, Math.min(2700 - vh / 2, cam.y));
  return {
    x: cx + (input.mouseX - VIEW.width / 2) / cam.zoom,
    y: cy + (input.mouseY - VIEW.height / 2) / cam.zoom,
  };
}

/** Drain the sounds the world queued this frame. */
function drainAudio() {
  for (const name of world.events) sfx(audio, name);
  world.events.length = 0;
  if (world.sfxEvent) {
    sfx(audio, world.sfxEvent);
    world.sfxEvent = null;
  }
}

function onFirstGesture() {
  unlockAudio(audio);
  audio.musicOn = true;
}
window.addEventListener('pointerdown', onFirstGesture, { once: false });
window.addEventListener('keydown', onFirstGesture, { once: false });

// Alt-tabbing away pauses the game instead of letting the city run on
// while the player is not looking.
document.addEventListener('visibilitychange', () => {
  if (document.hidden && !frozen && world.screen === SCREEN_PLAY) {
    world.screen = SCREEN_PAUSED;
  }
});

let last = performance.now();

function frame(now) {
  const dt = Math.min(0.033, Math.max(0.001, (now - last) / 1000));
  last = now;
  fpsEma += (1 / Math.max(dt, 0.001) - fpsEma) * 0.05;
  if (showFps) document.title = `SOLMAR STREETS — ${Math.round(fpsEma)} fps`;

  // Per-frame input snapshot: the world reads these as values.
  input.moveVector = moveVector(input);
  input.enterPressed = keyPressed(input, ACTION_ENTER_CAR);
  input.punchPressed = keyPressed(input, ACTION_PUNCH);
  input.reloadPressed = keyPressed(input, ACTION_RELOAD);
  input.confirmPressed = keyPressed(input, ACTION_CONFIRM);
  input.pausePressed = keyPressed(input, ACTION_PAUSE);
  input.mutePressed = keyPressed(input, ACTION_MUTE);
  input.hornPressed = keyPressed(input, ACTION_HORN);

  if (keyPressed(input, ACTION_FPS)) {
    showFps = !showFps;
    // Toggling the readout off must put the real title back — otherwise
    // the tab keeps showing the last frame-rate reading forever.
    if (!showFps) document.title = 'SOLMAR STREETS — open-world crime game';
  }

  if (input.mutePressed) {
    const muted = toggleMute(audio);
    world.toasts.push({ text: muted ? 'Sound muted' : 'Sound on', t: 0 });
  }

  if (!frozen) {
    if (world.screen === SCREEN_TITLE) {
      // Tell screen readers what waits behind the title: a save, or a fresh start.
      const statusEl = document.getElementById('status');
      if (statusEl) statusEl.textContent = hasSave() ? saveSummary(loadGame()) : 'SOLMAR STREETS — no save yet, a new story starts in Solmar.';
      if (input.confirmPressed || input.mouseClicked) {
        onFirstGesture();
        sfx(audio, 'click');
        startRun(world, hasSave() ? loadGame() : null);
      } else if (justPressed(input, 'KeyN')) {
        onFirstGesture();
        clearSave();
        sfx(audio, 'click');
        startRun(world, null);
      }
    } else if (world.screen === SCREEN_PLAY) {
      if (input.pausePressed) {
        world.screen = SCREEN_PAUSED;
        sfx(audio, 'click');
      } else {
        stepWorld(world, input, dt, mouseWorldPos());
      }
    } else if (world.screen === SCREEN_PAUSED) {
      if (input.pausePressed || input.mouseClicked) {
        world.screen = SCREEN_PLAY;
        sfx(audio, 'click');
      } else if (justPressed(input, 'KeyS')) {
        saveGame(world);
        world.toasts.push({ text: 'Game saved', t: 0 });
        sfx(audio, 'pickup');
      } else if (justPressed(input, 'KeyR')) {
        startRun(world, null);
      } else if (justPressed(input, 'KeyQ')) {
        world.screen = SCREEN_TITLE;
      }
    } else if (world.screen === SCREEN_OVER) {
      if (justPressed(input, 'KeyR') || input.mouseClicked) {
        sfx(audio, 'click');
        startRun(world, null);
      }
    }
    drainAudio();
    updateAudio(audio, world);
  }

  renderer.render(world, input);
  endFrameInput(input);
  if (frozen && !window.__shotReady) {
    // Paint twice so the first frame is never a half-drawn one, then
    // tell the screenshot driver the scene is ready.
    renderer.render(world, input);
    window.__shotReady = true;
  }
  requestAnimationFrame(frame);
}

// For the playtest driver and the screenshot script.
window.__SOLMAR__ = {
  world,
  input,
  audio,
  version: GAME_VERSION,
  fps: () => Math.round(fpsEma),
  // Debug helpers the playtest driver uses: restart from scratch, and
  // jump the player somewhere without driving there.
  restart: () => startRun(world, null),
  save: () => saveGame(world), // save right now, for the playtest driver
  teleport: (x, y) => {
    world.player.x = x;
    world.player.y = y;
    world.camera.x = x;
    world.camera.y = y;
    if (world.player.car) {
      world.player.car.x = x;
      world.player.car.y = y;
    }
  },
};
requestAnimationFrame(frame);
